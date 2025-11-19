var commentframe = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const DOWNLOAD_ICON_SVG_RAW = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none">
  <g stroke="#FFFFFF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M6 21H18" />
    <path d="M12 3V17" />
    <path d="M12 17L17 12" />
    <path d="M12 17L7 12" />
  </g>
</svg>`;
  const DOWNLOAD_ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    DOWNLOAD_ICON_SVG_RAW
  )}`;
  const COMMENT_ICON_SVG_RAW = `<svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" stroke="#ffffff"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"><path d="M10.968 18.769C15.495 18.107 19 14.434 19 9.938a8.49 8.49 0 0 0-.216-1.912C20.718 9.178 22 11.188 22 13.475a6.1 6.1 0 0 1-1.113 3.506c.06.949.396 1.781 1.01 2.497a.43.43 0 0 1-.36.71c-1.367-.111-2.485-.426-3.354-.945A7.434 7.434 0 0 1 15 19.95a7.36 7.36 0 0 1-4.032-1.181z" fill="#ffffff"></path><path d="M7.625 16.657c.6.142 1.228.218 1.875.218 4.142 0 7.5-3.106 7.5-6.938C17 6.107 13.642 3 9.5 3 5.358 3 2 6.106 2 9.938c0 1.946.866 3.705 2.262 4.965a4.406 4.406 0 0 1-1.045 2.29.46.46 0 0 0 .386.76c1.7-.138 3.041-.57 4.022-1.296z" fill="#ffffff"></path></g></svg>`;
  const COMMENT_ICON_URL = `data:image/svg+xml;utf8,${encodeURIComponent(
    COMMENT_ICON_SVG_RAW
  )}`;
  const STYLE_ID = "cqd-style";
  const SPINNER_SIZE_PX = 16;
  const TRANSITION_MS = 150;
  const TRANSITION_STR = `${TRANSITION_MS}ms cubic-bezier(0.2, 0, 0, 1)`;
  function injectStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    :root {
      --cqd-transition: ${TRANSITION_STR};
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
     * 1. EXISTING DOWNLOAD BUTTON STYLES (Unchanged)
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
      transition: width var(--cqd-transition), padding-inline var(--cqd-transition), border-radius var(--cqd-transition), box-shadow var(--cqd-transition), transform var(--cqd-transition), background-color var(--cqd-transition);
    }
    .cqd-download-btn:not(.cqd-loading):not(.cqd-success):not(.cqd-error):hover {
      width: 120px; padding-inline: 12px; box-shadow: var(--cqd-shadow-hover); justify-content: flex-start; transform: translateY(-50%) scale(1); border-radius: 20px;
    }
    .cqd-download-btn:focus-visible { outline: 2px solid #ffffff; outline-offset: 2px; }
    .cqd-download-btn:active { box-shadow: 0 2px 6px rgba(15, 23, 42, 0.3); transform: translateY(-50%) scale(0.97); }
    .cqd-download-btn .cqd-icon-wrapper { display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .cqd-download-icon {
      display: block; width: 24px; height: 24px; background-image: url("${DOWNLOAD_ICON_SVG_URL}"); background-repeat: no-repeat; background-position: center; background-size: 24px 24px; flex-shrink: 0; transform-origin: center;
      transition: width var(--cqd-transition), height var(--cqd-transition), border-width var(--cqd-transition);
    }
    .cqd-icon-small { width: 16px; height: 16px; background-size: 16px 16px; }
    .cqd-icon-medium { width: 24px; height: 24px; background-size: 24px 24px; }
    .cqd-icon-large { width: 32px; height: 32px; background-size: 32px 32px; }
    .cqd-download-btn .cqd-label { opacity: 0; margin-left: 0; max-width: 0; overflow: hidden; transition: opacity var(--cqd-transition), max-width var(--cqd-transition), margin-left var(--cqd-transition); }
    .cqd-download-btn:not(.cqd-loading):not(.cqd-error):not(.cqd-success):hover .cqd-label { opacity: 1; max-width: 110px; margin-left: 4px; }
    .cqd-download-btn.cqd-loading, .cqd-download-btn.cqd-success, .cqd-download-btn.cqd-error { padding-inline: 12px; border-radius: 20px; justify-content: flex-start; box-shadow: var(--cqd-shadow-pill); cursor: default; width: 150px; transform: translateY(-50%) scale(1); }
    .cqd-download-btn.cqd-loading:active, .cqd-download-btn.cqd-success:active, .cqd-download-btn.cqd-error:active { transform: translateY(-50%) scale(1); box-shadow: var(--cqd-shadow-pill); }
    .cqd-download-btn.cqd-loading .cqd-label { opacity: 1; max-width: 110px; margin-left: 12px; }
    .cqd-download-btn.cqd-loading:hover { padding-inline: 12px; border-radius: 20px; transform: translateY(-50%) scale(1); box-shadow: var(--cqd-shadow-pill); }
    .cqd-download-btn.cqd-success { width: 140px; background-color: var(--cqd-color-success); box-shadow: var(--cqd-shadow-success); }
    .cqd-download-btn.cqd-success .cqd-label { opacity: 1; max-width: 110px; margin-left: 8px; }
    .cqd-download-btn.cqd-success:hover { width: 140px; transform: translateY(-50%) scale(1); box-shadow: var(--cqd-shadow-success-strong); }
    .cqd-download-btn.cqd-error { width: 90px; background-color: var(--cqd-color-error); box-shadow: var(--cqd-shadow-error); height: 40px; max-width: 150px; max-height: 40px; padding-top: 0; padding-bottom: 0; align-items: center; transition: all var(--cqd-transition); }
    .cqd-download-btn.cqd-error .cqd-label { opacity: 1; margin-left: 8px; max-width: 110px; overflow: hidden; flex: 0 0 auto; }
    .cqd-error-detail { display: block; font-size: 11px; font-weight: 500; line-height: 1.3; margin-left: 0; margin-top: 0; opacity: 0; max-height: 0; overflow: hidden; white-space: normal; transform: translateY(4px); transition: all var(--cqd-transition); }
    .cqd-download-btn.cqd-error:hover { width: 350px; max-width: 360px; height: 60px; max-height: 61px; padding-top: 8px; padding-bottom: 8px; border-radius: 18px; align-items: center; white-space: normal; gap: 7px; box-shadow: var(--cqd-shadow-error-strong); }
    .cqd-download-btn.cqd-error:hover .cqd-label { opacity: 0; max-width: 0; margin-left: 0; }
    .cqd-download-btn.cqd-error:hover .cqd-error-detail { opacity: 1; max-height: 60px; margin-top: 4px; transform: translateY(0); }
    .cqd-spinner { background-image: none; border-radius: 9999px; width: ${SPINNER_SIZE_PX}px; height: ${SPINNER_SIZE_PX}px; border: 3px solid rgba(255, 255, 255, 0.22); border-top-color: #ffffff; box-shadow: none; animation: cqd-spin 0.65s linear infinite; }
    @keyframes cqd-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

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
      box-shadow: inset 0 0 0 2px var(--cqd-frame-color), 0 0 12px rgba(99, 102, 241, 0.5);
    }
    
    /* THE BADGE (Vertical Drop) */
    .cqd-comment-badge {
      position: absolute;
      top: 21px; 
      z-index: 9999; /* Always on top */

      display: flex;
      /* VERTICAL STACKING */
      flex-direction: column; 
      align-items: center;
      justify-content: center;
      
      /* Dimensions */
      width: 30px;      
      height: 30px;
      
      background-color: var(--cqd-frame-color);
      color: #ffffff;
      border-radius: 9999px;
      
      cursor: pointer;
      overflow: hidden;
      
      /* Animate Height */
      transition: 
        height var(--cqd-transition),
        box-shadow 0.2s ease;
    }

    /* HOVER STATE: Expands Vertically to show number */
    .cqd-comment-badge:hover {
      height: 58px; /* Enough space for Icon + Number */
    }

    /* --- ATTACHMENT LOGIC (Centering on the border) --- */

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

    /* ICON */
    .cqd-badge-icon {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      background-size: contain;
      background-repeat: no-repeat;
      background-position: center;
      filter: brightness(0) invert(1);
      
      margin-top: 2px;

      /* Ensure icon stays put during transition */
      transition: transform 0.2s ease;
    }

    /* LABEL (The Number) */
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
    
    /* Reveal Number on Hover */
    .cqd-comment-badge:hover .cqd-badge-label {
      opacity: 1;
      transform: translateY(0);
      max-height: 20px;   /* enough for one line of text */
    }
  `.trim();
    (document.head || document.documentElement).appendChild(style);
  }
  const POST_SELECTOR = "div[data-stream-item-id]";
  const PROCESSED_ATTR = "data-cqd-processed";
  const definition = defineContentScript({
    matches: ["https://classroom.google.com/*"],
    runAt: "document_idle",
    main() {
      injectStyles();
      scanForComments();
      const observer = new MutationObserver((mutations) => {
        requestAnimationFrame(() => {
          scanForComments();
        });
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true
      });
      setInterval(() => {
        scanForComments();
      }, 1e3);
      let lastUrl = location.href;
      new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
          lastUrl = url;
          setTimeout(scanForComments, 500);
        }
      }).observe(document, { subtree: true, childList: true });
    }
  });
  function scanForComments() {
    try {
      const direction = getPageDirection();
      document.body.setAttribute("data-cqd-dir", direction);
      const posts = document.querySelectorAll(POST_SELECTOR);
      posts.forEach((post) => {
        if (post.hasAttribute(PROCESSED_ATTR)) {
          const existingOverlay = post.querySelector(".cqd-overlay-container");
          if (existingOverlay) {
            return;
          }
          post.removeAttribute(PROCESSED_ATTR);
        }
        if (post.parentElement?.closest(POST_SELECTOR)) return;
        const rawText = (post.innerText || "") + " " + getAriaLabels(post);
        const match = rawText.match(/(\d+)\s+class comment/i);
        const count = match ? parseInt(match[1], 10) : 0;
        if (count > 0) {
          post.setAttribute(PROCESSED_ATTR, "true");
          createOverlay(post, count);
        }
      });
    } catch (err) {
      console.warn("CQD Scan Error:", err);
    }
  }
  function createOverlay(post, count) {
    const computed = window.getComputedStyle(post);
    const borderRadius = computed.borderRadius || "8px";
    if (computed.position === "static") {
      post.style.position = "relative";
    }
    post.style.setProperty("overflow", "visible", "important");
    post.style.setProperty("contain", "none", "important");
    post.style.zIndex = "1";
    const overlay = document.createElement("div");
    overlay.className = "cqd-overlay-container";
    overlay.style.borderRadius = borderRadius;
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) triggerPostClick(post);
    });
    post.appendChild(overlay);
    const badge = document.createElement("div");
    badge.className = "cqd-comment-badge";
    badge.title = `${count} comments`;
    const iconDiv = document.createElement("div");
    iconDiv.className = "cqd-badge-icon";
    iconDiv.style.backgroundImage = `url("${COMMENT_ICON_URL}")`;
    const labelDiv = document.createElement("span");
    labelDiv.className = "cqd-badge-label";
    labelDiv.textContent = `${count}`;
    badge.appendChild(iconDiv);
    badge.appendChild(labelDiv);
    badge.addEventListener("click", (e) => {
      e.stopPropagation();
      triggerPostClick(post);
    });
    post.appendChild(badge);
  }
  function triggerPostClick(post) {
    const titleLink = post.querySelector('a[href*="/details/"], h2 a');
    if (titleLink) {
      titleLink.click();
    } else {
      post.click();
    }
  }
  function getPageDirection() {
    const docDir = document.documentElement.dir || document.body.dir;
    if (docDir === "rtl") return "rtl";
    const computed = window.getComputedStyle(document.body).direction;
    return computed === "rtl" ? "rtl" : "ltr";
  }
  function getAriaLabels(el) {
    return Array.from(el.querySelectorAll("[aria-label]")).map((node) => node.getAttribute("aria-label") || "").join(" ");
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  function print$1(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger$1 = {
    debug: (...args) => print$1(console.debug, ...args),
    log: (...args) => print$1(console.log, ...args),
    warn: (...args) => print$1(console.warn, ...args),
    error: (...args) => print$1(console.error, ...args)
  };
  class WxtLocationChangeEvent extends Event {
    constructor(newUrl, oldUrl) {
      super(WxtLocationChangeEvent.EVENT_NAME, {});
      this.newUrl = newUrl;
      this.oldUrl = oldUrl;
    }
    static EVENT_NAME = getUniqueEventName("wxt:locationchange");
  }
  function getUniqueEventName(eventName) {
    return `${browser?.runtime?.id}:${"comment_frame"}:${eventName}`;
  }
  function createLocationWatcher(ctx) {
    let interval;
    let oldUrl;
    return {
      /**
       * Ensure the location watcher is actively looking for URL changes. If it's already watching,
       * this is a noop.
       */
      run() {
        if (interval != null) return;
        oldUrl = new URL(location.href);
        interval = ctx.setInterval(() => {
          let newUrl = new URL(location.href);
          if (newUrl.href !== oldUrl.href) {
            window.dispatchEvent(new WxtLocationChangeEvent(newUrl, oldUrl));
            oldUrl = newUrl;
          }
        }, 1e3);
      }
    };
  }
  class ContentScriptContext {
    constructor(contentScriptName, options) {
      this.contentScriptName = contentScriptName;
      this.options = options;
      this.abortController = new AbortController();
      if (this.isTopFrame) {
        this.listenForNewerScripts({ ignoreFirstEvent: true });
        this.stopOldScripts();
      } else {
        this.listenForNewerScripts();
      }
    }
    static SCRIPT_STARTED_MESSAGE_TYPE = getUniqueEventName(
      "wxt:content-script-started"
    );
    isTopFrame = window.self === window.top;
    abortController;
    locationWatcher = createLocationWatcher(this);
    receivedMessageIds = /* @__PURE__ */ new Set();
    get signal() {
      return this.abortController.signal;
    }
    abort(reason) {
      return this.abortController.abort(reason);
    }
    get isInvalid() {
      if (browser.runtime.id == null) {
        this.notifyInvalidated();
      }
      return this.signal.aborted;
    }
    get isValid() {
      return !this.isInvalid;
    }
    /**
     * Add a listener that is called when the content script's context is invalidated.
     *
     * @returns A function to remove the listener.
     *
     * @example
     * browser.runtime.onMessage.addListener(cb);
     * const removeInvalidatedListener = ctx.onInvalidated(() => {
     *   browser.runtime.onMessage.removeListener(cb);
     * })
     * // ...
     * removeInvalidatedListener();
     */
    onInvalidated(cb) {
      this.signal.addEventListener("abort", cb);
      return () => this.signal.removeEventListener("abort", cb);
    }
    /**
     * Return a promise that never resolves. Useful if you have an async function that shouldn't run
     * after the context is expired.
     *
     * @example
     * const getValueFromStorage = async () => {
     *   if (ctx.isInvalid) return ctx.block();
     *
     *   // ...
     * }
     */
    block() {
      return new Promise(() => {
      });
    }
    /**
     * Wrapper around `window.setInterval` that automatically clears the interval when invalidated.
     *
     * Intervals can be cleared by calling the normal `clearInterval` function.
     */
    setInterval(handler, timeout) {
      const id = setInterval(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearInterval(id));
      return id;
    }
    /**
     * Wrapper around `window.setTimeout` that automatically clears the interval when invalidated.
     *
     * Timeouts can be cleared by calling the normal `setTimeout` function.
     */
    setTimeout(handler, timeout) {
      const id = setTimeout(() => {
        if (this.isValid) handler();
      }, timeout);
      this.onInvalidated(() => clearTimeout(id));
      return id;
    }
    /**
     * Wrapper around `window.requestAnimationFrame` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelAnimationFrame` function.
     */
    requestAnimationFrame(callback) {
      const id = requestAnimationFrame((...args) => {
        if (this.isValid) callback(...args);
      });
      this.onInvalidated(() => cancelAnimationFrame(id));
      return id;
    }
    /**
     * Wrapper around `window.requestIdleCallback` that automatically cancels the request when
     * invalidated.
     *
     * Callbacks can be canceled by calling the normal `cancelIdleCallback` function.
     */
    requestIdleCallback(callback, options) {
      const id = requestIdleCallback((...args) => {
        if (!this.signal.aborted) callback(...args);
      }, options);
      this.onInvalidated(() => cancelIdleCallback(id));
      return id;
    }
    addEventListener(target, type, handler, options) {
      if (type === "wxt:locationchange") {
        if (this.isValid) this.locationWatcher.run();
      }
      target.addEventListener?.(
        type.startsWith("wxt:") ? getUniqueEventName(type) : type,
        handler,
        {
          ...options,
          signal: this.signal
        }
      );
    }
    /**
     * @internal
     * Abort the abort controller and execute all `onInvalidated` listeners.
     */
    notifyInvalidated() {
      this.abort("Content script context invalidated");
      logger$1.debug(
        `Content script "${this.contentScriptName}" context invalidated`
      );
    }
    stopOldScripts() {
      window.postMessage(
        {
          type: ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE,
          contentScriptName: this.contentScriptName,
          messageId: Math.random().toString(36).slice(2)
        },
        "*"
      );
    }
    verifyScriptStartedEvent(event) {
      const isScriptStartedEvent = event.data?.type === ContentScriptContext.SCRIPT_STARTED_MESSAGE_TYPE;
      const isSameContentScript = event.data?.contentScriptName === this.contentScriptName;
      const isNotDuplicate = !this.receivedMessageIds.has(event.data?.messageId);
      return isScriptStartedEvent && isSameContentScript && isNotDuplicate;
    }
    listenForNewerScripts(options) {
      let isFirst = true;
      const cb = (event) => {
        if (this.verifyScriptStartedEvent(event)) {
          this.receivedMessageIds.add(event.data.messageId);
          const wasFirst = isFirst;
          isFirst = false;
          if (wasFirst && options?.ignoreFirstEvent) return;
          this.notifyInvalidated();
        }
      };
      addEventListener("message", cb);
      this.onInvalidated(() => removeEventListener("message", cb));
    }
  }
  function initPlugins() {
  }
  function print(method, ...args) {
    if (typeof args[0] === "string") {
      const message = args.shift();
      method(`[wxt] ${message}`, ...args);
    } else {
      method("[wxt]", ...args);
    }
  }
  const logger = {
    debug: (...args) => print(console.debug, ...args),
    log: (...args) => print(console.log, ...args),
    warn: (...args) => print(console.warn, ...args),
    error: (...args) => print(console.error, ...args)
  };
  const result = (async () => {
    try {
      initPlugins();
      const { main, ...options } = definition;
      const ctx = new ContentScriptContext("comment_frame", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"comment_frame"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbWVudF9mcmFtZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50L2ljb25zLnRzIiwiLi4vLi4vLi4vZW50cnlwb2ludHMvY29udGVudC9zdHlsZXMudHMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb21tZW50X2ZyYW1lLmNvbnRlbnQudHMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHd4dC1kZXYrYnJvd3NlckAwLjEuNC9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L2Jyb3dzZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvY3VzdG9tLWV2ZW50cy5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanMiLCIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvY29udGVudC1zY3JpcHQtY29udGV4dC5tanMiXSwic291cmNlc0NvbnRlbnQiOlsiZXhwb3J0IGZ1bmN0aW9uIGRlZmluZUNvbnRlbnRTY3JpcHQoZGVmaW5pdGlvbikge1xuICByZXR1cm4gZGVmaW5pdGlvbjtcbn1cbiIsIi8vIGVudHJ5cG9pbnRzL2ljb25zLnRzXG5cbi8vIFJhdyBTVkdzXG5leHBvcnQgY29uc3QgRE9XTkxPQURfSUNPTl9TVkdfUkFXID0gYDxzdmcgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiPlxuICA8ZyBzdHJva2U9XCIjRkZGRkZGXCIgc3Ryb2tlLXdpZHRoPVwiMlwiIHN0cm9rZS1saW5lY2FwPVwicm91bmRcIiBzdHJva2UtbGluZWpvaW49XCJyb3VuZFwiPlxuICAgIDxwYXRoIGQ9XCJNNiAyMUgxOFwiIC8+XG4gICAgPHBhdGggZD1cIk0xMiAzVjE3XCIgLz5cbiAgICA8cGF0aCBkPVwiTTEyIDE3TDE3IDEyXCIgLz5cbiAgICA8cGF0aCBkPVwiTTEyIDE3TDcgMTJcIiAvPlxuICA8L2c+XG48L3N2Zz5gO1xuXG5leHBvcnQgY29uc3QgU1VDQ0VTU19JQ09OX1NWR19SQVcgPSBgPHN2ZyB3aWR0aD1cIjE2MFwiIGhlaWdodD1cIjE2MFwiIHZpZXdCb3g9XCIwIDAgMTYwIDE2MFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiIHhtbG5zOnhsaW5rPVwiaHR0cDovL3d3dy53My5vcmcvMTk5OS94bGlua1wiPlxuPHJlY3Qgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiBmaWxsPVwidXJsKCNwYXR0ZXJuMF8xXzI0ODQpXCIvPlxuPGRlZnM+XG48cGF0dGVybiBpZD1cInBhdHRlcm4wXzFfMjQ4NFwiIHBhdHRlcm5Db250ZW50VW5pdHM9XCJvYmplY3RCb3VuZGluZ0JveFwiIHdpZHRoPVwiMVwiIGhlaWdodD1cIjFcIj5cbjx1c2UgeGxpbms6aHJlZj1cIiNpbWFnZTBfMV8yNDg0XCIgdHJhbnNmb3JtPVwic2NhbGUoMC4wMDYyNSlcIi8+XG48L3BhdHRlcm4+XG48aW1hZ2UgaWQ9XCJpbWFnZTBfMV8yNDg0XCIgd2lkdGg9XCIxNjBcIiBoZWlnaHQ9XCIxNjBcIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwibm9uZVwiIHhsaW5rOmhyZWY9XCJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUtBQUFBQ2dDQVlBQUFDTHoyY3RBQUFnQUVsRVFWUjRBZTJkQ1hoVjViWDMxMG5JU01oNGhpU29WMnRyaGNvRGF1bDNhd3Y2VmF2WDF0VDJGclZlKy9XMjk3YjNYdTBWZWorMTBlc1U1bEVJUXhKbUVJaGxrRGxrbmdkQ0VpU01BaUt6UmZCVzhHdXJGV3Y5ZjgvLzNmdE5OakZJaG4xT1RzTGV6N055akp5Y3ZkLzEvKzIxM3JYMnUvY1JDY1NXSWVIeWd1OEd5ZkRkSXk5NW5nekpjR2U3TXR5YlhCbStTbGVHZDRjcnc3dlROZGJYNU1wb1kveC9qblhmQiszNWxUNVh2cWNHN2szVVJGNzBqSmFYdk44MXRKTHdRS0RodjMwOEc1Y2dMM252QzNuWk05NzFzcWZBbGVFOTZScnIvWXRybkErdThhWk44TUkxd1FmWHhNdllKQjljam5YZkI1ZnpMMzFQRGJRZTFHYXM5Mk9sMWN1ZUFtcEhEWVZhOXBydHhhVGhRdWd5UEUydXNkNkxydkdFekF2WFJDOWNrNzF3VGZIQk5kVzBhVDY0dEUzM3dhVnRoZyt1dHFiL3pYbHQ5ZE1YK2FLdC8vaTc5ZjNhNzN6VmVsQWJha1N0RkpoZUFubVJXbEpUb2JaQnU3M2t1MXN5dkt0a3JQZDlHZStGVFBSQ0puc2hVN3lRYVQ3SWRCOWtoZy95aWc4eTB3ZVpsUXpKVEliTTlrRm04OVcwT2NrUXgvem5BKzFuOWVvek5LQVcxSVRhVUNOcVJjMm9IVFdrbHRTVTJsSmphaDAwMjR1ZVd5WERzMXpHZWorVUNUeGdIcmc1Z0JrY21BWXRHVEkzR1RJdkJaS1ZBc2xPZ2VTa1FPYTNzUVVwa0xhMk1CWGlXT2Q5ME5hUC9MMnR2NmtEalpwUUcycEVPQmtjcUIwMVZERDZERzJwTWJXbTV0Uyt4N1lNVDR5ODdIbFd4bnJlTWNCanBQTWFaeERQSmc2Q2tTd3J1UlcwaFNtUVJTbVFKU21RcGJSVXlMSlV5SEtyRFlTODZwaGZmTEI4NEtXK3B1K3BBYldnSnRTR0doRlNCZ2RxUncycEpUVmxkS1RHaklvS1JNODdpb0hmdWdjRWxrT1NQOVpUS09NOXhzRW84THlRV1Q3SUhKOEpYYklSeVJhYnNDMUxnYnlhQ2xtUkNsbVpBbG5wZzZ6MFFGWW1RVlltUUZiR0c3WXFBZUtZLzN5Zy9FeC8wK2g3YWtBdFVneHRxQkcxSXBUVWpsRXp4d3drMUpZYXp6Q0REVUVrQTJRaFlORXd3LzBUR2VjNXJ1WUZVeG54TkhqSmtHd1RPaFhsektoRzRISUhRbktUSWJsdVNHNEM1SGR1OUZ0M0RlSTIzWXhyOG03SFZ3dS9qU0hGL3h2RFNyN2pXQUI4TUtUNExueTE0RnZLOTlTQVdsQVRwWTNTaUZvTk5JQmtkbHFTYWtSSHdraU5HUlUxaUdTQWMwUXlRVGI4dW8zMVBpUGpQUitxRU15b3g3Q3MweXdQam1jTXd6cWhXelVROGp1YUYvSzdSTWc2SHp4YmI4SHc4dnZ4VU9PLzQ3LzJ2WXh4aHpJeDgrMkZtSGQ4T2VhZldJV0ZKM01kQzRBUDZHdjZuTDZuQnRUaTRjYi9VTnBRSTJxbE5GUGFEVFMwcEtiVVZrZEZuWjdKZ0U3TFpJT00rR1hMY0krVkNSNmpNbUxVeS9SQzV2bU04TXlJeDVETjhMMHExUUJ2alEreUpnR1JtNjdIYmVYZnhiODAvMTlNT2pJWEMwK3V3dkozMWlwYmVubzFGcDErRFF0UHJjSUN4d0xxZzRXblZ5bmZVd09seCttMVNodHFSSzJvR2JXamhrSXRHVXlvTFRXbTF0U2NxWmtNa0FVeXdhcVpqSkFWVzdlMjhMRjFrdVdETEVnMkpxK3ZwbGpBUzFFSEhiSHBPdHhSL1FDZVBqQVcyU2RmeGRKM1ZvT0R6anE1REhOUExzRWMycWtsbUh0cXFXTTk2QU5xUUMyb0NiV2hSdFNLbWxFN2FrZ3REUkJUTENDYWhRc1pJQXRrd2k4UWpuTS9MUk05RU9iNlY3eVEyVjVqSHNCcWlaTlZUbDVmUzRXc0hRaFo2NFdzOTJCUTJRaU0zditpR3NUQzB5dlZBR2VkWEloV1c0UlpKeGRoMWluSGdzSUgxRUpacTBhRWt0b1JSR3BKVGFtdDBwaGFVM05xVHdiSUF1ZUdaSU9NcUhraGl4UDNVOTBMaEJtZVVUTFIvWkZNOVJnZlBNY0x5ZkZCRmlWRGxqUHFwVUJXcDBMV3BVSmVUMFQvcmRmandjWi94b3hqT2NnNTlTcG1ubGlBNlNkeU1QMWtEbWJRVGwzR1R1ZGdobU9COThIbDlEaHBhRWJ0cUNHMXBLYlVsaHBUYTZVNXRTY0RaSUZNa0EweW9pRDBRTEV6MXZOUTF5QWM1eDBxRTl5bld1Q2JhOEszT0JueUtxc2twbHFDbHdKWm40aVVvaUY0ZkYrNkN1VXpUK1JneXZHNW1ISmlMcWFjdE5pcHVaaGl0ZE56TWFYRjVtSEthY2NDNXdPTDc2MmE4TCt0bWxIRDQzTkJUWm1tcVRHMWx2VUpodlprZ0N5UUNiSkJDTWxLSzRTbmhTeDFhbU9UZVlLbldLYTZJVE85QnRYemZjWU91S1BYVWlCclV5RWJVaUFiRTNGaitmL0NidytOeDZ5VEN6RHBlQ1ltSEorRkNTY3lNZUdreFU1bFlrSmJPNTJKQ1ZacisrL083NS8zbVIwK3NmcWMvOTNlWjFxMW81YkhaeWx0cWZGdkQ0M0RsOHEvb2JSWERKQUZNcUVoSkN1TWhHU0hESkVsTXRYaGJYeFN1a3h4WDVwMld5SWY1M3NtZkpzUzhaV0t2OGV6aHlkZzJvbDV5RGcySFJuSHB5UGpoR2tuWnlCRDI2a1p5SENzOS9oQTY4WlhyU2UxUFRaZGFVM05xYjFzU2pRQ0VabklaWlZzaVlRNkhaT2xDVW5QZG95L2NiNGhNc2w5VG1aNHpJS2pUZVRqZkc5akttUlRFcTRydngxUEhjN0F4T096OFB6UnlYamgyR1M4Y0h3eVhqZ3hwZFZPVHNFTFZqdlY1bmY5Yi96L2pnWE9COXJ2MXRmMnRMRnFTVzJQVFZaYVUzTnFUd2JJZ21LQ2JGZ2pZVGFyWTdab1BGQk1rYTB2M0RJa1JNWjdYcFZwSHFPM3cvSmFGUnptbkkrVWJ4d0kyZXhHWXZFZy9QdUJaOVFaa2Y3MmVLUWZIWS8wWTZZZG40QjBiU2NtSUYzYnlRbElwK25mbmRmZzhrVjcrbWdkK2FyMXBkWnZqMWZha3dHeVFDWVVHeW9Tc2pCSk50Z2hRK3dUa2lteVJjWXV1MDN3akpRcDdvOWtwZ2N5end0WjRJTXM4MEZXSlVQV3BFQTJwRUkyZXhGZWNBMSszUHl2ZVBIdHlYanF5RXQ0NnUyWDhOVFJsL0RVc1pjTk8vNFNubktzNy9sQTYwdXRxZm1SbHhRRFpJRk1rQTNGQ0ZraE0yU0hESkVsTWtXMnlGaTdHOG1jNUY0bE05eVEyUjdJZkM5a0NTOVNKME5XczlKTmdXeEpnZVM1OFkwZDkrT1pJeGtZODliekdIM2tPWXgrK3ptTVB2cmZoaDM3YjR4MnJPLzZRT3RNelk4OHB4Z2dDMlNDYkNoR3lBcVpJVHRraUN5UktiSkZ4dHFOZ2hQZHQ4a1U5d1daNVliTTgwQVcrU0RMZlpEWGtpSHJVaUNiVWlCYjNmQ1czNEpmdmZrYmpIN3JPVHgrK0drOC90WXplUHpJTTNqOGJZc2RmUWFQTzliM2ZHRFZtSnBUKzhOUEt4YklCTmtnSTRvVk1rTjJ5QkJaSWxOa2k0eVJ0Yzl0azVJbXluUTNaSTRIa3VPQkxHWHE1ZlhjWktQSzJlSkRTSDR5N3RrNUN2OTU2TGY0NWNFeCtPWGgzK0NYYjVsMjVEZjRwV05YancrMDdtVGc0QmpGQk5rZ0k3TEZaekJEZHNnUVdTSlRaSXVNa2JWTHRzbHhDVEkxc1ZsbXVpRlpqSDVleUt0Y3hlS0R2SjRNMld5azNtc3FoK0huKzMrTlg3ejVuL2pad1Nmd3M4TVdlK3NKL015eHE4Y0hWdTBQUHFHWUlCdGtSS1ZpTWtOMnlCQlpJbE5raTR5Uk5UTFhzazFPdkZlbUozMGlzOTJRK1l4K1hzZ3FyN0VLWW1NeVpLc1ByZ0lmUmphbHFSMDlldUJYZVBUZ3YrSFJRNllkL2pjODZ0alY1d090UDFrNDhDdkZCaGtoSzJSR3lBNVgwcEFsTWtXMnlOajBwTDhLbVd2WnBpU05sMWVTakR5OTBITnA5R1Boc2MyTnhQS2I4YU05UDhNakIvNFZvdzc4SEtNTy9zS3dRNy9BS01ldVhoOW9EZzc4WExGQlJzZ0ttVkVGaVRVS2tpM09CY2thbVZQYkFnbVRhVW5Ga3BrRXlmWkFsbkNKdG81K1BraGVNaVRmalVIYnY0V0g5djBjRCs1N0RBOGVvUDBVRDc3NVV6eDQwTEdyMmdka2dDeVFpWDJQS1ViSUNwbFI3R3hrSGNGdUNyc3FIb014c2tibXlKNU1qN3RCcGllZWtybHV5QUkzWkprSDhwb1g4cm9Qc2prWnNzMkwwT0pVM05GMFAzNnc5NTl3Lzc2SGNmLytSM0QvQWNkNjBnZmZPL0FJL0dWZEdoZVoyUGV3WW9Tc2tCbXlveGdpUzJTS2JKRXhza2JteUo1TVM3eFhaaVorSWxsdXlDSTNaSVVic3BvTlJlWnhJL3JGbGQrSTcreDZFUGZ0K1RIdTJmc2ozTFB2SDNIUGZzZDYwZ2QzSC9naDdqeVVacHVOUEpTR2I3LzVmZHkxL3dmNGJsZTBKUk43ZjZRWUlTdGtSa1ZCTWtTV3lCVFpJbU5ramN5UlBabVc5S1JrSmtKeWtpQkwzSkJWSHNnYUwyU2pGNUxuZ3hRbUliWDZGbnluK1FlNGEzY2E3dHlUaGp2M3B1SE9mWTcxaEEvdTJwZUdrZnNmd0oxN0g4QUQ5WThncmVZbmVLRDJFYVIxd3g2b2VSamZxM2tJRHpYOEhEL2E5Mzh3Y3YvM082OHZtZGlUcGhnaEsyU0c3Q2lHeUJLWklsdGtqS3lST2JJbjA1T3laSFlpWkg0aVpCbnZqUEpBWHZkQ05ubU5FRnJrd1ExMXQyUGtydS9oanViN2NNZnUrM0RIbnZ0d3gxN0hlc1lILzREYkR0eUZ4NnAraFp6Rk9jaGFsSVBzcGRuSVhzclh6bHZXa216a0xGdUExemV0UjkzT2V2ekgvdi9Dclh2djdMeStaSUpzTk4rSE8zZDlUekVqUlI2REliSkVwc2dXR1NOclpHNUd3anlSVnhJMnlweEV5TUpFeUhLM2NYc2VsMTV2OFVMeVBaQmlIMjZxL3dhK3VldTdHTDdyYmd4dnZodkRkOStONFhzYzZ3a2ZETjA3RW5mc3VoY0w4aGRqWjNrVER1dytnTVA3RHVIUXZvTmR0RU00K2ZaSmZQYkIzMUR3WGdsdTIzTVhidDE5WitmMUpSTmtZOWZkaWhVeVEzWVVRMlNKVFBIV1R6Skcxc2djMlpPWkNSVXlMeEd5S0FteUlnbXkyZ1BaNElGczlVSUtQQWd0VGNaWGQzd0R0Nzl4RjRidEdvbGh6U014YkxkalBlR0RvYnRINGl0N2grUFhWVStodVhZWExyeC9Iblp0NXorN2dCOGUvaWx1Zk9NMkROdDlaOWMwSmh1N1JpcFd5QXpaSVVPS0pUSkZ0c2dZV1NOelpFOW14dFZMRmdGTU5BRjBRemE0SVZzOWtBSTMrcFdtNEN2MVg4ZVFwbS9oYXp1L2lhKzk4VTE4YlpkalBlR0RHNXR2eFIwNzdzUDYwZzA0Yy9UMytQVFRUKzNpRHpOK1B3OERHd2RqOEs2Lzc3cStaR1BuTnhVclpJYnNrQ0hGRXBsYXpTS1hBQ1pDTVVmMlpHWmlrMlFsUUpZa0dvOXFXTU4xWFI1SW5nZFNhQUI0dy9aYmNYUGpOM0JUMDNEY3RITTRibnJEc1VENzRNdHYzSTVyM3hpQzU4cGV4cUhHTi9HblAvM0pOdmgyLzNrZmhqUi9HOWMyM2RJOWJjbEcwM0RGQ3BsUkFCYXlIK2d4bUNKYmZCd0lXU056WkU4eTQ1c2ttd0R5bVN4SmtMVkp4Z3BYTHEwaGdHWEp1Rzc3RUh5NThUWjhxZkZXZktucFZueHBwMk9COW9GMzExZHhWKzBES0NrdndiblQ1L0Mzdi8zTkZnQS8rZXdUL011Ukp4Ry80NGJ1NjBvMkdtOVZySkFac2tPRzFMVmhycG9tVzJTTXJKRTVzcWQrNUNSQWxpWkNjaldBYnVOU1NoRUI5Q0cxYmhDdTJ6RUUxemJjZ21zYmIxRm5DczhXeHdMamc1U21RVWhwSElTcEphL2cyTzZqK09pamoyeUJqeCt5N2crYjRXNzRNcEliYis2K25tU2o0UmJGQ3BraE8xSmtzclRKYlFCSXhzZ2FtVE1Bakd1U25IaklzZ1JJTHUvM1REUWlJSy9sRlNVaHROd0xUKzFOU0swZmhKUWROeU9sNFdha05Eb1dPQjhNUXYrbWEvRDl5b2RSWDFXUDk4KzlqOC93bVMwQW52dmtQZHl4OXg4UXZUMFZxWTJFdkp1NmtvMGROeXRXeUF6WklVUHF1akFqSU5raVkyU056R1hHTVFMR05jbDhFOERYRW8yYmp2bG1BbGhzQUpoVWV5Tzg5VGZCVS84VmVCb2NDNlFQWWh2L0RxbjFnN0dnZURGT0h6eUZpeGN2MmdJZlB5VGoxRlQwcS9Pb0NHamJtT3Evb2xnaE13ckFZZ3VBdktHZGpCRkFNbmRaQURjbkdaZFJpcE1RVXVaQlhPM2ZJYkgrUzBpb3Z3RUpEWTRGeWdmeERkY2p0TUdEeDhwK2liMTFlM0RoL0FYYjRHdjZVN05LNnhIYmsrM1Z0UDRHeFFxWklUc01ZdXFTSEptNlBJQnhrR1h4a05kNHQzc2laSE1pSkQ5Si9iR3J6STMrTmRjZ3R1NWFETmgrTFFiVU94WVlIMXlIMEFZM3JxOGVpblVscitQZG8yZncxMC8vYWd1QUxEeCtmUENmSVRVeGlLMi96bDVOdDErcldDRXpaTWNBTU1sZ1NnR1lZTEEyUDA1SHdOZ215ZEVBeGtQV0pVQTJKVUMySlVLS0V1RXFTMEprVlNxaWF3Y2lxbTRnb3JZNzVtOGZSRzhmaUlqdEtaRHRDWGl5K0dtODFYalkxcmJMcXZmV0lhdzJFV0YxWG5CZnRvNm5icUJpaGN5UUhUS2tXQ0pUWk9zMVR2ZmlvWmpMak9VY01MWkpTQ1AvWjI0N0FKWW1JcnpTaDRpYVpFVFVKaU9pempGLyt5QzhMaGxTSDROYktyNko0cklTdkdkajIrWE14Yk1Zc3VzT1NIV1VndHoyc1pDUm1tVEZqS3ZVQ0dLWEFFakd5SnFLZ0FyQUFVMHlQeGF5TEE2U0d3ZFpGdy9aRkEvWmxnQXBTb0NyTkFHaGxXNzBxL0dnWDYxSFRWbzVjWFhNZno0STJaNkFmclVKR0ZjMENTZjJITGUxN2ZMc2liR1FxbjRJcVhQN1IwTXlVdU5SekpBZE1xUllJbE5raTR5Uk5US1hPWUFSa0FBT2dDeUxOUUdNZzJ5S2cyeUxoeFRGUTByajRhcE1oS3M2Q2E3YUpManFIUE9yRDJxVElOdkRNTExzUHRSWDdiQzE3ZEx3eHliRTF3OVUwUy9FWHpxU0ViSlNtYWpZVVF5UkpUSzF6Z3h5WkkzTWRSUkFxVWlBVkNWQWFoSWd0WTc1MVFkMTBZaXA4aUtuYUFIZU9mZ09QcmFwN1hMeGJ4ZVI5dWJEa0FxQjFDYjZUMGN5UWxiSVRLa1p4SzRJWU00WFIwQUh3RUNkZFBHUXVsQ01LbjRNZSt2MjRvUHpIOWhTOWZKRFZweDdEU0hWRWFyeTllc0oxRkVBeVZ4TEJGUUFEb0RreGtMV3hab3BPQTVTRkFjcGpZTlV4RU9xNGlFMThaQmF4L3pqZ3dSSVhUaVNLMi9FbXBKMU9IdnNYZHZhTG1jdXZvdkJiOXdPcVhTWmtjK1BHcElSc2tKbXlBNFoybVpPNjhnV0dWczJBUEo1QUdNZ3VRTWc2d2FZQU1aQ2ltSWhwYkdRaWpoSVZSeWtKZzVTNjVqOVBpQVFBeUMxWVhpaTZEYzQwdlNXclcyWDlPTXZHcW0zSnRiLytwRVJza0pteUE0WjJtWUdOYkpGeHBiRldBSHMzeVE1TVpDbEpvQnJCMEEyeGtMeVlpR0ZzWkNTV0VoNUhLUXlEbEp0UXNpZE9HYXZEMnBETUtqc05yUHQ4cDV0cTExVTRWSG5nMVNGR3huTTM3cVJFYkpDWnNnT0dTSkxaSXBzRVVDeVJ1WXkrN01LZGdEczhaT3BOaHFoMWYweHRtZ0NUdXc1WVZ2YjVlSm5GNUYyNENGSXVkaDdzbndSeEYwRHNMOFpBV01nYTJNZ0d3ZEE4Z1pBQ2dlWUVUQVdVaGtMcVk2Rk1JdzdacThQYWdValNyK0xIVGEzWFZhY3kwVUlJMTkxbEwzSCswWDZreEd5VW01bVR6SkVsc2dVMmNvMXMyMU9mMnNFZEFEc3NaT3FOaHd4VlVuSUxscUEzOXZZZGxHRng4NWJ6YmtmcDB3QkNoeWRCekM2U1hLaUlVdjdRM0w3UTliMmgyeU1nZVRGUUFwaklDVURJT1VESUpVRElOVURJRFdPMmVlREdFaXRZRlR4bzlpNzNkNjJTL3J4Rjh6VTJ6K3dtcEVSc2tKbXlBNFpJa3RraW15Uk1iSkc1aktqT1FlTWFwS2NLTWpTYUVodXRBbGdmMGhlZjBoaGYwaEpES1E4QmxJWkE2bU9NZnBJTmM0clY1SjB6MWoxaGlDNTRucXo3WExXdHJaTHd4OGJFVi9uaFZTRm12QjE5MWc3OGZka2hLeVFHYkpEaHNqU1JqTzRrVEd5UnViSW5tUkdtZ0JHUVhLalRBQ2pJWG5Sa01Kb1NFbC9TSGwvU0dWL1NEWFBKc2U2N3dNS3lubVpDMDhVamNhUm5mYTFYVlRoc2YvSGx1Z1hZTDNJQ0ZraE0yU0hESkdsaldad0kyTkxvMHdBSTAwQXM2TWdTNklncTZJZ2E4dzNiNDJHRkVSRGl2dER5dnBES3ZwRHFrd0l1UlBIdXVlREdzR2cwcUVvTGl2R2U2ZnRhN3VzT0p1TGtNb3dvKzNTRXhxUkViSkNac2dPR1NKTEJKQnNrVEd5UnVZWS9OUVBCOER1d2RSWm9XdkNFVm9WZ2JGRjQyMXR1NmpDbzJtb0VmMDZlMHgydmI5ckFFWkNsa1NhRVRBS3NqRUtzalVLVWhBRktZNkdsRVZES3FJaFZkR1Fhc2U2N1lNYXdZaVM3MkJIdGIyclhkS1BQUThwRTBoMVpNL3BSRWJJQ3BraE8yU0lMSkdwTldhV0pXdlprZFlJU0FBakhBQURjWExWaENLbU1oN1pSZk50YmJ1b3dxUFdEYWx3OVJ4ODlGK0hBSXhvQzJDRUNXQWtaRTBrWkdNa1pHdWtHUUdqSUdWUmtJb29TRldVMGRSa1k5T3hMdmlBa1lsdGwwZHNiYnVvd21QZmo4em8xOFBha0JHeVFtYUt6U3hLbHNnVTJWcGxCcnZzQ0RNQ3pncHZrcXh3eU9JSXlNb0l5T29JeUlZSXlKWUlTSDRrcENnU1Vob0pLWStFVkVaQ3FoenJtZzhJaGlDNTdGcXNLVm1Mczhmc2E3dXNPTHNTSVJYOUlKWDllbDRmTWtKV3lBelpJVU5raVV5UkxUSkcxc2djMlZNL0hBQURJRnc0cEVyd1JPR1R0clpkemx3OGc4R05RNHpvRnd6Qm9mTUFocGtSTUJ5eU1oeXlPaHl5SWR5TWdCR1FvZ2hJYVFTa1BBSlNHUUdwY3F4TFBxaG0yMldJN1cyWDlLUFBtZkN4OVJJRTJwQVJza0pteUU2K21VM0pGTmtpWTR2RHpRZ1l4Z2pZSG9CaERvQjJpbGtkZ3RES01Jd3RIR2RyMjBVVkhqVkp4dlZlTzQrM081OTFXUUREdmdqQU1NamlNTWhLdmlrTXNvRUFoa1B5d3lGRjRaRFNjRWg1T0tTU2FjU3h6dmtnVE0zOVJoVGZaZXRxRjZQdytDR2tWQ0JWWnVNNUdMUWhJMlNGekpBZE1rU1d5QlRaSW1Oa0xTc01LdmpKckg1Tmt0VVBzcmdmWkdVL3lPcCtKb0Joa1B3d1NGRVlwRFFNVWg0R1VSMTJEdGF4RHZ1Z1doQlRFV3UwWFE3WmQ1T1JVWGlFUWlwRGdrc1BNa0pXeUF6WklVTmJ6S0JHdHNnWVdTTnpaTThCMEo4blV6K2o3Vkwwa0sxdEY2UHd1TVV5OS9QbkdEcjUyWjBHY0dab2syU0ZRQmFIUUZhRVFsYUhRdGFIUWphSFFyYUZRZ3BESVNXaGtMSlFTQVhQT01jNjdJTXFRWEpwS3RZVTI5dDJTVC82ckpGNkdmMkNUUTh5UWxiSUROa2hRMlNKVEpFdE1rYld5QnpaVXo4K0IyQUlaSE1JWkZzSXBEQUVVaElDS1F1QlZIREFqbDNaQnp4SlhaQkt3Uk1GdjhhUm5VZHN1OG1vNGY4MUlMNDZ3YmplcStBTE1qM0lDRmtoTTJTSERKR2w5U0VkQVpCdk10L3NBTmk5azYxS01LaGtzTkYyZWNlZTFTN3E1dks5UDRDVVNQZU96WjlCNUFzQlpKWTFzMjFyQkhRMVNaWUxzdGdGV2VHQ3JIWkIxcnNnbTEyUWJTNUlvUXRTNG9LVXVZenJqT3JNNXRuZFVhT3plSUhjWnF2aTUzYjBHQUw5UGtGb1JhanRiWmNWWjFjZ3BKeVpLSWpIem12UlpJWE1rQjB5UkpiSUZOa2lZMlNOek0xME1RVkxrMlFKWkxGQVZnaGt0VURXQzJTelFMWUpwRkNNTTQ2ckxOVEFUYUFJVlFjc3Fpb2E4V1h4Q0M4S1IwUnhKQ0pMb2hCVkVxVmUrZCtkTmY1dFZBbFhYTEQ5MExGajZNaHgydnFlS3NHSW9wRzJ0bDFVNGRFdzJKejdCZW00eVFOMUlTdU0wbVNIREpFbE1rVzJ5QmhaSTNOa3o2OEFWZ2l1cmIwV1M1cVdZRW5lRXJ5OC9HVTh2L2g1MDE3QTg0czdieThzZWdIakZvekhmYS9mWjBUVllJT3dTaEJURm9Qc3doejgzc2EyUy9yUjlPQ0hMeGdCREMwTHhiTUhud1hPUXoxc1o5K09mV2l1YmNidUxoci90cW1vQ1d2V3JjWE5SWU9NS05pRnlHeHJ4Tk9ad0R5T1VZV2piRzI3R0lWSHZCRlo5TDZDOWJYVEVmQVZhWko1QWxra2tGY0Y4anVCdk40bUJSZWJZWlUzT0hNSG5iRXlRWFJsTlBJdjVLc0g3ZkQ1N24vOTlGTjFBdzRmT2R0WjQ3Y0QvZkdQZjhTUk45N0d0SzNURWNXRmovck02OHh4K2VPOWxZTGtraFJiVjd1b0t4NTcweURVd0IvSGJQZG5raEdtWUI2dk5RV1RLYkpGeHNnYW1TTjc2b2MvQWVRQVN3VERHb2ZoN0NkbmJYdmEwL2svbkVkelZUTitzdTNSNEFHd3d2NjJ5NHAzVnlDRWJZMnVuUHgydzlXUnp3dEtBSGxReFlJeGI0MnhEVUJHempQSHppQ3ZNQStEbUlwN09ncFdDZ1lWRDBKeGVUSGVzNm50b2dxUEhZT05DWDFIeEErRzl3UWxnSFJNbVNDeUloSjVmOGl6RGNJUFAvb1F4NXFQWVZwZXo2ZmkwSEw3Mnk2cThPZ3RxVmZESDdRQThnQjFLcjVvWHlwKy93L3Z0NlppN1lRZWVCMVJOTUxXdG9zcVBQaWNQYTUyNllIeGRIbWZYUUp3cmtBV0NtUzVRRjRUeURxQmJCSklua0FLQkZJa2hpTTR1ZVFPdW1ORmZrekZoWU1Nc2JwemZGMzQyNWpTR0dRWDJkZDJVWVhIbmpURDcxMDRubTdwMDkzOWtSR2VOR1NHN0pBaHNrU215QllaSTJ0a3JxVUlDU1NBcFlMSWNqK2xZbGJGcFdhVHVydU83TVRmanlxd3QrMmlDbzlTWGxQdDVzbmVpVEhZQm0zUUEwaW5GQXVHTlF6RFdYK2s0cnhIQXhjRkt3VEp4U20ycm5aUmhVZjlZS09OMFJNQWRYZWZ2UUpBSHFTL1VuRkJIZ1lGTUJYYnZkb2wvZTEwSTMzMXh1aEhlSHNGZ0R6UUVrRmtXU1R5L3NjUFZiRk94ZG9oM1QyckwvUDNiUC9ZMlhacCtLQUI4Wlh4UnR2bE12dTBMVlg2Ni9NN0RlQjBhWkk1QWxsZ1RoQnpCYkpXSUJzRnNsVWcrWllGQ1p4Y2NnZDJXYUZnNkk2aC9rbkZXeDgxaWlXN2pyWE41NFNXaG1Kc2dYMDNHYW5DWTNlYWNmV2d6YjVzODNjZ1BwZU02SVVJWkljTWtTVXlSYlpZaEpBMU1rZjIxSStlQXBBSFd5Z1ljOWdQRFdxbTRvSkJmb053UktHOWJSZFZlSEFScDkwbmVTQ2dzKzZqVndISUF5OFdSSmI2TVJWejZSYlRqZFZKM2Z6dm1CSjdWN3Vvd21QNzROYTVYemVQejg2eGR2cXplaDJBZEhZdlM4VjJ0MTFVNGNFTDk3MDkrbEhMWGdrZ0Q3cVhwR0xWZHJIeDJTNnE4T0MzQ3VrVlI3MDUrdlZhQUhuZ3JJcDdRU3EycysyaTd2SG9DNFdIOWFUcGxSRlFENENwdU42UFZiSGVUeGRmMlY5VWo5UzFhYlhMaWpNckVGTE1POGpzbmFOMmV0N1dSWCswdTU4dUF6aGZJTXNFc2tvZ2F3U3lRU0JiekRYOXZLYkhGRUZIY1FmK01uNStnWityWWpxN0M4Y2ZXbUsyWGZiYTgwMUdaejQrZzhFc1BPamJMaHhQMFA0Tk5TUXJIQmZ2QnlGRFpJbE1rUzB5UnRZKzE0WUpCZ0FwUkpFZ3NzU1BWYkY2NUhEblJSOVJNTUxXUitxbUgwazNSUEwzU1Ixb3VIczlnSFJZUVFCU2NTZUVpU20ydCsyaUNvOXlmcGx6NTArRW9JMTgycDk5QWtBT0lvaFM4YWg4KzFhN3RGeng2R3VwdDA4QnlNSDRPUlZIRjBVYmM2OHJwTURrUW50WHU2akNveWpFbUNkcDBmclNhNmNqNERScGt0bm14SENwUUZhYUUwWjljem9YRlBLYUh0T0ZMa1M0azBCWXZtRG9kajlVeGRYTmVKVFhpcTgwaG1MQkUvbjJQZHRGWGZHb0cyejQ4MHI3N3EzL1RrYklDcGtoTy9xbWRCWWhaSXVNc2Q0Z2MyUlAvUWhXQURtWWZNR1lRMzY0VnN5Ym1iWU5hbzJDN1FqT2E4bDJ0bDFVNFVGaEFuMGl0ek8ySzU1OFhmMmJQZ1VnblZBb2lDejJUMVU4ZmV0MFhKS0tMVTRQTFFyRjJQeHhPR0ZUMjZXbDhOQ1BPckhzeTI4dzlNUSsraHlBZEdJUHBPSVIrZmF0ZGxHRlIzTmEzMDY5R3ZZK0NTQUh0VTB3NXFCL1V2RmduWXE1bnhKQlRLRzliUmRWZVBCWmVad2JhYUg2Nm11WEFNd1VTSTVBbGxpZWtNVkhLZkJ1Smk0bzFFL0owb1VJZHhKb0t4QkVGa1VpN3ozN1YxQlAzMkttWWtKUkxCaTF6YjYyaTdyaVVUdlk4R0dnZmRZVCt5TWorcEVjWkljTWtTWDlaQ3d5UnRiSVhFc1IwaHNBcERPM0NZYldEY1haaisyOHIvZzhkdkVSSDV0L29xS1RKOStMTlVWcmJQc21vL1MzMGczNGV2TGtEU1NJZlJwQURzNGZxZmo0dTlpd2JRTyt2UEhMK09ubW4rSlE0MkZiSHFtckNvK3llT09TV3lBaDZNbDk5V2tBNlZoL3BPSVBQOFRoL1llUlc1eUx3cG9pbkR2VC9VZnFxc0pqVjlyVmszbzE5SDBlUUE1VXAyS2I3aXYrN0xQUDhPYy8veG5uM3oyUEMvOXpBUjlmL0xqYno2OVJoVWVCV1hob2NhNkcxMDRET0ZXYVpKWkFzaTFGQ0ovanhrY3A4RzRtTHFmUmoramc1Skk3Q0FiYmFtOVZUT0krQTU5ZTJQMnRwZkNnMzRMQlY0RThCakxDNjl3Y085a2hRMlNKVFBIeHZDeEN5QnFaSTN2cVIyOEVNRjhRV1dodlZkeDk5SXhQU0QrY2JnZ1FUQ2Rzb0NDOGFnQ2tRL1BNcXRpbVZHd0hnS3J3S0kwM21zNkJFajJZOW5OVkFjakIraUVWZHhWRVZYaThrV1pFdjJDQ0lwREhjbFVCU01jR1VTcGU4ZnNWQ01ubk53UmRoU1gxNnUwQUFBbEVTVVJCVkhNL0RYbW5BWndpVFRMVC9ONEdmbjhESHlLdEg4L0J0ZnhjVHNNSkpWZHhjSExKSFFTYmJSVU1yYlczUWQzWktLZ0tqNXJCeHBXallQTlBJSStIakZpWFlwRWgvVmdPc3RYNkhTRVFzcWQrOUhZQU9lZ3RnakZ2Mm5ldHVMTUFxc0tEVlYrd25xU0JndkNxQkpETzNkWnpWYkVxUEVyaWphWnpvSVFPMXYxMEMwRDlYU0c5TFFWck1iWUlodGJZdTRMNlNwRlEzVnkrTTgzb2Vlbmp1SnBmcndRZ0dUTytwc3RNd1pQTU9TQy9LMFEvSjFyZkc4eGwrZFlWTVhvZXlKMEVvL0g0TmdjMkZhOTRad1ZDK0pXa3dlNmJRT2xGUDNEMWxGNEpRNGIwUGNINitkQmtqZE0rc3FkKzhKZStBQ0NkbkNlSXpBOU1nMW9WSHRXRGplZ1hLSUdEZlQ5WFBZQVVLRUNwT1AxUXV0RWxjS0pmYTBaMEFEVGJBSDVPeGFyd0tJNDNXbFRCSHBVQ2VYd09nSzBYdy8yVmlpOHBQQUlwYm0vWWx3T2dwVURhTEJoYWJYK0RXaFVlVzBPTXlYWnZnQ0tReDlnbEFGOHh2N21HVmJCK1FoYlg4SE10djNWSkZxc2I3cUMzR0k5M2syRE1BZnNhMUtyd3FCcmNPdmZyTGI0STFISFM1OWFsV1BwK0VQMWtyTlp2U2JKVXdYMFZRRHA5cXlCeVd5VHl6dGx6TTVNcVBOaWE2bTBub3dOZ0QwWk9tMUp4dzRVR3hCZkZHejJ1UUFuYTIvYmpSTUIyUUxjaEZhdkNveW5OU2IxWE9pRWNBTnNCa0U1akttYUR1b3VwK0pMQzQwb2lYTTMvM2lVQVo1aVBUTFUrSlpWRmlMNHZoRXV5OUEzcXZkbTVtd1JEcXpwZkZhdkNvOUlwUERwVWZCSkFza0ptOVAwZ1pFa1hJZnJ4dkdST1hZcWJLUFV5M1FLZ2ZrUWJieUxoT2k2dTUrS2tXOStjeEIzMFZtTjF0bEV3Wm4vbnF1TDBnK21HTS9uM3ZYWHNnVHB1WFFHVEdiMFdrQ3haSDgxbVBCOGFRdlpra2xSY0FpRHZXdUtiK3lLQUZHR0xJREt2NDZsWUZSNkY4Y1lKR0NnUmUvTit2Z2hBc3FVaklJTWUyWk9Kc3ZGekFQTDJ1YjRLSU1YVnFmZ0tOek8xRkI1TUpiMFppa0FlKytVQTFMZGtXZ0VrZXpKUjVzazA4NG1WMWdjVThldlZtWUwxa2l5bVlEMFBET1NBL0xFdk9xa0RxVmdWSGx0QytzNjQvZUhMdHA5SlJzZ0tVekRaSVVOa1NRTkl4b3lub3pJRlo0bU1seWRscXZtMEl0NHd6QVdEWExmRlJhbGN4Nld2aG5CU3FlZUJGTEMzMjJaQjVOWkk1SjF0djBHdENvK0t3YTF6djk0KzNrQWRQeG5SQlFqWklVUDZhMXJKRmhuanc3RElITm1UOFhLdlRKVlAxSjNxWEttcUFXVFZZcjBjMTljQXBDQWJCVU1yMjYrS1ZlSEJTVFRQNkVDSjF4ZjIweFpBWFFFenFPblYwTVpURVQ1UjdNbDR1VUdteXFtV08rT3NxNkoxSzhaYUNmY2xRVGlXRFlMUiswZGZzdksrNFh3RDRndmlqVE81TDBBUnFERlkweStaWVJ2UENpRFowc3Z4eVJ6Wmt3VVNKcE9rV0hnOVdLK0t0aTVJNEllMG5RY0dha0NCMkkrWmlyZWUzYW9nVklWSFk1clJRZ2pFL3Z2U1Bxd0FraGtyZ0dTS0FKSXhza2JtTWlSYzFEWkp4Z3NiZzNQTnIxTnYyd3ZzeXdBU2dJMkNZWlhEOE1FbkgyRDltZlVJMld3V0huMEpqa0NNcFMyQUxFQ3NQY0FGSm1OR0UzcThBUjkvVHBaN1picjh0ZVg3UW5qek1Lc1dheVhNVmdUbmdkeEpJQVlUeUgxd1RKc0ZqKzE2REYrdi9ycFJ3UVZ5LzMxbFg2WWZlVUovcmdJbVUyekJzQUltYTJTdVpac3NDVEpWbWk5YmlEQ1V0cDBIOWtVUSsyS2hGUWk0eVFKTnQxL2FtLzlkV29BMEM1bTdaSnNrRTFWdVpob21xZXhhdDQyQy9HQXRFbmVtZDl4WFh2dmltQUtoRGYxR0l4dGtwTDMrSDVraVc4YjhiK0lsN0tsZkpzcHRNazB1cUJESlpxSDFPVEc2SDhnUDE2bllFYXZ2bllCZGhWWERSemJJaUxYL3A1OEgwOXFBdmlCazdYTmJob1RJVkZuVmtvWlpzYkJ5c1Y0WEp0bDlQUXAyVllTcjllOHVGLzEwOGFHclg3WmZqUDdmS2lGcjdXNVRaS1RNa0kvVXQxbTNUY09NZ25vdTZFUkJKL3JwRTY1dDlDTWpaTVY2K1kwc2NRVU0yU0pqbDkxSTVqUjV0ZDBvcUN0aWhsZEdRVjdyWTg3WGMwSjlRTTdyMVFHbkJvLzY2NlZYWkVOZisyWG1iQnY5eU5abG81K21jb29Na1JseVRoR3I1NEs4aktJdnpla0ZDb3lDT2hKYVFkUWgyWGsxSnVaOTBROWFiNzVxRG5UaFliM3l3VHFDREJuUjc1eVFyUTV0VXlWZFJVRjJyZGs4MUkxcFJrR2RpcmxEN3J4dEpPeUxEbmZHZE9uSnBBR2s5bVNBTEZoVHIxNThTbmJJa0RIM1MrOFFlK3BOR1JJajA2UzRwU0ptRDZkdFFhSlRzUVBocGVMMGRWamJ3cWVyWHV0VkQ3SkNabG9yWDE1MmkrazRnSHpuRkJrcU0rVzA2dDF3RXNsd3FsT3hYcXhxTFVxY1NOajNRV3dQUGpLZzRlTTBqWXpvcXg3cys1RWhzdFNsYlpvOEpKbnlGN1dDUWFkaS9ReHA1bnJ1dUMyRURvaDlEMFFyZURydE12SnArTWdDMS95UkRVN1h5QXJiTG1TSERIVnJteTdQcUZUTWhZVHNEWElIdkVMQ0hXb0lyZW5ZU2NsOUMwQXJmTlNXWmsyN0dqNHlRVGJJQ0ZuaE5kOVg1T2x1c2RmeXh6TmtiSWNnMUkxcURhRVREWHN2akZid3JGR1BHdXQyeXhmQlIyWnMzZHFEa0NHWGVaOXpRbGJIVE1rOHVQWkF0TUxJd1hHeXJnZnB2UGFzTDlwcVFhMjA2WWhuQlk5YVUzTnFyOU91TmZMWkRwOG1lYVpLeHgrMnpBbTVZSUdUVHBiZGJOSHdvSFJhNXZ5QUI2MWhaTmpXa1ZHLzZrRTZyNjJDOTVRdnRDWWFPT3FsOWJQTzlhZ3h0YWJtMUo0TTZEbmZiUGxReUloZnQ1bnlFNWt0eDFzZ1pNWERzcHR6QUo0UkdrUWRFWG53T2lwYVlkUkFjc0NPOWF3UHFJVTJEUjAxMCtEcGlFZHRxVEcxcHViVXZoVys0MEkyQXJLOUlyZEtwaFNxSmlON1BlejVjQUxLTTZJdGlJeUlWaGcxa0ZZbzlhQ2QxOWFvRTBoZlVBc05uQlU2YXFjam5nYVBHbE5yM2Vkam81a3NrSW1BYmxObGdHVEtzekpYM2xGVkQ4OEVuaEZ0UVdTMXJLT2locEZBYWlnNWI5VHRIQTdlc2NENFFQdWRyMW9QdmxxaG8zWnR3ZE5SajVVdXRTY0RaS0hIdGxseW04eVc1VEpYUGxTZGIwNUdOWWdNMDV5a01pcHl6c0FCV1lIazJhV05BM2NzY0Q3UWZ0ZXZEQkphSDJwRnphZ2ROV1JRb2FiVWxobVBXbE56YWg4MDIyeTVXK2JJS3Brbjc3ZEVSSVpwVGxJNUFBMmpGVWdPbEdkWVc5T09jRjVib2JEREYyMzl6TitwZ1JVNEszVFVqaG95dXpIaVVWdHFUSzJEZHN1VTRUSkh4c3NjYVpScytWaWRNUnlBam93OGs2eFFjazdSMXVnRXgrejNRVnMvODNjZDRhZ0p0ZEdSanBveDJsRkRha2xOcVcydjJXWkp2TXlSZTlXQno1TUNtU2NuSlV2K29nYkZhOHNjb0RiQ2FUV2VkWTdaN3dPcmovbmYydjk4cFNZRUxrcytWbHBSTXlPUTNDdlVzbGR2dkFGNXJ0d2djK1FlbVNPalpZNWt5eHpaSkhPbFV1YkpEc21TblpJbFRZNEYxQWM3bGUrcEFiVXdOS0UyOXlxdFdtNGE5eTk1L3grWUZUOXdkMGVoOFFBQUFBQkpSVTVFcmtKZ2dnPT1cIi8+XG48L2RlZnM+XG48L3N2Zz5gO1xuXG5leHBvcnQgY29uc3QgRVJST1JfSUNPTl9TVkdfUkFXID0gYDxzdmcgZmlsbD1cIm5vbmVcIiBoZWlnaHQ9XCIxNjBcIiB2aWV3Qm94PVwiMCAwIDE2MCAxNjBcIiB3aWR0aD1cIjE2MFwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB4bWxuczp4bGluaz1cImh0dHA6Ly93d3cudzMub3JnLzE5OTkveGxpbmtcIj5cbiAgPHBhdHRlcm4gaWQ9XCJhXCIgaGVpZ2h0PVwiMVwiIHBhdHRlcm5Db250ZW50VW5pdHM9XCJvYmplY3RCb3VuZGluZ0JveFwiIHdpZHRoPVwiMVwiPlxuICAgIDxpbWFnZSBoZWlnaHQ9XCIxNjBcIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPVwibm9uZVwiIHRyYW5zZm9ybT1cInNjYWxlKC4wMDYyNSlcIiB3aWR0aD1cIjE2MFwiIHhsaW5rOmhyZWY9XCJkYXRhOmltYWdlL3BuZztiYXNlNjQsaVZCT1J3MEtHZ29BQUFBTlNVaEVVZ0FBQUtBQUFBQ2dDQVlBQUFDTHoyY3RBQUFNOVVsRVFWUjRBZTNkUzQvYjFoVUg4RE5Bb29YYmpXVWdnRmNCc2tsV1FXYlZJa0JpTFFJajQ4a2dDSkJ2VWZmaDFndWpYZFFweHVPK1AwSzc2QmNvOGkyNlNHcDMwWGViQUVWckozWWN2OGIyekRpK3haL0RQMDNSUTVHVTdpWFBrYzRBeEIxUkZIbnZPVDllWGxJU0paTHdiMzlqNDV0ZnZmZmVoVENaUEpkd003N3FCQkZBenBBNzVEREI2dE92TXB3Ky9jcFhHeHRYSDU4NUV3N2VmdnR5K2kzNkZtSkdBRGxEN3BCRDVETG11cE92YXcvNE5qYy9PbmoxMVhCdzhtUjQvTVliNFdCejgxTHlEZnNHb2tRQXVjcHlkdkprUUE2UlMrUTB5c3BUcndRVlBRQys5Zld3UHhxRmZaR3dmK0pFT0poTUhHSHE0RWRZUC9BaFY4aFpscnZSS0NDWHlLbDZoR1Y4QjhRSGdDTGhZRHgyaEJHQXBGd0Y4U0ZYR1Q3bXpnTENXZmpZR0VlWWtzOWk2NjdEVitST004STIrSXFHZUUrNG1KUUVyMjdDVitST0kwTGkyeStQK2ZLdW14Vi9wblNFQ1JqTnQwcmkyNjhjZHAvSkdYT0tvWldXTVdFWjM5NW9GUFpFV2s5b3NKK1l6SWNtMXF2SytMcmtEcmtlSE9FaStJckdPc0pZbGpxdmgvajJ4dVBXblVhUk4zUTBReUtNZ28rOXBTUHNqR2ZSRnl5TWo3a2JBbUZVZkd5SUkxelVWT3ZYUjhQSDNQV0pNQW0rdkNFK0pteHRhTzRGaVEreG5qcWNFdE84WlI4SXEvZ2V6VnZabXRkbDYvT2VjRzVjVFM4a1BvejVrdVF1SlVMZzI4ZGJNZXZyNGRGb2xEVUFqVWd4SVVEN2swblk4L2VPbTB5MWZoNnh6R0thNDB1UnQyeWR1QktDeTNFeDM3YnJFMThSR0VmWUdsZlRnc1QzS0RVK2RrZ3hFUTZDancxeGhFMjJHcC92SFI5ekZ3TWg4ZUdDWStyRGJ0SHpzUUY1NllmalJtTzFDeEFmeDN4MU1VNDJQeDhUem5VNEpyNCt4bnlOQWZDZXNCWlozUlBFMTl0aHQ5SnhGRG1kcHljRXZyMzhoT1BoYUJRZWlndytJWkI3Zm1KUzUyMXFQdkFoVm9pWmh0ekJFRHF5ekZUVGgxcUo3OUg2ZXRDQ2owRjBoRlBPam55Z0RoODdMMXc1YVVLb0daOGpQTkxiMUV5MStOb2czTnZheWc2N0ducys0bVBwUGVHVXUreUJlbnhISWR6YU92eU9TWGp6emRmRG1UTlhucnoybXJyREx0RlZTMGY0RktFWmZDV0VzQVp6c0NjZkhqLyt3dzlQbkFpZlBQOThDUGxDRDdpdzVoSVhWbGY4eEFUNEVJT0hXazQ0Wm5paEtSaUROWmlEUGJrbzh2WHZpbHordFVqNFZHUUtJVjZrZVVMZ3N3U3M0TnQyRDB2NE5PZUlkY05SRFBoZ0ROWmdEdmJZbDYrZEY5bHhoQXlIN3RJNlBsZ1RrYlZxbEIxaE5TSUtIeThyUG9hNlFQaUpINDRaRXpXbFZYeXdoS05yWGM5WERmQVV3aWY1T0hCWCtYZ3dHMnRnTUk1QitSS09DZEVtdE8zQmVLeDZYSTQ4MEFyc2RNVkhqQm5DWDRtRWY0dUVNa0tzWFBPRUJDMGJ3akkremJGbjNZQVFabUFIaHRyMmZNVEgwaEV5RWdPV3E0cVBJVGVOMFBvbEd1QkRHOUNyczNmUlhNYnErWWlQWmUyWVVITXdzcm9aUGh5ejU5czFobS9lTVIreDFaVlRQZUZYK1Rqd3ZralFQaUdCMXNhRVpYemE0NHY2WVdlSGlVWEhmSFg0T0gvdCt5STdQREd4aHZDQmtiTmo0RU5kc2VOWXhBY2pSMTFrSnFKRlMwZTRhQVJudk43eHpRaE82U25UQ0xVZWpxMGZkbFAzZkNWLzJiOEZ3bi9seDMrTUF5d2NNdTdqUXE2eXd6RjdQdFROUWd3NTVrUHVNU1RyR3g4eFRpRjhuQU84SnhLMFQwUzRxK0FkRTlRQk93VHFwRDF1cUI5MkVPUjZhSHhUQ0g4cEV2NlpWd3dWTkJGSVhON0FZSDlBaE5nMjZtQU5IM0tObkEvVjh4RWZ5K0lTRGZZS2F6M2hVQWl0NG1QUE4rL2JhMFFUdXpTTk1MdnMwV05QYVAyd3F3MGZNV2NJTFI2TzcrVW5KbjBjam9rUDJ6UXhWTW1QYWp6c2FzVlhJTVM0Z0FnUDh2SGdYWkdnZmVvRFlSbWY5bmlnZnRoQmtFUGkwekxtSTdhNk1qczcvb1ZJK0VmZUFEVEVSTUFUOW9SVzhTR0h5S1VWZkVTWklmU2U4REFjVnZGWjYvbUlqNlVqRkpIZHpjMXRuT1RnRUcvaUtHRDBzRXQwMWRJMHdrVXYwUUFmMW1FTkh3NjdtcTd6VlZGMWZWd2dSTVB3Q3p6b0NlNFltTzR1Y0xHYStMQU9FMjNOYzJOMXpOZUVNa1BJRTVObFIyZ1YzOStObm5BMDRlUHpLNEhROFRIZE9zdWxSbWdWMzdJZWR1dDJBZE1JNzlkOGdBSDQ4SnlQK2VyU3JtdCtnUkRqRHZ4cUR3YnF0dzFNZC9DWlBaelpsdDQ3dnJleGtlSERjeWJha01kODJjZDhUZVF6aEQ4WENSWVIzanQxS3V5Ky8vNlBNZUYvaS9nUWUydnZjRFNoNnZxOGFZUzc3N3dUTURtK3Jtblh0YnhkaE1lT2hUdkhqcGs3N0hyUDkrd09VQ0Q4bTdFeG9hVXhIMkxyK0o3Rnh6bFRDUEZqSjBqdWx6NHRGQVBFRUxGMGZHUTJ1M1NFRVhjNHh6Y2JXOTJ6ampBQ1FzZFh4NnZkZkVlNEFFTEgxdzVaMDFJRndyL200eGdFMXNlRXMyTkFmSWlabjNBMEVXdCtmdTE3SWpzL0V3a0lLRzcxRDRDM2ZEb3lCb2dOWW9SWUlXYUlYY29iQlRXbmJ6bVdjSVF0ZGpqSGx4YTdJNXlCMFBHbHhjZTFPOElqRURvKzh1aW5kSVFsaEk2dkgzVFZyUlFJLzVML2RnbE9TcjVZc1FsdHhrM0JFUU0vNGFnU1NmOTRwUkU2dnZUQTJteGhKUkU2dmpZMCtsdG1wUkE2dnY1Z2RkblNTaUIwZkYxSTlMOXNnZkRQK2U5VzRLVGs1aEtjbUxBTnVDOHoydlpUZjRlamYxMHR0NWdoUklLcUNKRkVxeE4ySk1mWFVvQ0N4WllLb2VOVElHcU9La3doeEUzVGVUaTIxQXVpenFpN0gzYm5FS0RnSld2ZkV0bjVRQ1Q4TWYvT3NTVjhxQ3UrSjQyNm93MW9pMytxUllHcXJsVzRPQnI5NVBjaVQ1QlFTNzBnNjRxNm93MWQyKzNMSzRuQXRWT25QcmorNG90UFBoY0pONHhOcURQcWpqWW9DYWRYbzBzRWRyZTJ0bmZmZWl2Y2Z1RUZjL2k0czZEdWFNUHV1KzllNnRKMlgzYmdDTnplM056K2NqSUpOOGRqcy9pSUVHMUFXMjZYN2tVemNIaDk4N01pc0V6NEhPR3NUQ3Q4RHZodUwwblBSM3dzMFJPaWJkNFRLb1NIS3BWN1Bvc25IWVJXVjZKTmZqaFdqdS9HZUJ5UXFHV2UwRVlmRXlxQ3lKNXZGZkJ4eDNLRVNnQ3VJajVIcUFnZkJ1V3IxUE1SSDB1MDNVOU1CZ0RKbmcrRGNpWmpWVXMvTWVrWklQRGRta3pDNStOeCtFekVKNXgwamNjQk1mRkxOSWt4T3I3NkhjNFJPcjdCZTJOSG1BaWg5M3oxUFY5MUdPSUlJeU4wZk8zeEVhTWpqSVRROFhYSDV3Z2o0YnUxdWJuOVJYNjJleDBmenZTcGN3elFFeUtHdC95alhOMVVFdDluNDNIbm9EdlU2WjBWTVhTRUhmdzV2bWxBTVhZb1I5Z1NvT09MajQrQUhXRURRb3Y0K0ZWUEpsbDc2UWhyRUZyRGh6Tk5mSFh5MDN6Qy81aW5IU0RxNXdnckNDM2l3Mjl4WE0zdlRJcTdrK0ovekhPRWxlUnFmMWpHZDAwa2FKL1Fnd0RhbjBUQ2prZzRLM0lSRS83SFBEeUhaYlMzQS9WYitaN1FLajcwZHBkRXduY09iNWVSN2VQNEgvUFlFeHBFdUsyOXM0cGFQOHY0ME52bCtOWktRVm5EUER6bkNFdFIwZmp2RXVKam1CMGhJNkcxWEdKOERMa2paQ1MwbFN1QWp5RjNoSXlFbG5LRjhESGtqcENSR0xxMGlBOC9nVlU1MnkyZmNMUU5hWWFRWjhkWXA1OGR0dzFkcE9XSTc5cDRIUDRub243QzlUSGkyejY4enJmb25Vblh6b3JzWUYwQWpYVmpHeVppOGZSVE5EWXYwUURmemNra1hEZUc3NHBJaUlTUHUzR0JFT3UyaEJDNVF3NlJTemJHUkdrWkh3Nlo2TFVpMzVNNVE0aDFPOExFaEIxZmJZQWRZVzFvSWozaCtCb0Q2UWdiUXpUbkFvNnZkZUFjWWV0UXRWelE4YlVNMU5QRkhPSFRXQ3oybitPYk8zNk9jTzdRNVMrMGlBOC9lNG96MFVSbnUxMURPb1VRZGJOeW5YRHdTelEzOCt0OHVNajhYeEgxRXk3K0tzTkhyTThnUkYwdHhCUzV4M1ZDV0dCamVpbXh3UnVUU2JDRUQ5L2J3Ryt2UmI3SUhDdmVHVUxVRFhWRVhTMGhoSVhlRUZyRXg1NVBLVDRpTGhCaWlJQTZPMEtHSmk4ZFh5VWc4Ujg2d3JxWU9yNjZ5RVNmN3dpcklYVjgxWWdrZit3SUdXTEh4MGowWGpwQ3g5Yzd1dW9HVnhlaDQ2dGFHT3p4NmlGMGZJTmhxOXZ3NmlCMGZIVUdCcCsvL0FnZDMrREltaXF3dkFnZFgxUHUxVHkvWEFqRDZkTmYyOTNhdW9TZmVyTDAzcTZSdDlkU3FUV05FTlpnRHZiazQ1ZGV1dkR4eXkrSC94dy9udDNmVHZ1bk1NcWZhbEgrM200cWZGeXZTWVM0aHlLc3dSenN5WTlFWGo4bmN1VzNlRUlrNENmanRTSjBmTFJYbEtZUXdoYU13UnJNd1Y3V2tyTWlyM3hiNUtQZktFYm8rQXAwMVg5TUlDUStHSU0xbUp0cXlBOFVJM1I4VTZrNjZvRnFoRlY4c0haVUkwUWpRc2QzWktxT21xa1NZV3Q4YkpFbWhJNlBXV2xkcWtMWUdSK2JxUUdoNDJNMk9wY3FFTTZOajgwZEVxSGpZeGJtTGdkRnVEQStObnNJaEk2UDBWKzRIQVJoTkh4c2ZwOElIUitqSHEzc0ZXRjBmQXhESHdnZEg2TWR2ZXdGWVRKOERFZEtoSTZQVVU1V0prV1lIQi9Ea2dLaDQyTjBrNWRKRVBhR2orR0ppZER4TWFxOWxWRVI5bzZQWVlxQjBQRXhtcjJYVVJBT2hvL2hXZ1NoNDJNVUJ5c1hRamc0UG9adEhvU09qOUVidkp3TG9ScDhERjhYaEk2UFVWTlRka0tvRGgvRDJBYWg0Mk8wMUpXdEVLckZ4M0RPUXVqNEdDVzE1VXlFNnZFeHJIVUlWL3dMUkF5UDluSUtJVzZTaWE5bW1NSEg2RllSM3RWOVoxSlcyOHZEQ0JRSWNhZFc1QTdmNGVESDZKRmJFNEVpd3QrSmhEK0loTXRwZnY3S1JDd01WakpEaUp3aGQ4Z2h2c05oQmg4RGpncWZGN2w2NGZBYlVKY2ovL1lhTitObG1naXNuUk81ak53aGgrYndNU2JuUmI1eFR1VENSWkhuT005TEd4RkF6cEE3NURCbGpmOFBOaFdRRDhOeGx0Z0FBQUFBU1VWT1JLNUNZSUk9XCIvPlxuICA8L3BhdHRlcm4+XG4gIDxwYXRoIGQ9XCJtMCAwaDE2MHYxNjBoLTE2MHpcIiBmaWxsPVwidXJsKCNhKVwiLz5cbjwvc3ZnPmA7XG5cbi8vIERhdGEgVVJMc1xuZXhwb3J0IGNvbnN0IERPV05MT0FEX0lDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRE9XTkxPQURfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgU1VDQ0VTU19JQ09OX1NWR19VUkwgPSBgZGF0YTppbWFnZS9zdmcreG1sO3V0ZjgsJHtlbmNvZGVVUklDb21wb25lbnQoXG4gIFNVQ0NFU1NfSUNPTl9TVkdfUkFXLFxuKX1gO1xuXG5leHBvcnQgY29uc3QgRVJST1JfSUNPTl9TVkdfVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBFUlJPUl9JQ09OX1NWR19SQVcsXG4pfWA7XG5cbmV4cG9ydCBjb25zdCBDT01NRU5UX0lDT05fU1ZHX1JBVyA9IGA8c3ZnIHZpZXdCb3g9XCIwIDAgMjQgMjRcIiBmaWxsPVwibm9uZVwiIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiBzdHJva2U9XCIjZmZmZmZmXCI+PGcgaWQ9XCJTVkdSZXBvX2JnQ2FycmllclwiIHN0cm9rZS13aWR0aD1cIjBcIj48L2c+PGcgaWQ9XCJTVkdSZXBvX3RyYWNlckNhcnJpZXJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj48L2c+PGcgaWQ9XCJTVkdSZXBvX2ljb25DYXJyaWVyXCI+PHBhdGggZD1cIk0xMC45NjggMTguNzY5QzE1LjQ5NSAxOC4xMDcgMTkgMTQuNDM0IDE5IDkuOTM4YTguNDkgOC40OSAwIDAgMC0uMjE2LTEuOTEyQzIwLjcxOCA5LjE3OCAyMiAxMS4xODggMjIgMTMuNDc1YTYuMSA2LjEgMCAwIDEtMS4xMTMgMy41MDZjLjA2Ljk0OS4zOTYgMS43ODEgMS4wMSAyLjQ5N2EuNDMuNDMgMCAwIDEtLjM2LjcxYy0xLjM2Ny0uMTExLTIuNDg1LS40MjYtMy4zNTQtLjk0NUE3LjQzNCA3LjQzNCAwIDAgMSAxNSAxOS45NWE3LjM2IDcuMzYgMCAwIDEtNC4wMzItMS4xODF6XCIgZmlsbD1cIiNmZmZmZmZcIj48L3BhdGg+PHBhdGggZD1cIk03LjYyNSAxNi42NTdjLjYuMTQyIDEuMjI4LjIxOCAxLjg3NS4yMTggNC4xNDIgMCA3LjUtMy4xMDYgNy41LTYuOTM4QzE3IDYuMTA3IDEzLjY0MiAzIDkuNSAzIDUuMzU4IDMgMiA2LjEwNiAyIDkuOTM4YzAgMS45NDYuODY2IDMuNzA1IDIuMjYyIDQuOTY1YTQuNDA2IDQuNDA2IDAgMCAxLTEuMDQ1IDIuMjkuNDYuNDYgMCAwIDAgLjM4Ni43NmMxLjctLjEzOCAzLjA0MS0uNTcgNC4wMjItMS4yOTZ6XCIgZmlsbD1cIiNmZmZmZmZcIj48L3BhdGg+PC9nPjwvc3ZnPmA7XG5cbi8vIDIuIEVkaXRlZDogQSBtaW5pbWFsIHBlbmNpbFxuZXhwb3J0IGNvbnN0IEVESVRfSUNPTl9TVkdfUkFXID0gYDxzdmcgdmlld0JveD1cIjAgMCAyNCAyNFwiIGZpbGw9XCJub25lXCIgeG1sbnM9XCJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2Z1wiPjxnIGlkPVwiU1ZHUmVwb19iZ0NhcnJpZXJcIiBzdHJva2Utd2lkdGg9XCIwXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb190cmFjZXJDYXJyaWVyXCIgc3Ryb2tlLWxpbmVjYXA9XCJyb3VuZFwiIHN0cm9rZS1saW5lam9pbj1cInJvdW5kXCI+PC9nPjxnIGlkPVwiU1ZHUmVwb19pY29uQ2FycmllclwiPiA8cGF0aCBkPVwiTTEyIDMuOTk5OTdINkM0Ljg5NTQzIDMuOTk5OTcgNCA0Ljg5NTQgNCA1Ljk5OTk3VjE4QzQgMTkuMTA0NSA0Ljg5NTQzIDIwIDYgMjBIMThDMTkuMTA0NiAyMCAyMCAxOS4xMDQ1IDIwIDE4VjEyTTE4LjQxNDIgOC40MTQxN0wxOS41IDcuMzI4NDJDMjAuMjgxIDYuNTQ3MzcgMjAuMjgxIDUuMjgxMDQgMTkuNSA0LjVDMTguNzE4OSAzLjcxODk1IDE3LjQ1MjYgMy43MTg5NSAxNi42NzE1IDQuNTAwMDFMMTUuNTg1OCA1LjU4NTc1TTE4LjQxNDIgOC40MTQxN0wxMi4zNzc5IDE0LjQ1MDVDMTIuMDk4NyAxNC43Mjk3IDExLjc0MzEgMTQuOTIwMSAxMS4zNTYgMTQuOTk3NUw4LjQxNDIyIDE1LjU4NThMOS4wMDI1NyAxMi42NDQxQzkuMDgwMDEgMTIuMjU2OSA5LjI3MDMyIDExLjkwMTMgOS41NDk1MSAxMS42MjIxTDE1LjU4NTggNS41ODU3NU0xOC40MTQyIDguNDE0MTdMMTUuNTg1OCA1LjU4NTc1XCIgc3Ryb2tlPVwiI2ZmZmZmZlwiIHN0cm9rZS13aWR0aD1cIjJcIiBzdHJva2UtbGluZWNhcD1cInJvdW5kXCIgc3Ryb2tlLWxpbmVqb2luPVwicm91bmRcIj48L3BhdGg+IDwvZz48L3N2Zz5gO1xuXG5leHBvcnQgY29uc3QgRURJVF9JQ09OX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChcbiAgRURJVF9JQ09OX1NWR19SQVdcbil9YDtcbmV4cG9ydCBjb25zdCBDT01NRU5UX0lDT05fVVJMID0gYGRhdGE6aW1hZ2Uvc3ZnK3htbDt1dGY4LCR7ZW5jb2RlVVJJQ29tcG9uZW50KFxuICBDT01NRU5UX0lDT05fU1ZHX1JBV1xuKX1gOyIsImltcG9ydCB7IERPV05MT0FEX0lDT05fU1ZHX1VSTCB9IGZyb20gJy4vaWNvbnMnO1xuXG5jb25zdCBTVFlMRV9JRCA9ICdjcWQtc3R5bGUnO1xuY29uc3QgU1BJTk5FUl9TSVpFX1BYID0gMTY7XG5cbi8vIFNtb290aCwgc2xpZ2h0bHkgYm91bmN5IHRyYW5zaXRpb24gZm9yIHRoZSBcIkRyb3BcIiBmZWVsXG5jb25zdCBUUkFOU0lUSU9OX01TID0gMTUwO1xuY29uc3QgVFJBTlNJVElPTl9TVFIgPSBgJHtUUkFOU0lUSU9OX01TfW1zIGN1YmljLWJlemllcigwLjIsIDAsIDAsIDEpYDtcblxuZXhwb3J0IGZ1bmN0aW9uIGluamVjdFN0eWxlcygpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcbiAgaWYgKGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKFNUWUxFX0lEKSkgcmV0dXJuO1xuXG4gIGNvbnN0IHN0eWxlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3R5bGUnKTtcbiAgc3R5bGUuaWQgPSBTVFlMRV9JRDtcbiAgc3R5bGUudGV4dENvbnRlbnQgPSBgXG4gICAgOnJvb3Qge1xuICAgICAgLS1jcWQtdHJhbnNpdGlvbjogJHtUUkFOU0lUSU9OX1NUUn07XG4gICAgICAtLWNxZC1jb2xvci1wcmltYXJ5OiAjMWE3M2U4O1xuICAgICAgLS1jcWQtY29sb3Itc3VjY2VzczogIzM0YTg1MztcbiAgICAgIC0tY3FkLWNvbG9yLWVycm9yOiAjZTA1OTUyO1xuICAgICAgLS1jcWQtZnJhbWUtY29sb3I6ICM2MzY2ZjE7XG5cbiAgICAgIC0tY3FkLXNoYWRvdy1iYXNlOiAwIDBweCAxMHB4IHJnYmEoMTUsIDIzLCA0MiwgMC4yMik7XG4gICAgICAtLWNxZC1zaGFkb3ctaG92ZXI6IDAgMTBweCAyNHB4IHJnYmEoMTUsIDIzLCA0MiwgMC4zMCk7XG4gICAgICAtLWNxZC1zaGFkb3ctcGlsbDogMCA4cHggMjJweCByZ2JhKDE1LCAyMywgNDIsIDAuMzApO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3M6IDAgMTJweCAyOHB4IHJnYmEoMjQsIDEyOCwgNTYsIDAuNDApO1xuICAgICAgLS1jcWQtc2hhZG93LXN1Y2Nlc3Mtc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDI0LCAxMjgsIDU2LCAwLjcwKTtcbiAgICAgIC0tY3FkLXNoYWRvdy1lcnJvcjogMCAxMnB4IDI4cHggcmdiYSgyMjQsIDg5LCA4MiwgMC40MCk7XG4gICAgICAtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nOiAwIDEycHggMjhweCByZ2JhKDIyNCwgODksIDgyLCAwLjcwKTtcbiAgICB9XG5cbiAgICAvKiA9PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiBDUklUSUNBTCBPVkVSUklERVM6IEZvcmNlIEdvb2dsZSBDYXJkIHRvIHNob3cgdGhlIEJhZGdlXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT09ICovXG4gICAgZGl2W2RhdGEtc3RyZWFtLWl0ZW0taWRdIHtcbiAgICAgICAgb3ZlcmZsb3c6IHZpc2libGUgIWltcG9ydGFudDtcbiAgICAgICAgY29udGFpbjogbm9uZSAhaW1wb3J0YW50O1xuICAgICAgICB6LWluZGV4OiAxO1xuICAgIH1cblxuICAgIC8qID09PT09PT09PT09PT09PT09PT09PT09PT09PT09PT1cbiAgICAgKiAxLiBFWElTVElORyBET1dOTE9BRCBCVVRUT04gU1RZTEVTIChVbmNoYW5nZWQpXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogNTAlO1xuICAgICAgcmlnaHQ6IDhweDtcbiAgICAgIHotaW5kZXg6IDU7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGhlaWdodDogNDBweDtcbiAgICAgIHdpZHRoOiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiBjYWxjKDEwMCUgLSAxNnB4KTtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICBib3JkZXI6IG5vbmU7XG4gICAgICBib3JkZXItcmFkaXVzOiA5OTk5cHg7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItcHJpbWFyeSk7XG4gICAgICBjb2xvcjogI2ZmZmZmZjtcbiAgICAgIGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctYmFzZSk7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsIFwiU2Vnb2UgVUlcIiwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA2MDA7XG4gICAgICB3aGl0ZS1zcGFjZTogbm93cmFwO1xuICAgICAgb3ZlcmZsb3c6IGhpZGRlbjtcbiAgICAgIHdpbGwtY2hhbmdlOiB0cmFuc2Zvcm0sIGJveC1zaGFkb3csIHdpZHRoLCBib3JkZXItcmFkaXVzLCBwYWRkaW5nLWlubGluZTtcbiAgICAgIHRyYW5zaXRpb246IHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgcGFkZGluZy1pbmxpbmUgdmFyKC0tY3FkLXRyYW5zaXRpb24pLCBib3JkZXItcmFkaXVzIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgYm94LXNoYWRvdyB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIHRyYW5zZm9ybSB2YXIoLS1jcWQtdHJhbnNpdGlvbiksIGJhY2tncm91bmQtY29sb3IgdmFyKC0tY3FkLXRyYW5zaXRpb24pO1xuICAgIH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpub3QoLmNxZC1sb2FkaW5nKTpub3QoLmNxZC1zdWNjZXNzKTpub3QoLmNxZC1lcnJvcik6aG92ZXIge1xuICAgICAgd2lkdGg6IDEyMHB4OyBwYWRkaW5nLWlubGluZTogMTJweDsgYm94LXNoYWRvdzogdmFyKC0tY3FkLXNoYWRvdy1ob3Zlcik7IGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpOyBib3JkZXItcmFkaXVzOiAyMHB4O1xuICAgIH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpmb2N1cy12aXNpYmxlIHsgb3V0bGluZTogMnB4IHNvbGlkICNmZmZmZmY7IG91dGxpbmUtb2Zmc2V0OiAycHg7IH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjphY3RpdmUgeyBib3gtc2hhZG93OiAwIDJweCA2cHggcmdiYSgxNSwgMjMsIDQyLCAwLjMpOyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMC45Nyk7IH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0biAuY3FkLWljb24td3JhcHBlciB7IGRpc3BsYXk6IGlubGluZS1mbGV4OyBhbGlnbi1pdGVtczogY2VudGVyOyBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjsgZmxleC1zaHJpbms6IDA7IH1cbiAgICAuY3FkLWRvd25sb2FkLWljb24ge1xuICAgICAgZGlzcGxheTogYmxvY2s7IHdpZHRoOiAyNHB4OyBoZWlnaHQ6IDI0cHg7IGJhY2tncm91bmQtaW1hZ2U6IHVybChcIiR7RE9XTkxPQURfSUNPTl9TVkdfVVJMfVwiKTsgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDsgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyOyBiYWNrZ3JvdW5kLXNpemU6IDI0cHggMjRweDsgZmxleC1zaHJpbms6IDA7IHRyYW5zZm9ybS1vcmlnaW46IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246IHdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgaGVpZ2h0IHZhcigtLWNxZC10cmFuc2l0aW9uKSwgYm9yZGVyLXdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKTtcbiAgICB9XG4gICAgLmNxZC1pY29uLXNtYWxsIHsgd2lkdGg6IDE2cHg7IGhlaWdodDogMTZweDsgYmFja2dyb3VuZC1zaXplOiAxNnB4IDE2cHg7IH1cbiAgICAuY3FkLWljb24tbWVkaXVtIHsgd2lkdGg6IDI0cHg7IGhlaWdodDogMjRweDsgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7IH1cbiAgICAuY3FkLWljb24tbGFyZ2UgeyB3aWR0aDogMzJweDsgaGVpZ2h0OiAzMnB4OyBiYWNrZ3JvdW5kLXNpemU6IDMycHggMzJweDsgfVxuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtbGFiZWwgeyBvcGFjaXR5OiAwOyBtYXJnaW4tbGVmdDogMDsgbWF4LXdpZHRoOiAwOyBvdmVyZmxvdzogaGlkZGVuOyB0cmFuc2l0aW9uOiBvcGFjaXR5IHZhcigtLWNxZC10cmFuc2l0aW9uKSwgbWF4LXdpZHRoIHZhcigtLWNxZC10cmFuc2l0aW9uKSwgbWFyZ2luLWxlZnQgdmFyKC0tY3FkLXRyYW5zaXRpb24pOyB9XG4gICAgLmNxZC1kb3dubG9hZC1idG46bm90KC5jcWQtbG9hZGluZyk6bm90KC5jcWQtZXJyb3IpOm5vdCguY3FkLXN1Y2Nlc3MpOmhvdmVyIC5jcWQtbGFiZWwgeyBvcGFjaXR5OiAxOyBtYXgtd2lkdGg6IDExMHB4OyBtYXJnaW4tbGVmdDogNHB4OyB9XG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmcsIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzLCAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3IgeyBwYWRkaW5nLWlubGluZTogMTJweDsgYm9yZGVyLXJhZGl1czogMjBweDsganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0OyBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXBpbGwpOyBjdXJzb3I6IGRlZmF1bHQ7IHdpZHRoOiAxNTBweDsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpOyB9XG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmc6YWN0aXZlLCAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzczphY3RpdmUsIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjphY3RpdmUgeyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7IGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctcGlsbCk7IH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyAuY3FkLWxhYmVsIHsgb3BhY2l0eTogMTsgbWF4LXdpZHRoOiAxMTBweDsgbWFyZ2luLWxlZnQ6IDEycHg7IH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZzpob3ZlciB7IHBhZGRpbmctaW5saW5lOiAxMnB4OyBib3JkZXItcmFkaXVzOiAyMHB4OyB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7IGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctcGlsbCk7IH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2VzcyB7IHdpZHRoOiAxNDBweDsgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWNvbG9yLXN1Y2Nlc3MpOyBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3MpOyB9XG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3MgLmNxZC1sYWJlbCB7IG9wYWNpdHk6IDE7IG1heC13aWR0aDogMTEwcHg7IG1hcmdpbi1sZWZ0OiA4cHg7IH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtc3VjY2Vzczpob3ZlciB7IHdpZHRoOiAxNDBweDsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKC01MCUpIHNjYWxlKDEpOyBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LXN1Y2Nlc3Mtc3Ryb25nKTsgfVxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvciB7IHdpZHRoOiA5MHB4OyBiYWNrZ3JvdW5kLWNvbG9yOiB2YXIoLS1jcWQtY29sb3ItZXJyb3IpOyBib3gtc2hhZG93OiB2YXIoLS1jcWQtc2hhZG93LWVycm9yKTsgaGVpZ2h0OiA0MHB4OyBtYXgtd2lkdGg6IDE1MHB4OyBtYXgtaGVpZ2h0OiA0MHB4OyBwYWRkaW5nLXRvcDogMDsgcGFkZGluZy1ib3R0b206IDA7IGFsaWduLWl0ZW1zOiBjZW50ZXI7IHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7IH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3IgLmNxZC1sYWJlbCB7IG9wYWNpdHk6IDE7IG1hcmdpbi1sZWZ0OiA4cHg7IG1heC13aWR0aDogMTEwcHg7IG92ZXJmbG93OiBoaWRkZW47IGZsZXg6IDAgMCBhdXRvOyB9XG4gICAgLmNxZC1lcnJvci1kZXRhaWwgeyBkaXNwbGF5OiBibG9jazsgZm9udC1zaXplOiAxMXB4OyBmb250LXdlaWdodDogNTAwOyBsaW5lLWhlaWdodDogMS4zOyBtYXJnaW4tbGVmdDogMDsgbWFyZ2luLXRvcDogMDsgb3BhY2l0eTogMDsgbWF4LWhlaWdodDogMDsgb3ZlcmZsb3c6IGhpZGRlbjsgd2hpdGUtc3BhY2U6IG5vcm1hbDsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDRweCk7IHRyYW5zaXRpb246IGFsbCB2YXIoLS1jcWQtdHJhbnNpdGlvbik7IH1cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6aG92ZXIgeyB3aWR0aDogMzUwcHg7IG1heC13aWR0aDogMzYwcHg7IGhlaWdodDogNjBweDsgbWF4LWhlaWdodDogNjFweDsgcGFkZGluZy10b3A6IDhweDsgcGFkZGluZy1ib3R0b206IDhweDsgYm9yZGVyLXJhZGl1czogMThweDsgYWxpZ24taXRlbXM6IGNlbnRlcjsgd2hpdGUtc3BhY2U6IG5vcm1hbDsgZ2FwOiA3cHg7IGJveC1zaGFkb3c6IHZhcigtLWNxZC1zaGFkb3ctZXJyb3Itc3Ryb25nKTsgfVxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciAuY3FkLWxhYmVsIHsgb3BhY2l0eTogMDsgbWF4LXdpZHRoOiAwOyBtYXJnaW4tbGVmdDogMDsgfVxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciAuY3FkLWVycm9yLWRldGFpbCB7IG9wYWNpdHk6IDE7IG1heC1oZWlnaHQ6IDYwcHg7IG1hcmdpbi10b3A6IDRweDsgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKDApOyB9XG4gICAgLmNxZC1zcGlubmVyIHsgYmFja2dyb3VuZC1pbWFnZTogbm9uZTsgYm9yZGVyLXJhZGl1czogOTk5OXB4OyB3aWR0aDogJHtTUElOTkVSX1NJWkVfUFh9cHg7IGhlaWdodDogJHtTUElOTkVSX1NJWkVfUFh9cHg7IGJvcmRlcjogM3B4IHNvbGlkIHJnYmEoMjU1LCAyNTUsIDI1NSwgMC4yMik7IGJvcmRlci10b3AtY29sb3I6ICNmZmZmZmY7IGJveC1zaGFkb3c6IG5vbmU7IGFuaW1hdGlvbjogY3FkLXNwaW4gMC42NXMgbGluZWFyIGluZmluaXRlOyB9XG4gICAgQGtleWZyYW1lcyBjcWQtc3BpbiB7IGZyb20geyB0cmFuc2Zvcm06IHJvdGF0ZSgwZGVnKTsgfSB0byB7IHRyYW5zZm9ybTogcm90YXRlKDM2MGRlZyk7IH0gfVxuXG4gICAgLyogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PVxuICAgICAqIDIuIENPTU1FTlQgRlJBTUUgJiBWRVJUSUNBTCBQSUxMIEJBREdFXG4gICAgICogPT09PT09PT09PT09PT09PT09PT09PT09PT09PT09PSAqL1xuXG4gICAgLyogVGhlIEJvcmRlciBGcmFtZSAqL1xuICAgIC5jcWQtb3ZlcmxheS1jb250YWluZXIge1xuICAgICAgcG9zaXRpb246IGFic29sdXRlO1xuICAgICAgdG9wOiAwOyBsZWZ0OiAwOyByaWdodDogMDsgYm90dG9tOiAwO1xuICAgICAgcG9pbnRlci1ldmVudHM6IG5vbmU7IFxuICAgICAgei1pbmRleDogMTA7XG4gICAgICBib3gtc2l6aW5nOiBib3JkZXItYm94O1xuICAgICAgYm9yZGVyLXJhZGl1czogaW5oZXJpdDsgXG4gICAgICB0cmFuc2l0aW9uOiBhbGwgMC4ycyBlYXNlO1xuICAgICAgLyogU3VidGxlIGZyYW1lIGdsb3cgKi9cbiAgICAgIGJveC1zaGFkb3c6IGluc2V0IDAgMCAwIDJweCB2YXIoLS1jcWQtZnJhbWUtY29sb3IpLCAwIDAgMTJweCByZ2JhKDk5LCAxMDIsIDI0MSwgMC41KTtcbiAgICB9XG4gICAgXG4gICAgLyogVEhFIEJBREdFIChWZXJ0aWNhbCBEcm9wKSAqL1xuICAgIC5jcWQtY29tbWVudC1iYWRnZSB7XG4gICAgICBwb3NpdGlvbjogYWJzb2x1dGU7XG4gICAgICB0b3A6IDIxcHg7IFxuICAgICAgei1pbmRleDogOTk5OTsgLyogQWx3YXlzIG9uIHRvcCAqL1xuXG4gICAgICBkaXNwbGF5OiBmbGV4O1xuICAgICAgLyogVkVSVElDQUwgU1RBQ0tJTkcgKi9cbiAgICAgIGZsZXgtZGlyZWN0aW9uOiBjb2x1bW47IFxuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgXG4gICAgICAvKiBEaW1lbnNpb25zICovXG4gICAgICB3aWR0aDogMzBweDsgICAgICBcbiAgICAgIGhlaWdodDogMzBweDtcbiAgICAgIFxuICAgICAgYmFja2dyb3VuZC1jb2xvcjogdmFyKC0tY3FkLWZyYW1lLWNvbG9yKTtcbiAgICAgIGNvbG9yOiAjZmZmZmZmO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgXG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuICAgICAgXG4gICAgICAvKiBBbmltYXRlIEhlaWdodCAqL1xuICAgICAgdHJhbnNpdGlvbjogXG4gICAgICAgIGhlaWdodCB2YXIoLS1jcWQtdHJhbnNpdGlvbiksXG4gICAgICAgIGJveC1zaGFkb3cgMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIC8qIEhPVkVSIFNUQVRFOiBFeHBhbmRzIFZlcnRpY2FsbHkgdG8gc2hvdyBudW1iZXIgKi9cbiAgICAuY3FkLWNvbW1lbnQtYmFkZ2U6aG92ZXIge1xuICAgICAgaGVpZ2h0OiA1OHB4OyAvKiBFbm91Z2ggc3BhY2UgZm9yIEljb24gKyBOdW1iZXIgKi9cbiAgICB9XG5cbiAgICAvKiAtLS0gQVRUQUNITUVOVCBMT0dJQyAoQ2VudGVyaW5nIG9uIHRoZSBib3JkZXIpIC0tLSAqL1xuXG4gICAgLyogTFRSIChMZWZ0IEJvcmRlcikgKi9cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cImx0clwiXSAuY3FkLWNvbW1lbnQtYmFkZ2Uge1xuICAgICAgbGVmdDogMDtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWCgtNTAlKTtcbiAgICB9XG5cbiAgICAvKiBSVEwgKFJpZ2h0IEJvcmRlcikgKi9cbiAgICBib2R5W2RhdGEtY3FkLWRpcj1cInJ0bFwiXSAuY3FkLWNvbW1lbnQtYmFkZ2Uge1xuICAgICAgcmlnaHQ6IDA7IFxuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVYKDUwJSk7XG4gICAgfVxuXG4gICAgLyogSUNPTiAqL1xuICAgIC5jcWQtYmFkZ2UtaWNvbiB7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHdpZHRoOiAyMHB4O1xuICAgICAgaGVpZ2h0OiAyMHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiBjb250YWluO1xuICAgICAgYmFja2dyb3VuZC1yZXBlYXQ6IG5vLXJlcGVhdDtcbiAgICAgIGJhY2tncm91bmQtcG9zaXRpb246IGNlbnRlcjtcbiAgICAgIGZpbHRlcjogYnJpZ2h0bmVzcygwKSBpbnZlcnQoMSk7XG4gICAgICBcbiAgICAgIG1hcmdpbi10b3A6IDJweDtcblxuICAgICAgLyogRW5zdXJlIGljb24gc3RheXMgcHV0IGR1cmluZyB0cmFuc2l0aW9uICovXG4gICAgICB0cmFuc2l0aW9uOiB0cmFuc2Zvcm0gMC4ycyBlYXNlO1xuICAgIH1cblxuICAgIC8qIExBQkVMIChUaGUgTnVtYmVyKSAqL1xuICAgIC5jcWQtYmFkZ2UtbGFiZWwge1xuICAgICAgZGlzcGxheTogYmxvY2s7XG4gICAgICBmb250LWZhbWlseTogc3lzdGVtLXVpLCAtYXBwbGUtc3lzdGVtLCBCbGlua01hY1N5c3RlbUZvbnQsIFwiU2Vnb2UgVUlcIiwgc2Fucy1zZXJpZjtcbiAgICAgIGZvbnQtc2l6ZTogMTNweDtcbiAgICAgIGZvbnQtd2VpZ2h0OiA3MDA7XG4gICAgICBcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTVweCk7XG5cbiAgICAgIG1heC1oZWlnaHQ6IDA7XG4gICAgICBtYXJnaW4tdG9wOiAycHg7XG4gICAgICBvdmVyZmxvdzogaGlkZGVuO1xuXG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIHRyYW5zZm9ybSAwLjE1cyBlYXNlIDAuMDVzLFxuICAgICAgICBtYXgtaGVpZ2h0IDAuMTVzIGVhc2UgMC4wNXMsXG4gICAgICAgIG1hcmdpbi10b3AgMC4xNXMgZWFzZSAwLjA1cztcbiAgICAgIFxuICAgIH1cbiAgICBcbiAgICAvKiBSZXZlYWwgTnVtYmVyIG9uIEhvdmVyICovXG4gICAgLmNxZC1jb21tZW50LWJhZGdlOmhvdmVyIC5jcWQtYmFkZ2UtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgwKTtcbiAgICAgIG1heC1oZWlnaHQ6IDIwcHg7ICAgLyogZW5vdWdoIGZvciBvbmUgbGluZSBvZiB0ZXh0ICovXG4gICAgfVxuICBgLnRyaW0oKTtcblxuICAoZG9jdW1lbnQuaGVhZCB8fCBkb2N1bWVudC5kb2N1bWVudEVsZW1lbnQpLmFwcGVuZENoaWxkKHN0eWxlKTtcbn0iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC9jb21tZW50X2ZyYW1lLmNvbnRlbnQudHNcbmltcG9ydCB7IENPTU1FTlRfSUNPTl9VUkwgfSBmcm9tICcuL2NvbnRlbnQvaWNvbnMnO1xuaW1wb3J0IHsgaW5qZWN0U3R5bGVzIH0gZnJvbSAnLi9jb250ZW50L3N0eWxlcyc7XG5cbi8vIFNlbGVjdG9yIGZvciB0aGUgbWFpbiBzdHJlYW0gY2FyZFxuY29uc3QgUE9TVF9TRUxFQ1RPUiA9ICdkaXZbZGF0YS1zdHJlYW0taXRlbS1pZF0nO1xuY29uc3QgUFJPQ0VTU0VEX0FUVFIgPSAnZGF0YS1jcWQtcHJvY2Vzc2VkJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFsnaHR0cHM6Ly9jbGFzc3Jvb20uZ29vZ2xlLmNvbS8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIG1haW4oKSB7XG4gICAgLy8gMS4gSW5qZWN0IENTUyBpbW1lZGlhdGVseVxuICAgIGluamVjdFN0eWxlcygpO1xuXG4gICAgLy8gMi4gUnVuIGluaXRpYWwgc2NhblxuICAgIHNjYW5Gb3JDb21tZW50cygpO1xuXG4gICAgLy8gLS0tIFNUUkFURUdZIDE6IE1VVEFUSU9OIE9CU0VSVkVSIC0tLVxuICAgIGNvbnN0IG9ic2VydmVyID0gbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKG11dGF0aW9ucykgPT4ge1xuICAgICAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKCgpID0+IHtcbiAgICAgICAgc2NhbkZvckNvbW1lbnRzKCk7XG4gICAgICB9KTtcbiAgICB9KTtcblxuICAgIG9ic2VydmVyLm9ic2VydmUoZG9jdW1lbnQuYm9keSwge1xuICAgICAgY2hpbGRMaXN0OiB0cnVlLFxuICAgICAgc3VidHJlZTogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIC0tLSBTVFJBVEVHWSAyOiBUSEUgSEVBUlRCRUFUIC0tLVxuICAgIHNldEludGVydmFsKCgpID0+IHtcbiAgICAgIHNjYW5Gb3JDb21tZW50cygpO1xuICAgIH0sIDEwMDApO1xuXG4gICAgLy8gLS0tIFNUUkFURUdZIDM6IFVSTCBXQVRDSEVSIC0tLVxuICAgIGxldCBsYXN0VXJsID0gbG9jYXRpb24uaHJlZjsgXG4gICAgbmV3IE11dGF0aW9uT2JzZXJ2ZXIoKCkgPT4ge1xuICAgICAgY29uc3QgdXJsID0gbG9jYXRpb24uaHJlZjtcbiAgICAgIGlmICh1cmwgIT09IGxhc3RVcmwpIHtcbiAgICAgICAgbGFzdFVybCA9IHVybDtcbiAgICAgICAgc2V0VGltZW91dChzY2FuRm9yQ29tbWVudHMsIDUwMCk7IFxuICAgICAgfVxuICAgIH0pLm9ic2VydmUoZG9jdW1lbnQsIHsgc3VidHJlZTogdHJ1ZSwgY2hpbGRMaXN0OiB0cnVlIH0pO1xuICB9LFxufSk7XG5cbmZ1bmN0aW9uIHNjYW5Gb3JDb21tZW50cygpIHtcbiAgdHJ5IHtcbiAgICBjb25zdCBkaXJlY3Rpb24gPSBnZXRQYWdlRGlyZWN0aW9uKCk7XG4gICAgZG9jdW1lbnQuYm9keS5zZXRBdHRyaWJ1dGUoJ2RhdGEtY3FkLWRpcicsIGRpcmVjdGlvbik7XG5cbiAgICBjb25zdCBwb3N0cyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFBPU1RfU0VMRUNUT1IpO1xuXG4gICAgcG9zdHMuZm9yRWFjaCgocG9zdCkgPT4ge1xuICAgICAgLy8gMS4gQ2hlY2sgaWYgYWxyZWFkeSBwcm9jZXNzZWRcbiAgICAgIGlmIChwb3N0Lmhhc0F0dHJpYnV0ZShQUk9DRVNTRURfQVRUUikpIHtcbiAgICAgICAgY29uc3QgZXhpc3RpbmdPdmVybGF5ID0gcG9zdC5xdWVyeVNlbGVjdG9yKCcuY3FkLW92ZXJsYXktY29udGFpbmVyJyk7XG4gICAgICAgIGlmIChleGlzdGluZ092ZXJsYXkpIHtcbiAgICAgICAgICAgIHJldHVybjsgXG4gICAgICAgIH1cbiAgICAgICAgcG9zdC5yZW1vdmVBdHRyaWJ1dGUoUFJPQ0VTU0VEX0FUVFIpO1xuICAgICAgfVxuXG4gICAgICAvLyAyLiBQcmV2ZW50IGRvdWJsZSBib3JkZXJzXG4gICAgICBpZiAocG9zdC5wYXJlbnRFbGVtZW50Py5jbG9zZXN0KFBPU1RfU0VMRUNUT1IpKSByZXR1cm47XG5cbiAgICAgIC8vIDMuIENoZWNrIGZvciBjb21tZW50cyB0ZXh0XG4gICAgICBjb25zdCByYXdUZXh0ID0gKHBvc3QuaW5uZXJUZXh0IHx8ICcnKSArICcgJyArIGdldEFyaWFMYWJlbHMocG9zdCk7XG4gICAgICBjb25zdCBtYXRjaCA9IHJhd1RleHQubWF0Y2goLyhcXGQrKVxccytjbGFzcyBjb21tZW50L2kpO1xuICAgICAgY29uc3QgY291bnQgPSBtYXRjaCA/IHBhcnNlSW50KG1hdGNoWzFdLCAxMCkgOiAwO1xuXG4gICAgICBpZiAoY291bnQgPiAwKSB7XG4gICAgICAgIHBvc3Quc2V0QXR0cmlidXRlKFBST0NFU1NFRF9BVFRSLCAndHJ1ZScpO1xuICAgICAgICBjcmVhdGVPdmVybGF5KHBvc3QsIGNvdW50KTtcbiAgICAgIH1cbiAgICB9KTtcbiAgfSBjYXRjaCAoZXJyKSB7XG4gICAgY29uc29sZS53YXJuKCdDUUQgU2NhbiBFcnJvcjonLCBlcnIpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZU92ZXJsYXkocG9zdDogSFRNTEVsZW1lbnQsIGNvdW50OiBudW1iZXIpIHtcbiAgY29uc3QgY29tcHV0ZWQgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShwb3N0KTtcbiAgY29uc3QgYm9yZGVyUmFkaXVzID0gY29tcHV0ZWQuYm9yZGVyUmFkaXVzIHx8ICc4cHgnO1xuXG4gIC8vIC0tLSBMQVlPVVQgRklYRVMgLS0tXG4gIGlmIChjb21wdXRlZC5wb3NpdGlvbiA9PT0gJ3N0YXRpYycpIHtcbiAgICBwb3N0LnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgfVxuICBcbiAgcG9zdC5zdHlsZS5zZXRQcm9wZXJ0eSgnb3ZlcmZsb3cnLCAndmlzaWJsZScsICdpbXBvcnRhbnQnKTtcbiAgcG9zdC5zdHlsZS5zZXRQcm9wZXJ0eSgnY29udGFpbicsICdub25lJywgJ2ltcG9ydGFudCcpO1xuICBwb3N0LnN0eWxlLnpJbmRleCA9ICcxJztcblxuICAvLyAtLS0gQS4gVEhFIEZSQU1FIC0tLVxuICBjb25zdCBvdmVybGF5ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIG92ZXJsYXkuY2xhc3NOYW1lID0gJ2NxZC1vdmVybGF5LWNvbnRhaW5lcic7XG4gIG92ZXJsYXkuc3R5bGUuYm9yZGVyUmFkaXVzID0gYm9yZGVyUmFkaXVzO1xuICBcbiAgb3ZlcmxheS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgaWYgKGUudGFyZ2V0ID09PSBvdmVybGF5KSB0cmlnZ2VyUG9zdENsaWNrKHBvc3QpO1xuICB9KTtcbiAgcG9zdC5hcHBlbmRDaGlsZChvdmVybGF5KTtcblxuICAvLyAtLS0gQi4gVEhFIFZFUlRJQ0FMIEJBREdFIC0tLVxuICBjb25zdCBiYWRnZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ2RpdicpO1xuICBiYWRnZS5jbGFzc05hbWUgPSAnY3FkLWNvbW1lbnQtYmFkZ2UnO1xuICBiYWRnZS50aXRsZSA9IGAke2NvdW50fSBjb21tZW50c2A7XG5cbiAgLy8gMS4gSWNvblxuICBjb25zdCBpY29uRGl2ID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnZGl2Jyk7XG4gIGljb25EaXYuY2xhc3NOYW1lID0gJ2NxZC1iYWRnZS1pY29uJztcbiAgaWNvbkRpdi5zdHlsZS5iYWNrZ3JvdW5kSW1hZ2UgPSBgdXJsKFwiJHtDT01NRU5UX0lDT05fVVJMfVwiKWA7XG5cbiAgLy8gMi4gTGFiZWwgKE51bWJlciBPbmx5KVxuICBjb25zdCBsYWJlbERpdiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgbGFiZWxEaXYuY2xhc3NOYW1lID0gJ2NxZC1iYWRnZS1sYWJlbCc7XG4gIGxhYmVsRGl2LnRleHRDb250ZW50ID0gYCR7Y291bnR9YDsgLy8gSnVzdCB0aGUgbnVtYmVyXG5cbiAgYmFkZ2UuYXBwZW5kQ2hpbGQoaWNvbkRpdik7XG4gIGJhZGdlLmFwcGVuZENoaWxkKGxhYmVsRGl2KTtcblxuICBiYWRnZS5hZGRFdmVudExpc3RlbmVyKCdjbGljaycsIChlKSA9PiB7XG4gICAgZS5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICB0cmlnZ2VyUG9zdENsaWNrKHBvc3QpO1xuICB9KTtcblxuICBwb3N0LmFwcGVuZENoaWxkKGJhZGdlKTtcbn1cblxuZnVuY3Rpb24gdHJpZ2dlclBvc3RDbGljayhwb3N0OiBIVE1MRWxlbWVudCkge1xuICBjb25zdCB0aXRsZUxpbmsgPSBwb3N0LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdhW2hyZWYqPVwiL2RldGFpbHMvXCJdLCBoMiBhJyk7XG4gIGlmICh0aXRsZUxpbmspIHtcbiAgICB0aXRsZUxpbmsuY2xpY2soKTtcbiAgfSBlbHNlIHtcbiAgICBwb3N0LmNsaWNrKCk7XG4gIH1cbn1cblxuZnVuY3Rpb24gZ2V0UGFnZURpcmVjdGlvbigpOiAnbHRyJyB8ICdydGwnIHtcbiAgY29uc3QgZG9jRGlyID0gZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50LmRpciB8fCBkb2N1bWVudC5ib2R5LmRpcjtcbiAgaWYgKGRvY0RpciA9PT0gJ3J0bCcpIHJldHVybiAncnRsJztcbiAgY29uc3QgY29tcHV0ZWQgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShkb2N1bWVudC5ib2R5KS5kaXJlY3Rpb247XG4gIHJldHVybiBjb21wdXRlZCA9PT0gJ3J0bCcgPyAncnRsJyA6ICdsdHInO1xufVxuXG5mdW5jdGlvbiBnZXRBcmlhTGFiZWxzKGVsOiBIVE1MRWxlbWVudCk6IHN0cmluZyB7XG4gIHJldHVybiBBcnJheS5mcm9tKGVsLnF1ZXJ5U2VsZWN0b3JBbGwoJ1thcmlhLWxhYmVsXScpKVxuICAgIC5tYXAoKG5vZGUpID0+IG5vZGUuZ2V0QXR0cmlidXRlKCdhcmlhLWxhYmVsJykgfHwgJycpXG4gICAgLmpvaW4oJyAnKTtcbn0iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCJmdW5jdGlvbiBwcmludChtZXRob2QsIC4uLmFyZ3MpIHtcbiAgaWYgKGltcG9ydC5tZXRhLmVudi5NT0RFID09PSBcInByb2R1Y3Rpb25cIikgcmV0dXJuO1xuICBpZiAodHlwZW9mIGFyZ3NbMF0gPT09IFwic3RyaW5nXCIpIHtcbiAgICBjb25zdCBtZXNzYWdlID0gYXJncy5zaGlmdCgpO1xuICAgIG1ldGhvZChgW3d4dF0gJHttZXNzYWdlfWAsIC4uLmFyZ3MpO1xuICB9IGVsc2Uge1xuICAgIG1ldGhvZChcIlt3eHRdXCIsIC4uLmFyZ3MpO1xuICB9XG59XG5leHBvcnQgY29uc3QgbG9nZ2VyID0ge1xuICBkZWJ1ZzogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZGVidWcsIC4uLmFyZ3MpLFxuICBsb2c6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmxvZywgLi4uYXJncyksXG4gIHdhcm46ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLndhcm4sIC4uLmFyZ3MpLFxuICBlcnJvcjogKC4uLmFyZ3MpID0+IHByaW50KGNvbnNvbGUuZXJyb3IsIC4uLmFyZ3MpXG59O1xuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuZXhwb3J0IGNsYXNzIFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQgZXh0ZW5kcyBFdmVudCB7XG4gIGNvbnN0cnVjdG9yKG5ld1VybCwgb2xkVXJsKSB7XG4gICAgc3VwZXIoV3h0TG9jYXRpb25DaGFuZ2VFdmVudC5FVkVOVF9OQU1FLCB7fSk7XG4gICAgdGhpcy5uZXdVcmwgPSBuZXdVcmw7XG4gICAgdGhpcy5vbGRVcmwgPSBvbGRVcmw7XG4gIH1cbiAgc3RhdGljIEVWRU5UX05BTUUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXCJ3eHQ6bG9jYXRpb25jaGFuZ2VcIik7XG59XG5leHBvcnQgZnVuY3Rpb24gZ2V0VW5pcXVlRXZlbnROYW1lKGV2ZW50TmFtZSkge1xuICByZXR1cm4gYCR7YnJvd3Nlcj8ucnVudGltZT8uaWR9OiR7aW1wb3J0Lm1ldGEuZW52LkVOVFJZUE9JTlR9OiR7ZXZlbnROYW1lfWA7XG59XG4iLCJpbXBvcnQgeyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IH0gZnJvbSBcIi4vY3VzdG9tLWV2ZW50cy5tanNcIjtcbmV4cG9ydCBmdW5jdGlvbiBjcmVhdGVMb2NhdGlvbldhdGNoZXIoY3R4KSB7XG4gIGxldCBpbnRlcnZhbDtcbiAgbGV0IG9sZFVybDtcbiAgcmV0dXJuIHtcbiAgICAvKipcbiAgICAgKiBFbnN1cmUgdGhlIGxvY2F0aW9uIHdhdGNoZXIgaXMgYWN0aXZlbHkgbG9va2luZyBmb3IgVVJMIGNoYW5nZXMuIElmIGl0J3MgYWxyZWFkeSB3YXRjaGluZyxcbiAgICAgKiB0aGlzIGlzIGEgbm9vcC5cbiAgICAgKi9cbiAgICBydW4oKSB7XG4gICAgICBpZiAoaW50ZXJ2YWwgIT0gbnVsbCkgcmV0dXJuO1xuICAgICAgb2xkVXJsID0gbmV3IFVSTChsb2NhdGlvbi5ocmVmKTtcbiAgICAgIGludGVydmFsID0gY3R4LnNldEludGVydmFsKCgpID0+IHtcbiAgICAgICAgbGV0IG5ld1VybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICAgIGlmIChuZXdVcmwuaHJlZiAhPT0gb2xkVXJsLmhyZWYpIHtcbiAgICAgICAgICB3aW5kb3cuZGlzcGF0Y2hFdmVudChuZXcgV3h0TG9jYXRpb25DaGFuZ2VFdmVudChuZXdVcmwsIG9sZFVybCkpO1xuICAgICAgICAgIG9sZFVybCA9IG5ld1VybDtcbiAgICAgICAgfVxuICAgICAgfSwgMWUzKTtcbiAgICB9XG4gIH07XG59XG4iLCJpbXBvcnQgeyBicm93c2VyIH0gZnJvbSBcInd4dC9icm93c2VyXCI7XG5pbXBvcnQgeyBsb2dnZXIgfSBmcm9tIFwiLi4vdXRpbHMvaW50ZXJuYWwvbG9nZ2VyLm1qc1wiO1xuaW1wb3J0IHtcbiAgZ2V0VW5pcXVlRXZlbnROYW1lXG59IGZyb20gXCIuL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzXCI7XG5pbXBvcnQgeyBjcmVhdGVMb2NhdGlvbldhdGNoZXIgfSBmcm9tIFwiLi9pbnRlcm5hbC9sb2NhdGlvbi13YXRjaGVyLm1qc1wiO1xuZXhwb3J0IGNsYXNzIENvbnRlbnRTY3JpcHRDb250ZXh0IHtcbiAgY29uc3RydWN0b3IoY29udGVudFNjcmlwdE5hbWUsIG9wdGlvbnMpIHtcbiAgICB0aGlzLmNvbnRlbnRTY3JpcHROYW1lID0gY29udGVudFNjcmlwdE5hbWU7XG4gICAgdGhpcy5vcHRpb25zID0gb3B0aW9ucztcbiAgICB0aGlzLmFib3J0Q29udHJvbGxlciA9IG5ldyBBYm9ydENvbnRyb2xsZXIoKTtcbiAgICBpZiAodGhpcy5pc1RvcEZyYW1lKSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cyh7IGlnbm9yZUZpcnN0RXZlbnQ6IHRydWUgfSk7XG4gICAgICB0aGlzLnN0b3BPbGRTY3JpcHRzKCk7XG4gICAgfSBlbHNlIHtcbiAgICAgIHRoaXMubGlzdGVuRm9yTmV3ZXJTY3JpcHRzKCk7XG4gICAgfVxuICB9XG4gIHN0YXRpYyBTQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUgPSBnZXRVbmlxdWVFdmVudE5hbWUoXG4gICAgXCJ3eHQ6Y29udGVudC1zY3JpcHQtc3RhcnRlZFwiXG4gICk7XG4gIGlzVG9wRnJhbWUgPSB3aW5kb3cuc2VsZiA9PT0gd2luZG93LnRvcDtcbiAgYWJvcnRDb250cm9sbGVyO1xuICBsb2NhdGlvbldhdGNoZXIgPSBjcmVhdGVMb2NhdGlvbldhdGNoZXIodGhpcyk7XG4gIHJlY2VpdmVkTWVzc2FnZUlkcyA9IC8qIEBfX1BVUkVfXyAqLyBuZXcgU2V0KCk7XG4gIGdldCBzaWduYWwoKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLnNpZ25hbDtcbiAgfVxuICBhYm9ydChyZWFzb24pIHtcbiAgICByZXR1cm4gdGhpcy5hYm9ydENvbnRyb2xsZXIuYWJvcnQocmVhc29uKTtcbiAgfVxuICBnZXQgaXNJbnZhbGlkKCkge1xuICAgIGlmIChicm93c2VyLnJ1bnRpbWUuaWQgPT0gbnVsbCkge1xuICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgIH1cbiAgICByZXR1cm4gdGhpcy5zaWduYWwuYWJvcnRlZDtcbiAgfVxuICBnZXQgaXNWYWxpZCgpIHtcbiAgICByZXR1cm4gIXRoaXMuaXNJbnZhbGlkO1xuICB9XG4gIC8qKlxuICAgKiBBZGQgYSBsaXN0ZW5lciB0aGF0IGlzIGNhbGxlZCB3aGVuIHRoZSBjb250ZW50IHNjcmlwdCdzIGNvbnRleHQgaXMgaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEByZXR1cm5zIEEgZnVuY3Rpb24gdG8gcmVtb3ZlIHRoZSBsaXN0ZW5lci5cbiAgICpcbiAgICogQGV4YW1wbGVcbiAgICogYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcihjYik7XG4gICAqIGNvbnN0IHJlbW92ZUludmFsaWRhdGVkTGlzdGVuZXIgPSBjdHgub25JbnZhbGlkYXRlZCgoKSA9PiB7XG4gICAqICAgYnJvd3Nlci5ydW50aW1lLm9uTWVzc2FnZS5yZW1vdmVMaXN0ZW5lcihjYik7XG4gICAqIH0pXG4gICAqIC8vIC4uLlxuICAgKiByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyKCk7XG4gICAqL1xuICBvbkludmFsaWRhdGVkKGNiKSB7XG4gICAgdGhpcy5zaWduYWwuYWRkRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgICByZXR1cm4gKCkgPT4gdGhpcy5zaWduYWwucmVtb3ZlRXZlbnRMaXN0ZW5lcihcImFib3J0XCIsIGNiKTtcbiAgfVxuICAvKipcbiAgICogUmV0dXJuIGEgcHJvbWlzZSB0aGF0IG5ldmVyIHJlc29sdmVzLiBVc2VmdWwgaWYgeW91IGhhdmUgYW4gYXN5bmMgZnVuY3Rpb24gdGhhdCBzaG91bGRuJ3QgcnVuXG4gICAqIGFmdGVyIHRoZSBjb250ZXh0IGlzIGV4cGlyZWQuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGNvbnN0IGdldFZhbHVlRnJvbVN0b3JhZ2UgPSBhc3luYyAoKSA9PiB7XG4gICAqICAgaWYgKGN0eC5pc0ludmFsaWQpIHJldHVybiBjdHguYmxvY2soKTtcbiAgICpcbiAgICogICAvLyAuLi5cbiAgICogfVxuICAgKi9cbiAgYmxvY2soKSB7XG4gICAgcmV0dXJuIG5ldyBQcm9taXNlKCgpID0+IHtcbiAgICB9KTtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5zZXRJbnRlcnZhbGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogSW50ZXJ2YWxzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2xlYXJJbnRlcnZhbGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRJbnRlcnZhbChoYW5kbGVyLCB0aW1lb3V0KSB7XG4gICAgY29uc3QgaWQgPSBzZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFySW50ZXJ2YWwoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0VGltZW91dGAgdGhhdCBhdXRvbWF0aWNhbGx5IGNsZWFycyB0aGUgaW50ZXJ2YWwgd2hlbiBpbnZhbGlkYXRlZC5cbiAgICpcbiAgICogVGltZW91dHMgY2FuIGJlIGNsZWFyZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBzZXRUaW1lb3V0YCBmdW5jdGlvbi5cbiAgICovXG4gIHNldFRpbWVvdXQoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSBoYW5kbGVyKCk7XG4gICAgfSwgdGltZW91dCk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNsZWFyVGltZW91dChpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0QW5pbWF0aW9uRnJhbWVgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxBbmltYXRpb25GcmFtZWAgZnVuY3Rpb24uXG4gICAqL1xuICByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoY2FsbGJhY2spIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RBbmltYXRpb25GcmFtZSgoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbEFuaW1hdGlvbkZyYW1lKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnJlcXVlc3RJZGxlQ2FsbGJhY2tgIHRoYXQgYXV0b21hdGljYWxseSBjYW5jZWxzIHRoZSByZXF1ZXN0IHdoZW5cbiAgICogaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIENhbGxiYWNrcyBjYW4gYmUgY2FuY2VsZWQgYnkgY2FsbGluZyB0aGUgbm9ybWFsIGBjYW5jZWxJZGxlQ2FsbGJhY2tgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdElkbGVDYWxsYmFjayhjYWxsYmFjaywgb3B0aW9ucykge1xuICAgIGNvbnN0IGlkID0gcmVxdWVzdElkbGVDYWxsYmFjaygoLi4uYXJncykgPT4ge1xuICAgICAgaWYgKCF0aGlzLnNpZ25hbC5hYm9ydGVkKSBjYWxsYmFjayguLi5hcmdzKTtcbiAgICB9LCBvcHRpb25zKTtcbiAgICB0aGlzLm9uSW52YWxpZGF0ZWQoKCkgPT4gY2FuY2VsSWRsZUNhbGxiYWNrKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIGFkZEV2ZW50TGlzdGVuZXIodGFyZ2V0LCB0eXBlLCBoYW5kbGVyLCBvcHRpb25zKSB7XG4gICAgaWYgKHR5cGUgPT09IFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpIHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIHRoaXMubG9jYXRpb25XYXRjaGVyLnJ1bigpO1xuICAgIH1cbiAgICB0YXJnZXQuYWRkRXZlbnRMaXN0ZW5lcj8uKFxuICAgICAgdHlwZS5zdGFydHNXaXRoKFwid3h0OlwiKSA/IGdldFVuaXF1ZUV2ZW50TmFtZSh0eXBlKSA6IHR5cGUsXG4gICAgICBoYW5kbGVyLFxuICAgICAge1xuICAgICAgICAuLi5vcHRpb25zLFxuICAgICAgICBzaWduYWw6IHRoaXMuc2lnbmFsXG4gICAgICB9XG4gICAgKTtcbiAgfVxuICAvKipcbiAgICogQGludGVybmFsXG4gICAqIEFib3J0IHRoZSBhYm9ydCBjb250cm9sbGVyIGFuZCBleGVjdXRlIGFsbCBgb25JbnZhbGlkYXRlZGAgbGlzdGVuZXJzLlxuICAgKi9cbiAgbm90aWZ5SW52YWxpZGF0ZWQoKSB7XG4gICAgdGhpcy5hYm9ydChcIkNvbnRlbnQgc2NyaXB0IGNvbnRleHQgaW52YWxpZGF0ZWRcIik7XG4gICAgbG9nZ2VyLmRlYnVnKFxuICAgICAgYENvbnRlbnQgc2NyaXB0IFwiJHt0aGlzLmNvbnRlbnRTY3JpcHROYW1lfVwiIGNvbnRleHQgaW52YWxpZGF0ZWRgXG4gICAgKTtcbiAgfVxuICBzdG9wT2xkU2NyaXB0cygpIHtcbiAgICB3aW5kb3cucG9zdE1lc3NhZ2UoXG4gICAgICB7XG4gICAgICAgIHR5cGU6IENvbnRlbnRTY3JpcHRDb250ZXh0LlNDUklQVF9TVEFSVEVEX01FU1NBR0VfVFlQRSxcbiAgICAgICAgY29udGVudFNjcmlwdE5hbWU6IHRoaXMuY29udGVudFNjcmlwdE5hbWUsXG4gICAgICAgIG1lc3NhZ2VJZDogTWF0aC5yYW5kb20oKS50b1N0cmluZygzNikuc2xpY2UoMilcbiAgICAgIH0sXG4gICAgICBcIipcIlxuICAgICk7XG4gIH1cbiAgdmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSB7XG4gICAgY29uc3QgaXNTY3JpcHRTdGFydGVkRXZlbnQgPSBldmVudC5kYXRhPy50eXBlID09PSBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEU7XG4gICAgY29uc3QgaXNTYW1lQ29udGVudFNjcmlwdCA9IGV2ZW50LmRhdGE/LmNvbnRlbnRTY3JpcHROYW1lID09PSB0aGlzLmNvbnRlbnRTY3JpcHROYW1lO1xuICAgIGNvbnN0IGlzTm90RHVwbGljYXRlID0gIXRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmhhcyhldmVudC5kYXRhPy5tZXNzYWdlSWQpO1xuICAgIHJldHVybiBpc1NjcmlwdFN0YXJ0ZWRFdmVudCAmJiBpc1NhbWVDb250ZW50U2NyaXB0ICYmIGlzTm90RHVwbGljYXRlO1xuICB9XG4gIGxpc3RlbkZvck5ld2VyU2NyaXB0cyhvcHRpb25zKSB7XG4gICAgbGV0IGlzRmlyc3QgPSB0cnVlO1xuICAgIGNvbnN0IGNiID0gKGV2ZW50KSA9PiB7XG4gICAgICBpZiAodGhpcy52ZXJpZnlTY3JpcHRTdGFydGVkRXZlbnQoZXZlbnQpKSB7XG4gICAgICAgIHRoaXMucmVjZWl2ZWRNZXNzYWdlSWRzLmFkZChldmVudC5kYXRhLm1lc3NhZ2VJZCk7XG4gICAgICAgIGNvbnN0IHdhc0ZpcnN0ID0gaXNGaXJzdDtcbiAgICAgICAgaXNGaXJzdCA9IGZhbHNlO1xuICAgICAgICBpZiAod2FzRmlyc3QgJiYgb3B0aW9ucz8uaWdub3JlRmlyc3RFdmVudCkgcmV0dXJuO1xuICAgICAgICB0aGlzLm5vdGlmeUludmFsaWRhdGVkKCk7XG4gICAgICB9XG4gICAgfTtcbiAgICBhZGRFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYik7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IHJlbW92ZUV2ZW50TGlzdGVuZXIoXCJtZXNzYWdlXCIsIGNiKSk7XG4gIH1cbn1cbiJdLCJuYW1lcyI6WyJkZWZpbml0aW9uIiwiYnJvd3NlciIsIl9icm93c2VyIiwicHJpbnQiLCJsb2dnZXIiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxvQkFBb0JBLGFBQVk7QUFDOUMsV0FBT0E7QUFBQSxFQUNUO0FDQ08sUUFB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
commentframe;