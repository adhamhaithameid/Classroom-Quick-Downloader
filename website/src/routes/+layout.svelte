<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { base } from '$app/paths';
  import { navigating, page } from '$app/stores';
  import logo from '$lib/assets/cqd-logo.svg';
  import { APP_VERSION, BING_SITE_VERIFICATION, GOOGLE_SITE_VERIFICATION, STORE_LINKS } from '$lib/config';
  import { browserDisplayName, detectBrowserFromNavigator, type BrowserKey } from '$lib/browser/detect';
  import { flushWebsiteEvents, initWebsiteEventsClient, trackWebsiteEvent } from '$lib/analytics/websiteEvents';
  import { initializeWebsiteSnapshotStore, websiteSnapshotStore } from '$lib/stores/websiteSnapshot';
  import LoadingScreen from '$lib/components/LoadingScreen.svelte';
  import SiteFooter from '$lib/components/SiteFooter.svelte';
  import BrowserIcon from '$lib/components/BrowserIcon.svelte';
  import BrowserIconSprite from '$lib/components/BrowserIconSprite.svelte';
  import AmbientBackground from '$lib/components/AmbientBackground.svelte';
  import CursorLayer from '$lib/cursor/CursorLayer.svelte';
  import { initMagneticPin } from '$lib/scroll/magneticPin';
  import '../app.css';

  type MenuIconKey =
    | 'spark'
    | 'bolt'
    | 'play'
    | 'shield'
    | 'download'
    | 'doc'
    | 'question'
    | 'lock'
    | 'clock'
    | 'megaphone';

  type MenuLink = {
    href: string;
    label: string;
    desc: string;
    icon: MenuIconKey;
    external?: boolean;
  };

  type MenuColumn = { title: string; links: MenuLink[] };

  type MenuFeatured = {
    kind: 'install' | 'link';
    href: string;
    title: string;
    desc: string;
    cta: string;
    external?: boolean;
  };

  type MenuDef = {
    key: string;
    href: string;
    label: string;
    columns: MenuColumn[];
    featured: MenuFeatured;
  };

  const MENU_ICONS: Record<MenuIconKey, string[]> = {
    spark: ['M12 3l2.3 5.7L20 11l-5.7 2.3L12 19l-2.3-5.7L4 11l5.7-2.3z'],
    bolt: ['M13 3 5.5 13.5H11L10 21l7.5-10.5H12z'],
    play: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M10 8.6v6.8l5.6-3.4Z'],
    shield: ['M12 3.2 19 6v5.1c0 4.4-2.9 7.4-7 8.9-4.1-1.5-7-4.5-7-8.9V6Z', 'M9.2 11.7l2 2 3.6-3.8'],
    download: ['M12 4v10', 'M8.2 10.4 12 14.2l3.8-3.8', 'M5 19.2h14'],
    doc: ['M7 3.2h7.2L18.8 8v12.8H7Z', 'M14 3.4V8h4.6'],
    question: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M9.6 9.4a2.5 2.5 0 1 1 3.7 2.3c-.9.5-1.3 1-1.3 1.9', 'M12 16.8h.01'],
    lock: ['M5.8 11h12.4v9.2H5.8Z', 'M9 11V8.2a3 3 0 0 1 6 0V11'],
    clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7.2V12l3.2 1.9'],
    megaphone: ['M4 10.2v3.6l12.4 4V6.2Z', 'M16.4 8.6a3.6 3.6 0 0 1 0 6.8', 'M7.6 14.6v4.8']
  };

  // Every dropdown target is a real, crawlable route: the shared panel ships
  // in the server HTML (hidden until hover) so the internal link graph is
  // indexable without JavaScript.
  const navMenus: MenuDef[] = [
    {
      key: 'overview',
      href: '/',
      label: 'Overview',
      columns: [
        {
          title: 'Product',
          links: [
            { href: '/', icon: 'spark', label: 'Overview', desc: 'One-click bulk downloads for Google Classroom.' },
            { href: '/#how-it-works', icon: 'bolt', label: 'How it works', desc: 'The full save-everything flow in four steps.' },
            { href: '/watch/cqd-demo', icon: 'play', label: 'Watch the demo', desc: 'A 21-second real classroom batch download.' },
            { href: '/security', icon: 'shield', label: 'Security & permissions', desc: 'Exactly what the extension can and cannot access.' }
          ]
        },
        {
          title: 'Guides',
          links: [
            { href: '/download-all-attachments-google-classroom', icon: 'download', label: 'Download all attachments', desc: 'Every file from every assignment, one click.' },
            { href: '/bulk-download-google-classroom-assignments', icon: 'download', label: 'Bulk download assignments', desc: 'Zip through end-of-term cleanup in minutes.' },
            { href: '/download-google-classroom-materials-fast', icon: 'doc', label: 'Grab materials fast', desc: 'Reference files without the clicking marathon.' }
          ]
        }
      ],
      featured: {
        kind: 'install',
        href: '',
        title: 'Free forever',
        desc: 'No account. No tracking. Installed in under 10 seconds.',
        cta: ''
      }
    },
    {
      key: 'privacy',
      href: '/privacy',
      label: 'Privacy',
      columns: [
        {
          title: 'Trust',
          links: [
            { href: '/privacy', icon: 'lock', label: 'Privacy, in plain words', desc: 'Zero cookies, zero trackers, zero personal data.' },
            { href: '/security', icon: 'shield', label: 'Security overview', desc: 'Permissions, audits, and how data is handled.' },
            { href: '/google-workspace-school-accounts-support', icon: 'question', label: 'School & Workspace accounts', desc: 'Installing on managed Google Education accounts.' }
          ]
        }
      ],
      featured: {
        kind: 'link',
        href: '/privacy',
        title: 'We collect nothing',
        desc: 'No download analytics. No account. Ever.',
        cta: 'Read the privacy policy'
      }
    },
    {
      key: 'faq',
      href: '/faq',
      label: 'FAQ',
      columns: [
        {
          title: 'Help center',
          links: [
            { href: '/faq', icon: 'question', label: 'All questions', desc: 'Installs, permissions, limits, and quick fixes.' },
            { href: '/support', icon: 'doc', label: 'Support guide', desc: 'Step-by-step troubleshooting for every browser.' },
            { href: '/google-drive-cant-scan-virus-warning-download', icon: 'shield', label: 'Drive virus warning', desc: 'Why Chrome flags Classroom files, and the fix.' }
          ]
        }
      ],
      featured: {
        kind: 'link',
        href: 'github',
        external: true,
        title: 'Still stuck?',
        desc: 'Open an issue and get an answer fast.',
        cta: 'Report an issue'
      }
    },
    {
      key: 'changelog',
      href: '/changelog',
      label: 'Changelog',
      columns: [
        {
          title: 'Releases',
          links: [
            { href: '/changelog', icon: 'clock', label: 'Release history', desc: 'Every improvement, fix, and new feature.' },
            { href: '/press-kit', icon: 'megaphone', label: 'Press kit', desc: 'Logos, screenshots, and brand assets.' },
            { href: '/featured', icon: 'spark', label: 'Featured mentions', desc: 'Reviews and community shout-outs.' }
          ]
        }
      ],
      featured: {
        kind: 'link',
        href: 'github',
        external: true,
        title: 'Follow every release',
        desc: 'Star the repo to catch new versions first.',
        cta: 'Open GitHub'
      }
    }
  ];

  let detectedBrowser: BrowserKey = 'chrome';
  let mobileNavOpen = false;
  let openMenu: string | null = null;
  let menuCloseTimer: ReturnType<typeof setTimeout> | null = null;
  let scrolled = false;
  let navDark = false;
  let navBarEl: HTMLElement | undefined;
  let panelEl: HTMLElement | undefined;
  let mainEl: HTMLElement | undefined;
  let sheetCleanups: Array<() => void> = [];
  /* Reveal-driven ambient gating: each AmbientBackground freezes its orbs
     and lens canvas while its surface cannot be seen. footerRevealActive
     mirrors the reveal hysteresis; sheetGone means the sheet has fully
     lifted off (its own ambient can no longer paint anything visible). */
  let revealShell: HTMLElement | undefined;
  let footerRevealActive = false;
  let sheetGone = false;
  let magnetDispose: (() => void) | undefined;
  let route = '/';
  let isOverviewStyleRoute = false;
  let hideChrome = false;
  let snapshotLinks: { chrome: string; firefox: string; edge: string; github: string } | null = null;
  $: snapshotLinks = $websiteSnapshotStore.snapshot?.overview.links ?? null;
  $: githubHref = snapshotLinks?.github || STORE_LINKS.github;

  // Buy Me a Coffee (owner-confirmed 2026-09-22). Official button art lives
  // in /static/bmc-button.svg and shows in the desktop hover panels.
  const BUY_COFFEE_URL = 'https://www.buymeacoffee.com/adhamhaithameid';

  function browserLink(key: BrowserKey): string {
    return snapshotLinks?.[key] || STORE_LINKS[key];
  }

  function resolveMenuHref(href: string): string {
    if (href === 'github') return githubHref;
    if (!href.startsWith('/')) return href;
    return `${base}${href}`;
  }

  function normalizePath(path: string): string {
    const [pathWithoutHash] = path.split('#');
    const [pathOnly] = pathWithoutHash.split('?');
    return pathOnly.replace(/\/$/, '') || '/';
  }

  function isActive(navHref: string, currentPath: string): boolean {
    const normalizedCurrent = normalizePath(currentPath);
    const normalizedNav = normalizePath(navHref);
    if (normalizedNav === '/' && normalizedCurrent === '/overview') {
      return true;
    }
    return normalizedCurrent === normalizedNav;
  }

  function toggleMobileMenu(): void {
    mobileNavOpen = !mobileNavOpen;
  }

  function closeMobileMenu(): void {
    mobileNavOpen = false;
  }

  /* ------------------------------------------------------------------
     Shared dropdown panel (Cloudflare-style): one centered module that
     morphs its width/height between menus instead of re-opening, with
     the content re-staggering in ("retyped") on every switch.
     ------------------------------------------------------------------ */
  function applyPanelSize(key: string): void {
    if (!panelEl) return;
    const block = panelEl.querySelector<HTMLElement>(`#nav-menu-${key}`);
    if (!block) return;
    // Hidden blocks stretch to the grid row (tallest sibling), so measure
    // the inner content wrapper — it keeps the block's natural height.
    const content = block.firstElementChild as HTMLElement | null;
    const styles = getComputedStyle(panelEl);
    const padX = parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
    const padY = parseFloat(styles.paddingTop) + parseFloat(styles.paddingBottom);
    const borderX = parseFloat(styles.borderLeftWidth) + parseFloat(styles.borderRightWidth);
    const borderY = parseFloat(styles.borderTopWidth) + parseFloat(styles.borderBottomWidth);
    const maxW = document.documentElement.clientWidth - 32;
    const natural = block.offsetWidth + padX + borderX;
    // Viewport-capped: let the active block wrap inside the panel instead
    // of being clipped at both edges by the centered overflow.
    if (natural > maxW) {
      block.style.maxWidth = `${Math.round(maxW - padX - borderX)}px`;
    } else if (block.style.maxWidth) {
      block.style.maxWidth = '';
    }
    const width = Math.min(natural, maxW);
    const height = (content?.offsetHeight ?? block.offsetHeight) + padY + borderY;
    panelEl.style.width = `${Math.round(width)}px`;
    panelEl.style.height = `${Math.round(height)}px`;
  }

  function cancelMenuClose(): void {
    if (menuCloseTimer) {
      clearTimeout(menuCloseTimer);
      menuCloseTimer = null;
    }
  }

  function openMenuFor(key: string): void {
    cancelMenuClose();
    if (openMenu === key) return;
    openMenu = key;
    // The install submenu anchors to the CTA, not the shared panel module.
    if (key === 'install') return;
    applyPanelSize(key);
    if (key === 'github') void ensureGithubStats();
  }

  function scheduleMenuClose(): void {
    if (menuCloseTimer) clearTimeout(menuCloseTimer);
    menuCloseTimer = setTimeout(() => {
      menuCloseTimer = null;
      openMenu = null;
    }, 170);
  }

  function closeMenus(): void {
    cancelMenuClose();
    openMenu = null;
  }

  // Keyboard focus support. These run as real window listeners (svelte:window)
  // because per-element focusin delegation proved unreliable across runtimes.
  function handleDocFocusIn(event: FocusEvent): void {
    const target = event.target as HTMLElement | null;
    const link = target?.closest?.('a[data-menu-key]') as HTMLElement | null;
    const key = link?.dataset.menuKey;
    if (key) openMenuFor(key);
  }

  function handleDocFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as HTMLElement | null;
    if (
      next?.closest?.('.l2-nav-dropdown') ||
      next?.closest?.('.l2-nav-alt-browsers') ||
      next?.closest?.('a[data-menu-key]')
    ) {
      return;
    }
    scheduleMenuClose();
  }

  function trackInstallClick(placement: string): void {
    trackWebsiteEvent({
      eventType: 'cta',
      action: 'install_click',
      placement,
      pagePath: $page.url.pathname
    });
  }

  function handleSiteLinkClick(event: MouseEvent, href: string): void {
    closeMobileMenu();
    closeMenus();

    const [hrefPath, hash] = href.split('#');
    if (!hash) return;

    const currentPath = normalizePath($page.url.pathname);
    const targetPath = normalizePath(hrefPath || currentPath);
    if (targetPath !== currentPath) return;

    const target = document.getElementById(hash);
    if (!target) return;

    event.preventDefault();
    const headerOffset = 88;
    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
    history.replaceState(
      history.state,
      '',
      `${base}${targetPath === '/' ? '' : targetPath}#${hash}`
    );
  }

  function handleFeaturedInstallClick(): void {
    closeMenus();
    trackInstallClick('nav_menu_install');
  }

  // The specular sheen follows the pointer. Writes are throttled and the bar
  // rect is cached on pointerenter so scrolling a busy page never forces
  // per-event layout reads.
  let navBarRect: DOMRect | null = null;
  let lastPointerWrite = 0;

  function handleBarPointerEnter(): void {
    navBarRect = navBarEl?.getBoundingClientRect() ?? null;
  }

  function handleBarPointerLeave(): void {
    navBarRect = null;
  }

  function handleBarPointerMove(event: PointerEvent): void {
    if (!navBarEl || !navBarRect) return;
    const now = performance.now();
    if (now - lastPointerWrite < 50) return;
    lastPointerWrite = now;
    if (!navBarRect.width) return;
    const ratio = ((event.clientX - navBarRect.left) / navBarRect.width) * 100;
    navBarEl.style.setProperty('--nav-pointer-x', `${ratio.toFixed(1)}%`);
  }

  /* Live GitHub stats for the repo preview card. Fetched once on first
     hover; on any failure the card keeps its static fallback content. */
  let githubStats: { stars: number; forks: number; issues: number } | null = null;
  let githubStatsFetched = false;

  async function ensureGithubStats(): Promise<void> {
    if (githubStatsFetched) return;
    githubStatsFetched = true;
    try {
      const repo = STORE_LINKS.github.replace('https://github.com/', '').replace(/\/+$/, '');
      const response = await fetch(`https://api.github.com/repos/${repo}`, {
        headers: { Accept: 'application/vnd.github+json' }
      });
      if (!response.ok) return;
      const data = (await response.json()) as Record<string, unknown>;
      githubStats = {
        stars: typeof data.stargazers_count === 'number' ? data.stargazers_count : 0,
        forks: typeof data.forks_count === 'number' ? data.forks_count : 0,
        issues: typeof data.open_issues_count === 'number' ? data.open_issues_count : 0
      };
    } catch {
      // Network or rate-limit failure: keep the static preview values.
    }
  }

  function formatCount(value: number): string {
    if (value >= 1000) return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k`;
    return String(value);
  }

  /* ------------------------------------------------------------------
     Rest bar -> compact centered pill. The width is measured (content
     width + pill paddings) and transitioned explicitly, so the morph is
     a real animated width change rather than a margin snap.
     ------------------------------------------------------------------ */
  let barMode: 'rest' | 'pill' | null = null;

  function syncBarMode(on: boolean): void {
    const bar = navBarEl;
    const inner = bar?.querySelector<HTMLElement>(':scope > .l2-nav-inner');
    const float = bar?.parentElement;
    if (!bar || !inner || !float) return;
    const next: 'rest' | 'pill' = on ? 'pill' : 'rest';
    if (next === barMode) return;
    barMode = next;

    if (next === 'pill') {
      // Mobile layout: links and CTA are hidden, so a content-sized pill
      // would be one dead middle — stay full-width and let the scrolled
      // glass styling do the work.
      if (window.matchMedia('(max-width: 860px)').matches) {
        bar.style.width = '';
        bar.style.marginLeft = '';
        bar.style.marginRight = '';
        return;
      }
      // The centered links row is position:absolute, so it never
      // contributes to max-content width — measure each segment with it
      // temporarily in flow.
      const available = float.clientWidth;
      const brand = inner.querySelector<HTMLElement>(':scope > .l2-nav-brand');
      const links = inner.querySelector<HTMLElement>(':scope > .l2-nav-links');
      const actions = inner.querySelector<HTMLElement>(':scope > .l2-nav-actions');
      const prevTransition = bar.style.transition;
      bar.style.transition = 'none';
      bar.classList.add('l2-measure');
      // Measure with the pill's own padding: the is-scrolled class may not
      // have reached the DOM yet when this runs inside the reactive flush,
      // and rest-state padding would inflate the target width by 24px.
      // is-scrolled also swaps in the pill's Install button + store
      // bubbles, so actionsW is measured in the exact layout the pill
      // will use.
      bar.closest('.l2-nav-shell')?.classList.add('is-scrolled');
      bar.style.width = 'max-content';
      const brandW = brand?.offsetWidth ?? 0;
      const linksW = links?.offsetWidth ?? 0;
      const actionsW = actions?.offsetWidth ?? 0;
      bar.style.width = `${available}px`;
      bar.style.marginLeft = '0px';
      bar.style.marginRight = '0px';
      void bar.offsetWidth;
      bar.classList.remove('l2-measure');
      bar.style.transition = prevTransition;
      const cs = getComputedStyle(bar);
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
      const borderX = parseFloat(cs.borderLeftWidth) + parseFloat(cs.borderRightWidth);
      // Geometry: the install cluster (compact "Install" button + browser
      // bubbles) is wider than the 42px logo, so a page-centered pill
      // cannot also pin the links to the page's absolute center. The pill
      // centers on the page (equal margins) and the links cluster rides
      // half the width difference, which keeps it centered inside the pill
      // with equal 24px gaps on both sides.
      const gap = 24;
      const cap = Math.round(document.documentElement.clientWidth * 0.92);
      const target = Math.max(
        Math.min(
          Math.round(linksW + gap * 2 + brandW + actionsW + padX + borderX),
          cap
        ),
        320
      );
      const centerDelta = Math.round((actionsW - brandW) / 2);
      const inset = Math.max(0, Math.round((available - target) / 2));
      bar.style.width = `${target}px`;
      bar.style.marginLeft = `${inset}px`;
      bar.style.marginRight = `${inset}px`;
      bar.style.setProperty('--nav-links-shift', `${-centerDelta}px`);
    } else {
      if (!bar.style.width) return;
      // Returning: width animates px -> 100% while margins animate px -> 0.
      // Same easing on both keeps outer width constant, so the bar expands
      // symmetrically from its center instead of snapping left.
      bar.style.width = '';
      bar.style.marginLeft = '';
      bar.style.marginRight = '';
      bar.style.removeProperty('--nav-links-shift');
    }
  }

  function updateScrolled(): void {
    scrolled = window.scrollY > 24;
  }

  function handleWindowScroll(): void {
    updateScrolled();
  }

  let resizeTimer: ReturnType<typeof setTimeout> | null = null;
  function handleWindowResize(): void {
    if (resizeTimer) return;
    resizeTimer = setTimeout(() => {
      resizeTimer = null;
      barMode = null;
      syncBarMode(scrolled);
      if (openMenu) applyPanelSize(openMenu);
    }, 120);
  }

  /* ------------------------------------------------------------------
     Sticky sheet reveal: the page scrolls normally, pins once its end
     reaches the viewport bottom (acting as the end of the page), then
     lifts away — rounded edge + shadow onto the footer beneath — while
     the footer window's own content scrolls on through the rest of the
     reveal. Mechanics: pure sticky on <main> plus two scroll-linked CSS
     vars (--lift drives the sheet's departure, --ft-travel drives the
     footer window's inner travel). Fails open to the plain in-flow
     footer without JS, under reduced motion, in embed mode, or on pages
     shorter than the viewport.
     ------------------------------------------------------------------ */
  function initSheetReveal(): void {
    const main = mainEl;
    if (!main) return;
    const shell = main.closest<HTMLElement>('.site-shell');
    /* The travel budget is derived from the sliding content wrapper — the
       window itself is a fixed 100vh viewport, so measuring it would
       always yield a zero budget. */
    const footer = document.querySelector<HTMLElement>('.reveal-footer-content');
    /* The window's own ambient grid twin — it consumes --ft-grid-y so its
       CSS pattern stays on the document grid the lens canvas paints. */
    const footerGrid = document.querySelector<HTMLElement>('.reveal-footer .l2-page-grid');
    if (!shell || !footer) return;
    revealShell = shell;
    /* Reduced motion decides immediately: the footer stays plain in flow
       (reveal-off keeps the first-paint guard from hiding it forever). */
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      shell.classList.add('reveal-off');
      return;
    }

    const apply = (): void => {
      // While live the footer window keeps its natural height (auto), so
      // offsetHeight measures the real footer reliably — the travel budget
      // is simply (natural height − viewport). Deriving it from a clipped
      // 100vh window's scrollHeight instead made the budget drift and let
      // the window slide out of the viewport at max scroll.
      const footerH = footer.offsetHeight;
      const sheetH = main.offsetHeight;
      const pin = sheetH - window.innerHeight;
      const budget = footerH - window.innerHeight;
      if (pin <= 0 || budget <= 0) {
        shell.classList.remove('reveal-live');
        shell.classList.add('reveal-off');
        shell.style.removeProperty('--sheet-pin');
        shell.style.removeProperty('--reveal-pad');
        return;
      }
      shell.classList.add('reveal-live');
      shell.classList.remove('reveal-off');
      shell.style.setProperty('--sheet-pin', `${Math.round(pin)}px`);
      /* The sheet's departure consumes one viewport of scroll; the rest of
         the footer's height becomes the footer's own scroll. */
      shell.style.setProperty('--reveal-pad', `${Math.round(footerH)}px`);
      shell.style.setProperty('--reveal-budget', `${Math.round(budget)}px`);
    };
    apply();

    const ro = new ResizeObserver(apply);
    ro.observe(main);
    ro.observe(footer);
    window.addEventListener('resize', apply, { passive: true });

    let ticking = false;
    let revealing = false;
    let lastLift = -1;
    let lastTravel = -1;
    let lastGridY = -1;
    const writeVars = (): void => {
      ticking = false;
      if (!shell.classList.contains('reveal-live')) return;
      const budget = parseFloat(shell.style.getPropertyValue('--reveal-budget')) || 1;
      /* Live geometry, scroll-relative: the reveal progress e is the scroll
         distance past the pin. The pin is derived every frame from
         untainted quantities — document height minus the footer window's
         natural height (the runway's exact height) minus the viewport —
         because every direct measure of main goes stale or circular once
         it sticks: getBoundingClientRect freezes at the stick (the sheet
         honestly no longer moves) and offsetTop grows by the stick
         displacement, which cancels the progress term exactly. Recomputing
         per frame (instead of caching) keeps the reveal immune to async
         content growth — map components, metrics, fonts — that would
         otherwise make the pin stale and flash the footer in and out. */
      const e =
        window.scrollY -
        (document.documentElement.scrollHeight - footer.offsetHeight - window.innerHeight);
      /* Change-guards: identical setProperty calls still invalidate style,
         and this runs every scroll frame. Each var is written on its
         consumer (main / the footer content wrapper) — both are registered
         non-inheriting @property, so the write re-styles only that element
         instead of the whole shell subtree. */
      const lift = Math.round(Math.max(0, Math.min(e, window.innerHeight)));
      const travel = Math.round(Math.max(0, Math.min(e - window.innerHeight, budget)));
      if (lift !== lastLift) {
        lastLift = lift;
        main.style.setProperty('--lift', `${lift}px`);
      }
      if (travel !== lastTravel) {
        lastTravel = travel;
        footer.style.setProperty('--ft-travel', `${travel}px`);
      }
      /* Same change-guard pattern as the two vars above: the scroll offset
         behind the footer window's grid twin, keeping its CSS pattern
         phase-true with the document grid (and the lens canvas). */
      const gridY = Math.round(window.scrollY);
      if (gridY !== lastGridY) {
        lastGridY = gridY;
        footerGrid?.style.setProperty('--ft-grid-y', `${gridY}px`);
      }
      /* Arming, not revealing: the sheet surface and the footer window swap
         in ~150px ABOVE the pin, while the sheet still fully covers the
         viewport. Both surfaces are the same canvas color, so the flip is
         pixel-invisible — but it moves the window's first paint, the
         sheet's layer promotion and the surface swap OFF the reveal moment.
         Flipping (or fading) them at the reveal itself read as a flash of
         the footer as it started appearing: the window snapped in at full
         strength while the sheet's background was still fading in over it,
         so the footer bled through the page for the fade's duration.
         Disarm 50px deeper for hysteresis — every flip is seamless, so the
         gap only bounds wasted work, not visuals. */
      if (!revealing && e >= -150) revealing = true;
      else if (revealing && e < -200) revealing = false;
      shell.classList.toggle('is-revealing', revealing);
      /* Ambient gating: these only invalidate on flips (twice per reveal
         pass), never per frame. */
      if (footerRevealActive !== revealing) footerRevealActive = revealing;
      const gone = e >= window.innerHeight - 2;
      if (sheetGone !== gone) sheetGone = gone;
    };
    const onScroll = (): void => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(writeVars);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    /* bfcache restores the frozen heap with whatever geometry was live at
       hide time; a restore can land on a different scroll offset (or after
       a resize while hidden), so re-sync once the page is shown again. */
    window.addEventListener('pageshow', onScroll, { passive: true });

    sheetCleanups.push(() => {
      ro.disconnect();
      window.removeEventListener('resize', apply);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pageshow', onScroll);
    });
  }

  /* ------------------------------------------------------------------
     Auto dark/light: sample the page section sitting under the navbar
     band and flip the navbar identity (text, logo, glass surface) when
     it crosses a dark background. Recomputed only on intersection
     changes — never per scroll frame.
     ------------------------------------------------------------------ */
  let themeObserver: IntersectionObserver | null = null;
  const themeBand = new Set<Element>();
  // Height of the navbar band sampled for the auto dark/light identity.
  // Shared by the coverage check and the observer rootMargin below.
  const NAV_THEME_BAND = 72;

  function parseRgb(color: string): [number, number, number, number] | null {
    const match = color.match(/rgba?\(([^)]+)\)/);
    if (!match) return null;
    const parts = match[1].split(',').map((v) => parseFloat(v));
    if (parts.length < 3 || parts.slice(0, 3).some((v) => Number.isNaN(v))) return null;
    return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1];
  }

  function effectiveBackground(el: Element): string {
    let node: Element | null = el;
    while (node && node !== document.documentElement) {
      const parsed = parseRgb(getComputedStyle(node).backgroundColor);
      if (parsed && parsed[3] > 0.35) {
        return `rgb(${parsed[0]}, ${parsed[1]}, ${parsed[2]})`;
      }
      node = node.parentElement;
    }
    return 'rgb(250, 252, 251)';
  }

  function backgroundIsDark(el: Element): boolean {
    const [r, g, b] = parseRgb(effectiveBackground(el)) ?? [255, 255, 255];
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.42;
  }

  function computeNavTheme(): void {
    let best: Element | null = null;
    let bestCoverage = 0;
    themeBand.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const coverage = Math.min(rect.bottom, NAV_THEME_BAND) - Math.max(rect.top, 0);
      if (coverage > bestCoverage) {
        bestCoverage = coverage;
        best = el;
      }
    });
    navDark = best ? backgroundIsDark(best) : false;
  }

  function initThemeObserver(): void {
    if (!('IntersectionObserver' in window)) return;
    themeObserver?.disconnect();
    themeBand.clear();
    const rootMargin = `0px 0px -${Math.max(window.innerHeight - NAV_THEME_BAND, 0)}px 0px`;
    themeObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) themeBand.add(entry.target);
          else themeBand.delete(entry.target);
        }
        computeNavTheme();
      },
      { rootMargin }
    );
    document
      .querySelectorAll('main section, main [data-nav-surface]')
      .forEach((el) => themeObserver?.observe(el));
    computeNavTheme();
  }

  function handleWindowKeydown(event: KeyboardEvent): void {
    if (event.key !== 'Escape') return;
    closeMenus();
    if (mobileNavOpen) {
      closeMobileMenu();
    }
  }

  $: route = $page.url.pathname.replace(/\/$/, '') || '/';
  $: isOverviewStyleRoute =
    $page.status === 404 ||
    route === '/' ||
    route === '/overview' ||
    route === '/landing2' ||
    route === '/404' ||
    route === '/uninstall' ||
    route === '/privacy' ||
    route === '/faq' ||
    route === '/changelog';
  $: if (browser) syncBarMode(scrolled);
  $: if ($page.url.pathname) {
    mobileNavOpen = false;
    closeMenus();
  }
  // Re-scan the page for dark sections after the route's DOM settles.
  $: if (browser && route) {
    setTimeout(initThemeObserver, 60);
  }

  onMount(() => {
    detectedBrowser = detectBrowserFromNavigator();
    hideChrome = new URLSearchParams(window.location.search).has('embed');
    updateScrolled();
    // Core chrome listeners attach before anything that can throw — a failed
    // analytics or snapshot init must never disable the pill morph, the
    // dropdowns, or Escape handling.
    window.addEventListener('keydown', handleWindowKeydown);
    window.addEventListener('scroll', handleWindowScroll, { passive: true });
    window.addEventListener('resize', handleWindowResize);
    if (!hideChrome) initThemeObserver();
    if (!hideChrome) initSheetReveal();
    if (!hideChrome) {
      /* The pre-footer magnetic stop: catches a scroll gesture that comes
         to rest just before the sheet pins, holds it exactly at the page's
         end (nothing of the footer shows — the last section IS the end),
         and releases on deliberate extra scroll. Never engages without the
         reveal or under reduced motion; native scrolling is never fought
         (no preventDefault anywhere). */
      magnetDispose = initMagneticPin({
        isEligible: () => !!revealShell?.classList.contains('reveal-live'),
        /* The pin in scroll space, from the same untainted arithmetic
           writeVars uses (scrollHeight − footer runway − viewport);
           offsetTop goes stale the moment main sticks. */
        getPinY: () => {
          const footerContent = document.querySelector<HTMLElement>('.reveal-footer-content');
          if (!footerContent) return Number.POSITIVE_INFINITY;
          return (
            document.documentElement.scrollHeight -
            footerContent.offsetHeight -
            window.innerHeight
          );
        }
      });
    }
    let disposeWebsiteEvents: (() => void) | undefined;
    let disposeSnapshotStore: (() => void) | undefined;
    try {
      disposeWebsiteEvents = initWebsiteEventsClient();
    } catch {
      // Analytics is optional chrome; ignore init failures.
    }
    try {
      disposeSnapshotStore = initializeWebsiteSnapshotStore();
    } catch {
      // Snapshot links fall back to the static store config.
    }
    return () => {
      window.removeEventListener('keydown', handleWindowKeydown);
      window.removeEventListener('scroll', handleWindowScroll);
      window.removeEventListener('resize', handleWindowResize);
      themeObserver?.disconnect();
      for (const fn of sheetCleanups) fn();
      if (magnetDispose) magnetDispose();
      if (resizeTimer) clearTimeout(resizeTimer);
      if (menuCloseTimer) clearTimeout(menuCloseTimer);
      if (typeof disposeWebsiteEvents === 'function') disposeWebsiteEvents();
      if (typeof disposeSnapshotStore === 'function') disposeSnapshotStore();
      void flushWebsiteEvents({ beaconPreferred: true });
    };
  });
</script>

<svelte:head>
  {#if GOOGLE_SITE_VERIFICATION}
    <meta
      name="google-site-verification"
      content={GOOGLE_SITE_VERIFICATION}
    />
  {/if}
  {#if BING_SITE_VERIFICATION}
    <meta
      name="msvalidate.01"
      content={BING_SITE_VERIFICATION}
    />
  {/if}
</svelte:head>

<svelte:window on:focusin={handleDocFocusIn} on:focusout={handleDocFocusOut} />

<LoadingScreen />
<BrowserIconSprite />
<CursorLayer />

<div class="site-shell" class:o2-fullscreen={hideChrome}>
  <a class="skip-link" href="#main-content">Skip to content</a>
  {#if !hideChrome}
  <header class="l2-nav-shell" class:is-scrolled={scrolled} class:menu-open={openMenu !== null} class:nav-dark={navDark}>
    <div class="l2-nav-float">
      <div
        class="l2-nav-bar"
        role="presentation"
        bind:this={navBarEl}
        on:pointerenter={handleBarPointerEnter}
        on:pointerleave={handleBarPointerLeave}
        on:pointermove={handleBarPointerMove}
      >
        <div class="l2-nav-inner">
          <a href="{base}/" class="l2-nav-brand">
            <img src={logo} alt="Classroom Quick Downloader" class="l2-nav-logo" width="42" height="36" loading="eager" decoding="async" />
            <span class="l2-nav-brand-text">Classroom Quick Downloader</span>
          </a>

          <nav class="l2-nav-links l2-nav-links-desktop" aria-label="Primary">
            {#each navMenus as menu (menu.key)}
              <a
                class="l2-nav-link"
                data-menu-key={menu.key}
                href="{base}{menu.href}"
                class:active={isActive(menu.href, $page.url.pathname)}
                class:open={openMenu === menu.key}
                aria-current={isActive(menu.href, $page.url.pathname) ? 'page' : undefined}
                aria-haspopup="true"
                aria-expanded={openMenu === menu.key ? 'true' : 'false'}
                aria-controls={`nav-menu-${menu.key}`}
                on:mouseenter={() => openMenuFor(menu.key)}
                on:mouseleave={scheduleMenuClose}
                on:click={(event) => handleSiteLinkClick(event, menu.href)}
              >
                {menu.label}
                <svg class="l2-nav-caret" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="m6.5 9.5 5.5 5 5.5-5" />
                </svg>
              </a>
            {/each}
            <a
              class="l2-nav-link l2-nav-github"
              data-menu-key="github"
              href={githubHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-haspopup="true"
              aria-expanded={openMenu === 'github' ? 'true' : 'false'}
              aria-controls="nav-menu-github"
              on:mouseenter={() => openMenuFor('github')}
              on:mouseleave={scheduleMenuClose}
              on:click={closeMenus}
            >
              GitHub
              <svg class="l2-nav-caret" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m6.5 9.5 5.5 5 5.5-5" />
              </svg>
            </a>
          </nav>

          <div class="l2-nav-actions">
            <div class="l2-nav-cta-wrap">
              <a
                class="l2-nav-cta l2-nav-cta-desktop"
                data-menu-key="install"
                href={browserLink(detectedBrowser)}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Install for ${browserDisplayName(detectedBrowser)}`}
                aria-haspopup="true"
                aria-expanded={openMenu === 'install' ? 'true' : 'false'}
                aria-controls="nav-menu-install"
                on:mouseenter={() => openMenuFor('install')}
                on:mouseleave={scheduleMenuClose}
                on:click={() => {
                  closeMenus();
                  trackInstallClick('nav_install');
                }}
              >
                <span class="l2-nav-cta-label">Install for {browserDisplayName(detectedBrowser)}</span>
                <!-- Pill mode swaps the long label for this compact one and
                     rides the three store marks inside the button as a
                     decorative avatar stack; per-store links live in the
                     hover dropdown. -->
                <span class="l2-nav-cta-label-short" aria-hidden="true">Install</span>
                <span class="l2-nav-store-stack" aria-hidden="true">
                  <span class="l2-nav-store-bubble"><BrowserIcon browser="chrome" /></span>
                  <span class="l2-nav-store-bubble"><BrowserIcon browser="firefox" /></span>
                  <span class="l2-nav-store-bubble"><BrowserIcon browser="edge" /></span>
                </span>
              </a>
              <div
                class="l2-nav-alt-browsers"
                id="nav-menu-install"
                role="presentation"
                class:open={openMenu === 'install'}
                on:mouseenter={cancelMenuClose}
                on:mouseleave={scheduleMenuClose}
                aria-label="Install for another browser"
              >
                <p class="l2-nav-menu-title">
                  <span class="l2-nav-menu-title-rest">Other browsers</span>
                  <span class="l2-nav-menu-title-pill">Install options</span>
                </p>
                <!-- The Chrome Web Store row is the pill mode's extra hover
                     option: the compact button no longer names a browser, so
                     the store for Chrome & all Chromium browsers gets a row. -->
                <a
                  class="l2-nav-alt l2-nav-alt-chrome"
                  href={browserLink('chrome')}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Chrome Web Store"
                  style="--alt-i: 0"
                  on:click={() => {
                    closeMenus();
                    trackInstallClick('nav_menu_install');
                  }}
                >
                  <span class="l2-nav-menu-glyph l2-nav-menu-glyph-brand" aria-hidden="true">
                    <BrowserIcon browser="chrome" />
                  </span>
                  <span class="l2-nav-menu-copy">
                    <span class="l2-nav-menu-label">Chrome Web Store</span>
                    <span class="l2-nav-menu-desc">For Chrome, Brave, Arc & all Chromium browsers.</span>
                  </span>
                </a>
                <a
                  class="l2-nav-alt"
                  href={browserLink('firefox')}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Install for Firefox"
                  style="--alt-i: 1"
                  on:click={() => {
                    closeMenus();
                    trackInstallClick('nav_install_firefox');
                  }}
                >
                  <span class="l2-nav-menu-glyph l2-nav-menu-glyph-brand" aria-hidden="true">
                    <BrowserIcon browser="firefox" />
                  </span>
                  <span class="l2-nav-menu-copy">
                    <span class="l2-nav-menu-label">Install for Firefox</span>
                    <span class="l2-nav-menu-desc">From the Mozilla Add-ons store.</span>
                  </span>
                </a>
                <a
                  class="l2-nav-alt"
                  href={browserLink('edge')}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Install for Microsoft Edge"
                  style="--alt-i: 2"
                  on:click={() => {
                    closeMenus();
                    trackInstallClick('nav_install_edge');
                  }}
                >
                  <span class="l2-nav-menu-glyph l2-nav-menu-glyph-brand" aria-hidden="true">
                    <BrowserIcon browser="edge" />
                  </span>
                  <span class="l2-nav-menu-copy">
                    <span class="l2-nav-menu-label">Install for Edge</span>
                    <span class="l2-nav-menu-desc">From the Edge Add-ons store.</span>
                  </span>
                </a>
              </div>
            </div>
            <button
              type="button"
              class="l2-nav-menu-btn"
              on:click={toggleMobileMenu}
              aria-expanded={mobileNavOpen}
              aria-controls="site-mobile-nav"
              aria-label={mobileNavOpen ? 'Close site navigation' : 'Open site navigation'}
            >
              {#if mobileNavOpen}
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M6 6l12 12M18 6 6 18" />
                </svg>
              {:else}
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              {/if}
            </button>
          </div>
        </div>
      </div>

      <!-- Shared hover module: centered under the navbar, morphs between
           menus. All four content blocks ship in SSR for crawlers. -->
      <div
        class="l2-nav-dropdown"
        role="presentation"
        class:open={openMenu !== null && openMenu !== 'install'}
        bind:this={panelEl}
        on:mouseenter={cancelMenuClose}
        on:mouseleave={scheduleMenuClose}
      >
        {#each navMenus as menu (menu.key)}
          <div
            class="l2-nav-menu-block"
            id={`nav-menu-${menu.key}`}
            class:active={openMenu === menu.key}
            inert={openMenu === null || openMenu !== menu.key}
          >
            <div class="l2-nav-menu-row">
              {#each menu.columns as column}
                <div class="l2-nav-menu-col">
                  <p class="l2-nav-menu-title">{column.title}</p>
                  <ul class="l2-nav-menu-list">
                    {#each column.links as link, linkIndex}
                      <li style={`--menu-i: ${linkIndex}`}>
                        <a
                          class="l2-nav-menu-link"
                          href={resolveMenuHref(link.href)}
                          target={link.external ? '_blank' : undefined}
                          rel={link.external ? 'noopener noreferrer' : undefined}
                          tabindex={openMenu === menu.key ? undefined : -1}
                        >
                          <span class="l2-nav-menu-glyph" aria-hidden="true">
                            <svg viewBox="0 0 24 24" fill="none">
                              {#each MENU_ICONS[link.icon] as glyphPath}
                                <path d={glyphPath} />
                              {/each}
                            </svg>
                          </span>
                          <span class="l2-nav-menu-copy">
                            <span class="l2-nav-menu-label">{link.label}</span>
                            <span class="l2-nav-menu-desc">{link.desc}</span>
                          </span>
                        </a>
                      </li>
                    {/each}
                  </ul>
                </div>
              {/each}

              <div class="l2-nav-menu-featured-col">
                {#if menu.featured.kind === 'install'}
                  <a
                    class="l2-nav-menu-featured"
                    href={browserLink(detectedBrowser)}
                    target="_blank"
                    rel="noopener noreferrer"
                    tabindex={openMenu === menu.key ? undefined : -1}
                    on:click={handleFeaturedInstallClick}
                  >
                    <span class="l2-nav-menu-featured-title">{menu.featured.title}</span>
                    <span class="l2-nav-menu-featured-desc">{menu.featured.desc}</span>
                    <span class="l2-nav-menu-featured-cta">
                      Install for {browserDisplayName(detectedBrowser)}
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17 17 7" /><path d="M9 7h8v8" /></svg>
                    </span>
                  </a>
                {:else}
                  <a
                    class="l2-nav-menu-featured"
                    href={resolveMenuHref(menu.featured.href)}
                    target={menu.featured.external ? '_blank' : undefined}
                    rel={menu.featured.external ? 'noopener noreferrer' : undefined}
                    tabindex={openMenu === menu.key ? undefined : -1}
                    on:click={closeMenus}
                  >
                    <span class="l2-nav-menu-featured-title">{menu.featured.title}</span>
                    <span class="l2-nav-menu-featured-desc">{menu.featured.desc}</span>
                    <span class="l2-nav-menu-featured-cta">
                      {menu.featured.cta}
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M7 17 17 7" /><path d="M9 7h8v8" /></svg>
                    </span>
                  </a>
                {/if}
                <span class="l2-nav-bmc-label">Support Me</span>
                <a
                  class="l2-nav-bmc"
                  href={BUY_COFFEE_URL}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  tabindex={openMenu === menu.key ? undefined : -1}
                >
                  <img src="/bmc-button.svg" alt="Buy Me a Coffee" width="545" height="153" loading="lazy" />
                </a>
              </div>
            </div>
          </div>
        {/each}

        <!-- GitHub hover preview: live stats once fetched, static fallback
             otherwise. Ships in SSR so the repo link is crawlable. -->
        <div
          class="l2-nav-menu-block l2-nav-menu-block-github"
          id="nav-menu-github"
          class:active={openMenu === 'github'}
          inert={openMenu === null || openMenu !== 'github'}
        >
          <div class="l2-gh-wrap">
          <div class="l2-gh-card">
            <div class="l2-gh-chrome" aria-hidden="true">
              <span></span><span></span><span></span>
            </div>
            <div class="l2-gh-body">
              <a class="l2-gh-repo" href={githubHref} target="_blank" rel="noopener noreferrer" tabindex={openMenu === 'github' ? undefined : -1}>
                <svg class="l2-gh-mark" viewBox="0 0 16 16" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
                </svg>
                <span class="l2-gh-name">adhamhaithameid/Classroom-Quick-Downloader</span>
                <svg class="l2-gh-arrow" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M7 17 17 7" /><path d="M9 7h8v8" />
                </svg>
              </a>
              <p class="l2-gh-desc">
                Free, source-available browser extension that batch-downloads every Google Classroom attachment in one click. The full code is public on GitHub and auditable by anyone.
              </p>
              <div class="l2-gh-stats">
                <span class="l2-gh-stat" title="Stars">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/></svg>
                  {formatCount(githubStats?.stars ?? 24)}
                </span>
                <span class="l2-gh-stat" title="Forks">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="6" cy="5" r="2.2"/><circle cx="18" cy="5" r="2.2"/><circle cx="12" cy="19" r="2.2"/><path d="M6 7.2v2a3 3 0 0 0 3 3h6a3 3 0 0 0 3-3v-2"/><path d="M12 12.2v4.6"/></svg>
                  {formatCount(githubStats?.forks ?? 4)}
                </span>
                <span class="l2-gh-stat" title="Open issues">
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="8.6"/><path d="M12 7.6v5.2"/><path d="M12 16.4h.01"/></svg>
                  {formatCount(githubStats?.issues ?? 2)}
                </span>
                <span class="l2-gh-stat l2-gh-version" title="Latest release">{APP_VERSION}</span>
              </div>
              <a
                class="l2-gh-cta"
                href={githubHref}
                target="_blank"
                rel="noopener noreferrer"
                tabindex={openMenu === 'github' ? undefined : -1}
              >
                Star on GitHub
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m12 3.6 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9Z"/></svg>
              </a>
            </div>
          </div>
          <span class="l2-nav-bmc-label l2-nav-bmc-label-center">Support Me</span>
          <a
            class="l2-nav-bmc"
            href={BUY_COFFEE_URL}
            target="_blank"
            rel="noopener noreferrer nofollow"
            tabindex={openMenu === 'github' ? undefined : -1}
          >
            <img src="/bmc-button.svg" alt="Buy Me a Coffee" width="545" height="153" loading="lazy" />
          </a>
          </div>
        </div>
      </div>

      {#if mobileNavOpen}
        <div class="l2-nav-mobile-panel" id="site-mobile-nav">
          <nav class="l2-nav-mobile-links" aria-label="Mobile Primary">
            {#each navMenus as menu (menu.key)}
              <a
                href="{base}{menu.href}"
                class:active={isActive(menu.href, $page.url.pathname)}
                aria-current={isActive(menu.href, $page.url.pathname) ? 'page' : undefined}
                on:click={(event) => handleSiteLinkClick(event, menu.href)}
              >
                {menu.label}
              </a>
            {/each}
            <a href={githubHref} target="_blank" rel="noopener noreferrer" on:click={closeMobileMenu}>
              GitHub
            </a>
          </nav>
          <a
            class="l2-nav-cta l2-nav-cta-mobile"
            href={browserLink(detectedBrowser)}
            target="_blank"
            rel="noopener noreferrer"
            on:click={() => {
              closeMobileMenu();
              trackInstallClick('nav_mobile_install');
            }}
          >
            Install for {browserDisplayName(detectedBrowser)}
          </a>
          <!-- Touch has no hover: the desktop submenu's Firefox/Edge links
               need a reachable home in the mobile panel. -->
          <div class="l2-nav-mobile-alt">
            <a
              class="l2-nav-mobile-alt-link"
              href={browserLink('firefox')}
              target="_blank"
              rel="noopener noreferrer"
              on:click={() => {
                closeMobileMenu();
                trackInstallClick('nav_install_firefox');
              }}
            >
              <BrowserIcon browser="firefox" />
              Firefox
            </a>
            <a
              class="l2-nav-mobile-alt-link"
              href={browserLink('edge')}
              target="_blank"
              rel="noopener noreferrer"
              on:click={() => {
                closeMobileMenu();
                trackInstallClick('nav_install_edge');
              }}
            >
              <BrowserIcon browser="edge" />
              Edge
            </a>
          </div>
        </div>
      {/if}
    </div>
    <button
      type="button"
      class="l2-nav-backdrop"
      tabindex="-1"
      aria-label="Close navigation menu"
      on:click={closeMenus}
    ></button>
  </header>
  {/if}

  <main
    id="main-content"
    bind:this={mainEl}
    class:site-main={!isOverviewStyleRoute && !hideChrome}
    class:site-main-overview-style={isOverviewStyleRoute && !hideChrome}
    class:l2-wrap={!isOverviewStyleRoute && !hideChrome}
  >
    <!-- The page's ambient world lives inside the sheet: it paints above the
         sheet's opaque reveal surface and travels with it when the sheet
         lifts away, so the grid and orbs never flatten out of view. It
         sleeps once the sheet has fully left the viewport. -->
    <AmbientBackground paused={sheetGone} />
    <div class="site-route-shell" class:route-dim={$navigating}>
      <slot />
    </div>
  </main>

  <!-- Sticky-sheet runway: the scroll distance past the pin (the reveal).
       Empty on purpose — see the reveal CSS for why it cannot be main's
       margin. Height arrives only under .reveal-live. -->
  <div class="reveal-runway" aria-hidden="true"></div>

  {#if !hideChrome}
  <div class="reveal-footer">
    <!-- The footer window's own copy of the page's ambient — same orbs and
         the same interactive cursor-lens grid. The window itself never
         transforms: only the content wrapper inside it travels, so the
         lens canvas stays viewport-anchored and bends exactly under the
         cursor, just like the page. It sleeps whenever the window is
         hidden (pre-reveal), so nothing paints behind the sheet. -->
    <AmbientBackground paused={!footerRevealActive} />
    <div class="reveal-footer-content">
      <SiteFooter />
    </div>
  </div>
  {/if}
</div>

<style>
  main {
    flex: 1;
    min-height: 0;
  }

  .site-shell {
    position: relative;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    /* body carries the opaque --bg canvas; this shell must stay transparent
       or it would cover the fixed ambient layer painted behind it. */
    background: transparent;
    color: var(--text);
    /* Decorative layers (ambient orbs, marquee track) bleed past the edges
       by design; clip the axis so they never create a horizontal scrollbar.
       `clip` — not `hidden` — because hidden would create a scroll container
       and break the sticky navbar. */
    overflow-x: clip;
  }
  .site-shell.o2-fullscreen {
    overflow: hidden;
    height: 100vh;
  }

  .site-main {
    padding-top: 32px;
    padding-bottom: 56px;
  }

  .site-main-overview-style {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
    padding-top: 0;
    padding-bottom: 0;
  }

  .site-route-shell {
    min-height: 0;
    /* K2: while a route loads, the current content softens and the loading
       screen's icon carries the motion — no new loader, no content slide. */
    transition: opacity 0.25s ease;
  }

  .site-route-shell.route-dim {
    opacity: 0.35;
  }

  .site-main-overview-style .site-route-shell {
    flex: 1;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  :global(.site-main-overview-style .site-route-shell > *) {
    flex: 1 0 auto;
    min-height: 0;
  }

  .l2-wrap {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* ── Sticky sheet reveal (driven by initSheetReveal) ────────
     main becomes the sheet: it scrolls normally, pins at
     top: -(mainH - 100vh) once its end reaches the viewport bottom, and
     at that stick point gains its sheet surface — opaque background,
     rounded bottom, shadow cast onto the footer window — then departs
     via --lift. The footer is a fixed window beneath the sheet (z 0),
     hidden until the stick, its inner content travelling through the
     reveal via --ft-travel so the footer scrolls on after the sheet has
     gone. Ambient background stays a shell sibling: the sheet only
     turns opaque at the stick, so the orbs/grid show through the page
     for its whole length.

     The scroll runway past the pin is a spacer sibling after main, not
     main's margin-bottom: a sticky element constrained by its own margin
     box can never travel past the pin — main un-stuck there and the
     --lift feedback loop ran the sheet away at double speed (measured:
     lift 150px at pin+120). Shell padding doesn't work either — the
     sticky constraint rectangle is the shell's CONTENT box, which ends
     before any padding. The spacer lives inside the content box, so main
     can stick through the whole reveal while the document height stays
     identical. */
  :global(.site-shell.reveal-live) .reveal-runway {
    height: var(--reveal-pad, 0px);
  }

  :global(.site-shell.reveal-live) main {
    position: sticky;
    top: calc(-1 * var(--sheet-pin, 0px));
    z-index: 1;
    /* No transition on the surface — ever. The sheet's background is the
       same color as the footer window behind it, so an instant swap is
       pixel-seamless; a fade instead showed the footer through the
       semi-transparent sheet (the entry flash). The class flip also happens
       ~150px above the pin, behind full viewport coverage, where even the
       instant swap is invisible. */
  }

  :global(.site-shell.reveal-live.is-revealing) main {
    /* Flat occluding base — the ambient child paints the world texture
       (orbs + grid + lens) above it, so the sheet never flattens. Applies
       from arming (band entry), entirely behind full viewport coverage. */
    background: var(--bg);
    border-radius: 0 0 28px 28px;
    box-shadow: 0 26px 60px rgba(15, 20, 25, 0.16);
    translate: 0 calc(-1 * var(--lift, 0px));
    /* Layer promotion also lands at arming, off the reveal moment: the
       sheet re-composites every scroll frame of the reveal — keep that on
       the compositor instead of repainting the shadowed surface. */
    will-change: translate;
  }

  :global(.site-shell.reveal-live) :global(.reveal-footer) {
    position: fixed;
    left: 0;
    right: 0;
    top: 0;
    height: 100vh;
    z-index: 0;
    overflow: hidden;
    background: var(--bg);
    /* The window is a fixed-size 100vh box whose subtree never paints
       outside it — scope layout/paint to the box so hidden-phase style
       work stays local (its absolutes are already window-relative; the
       sticky lens canvas does not need a scroll container). */
    contain: layout paint;
    visibility: hidden;
    /* No opacity and no transition here on purpose. The reveal is pure
       occlusion: the window is simply behind the sheet, and the sheet
       physically slides off it. (1) A fade on the way in exposed the CTA
       block at partial opacity while the sheet lifted — read as a flash.
       (2) This state is also the EXIT state; fading here ghosted the
       footer through the page, because dropping .is-revealing fades the
       sheet's own opaque background back to transparent at the same time.
       Instant hide is invisible in both directions: hidden-phase pixels
       equal the html canvas while the sheet covers the viewport. */
    transition: none;
  }

  /* The footer content slides within the static window — the window and
     its ambient never transform, so the lens grid stays cursor-true. */
  :global(.site-shell.reveal-live) :global(.reveal-footer-content) {
    translate: 0 calc(-1 * var(--ft-travel, 0px));
  }

  /* Doc-align the footer window's CSS grid twin with the lens canvas's
     document-anchored lines (see --ft-grid-y in app.css), so the canvas
     standing up or sleeping can never shift the grid phase mid-reveal. */
  :global(.site-shell.reveal-live) :global(.reveal-footer .l2-page-grid) {
    background-position: 0 calc(-1 * var(--ft-grid-y, 0px));
  }

  :global(.site-shell.reveal-live.is-revealing) :global(.reveal-footer) {
    /* Visibility flip only — no fade. The footer is occluded content, not
       an overlay: it appears exactly as fast as the sheet uncovers it. */
    visibility: visible;
  }

  /* First-paint guard (html.js is set inline in app.html): the footer window
     stays hidden until initSheetReveal decides the mode, killing the load
     flash where the in-flow SSR footer appeared for a beat and vanished.
     Plain modes surface it via .reveal-off; no-JS visitors never get html.js. */
  :global(html.js) :global(.reveal-footer) {
    visibility: hidden;
  }

  :global(html.js) :global(.site-shell.reveal-off) :global(.reveal-footer),
  :global(html.js) :global(.site-shell.reveal-live.is-revealing) :global(.reveal-footer) {
    visibility: visible;
  }

  @media (prefers-reduced-motion: reduce) {
    :global(.site-shell.reveal-live) .reveal-runway {
      height: 0;
    }

    :global(.site-shell.reveal-live) main {
      position: static;
    }

    :global(.site-shell.reveal-live.is-revealing) main {
      background: transparent;
      border-radius: 0;
      box-shadow: none;
      translate: none;
    }

    :global(.site-shell.reveal-live) :global(.reveal-footer),
    :global(html.js) :global(.reveal-footer) {
      position: static;
      height: auto;
      overflow: visible;
      visibility: visible;
    }

    :global(.site-shell.reveal-live) :global(.reveal-footer-content) {
      translate: none;
    }
  }

  /* ============================================================
     Navbar shell — positioning only; the glass surface lives on
     .l2-nav-bar so it can morph cleanly into the compact pill.
     ============================================================ */
  .l2-nav-shell {
    --nav-ease: cubic-bezier(0.32, 1.35, 0.42, 1);
    position: sticky;
    top: 0;
    z-index: 100;
    transition: top 0.5s var(--nav-ease);
  }

  .l2-nav-shell.is-scrolled {
    top: 10px;
  }

  :global(body.l2-media-modal-open) .l2-nav-shell,
  :global(body.l2-map-modal-open) .l2-nav-shell {
    opacity: 0;
    transform: translateY(-100%);
    pointer-events: none;
  }

  .l2-nav-float {
    position: relative;
    margin: 0;
  }

  /* Glossy glass surface — full-width bar at rest, compact centered pill
     on scroll. Width is transitioned explicitly via JS measurement. */
  .l2-nav-bar {
    position: relative;
    contain: layout style;
    width: 100%;
    margin-inline: 0;
    padding: 12px 24px;
    border: 1px solid rgba(255, 255, 255, 0);
    border-bottom-color: rgba(255, 255, 255, 0.82);
    border-radius: 0;
    background: linear-gradient(135deg, rgba(255, 255, 255, 0.66), rgba(239, 247, 250, 0.52));
    -webkit-backdrop-filter: blur(20px) saturate(180%);
    backdrop-filter: blur(20px) saturate(180%);
    box-shadow:
      0 1px 2px rgba(15, 20, 25, 0),
      0 12px 30px rgba(15, 20, 25, 0.12),
      0 8px 24px rgba(26, 139, 85, 0),
      inset 0 1px 0 rgba(255, 255, 255, 0.6);
    transition:
      width 0.55s var(--nav-ease),
      padding 0.55s var(--nav-ease),
      margin 0.55s var(--nav-ease),
      border-radius 0.55s var(--nav-ease),
      border-color 0.4s ease,
      background 0.5s ease,
      box-shadow 0.5s ease,
      -webkit-backdrop-filter 0.5s ease,
      backdrop-filter 0.5s ease;
  }

  /* Gloss sheen + top specular highlight, crossfaded in on scroll. */
  .l2-nav-bar::before {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: inherit;
    pointer-events: none;
    opacity: 0;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.85), rgba(255, 255, 255, 0) 36%),
      linear-gradient(120deg, rgba(255, 255, 255, 0.3), rgba(239, 247, 250, 0.16) 48%, rgba(255, 255, 255, 0.28));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.9),
      inset 0 -1px 0 rgba(255, 255, 255, 0.35);
    transition: opacity 0.5s ease;
  }

  /* Pointer-tracked specular sweep — the glass reacts to the cursor. */
  .l2-nav-bar::after {
    content: '';
    position: absolute;
    inset: -1px;
    border-radius: inherit;
    pointer-events: none;
    opacity: 0;
    background: radial-gradient(
      190px 64px at var(--nav-pointer-x, 50%) 0%,
      rgba(255, 255, 255, 0.5),
      rgba(255, 255, 255, 0) 72%
    );
    transition: opacity 0.35s ease;
  }

  .l2-nav-bar:hover::after {
    opacity: 1;
  }

  .l2-nav-shell.is-scrolled .l2-nav-bar {
    padding: 12px;
    border-color: rgba(255, 255, 255, 0.72);
    border-radius: 999px;
    background: linear-gradient(120deg, rgba(255, 255, 255, 0.6), rgba(248, 252, 249, 0.42));
    -webkit-backdrop-filter: blur(28px) saturate(210%);
    backdrop-filter: blur(28px) saturate(210%);
    box-shadow:
      0 1px 2px rgba(15, 20, 25, 0.05),
      0 20px 48px rgba(15, 20, 25, 0.14),
      0 8px 24px rgba(26, 139, 85, 0.1),
      inset 0 1px 0 rgba(255, 255, 255, 0.85);
    animation: pillSettle 0.6s var(--nav-ease);
  }

  /* Measurement mode: the centered links row re-enters the flow and the
     brand text is collapsed, so the pill's natural content width matches
     its real pill-mode layout. The class is applied at runtime via
     classList, hence :global(). */
  .l2-nav-bar:global(.l2-measure) {
    transition: none !important;
  }

  .l2-nav-bar:global(.l2-measure) .l2-nav-links {
    position: static !important;
    transform: none !important;
  }

  .l2-nav-bar:global(.l2-measure) .l2-nav-brand-text {
    display: none !important;
  }

  .l2-nav-shell.is-scrolled .l2-nav-bar::before {
    opacity: 1;
  }

  /* Squash-and-stretch flourish while the pill settles in. */
  @keyframes pillSettle {
    0% {
      transform: scale(1, 1);
    }
    45% {
      transform: scale(1.015, 0.94);
    }
    100% {
      transform: scale(1, 1);
    }
  }

  .l2-nav-inner {
    position: relative;
    display: flex;
    align-items: center;
    gap: 24px;
  }

  /* Cloudflare-style center cluster: the links sit in the exact middle of
     the bar regardless of brand/CTA widths, at every desktop width. In
     pill mode syncBarMode shifts the cluster by --nav-links-shift so it
     stays centered inside the pill with equal 24px gaps while the pill
     itself centers on the page. */
  .l2-nav-links {
    position: absolute;
    left: 50%;
    top: 50%;
    transform: translate(calc(-50% + var(--nav-links-shift, 0px)), -50%);
    display: flex;
    align-items: center;
    gap: 2px;
    transition: transform 0.55s var(--nav-ease);
  }

  .l2-nav-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-left: auto;
  }

  .l2-nav-brand {
    display: flex;
    flex: none;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: var(--text);
    font-weight: 800;
    font-size: 14px;
    white-space: nowrap;
    transition: color 0.3s ease;
  }

  .l2-nav-brand-text {
    white-space: nowrap;
  }

  /* Pill mode absorbs the name into the logo — logo only when scrolled. */
  .l2-nav-shell.is-scrolled .l2-nav-brand-text {
    display: none;
  }

  /* Hide the name below the comfortable width as well. */
  @media (max-width: 1180px) {
    .l2-nav-brand-text {
      display: none;
    }
  }

  .l2-nav-logo {
    /* Explicit box: the SVG's intrinsic size (398×341) must never leak
       through `width: auto` while the pill measures or morphs. */
    width: 42px;
    height: 36px;
    border-radius: 8px;
    object-fit: contain;
    transition: filter 0.3s ease;
  }

  .l2-nav-link {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    color: var(--text-secondary);
    text-decoration: none;
    font-size: 13px;
    font-weight: 500;
    padding: 6px 10px;
    border-radius: 8px;
    border: 1px solid transparent;
    transition:
      color 0.22s ease,
      opacity 0.22s ease;
  }

  /* Hover is a quiet color shift only — no box, no underline, no lift.
     The dropdown module carries the spectacle; the link stays calm. */
  .l2-nav-link:hover,
  .l2-nav-link.open,
  .l2-nav-github:hover {
    color: var(--gc-green);
  }

  .l2-nav-link:hover .l2-nav-caret,
  .l2-nav-link.open .l2-nav-caret {
    opacity: 1;
  }

  .l2-nav-link.active {
    color: var(--gc-green);
    font-weight: 700;
  }

  .l2-nav-caret {
    width: 12px;
    height: 12px;
    stroke: currentColor;
    stroke-width: 2.4;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    opacity: 0.7;
    transition: transform 0.3s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.2s ease;
  }

  .l2-nav-link.open .l2-nav-caret {
    transform: rotate(180deg);
    opacity: 1;
  }

  /* ============================================================
     Shared dropdown module — one centered glass panel that morphs
     its width/height between menus; content re-staggers on switch.
     ============================================================ */
  /* Shared glass surface for both dropdown panels — keep panel styling in
     this one rule so the install submenu always matches the megamenus. */
  .l2-nav-dropdown,
  .l2-nav-alt-browsers {
    border-radius: 20px;
    border: 1px solid rgba(255, 255, 255, 0.8);
    background: linear-gradient(160deg, rgba(255, 255, 255, 0.92), rgba(248, 252, 249, 0.84));
    -webkit-backdrop-filter: blur(26px) saturate(190%);
    backdrop-filter: blur(26px) saturate(190%);
    box-shadow:
      0 24px 60px rgba(15, 20, 25, 0.16),
      0 4px 14px rgba(15, 20, 25, 0.08),
      0 12px 40px rgba(26, 139, 85, 0.08),
      inset 0 1px 0 rgba(255, 255, 255, 0.9);
  }

  .l2-nav-dropdown {
    position: absolute;
    top: calc(100% + 16px);
    left: 50%;
    z-index: 20;
    display: block;
    /* The panel is centered under the navbar (translateX(-50%)), so its
       center never moves horizontally. Menu blocks are absolutely centered
       on that point and top-anchored, so menu content stays exactly in
       place while only the outline morphs between menus; the card reveals
       the pinned content as it grows or shrinks. */
    overflow: hidden;
    width: max-content;
    max-width: calc(100vw - 32px);
    padding: 14px;
    opacity: 0;
    visibility: hidden;
    transform: translateX(-50%) translateY(12px) scale(0.97);
    pointer-events: none;
    transition:
      width 0.34s var(--nav-ease),
      height 0.34s var(--nav-ease),
      transform 0.3s var(--nav-ease),
      opacity 0.24s ease,
      visibility 0s linear 0.24s;
  }

  .l2-nav-dropdown.open {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0) scale(1);
    pointer-events: auto;
    transition-delay: 0s;
  }

  .l2-nav-menu-block {
    position: absolute;
    top: 14px;
    left: 50%;
    transform: translateX(-50%);
    width: max-content;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.18s ease, visibility 0s linear 0.18s;
  }

  .l2-nav-menu-block.active {
    opacity: 1;
    visibility: visible;
    transition-delay: 0s;
  }

  .l2-nav-menu-row {
    display: flex;
    gap: 10px;
    align-items: stretch;
  }

  .l2-nav-menu-col {
    flex: 1 1 0;
    min-width: 190px;
  }

  .l2-nav-menu-title {
    margin: 2px 4px 8px;
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.09em;
    text-transform: uppercase;
    color: var(--muted);
  }

  .l2-nav-menu-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 2px;
  }

  /* Items re-stagger in every time a menu becomes active — the
     "retyped" feel when moving between nav links. */
  .l2-nav-menu-list li {
    opacity: 0;
    transform: translateY(6px);
    transition:
      opacity 0.26s ease,
      transform 0.26s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .l2-nav-menu-block.active .l2-nav-menu-list li {
    opacity: 1;
    transform: translateY(0);
    transition-delay: calc(55ms + var(--menu-i, 0) * 38ms);
  }

  .l2-nav-menu-link {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 10px;
    border-radius: 14px;
    border: 1px solid transparent;
    text-decoration: none;
    transition:
      background-color 0.3s ease,
      border-color 0.3s ease,
      box-shadow 0.3s ease,
      transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .l2-nav-menu-link:hover,
  .l2-nav-menu-link:focus-visible {
    background: rgba(255, 255, 255, 0.75);
    border-color: rgba(26, 139, 85, 0.22);
    transform: translateY(-2px);
    box-shadow:
      0 8px 20px rgba(26, 139, 85, 0.12),
      0 0 0 1px rgba(26, 139, 85, 0.06);
  }

  .l2-nav-menu-glyph {
    flex: none;
    width: 32px;
    height: 32px;
    display: grid;
    place-items: center;
    border-radius: 10px;
    color: var(--gc-green);
    background: var(--gc-green-bg);
    border: 1px solid rgba(26, 139, 85, 0.12);
    transition:
      background-color 0.3s ease,
      box-shadow 0.3s ease,
      transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  .l2-nav-menu-glyph svg {
    width: 16px;
    height: 16px;
    stroke: currentColor;
    stroke-width: 1.9;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
  }

  .l2-nav-menu-link:hover .l2-nav-menu-glyph {
    background: rgba(26, 139, 85, 0.14);
    transform: scale(1.06) rotate(-3deg);
    box-shadow: 0 4px 10px rgba(26, 139, 85, 0.18);
  }

  .l2-nav-menu-copy {
    display: grid;
    gap: 1px;
    min-width: 0;
  }

  .l2-nav-menu-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
    line-height: 1.35;
  }

  .l2-nav-menu-desc {
    font-size: 11.5px;
    color: var(--text-secondary);
    line-height: 1.45;
  }

  /* Featured column: the green tile plus the Buy Me a Coffee support
     button underneath. Same width as the tile so nothing shifts. */
  .l2-nav-menu-featured-col {
    flex: none;
    width: 216px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .l2-nav-menu-featured {
    flex: none;
    align-self: flex-start;
    width: 216px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 14px;
    border-radius: 16px;
    border: 1px solid rgba(18, 105, 63, 0.6);
    /* Solid brand-green tile — the one filled surface inside the glass
       panel, so it reads as the primary action and never shows the page
       bleeding through. */
    background: linear-gradient(165deg, #1f9a5e, #137a47);
    box-shadow:
      0 10px 26px rgba(19, 122, 71, 0.3),
      inset 0 1px 0 rgba(255, 255, 255, 0.18);
    text-decoration: none;
    position: relative;
    overflow: hidden;
    transition:
      border-color 0.3s ease,
      background-color 0.3s ease,
      box-shadow 0.3s ease,
      transform 0.3s cubic-bezier(0.22, 1, 0.36, 1);
  }

  /* Reflective sweep across the featured glass card on hover. */
  .l2-nav-menu-featured::before {
    content: '';
    position: absolute;
    top: -60%;
    left: -70%;
    width: 45%;
    height: 220%;
    background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.45), transparent);
    transform: skewX(-20deg);
    transition: left 0.55s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  }

  .l2-nav-menu-featured:hover::before {
    left: 130%;
  }

  .l2-nav-menu-featured:hover,
  .l2-nav-menu-featured:focus-visible {
    border-color: rgba(140, 224, 178, 0.75);
    box-shadow:
      0 0 0 1px rgba(255, 255, 255, 0.16),
      0 16px 34px rgba(19, 122, 71, 0.4),
      inset 0 1px 0 rgba(255, 255, 255, 0.22);
    transform: translateY(-3px);
  }

  .l2-nav-menu-featured-title {
    font-size: 13px;
    font-weight: 700;
    color: #fff;
  }

  .l2-nav-menu-featured-desc {
    font-size: 11.5px;
    color: rgba(255, 255, 255, 0.88);
    line-height: 1.5;
  }

  .l2-nav-menu-featured-cta {
    margin-top: auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    color: #fff;
    transition: gap 0.25s ease;
  }

  .l2-nav-menu-featured-cta svg {
    width: 12px;
    height: 12px;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    transition: transform 0.25s ease;
  }

  .l2-nav-menu-featured:hover .l2-nav-menu-featured-cta {
    gap: 9px;
  }

  .l2-nav-menu-featured:hover .l2-nav-menu-featured-cta svg {
    transform: translate(1px, -1px);
  }

  /* ============================================================
     GitHub hover preview card — a mini "browser window" showing the
     repo identity, live stats, and a star CTA.
     ============================================================ */
  /* ---- Buy Me a Coffee (official bmc-button.svg art, 545×153) ----
     40px tall keeps official proportions (~142px wide). fit-content pins
     pill + glow to the art — a flex column would otherwise stretch the
     anchor box and widen the highlight. Hover: lift + warm glow, matching
     the featured tile's own hover language (no more, no less). */
  .l2-nav-bmc {
    display: inline-block;
    width: fit-content;
    border-radius: 999px;
    text-decoration: none;
    box-shadow: 0 2px 10px -3px rgba(13, 12, 34, 0.18);
    transition:
      transform 0.3s cubic-bezier(0.22, 1, 0.36, 1),
      filter 0.3s ease,
      box-shadow 0.3s ease;
  }

  .l2-nav-bmc img {
    display: block;
    width: auto;
    height: 40px;
    border-radius: 999px;
  }

  .l2-nav-bmc:hover,
  .l2-nav-bmc:focus-visible {
    transform: translateY(-2px);
    filter: saturate(1.08) brightness(1.03);
    box-shadow:
      0 8px 22px -6px rgba(255, 221, 0, 0.85),
      0 3px 8px -2px rgba(13, 12, 34, 0.15);
  }

  .l2-nav-bmc:focus-visible {
    outline: 2px solid var(--text, #0d0c22);
    outline-offset: 2px;
  }

  .l2-nav-bmc-label {
    font-size: 10.5px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-secondary);
  }

  .l2-nav-bmc-label-center {
    text-align: center;
  }

  .l2-nav-menu-block-github {
    width: 380px;
  }

  /* GitHub support column: mirror card + BMC button underneath. */
  .l2-gh-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .l2-gh-wrap .l2-nav-bmc,
  .l2-gh-wrap .l2-nav-bmc-label {
    align-self: center;
  }

  .l2-gh-card {
    border-radius: 14px;
    overflow: hidden;
    border: 1px solid rgba(226, 232, 240, 0.7);
    background: linear-gradient(180deg, #ffffff, #fbfdfc);
    box-shadow: 0 6px 20px rgba(15, 20, 25, 0.07);
  }

  .l2-gh-chrome {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 8px 12px;
    background: linear-gradient(180deg, #f1f5f9, #e8eef2);
    border-bottom: 1px solid rgba(226, 232, 240, 0.8);
  }

  .l2-gh-chrome span {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #cbd5e1;
  }

  .l2-gh-chrome span:nth-child(1) {
    background: #f87171;
  }

  .l2-gh-chrome span:nth-child(2) {
    background: #fbbf24;
  }

  .l2-gh-chrome span:nth-child(3) {
    background: #34d399;
  }

  .l2-gh-body {
    padding: 14px 16px 16px;
    display: grid;
    gap: 10px;
  }

  .l2-gh-repo {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    text-decoration: none;
    color: var(--text);
    font-size: 13px;
    font-weight: 700;
    min-width: 0;
    transition: color 0.2s ease;
  }

  .l2-gh-repo:hover {
    color: var(--gc-green);
  }

  .l2-gh-mark {
    flex: none;
    width: 18px;
    height: 18px;
    fill: currentColor;
  }

  .l2-gh-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .l2-gh-arrow {
    flex: none;
    width: 12px;
    height: 12px;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
    opacity: 0.6;
    transition: transform 0.25s ease;
  }

  .l2-gh-repo:hover .l2-gh-arrow {
    transform: translate(1px, -1px);
  }

  .l2-gh-desc {
    margin: 0;
    font-size: 11.5px;
    line-height: 1.55;
    color: var(--text-secondary);
  }

  .l2-gh-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .l2-gh-stat {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 4px 9px;
    border-radius: 999px;
    border: 1px solid rgba(226, 232, 240, 0.8);
    background: rgba(248, 250, 251, 0.9);
    font-size: 11px;
    font-weight: 600;
    color: var(--text-secondary);
    font-variant-numeric: tabular-nums;
  }

  .l2-gh-stat svg {
    width: 11px;
    height: 11px;
    stroke: var(--gc-green);
    stroke-width: 1.9;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
  }

  .l2-gh-version {
    color: var(--gc-green);
    border-color: rgba(26, 139, 85, 0.25);
    background: var(--gc-green-bg);
  }

  .l2-gh-cta {
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 8px 14px;
    border-radius: 10px;
    background: #1a1a2e;
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    text-decoration: none;
    overflow: hidden;
    transition:
      background-color 0.2s ease,
      transform 0.2s ease,
      box-shadow 0.2s ease;
    box-shadow: 0 4px 12px rgba(15, 20, 25, 0.18);
  }

  .l2-gh-cta::before {
    content: '';
    position: absolute;
    top: -60%;
    left: -70%;
    width: 45%;
    height: 220%;
    background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.28), transparent);
    transform: skewX(-20deg);
    transition: left 0.55s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  }

  .l2-gh-cta:hover::before {
    left: 130%;
  }

  .l2-gh-cta:hover {
    background: #0f0f1d;
    transform: translateY(-1px);
    box-shadow: 0 6px 16px rgba(15, 20, 25, 0.24);
  }

  .l2-gh-cta svg {
    width: 12px;
    height: 12px;
    stroke: #fbbc04;
    stroke-width: 1.9;
    stroke-linecap: round;
    stroke-linejoin: round;
    fill: none;
  }

  /* ============================================================
     Auto dark identity: flips text, logo, and glass surface when the
     section under the navbar is dark (Cloudflare-style).
     ============================================================ */
  .l2-nav-shell.nav-dark .l2-nav-bar {
    background: linear-gradient(120deg, rgba(8, 14, 12, 0.58), rgba(5, 9, 8, 0.42));
    border-color: rgba(255, 255, 255, 0.08);
    border-bottom-color: rgba(255, 255, 255, 0.12);
    box-shadow:
      0 12px 30px rgba(0, 0, 0, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.12);
  }

  .l2-nav-shell.nav-dark.is-scrolled .l2-nav-bar {
    background: linear-gradient(120deg, rgba(10, 17, 14, 0.66), rgba(6, 11, 9, 0.5));
    border-color: rgba(255, 255, 255, 0.16);
  }

  .l2-nav-shell.nav-dark .l2-nav-bar::before {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.14), rgba(255, 255, 255, 0) 36%),
      linear-gradient(120deg, rgba(255, 255, 255, 0.06), rgba(255, 255, 255, 0.02) 48%, rgba(255, 255, 255, 0.06));
    box-shadow:
      inset 0 1px 0 rgba(255, 255, 255, 0.18),
      inset 0 -1px 0 rgba(255, 255, 255, 0.06);
  }

  .l2-nav-shell.nav-dark .l2-nav-bar::after {
    background: radial-gradient(
      190px 64px at var(--nav-pointer-x, 50%) 0%,
      rgba(255, 255, 255, 0.16),
      rgba(255, 255, 255, 0) 72%
    );
  }

  .l2-nav-shell.nav-dark .l2-nav-brand {
    color: #f4faf7;
  }

  .l2-nav-shell.nav-dark .l2-nav-logo {
    filter: brightness(0) invert(1);
  }

  .l2-nav-shell.nav-dark .l2-nav-link {
    color: rgba(244, 250, 247, 0.82);
  }

  .l2-nav-shell.nav-dark .l2-nav-link:hover,
  .l2-nav-shell.nav-dark .l2-nav-link.open,
  .l2-nav-shell.nav-dark .l2-nav-github:hover {
    color: #9fe8c0;
  }

  .l2-nav-shell.nav-dark .l2-nav-link.active {
    color: #9fe8c0;
  }

  /* Dark identity for the hover modules: same deep-glass surface as the
     navbar, mint accent instead of green. The solid-green featured card
     and the light GitHub preview card stay as-is — both are intentional
     fixed-identity artifacts. */
  .l2-nav-shell.nav-dark .l2-nav-dropdown,
  .l2-nav-shell.nav-dark .l2-nav-alt-browsers {
    border-color: rgba(255, 255, 255, 0.12);
    background: linear-gradient(160deg, rgba(13, 20, 17, 0.94), rgba(8, 13, 11, 0.9));
    box-shadow:
      0 24px 60px rgba(0, 0, 0, 0.5),
      0 4px 14px rgba(0, 0, 0, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.1);
  }

  .l2-nav-shell.nav-dark .l2-nav-menu-title {
    color: rgba(244, 250, 247, 0.55);
  }

  .l2-nav-shell.nav-dark .l2-nav-menu-label {
    color: #f4faf7;
  }

  .l2-nav-shell.nav-dark .l2-nav-menu-desc {
    color: rgba(244, 250, 247, 0.68);
  }

  .l2-nav-shell.nav-dark .l2-nav-menu-glyph {
    color: #9fe8c0;
    background: rgba(159, 232, 192, 0.1);
    border-color: rgba(159, 232, 192, 0.16);
  }

  .l2-nav-shell.nav-dark .l2-nav-menu-link:hover,
  .l2-nav-shell.nav-dark .l2-nav-menu-link:focus-visible {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(159, 232, 192, 0.28);
    box-shadow:
      0 8px 20px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(159, 232, 192, 0.08);
  }

  .l2-nav-shell.nav-dark .l2-nav-menu-link:hover .l2-nav-menu-glyph {
    background: rgba(159, 232, 192, 0.16);
  }

  .l2-nav-shell.nav-dark .l2-nav-alt:hover,
  .l2-nav-shell.nav-dark .l2-nav-alt:focus-visible {
    background: rgba(255, 255, 255, 0.06);
    border-color: rgba(159, 232, 192, 0.28);
    box-shadow:
      0 8px 20px rgba(0, 0, 0, 0.3),
      0 0 0 1px rgba(159, 232, 192, 0.08);
  }

  /* Page dim behind an open menu — focuses the eye on the panel. */
  .l2-nav-backdrop {
    position: fixed;
    inset: 0;
    z-index: -1;
    appearance: none;
    border: none;
    padding: 0;
    background: rgba(15, 20, 25, 0.16);
    -webkit-backdrop-filter: blur(3px) saturate(115%);
    backdrop-filter: blur(3px) saturate(115%);
    opacity: 0;
    pointer-events: none;
    cursor: default;
    transition: opacity 0.3s ease;
  }

  .l2-nav-shell.menu-open .l2-nav-backdrop {
    opacity: 1;
    pointer-events: auto;
  }

  .l2-nav-menu-btn {
    display: none;
    width: 36px;
    height: 36px;
    border: 1px solid var(--border);
    border-radius: 10px;
    background: #fff;
    color: var(--text-secondary);
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.2s ease, color 0.2s ease, background-color 0.2s ease;
  }

  .l2-nav-menu-btn:hover {
    border-color: var(--border-hover);
    color: var(--gc-green);
  }

  .l2-nav-menu-btn svg {
    width: 18px;
    height: 18px;
    stroke: currentColor;
    stroke-width: 2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .l2-nav-mobile-panel {
    display: none;
    background: rgba(248, 250, 251, 0.98);
    box-shadow: 0 10px 24px rgba(15, 20, 25, 0.08);
    border-radius: 0 0 14px 14px;
  }

  .l2-nav-mobile-links {
    display: grid;
    gap: 6px;
    margin-bottom: 12px;
  }

  .l2-nav-mobile-links a {
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #fff;
    padding: 10px 12px;
    text-decoration: none;
    color: var(--text-secondary);
    font-size: 14px;
    font-weight: 600;
  }

  .l2-nav-mobile-links a.active {
    color: var(--gc-green);
    border-color: rgba(26, 139, 85, 0.35);
    background: var(--gc-green-bg);
  }

  .l2-nav-cta-mobile {
    display: block;
    width: 100%;
    text-align: center;
  }

  /* Secondary store links under the mobile install CTA — touch has no
     hover, so the desktop submenu's Firefox/Edge targets live here. */
  .l2-nav-mobile-alt {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
    margin-top: 8px;
  }

  .l2-nav-mobile-alt-link {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    min-height: 44px;
    border-radius: 10px;
    border: 1px solid var(--border);
    background: #fff;
    text-decoration: none;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 600;
    transition: border-color 0.2s ease, color 0.2s ease;
  }

  .l2-nav-mobile-alt-link :global(svg) {
    width: 18px;
    height: 18px;
  }

  .l2-nav-mobile-alt-link:hover {
    border-color: var(--border-hover);
    color: var(--gc-green);
  }

  /* ============================================================
     Install CTA with an alternate-browser dropdown (Firefox / Edge)
     revealed under the button on hover — same design language as the
     shared nav dropdown: one glass panel, labeled menu rows, staggered
     entrance.
     ============================================================ */
  .l2-nav-cta-wrap {
    position: relative;
    display: inline-flex;
  }

  .l2-nav-alt-browsers {
    position: absolute;
    /* Navbar-bottom + 16px — the same rest gap the shared dropdown keeps.
       Its 16px is measured from the bar itself; this panel anchors to the
       CTA wrap, whose bottom sits 13px (12px padding + 1px border) above
       the bar's border box. */
    top: calc(100% + 31px);
    right: 0;
    display: grid;
    gap: 2px;
    min-width: 264px;
    padding: 14px;
    opacity: 0;
    visibility: hidden;
    transform: translateY(12px) scale(0.97);
    transform-origin: top right;
    pointer-events: none;
    transition:
      opacity 0.24s ease,
      transform 0.3s var(--nav-ease),
      visibility 0s linear 0.24s;
  }

  /* Open state is driven by the same JS menu machine as the shared nav
     dropdowns (openMenu === 'install'): hover with a close-grace timer,
     keyboard focus, Escape, and the shared page dim. */
  .l2-nav-alt-browsers.open {
    opacity: 1;
    visibility: visible;
    transform: translateY(0) scale(1);
    pointer-events: auto;
    transition-delay: 0s;
  }

  /* Rows mirror the megamenu link anatomy (glyph tile + label + desc) by
     reusing its classes; only the tile's inner svg differs — brand marks
     are filled multicolor art, not stroked line glyphs. */
  .l2-nav-alt {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 9px 10px;
    border-radius: 14px;
    border: 1px solid transparent;
    background: transparent;
    text-decoration: none;
    white-space: nowrap;
    opacity: 0;
    transform: translateY(6px);
    transition:
      opacity 0.26s ease,
      transform 0.3s var(--nav-ease),
      background-color 0.3s ease,
      border-color 0.3s ease,
      box-shadow 0.3s ease;
    transition-delay: calc(55ms + var(--alt-i, 0) * 38ms);
  }

  .l2-nav-alt-browsers.open .l2-nav-alt {
    opacity: 1;
    transform: translateY(0);
  }

  .l2-nav-menu-glyph-brand :global(svg) {
    width: 18px;
    height: 18px;
    stroke: none;
  }

  .l2-nav-alt:hover,
  .l2-nav-alt:focus-visible {
    background: rgba(255, 255, 255, 0.75);
    border-color: rgba(26, 139, 85, 0.22);
    transform: translateY(-2px);
    box-shadow:
      0 8px 20px rgba(26, 139, 85, 0.12),
      0 0 0 1px rgba(26, 139, 85, 0.06);
  }

  .l2-nav-alt:hover .l2-nav-menu-glyph,
  .l2-nav-alt:focus-visible .l2-nav-menu-glyph {
    background: rgba(26, 139, 85, 0.14);
    transform: scale(1.06) rotate(-3deg);
    box-shadow: 0 4px 10px rgba(26, 139, 85, 0.18);
  }

  .l2-nav-cta {
    position: relative;
    overflow: hidden;
    background: var(--gc-green);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 18px;
    border-radius: 999px;
    text-decoration: none;
    transition:
      background-color 0.2s ease,
      transform 0.2s ease,
      box-shadow 0.2s ease;
    white-space: nowrap;
    box-shadow: 0 2px 8px rgba(26, 139, 85, 0.25);
  }

  /* Shine sweep across the install pill on hover. */
  .l2-nav-cta::before {
    content: '';
    position: absolute;
    top: -60%;
    left: -70%;
    width: 45%;
    height: 220%;
    background: linear-gradient(105deg, transparent, rgba(255, 255, 255, 0.5), transparent);
    transform: skewX(-20deg);
    transition: left 0.55s cubic-bezier(0.4, 0, 0.2, 1);
    pointer-events: none;
  }

  .l2-nav-cta:hover::before {
    left: 130%;
  }

  .l2-nav-cta:hover {
    background: var(--gc-green-dark);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(26, 139, 85, 0.3);
  }

  .l2-nav-cta:active {
    transform: translateY(0) scale(0.98);
  }

  /* Pill mode swaps the full label for a compact "Install" and shows the
     store-bubble stack beside it. The anchor's aria-label keeps the
     browser-specific accessible name in both states. */
  .l2-nav-cta-label-short {
    display: none;
  }

  .l2-nav-shell.is-scrolled .l2-nav-cta-desktop {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 12px 6px 14px;
  }

  .l2-nav-shell.is-scrolled .l2-nav-cta-desktop .l2-nav-cta-label {
    display: none;
  }

  .l2-nav-shell.is-scrolled .l2-nav-cta-desktop .l2-nav-cta-label-short {
    display: inline;
  }

  /* The three store marks ride inside the compact Install button as an
     avatar stack — decorative only (the whole button is the link); the
     hover dropdown carries the per-store links. Hidden at rest, where the
     full-text CTA and the hover dropdown carry the same job. */
  .l2-nav-store-stack {
    display: none;
  }

  .l2-nav-shell.is-scrolled .l2-nav-cta-desktop .l2-nav-store-stack {
    display: inline-flex;
    align-items: center;
  }

  .l2-nav-store-bubble {
    position: relative;
    display: grid;
    place-items: center;
    width: 24px;
    height: 24px;
    border-radius: 999px;
    background: #fff;
    box-shadow:
      0 0 0 1.5px rgba(255, 255, 255, 0.9),
      0 1px 3px rgba(15, 20, 25, 0.22);
  }

  /* Avatar-stack overlap; the left bubble sits above its right neighbor,
     like the reference image. */
  .l2-nav-store-bubble + .l2-nav-store-bubble {
    margin-left: -9px;
  }

  .l2-nav-store-bubble:nth-child(1) {
    z-index: 3;
  }

  .l2-nav-store-bubble:nth-child(2) {
    z-index: 2;
  }

  .l2-nav-store-bubble :global(svg) {
    width: 14px;
    height: 14px;
  }

  /* Dropdown header + Chrome Web Store row swap with the pill: at rest the
     button already names the detected browser, so the panel lists only the
     other two; in pill mode the button is a generic "Install", so the
     panel becomes "Install options" with the Chrome Web Store on top. */
  .l2-nav-menu-title-pill {
    display: none;
  }

  .l2-nav-shell.is-scrolled .l2-nav-menu-title-rest {
    display: none;
  }

  .l2-nav-shell.is-scrolled .l2-nav-menu-title-pill {
    display: inline;
  }

  .l2-nav-alt-chrome {
    display: none;
  }

  .l2-nav-shell.is-scrolled .l2-nav-alt-chrome {
    display: flex;
  }

  .l2-nav-link:focus-visible,
  .l2-nav-github:focus-visible,
  .l2-nav-menu-link:focus-visible,
  .l2-nav-menu-featured:focus-visible,
  .l2-nav-cta:focus-visible,
  .l2-nav-menu-btn:focus-visible {
    outline: 2px solid var(--gc-green);
    outline-offset: 2px;
  }

  @keyframes slideDown {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  /* The links keep their absolute centering at every desktop width —
     down to 861px there is still ~24px clearance to the install CTA —
     and below 860px they are hidden for the mobile layout. */

  @media (max-width: 860px) {
    .l2-nav-bar {
      padding: 10px 16px;
    }

    /* Full-width compact bar on scroll — no pill shrink, no dead middle. */
    .l2-nav-shell.is-scrolled .l2-nav-bar {
      width: calc(100% - 16px);
      margin-inline: 8px;
      border-radius: 22px;
    }

    .l2-nav-inner {
      gap: 12px;
      min-height: 44px;
    }

    .site-main {
      padding-top: 22px;
      padding-bottom: 34px;
    }

    .l2-wrap {
      padding: 0 16px;
    }

    .l2-nav-logo {
      height: 34px;
    }

    .l2-nav-links-desktop,
    .l2-nav-cta-desktop,
    .l2-nav-alt-browsers,
    .l2-nav-dropdown {
      display: none;
    }

    /* The pill's store bubbles are desktop-scrolled-state chrome only. */
    .l2-nav-store-stack {
      display: none !important;
    }

    .l2-nav-menu-btn {
      display: inline-flex;
      width: 40px;
      height: 40px;
      border-radius: 12px;
    }

    .l2-nav-mobile-panel {
      display: block;
      margin: 10px 2px 0;
      padding: 12px;
      border: 1px solid rgba(255, 255, 255, 0.75);
      border-radius: 16px;
      background: linear-gradient(160deg, rgba(255, 255, 255, 0.94), rgba(248, 252, 249, 0.88));
      -webkit-backdrop-filter: blur(24px) saturate(190%);
      backdrop-filter: blur(24px) saturate(190%);
      box-shadow:
        0 12px 28px rgba(15, 20, 25, 0.08),
        inset 0 1px 0 rgba(255, 255, 255, 0.85);
      animation: slideDown 0.2s ease;
    }

    .l2-nav-mobile-links {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
      margin-bottom: 10px;
    }

    .l2-nav-mobile-links a {
      min-height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 10px 8px;
      font-size: 13px;
      font-weight: 700;
    }

    .l2-nav-cta-mobile {
      margin-top: 2px;
      padding: 11px 16px;
      font-size: 14px;
      font-weight: 700;
    }

  }

  @media (max-width: 520px) {
    .l2-nav-mobile-links {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-transparency: reduce) {
    .l2-nav-bar,
    .l2-nav-dropdown,
    .l2-nav-backdrop,
    .l2-nav-mobile-panel {
      -webkit-backdrop-filter: none;
      backdrop-filter: none;
    }

    .l2-nav-bar {
      background: #fcfefd;
      border-bottom-color: rgba(226, 232, 240, 0.9);
    }

    .l2-nav-shell.is-scrolled .l2-nav-bar {
      background: #fcfefd;
      border-color: rgba(226, 232, 240, 0.9);
    }

    .l2-nav-bar::before,
    .l2-nav-bar::after {
      display: none;
    }

    .l2-nav-dropdown {
      background: #fbfdfc;
    }

    .l2-nav-shell.nav-dark .l2-nav-dropdown,
    .l2-nav-shell.nav-dark .l2-nav-alt-browsers {
      background: #0d1411;
    }

    .l2-nav-backdrop {
      background: rgba(15, 20, 25, 0.35);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .site-route-shell {
      transition: none;
    }

    .l2-nav-shell,
    .l2-nav-float,
    .l2-nav-bar,
    .l2-nav-bar::before,
    .l2-nav-bar::after,
    .l2-nav-dropdown,
    .l2-nav-menu-block,
    .l2-nav-menu-list li,
    .l2-nav-link,
    .l2-nav-links,
    .l2-nav-caret,
    .l2-nav-menu-link,
    .l2-nav-menu-featured,
    .l2-nav-menu-featured::before,
    .l2-nav-cta,
    .l2-nav-cta::before,
    .l2-nav-alt-browsers,
    .l2-nav-alt,
    .l2-gh-cta,
    .l2-gh-cta::before,
    .l2-nav-backdrop,
    .l2-nav-menu-btn {
      transition: none !important;
      animation: none !important;
    }
  }
</style>
