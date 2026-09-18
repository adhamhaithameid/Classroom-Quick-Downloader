<script lang="ts">
  import { onMount } from 'svelte';
  import { base } from '$app/paths';
  import { page } from '$app/stores';
  import { APP_VERSION, STORE_LINKS } from '$lib/config';
  import { trackWebsiteEvent } from '$lib/analytics/websiteEvents';
  import { websiteSnapshotStore } from '$lib/stores/websiteSnapshot';
  import { browserDisplayName, detectBrowserFromNavigator, type BrowserKey } from '$lib/browser/detect';
  import type { OverviewResponse } from '$lib/types/public';
  import logo from '$lib/assets/cqd-logo.svg';

  type SnapshotLinks = OverviewResponse['links'];

  const BROWSER_ORDER: BrowserKey[] = ['chrome', 'firefox', 'edge'];
  const CREATOR_URL = 'https://github.com/adhamhaithameid';

  const currentYear = new Date().getFullYear();

  let footerEl: HTMLElement | null = null;
  let megaEl: HTMLElement | null = null;
  let detectedBrowser: BrowserKey = 'chrome';
  let snapshotLinks: SnapshotLinks | null = null;
  $: snapshotLinks = $websiteSnapshotStore.snapshot?.overview.links ?? null;

  $: githubUrl = snapshotLinks?.github || STORE_LINKS.github;
  $: reportIssueUrl = `${githubUrl}/issues/new/choose`;
  /* Detected browser sits in the middle and gets the primary treatment —
     the same install strategy the overview CTA uses. SSR default (chrome)
     renders the Firefox | Chrome | Edge order. */
  $: orderedCtas = (() => {
    const others = BROWSER_ORDER.filter((b) => b !== detectedBrowser);
    return [others[0], detectedBrowser, others[1]] as BrowserKey[];
  })();

  function storeLink(key: BrowserKey): string {
    return snapshotLinks?.[key] || STORE_LINKS[key];
  }

  function trackFooterInstall(browser: BrowserKey): void {
    trackWebsiteEvent({
      eventType: 'cta',
      action: 'install_click',
      placement: `footer_install_${browser}`,
      pagePath: $page.url.pathname
    });
  }

  /* Reveal-on-scroll is progressive enhancement: without JS (or with
     prefers-reduced-motion) every section stays fully visible. Only
     sections below the fold get the hidden state, so nothing flashes.
     It must fail open — a fast scroll can jump an element from below the
     viewport to above it without any observer callback, so a passive scroll
     check and a failsafe timer reveal anything left behind. */
  onMount(() => {
    detectedBrowser = detectBrowserFromNavigator();

    if (!footerEl || !megaEl) return;
    const mega = megaEl;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const cleanups: Array<() => void> = [];

    if (!reducedMotion) {
      /* ── Reveal-on-scroll (fail-open) ──
         Sections stay visible by default; only below-fold ones get the
         hidden state, and a passive scroll check plus a failsafe timer
         guarantee everything resolves. */
      const pending = new Set<HTMLElement>();
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight) {
              reveal(entry.target as HTMLElement);
            }
          }
        },
        { threshold: 0, rootMargin: '0px 0px 120px 0px' }
      );

      function reveal(el: HTMLElement): void {
        el.classList.add('cqd-reveal-in');
        pending.delete(el);
        observer.unobserve(el);
        if (pending.size === 0) {
          window.removeEventListener('scroll', onScroll);
          clearTimeout(failsafe);
        }
      }

      /* rAF-throttled so at most one measurement pass happens per frame. */
      let ticking = false;
      function onScroll(): void {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
          ticking = false;
          for (const el of pending) {
            if (el.getBoundingClientRect().top <= window.innerHeight) reveal(el);
          }
        });
      }

      const failsafe = setTimeout(() => {
        for (const el of pending) reveal(el);
      }, 4000);

      for (const el of Array.from(footerEl.querySelectorAll<HTMLElement>('.cqd-reveal'))) {
        if (el.getBoundingClientRect().top > window.innerHeight * 0.9) {
          el.classList.add('cqd-reveal-pending');
          pending.add(el);
          observer.observe(el);
        }
      }
      if (pending.size > 0) {
        window.addEventListener('scroll', onScroll, { passive: true });
      }

      cleanups.push(() => {
        window.removeEventListener('scroll', onScroll);
        clearTimeout(failsafe);
        observer.disconnect();
      });

      /* Gentle entrance for the wordmark, same fail-open pattern. */
      const entranceObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting || entry.boundingClientRect.top < window.innerHeight) {
              mega.classList.remove('ft-mega-pending');
              entranceObserver.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.15 }
      );
      const entranceFailsafe = setTimeout(() => mega.classList.remove('ft-mega-pending'), 4000);
      if (mega.getBoundingClientRect().top > window.innerHeight * 0.9) {
        mega.classList.add('ft-mega-pending');
        entranceObserver.observe(mega);
      }
      cleanups.push(() => {
        clearTimeout(entranceFailsafe);
        entranceObserver.disconnect();
      });
    }

    /* ── Dot-particle wordmark ──
       The giant text is rasterized once and sampled into a few thousand
       dots on a single canvas. The rest state is one static frame — no
       idle animation, nothing breathes on its own. Hovering shatters the
       dots: pointer entry and clicks fire ripple pulses whose wavefront
       kicks granules as it travels through the glyphs, and while the
       pointer stays inside, a local repulsion field holds a cavity open
       around it. When the pointer leaves, the springs carry every dot
       back home; once motion settles, the exact rest frame is drawn and
       the loop parks, so the idle wordmark costs nothing. Reduced motion
       renders the static wordmark only. */
    const canvas = mega.querySelector<HTMLCanvasElement>('canvas.ft-mega-canvas');
    if (canvas) {
      const cv = canvas;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const fontFamily = getComputedStyle(mega).fontFamily;
      const LINE_1 = 'CLASSROOM QUICK';
      const LINE_2 = 'DOWNLOADER';
      /* All forces are strictly local and speed is capped, so a small
         hover never wobbles the whole wordmark. The tangential slice on
         the repulsion makes bursts read as shattered granules flying
         off-axis instead of a symmetric blob push. */
      const REPEL_RADIUS = 110;
      const REPEL_FORCE = 2.2;
      const REPEL_SPIN = 0.45;
      const PULSE_SPEED = 0.62; /* wavefront travel, px per ms */
      const PULSE_BAND = 48; /* wavefront thickness, px */
      const PULSE_KICK = 3.4; /* peak impulse per frame at the front */
      const MAX_PULSES = 6;
      const DRAG = 0.9;
      const EASE = 0.085;
      const MAX_SPEED = 13;
      const SETTLE = 0.08;

      type Dot = {
        hx: number;
        hy: number;
        x: number;
        y: number;
        vx: number;
        vy: number;
        spin: number;
      };
      type Pulse = { x: number; y: number; t0: number };

      let dots: Dot[] = [];
      let pulses: Pulse[] = [];
      let ctx: CanvasRenderingContext2D | null = null;
      let cw = 0;
      let ch = 0;
      let gridSize = 7;
      let raf = 0;
      let lastTime = 0;
      let pointerInside = false;
      let px = 0;
      let py = 0;
      let megaVisible = false;
      let pointerTicking = false;
      let moveSeq = 0;
      let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
      const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

      /* ── Effect switches — flip these while experimenting ──
         ENABLE_WATER_DROP_RIPPLE: pointer entry and clicks fire a wavefront
         pulse that ripples the whole text like a drop on a water surface.
         ENABLE_CURSOR_CIRCLE: while the pointer stays inside, the repulsion
         field pushes dots aside and holds a clear circle open around it. */
      const ENABLE_WATER_DROP_RIPPLE = true;
      const ENABLE_CURSOR_CIRCLE = true;

      function drawAll(): void {
        if (!ctx) return;
        ctx.clearRect(0, 0, cw, ch);
        ctx.fillStyle = '#1a8b55';
        const r = gridSize * 0.45;
        const path = new Path2D();
        for (const p of dots) {
          path.moveTo(p.x + r, p.y);
          path.arc(p.x, p.y, r, 0, 6.2832);
        }
        ctx.globalAlpha = 0.82;
        ctx.fill(path);
        ctx.globalAlpha = 1;
      }

      /* Settle: snap to the exact rest frame and stop the loop — the idle
         wordmark is a static render with zero ongoing cost. */
      function settle(): void {
        for (const p of dots) {
          p.x = p.hx;
          p.y = p.hy;
          p.vx = 0;
          p.vy = 0;
        }
        pulses = [];
        drawAll();
        if (raf) {
          cancelAnimationFrame(raf);
          raf = 0;
        }
      }

      function step(now: number): boolean {
        /* dt in frames (clamped) so physics is frame-rate independent. */
        const df = Math.min(2, (now - lastTime) / 16.7 || 1);
        lastTime = now;
        const maxFront = Math.hypot(cw, ch) + PULSE_BAND;
        pulses = pulses.filter((pulse) => (now - pulse.t0) * PULSE_SPEED < maxFront);
        let energy = false;
        for (const p of dots) {
          if (pointerInside && ENABLE_CURSOR_CIRCLE) {
            const dx = p.x - px;
            const dy = p.y - py;
            const d = Math.hypot(dx, dy);
            if (d > 0.001 && d < REPEL_RADIUS) {
              const fall = 1 - d / REPEL_RADIUS;
              const f = REPEL_FORCE * fall * fall * df;
              const inv = 1 / d;
              p.vx += (dx * inv - dy * inv * p.spin * REPEL_SPIN) * f;
              p.vy += (dy * inv + dx * inv * p.spin * REPEL_SPIN) * f;
            }
          }
          for (const pulse of pulses) {
            const dx = p.x - pulse.x;
            const dy = p.y - pulse.y;
            const d = Math.hypot(dx, dy);
            if (d < 0.001) continue;
            const front = (now - pulse.t0) * PULSE_SPEED;
            const band = d - front;
            if (band > -PULSE_BAND && band < PULSE_BAND) {
              /* Amplitude falls off with distance traveled, so the wave
                 dies out toward the far edge instead of churning there. */
              const w =
                (1 - Math.abs(band) / PULSE_BAND) * Math.pow(1 - front / maxFront, 1.5);
              p.vx += (dx / d) * PULSE_KICK * w * df;
              p.vy += (dy / d) * PULSE_KICK * w * df;
            }
          }
          p.vx *= DRAG;
          p.vy *= DRAG;
          const sp = Math.hypot(p.vx, p.vy);
          if (sp > MAX_SPEED) {
            p.vx = (p.vx / sp) * MAX_SPEED;
            p.vy = (p.vy / sp) * MAX_SPEED;
          }
          p.x += p.vx + (p.hx - p.x) * EASE * df;
          p.y += p.vy + (p.hy - p.y) * EASE * df;
          if (
            Math.abs(p.vx) + Math.abs(p.vy) > 0.05 ||
            Math.abs(p.hx - p.x) + Math.abs(p.hy - p.y) > SETTLE
          ) {
            energy = true;
          }
        }
        return energy || pointerInside;
      }

      function frame(now: number): void {
        const energy = step(now);
        drawAll();
        if (energy && megaVisible) {
          raf = requestAnimationFrame(frame);
        } else {
          settle();
        }
      }

      function startLoop(): void {
        if (!raf) {
          lastTime = performance.now();
          raf = requestAnimationFrame(frame);
        }
      }

      function firePulse(x: number, y: number): void {
        pulses.push({ x, y, t0: performance.now() });
        if (pulses.length > MAX_PULSES) pulses.shift();
        startLoop();
      }

      function sample(): void {
        const innerW = Math.max(220, Math.floor(mega.clientWidth - 48));
        const probe = document.createElement('canvas');
        const pctx = probe.getContext('2d');
        if (!pctx) return;
        pctx.font = `800 100px ${fontFamily}`;
        /* Narrow screens stack the words so letters stay oversized instead
           of shrinking one long line to fit. */
        const lines = innerW < 640 ? ['CLASSROOM', 'QUICK', 'DOWNLOADER'] : [LINE_1, LINE_2];
        const widest = Math.max(...lines.map((l) => pctx.measureText(l).width)) || 900;
        const fontSize = Math.max(30, (innerW / widest) * 100);
        const lineStep = fontSize * 0.94;
        const baselines = lines.map((_, i) => fontSize * 0.82 + i * lineStep);
        const height = Math.ceil(baselines[baselines.length - 1] + fontSize * 0.2);
        probe.width = innerW;
        probe.height = height;
        const c2 = probe.getContext('2d');
        if (!c2) return;
        c2.font = `800 ${fontSize}px ${fontFamily}`;
        c2.textBaseline = 'alphabetic';
        c2.fillStyle = '#000';
        lines.forEach((line, i) => {
          const w = c2.measureText(line).width;
          c2.save();
          c2.scale(innerW / w, 1);
          c2.fillText(line, 0, baselines[i]);
          c2.restore();
        });

        const data = c2.getImageData(0, 0, innerW, height).data;
        /* Density scales with canvas area: ~5k dots on a full-size desktop
           canvas, proportionally fewer on small screens, always dense
           enough that letterforms read as solid halftone. */
        let grid = Math.max(3, Math.min(8, Math.round(Math.sqrt((innerW * height) / 16000))));
        const collect = (): Dot[] => {
          const out: Dot[] = [];
          for (let y = 0; y < height; y += grid) {
            for (let x = 0; x < innerW; x += grid) {
              if (data[(y * innerW + x) * 4 + 3] > 120) {
                out.push({ hx: x, hy: y, x, y, vx: 0, vy: 0, spin: Math.random() * 2 - 1 });
              }
            }
          }
          return out;
        };
        dots = collect();
        let attempts = 0;
        while (dots.length > 9000 && attempts < 3) {
          grid += 1;
          dots = collect();
          attempts += 1;
        }
        gridSize = grid;
        pulses = [];

        cw = innerW;
        ch = height;
        cv.width = Math.round(innerW * dpr);
        cv.height = Math.round(height * dpr);
        cv.style.height = `${height}px`;
        ctx = cv.getContext('2d');
        if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        drawAll();
      }

      sample();
      document.fonts?.ready.then(() => sample());

      const toCanvasCoords = (clientX: number, clientY: number): { x: number; y: number } => {
        const rect = cv.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
      };
      const onPointerEnter = (event: PointerEvent): void => {
        const { x, y } = toCanvasCoords(event.clientX, event.clientY);
        px = x;
        py = y;
        pointerInside = true;
        if (ENABLE_WATER_DROP_RIPPLE) firePulse(x, y);
        /* The pulse used to spin the loop up on entry; with the ripple off,
           entry must still start it so the circle can form without a move. */
        startLoop();
      };
      const onPointerMove = (event: PointerEvent): void => {
        if (pointerTicking) return;
        pointerTicking = true;
        const clientX = event.clientX;
        const clientY = event.clientY;
        const seq = ++moveSeq;
        requestAnimationFrame(() => {
          pointerTicking = false;
          /* A pointerleave after this move was queued invalidates it —
             applying a stale inside-sample would pin pointerInside true
             and keep the loop (and the repulsion) running forever. */
          if (seq !== moveSeq) return;
          const { x, y } = toCanvasCoords(clientX, clientY);
          px = x;
          py = y;
          pointerInside = true;
          startLoop();
        });
      };
      const onPointerDown = (event: PointerEvent): void => {
        const { x, y } = toCanvasCoords(event.clientX, event.clientY);
        if (ENABLE_WATER_DROP_RIPPLE) firePulse(x, y);
      };
      const onPointerLeave = (): void => {
        moveSeq++; // invalidate any queued pointermove sample
        pointerInside = false; // springs carry every dot home
      };
      const onResize = (): void => {
        if (rebuildTimer) clearTimeout(rebuildTimer);
        rebuildTimer = setTimeout(() => {
          sample();
        }, 180);
      };

      /* The loop runs only while dots are in motion; an IntersectionObserver
         parks it offscreen. Pointer-following attaches only when the device
         can actually hover — touch devices shatter the field via taps. */
      const visibilityObserver = new IntersectionObserver(
        (entries) => {
          megaVisible = entries.some((e) => e.isIntersecting);
        },
        { threshold: 0.05 }
      );

      if (!reducedMotion) {
        visibilityObserver.observe(cv);
        if (canHover) {
          mega.addEventListener('pointerenter', onPointerEnter);
          mega.addEventListener('pointermove', onPointerMove, { passive: true });
          mega.addEventListener('pointerleave', onPointerLeave);
          cleanups.push(() => {
            mega.removeEventListener('pointerenter', onPointerEnter);
            mega.removeEventListener('pointermove', onPointerMove);
            mega.removeEventListener('pointerleave', onPointerLeave);
          });
        }
        mega.addEventListener('pointerdown', onPointerDown);
        window.addEventListener('resize', onResize);
        cleanups.push(() => {
          mega.removeEventListener('pointerdown', onPointerDown);
          window.removeEventListener('resize', onResize);
          visibilityObserver.disconnect();
          if (raf) cancelAnimationFrame(raf);
          if (rebuildTimer) clearTimeout(rebuildTimer);
        });
      }
    }

    return () => {
      for (const fn of cleanups) fn();
    };
  });
