<script lang="ts">
  /**
   * TestimonialsSection — real store reviews in the approved "Spotlight Border"
   * card, auto-sliding carousel with side arrows. Motion speaks the house
   * vocabulary: --mi-* tokens from app.css, the magnetic action on the arrows,
   * sheen sweep and star cascade on card hover.
   *
   * Autoplay (6s) runs continuously and never stops on any interaction —
   * arrows keep working while it advances and it wraps back to the start.
   * Only prefers-reduced-motion turns it off (an accessibility setting, not
   * an interaction). Deliberately has no pause button, no progress bar and no
   * slide counter (user decisions, 2026-09-20).
   */
  import { onMount } from 'svelte';
  import { magnetic } from '$lib/actions/magnetic';
  import { websiteSnapshotStore } from '$lib/stores/websiteSnapshot';
  import {
    TESTIMONIALS,
    TESTIMONIAL_AGGREGATE,
    mergeLiveTestimonials,
    type Testimonial
  } from '$lib/testimonials/data';

  const AUTOPLAY_MS = 6000;

  let rootEl: HTMLElement;
  let trackEl: HTMLDivElement;
  let index = 0;
  let perView = 3;
  let autoplayTimer: ReturnType<typeof setInterval> | null = null;
  let reduceMotion = false;
  let inView = false;
  let revealed = false;
  let mounted = false;

  const storeNames: Record<Testimonial['store'], string> = {
    chrome: 'Chrome Web Store',
    edge: 'Edge Add-ons',
    firefox: 'Firefox Add-ons'
  };

  // Curated baseline first; live 5-star reviews from the worker snapshot are
  // merged in as they appear (bounded, deduped, never replacing the approved set).
  $: allReviews = mergeLiveTestimonials(
    TESTIMONIALS,
    $websiteSnapshotStore.snapshot?.testimonials?.reviews
  );

  const maxIndex = () => Math.max(0, allReviews.length - perView);

  function measure(): void {
    const w = window.innerWidth;
    perView = w <= 680 ? 1 : w <= 1020 ? 2 : 3;
    index = Math.min(index, maxIndex());
    position();
  }

  function position(): void {
    if (!trackEl) return;
    const slide = trackEl.children[0] as HTMLElement | undefined;
    if (!slide) return;
    const step = slide.getBoundingClientRect().width + 22;
    trackEl.style.transform = `translateX(${-index * step}px)`;
  }

  function go(delta: number): void {
    index = Math.max(0, Math.min(maxIndex(), index + delta));
    position();
  }

  function startAutoplay(): void {
    if (reduceMotion || autoplayTimer || !inView || !mounted) return;
    autoplayTimer = setInterval(() => {
      index = index >= maxIndex() ? 0 : index + 1;
      position();
    }, AUTOPLAY_MS);
  }

  function stopAutoplay(): void {
    if (autoplayTimer) {
      clearInterval(autoplayTimer);
      autoplayTimer = null;
    }
  }

  onMount(() => {
    mounted = true;
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = motionQuery.matches;
    const onMotionChange = (e: MediaQueryListEvent): void => {
      reduceMotion = e.matches;
      if (reduceMotion) stopAutoplay();
      else startAutoplay();
    };
    motionQuery.addEventListener('change', onMotionChange);

    measure();
    const onResize = () => measure();
    window.addEventListener('resize', onResize);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') go(-1);
      if (e.key === 'ArrowRight') go(1);
    };
    rootEl.addEventListener('keydown', onKeyDown);

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          inView = entry.isIntersecting;
          if (inView) {
            revealed = true;
            startAutoplay();
          } else {
            stopAutoplay();
          }
        }
      },
      { threshold: 0.25 }
    );
    observer.observe(rootEl);

    return () => {
      stopAutoplay();
      motionQuery.removeEventListener('change', onMotionChange);
      window.removeEventListener('resize', onResize);
      rootEl.removeEventListener('keydown', onKeyDown);
      observer.disconnect();
    };
  });
</script>

