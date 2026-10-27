// filepath: extension/entrypoints/background/icon-animation.ts
/**
 * Toolbar download-animation controller (beads 08fg.1 + 08fg.2). Maps the
 * pure state machine (src/icon/icon-state-machine.ts) to setIcon calls:
 * spinner frames while the queue is busy — count composited in-ring when a
 * CountRenderer is available, path frames + badge text as the fallback —
 * plus success/error flash overlays on drain and per-tab base icons
 * otherwise. Frames live in src/icon/fx/ (regenerate with
 * tools/generate-icon-frames.mjs).
 */

import {
  SPIN_FRAME_COUNT,
  createIconStateMachine,
  type IconRender,
  type IconTimers,
  type SettleKind,
} from '../../src/icon/icon-state-machine';
import {
  isClassroomUrl,
  setActionIcon,
  setIconOverrideImageData,
  setIconOverridePaths,
} from './icon-manager';
import { createRuntimeCountRenderer, type CountRenderer } from './icon-count-renderer';

// The toolbar is the only surface setIcon reaches; 48 covers the largest
// toolbar scale factor, so 96/128 frame variants would never be shown.
const SIZES = [16, 32, 48] as const;

function buildPaths(name: string): Record<number, string> {
  const map: Record<number, string> = {};
  for (const size of SIZES) map[size] = `icon/fx/${name}-${size}.png`;
  return map;
}

export const SPIN_FRAME_PATHS: Record<number, string>[] = Array.from(
  { length: SPIN_FRAME_COUNT },
  (_, i) => buildPaths(`spin-${i}`),
);
export const SUCCESS_ICON_PATHS = buildPaths('success');
export const ERROR_ICON_PATHS = buildPaths('error');

const BADGE_BG = '#188038';
const BADGE_FG = '#ffffff';
const MAX_BADGE_LABEL = '99';

const globalTimers: IconTimers = {
  setInterval: (fn, ms) => setInterval(fn, ms),
  clearInterval: (handle) => clearInterval(handle as ReturnType<typeof setInterval>),
  setTimeout: (fn, ms) => setTimeout(fn, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
};

let badgeStyled = false;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function actionApi(): any | null {
  if (typeof chrome === 'undefined') return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (chrome as any).action || (chrome as any).browserAction || null;
}

function showBadge(count: number): void {
  const api = actionApi();
  if (!api?.setBadgeText) return;
  if (!badgeStyled) {
    badgeStyled = true;
    api.setBadgeBackgroundColor?.({ color: BADGE_BG });
    api.setBadgeTextColor?.({ color: BADGE_FG });
  }
  api.setBadgeText({ text: count > 99 ? MAX_BADGE_LABEL : String(count) });
}

function hideBadge(): void {
  actionApi()?.setBadgeText?.({ text: '' });
}

export interface IconAnimationController {
  setActiveCount(count: number): void;
  notifySettled(kind: SettleKind): void;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

// Registry for callers outside index.ts (download-handler terminal failures).
let activeController: IconAnimationController | null = null;

export function getIconAnimationController(): IconAnimationController | null {
  return activeController;
}

function repaintTabs(): void {
  if (typeof chrome === 'undefined' || !chrome.tabs?.query) return;
  chrome.tabs.query({}, (tabs) => {
    for (const tab of tabs) {
      if (tab.id !== undefined) setActionIcon(tab.id, isClassroomUrl(tab.url));
    }
  });
}

export function createIconAnimationController(deps?: {
  timers?: IconTimers;
  renderer?: CountRenderer;
}): IconAnimationController {
  const timers = deps?.timers ?? globalTimers;
  const renderer = deps?.renderer ?? createRuntimeCountRenderer();
  let activeCount = 0;
  let applySeq = 0;

  const applyFramePaths = (paths: Record<number, string> | null): void => {
    setIconOverrideImageData(null);
    setIconOverridePaths(paths);
    repaintTabs();
  };

  // The machine only emits on change, so no extra dedupe lives here.
  const apply = (render: IconRender): void => {
    if (render.phase === 'disabled') {
      // No repaint here: index.ts calls setEnabled BEFORE updateGlobalIcon,
      // whose gray walk lands right after the overrides are cleared.
      setIconOverrideImageData(null);
      setIconOverridePaths(null);
      hideBadge();
      return;
    }

    if (render.phase === 'active') {
      if (activeCount > 0 && renderer.isAvailable()) {
        // Composite the count into each size, latest render wins: a slow
        // composite from an earlier frame must never overwrite a newer one.
        const seq = ++applySeq;
        const frameIndex = render.frameIndex;
        void (async () => {
          const out: Record<number, ImageData> = {};
          for (const size of SIZES) {
            const data = await renderer.render(
              `icon/fx/spin-${frameIndex}-${size}.png`,
              size,
              activeCount,
            );
            if (!data) {
              // Compositing failed at runtime → degrade to frames + badge.
              if (seq === applySeq) {
                showBadge(activeCount);
                applyFramePaths(SPIN_FRAME_PATHS[frameIndex]);
              }
              return;
            }
            out[size] = data;
          }
          if (seq !== applySeq) return;
          setIconOverridePaths(null);
          setIconOverrideImageData(out);
          hideBadge();
          repaintTabs();
        })();
        return;
      }
      setIconOverrideImageData(null);
      setIconOverridePaths(SPIN_FRAME_PATHS[render.frameIndex]);
      showBadge(activeCount);
      repaintTabs();
      return;
    }

    hideBadge();
    applyFramePaths(
      render.phase === 'success-flash'
        ? SUCCESS_ICON_PATHS
        : render.phase === 'error-flash'
          ? ERROR_ICON_PATHS
          : null,
    );
  };

  const machine = createIconStateMachine({ timers, onChange: apply });
  const controller: IconAnimationController = {
    setActiveCount(count: number): void {
      activeCount = count;
      machine.setActiveCount(count);
    },
    notifySettled: machine.notifySettled,
    setEnabled: machine.setEnabled,
    dispose: machine.dispose,
  };
  activeController = controller;
  return controller;
}