</script>

<footer class="cqd-footer" bind:this={footerEl}>
  <!-- Layer 1 — final installation CTA -->
  <section class="ft-cta" aria-labelledby="ft-cta-title">
    <div class="ft-inner ft-cta-inner cqd-reveal">
      <p class="ft-eyebrow">One last click</p>
      <h2 id="ft-cta-title" class="ft-cta-title">Ready to save hours?</h2>
      <p class="ft-cta-desc">
        Install Classroom Quick Downloader in under 10 seconds. Free forever. No account required.
      </p>
      <div class="ft-cta-actions">
        {#each orderedCtas as b (b)}
          <a
            class="ft-cta-btn"
            class:ft-cta-primary={b === detectedBrowser}
            href={storeLink(b)}
            target="_blank"
            rel="noopener noreferrer"
            on:click={() => trackFooterInstall(b)}
          >
            <img src="{base}/images/{b}.svg" alt="" width="18" height="18" loading="lazy" decoding="async" />
            {#if b === detectedBrowser}Install for {browserDisplayName(b)}{:else}{browserDisplayName(b)}{/if}
          </a>
        {/each}
      </div>
      <p class="ft-cta-note">Works with Brave, Opera, Vivaldi, Arc and more.</p>
    </div>
  </section>

  <!-- Layer 2 — product identity + navigation grid -->
  <div class="ft-grid-wrap">
    <div class="ft-inner">
      <div class="ft-grid cqd-reveal">
        <div class="ft-col-brand">
          <img src={logo} alt="" width="44" height="38" class="ft-brand-logo" loading="lazy" decoding="async" />
          <p class="ft-brand-name">Classroom Quick<br />Downloader</p>
          <p class="ft-brand-desc">Download Classroom files without repetitive clicking.</p>
          <div class="ft-version-block">
            <p class="ft-label ft-version-label">Version</p>
            <p class="ft-version">{APP_VERSION}</p>
          </div>
        </div>

        <nav class="ft-col ft-col-product" aria-label="Product">
          <h2 class="ft-label">Product</h2>
          <ul class="ft-links">
            <li><a href="{base}/">Overview</a></li>
            <li><a href="{base}/#how-it-works">How it works</a></li>
            <li><a href="{base}/privacy">Privacy</a></li>
            <li><a href="{base}/faq">FAQ</a></li>
          </ul>
        </nav>

        <nav class="ft-col ft-col-support" aria-label="Support">
          <h2 class="ft-label">Support</h2>
          <ul class="ft-links">
            <li>
              <a href={githubUrl} target="_blank" rel="noopener noreferrer">GitHub</a>
            </li>
            <li><a href="{base}/changelog">Changelog</a></li>
            <li>
              <a href={reportIssueUrl} target="_blank" rel="noopener noreferrer">Report issue</a>
            </li>
          </ul>
        </nav>

        <nav class="ft-col ft-col-install" aria-label="Install">
          <h2 class="ft-label">Install</h2>
          <ul class="ft-links ft-links-install">
            <li>
              <a href={storeLink('chrome')} target="_blank" rel="noopener noreferrer" on:click={() => trackFooterInstall('chrome')}>
                Chrome <span class="ft-arrow" aria-hidden="true">↗</span>
              </a>
            </li>
            <li>
              <a href={storeLink('firefox')} target="_blank" rel="noopener noreferrer" on:click={() => trackFooterInstall('firefox')}>
                Firefox <span class="ft-arrow" aria-hidden="true">↗</span>
              </a>
            </li>
            <li>
              <a href={storeLink('edge')} target="_blank" rel="noopener noreferrer" on:click={() => trackFooterInstall('edge')}>
                Edge <span class="ft-arrow" aria-hidden="true">↗</span>
              </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  </div>

  <!-- Layer 3 — product principles strip -->
  <div class="ft-principles-wrap">
    <div class="ft-inner">
      <ul class="ft-principles cqd-reveal" aria-label="Product principles">
        <li>Instant.</li>
        <li>Private.</li>
        <li>Transparent.</li>
        <li>Universal.</li>
      </ul>
    </div>
  </div>

  <!-- Layer 4 — legal + identity bar -->
  <div class="ft-legal-wrap">
    <div class="ft-inner ft-legal cqd-reveal">
      <p>© {currentYear} Classroom Quick Downloader</p>
      <p>Not affiliated with Google or Google Classroom</p>
      <a class="ft-credit" href={CREATOR_URL} target="_blank" rel="noopener noreferrer">
        Built by Adham Haitham <span aria-hidden="true">↗</span>
      </a>
    </div>
  </div>

  <!-- Giant dot-matrix wordmark — final element, full-bleed. The text is
       rasterized into a binary mask and sampled into a grid of dots on a
       single canvas. At rest it is one static frame; hovering shatters the
       dots with a local repulsion field plus ripple pulses that travel
       through the glyphs, and on leave every dot springs back home before
       the loop parks. aria-hidden — purely decorative. -->
  <div class="ft-mega" aria-hidden="true" bind:this={megaEl}>
    <canvas class="ft-mega-canvas"></canvas>
  </div>
</footer>

<style>
  .cqd-footer {
    /* Footer-scoped palette — mirrors the light site tokens so the footer
       reads as the same visual world, grounded by the green brand rule.
       No background of its own: the footer sits over the shared ambient
       background (page canvas + orbs + cursor-lens grid) like any section. */
    --ft-text: var(--text);
    --ft-text-2: #5b6b7d;
    --ft-text-3: #64748b;
    --ft-border: rgba(226, 232, 240, 0.9);
    --ft-surface: #ffffff;
    --ft-green-hover: var(--gc-green-dark);

    position: relative;
    color: var(--ft-text);
    font-family: var(--font-ui);
    /* Interaction transforms may push letters toward the edge — clip the
       axis instead of creating a horizontal scrollbar. */
    overflow-x: clip;
  }

  .ft-cta,
  .ft-grid-wrap,
  .ft-principles-wrap,
  .ft-legal-wrap {
    position: relative;
    z-index: 1;
  }

  .ft-inner {
    max-width: 1280px;
    margin: 0 auto;
    padding: 0 24px;
  }

  /* ── Layer 1: CTA ─────────────────────────────────────────── */

  .ft-cta-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding-top: clamp(72px, 9vw, 120px);
    padding-bottom: clamp(48px, 6vw, 88px);
  }

  .ft-eyebrow {
    margin: 0 0 22px;
    color: var(--gc-green-dark);
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.22em;
    text-transform: uppercase;
  }

  .ft-cta-title {
    margin: 0 0 22px;
    font-size: clamp(44px, 7.5vw, 76px);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.04;
    color: var(--ft-text);
  }

  .ft-cta-desc {
    margin: 0 0 40px;
    max-width: 620px;
    color: var(--ft-text-2);
    font-size: 16.5px;
    line-height: 1.65;
  }

  .ft-cta-actions {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 14px;
  }

  .ft-cta-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    min-height: 52px;
    padding: 14px 32px;
    border: 1px solid var(--ft-border);
    border-radius: 10px;
    background: var(--ft-surface);
    color: var(--ft-text);
    font-size: 15px;
    font-weight: 600;
    text-decoration: none;
    transition:
      transform 0.18s ease,
      background-color 0.18s ease,
      border-color 0.18s ease,
      box-shadow 0.18s ease;
  }

  .ft-cta-btn img {
    width: 18px;
    height: 18px;
  }

  .ft-cta-btn:hover {
    transform: translateY(-1px);
    border-color: var(--border-hover);
    box-shadow: 0 6px 18px rgba(15, 20, 25, 0.08);
  }

  .ft-cta-btn:active {
    transform: translateY(0);
  }

  .ft-cta-primary {
    background: var(--gc-green);
    border-color: var(--gc-green);
    color: #fff;
  }

  .ft-cta-primary:hover {
    background: var(--ft-green-hover);
    border-color: var(--ft-green-hover);
    box-shadow: 0 6px 20px rgba(26, 139, 85, 0.3);
  }

  .ft-cta-note {
    margin: 26px 0 0;
    color: var(--ft-text-3);
    font-size: 13.5px;
    letter-spacing: 0.01em;
  }

  /* ── Layer 2: product grid ────────────────────────────────── */

  .ft-grid-wrap {
    position: relative;
    z-index: 1;
  }

  .ft-grid {
    position: relative;
    z-index: 1;
    display: grid;
    grid-template-columns: 1.8fr 1fr 1fr 1fr;
    column-gap: clamp(36px, 5vw, 64px);
    row-gap: 40px;
    padding-top: clamp(40px, 5vw, 64px);
    padding-bottom: clamp(40px, 5vw, 64px);
  }

  .ft-label {
    margin: 0 0 20px;
    color: var(--ft-text-3);
    font-size: 11.5px;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }

  .ft-brand-name {
    margin: 0 0 18px;
    font-size: clamp(30px, 3.2vw, 42px);
    font-weight: 800;
    letter-spacing: -0.02em;
    line-height: 1.05;
    color: var(--ft-text);
  }

  .ft-brand-desc {
    margin: 0;
    max-width: 300px;
    color: var(--ft-text-2);
    font-size: 15px;
    line-height: 1.6;
  }

  .ft-version-block {
    margin-top: 28px;
    display: flex;
    align-items: baseline;
    gap: 10px;
  }

  .ft-version-label {
    margin: 0;
  }

  .ft-version {
    margin: 0;
    color: var(--gc-green-dark);
    font-size: 17px;
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .ft-brand-logo {
    display: block;
    width: 44px;
    height: auto;
    margin: 0 0 16px;
    border-radius: 8px;
  }

  .ft-links {
    list-style: none;
    margin: 0;
    padding: 0;
  }

  .ft-links a {
    display: inline-block;
    padding: 7px 0;
    color: var(--ft-text-2);
    font-size: 15px;
    font-weight: 500;
    text-decoration: none;
    transition: color 0.18s ease;
  }

  .ft-links a:hover {
    color: var(--ft-green-hover);
  }

  .ft-links-install a:hover {
    color: var(--ft-green-hover);
  }

  .ft-arrow {
    display: inline-block;
    font-size: 12px;
    transition: transform 0.18s ease;
  }

  .ft-links-install a:hover .ft-arrow {
    transform: translate(2px, -2px);
  }

  /* ── Layer 3: principles strip ────────────────────────────── */

  .ft-principles {
    list-style: none;
    margin: 0;
    padding: clamp(32px, 4vw, 48px) 0;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 24px clamp(14px, 3vw, 32px);
  }

  .ft-principles li {
    color: var(--ft-text);
    font-size: clamp(20px, 3vw, 34px);
    font-weight: 800;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  /* ── Layer 4: legal bar ───────────────────────────────────── */

  .ft-legal-wrap {
    padding: 20px 0 34px;
  }

  .ft-legal {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px 24px;
  }

  .ft-legal p {
    margin: 0;
    color: var(--ft-text-3);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .ft-credit {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--ft-text-2);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    text-decoration: none;
    transition: color 0.18s ease;
  }

  .ft-credit:hover {
    color: var(--ft-green-hover);
  }

  /* ── Giant dot-matrix wordmark ────────────── */

  .ft-mega {
    position: relative;
    z-index: 1;
    margin-top: clamp(24px, 3.5vw, 44px);
    padding: 0 24px 8px;
    transition:
      opacity 0.6s ease,
      transform 0.6s ease;
  }

  .cqd-footer :global(.ft-mega-pending) {
    opacity: 0;
    transform: translateY(20px);
  }

  .ft-mega-canvas {
    display: block;
    width: 100%;
    height: auto;
    user-select: none;
    pointer-events: none;
  }

  /* ── Focus ────────────────────────────────────────────────── */

  .cqd-footer a:focus-visible {
    outline: 2px solid var(--gc-green);
    outline-offset: 3px;
    border-radius: 4px;
  }

  .ft-cta-btn:focus-visible {
    border-radius: 10px;
  }

  /* ── Reveal (progressive enhancement only) ────────────────── */
  /* Classes are added at runtime via IntersectionObserver, so they must
     be :global() within the scoped footer to survive Svelte pruning. */

  .cqd-footer :global(.cqd-reveal-pending) {
    opacity: 0;
    transform: translateY(14px);
    transition:
      opacity 0.5s ease,
      transform 0.5s ease;
  }

  .cqd-footer :global(.cqd-reveal-pending.cqd-reveal-in) {
    opacity: 1;
    transform: translateY(0);
  }

  /* ── Reduced motion ───────────────────────────────────────── */

  @media (prefers-reduced-motion: reduce) {
    .cqd-footer *,
    .cqd-footer *::before,
    .cqd-footer *::after {
      transition: none !important;
      animation: none !important;
    }

    .cqd-footer :global(.ft-mega-pending) {
      opacity: 1;
      transform: none;
    }

    .cqd-footer :global(.cqd-reveal-pending) {
      opacity: 1;
      transform: none;
    }
  }

  /* ── Responsive ───────────────────────────────────────────── */

  @media (max-width: 1024px) {
    .ft-grid {
      /* Brand on its own row; the three nav groups share the row below. */
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .ft-col-brand {
      grid-column: 1 / -1;
    }
  }

  @media (max-width: 640px) {
    .ft-inner {
      padding: 0 20px;
    }

    .ft-cta-actions {
      flex-direction: column;
      align-self: stretch;
      width: 100%;
      max-width: 380px;
      margin: 0 auto;
    }

    .ft-cta-btn {
      width: 100%;
    }

    .ft-grid {
      grid-template-columns: 1fr;
      row-gap: 44px;
    }

    /* Install before ordinary navigation on small screens. */
    .ft-col-install {
      order: 2;
    }

    .ft-col-product {
      order: 3;
    }

    .ft-col-support {
      order: 4;
    }

    .ft-links a {
      padding: 11px 0;
      font-size: 15.5px;
    }

    .ft-principles {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px 12px;
      justify-items: start;
    }

    .ft-principles li {
      font-size: 20px;
      letter-spacing: 0.03em;
    }

    .ft-legal {
      flex-direction: column;
      justify-content: flex-start;
      align-items: center;
      text-align: center;
      gap: 10px;
    }
  }
</style>