<section class:ts-revealed={revealed} class="ts-section" bind:this={rootEl} aria-roledescription="carousel" aria-label="Testimonials">
  <div class="ts-head">
    <span class="ts-label ts-reveal">TESTIMONIALS</span>
    <h2 class="ts-title ts-reveal" style="--reveal-i:1">What real students say.</h2>
    <p class="ts-desc ts-reveal" style="--reveal-i:2">
      Real 5-star reviews from the Chrome, Edge and Firefox stores, every card linked to its source.
    </p>
    <div class="ts-aggregate ts-reveal" style="--reveal-i:2">
      <span class="score">{TESTIMONIAL_AGGREGATE.score}</span>
      <span class="stars" role="img" aria-label="{TESTIMONIAL_AGGREGATE.score} out of 5 stars average">
        {#each Array(5) as _, i (i)}<svg viewBox="0 0 24 24" fill="var(--amber, #f59e0b)" style="--star-i:{i}" aria-hidden="true"><path d="M12 2l2.9 6.26L21.5 9.3l-4.75 4.4 1.15 6.8L12 17.2l-5.9 3.3 1.15-6.8L2.5 9.3l6.6-1.04L12 2z"/></svg>{/each}
      </span>
      <span class="meta">
        across {TESTIMONIAL_AGGREGATE.ratings} ratings
        <span class="stores">
          {#each TESTIMONIAL_AGGREGATE.stores as store, i (store)}
            <span class="storecount" title="{storeNames[store]}: {TESTIMONIAL_AGGREGATE.counts[store]} ratings at {TESTIMONIAL_AGGREGATE.averages[store]}">
              <svg viewBox={store === 'chrome' ? '0 0 100 100' : store === 'edge' ? '0 0 256 256' : '0 0 512 512'} width="15" height="15" role="img" aria-label={storeNames[store]} style="--star-i:{i}"><use href="#cqd-logo-{store}" /></svg>
              <b>{TESTIMONIAL_AGGREGATE.counts[store]}</b>
            </span>
          {/each}
        </span>
      </span>
    </div>
  </div>

  <div class="ts-carousel ts-reveal" style="--reveal-i:3">
    <button
      type="button"
      class="ts-arrow prev"
      use:magnetic
      aria-label="Previous testimonials"
      disabled={index === 0}
      on:click={() => go(-1)}
    >
      <span class="chev">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12l4.58-4.59z"/></svg>
      </span>
    </button>

    <div class="ts-viewport">
      <div class="ts-track" bind:this={trackEl}>
        {#each allReviews as r, i (r.name + r.date)}
          <div class="ts-slide" role="group" aria-roledescription="slide" aria-label="{i + 1} of {allReviews.length}">
            <a class="tcard" href={r.href} target="_blank" rel="noopener noreferrer">
              <span class="sheen" aria-hidden="true"></span>
              <div class="top">
                <span class="bigstars" role="img" aria-label="{r.rating} out of 5 stars">
                  {#each Array(5) as _, k (k)}<svg viewBox="0 0 24 24" fill="var(--amber, #f59e0b)" style="--star-i:{k}" aria-hidden="true"><path d="M12 2l2.9 6.26L21.5 9.3l-4.75 4.4 1.15 6.8L12 17.2l-5.9 3.3 1.15-6.8L2.5 9.3l6.6-1.04L12 2z"/></svg>{/each}
                </span>
                <span class="scorechip">
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2l2.9 6.26L21.5 9.3l-4.75 4.4 1.15 6.8L12 17.2l-5.9 3.3 1.15-6.8L2.5 9.3l6.6-1.04L12 2z"/></svg>
                  {r.rating}.0
                </span>
              </div>
              <p class="quote" dir={r.rtl ? 'rtl' : undefined} lang={r.rtl ? 'ar' : undefined}>
                <span class="q">&ldquo;</span>{r.text.replace(/\n/g, ' ')}<span class="q">&rdquo;</span>
              </p>
              {#if r.gloss}<p class="gloss">{r.gloss}</p>{/if}
              <div class="foot">
                {#if r.avatar}
                  <img class="avatar" src={r.avatar} alt="" loading="lazy" />
                {:else}
                  <span class="avatar initial" style="background:{r.initialBg}">{r.initial}</span>
                {/if}
                <span class="who">
                  <span class="name">{r.name}</span>
                  <span class="date">{r.date}{r.helpful ? ` · ${r.helpful}` : ''}</span>
                </span>
                <span class="openlink">
                  <span class="olabel">Open</span>
                  <svg class="oicon" viewBox={r.store === 'chrome' ? '0 0 100 100' : r.store === 'edge' ? '0 0 256 256' : '0 0 512 512'} width="15" height="15" role="img" aria-label={storeNames[r.store]}><use href="#cqd-logo-{r.store}" /></svg>
                </span>
              </div>
            </a>
          </div>
        {/each}
      </div>
    </div>

    <button
      type="button"
      class="ts-arrow next"
      use:magnetic
      aria-label="Next testimonials"
      disabled={index >= maxIndex()}
      on:click={() => go(1)}
    >
      <span class="chev">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L13.17 12l-4.58 4.59z"/></svg>
      </span>
    </button>
  </div>
</section>

<style>
  .ts-section {
    position: relative;
    padding: var(--space-8, 64px) 0;
    max-width: 1240px;
    margin: 0 auto;
  }
  /* section head — mirrors the overview page's .l2-section-head / .l2-label pattern */
  .ts-head { text-align: center; margin: 0 auto 48px; padding: 0 24px; }
  .ts-label {
    font-size: 12px; font-weight: 700; color: var(--gc-green);
    letter-spacing: 0.08em; text-transform: uppercase;
    display: block; margin-bottom: 12px;
  }
  .ts-title { margin: 0 0 12px; font-size: clamp(28px, 3.5vw, 42px); font-weight: 800; letter-spacing: -0.02em; color: var(--text); }
  .ts-desc { margin: 0 auto; font-size: 16px; color: var(--text-secondary); max-width: 560px; }

  /* entrance reveal */
  .ts-reveal { opacity: 0; transform: translateY(14px); transition: opacity var(--mi-slow, 320ms) var(--mi-ease, cubic-bezier(0.22, 1, 0.36, 1)), transform var(--mi-slow, 320ms) var(--mi-ease, cubic-bezier(0.22, 1, 0.36, 1)); transition-delay: calc(var(--reveal-i, 0) * 70ms); }
  .ts-revealed .ts-reveal { opacity: 1; transform: none; }

  /* aggregate strip */
  .ts-aggregate {
    display: inline-flex; align-items: center; gap: 14px; margin-top: 22px;
    padding: 13px 24px; border-radius: 999px;
    background: linear-gradient(120deg, #ffffff, #f8fcf9);
    border: 1px solid var(--border); box-shadow: var(--shadow);
    transition: box-shadow var(--mi-base, 220ms) var(--mi-spring, cubic-bezier(0.32, 1.35, 0.42, 1)), transform var(--mi-base, 220ms) var(--mi-spring, cubic-bezier(0.32, 1.35, 0.42, 1));
  }
  .ts-aggregate:hover { transform: translateY(-2px); box-shadow: var(--shadow-lg), var(--shadow-green); }
  .ts-aggregate .score { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; color: var(--text); font-variant-numeric: tabular-nums; }
  .ts-aggregate .stars { display: inline-flex; gap: 2px; }
  .ts-aggregate .stars svg { width: 17px; height: 17px; }
  .ts-aggregate .meta { font-size: 13px; color: var(--text-secondary); font-weight: 600; }
  .ts-aggregate .stores { display: inline-flex; align-items: center; gap: 10px; margin-left: 4px; padding-left: 14px; border-left: 1px solid var(--border); }
  .ts-aggregate .storecount { display: inline-flex; align-items: center; gap: 4px; }
  .ts-aggregate .storecount b { font-size: 12.5px; font-weight: 800; color: var(--text); font-variant-numeric: tabular-nums; }

  /* carousel */
  .ts-carousel { position: relative; }
  .ts-viewport { overflow: hidden; }
  .ts-track { display: flex; gap: 22px; transition: transform 560ms var(--mi-spring, cubic-bezier(0.32, 1.35, 0.42, 1)); }
  .ts-slide { flex: 0 0 calc((100% - 44px) / 3); display: flex; }
  @media (max-width: 1020px) { .ts-slide { flex-basis: calc((100% - 22px) / 2); } }
  @media (max-width: 680px) { .ts-slide { flex-basis: 100%; } }

  /* side arrows */
  .ts-arrow {
    position: absolute; top: 50%; z-index: 5;
    width: 46px; height: 46px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(120deg, #ffffff, #f8fcf9);
    border: 1px solid var(--border); box-shadow: var(--shadow);
    color: var(--gc-green-dark); cursor: pointer; padding: 0;
    transition: box-shadow var(--mi-base, 220ms) var(--mi-spring, cubic-bezier(0.32, 1.35, 0.42, 1)), opacity var(--mi-fast, 150ms) ease, background var(--mi-fast, 150ms) ease;
  }
  .ts-arrow.prev { left: -23px; }
  .ts-arrow.next { right: -23px; }
  .ts-arrow:hover:not([disabled]) { box-shadow: var(--shadow-lg), var(--shadow-green); background: #fff; }
  .ts-arrow:hover:not([disabled]) .chev { transform: translateX(calc(var(--mi-shift, 3px) * var(--dir, 1) / 2)); }
  .ts-arrow:active:not([disabled]) .chev { transform: translateX(calc(var(--mi-shift, 3px) * var(--dir, 1))) scale(0.9); }
  .ts-arrow.prev { --dir: -1; }
  .ts-arrow.next { --dir: 1; }
  .ts-arrow[disabled] { opacity: 0.35; cursor: default; }
  .ts-arrow .chev { display: flex; transition: transform var(--mi-base, 220ms) var(--mi-spring, cubic-bezier(0.32, 1.35, 0.42, 1)); }
  .ts-arrow svg { width: 20px; height: 20px; }
  @media (max-width: 760px) {
    .ts-arrow.prev { left: 8px; }
    .ts-arrow.next { right: 8px; }
    .ts-arrow { background: rgba(255, 255, 255, 0.92); }
  }

  /* F card: approved Spotlight Border */
  .tcard {
    position: relative; display: flex; flex-direction: column; gap: 14px; width: 100%;
    padding: 26px 24px 20px; border-radius: 20px; overflow: hidden;
    border: 1px solid transparent;
    background:
      linear-gradient(120deg, #ffffff, #f6fbf8) padding-box,
      linear-gradient(140deg, rgba(26, 139, 85, 0.55), rgba(66, 133, 244, 0.25) 45%, rgba(26, 139, 85, 0.1) 75%, rgba(251, 188, 4, 0.35)) border-box;
    box-shadow: var(--shadow);
    transition: transform var(--mi-base, 220ms) var(--mi-spring, cubic-bezier(0.32, 1.35, 0.42, 1)), box-shadow var(--mi-base, 220ms) var(--mi-spring, cubic-bezier(0.32, 1.35, 0.42, 1));
    text-decoration: none; color: inherit; outline-offset: 3px;
  }
  .tcard:hover { transform: translateY(-3px); box-shadow: var(--shadow-lg), var(--shadow-green); }
  .tcard:active { transform: translateY(-1px) scale(0.98); transition-duration: var(--mi-fast, 150ms); }
  .tcard .sheen {
    position: absolute; inset: -40% -20%; pointer-events: none;
    background: linear-gradient(105deg, transparent 42%, rgba(255, 255, 255, 0.55) 50%, transparent 58%);
    transform: translateX(-120%) skewX(-8deg);
  }
  .tcard:hover .sheen { animation: ts-card-sheen 900ms var(--mi-sheen, cubic-bezier(0.4, 0, 0.2, 1)) 1; }
  @keyframes ts-card-sheen { to { transform: translateX(120%) skewX(-8deg); } }
  .tcard .top { display: flex; align-items: center; justify-content: space-between; }
  .tcard .bigstars { display: flex; gap: 4px; }
  .tcard .bigstars svg { width: 22px; height: 22px; transition: transform var(--mi-base, 220ms) var(--mi-spring, cubic-bezier(0.32, 1.35, 0.42, 1)); transition-delay: calc(var(--star-i, 0) * 22ms); }
  .tcard:hover .bigstars svg { transform: scale(1.12) translateY(-1px); }
  .tcard .scorechip {
    display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; font-weight: 800;
    color: var(--amber-deep, #b45309); background: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.25); padding: 5px 11px; border-radius: 999px;
    transition: transform var(--mi-base, 220ms) var(--mi-spring, cubic-bezier(0.32, 1.35, 0.42, 1)), background var(--mi-fast, 150ms) ease;
  }
  .tcard .scorechip svg { width: 12px; height: 12px; }
  .tcard:hover .scorechip { transform: scale(1.07); background: rgba(245, 158, 11, 0.16); }
  .tcard .quote {
    margin: 0; font-size: 16.5px; line-height: 1.5; font-weight: 600; letter-spacing: -0.004em; color: var(--text);
    display: -webkit-box; -webkit-line-clamp: 4; line-clamp: 4; -webkit-box-orient: vertical; overflow: hidden;
  }
  .tcard .quote .q { color: var(--gc-green); }
  .tcard .gloss { margin: -8px 0 0; font-size: 12px; color: var(--muted); }
  .tcard .foot { margin-top: auto; display: flex; align-items: center; gap: 11px; }
  .tcard .avatar {
    width: 44px; height: 44px; border-radius: 50%; object-fit: cover; flex: none;
    transition: transform var(--mi-base, 220ms) var(--mi-spring, cubic-bezier(0.32, 1.35, 0.42, 1)), box-shadow var(--mi-base, 220ms) ease;
    box-shadow: 0 0 0 0 rgba(26, 139, 85, 0);
  }
  .tcard:hover .avatar { transform: scale(1.08); box-shadow: 0 0 0 3px rgba(26, 139, 85, 0.16); }
  .tcard .avatar.initial { display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 800; font-size: 17px; }
  .tcard .who { display: flex; flex-direction: column; min-width: 0; }
  .tcard .name { font-size: 13.5px; font-weight: 700; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .tcard .date { font-size: 11px; color: var(--muted); margin-top: 1px; }
  .tcard .openlink { margin-left: auto; font-size: 12px; font-weight: 700; color: var(--gc-green-dark); display: inline-flex; align-items: center; gap: 5px; flex: none; }
  .tcard .olabel {
    background-image: linear-gradient(var(--gc-green-dark), var(--gc-green-dark));
    background-size: 0% 1px; background-repeat: no-repeat; background-position: 0 100%;
    transition: background-size var(--mi-slow, 320ms) var(--mi-ease, cubic-bezier(0.22, 1, 0.36, 1));
  }
  .tcard:hover .olabel { background-size: 100% 1px; }
  .tcard .oicon { display: flex; transition: transform var(--mi-base, 220ms) var(--mi-spring, cubic-bezier(0.32, 1.35, 0.42, 1)); border-radius: 50%; }
  .tcard:hover .oicon { transform: translateX(var(--mi-shift, 3px)); }

  .ts-arrow:focus-visible, .tcard:focus-visible {
    outline: 2px solid var(--gc-green); outline-offset: 3px;
  }

  @media (prefers-reduced-motion: reduce) {
    .ts-reveal { opacity: 1; transform: none; transition: none; }
    .ts-track { transition: none; }
    .tcard .sheen { display: none; }
    .tcard, .tcard:hover, .tcard:active, .tcard .avatar, .tcard .scorechip, .tcard .bigstars svg,
    .ts-aggregate, .ts-arrow, .ts-arrow .chev, .tcard .olabel, .tcard .oicon {
      transition: none !important; animation: none !important; transform: none !important;
    }
  }
</style>
