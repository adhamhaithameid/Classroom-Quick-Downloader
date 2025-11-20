var commentframe=(function(){"use strict";function _(t){return t}const v=`data:image/svg+xml;utf8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <g stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 21H18" />
    <path d="M12 3V17" />
    <path d="M12 17L17 12" />
    <path d="M12 17L7 12" />
  </g>
</svg>`)}`,y=`data:image/svg+xml;utf8,${encodeURIComponent('<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M10.968 18.769C15.495 18.107 19 14.434 19 9.938a8.49 8.49 0 0 0-.216-1.912C20.718 9.178 22 11.188 22 13.475a6.1 6.1 0 0 1-1.113 3.506c.06.949.396 1.781 1.01 2.497a.43.43 0 0 1-.36.71c-1.367-.111-2.485-.426-3.354-.945A7.434 7.434 0 0 1 15 19.95a7.36 7.36 0 0 1-4.032-1.181z" fill="#ffffff"></path><path d="M7.625 16.657c.6.142 1.228.218 1.875.218 4.142 0 7.5-3.106 7.5-6.938C17 6.107 13.642 3 9.5 3 5.358 3 2 6.106 2 9.938c0 1.946.866 3.705 2.262 4.965a4.406 4.406 0 0 1-1.045 2.29.46.46 0 0 0 .386.76c1.7-.138 3.041-.57 4.022-1.296z" fill="#ffffff"></path></g></svg>')}`,f="cqd-style",b=16,S="150ms cubic-bezier(0.2, 0, 0, 1)";function E(){if(typeof document>"u"||document.getElementById(f))return;const t=document.createElement("style");t.id=f,t.textContent=`
    :root {
      --cqd-transition: ${S};
      --cqd-color-primary: #1a73e8;
      --cqd-color-success: #34a853;
      --cqd-color-error: #e05952;
      --cqd-frame-color: #6366f1;

      --cqd-shadow-base: 0 0px 10px rgba(15, 23, 42, 0.22);
      --cqd-shadow-hover: 0 10px 24px rgba(15, 23, 42, 0.30);
      --cqd-shadow-pill: 0 8px 22px rgba(15, 23, 42, 0.30);
      --cqd-shadow-success: 0 12px 28px rgba(24, 128, 56, 0.40);
      --cqd-shadow-success-strong: 0 12px 28px rgba(24, 128, 56, 0.70);
      --cqd-shadow-error: 0 12px 28px rgba(224, 89, 82, 0.40);
      --cqd-shadow-error-strong: 0 12px 28px rgba(224, 89, 82, 0.70);
    }

    /* ============================================================
     * CRITICAL OVERRIDES: Force Google Card to show the Badge
     * ============================================================ */
    div[data-stream-item-id] {
      overflow: visible !important;
      contain: none !important;
      z-index: 1;
    }

    /* ===============================
     * 1. DOWNLOAD BUTTON STYLES
     * =============================== */

    .cqd-download-btn {
      position: absolute;
      top: 50%;
      right: 8px;
      z-index: 5;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      height: 40px;
      width: 40px;
      max-width: calc(100% - 16px);
      padding: 0;
      border: none;
      border-radius: 9999px;
      background-color: var(--cqd-color-primary);
      color: #ffffff;
      box-shadow: var(--cqd-shadow-base);
      cursor: pointer;
      transform: translateY(-50%) scale(1);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
      will-change: transform, box-shadow, width, border-radius, padding-inline;
      transition:
        width var(--cqd-transition),
        padding-inline var(--cqd-transition),
        border-radius var(--cqd-transition),
        box-shadow var(--cqd-transition),
        transform var(--cqd-transition),
        background-color var(--cqd-transition);
    }

    /* Idle hover (no active state) */
    .cqd-download-btn:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover {
      width: 120px;
      padding-inline: 12px;
      box-shadow: var(--cqd-shadow-hover);
      justify-content: flex-start;
      transform: translateY(-50%) scale(1);
      border-radius: 20px;
    }

    .cqd-download-btn:focus-visible {
      outline: 2px solid #ffffff;
      outline-offset: 2px;
    }

    .cqd-download-btn:active {
      box-shadow: 0 2px 6px rgba(15, 23, 42, 0.3);
      transform: translateY(-50%) scale(0.97);
    }

    .cqd-download-btn .cqd-icon-wrapper {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .cqd-download-icon {
      display: block;
      width: 24px;
      height: 24px;
      background-image: url("${v}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 24px 24px;
      flex-shrink: 0;
      transform-origin: center;
      transition:
        width var(--cqd-transition),
        height var(--cqd-transition),
        border-width var(--cqd-transition);
    }

    .cqd-icon-small {
      width: 16px;
      height: 16px;
      background-size: 16px 16px;
    }

    .cqd-icon-medium {
      width: 24px;
      height: 24px;
      background-size: 24px 24px;
    }

    .cqd-icon-large {
      width: 32px;
      height: 32px;
      background-size: 32px 32px;
    }

    .cqd-download-btn .cqd-label {
      opacity: 0;
      margin-left: 0;
      max-width: 0;
      overflow: hidden;
      transition:
        opacity var(--cqd-transition),
        max-width var(--cqd-transition),
        margin-left var(--cqd-transition);
    }

    /* Idle hover label reveal */
    .cqd-download-btn:not(.cqd-loading):not(.cqd-trying):not(.cqd-success):not(.cqd-error):hover .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 4px;
    }

    /* ------------------------------------------------------------------
     * PILL STATES: loading, trying, success, error share pill layout
     * ------------------------------------------------------------------*/
    .cqd-download-btn.cqd-loading,
    .cqd-download-btn.cqd-trying,
    .cqd-download-btn.cqd-success,
    .cqd-download-btn.cqd-error {
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      box-shadow: var(--cqd-shadow-pill);
      cursor: default;
      width: 150px;
      transform: translateY(-50%) scale(1);
    }

    .cqd-download-btn.cqd-trying{
      width: 110px;
    }

    .cqd-download-btn.cqd-loading:active,
    .cqd-download-btn.cqd-trying:active,
    .cqd-download-btn.cqd-success:active,
    .cqd-download-btn.cqd-error:active {
      transform: translateY(-50%) scale(1);
      box-shadow: var(--cqd-shadow-pill);
    }

    /* Labels for loading / trying */
    .cqd-download-btn.cqd-loading .cqd-label,
    .cqd-download-btn.cqd-trying .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 12px;
    }

    .cqd-download-btn.cqd-loading:hover,
    .cqd-download-btn.cqd-trying:hover {
      padding-inline: 12px;
      border-radius: 20px;
      transform: translateY(-50%) scale(1);
      box-shadow: var(--cqd-shadow-pill);
    }

    /* SUCCESS STATE */
    .cqd-download-btn.cqd-success {
      width: 140px;
      background-color: var(--cqd-color-success);
      box-shadow: var(--cqd-shadow-success);
    }

    .cqd-download-btn.cqd-success .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 8px;
    }

    .cqd-download-btn.cqd-success:hover {
      width: 140px;
      transform: translateY(-50%) scale(1);
      box-shadow: var(--cqd-shadow-success-strong);
    }

    /* ERROR STATE */
    .cqd-download-btn.cqd-error {
      width: 90px;
      background-color: var(--cqd-color-error);
      box-shadow: var(--cqd-shadow-error);
      height: 40px;
      max-width: 150px;
      max-height: 40px;
      padding-top: 0;
      padding-bottom: 0;
      align-items: center;
      transition: all var(--cqd-transition);
    }

    .cqd-download-btn.cqd-error .cqd-label {
      opacity: 1;
      margin-left: 8px;
      max-width: 110px;
      overflow: hidden;
      flex: 0 0 auto;
    }

    .cqd-error-detail {
      display: block;
      font-size: 11px;
      font-weight: 500;
      line-height: 1.3;
      margin-left: 0;
      margin-top: 0;
      opacity: 0;
      max-height: 0;
      overflow: hidden;
      white-space: normal;
      transform: translateY(4px);
      transition: all var(--cqd-transition);
    }

    .cqd-download-btn.cqd-error:hover {
      width: 350px;
      max-width: 360px;
      height: 60px;
      max-height: 61px;
      padding-top: 8px;
      padding-bottom: 8px;
      border-radius: 18px;
      align-items: center;
      white-space: normal;
      gap: 7px;
      box-shadow: var(--cqd-shadow-error-strong);
    }

    .cqd-download-btn.cqd-error:hover .cqd-label {
      opacity: 0;
      max-width: 0;
      margin-left: 0;
    }

    .cqd-download-btn.cqd-error:hover .cqd-error-detail {
      opacity: 1;
      max-height: 60px;
      margin-top: 4px;
      transform: translateY(0);
    }

    /* Spinner (used for loading & trying) */
    .cqd-spinner {
      background-image: none;
      border-radius: 9999px;
      width: ${b}px;
      height: ${b}px;
      border: 3px solid rgba(255, 255, 255, 0.22);
      border-top-color: #ffffff;
      box-shadow: none;
      animation: cqd-spin 0.65s linear infinite;
    }

    @keyframes cqd-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* ===============================
     * 2. COMMENT FRAME & VERTICAL PILL BADGE
     * =============================== */

    /* The Border Frame */
    .cqd-overlay-container {
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      pointer-events: none;
      z-index: 10;
      box-sizing: border-box;
      border-radius: inherit;
      transition: all 0.2s ease;
      /* Subtle frame glow */
      box-shadow:
        inset 0 0 0 2px var(--cqd-frame-color),
        0 0 12px rgba(99, 102, 241, 0.5);
    }

    /* THE BADGE (Vertical Drop) */
    .cqd-comment-badge {
      position: absolute;
      top: 21px;
      z-index: 9999;

      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;

      width: 30px;
      height: 30px;

      background-color: var(--cqd-frame-color);
      color: #ffffff;
      border-radius: 9999px;

      cursor: pointer;
      overflow: hidden;

      transition:
        height var(--cqd-transition),
        box-shadow 0.2s ease;
    }

    /* HOVER STATE: Expands Vertically to show number */
    .cqd-comment-badge:hover {
      height: 58px;
    }

    /* LTR (Left Border) */
    body[data-cqd-dir="ltr"] .cqd-comment-badge {
      left: 0;
      transform: translateX(-50%);
    }

    /* RTL (Right Border) */
    body[data-cqd-dir="rtl"] .cqd-comment-badge {
      right: 0;
      transform: translateX(50%);
    }

    .cqd-badge-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      filter: brightness(0) invert(1);
      margin-top: 2px;
      transition: transform 0.2s ease;
    }

    .cqd-badge-label {
      display: block;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      font-weight: 700;

      opacity: 0;
      transform: translateY(-5px);

      max-height: 0;
      margin-top: 2px;
      overflow: hidden;

      transition:
        opacity 0.15s ease 0.05s,
        transform 0.15s ease 0.05s,
        max-height 0.15s ease 0.05s,
        margin-top 0.15s ease 0.05s;
    }

    .cqd-comment-badge:hover .cqd-badge-label {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;
    }
  `.trim(),(document.head||document.documentElement).appendChild(t)}const w="div[data-stream-item-id]",p="data-cqd-processed",T={matches:["https://classroom.google.com/*"],runAt:"document_idle",main(){E(),i(),new MutationObserver(e=>{requestAnimationFrame(()=>{i()})}).observe(document.body,{childList:!0,subtree:!0}),setInterval(()=>{i()},1e3);let r=location.href;new MutationObserver(()=>{const e=location.href;e!==r&&(r=e,setTimeout(i,500))}).observe(document,{subtree:!0,childList:!0})}};function i(){try{const t=C();document.body.setAttribute("data-cqd-dir",t),document.querySelectorAll(w).forEach(e=>{if(e.hasAttribute(p)){if(e.querySelector(".cqd-overlay-container"))return;e.removeAttribute(p)}if(e.parentElement?.closest(w))return;const n=((e.innerText||"")+" "+A(e)).match(/(\d+)\s+class comment/i),a=n?parseInt(n[1],10):0;a>0&&(e.setAttribute(p,"true"),I(e,a))})}catch(t){console.warn("CQD Scan Error:",t)}}function I(t,r){const e=window.getComputedStyle(t),o=e.borderRadius||"8px";e.position==="static"&&(t.style.position="relative"),t.style.setProperty("overflow","visible","important"),t.style.setProperty("contain","none","important"),t.style.zIndex="1";const n=document.createElement("div");n.className="cqd-overlay-container",n.style.borderRadius=o,n.addEventListener("click",u=>{u.target===n&&x(t)}),t.appendChild(n);const a=document.createElement("div");a.className="cqd-comment-badge",a.title=`${r} comments`;const l=document.createElement("div");l.className="cqd-badge-icon",l.style.backgroundImage=`url("${y}")`;const g=document.createElement("span");g.className="cqd-badge-label",g.textContent=`${r}`,a.appendChild(l),a.appendChild(g),a.addEventListener("click",u=>{u.stopPropagation(),x(t)}),t.appendChild(a)}function x(t){const r=t.querySelector('a[href*="/details/"], h2 a');r?r.click():t.click()}function C(){return(document.documentElement.dir||document.body.dir)==="rtl"||window.getComputedStyle(document.body).direction==="rtl"?"rtl":"ltr"}function A(t){return Array.from(t.querySelectorAll("[aria-label]")).map(r=>r.getAttribute("aria-label")||"").join(" ")}const q=globalThis.browser?.runtime?.id?globalThis.browser:globalThis.chrome;function d(t,...r){}const k={debug:(...t)=>d(console.debug,...t),log:(...t)=>d(console.log,...t),warn:(...t)=>d(console.warn,...t),error:(...t)=>d(console.error,...t)};class h extends Event{constructor(r,e){super(h.EVENT_NAME,{}),this.newUrl=r,this.oldUrl=e}static EVENT_NAME=m("wxt:locationchange")}function m(t){return`${q?.runtime?.id}:comment_frame:${t}`}function N(t){let r,e;return{run(){r==null&&(e=new URL(location.href),r=t.setInterval(()=>{let o=new URL(location.href);o.href!==e.href&&(window.dispatchEvent(new h(o,e)),e=o)},1e3))}}}class s{constructor(r,e){this.contentScriptName=r,this.options=e,this.abortController=new AbortController,this.isTopFrame?(this.listenForNewerScripts({ignoreFirstEvent:!0}),this.stopOldScripts()):this.listenForNewerScripts()}static SCRIPT_STARTED_MESSAGE_TYPE=m("wxt:content-script-started");isTopFrame=window.self===window.top;abortController;locationWatcher=N(this);receivedMessageIds=new Set;get signal(){return this.abortController.signal}abort(r){return this.abortController.abort(r)}get isInvalid(){return q.runtime.id==null&&this.notifyInvalidated(),this.signal.aborted}get isValid(){return!this.isInvalid}onInvalidated(r){return this.signal.addEventListener("abort",r),()=>this.signal.removeEventListener("abort",r)}block(){return new Promise(()=>{})}setInterval(r,e){const o=setInterval(()=>{this.isValid&&r()},e);return this.onInvalidated(()=>clearInterval(o)),o}setTimeout(r,e){const o=setTimeout(()=>{this.isValid&&r()},e);return this.onInvalidated(()=>clearTimeout(o)),o}requestAnimationFrame(r){const e=requestAnimationFrame((...o)=>{this.isValid&&r(...o)});return this.onInvalidated(()=>cancelAnimationFrame(e)),e}requestIdleCallback(r,e){const o=requestIdleCallback((...n)=>{this.signal.aborted||r(...n)},e);return this.onInvalidated(()=>cancelIdleCallback(o)),o}addEventListener(r,e,o,n){e==="wxt:locationchange"&&this.isValid&&this.locationWatcher.run(),r.addEventListener?.(e.startsWith("wxt:")?m(e):e,o,{...n,signal:this.signal})}notifyInvalidated(){this.abort("Content script context invalidated"),k.debug(`Content script "${this.contentScriptName}" context invalidated`)}stopOldScripts(){window.postMessage({type:s.SCRIPT_STARTED_MESSAGE_TYPE,contentScriptName:this.contentScriptName,messageId:Math.random().toString(36).slice(2)},"*")}verifyScriptStartedEvent(r){const e=r.data?.type===s.SCRIPT_STARTED_MESSAGE_TYPE,o=r.data?.contentScriptName===this.contentScriptName,n=!this.receivedMessageIds.has(r.data?.messageId);return e&&o&&n}listenForNewerScripts(r){let e=!0;const o=n=>{if(this.verifyScriptStartedEvent(n)){this.receivedMessageIds.add(n.data.messageId);const a=e;if(e=!1,a&&r?.ignoreFirstEvent)return;this.notifyInvalidated()}};addEventListener("message",o),this.onInvalidated(()=>removeEventListener("message",o))}}function D(){}function c(t,...r){}const R={debug:(...t)=>c(console.debug,...t),log:(...t)=>c(console.log,...t),warn:(...t)=>c(console.warn,...t),error:(...t)=>c(console.error,...t)};return(async()=>{try{const{main:t,...r}=T,e=new s("comment_frame",r);return await t(e)}catch(t){throw R.error('The content script "comment_frame" crashed on startup!',t),t}})()})();
commentframe;