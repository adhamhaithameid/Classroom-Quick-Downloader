var content = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const CLASSROOM_URL_PATTERN = /^https:\/\/classroom\.google\.com\//;
  const ICON_SVG_RAW = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="white">
  <path d="M5 20h14v-2H5v2z"/>
  <path d="M11 4v8.17L8.41 9.59 7 11l5 5 5-5-1.41-1.41L13 12.17V4h-2z"/>
</svg>
`.trim();
  const ICON_SVG_URL = `data:image/svg+xml;utf8,${encodeURIComponent(ICON_SVG_RAW)}`;
  const STYLE_ID = "cqd-style";
  const INJECTED_ATTR = "data-cqd-injected";
  const RESCAN_INTERVAL_MS = 2e3;
  const RESCAN_DEBOUNCE_MS = 250;
  const SPINNER_SIZE_PX = 16;
  const LOADING_MIN_MS = 600;
  const FEEDBACK_SUCCESS_MS = 1500;
  const FEEDBACK_ERROR_MS = 1400;
  const DRIVE_ANCHOR_SELECTOR = 'a[href*="https://drive.google.com"], a[href*="//drive.google.com"], a[href*="classroom.google.com/drive"]';
  const ATTACHMENT_CONTAINER_SELECTOR = [
    ".KlRXdf",
    // common attachment card
    ".z3vRcc",
    // chip-like attachment
    ".VfPpkd-aPP78e",
    // Material card wrapper
    "[data-drive-id]",
    // Drive attachment
    "[data-id][data-item-id]"
    // metadata blocks
  ].join(", ");
  const DRIVE_URL_PATTERNS = [
    /https:\/\/drive\.google\.com\/file\/d\//,
    /https:\/\/drive\.google\.com\/open\?/,
    /https:\/\/drive\.google\.com\/uc\?/,
    /https:\/\/classroom\.google\.com\/drive\//
  ];
  let scanTimeoutId = null;
  let observer = null;
  function isGoogleClassroom() {
    if (typeof location === "undefined") return false;
    if (location.hostname !== "classroom.google.com") return false;
    return CLASSROOM_URL_PATTERN.test(location.href);
  }
  function injectStyles() {
    if (typeof document === "undefined") return;
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
    /* SINGLE ATTACHMENT BUTTONS (circle -> pill on hover) */
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
      border-radius: 9999px;
      border: none;
      padding: 0;
      background-color: #1a73e8;
      color: #ffffff;
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.22);
      cursor: pointer;
      transform: translateY(-50%) scale(1);
      will-change: transform, box-shadow, width, border-radius, padding-inline;
      transition:
        width 220ms cubic-bezier(0.2, 0, 0, 1),
        padding-inline 220ms cubic-bezier(0.2, 0, 0, 1),
        border-radius 220ms cubic-bezier(0.2, 0, 0, 1),
        box-shadow 220ms cubic-bezier(0.2, 0, 0, 1),
        transform 220ms cubic-bezier(0.2, 0, 0, 1),
        background-color 220ms cubic-bezier(0.2, 0, 0, 1);
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 13px;
      white-space: nowrap;
      overflow: hidden;
    }

    .cqd-download-btn:hover {
      width: 120px;
      padding-inline: 12px;
      box-shadow: 0 10px 24px rgba(15, 23, 42, 0.30);
      justify-content: flex-start;
      transform: translateY(calc(-50% - 1px)) scale(1.04);
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

    .cqd-download-btn .cqd-label {
      opacity: 0;
      margin-left: 0;
      max-width: 0;
      overflow: hidden;
      transition:
        opacity 200ms cubic-bezier(0.2, 0, 0, 1),
        max-width 200ms cubic-bezier(0.2, 0, 0, 1),
        margin-left 200ms cubic-bezier(0.2, 0, 0, 1);
    }

    .cqd-download-btn:hover .cqd-label {
      opacity: 1;
      max-width: 100px;
      margin-left: 6px;
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
      background-image: url("${ICON_SVG_URL}");
      background-repeat: no-repeat;
      background-position: center;
      background-size: 24px 24px;
      filter: drop-shadow(0 0 1px rgba(0, 0, 0, 0.35));
      flex-shrink: 0;
      transform-origin: center;
      transition:
        width 200ms cubic-bezier(0.2, 0, 0, 1),
        height 200ms cubic-bezier(0.2, 0, 0, 1),
        border-width 200ms cubic-bezier(0.2, 0, 0, 1);
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

    /* PILL STATES (loading / success / error) */
    .cqd-download-btn.cqd-loading,
    .cqd-download-btn.cqd-success,
    .cqd-download-btn.cqd-error {
      width: 140px;
      padding-inline: 12px;
      border-radius: 20px;
      justify-content: flex-start;
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
      cursor: default;
    }

    .cqd-download-btn.cqd-loading .cqd-label,
    .cqd-download-btn.cqd-success .cqd-label,
    .cqd-download-btn.cqd-error .cqd-label {
      opacity: 1;
      max-width: 110px;
      margin-left: 8px;
    }

    .cqd-download-btn.cqd-loading:hover,
    .cqd-download-btn.cqd-success:hover,
    .cqd-download-btn.cqd-error:hover {
      width: 140px;
      padding-inline: 12px;
      border-radius: 20px;
      transform: translateY(-50%) scale(1);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
    }

    .cqd-download-btn.cqd-loading:active,
    .cqd-download-btn.cqd-success:active,
    .cqd-download-btn.cqd-error:active {
      transform: translateY(-50%) scale(1);
      box-shadow: 0 8px 22px rgba(15, 23, 42, 0.30);
    }

    /* Material-like circular spinner: arc on a circle, rotating.
       The diameter is controlled by SPINNER_SIZE_PX. */
    .cqd-spinner {
      background-image: none;
      border-radius: 9999px;
      width: ${SPINNER_SIZE_PX}px;
      height: ${SPINNER_SIZE_PX}px;
      border-style: solid;
      border-width: 3px;
      border-color: rgba(255, 255, 255, 0.22);
      border-top-color: #ffffff;
      border-right-color: #ffffff;
      box-shadow: none;
      animation: cqd-spin 0.9s linear infinite;
    }

    @keyframes cqd-spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    /* Success / error icons using emoji, no background image */
    .cqd-icon-check,
    .cqd-icon-cross {
      background-image: none;
      width: 18px;
      height: 18px;
      box-shadow: none;
      font-size: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .cqd-icon-cross {
      font-size: 15px;
    }
  `.trim();
    (document.head || document.documentElement).appendChild(style);
  }
  function scheduleScan() {
    if (scanTimeoutId !== null) {
      window.clearTimeout(scanTimeoutId);
    }
    scanTimeoutId = window.setTimeout(() => {
      scanTimeoutId = null;
      scanForAttachments();
    }, RESCAN_DEBOUNCE_MS);
  }
  function setupObservers() {
    if (typeof document === "undefined") return;
    if (!document.body) {
      window.addEventListener(
        "DOMContentLoaded",
        () => {
          setupObservers();
        },
        { once: true }
      );
      return;
    }
    if (observer) return;
    observer = new MutationObserver((mutations) => {
      const hasChildListChange = mutations.some(
        (m) => m.type === "childList" && (m.addedNodes.length > 0 || m.removedNodes.length > 0)
      );
      if (hasChildListChange) {
        scheduleScan();
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setInterval(() => {
      scheduleScan();
    }, RESCAN_INTERVAL_MS);
    scheduleScan();
  }
  function scanForAttachments() {
    if (!isGoogleClassroom()) return;
    if (typeof document === "undefined") return;
    injectSingleFileButtons();
  }
  function injectSingleFileButtons() {
    const anchors = Array.from(
      document.querySelectorAll(DRIVE_ANCHOR_SELECTOR)
    );
    for (const anchor of anchors) {
      const url = extractDriveUrlFromAnchor(anchor);
      if (!url) continue;
      const container = anchor.closest(ATTACHMENT_CONTAINER_SELECTOR) || anchor.parentElement || anchor;
      if (!container) continue;
      if (hasInjectedButton(container)) continue;
      injectButtonIntoAttachment(container, url);
    }
    const metaElements = Array.from(
      document.querySelectorAll(
        "[data-drive-id], [data-id][data-item-id], [data-id][data-tooltip]"
      )
    );
    for (const el of metaElements) {
      if (hasInjectedButton(el)) continue;
      const url = findDriveUrl(el);
      if (!url) continue;
      injectButtonIntoAttachment(el, url);
    }
  }
  function hasInjectedButton(container) {
    return !!container.querySelector(`[${INJECTED_ATTR}="true"]`);
  }
  function extractDriveUrlFromAnchor(anchor) {
    const href = anchor.href;
    if (!href) return null;
    const isDriveUrl = DRIVE_URL_PATTERNS.some((re) => re.test(href));
    return isDriveUrl ? href : null;
  }
  function findDriveUrl(element) {
    const nearAnchor = element.querySelector(DRIVE_ANCHOR_SELECTOR) || element.closest(DRIVE_ANCHOR_SELECTOR);
    if (nearAnchor) {
      const href = extractDriveUrlFromAnchor(nearAnchor);
      if (href) return href;
    }
    const driveId = element.getAttribute("data-drive-id") || element.getAttribute("data-id");
    if (driveId) {
      const anchorWithId = document.querySelector(`a[data-drive-id="${driveId}"]`) || document.querySelector(`a[data-id="${driveId}"]`) || document.querySelector(`a[href*="${driveId}"]`);
      if (anchorWithId) {
        const href = extractDriveUrlFromAnchor(anchorWithId);
        if (href) return href;
      }
      return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(driveId)}`;
    }
    return null;
  }
  function toDownloadUrl(originalUrl, depth = 0) {
    if (depth > 3) return originalUrl;
    try {
      const parsed = new URL(originalUrl, location.href);
      const hostname = parsed.hostname;
      const pathname = parsed.pathname;
      if (hostname === "drive.google.com") {
        if (pathname.startsWith("/auth_warmup")) {
          const cont = parsed.searchParams.get("continue");
          if (cont) return toDownloadUrl(cont, depth + 1);
          const id = parsed.searchParams.get("id");
          if (id) {
            return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
          }
          return originalUrl;
        }
        const fileMatch = pathname.match(/^\/file\/d\/([^/]+)/);
        if (fileMatch) {
          const id = fileMatch[1];
          return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
        }
        if (pathname === "/open") {
          const id = parsed.searchParams.get("id");
          if (id) {
            return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
          }
        }
        if (pathname === "/uc") {
          parsed.searchParams.set("export", "download");
          return parsed.toString();
        }
      }
      if (hostname === "classroom.google.com" && pathname.startsWith("/drive")) {
        const id = parsed.searchParams.get("id") || parsed.searchParams.get("resourceId") || parsed.searchParams.get("fileId");
        if (id) {
          return `https://drive.google.com/uc?export=download&id=${encodeURIComponent(id)}`;
        }
      }
      return originalUrl;
    } catch {
      return originalUrl;
    }
  }
  function injectButtonIntoAttachment(container, url) {
    if (!url) return;
    const computed = window.getComputedStyle(container);
    if (computed.position === "static") {
      container.style.position = "relative";
    }
    const button = createDownloadButton(url);
    const iconEl = button.querySelector(".cqd-download-icon");
    if (iconEl) {
      iconEl.classList.add("cqd-icon-medium");
    }
    container.appendChild(button);
  }
  function getButtonState(button) {
    if (button.classList.contains("cqd-loading")) return "loading";
    if (button.classList.contains("cqd-success")) return "success";
    if (button.classList.contains("cqd-error")) return "error";
    return "idle";
  }
  function setButtonState(button, state) {
    const icon = button.querySelector(".cqd-download-icon");
    const label = button.querySelector(".cqd-label");
    if (!icon || !label) return;
    button.classList.remove("cqd-loading", "cqd-success", "cqd-error");
    icon.classList.remove("cqd-spinner", "cqd-icon-check", "cqd-icon-cross");
    icon.textContent = "";
    button.disabled = false;
    button.style.backgroundColor = "#1a73e8";
    label.textContent = "Download";
    switch (state) {
      case "idle":
        break;
      case "loading":
        button.classList.add("cqd-loading");
        button.disabled = true;
        label.textContent = "Downloading…";
        icon.classList.add("cqd-spinner");
        break;
      case "success":
        button.classList.add("cqd-success");
        button.style.backgroundColor = "#188038";
        label.textContent = "Downloaded";
        icon.classList.add("cqd-icon-check");
        icon.textContent = "✅";
        break;
      case "error":
        button.classList.add("cqd-error");
        button.style.backgroundColor = "#d93025";
        label.textContent = "Error";
        icon.classList.add("cqd-icon-cross");
        icon.textContent = "❌";
        break;
    }
  }
  function createDownloadButton(url) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "cqd-download-btn";
    button.setAttribute(INJECTED_ATTR, "true");
    button.setAttribute("aria-label", "Quick download attachment");
    button.setAttribute("title", "Quick download");
    const iconWrapper = document.createElement("span");
    iconWrapper.className = "cqd-icon-wrapper";
    const iconSpan = document.createElement("span");
    iconSpan.className = "cqd-download-icon";
    iconWrapper.appendChild(iconSpan);
    const label = document.createElement("span");
    label.className = "cqd-label";
    label.textContent = "Download";
    button.appendChild(iconWrapper);
    button.appendChild(label);
    button.addEventListener("click", async (event) => {
      event.preventDefault();
      event.stopPropagation();
      await handleSingleDownloadClick(button, url);
    });
    button.addEventListener("auxclick", async (event) => {
      if (event.button !== 1) return;
      event.preventDefault();
      event.stopPropagation();
      await handleSingleDownloadClick(button, url);
    });
    return button;
  }
  async function handleSingleDownloadClick(button, url) {
    if (!url) return;
    if (getButtonState(button) === "loading") return;
    setButtonState(button, "loading");
    const start = Date.now();
    const ok = await downloadFile(url);
    const elapsed = Date.now() - start;
    if (elapsed < LOADING_MIN_MS) {
      await delay(LOADING_MIN_MS - elapsed);
    }
    if (ok) {
      setButtonState(button, "success");
      await delay(FEEDBACK_SUCCESS_MS);
    } else {
      setButtonState(button, "error");
      await delay(FEEDBACK_ERROR_MS);
    }
    setButtonState(button, "idle");
  }
  function downloadFile(rawUrl) {
    if (!rawUrl || !/^https?:\/\//i.test(rawUrl)) return Promise.resolve(false);
    const finalUrl = toDownloadUrl(rawUrl);
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return Promise.resolve(false);
    }
    if (/https:\/\/drive\.google\.com\/auth_warmup/.test(finalUrl)) {
      return Promise.resolve(false);
    }
    const hasChromeRuntime = typeof chrome !== "undefined" && !!chrome.runtime && typeof chrome.runtime.sendMessage === "function";
    if (hasChromeRuntime) {
      return new Promise((resolve) => {
        let resolved = false;
        try {
          chrome.runtime.sendMessage(
            { type: "CQD_DOWNLOAD", url: finalUrl },
            (response) => {
              const err = chrome.runtime.lastError;
              if (err) {
                console.warn("[CQD] sendMessage error:", err.message);
                fallbackAnchorDownload(finalUrl);
                if (!resolved) {
                  resolved = true;
                  resolve(true);
                }
                return;
              }
              if (!response || response.ok === false) {
                if (response?.error) {
                  console.warn("[CQD] background download error:", response.error);
                }
                fallbackAnchorDownload(finalUrl);
                if (!resolved) {
                  resolved = true;
                  resolve(true);
                }
                return;
              }
              if (!resolved) {
                resolved = true;
                resolve(true);
              }
            }
          );
          window.setTimeout(() => {
            if (!resolved) {
              fallbackAnchorDownload(finalUrl);
              resolved = true;
              resolve(true);
            }
          }, 4e3);
        } catch (e) {
          console.warn("[CQD] sendMessage threw:", e);
          fallbackAnchorDownload(finalUrl);
          if (!resolved) resolve(true);
        }
      });
    }
    fallbackAnchorDownload(finalUrl);
    return Promise.resolve(true);
  }
  function fallbackAnchorDownload(url) {
    if (typeof document === "undefined") return;
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    anchor.style.display = "none";
    document.body.appendChild(anchor);
    anchor.click();
    window.setTimeout(() => {
      anchor.remove();
    }, 0);
  }
  function delay(ms) {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
  function initContentScript() {
    if (!isGoogleClassroom()) return;
    injectStyles();
    setupObservers();
  }
  const definition = defineContentScript({
    matches: ["https://classroom.google.com/*"],
    runAt: "document_idle",
    main() {
      initContentScript();
    }
  });
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
    return `${browser?.runtime?.id}:${"content"}:${eventName}`;
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
      const ctx = new ContentScriptContext("content", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"content"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29udGVudC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUyLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1jb250ZW50LXNjcmlwdC5tanMiLCIuLi8uLi8uLi9lbnRyeXBvaW50cy9jb250ZW50LnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3eHQtZGV2K2Jyb3dzZXJAMC4xLjQvbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41Mi4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41Mi4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUyLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUyLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUyLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvY29udGVudC50c1xuLy8gQ2xhc3Nyb29tIFF1aWNrIERvd25sb2FkZXIgLSBjb250ZW50IHNjcmlwdCAoc2luZ2xlLWZpbGUgYnV0dG9ucyBvbmx5KVxuLy9cbi8vIC0gUnVucyBvbmx5IG9uIGNsYXNzcm9vbS5nb29nbGUuY29tXG4vLyAtIEluamVjdHMgTWF0ZXJpYWwtc3R5bGUgZG93bmxvYWQgYnV0dG9ucyBvbiBhdHRhY2htZW50c1xuLy8gLSBFYWNoIGJ1dHRvbiBoYXMgc3RhdGVzOiBpZGxlIOKGkiBsb2FkaW5nIOKGkiBzdWNjZXNzL2Vycm9yIOKGkiBiYWNrIHRvIGlkbGVcbi8vICAgKiBpZGxlOiBjaXJjbGUgKyBkb3dubG9hZCBpY29uXG4vLyAgICogbG9hZGluZzogcGlsbCArIHNwaW5uZXIgKyBcIkRvd25sb2FkaW5n4oCmXCJcbi8vICAgKiBzdWNjZXNzOiBwaWxsICsg4pyFICsgZ3JlZW4gYmFja2dyb3VuZFxuLy8gICAqIGVycm9yOiBwaWxsICsg4p2MICsgcmVkIGJhY2tncm91bmRcblxuY29uc3QgQ0xBU1NST09NX1VSTF9QQVRURVJOID0gL15odHRwczpcXC9cXC9jbGFzc3Jvb21cXC5nb29nbGVcXC5jb21cXC8vO1xuXG4vKipcbiAqIE1hdGVyaWFsLXN0eWxlIGRvd25sb2FkIGljb24gKGFycm93IGRvd24gb250byBhIGJhciksXG4gKiBkZWxpdmVyZWQgdmlhIGRhdGE6IFVSTCB0byBzYXRpc2Z5IFwiaWNvbiBmcm9tIFVSTFwiIHJlcXVpcmVtZW50LlxuICovXG5jb25zdCBJQ09OX1NWR19SQVcgPSBgXG48c3ZnIHhtbG5zPVwiaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmdcIiB2aWV3Qm94PVwiMCAwIDI0IDI0XCIgZmlsbD1cIndoaXRlXCI+XG4gIDxwYXRoIGQ9XCJNNSAyMGgxNHYtMkg1djJ6XCIvPlxuICA8cGF0aCBkPVwiTTExIDR2OC4xN0w4LjQxIDkuNTkgNyAxMWw1IDUgNS01LTEuNDEtMS40MUwxMyAxMi4xN1Y0aC0yelwiLz5cbjwvc3ZnPlxuYC50cmltKCk7XG5cbmNvbnN0IElDT05fU1ZHX1VSTCA9IGBkYXRhOmltYWdlL3N2Zyt4bWw7dXRmOCwke2VuY29kZVVSSUNvbXBvbmVudChJQ09OX1NWR19SQVcpfWA7XG5cbmNvbnN0IFNUWUxFX0lEID0gJ2NxZC1zdHlsZSc7XG5jb25zdCBJTkpFQ1RFRF9BVFRSID0gJ2RhdGEtY3FkLWluamVjdGVkJztcbmNvbnN0IFJFU0NBTl9JTlRFUlZBTF9NUyA9IDIwMDA7XG5jb25zdCBSRVNDQU5fREVCT1VOQ0VfTVMgPSAyNTA7XG5cbi8vIFNwaW5uZXIgZGlhbWV0ZXIgKGluIHBpeGVscykg4oCUIHR3ZWFrIHRoaXMgdG8gY29udHJvbCBsb2FkZXIgc2l6ZVxuY29uc3QgU1BJTk5FUl9TSVpFX1BYID0gMTY7XG5cbi8vIExvYWRpbmcgLyBmZWVkYmFjayBkdXJhdGlvbnMgKG1zKVxuY29uc3QgTE9BRElOR19NSU5fTVMgPSA2MDA7XG5jb25zdCBGRUVEQkFDS19TVUNDRVNTX01TID0gMTUwMDtcbmNvbnN0IEZFRURCQUNLX0VSUk9SX01TID0gMTQwMDtcblxuY29uc3QgRFJJVkVfQU5DSE9SX1NFTEVDVE9SID1cbiAgJ2FbaHJlZio9XCJodHRwczovL2RyaXZlLmdvb2dsZS5jb21cIl0sIGFbaHJlZio9XCIvL2RyaXZlLmdvb2dsZS5jb21cIl0sIGFbaHJlZio9XCJjbGFzc3Jvb20uZ29vZ2xlLmNvbS9kcml2ZVwiXSc7XG5cbmNvbnN0IEFUVEFDSE1FTlRfQ09OVEFJTkVSX1NFTEVDVE9SID0gW1xuICAnLktsUlhkZicsIC8vIGNvbW1vbiBhdHRhY2htZW50IGNhcmRcbiAgJy56M3ZSY2MnLCAvLyBjaGlwLWxpa2UgYXR0YWNobWVudFxuICAnLlZmUHBrZC1hUFA3OGUnLCAvLyBNYXRlcmlhbCBjYXJkIHdyYXBwZXJcbiAgJ1tkYXRhLWRyaXZlLWlkXScsIC8vIERyaXZlIGF0dGFjaG1lbnRcbiAgJ1tkYXRhLWlkXVtkYXRhLWl0ZW0taWRdJywgLy8gbWV0YWRhdGEgYmxvY2tzXG5dLmpvaW4oJywgJyk7XG5cbmNvbnN0IERSSVZFX1VSTF9QQVRURVJOUzogUmVnRXhwW10gPSBbXG4gIC9odHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL2ZpbGVcXC9kXFwvLyxcbiAgL2h0dHBzOlxcL1xcL2RyaXZlXFwuZ29vZ2xlXFwuY29tXFwvb3BlblxcPy8sXG4gIC9odHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL3VjXFw/LyxcbiAgL2h0dHBzOlxcL1xcL2NsYXNzcm9vbVxcLmdvb2dsZVxcLmNvbVxcL2RyaXZlXFwvLyxcbl07XG5cbmxldCBzY2FuVGltZW91dElkOiBudW1iZXIgfCBudWxsID0gbnVsbDtcbmxldCBvYnNlcnZlcjogTXV0YXRpb25PYnNlcnZlciB8IG51bGwgPSBudWxsO1xuXG50eXBlIEJ1dHRvblN0YXRlID0gJ2lkbGUnIHwgJ2xvYWRpbmcnIHwgJ3N1Y2Nlc3MnIHwgJ2Vycm9yJztcblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEVudmlyb25tZW50IC8gUGFnZSBDaGVja3NcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGlzR29vZ2xlQ2xhc3Nyb29tKCk6IGJvb2xlYW4ge1xuICBpZiAodHlwZW9mIGxvY2F0aW9uID09PSAndW5kZWZpbmVkJykgcmV0dXJuIGZhbHNlO1xuICBpZiAobG9jYXRpb24uaG9zdG5hbWUgIT09ICdjbGFzc3Jvb20uZ29vZ2xlLmNvbScpIHJldHVybiBmYWxzZTtcbiAgcmV0dXJuIENMQVNTUk9PTV9VUkxfUEFUVEVSTi50ZXN0KGxvY2F0aW9uLmhyZWYpO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogU3R5bGUgSW5qZWN0aW9uXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBpbmplY3RTdHlsZXMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG4gIGlmIChkb2N1bWVudC5nZXRFbGVtZW50QnlJZChTVFlMRV9JRCkpIHJldHVybjtcblxuICBjb25zdCBzdHlsZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3N0eWxlJyk7XG4gIHN0eWxlLmlkID0gU1RZTEVfSUQ7XG4gIHN0eWxlLnRleHRDb250ZW50ID0gYFxuICAgIC8qIFNJTkdMRSBBVFRBQ0hNRU5UIEJVVFRPTlMgKGNpcmNsZSAtPiBwaWxsIG9uIGhvdmVyKSAqL1xuICAgIC5jcWQtZG93bmxvYWQtYnRuIHtcbiAgICAgIHBvc2l0aW9uOiBhYnNvbHV0ZTtcbiAgICAgIHRvcDogNTAlO1xuICAgICAgcmlnaHQ6IDhweDtcbiAgICAgIHotaW5kZXg6IDU7XG4gICAgICBkaXNwbGF5OiBpbmxpbmUtZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICAgIGhlaWdodDogNDBweDtcbiAgICAgIHdpZHRoOiA0MHB4O1xuICAgICAgbWF4LXdpZHRoOiBjYWxjKDEwMCUgLSAxNnB4KTtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDk5OTlweDtcbiAgICAgIGJvcmRlcjogbm9uZTtcbiAgICAgIHBhZGRpbmc6IDA7XG4gICAgICBiYWNrZ3JvdW5kLWNvbG9yOiAjMWE3M2U4O1xuICAgICAgY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3gtc2hhZG93OiAwIDRweCAxMHB4IHJnYmEoMTUsIDIzLCA0MiwgMC4yMik7XG4gICAgICBjdXJzb3I6IHBvaW50ZXI7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgICB3aWxsLWNoYW5nZTogdHJhbnNmb3JtLCBib3gtc2hhZG93LCB3aWR0aCwgYm9yZGVyLXJhZGl1cywgcGFkZGluZy1pbmxpbmU7XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICB3aWR0aCAyMjBtcyBjdWJpYy1iZXppZXIoMC4yLCAwLCAwLCAxKSxcbiAgICAgICAgcGFkZGluZy1pbmxpbmUgMjIwbXMgY3ViaWMtYmV6aWVyKDAuMiwgMCwgMCwgMSksXG4gICAgICAgIGJvcmRlci1yYWRpdXMgMjIwbXMgY3ViaWMtYmV6aWVyKDAuMiwgMCwgMCwgMSksXG4gICAgICAgIGJveC1zaGFkb3cgMjIwbXMgY3ViaWMtYmV6aWVyKDAuMiwgMCwgMCwgMSksXG4gICAgICAgIHRyYW5zZm9ybSAyMjBtcyBjdWJpYy1iZXppZXIoMC4yLCAwLCAwLCAxKSxcbiAgICAgICAgYmFja2dyb3VuZC1jb2xvciAyMjBtcyBjdWJpYy1iZXppZXIoMC4yLCAwLCAwLCAxKTtcbiAgICAgIGZvbnQtZmFtaWx5OiBzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgXCJTZWdvZSBVSVwiLCBzYW5zLXNlcmlmO1xuICAgICAgZm9udC1zaXplOiAxM3B4O1xuICAgICAgd2hpdGUtc3BhY2U6IG5vd3JhcDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG46aG92ZXIge1xuICAgICAgd2lkdGg6IDEyMHB4O1xuICAgICAgcGFkZGluZy1pbmxpbmU6IDEycHg7XG4gICAgICBib3gtc2hhZG93OiAwIDEwcHggMjRweCByZ2JhKDE1LCAyMywgNDIsIDAuMzApO1xuICAgICAganVzdGlmeS1jb250ZW50OiBmbGV4LXN0YXJ0O1xuICAgICAgdHJhbnNmb3JtOiB0cmFuc2xhdGVZKGNhbGMoLTUwJSAtIDFweCkpIHNjYWxlKDEuMDQpO1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjpmb2N1cy12aXNpYmxlIHtcbiAgICAgIG91dGxpbmU6IDJweCBzb2xpZCAjZmZmZmZmO1xuICAgICAgb3V0bGluZS1vZmZzZXQ6IDJweDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bjphY3RpdmUge1xuICAgICAgYm94LXNoYWRvdzogMCAycHggNnB4IHJnYmEoMTUsIDIzLCA0MiwgMC4zKTtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgwLjk3KTtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0biAuY3FkLWxhYmVsIHtcbiAgICAgIG9wYWNpdHk6IDA7XG4gICAgICBtYXJnaW4tbGVmdDogMDtcbiAgICAgIG1heC13aWR0aDogMDtcbiAgICAgIG92ZXJmbG93OiBoaWRkZW47XG4gICAgICB0cmFuc2l0aW9uOlxuICAgICAgICBvcGFjaXR5IDIwMG1zIGN1YmljLWJlemllcigwLjIsIDAsIDAsIDEpLFxuICAgICAgICBtYXgtd2lkdGggMjAwbXMgY3ViaWMtYmV6aWVyKDAuMiwgMCwgMCwgMSksXG4gICAgICAgIG1hcmdpbi1sZWZ0IDIwMG1zIGN1YmljLWJlemllcigwLjIsIDAsIDAsIDEpO1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuOmhvdmVyIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTAwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogNnB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuIC5jcWQtaWNvbi13cmFwcGVyIHtcbiAgICAgIGRpc3BsYXk6IGlubGluZS1mbGV4O1xuICAgICAgYWxpZ24taXRlbXM6IGNlbnRlcjtcbiAgICAgIGp1c3RpZnktY29udGVudDogY2VudGVyO1xuICAgICAgZmxleC1zaHJpbms6IDA7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1pY29uIHtcbiAgICAgIGRpc3BsYXk6IGJsb2NrO1xuICAgICAgd2lkdGg6IDI0cHg7XG4gICAgICBoZWlnaHQ6IDI0cHg7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiB1cmwoXCIke0lDT05fU1ZHX1VSTH1cIik7XG4gICAgICBiYWNrZ3JvdW5kLXJlcGVhdDogbm8tcmVwZWF0O1xuICAgICAgYmFja2dyb3VuZC1wb3NpdGlvbjogY2VudGVyO1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgICBmaWx0ZXI6IGRyb3Atc2hhZG93KDAgMCAxcHggcmdiYSgwLCAwLCAwLCAwLjM1KSk7XG4gICAgICBmbGV4LXNocmluazogMDtcbiAgICAgIHRyYW5zZm9ybS1vcmlnaW46IGNlbnRlcjtcbiAgICAgIHRyYW5zaXRpb246XG4gICAgICAgIHdpZHRoIDIwMG1zIGN1YmljLWJlemllcigwLjIsIDAsIDAsIDEpLFxuICAgICAgICBoZWlnaHQgMjAwbXMgY3ViaWMtYmV6aWVyKDAuMiwgMCwgMCwgMSksXG4gICAgICAgIGJvcmRlci13aWR0aCAyMDBtcyBjdWJpYy1iZXppZXIoMC4yLCAwLCAwLCAxKTtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tc21hbGwge1xuICAgICAgd2lkdGg6IDE2cHg7XG4gICAgICBoZWlnaHQ6IDE2cHg7XG4gICAgICBiYWNrZ3JvdW5kLXNpemU6IDE2cHggMTZweDtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tbWVkaXVtIHtcbiAgICAgIHdpZHRoOiAyNHB4O1xuICAgICAgaGVpZ2h0OiAyNHB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAyNHB4IDI0cHg7XG4gICAgfVxuXG4gICAgLmNxZC1pY29uLWxhcmdlIHtcbiAgICAgIHdpZHRoOiAzMnB4O1xuICAgICAgaGVpZ2h0OiAzMnB4O1xuICAgICAgYmFja2dyb3VuZC1zaXplOiAzMnB4IDMycHg7XG4gICAgfVxuXG4gICAgLyogUElMTCBTVEFURVMgKGxvYWRpbmcgLyBzdWNjZXNzIC8gZXJyb3IpICovXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmcsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLXN1Y2Nlc3MsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIHtcbiAgICAgIHdpZHRoOiAxNDBweDtcbiAgICAgIHBhZGRpbmctaW5saW5lOiAxMnB4O1xuICAgICAgYm9yZGVyLXJhZGl1czogMjBweDtcbiAgICAgIGp1c3RpZnktY29udGVudDogZmxleC1zdGFydDtcbiAgICAgIGJveC1zaGFkb3c6IDAgOHB4IDIycHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcbiAgICAgIGN1cnNvcjogZGVmYXVsdDtcbiAgICB9XG5cbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtbG9hZGluZyAuY3FkLWxhYmVsLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzIC5jcWQtbGFiZWwsXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWVycm9yIC5jcWQtbGFiZWwge1xuICAgICAgb3BhY2l0eTogMTtcbiAgICAgIG1heC13aWR0aDogMTEwcHg7XG4gICAgICBtYXJnaW4tbGVmdDogOHB4O1xuICAgIH1cblxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1sb2FkaW5nOmhvdmVyLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzOmhvdmVyLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1lcnJvcjpob3ZlciB7XG4gICAgICB3aWR0aDogMTQwcHg7XG4gICAgICBwYWRkaW5nLWlubGluZTogMTJweDtcbiAgICAgIGJvcmRlci1yYWRpdXM6IDIwcHg7XG4gICAgICB0cmFuc2Zvcm06IHRyYW5zbGF0ZVkoLTUwJSkgc2NhbGUoMSk7XG4gICAgICBib3gtc2hhZG93OiAwIDhweCAyMnB4IHJnYmEoMTUsIDIzLCA0MiwgMC4zMCk7XG4gICAgfVxuXG4gICAgLmNxZC1kb3dubG9hZC1idG4uY3FkLWxvYWRpbmc6YWN0aXZlLFxuICAgIC5jcWQtZG93bmxvYWQtYnRuLmNxZC1zdWNjZXNzOmFjdGl2ZSxcbiAgICAuY3FkLWRvd25sb2FkLWJ0bi5jcWQtZXJyb3I6YWN0aXZlIHtcbiAgICAgIHRyYW5zZm9ybTogdHJhbnNsYXRlWSgtNTAlKSBzY2FsZSgxKTtcbiAgICAgIGJveC1zaGFkb3c6IDAgOHB4IDIycHggcmdiYSgxNSwgMjMsIDQyLCAwLjMwKTtcbiAgICB9XG5cbiAgICAvKiBNYXRlcmlhbC1saWtlIGNpcmN1bGFyIHNwaW5uZXI6IGFyYyBvbiBhIGNpcmNsZSwgcm90YXRpbmcuXG4gICAgICAgVGhlIGRpYW1ldGVyIGlzIGNvbnRyb2xsZWQgYnkgU1BJTk5FUl9TSVpFX1BYLiAqL1xuICAgIC5jcWQtc3Bpbm5lciB7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiBub25lO1xuICAgICAgYm9yZGVyLXJhZGl1czogOTk5OXB4O1xuICAgICAgd2lkdGg6ICR7U1BJTk5FUl9TSVpFX1BYfXB4O1xuICAgICAgaGVpZ2h0OiAke1NQSU5ORVJfU0laRV9QWH1weDtcbiAgICAgIGJvcmRlci1zdHlsZTogc29saWQ7XG4gICAgICBib3JkZXItd2lkdGg6IDNweDtcbiAgICAgIGJvcmRlci1jb2xvcjogcmdiYSgyNTUsIDI1NSwgMjU1LCAwLjIyKTtcbiAgICAgIGJvcmRlci10b3AtY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3JkZXItcmlnaHQtY29sb3I6ICNmZmZmZmY7XG4gICAgICBib3gtc2hhZG93OiBub25lO1xuICAgICAgYW5pbWF0aW9uOiBjcWQtc3BpbiAwLjlzIGxpbmVhciBpbmZpbml0ZTtcbiAgICB9XG5cbiAgICBAa2V5ZnJhbWVzIGNxZC1zcGluIHtcbiAgICAgIGZyb20geyB0cmFuc2Zvcm06IHJvdGF0ZSgwZGVnKTsgfVxuICAgICAgdG8geyB0cmFuc2Zvcm06IHJvdGF0ZSgzNjBkZWcpOyB9XG4gICAgfVxuXG4gICAgLyogU3VjY2VzcyAvIGVycm9yIGljb25zIHVzaW5nIGVtb2ppLCBubyBiYWNrZ3JvdW5kIGltYWdlICovXG4gICAgLmNxZC1pY29uLWNoZWNrLFxuICAgIC5jcWQtaWNvbi1jcm9zcyB7XG4gICAgICBiYWNrZ3JvdW5kLWltYWdlOiBub25lO1xuICAgICAgd2lkdGg6IDE4cHg7XG4gICAgICBoZWlnaHQ6IDE4cHg7XG4gICAgICBib3gtc2hhZG93OiBub25lO1xuICAgICAgZm9udC1zaXplOiAxNnB4O1xuICAgICAgZGlzcGxheTogZmxleDtcbiAgICAgIGFsaWduLWl0ZW1zOiBjZW50ZXI7XG4gICAgICBqdXN0aWZ5LWNvbnRlbnQ6IGNlbnRlcjtcbiAgICB9XG5cbiAgICAuY3FkLWljb24tY3Jvc3Mge1xuICAgICAgZm9udC1zaXplOiAxNXB4O1xuICAgIH1cbiAgYC50cmltKCk7XG5cbiAgKGRvY3VtZW50LmhlYWQgfHwgZG9jdW1lbnQuZG9jdW1lbnRFbGVtZW50KS5hcHBlbmRDaGlsZChzdHlsZSk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBTY2FubmluZyAvIE9ic2VydmVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gc2NoZWR1bGVTY2FuKCk6IHZvaWQge1xuICBpZiAoc2NhblRpbWVvdXRJZCAhPT0gbnVsbCkge1xuICAgIHdpbmRvdy5jbGVhclRpbWVvdXQoc2NhblRpbWVvdXRJZCk7XG4gIH1cbiAgc2NhblRpbWVvdXRJZCA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICBzY2FuVGltZW91dElkID0gbnVsbDtcbiAgICBzY2FuRm9yQXR0YWNobWVudHMoKTtcbiAgfSwgUkVTQ0FOX0RFQk9VTkNFX01TKTtcbn1cblxuZnVuY3Rpb24gc2V0dXBPYnNlcnZlcnMoKTogdm9pZCB7XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG5cbiAgaWYgKCFkb2N1bWVudC5ib2R5KSB7XG4gICAgd2luZG93LmFkZEV2ZW50TGlzdGVuZXIoXG4gICAgICAnRE9NQ29udGVudExvYWRlZCcsXG4gICAgICAoKSA9PiB7XG4gICAgICAgIHNldHVwT2JzZXJ2ZXJzKCk7XG4gICAgICB9LFxuICAgICAgeyBvbmNlOiB0cnVlIH0sXG4gICAgKTtcbiAgICByZXR1cm47XG4gIH1cblxuICBpZiAob2JzZXJ2ZXIpIHJldHVybjtcblxuICBvYnNlcnZlciA9IG5ldyBNdXRhdGlvbk9ic2VydmVyKChtdXRhdGlvbnMpID0+IHtcbiAgICBjb25zdCBoYXNDaGlsZExpc3RDaGFuZ2UgPSBtdXRhdGlvbnMuc29tZShcbiAgICAgIChtKSA9PiBtLnR5cGUgPT09ICdjaGlsZExpc3QnICYmIChtLmFkZGVkTm9kZXMubGVuZ3RoID4gMCB8fCBtLnJlbW92ZWROb2Rlcy5sZW5ndGggPiAwKSxcbiAgICApO1xuICAgIGlmIChoYXNDaGlsZExpc3RDaGFuZ2UpIHtcbiAgICAgIHNjaGVkdWxlU2NhbigpO1xuICAgIH1cbiAgfSk7XG5cbiAgb2JzZXJ2ZXIub2JzZXJ2ZShkb2N1bWVudC5ib2R5LCB7IGNoaWxkTGlzdDogdHJ1ZSwgc3VidHJlZTogdHJ1ZSB9KTtcblxuICB3aW5kb3cuc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgIHNjaGVkdWxlU2NhbigpO1xuICB9LCBSRVNDQU5fSU5URVJWQUxfTVMpO1xuXG4gIHNjaGVkdWxlU2NhbigpO1xufVxuXG4vKipcbiAqIE1haW4gc2NhbjogaW5qZWN0IHNpbmdsZS1maWxlIGJ1dHRvbnMuXG4gKi9cbmZ1bmN0aW9uIHNjYW5Gb3JBdHRhY2htZW50cygpOiB2b2lkIHtcbiAgaWYgKCFpc0dvb2dsZUNsYXNzcm9vbSgpKSByZXR1cm47XG4gIGlmICh0eXBlb2YgZG9jdW1lbnQgPT09ICd1bmRlZmluZWQnKSByZXR1cm47XG5cbiAgaW5qZWN0U2luZ2xlRmlsZUJ1dHRvbnMoKTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFNpbmdsZS1maWxlIGJ1dHRvbnNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGluamVjdFNpbmdsZUZpbGVCdXR0b25zKCk6IHZvaWQge1xuICAvLyBBbmNob3JzIHdpdGggRHJpdmUgVVJMc1xuICBjb25zdCBhbmNob3JzID0gQXJyYXkuZnJvbShcbiAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yQWxsPEhUTUxBbmNob3JFbGVtZW50PihEUklWRV9BTkNIT1JfU0VMRUNUT1IpLFxuICApO1xuXG4gIGZvciAoY29uc3QgYW5jaG9yIG9mIGFuY2hvcnMpIHtcbiAgICBjb25zdCB1cmwgPSBleHRyYWN0RHJpdmVVcmxGcm9tQW5jaG9yKGFuY2hvcik7XG4gICAgaWYgKCF1cmwpIGNvbnRpbnVlO1xuXG4gICAgY29uc3QgY29udGFpbmVyID1cbiAgICAgIChhbmNob3IuY2xvc2VzdChBVFRBQ0hNRU5UX0NPTlRBSU5FUl9TRUxFQ1RPUikgYXMgSFRNTEVsZW1lbnQgfCBudWxsKSB8fFxuICAgICAgYW5jaG9yLnBhcmVudEVsZW1lbnQgfHxcbiAgICAgIGFuY2hvcjtcblxuICAgIGlmICghY29udGFpbmVyKSBjb250aW51ZTtcbiAgICBpZiAoaGFzSW5qZWN0ZWRCdXR0b24oY29udGFpbmVyKSkgY29udGludWU7XG5cbiAgICBpbmplY3RCdXR0b25JbnRvQXR0YWNobWVudChjb250YWluZXIsIHVybCk7XG4gIH1cblxuICAvLyBFbGVtZW50cyB3aXRoIERyaXZlIG1ldGFkYXRhXG4gIGNvbnN0IG1ldGFFbGVtZW50cyA9IEFycmF5LmZyb20oXG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvckFsbDxIVE1MRWxlbWVudD4oXG4gICAgICAnW2RhdGEtZHJpdmUtaWRdLCBbZGF0YS1pZF1bZGF0YS1pdGVtLWlkXSwgW2RhdGEtaWRdW2RhdGEtdG9vbHRpcF0nLFxuICAgICksXG4gICk7XG5cbiAgZm9yIChjb25zdCBlbCBvZiBtZXRhRWxlbWVudHMpIHtcbiAgICBpZiAoaGFzSW5qZWN0ZWRCdXR0b24oZWwpKSBjb250aW51ZTtcbiAgICBjb25zdCB1cmwgPSBmaW5kRHJpdmVVcmwoZWwpO1xuICAgIGlmICghdXJsKSBjb250aW51ZTtcblxuICAgIGluamVjdEJ1dHRvbkludG9BdHRhY2htZW50KGVsLCB1cmwpO1xuICB9XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBVUkwgLyBET00gSGVscGVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gaGFzSW5qZWN0ZWRCdXR0b24oY29udGFpbmVyOiBIVE1MRWxlbWVudCk6IGJvb2xlYW4ge1xuICByZXR1cm4gISFjb250YWluZXIucXVlcnlTZWxlY3RvcihgWyR7SU5KRUNURURfQVRUUn09XCJ0cnVlXCJdYCk7XG59XG5cbmZ1bmN0aW9uIGV4dHJhY3REcml2ZVVybEZyb21BbmNob3IoYW5jaG9yOiBIVE1MQW5jaG9yRWxlbWVudCk6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBocmVmID0gYW5jaG9yLmhyZWY7XG4gIGlmICghaHJlZikgcmV0dXJuIG51bGw7XG4gIGNvbnN0IGlzRHJpdmVVcmwgPSBEUklWRV9VUkxfUEFUVEVSTlMuc29tZSgocmUpID0+IHJlLnRlc3QoaHJlZikpO1xuICByZXR1cm4gaXNEcml2ZVVybCA/IGhyZWYgOiBudWxsO1xufVxuXG5mdW5jdGlvbiBmaW5kRHJpdmVVcmwoZWxlbWVudDogSFRNTEVsZW1lbnQpOiBzdHJpbmcgfCBudWxsIHtcbiAgY29uc3QgbmVhckFuY2hvciA9XG4gICAgZWxlbWVudC5xdWVyeVNlbGVjdG9yPEhUTUxBbmNob3JFbGVtZW50PihEUklWRV9BTkNIT1JfU0VMRUNUT1IpIHx8XG4gICAgKGVsZW1lbnQuY2xvc2VzdChEUklWRV9BTkNIT1JfU0VMRUNUT1IpIGFzIEhUTUxBbmNob3JFbGVtZW50IHwgbnVsbCk7XG5cbiAgaWYgKG5lYXJBbmNob3IpIHtcbiAgICBjb25zdCBocmVmID0gZXh0cmFjdERyaXZlVXJsRnJvbUFuY2hvcihuZWFyQW5jaG9yKTtcbiAgICBpZiAoaHJlZikgcmV0dXJuIGhyZWY7XG4gIH1cblxuICBjb25zdCBkcml2ZUlkID0gZWxlbWVudC5nZXRBdHRyaWJ1dGUoJ2RhdGEtZHJpdmUtaWQnKSB8fCBlbGVtZW50LmdldEF0dHJpYnV0ZSgnZGF0YS1pZCcpO1xuICBpZiAoZHJpdmVJZCkge1xuICAgIGNvbnN0IGFuY2hvcldpdGhJZCA9XG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxBbmNob3JFbGVtZW50PihgYVtkYXRhLWRyaXZlLWlkPVwiJHtkcml2ZUlkfVwiXWApIHx8XG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxBbmNob3JFbGVtZW50PihgYVtkYXRhLWlkPVwiJHtkcml2ZUlkfVwiXWApIHx8XG4gICAgICBkb2N1bWVudC5xdWVyeVNlbGVjdG9yPEhUTUxBbmNob3JFbGVtZW50PihgYVtocmVmKj1cIiR7ZHJpdmVJZH1cIl1gKTtcblxuICAgIGlmIChhbmNob3JXaXRoSWQpIHtcbiAgICAgIGNvbnN0IGhyZWYgPSBleHRyYWN0RHJpdmVVcmxGcm9tQW5jaG9yKGFuY2hvcldpdGhJZCk7XG4gICAgICBpZiAoaHJlZikgcmV0dXJuIGhyZWY7XG4gICAgfVxuXG4gICAgLy8gRmFsbGJhY2s6IGJlc3QtZWZmb3J0IGRpcmVjdCBkb3dubG9hZCBVUkwgZnJvbSBEcml2ZSBJRFxuICAgIHJldHVybiBgaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL3VjP2V4cG9ydD1kb3dubG9hZCZpZD0ke2VuY29kZVVSSUNvbXBvbmVudChkcml2ZUlkKX1gO1xuICB9XG5cbiAgcmV0dXJuIG51bGw7XG59XG5cbi8qKlxuICogQ29udmVydCBhbnkgdmlldyAvIGNsYXNzcm9vbS1wcm94eSBVUkwgdG8gYSBkaXJlY3QgZG93bmxvYWQgVVJMIHdoZW4gcG9zc2libGUuXG4gKi9cbmZ1bmN0aW9uIHRvRG93bmxvYWRVcmwob3JpZ2luYWxVcmw6IHN0cmluZywgZGVwdGggPSAwKTogc3RyaW5nIHtcbiAgaWYgKGRlcHRoID4gMykgcmV0dXJuIG9yaWdpbmFsVXJsO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgcGFyc2VkID0gbmV3IFVSTChvcmlnaW5hbFVybCwgbG9jYXRpb24uaHJlZik7XG4gICAgY29uc3QgaG9zdG5hbWUgPSBwYXJzZWQuaG9zdG5hbWU7XG4gICAgY29uc3QgcGF0aG5hbWUgPSBwYXJzZWQucGF0aG5hbWU7XG5cbiAgICBpZiAoaG9zdG5hbWUgPT09ICdkcml2ZS5nb29nbGUuY29tJykge1xuICAgICAgLy8gYXV0aF93YXJtdXAgdW53cmFwcGluZ1xuICAgICAgaWYgKHBhdGhuYW1lLnN0YXJ0c1dpdGgoJy9hdXRoX3dhcm11cCcpKSB7XG4gICAgICAgIGNvbnN0IGNvbnQgPSBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnY29udGludWUnKTtcbiAgICAgICAgaWYgKGNvbnQpIHJldHVybiB0b0Rvd25sb2FkVXJsKGNvbnQsIGRlcHRoICsgMSk7XG5cbiAgICAgICAgY29uc3QgaWQgPSBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnaWQnKTtcbiAgICAgICAgaWYgKGlkKSB7XG4gICAgICAgICAgcmV0dXJuIGBodHRwczovL2RyaXZlLmdvb2dsZS5jb20vdWM/ZXhwb3J0PWRvd25sb2FkJmlkPSR7ZW5jb2RlVVJJQ29tcG9uZW50KGlkKX1gO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBvcmlnaW5hbFVybDtcbiAgICAgIH1cblxuICAgICAgY29uc3QgZmlsZU1hdGNoID0gcGF0aG5hbWUubWF0Y2goL15cXC9maWxlXFwvZFxcLyhbXi9dKykvKTtcbiAgICAgIGlmIChmaWxlTWF0Y2gpIHtcbiAgICAgICAgY29uc3QgaWQgPSBmaWxlTWF0Y2hbMV07XG4gICAgICAgIHJldHVybiBgaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL3VjP2V4cG9ydD1kb3dubG9hZCZpZD0ke2VuY29kZVVSSUNvbXBvbmVudChpZCl9YDtcbiAgICAgIH1cblxuICAgICAgaWYgKHBhdGhuYW1lID09PSAnL29wZW4nKSB7XG4gICAgICAgIGNvbnN0IGlkID0gcGFyc2VkLnNlYXJjaFBhcmFtcy5nZXQoJ2lkJyk7XG4gICAgICAgIGlmIChpZCkge1xuICAgICAgICAgIHJldHVybiBgaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tL3VjP2V4cG9ydD1kb3dubG9hZCZpZD0ke2VuY29kZVVSSUNvbXBvbmVudChpZCl9YDtcbiAgICAgICAgfVxuICAgICAgfVxuXG4gICAgICBpZiAocGF0aG5hbWUgPT09ICcvdWMnKSB7XG4gICAgICAgIHBhcnNlZC5zZWFyY2hQYXJhbXMuc2V0KCdleHBvcnQnLCAnZG93bmxvYWQnKTtcbiAgICAgICAgcmV0dXJuIHBhcnNlZC50b1N0cmluZygpO1xuICAgICAgfVxuICAgIH1cblxuICAgIGlmIChob3N0bmFtZSA9PT0gJ2NsYXNzcm9vbS5nb29nbGUuY29tJyAmJiBwYXRobmFtZS5zdGFydHNXaXRoKCcvZHJpdmUnKSkge1xuICAgICAgY29uc3QgaWQgPVxuICAgICAgICBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgnaWQnKSB8fFxuICAgICAgICBwYXJzZWQuc2VhcmNoUGFyYW1zLmdldCgncmVzb3VyY2VJZCcpIHx8XG4gICAgICAgIHBhcnNlZC5zZWFyY2hQYXJhbXMuZ2V0KCdmaWxlSWQnKTtcbiAgICAgIGlmIChpZCkge1xuICAgICAgICByZXR1cm4gYGh0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS91Yz9leHBvcnQ9ZG93bmxvYWQmaWQ9JHtlbmNvZGVVUklDb21wb25lbnQoaWQpfWA7XG4gICAgICB9XG4gICAgfVxuXG4gICAgcmV0dXJuIG9yaWdpbmFsVXJsO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gb3JpZ2luYWxVcmw7XG4gIH1cbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEJ1dHRvbiBpbmplY3Rpb25cbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGluamVjdEJ1dHRvbkludG9BdHRhY2htZW50KGNvbnRhaW5lcjogSFRNTEVsZW1lbnQsIHVybDogc3RyaW5nKTogdm9pZCB7XG4gIGlmICghdXJsKSByZXR1cm47XG5cbiAgY29uc3QgY29tcHV0ZWQgPSB3aW5kb3cuZ2V0Q29tcHV0ZWRTdHlsZShjb250YWluZXIpO1xuICBpZiAoY29tcHV0ZWQucG9zaXRpb24gPT09ICdzdGF0aWMnKSB7XG4gICAgY29udGFpbmVyLnN0eWxlLnBvc2l0aW9uID0gJ3JlbGF0aXZlJztcbiAgfVxuXG4gIGNvbnN0IGJ1dHRvbiA9IGNyZWF0ZURvd25sb2FkQnV0dG9uKHVybCk7XG5cbiAgY29uc3QgaWNvbkVsID0gYnV0dG9uLnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCcuY3FkLWRvd25sb2FkLWljb24nKTtcbiAgaWYgKGljb25FbCkge1xuICAgIGljb25FbC5jbGFzc0xpc3QuYWRkKCdjcWQtaWNvbi1tZWRpdW0nKTtcbiAgfVxuXG4gIGNvbnRhaW5lci5hcHBlbmRDaGlsZChidXR0b24pO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogQnV0dG9uIHN0YXRlIGhlbHBlcnNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGdldEJ1dHRvblN0YXRlKGJ1dHRvbjogSFRNTEJ1dHRvbkVsZW1lbnQpOiBCdXR0b25TdGF0ZSB7XG4gIGlmIChidXR0b24uY2xhc3NMaXN0LmNvbnRhaW5zKCdjcWQtbG9hZGluZycpKSByZXR1cm4gJ2xvYWRpbmcnO1xuICBpZiAoYnV0dG9uLmNsYXNzTGlzdC5jb250YWlucygnY3FkLXN1Y2Nlc3MnKSkgcmV0dXJuICdzdWNjZXNzJztcbiAgaWYgKGJ1dHRvbi5jbGFzc0xpc3QuY29udGFpbnMoJ2NxZC1lcnJvcicpKSByZXR1cm4gJ2Vycm9yJztcbiAgcmV0dXJuICdpZGxlJztcbn1cblxuZnVuY3Rpb24gc2V0QnV0dG9uU3RhdGUoYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCwgc3RhdGU6IEJ1dHRvblN0YXRlKTogdm9pZCB7XG4gIGNvbnN0IGljb24gPSBidXR0b24ucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJy5jcWQtZG93bmxvYWQtaWNvbicpO1xuICBjb25zdCBsYWJlbCA9IGJ1dHRvbi5xdWVyeVNlbGVjdG9yPEhUTUxTcGFuRWxlbWVudD4oJy5jcWQtbGFiZWwnKTtcbiAgaWYgKCFpY29uIHx8ICFsYWJlbCkgcmV0dXJuO1xuXG4gIC8vIFJlc2V0IGFsbCBzdGF0ZSBjbGFzc2VzIC8gc3R5bGVzXG4gIGJ1dHRvbi5jbGFzc0xpc3QucmVtb3ZlKCdjcWQtbG9hZGluZycsICdjcWQtc3VjY2VzcycsICdjcWQtZXJyb3InKTtcbiAgaWNvbi5jbGFzc0xpc3QucmVtb3ZlKCdjcWQtc3Bpbm5lcicsICdjcWQtaWNvbi1jaGVjaycsICdjcWQtaWNvbi1jcm9zcycpO1xuICBpY29uLnRleHRDb250ZW50ID0gJyc7XG4gIGJ1dHRvbi5kaXNhYmxlZCA9IGZhbHNlO1xuICBidXR0b24uc3R5bGUuYmFja2dyb3VuZENvbG9yID0gJyMxYTczZTgnO1xuICBsYWJlbC50ZXh0Q29udGVudCA9ICdEb3dubG9hZCc7XG5cbiAgc3dpdGNoIChzdGF0ZSkge1xuICAgIGNhc2UgJ2lkbGUnOlxuICAgICAgLy8gZGVmYXVsdCBjaXJjbGUgKyBkb3dubG9hZCBpY29uIHZpYSBiYWNrZ3JvdW5kLWltYWdlXG4gICAgICBicmVhaztcblxuICAgIGNhc2UgJ2xvYWRpbmcnOlxuICAgICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2NxZC1sb2FkaW5nJyk7XG4gICAgICBidXR0b24uZGlzYWJsZWQgPSB0cnVlO1xuICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSAnRG93bmxvYWRpbmfigKYnO1xuICAgICAgaWNvbi5jbGFzc0xpc3QuYWRkKCdjcWQtc3Bpbm5lcicpO1xuICAgICAgYnJlYWs7XG5cbiAgICBjYXNlICdzdWNjZXNzJzpcbiAgICAgIGJ1dHRvbi5jbGFzc0xpc3QuYWRkKCdjcWQtc3VjY2VzcycpO1xuICAgICAgYnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcjMTg4MDM4JzsgLy8gR29vZ2xlIGdyZWVuXG4gICAgICBsYWJlbC50ZXh0Q29udGVudCA9ICdEb3dubG9hZGVkJztcbiAgICAgIGljb24uY2xhc3NMaXN0LmFkZCgnY3FkLWljb24tY2hlY2snKTtcbiAgICAgIGljb24udGV4dENvbnRlbnQgPSAn4pyFJztcbiAgICAgIGJyZWFrO1xuXG4gICAgY2FzZSAnZXJyb3InOlxuICAgICAgYnV0dG9uLmNsYXNzTGlzdC5hZGQoJ2NxZC1lcnJvcicpO1xuICAgICAgYnV0dG9uLnN0eWxlLmJhY2tncm91bmRDb2xvciA9ICcjZDkzMDI1JzsgLy8gYnJpZ2h0IHJlZFxuICAgICAgbGFiZWwudGV4dENvbnRlbnQgPSAnRXJyb3InO1xuICAgICAgaWNvbi5jbGFzc0xpc3QuYWRkKCdjcWQtaWNvbi1jcm9zcycpO1xuICAgICAgaWNvbi50ZXh0Q29udGVudCA9ICfinYwnO1xuICAgICAgYnJlYWs7XG4gIH1cbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEJ1dHRvbiBmYWN0b3J5XG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBjcmVhdGVEb3dubG9hZEJ1dHRvbih1cmw6IHN0cmluZyk6IEhUTUxCdXR0b25FbGVtZW50IHtcbiAgY29uc3QgYnV0dG9uID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnYnV0dG9uJyk7XG4gIGJ1dHRvbi50eXBlID0gJ2J1dHRvbic7XG4gIGJ1dHRvbi5jbGFzc05hbWUgPSAnY3FkLWRvd25sb2FkLWJ0bic7XG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoSU5KRUNURURfQVRUUiwgJ3RydWUnKTtcbiAgYnV0dG9uLnNldEF0dHJpYnV0ZSgnYXJpYS1sYWJlbCcsICdRdWljayBkb3dubG9hZCBhdHRhY2htZW50Jyk7XG4gIGJ1dHRvbi5zZXRBdHRyaWJ1dGUoJ3RpdGxlJywgJ1F1aWNrIGRvd25sb2FkJyk7XG5cbiAgY29uc3QgaWNvbldyYXBwZXIgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdzcGFuJyk7XG4gIGljb25XcmFwcGVyLmNsYXNzTmFtZSA9ICdjcWQtaWNvbi13cmFwcGVyJztcblxuICBjb25zdCBpY29uU3BhbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoJ3NwYW4nKTtcbiAgaWNvblNwYW4uY2xhc3NOYW1lID0gJ2NxZC1kb3dubG9hZC1pY29uJztcbiAgaWNvbldyYXBwZXIuYXBwZW5kQ2hpbGQoaWNvblNwYW4pO1xuXG4gIGNvbnN0IGxhYmVsID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudCgnc3BhbicpO1xuICBsYWJlbC5jbGFzc05hbWUgPSAnY3FkLWxhYmVsJztcbiAgbGFiZWwudGV4dENvbnRlbnQgPSAnRG93bmxvYWQnO1xuXG4gIGJ1dHRvbi5hcHBlbmRDaGlsZChpY29uV3JhcHBlcik7XG4gIGJ1dHRvbi5hcHBlbmRDaGlsZChsYWJlbCk7XG5cbiAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2NsaWNrJywgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgZXZlbnQucHJldmVudERlZmF1bHQoKTtcbiAgICBldmVudC5zdG9wUHJvcGFnYXRpb24oKTtcbiAgICBhd2FpdCBoYW5kbGVTaW5nbGVEb3dubG9hZENsaWNrKGJ1dHRvbiwgdXJsKTtcbiAgfSk7XG5cbiAgYnV0dG9uLmFkZEV2ZW50TGlzdGVuZXIoJ2F1eGNsaWNrJywgYXN5bmMgKGV2ZW50KSA9PiB7XG4gICAgaWYgKGV2ZW50LmJ1dHRvbiAhPT0gMSkgcmV0dXJuOyAvLyBtaWRkbGUtY2xpY2sgb25seVxuICAgIGV2ZW50LnByZXZlbnREZWZhdWx0KCk7XG4gICAgZXZlbnQuc3RvcFByb3BhZ2F0aW9uKCk7XG4gICAgYXdhaXQgaGFuZGxlU2luZ2xlRG93bmxvYWRDbGljayhidXR0b24sIHVybCk7XG4gIH0pO1xuXG4gIHJldHVybiBidXR0b247XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBTaW5nbGUgZG93bmxvYWQgZmxvdyB3aXRoIHN0YXRlc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuYXN5bmMgZnVuY3Rpb24gaGFuZGxlU2luZ2xlRG93bmxvYWRDbGljayhcbiAgYnV0dG9uOiBIVE1MQnV0dG9uRWxlbWVudCxcbiAgdXJsOiBzdHJpbmcsXG4pOiBQcm9taXNlPHZvaWQ+IHtcbiAgaWYgKCF1cmwpIHJldHVybjtcbiAgaWYgKGdldEJ1dHRvblN0YXRlKGJ1dHRvbikgPT09ICdsb2FkaW5nJykgcmV0dXJuO1xuXG4gIHNldEJ1dHRvblN0YXRlKGJ1dHRvbiwgJ2xvYWRpbmcnKTtcbiAgY29uc3Qgc3RhcnQgPSBEYXRlLm5vdygpO1xuXG4gIGNvbnN0IG9rID0gYXdhaXQgZG93bmxvYWRGaWxlKHVybCk7XG5cbiAgY29uc3QgZWxhcHNlZCA9IERhdGUubm93KCkgLSBzdGFydDtcbiAgaWYgKGVsYXBzZWQgPCBMT0FESU5HX01JTl9NUykge1xuICAgIGF3YWl0IGRlbGF5KExPQURJTkdfTUlOX01TIC0gZWxhcHNlZCk7XG4gIH1cblxuICBpZiAob2spIHtcbiAgICBzZXRCdXR0b25TdGF0ZShidXR0b24sICdzdWNjZXNzJyk7XG4gICAgYXdhaXQgZGVsYXkoRkVFREJBQ0tfU1VDQ0VTU19NUyk7XG4gIH0gZWxzZSB7XG4gICAgc2V0QnV0dG9uU3RhdGUoYnV0dG9uLCAnZXJyb3InKTtcbiAgICBhd2FpdCBkZWxheShGRUVEQkFDS19FUlJPUl9NUyk7XG4gIH1cblxuICBzZXRCdXR0b25TdGF0ZShidXR0b24sICdpZGxlJyk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBEb3dubG9hZCBsb2dpYyAoYmFja2dyb3VuZCArIGZhbGxiYWNrKVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gZG93bmxvYWRGaWxlKHJhd1VybDogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG4gIGlmICghcmF3VXJsIHx8ICEvXmh0dHBzPzpcXC9cXC8vaS50ZXN0KHJhd1VybCkpIHJldHVybiBQcm9taXNlLnJlc29sdmUoZmFsc2UpO1xuXG4gIGNvbnN0IGZpbmFsVXJsID0gdG9Eb3dubG9hZFVybChyYXdVcmwpO1xuXG4gIC8vIE9mZmxpbmU/IHdlIGtub3cgdGhpcyB3aWxsIGxpa2VseSBmYWlsLlxuICBpZiAodHlwZW9mIG5hdmlnYXRvciAhPT0gJ3VuZGVmaW5lZCcgJiYgIW5hdmlnYXRvci5vbkxpbmUpIHtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGZhbHNlKTtcbiAgfVxuXG4gIC8vIElmIHdlIHNvbWVob3cgc3RpbGwgaGF2ZSBhdXRoX3dhcm11cCBhdCB0aGlzIHBvaW50LCB0cmVhdCBhcyBmYWlsdXJlLlxuICBpZiAoL2h0dHBzOlxcL1xcL2RyaXZlXFwuZ29vZ2xlXFwuY29tXFwvYXV0aF93YXJtdXAvLnRlc3QoZmluYWxVcmwpKSB7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShmYWxzZSk7XG4gIH1cblxuICBjb25zdCBoYXNDaHJvbWVSdW50aW1lID1cbiAgICB0eXBlb2YgY2hyb21lICE9PSAndW5kZWZpbmVkJyAmJlxuICAgICEhY2hyb21lLnJ1bnRpbWUgJiZcbiAgICB0eXBlb2YgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UgPT09ICdmdW5jdGlvbic7XG5cbiAgaWYgKGhhc0Nocm9tZVJ1bnRpbWUpIHtcbiAgICByZXR1cm4gbmV3IFByb21pc2U8Ym9vbGVhbj4oKHJlc29sdmUpID0+IHtcbiAgICAgIGxldCByZXNvbHZlZCA9IGZhbHNlO1xuXG4gICAgICB0cnkge1xuICAgICAgICBjaHJvbWUucnVudGltZS5zZW5kTWVzc2FnZShcbiAgICAgICAgICB7IHR5cGU6ICdDUURfRE9XTkxPQUQnLCB1cmw6IGZpbmFsVXJsIH0sXG4gICAgICAgICAgKHJlc3BvbnNlPzogeyBvaz86IGJvb2xlYW47IGVycm9yPzogc3RyaW5nIH0pID0+IHtcbiAgICAgICAgICAgIGNvbnN0IGVyciA9IGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcjtcbiAgICAgICAgICAgIGlmIChlcnIpIHtcbiAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdbQ1FEXSBzZW5kTWVzc2FnZSBlcnJvcjonLCBlcnIubWVzc2FnZSk7XG4gICAgICAgICAgICAgIGZhbGxiYWNrQW5jaG9yRG93bmxvYWQoZmluYWxVcmwpO1xuICAgICAgICAgICAgICBpZiAoIXJlc29sdmVkKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZWQgPSB0cnVlO1xuICAgICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoIXJlc3BvbnNlIHx8IHJlc3BvbnNlLm9rID09PSBmYWxzZSkge1xuICAgICAgICAgICAgICBpZiAocmVzcG9uc2U/LmVycm9yKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKCdbQ1FEXSBiYWNrZ3JvdW5kIGRvd25sb2FkIGVycm9yOicsIHJlc3BvbnNlLmVycm9yKTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBmYWxsYmFja0FuY2hvckRvd25sb2FkKGZpbmFsVXJsKTtcbiAgICAgICAgICAgICAgaWYgKCFyZXNvbHZlZCkge1xuICAgICAgICAgICAgICAgIHJlc29sdmVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKCFyZXNvbHZlZCkge1xuICAgICAgICAgICAgICByZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICAgIHJlc29sdmUodHJ1ZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgKTtcblxuICAgICAgICAvLyBTYWZldHkgdGltZW91dDogaWYgYmFja2dyb3VuZCBuZXZlciByZXNwb25kcywgZmFsbGJhY2sgKyByZXNvbHZlLlxuICAgICAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgICAgaWYgKCFyZXNvbHZlZCkge1xuICAgICAgICAgICAgZmFsbGJhY2tBbmNob3JEb3dubG9hZChmaW5hbFVybCk7XG4gICAgICAgICAgICByZXNvbHZlZCA9IHRydWU7XG4gICAgICAgICAgICByZXNvbHZlKHRydWUpO1xuICAgICAgICAgIH1cbiAgICAgICAgfSwgNDAwMCk7XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0NRRF0gc2VuZE1lc3NhZ2UgdGhyZXc6JywgZSk7XG4gICAgICAgIGZhbGxiYWNrQW5jaG9yRG93bmxvYWQoZmluYWxVcmwpO1xuICAgICAgICBpZiAoIXJlc29sdmVkKSByZXNvbHZlKHRydWUpO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgLy8gTm8gYmFja2dyb3VuZCBhdmFpbGFibGU6IGp1c3Qgb3BlbiBhbmNob3IgaW4gbmV3IHRhYjsgdHJlYXQgYXMgc3VjY2Vzcy5cbiAgZmFsbGJhY2tBbmNob3JEb3dubG9hZChmaW5hbFVybCk7XG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUodHJ1ZSk7XG59XG5cbi8qKlxuICogRmFsbGJhY2s6IHN5bnRoZXRpYyBhbmNob3IgY2xpY2sgKG1heSBvcGVuIHRhYiwgYnV0IHN0aWxsIGRvd25sb2FkcykuXG4gKi9cbmZ1bmN0aW9uIGZhbGxiYWNrQW5jaG9yRG93bmxvYWQodXJsOiBzdHJpbmcpOiB2b2lkIHtcbiAgaWYgKHR5cGVvZiBkb2N1bWVudCA9PT0gJ3VuZGVmaW5lZCcpIHJldHVybjtcblxuICBjb25zdCBhbmNob3IgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KCdhJyk7XG4gIGFuY2hvci5ocmVmID0gdXJsO1xuICBhbmNob3IudGFyZ2V0ID0gJ19ibGFuayc7XG4gIGFuY2hvci5yZWwgPSAnbm9vcGVuZXIgbm9yZWZlcnJlcic7XG4gIGFuY2hvci5zdHlsZS5kaXNwbGF5ID0gJ25vbmUnO1xuXG4gIGRvY3VtZW50LmJvZHkuYXBwZW5kQ2hpbGQoYW5jaG9yKTtcbiAgYW5jaG9yLmNsaWNrKCk7XG5cbiAgd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgIGFuY2hvci5yZW1vdmUoKTtcbiAgfSwgMCk7XG59XG5cbmZ1bmN0aW9uIGRlbGF5KG1zOiBudW1iZXIpOiBQcm9taXNlPHZvaWQ+IHtcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlKSA9PiB3aW5kb3cuc2V0VGltZW91dChyZXNvbHZlLCBtcykpO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogSW5pdFxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gaW5pdENvbnRlbnRTY3JpcHQoKTogdm9pZCB7XG4gIGlmICghaXNHb29nbGVDbGFzc3Jvb20oKSkgcmV0dXJuO1xuICBpbmplY3RTdHlsZXMoKTtcbiAgc2V0dXBPYnNlcnZlcnMoKTtcbn1cblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFsnaHR0cHM6Ly9jbGFzc3Jvb20uZ29vZ2xlLmNvbS8qJ10sXG4gIHJ1bkF0OiAnZG9jdW1lbnRfaWRsZScsXG4gIG1haW4oKSB7XG4gICAgaW5pdENvbnRlbnRTY3JpcHQoKTtcbiAgfSxcbn0pO1xuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG4gIGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICBtZXRob2QoYFt3eHRdICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbiAgfVxufVxuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IHtcbiAgZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcbiAgbG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuICB3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcbiAgZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEludGVydmFscyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNsZWFySW50ZXJ2YWxgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsQW5pbWF0aW9uRnJhbWVgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsSWRsZUNhbGxiYWNrYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSwgb3B0aW9ucyk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICBhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuICAgIGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcbiAgICB9XG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/LihcbiAgICAgIHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLFxuICAgICAgaGFuZGxlcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgc2lnbmFsOiB0aGlzLnNpZ25hbFxuICAgICAgfVxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cbiAgICovXG4gIG5vdGlmeUludmFsaWRhdGVkKCkge1xuICAgIHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuICAgIGxvZ2dlci5kZWJ1ZyhcbiAgICAgIGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYFxuICAgICk7XG4gIH1cbiAgc3RvcE9sZFNjcmlwdHMoKSB7XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKFxuICAgICAge1xuICAgICAgICB0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG4gICAgICAgIGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuICAgICAgICBtZXNzYWdlSWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpXG4gICAgICB9LFxuICAgICAgXCIqXCJcbiAgICApO1xuICB9XG4gIHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuICAgIGNvbnN0IGlzU2NyaXB0U3RhcnRlZEV2ZW50ID0gZXZlbnQuZGF0YT8udHlwZSA9PT0gQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFO1xuICAgIGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kYXRhPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcbiAgICBjb25zdCBpc05vdER1cGxpY2F0ZSA9ICF0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5oYXMoZXZlbnQuZGF0YT8ubWVzc2FnZUlkKTtcbiAgICByZXR1cm4gaXNTY3JpcHRTdGFydGVkRXZlbnQgJiYgaXNTYW1lQ29udGVudFNjcmlwdCAmJiBpc05vdER1cGxpY2F0ZTtcbiAgfVxuICBsaXN0ZW5Gb3JOZXdlclNjcmlwdHMob3B0aW9ucykge1xuICAgIGxldCBpc0ZpcnN0ID0gdHJ1ZTtcbiAgICBjb25zdCBjYiA9IChldmVudCkgPT4ge1xuICAgICAgaWYgKHRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkge1xuICAgICAgICB0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5hZGQoZXZlbnQuZGF0YS5tZXNzYWdlSWQpO1xuICAgICAgICBjb25zdCB3YXNGaXJzdCA9IGlzRmlyc3Q7XG4gICAgICAgIGlzRmlyc3QgPSBmYWxzZTtcbiAgICAgICAgaWYgKHdhc0ZpcnN0ICYmIG9wdGlvbnM/Lmlnbm9yZUZpcnN0RXZlbnQpIHJldHVybjtcbiAgICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiByZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYikpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiZGVmaW5pdGlvbiIsImJyb3dzZXIiLCJfYnJvd3NlciIsInByaW50IiwibG9nZ2VyIl0sIm1hcHBpbmdzIjoiOztBQUFPLFdBQVMsb0JBQW9CQSxhQUFZO0FBQzlDLFdBQU9BO0FBQUEsRUFDVDtBQ1NBLFFBQUEsd0JBQUE7QUFNQSxRQUFBLGVBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBQXFCLEtBQUE7QUFPckIsUUFBQSxlQUFBLDJCQUFBLG1CQUFBLFlBQUEsQ0FBQTtBQUVBLFFBQUEsV0FBQTtBQUNBLFFBQUEsZ0JBQUE7QUFDQSxRQUFBLHFCQUFBO0FBQ0EsUUFBQSxxQkFBQTtBQUdBLFFBQUEsa0JBQUE7QUFHQSxRQUFBLGlCQUFBO0FBQ0EsUUFBQSxzQkFBQTtBQUNBLFFBQUEsb0JBQUE7QUFFQSxRQUFBLHdCQUFBO0FBR0EsUUFBQSxnQ0FBQTtBQUFBLElBQXNDO0FBQUE7QUFBQSxJQUNwQztBQUFBO0FBQUEsSUFDQTtBQUFBO0FBQUEsSUFDQTtBQUFBO0FBQUEsSUFDQTtBQUFBO0FBQUEsRUFFRixFQUFBLEtBQUEsSUFBQTtBQUVBLFFBQUEscUJBQUE7QUFBQSxJQUFxQztBQUFBLElBQ25DO0FBQUEsSUFDQTtBQUFBLElBQ0E7QUFBQSxFQUVGO0FBRUEsTUFBQSxnQkFBQTtBQUNBLE1BQUEsV0FBQTtBQVFBLFdBQUEsb0JBQUE7QUFDRSxRQUFBLE9BQUEsYUFBQSxZQUFBLFFBQUE7QUFDQSxRQUFBLFNBQUEsYUFBQSx1QkFBQSxRQUFBO0FBQ0EsV0FBQSxzQkFBQSxLQUFBLFNBQUEsSUFBQTtBQUFBLEVBQ0Y7QUFNQSxXQUFBLGVBQUE7QUFDRSxRQUFBLE9BQUEsYUFBQSxZQUFBO0FBQ0EsUUFBQSxTQUFBLGVBQUEsUUFBQSxFQUFBO0FBRUEsVUFBQSxRQUFBLFNBQUEsY0FBQSxPQUFBO0FBQ0EsVUFBQSxLQUFBO0FBQ0EsVUFBQSxjQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsK0JBQW9CLFlBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxlQWtGcUIsZUFBQTtBQUFBLGdCQXlFYixlQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFDQyxLQUFBO0FBaUM3QixLQUFBLFNBQUEsUUFBQSxTQUFBLGlCQUFBLFlBQUEsS0FBQTtBQUFBLEVBQ0Y7QUFNQSxXQUFBLGVBQUE7QUFDRSxRQUFBLGtCQUFBLE1BQUE7QUFDRSxhQUFBLGFBQUEsYUFBQTtBQUFBLElBQWlDO0FBRW5DLG9CQUFBLE9BQUEsV0FBQSxNQUFBO0FBQ0Usc0JBQUE7QUFDQSx5QkFBQTtBQUFBLElBQW1CLEdBQUEsa0JBQUE7QUFBQSxFQUV2QjtBQUVBLFdBQUEsaUJBQUE7QUFDRSxRQUFBLE9BQUEsYUFBQSxZQUFBO0FBRUEsUUFBQSxDQUFBLFNBQUEsTUFBQTtBQUNFLGFBQUE7QUFBQSxRQUFPO0FBQUEsUUFDTCxNQUFBO0FBRUUseUJBQUE7QUFBQSxRQUFlO0FBQUEsUUFDakIsRUFBQSxNQUFBLEtBQUE7QUFBQSxNQUNhO0FBRWY7QUFBQSxJQUFBO0FBR0YsUUFBQSxTQUFBO0FBRUEsZUFBQSxJQUFBLGlCQUFBLENBQUEsY0FBQTtBQUNFLFlBQUEscUJBQUEsVUFBQTtBQUFBLFFBQXFDLENBQUEsTUFBQSxFQUFBLFNBQUEsZ0JBQUEsRUFBQSxXQUFBLFNBQUEsS0FBQSxFQUFBLGFBQUEsU0FBQTtBQUFBLE1BQ2tEO0FBRXZGLFVBQUEsb0JBQUE7QUFDRSxxQkFBQTtBQUFBLE1BQWE7QUFBQSxJQUNmLENBQUE7QUFHRixhQUFBLFFBQUEsU0FBQSxNQUFBLEVBQUEsV0FBQSxNQUFBLFNBQUEsTUFBQTtBQUVBLFdBQUEsWUFBQSxNQUFBO0FBQ0UsbUJBQUE7QUFBQSxJQUFhLEdBQUEsa0JBQUE7QUFHZixpQkFBQTtBQUFBLEVBQ0Y7QUFLQSxXQUFBLHFCQUFBO0FBQ0UsUUFBQSxDQUFBLGtCQUFBLEVBQUE7QUFDQSxRQUFBLE9BQUEsYUFBQSxZQUFBO0FBRUEsNEJBQUE7QUFBQSxFQUNGO0FBTUEsV0FBQSwwQkFBQTtBQUVFLFVBQUEsVUFBQSxNQUFBO0FBQUEsTUFBc0IsU0FBQSxpQkFBQSxxQkFBQTtBQUFBLElBQzhDO0FBR3BFLGVBQUEsVUFBQSxTQUFBO0FBQ0UsWUFBQSxNQUFBLDBCQUFBLE1BQUE7QUFDQSxVQUFBLENBQUEsSUFBQTtBQUVBLFlBQUEsWUFBQSxPQUFBLFFBQUEsNkJBQUEsS0FBQSxPQUFBLGlCQUFBO0FBS0EsVUFBQSxDQUFBLFVBQUE7QUFDQSxVQUFBLGtCQUFBLFNBQUEsRUFBQTtBQUVBLGlDQUFBLFdBQUEsR0FBQTtBQUFBLElBQXlDO0FBSTNDLFVBQUEsZUFBQSxNQUFBO0FBQUEsTUFBMkIsU0FBQTtBQUFBLFFBQ2hCO0FBQUEsTUFDUDtBQUFBLElBQ0Y7QUFHRixlQUFBLE1BQUEsY0FBQTtBQUNFLFVBQUEsa0JBQUEsRUFBQSxFQUFBO0FBQ0EsWUFBQSxNQUFBLGFBQUEsRUFBQTtBQUNBLFVBQUEsQ0FBQSxJQUFBO0FBRUEsaUNBQUEsSUFBQSxHQUFBO0FBQUEsSUFBa0M7QUFBQSxFQUV0QztBQU1BLFdBQUEsa0JBQUEsV0FBQTtBQUNFLFdBQUEsQ0FBQSxDQUFBLFVBQUEsY0FBQSxJQUFBLGFBQUEsVUFBQTtBQUFBLEVBQ0Y7QUFFQSxXQUFBLDBCQUFBLFFBQUE7QUFDRSxVQUFBLE9BQUEsT0FBQTtBQUNBLFFBQUEsQ0FBQSxLQUFBLFFBQUE7QUFDQSxVQUFBLGFBQUEsbUJBQUEsS0FBQSxDQUFBLE9BQUEsR0FBQSxLQUFBLElBQUEsQ0FBQTtBQUNBLFdBQUEsYUFBQSxPQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsYUFBQSxTQUFBO0FBQ0UsVUFBQSxhQUFBLFFBQUEsY0FBQSxxQkFBQSxLQUFBLFFBQUEsUUFBQSxxQkFBQTtBQUlBLFFBQUEsWUFBQTtBQUNFLFlBQUEsT0FBQSwwQkFBQSxVQUFBO0FBQ0EsVUFBQSxLQUFBLFFBQUE7QUFBQSxJQUFpQjtBQUduQixVQUFBLFVBQUEsUUFBQSxhQUFBLGVBQUEsS0FBQSxRQUFBLGFBQUEsU0FBQTtBQUNBLFFBQUEsU0FBQTtBQUNFLFlBQUEsZUFBQSxTQUFBLGNBQUEsb0JBQUEsT0FBQSxJQUFBLEtBQUEsU0FBQSxjQUFBLGNBQUEsT0FBQSxJQUFBLEtBQUEsU0FBQSxjQUFBLFlBQUEsT0FBQSxJQUFBO0FBS0EsVUFBQSxjQUFBO0FBQ0UsY0FBQSxPQUFBLDBCQUFBLFlBQUE7QUFDQSxZQUFBLEtBQUEsUUFBQTtBQUFBLE1BQWlCO0FBSW5CLGFBQUEsa0RBQUEsbUJBQUEsT0FBQSxDQUFBO0FBQUEsSUFBb0Y7QUFHdEYsV0FBQTtBQUFBLEVBQ0Y7QUFLQSxXQUFBLGNBQUEsYUFBQSxRQUFBLEdBQUE7QUFDRSxRQUFBLFFBQUEsRUFBQSxRQUFBO0FBRUEsUUFBQTtBQUNFLFlBQUEsU0FBQSxJQUFBLElBQUEsYUFBQSxTQUFBLElBQUE7QUFDQSxZQUFBLFdBQUEsT0FBQTtBQUNBLFlBQUEsV0FBQSxPQUFBO0FBRUEsVUFBQSxhQUFBLG9CQUFBO0FBRUUsWUFBQSxTQUFBLFdBQUEsY0FBQSxHQUFBO0FBQ0UsZ0JBQUEsT0FBQSxPQUFBLGFBQUEsSUFBQSxVQUFBO0FBQ0EsY0FBQSxLQUFBLFFBQUEsY0FBQSxNQUFBLFFBQUEsQ0FBQTtBQUVBLGdCQUFBLEtBQUEsT0FBQSxhQUFBLElBQUEsSUFBQTtBQUNBLGNBQUEsSUFBQTtBQUNFLG1CQUFBLGtEQUFBLG1CQUFBLEVBQUEsQ0FBQTtBQUFBLFVBQStFO0FBRWpGLGlCQUFBO0FBQUEsUUFBTztBQUdULGNBQUEsWUFBQSxTQUFBLE1BQUEscUJBQUE7QUFDQSxZQUFBLFdBQUE7QUFDRSxnQkFBQSxLQUFBLFVBQUEsQ0FBQTtBQUNBLGlCQUFBLGtEQUFBLG1CQUFBLEVBQUEsQ0FBQTtBQUFBLFFBQStFO0FBR2pGLFlBQUEsYUFBQSxTQUFBO0FBQ0UsZ0JBQUEsS0FBQSxPQUFBLGFBQUEsSUFBQSxJQUFBO0FBQ0EsY0FBQSxJQUFBO0FBQ0UsbUJBQUEsa0RBQUEsbUJBQUEsRUFBQSxDQUFBO0FBQUEsVUFBK0U7QUFBQSxRQUNqRjtBQUdGLFlBQUEsYUFBQSxPQUFBO0FBQ0UsaUJBQUEsYUFBQSxJQUFBLFVBQUEsVUFBQTtBQUNBLGlCQUFBLE9BQUEsU0FBQTtBQUFBLFFBQXVCO0FBQUEsTUFDekI7QUFHRixVQUFBLGFBQUEsMEJBQUEsU0FBQSxXQUFBLFFBQUEsR0FBQTtBQUNFLGNBQUEsS0FBQSxPQUFBLGFBQUEsSUFBQSxJQUFBLEtBQUEsT0FBQSxhQUFBLElBQUEsWUFBQSxLQUFBLE9BQUEsYUFBQSxJQUFBLFFBQUE7QUFJQSxZQUFBLElBQUE7QUFDRSxpQkFBQSxrREFBQSxtQkFBQSxFQUFBLENBQUE7QUFBQSxRQUErRTtBQUFBLE1BQ2pGO0FBR0YsYUFBQTtBQUFBLElBQU8sUUFBQTtBQUVQLGFBQUE7QUFBQSxJQUFPO0FBQUEsRUFFWDtBQU1BLFdBQUEsMkJBQUEsV0FBQSxLQUFBO0FBQ0UsUUFBQSxDQUFBLElBQUE7QUFFQSxVQUFBLFdBQUEsT0FBQSxpQkFBQSxTQUFBO0FBQ0EsUUFBQSxTQUFBLGFBQUEsVUFBQTtBQUNFLGdCQUFBLE1BQUEsV0FBQTtBQUFBLElBQTJCO0FBRzdCLFVBQUEsU0FBQSxxQkFBQSxHQUFBO0FBRUEsVUFBQSxTQUFBLE9BQUEsY0FBQSxvQkFBQTtBQUNBLFFBQUEsUUFBQTtBQUNFLGFBQUEsVUFBQSxJQUFBLGlCQUFBO0FBQUEsSUFBc0M7QUFHeEMsY0FBQSxZQUFBLE1BQUE7QUFBQSxFQUNGO0FBTUEsV0FBQSxlQUFBLFFBQUE7QUFDRSxRQUFBLE9BQUEsVUFBQSxTQUFBLGFBQUEsRUFBQSxRQUFBO0FBQ0EsUUFBQSxPQUFBLFVBQUEsU0FBQSxhQUFBLEVBQUEsUUFBQTtBQUNBLFFBQUEsT0FBQSxVQUFBLFNBQUEsV0FBQSxFQUFBLFFBQUE7QUFDQSxXQUFBO0FBQUEsRUFDRjtBQUVBLFdBQUEsZUFBQSxRQUFBLE9BQUE7QUFDRSxVQUFBLE9BQUEsT0FBQSxjQUFBLG9CQUFBO0FBQ0EsVUFBQSxRQUFBLE9BQUEsY0FBQSxZQUFBO0FBQ0EsUUFBQSxDQUFBLFFBQUEsQ0FBQSxNQUFBO0FBR0EsV0FBQSxVQUFBLE9BQUEsZUFBQSxlQUFBLFdBQUE7QUFDQSxTQUFBLFVBQUEsT0FBQSxlQUFBLGtCQUFBLGdCQUFBO0FBQ0EsU0FBQSxjQUFBO0FBQ0EsV0FBQSxXQUFBO0FBQ0EsV0FBQSxNQUFBLGtCQUFBO0FBQ0EsVUFBQSxjQUFBO0FBRUEsWUFBQSxPQUFBO0FBQUEsTUFBZSxLQUFBO0FBR1g7QUFBQSxNQUFBLEtBQUE7QUFHQSxlQUFBLFVBQUEsSUFBQSxhQUFBO0FBQ0EsZUFBQSxXQUFBO0FBQ0EsY0FBQSxjQUFBO0FBQ0EsYUFBQSxVQUFBLElBQUEsYUFBQTtBQUNBO0FBQUEsTUFBQSxLQUFBO0FBR0EsZUFBQSxVQUFBLElBQUEsYUFBQTtBQUNBLGVBQUEsTUFBQSxrQkFBQTtBQUNBLGNBQUEsY0FBQTtBQUNBLGFBQUEsVUFBQSxJQUFBLGdCQUFBO0FBQ0EsYUFBQSxjQUFBO0FBQ0E7QUFBQSxNQUFBLEtBQUE7QUFHQSxlQUFBLFVBQUEsSUFBQSxXQUFBO0FBQ0EsZUFBQSxNQUFBLGtCQUFBO0FBQ0EsY0FBQSxjQUFBO0FBQ0EsYUFBQSxVQUFBLElBQUEsZ0JBQUE7QUFDQSxhQUFBLGNBQUE7QUFDQTtBQUFBLElBQUE7QUFBQSxFQUVOO0FBTUEsV0FBQSxxQkFBQSxLQUFBO0FBQ0UsVUFBQSxTQUFBLFNBQUEsY0FBQSxRQUFBO0FBQ0EsV0FBQSxPQUFBO0FBQ0EsV0FBQSxZQUFBO0FBQ0EsV0FBQSxhQUFBLGVBQUEsTUFBQTtBQUNBLFdBQUEsYUFBQSxjQUFBLDJCQUFBO0FBQ0EsV0FBQSxhQUFBLFNBQUEsZ0JBQUE7QUFFQSxVQUFBLGNBQUEsU0FBQSxjQUFBLE1BQUE7QUFDQSxnQkFBQSxZQUFBO0FBRUEsVUFBQSxXQUFBLFNBQUEsY0FBQSxNQUFBO0FBQ0EsYUFBQSxZQUFBO0FBQ0EsZ0JBQUEsWUFBQSxRQUFBO0FBRUEsVUFBQSxRQUFBLFNBQUEsY0FBQSxNQUFBO0FBQ0EsVUFBQSxZQUFBO0FBQ0EsVUFBQSxjQUFBO0FBRUEsV0FBQSxZQUFBLFdBQUE7QUFDQSxXQUFBLFlBQUEsS0FBQTtBQUVBLFdBQUEsaUJBQUEsU0FBQSxPQUFBLFVBQUE7QUFDRSxZQUFBLGVBQUE7QUFDQSxZQUFBLGdCQUFBO0FBQ0EsWUFBQSwwQkFBQSxRQUFBLEdBQUE7QUFBQSxJQUEyQyxDQUFBO0FBRzdDLFdBQUEsaUJBQUEsWUFBQSxPQUFBLFVBQUE7QUFDRSxVQUFBLE1BQUEsV0FBQSxFQUFBO0FBQ0EsWUFBQSxlQUFBO0FBQ0EsWUFBQSxnQkFBQTtBQUNBLFlBQUEsMEJBQUEsUUFBQSxHQUFBO0FBQUEsSUFBMkMsQ0FBQTtBQUc3QyxXQUFBO0FBQUEsRUFDRjtBQU1BLGlCQUFBLDBCQUFBLFFBQUEsS0FBQTtBQUlFLFFBQUEsQ0FBQSxJQUFBO0FBQ0EsUUFBQSxlQUFBLE1BQUEsTUFBQSxVQUFBO0FBRUEsbUJBQUEsUUFBQSxTQUFBO0FBQ0EsVUFBQSxRQUFBLEtBQUEsSUFBQTtBQUVBLFVBQUEsS0FBQSxNQUFBLGFBQUEsR0FBQTtBQUVBLFVBQUEsVUFBQSxLQUFBLElBQUEsSUFBQTtBQUNBLFFBQUEsVUFBQSxnQkFBQTtBQUNFLFlBQUEsTUFBQSxpQkFBQSxPQUFBO0FBQUEsSUFBb0M7QUFHdEMsUUFBQSxJQUFBO0FBQ0UscUJBQUEsUUFBQSxTQUFBO0FBQ0EsWUFBQSxNQUFBLG1CQUFBO0FBQUEsSUFBK0IsT0FBQTtBQUUvQixxQkFBQSxRQUFBLE9BQUE7QUFDQSxZQUFBLE1BQUEsaUJBQUE7QUFBQSxJQUE2QjtBQUcvQixtQkFBQSxRQUFBLE1BQUE7QUFBQSxFQUNGO0FBTUEsV0FBQSxhQUFBLFFBQUE7QUFDRSxRQUFBLENBQUEsVUFBQSxDQUFBLGdCQUFBLEtBQUEsTUFBQSxFQUFBLFFBQUEsUUFBQSxRQUFBLEtBQUE7QUFFQSxVQUFBLFdBQUEsY0FBQSxNQUFBO0FBR0EsUUFBQSxPQUFBLGNBQUEsZUFBQSxDQUFBLFVBQUEsUUFBQTtBQUNFLGFBQUEsUUFBQSxRQUFBLEtBQUE7QUFBQSxJQUE0QjtBQUk5QixRQUFBLDRDQUFBLEtBQUEsUUFBQSxHQUFBO0FBQ0UsYUFBQSxRQUFBLFFBQUEsS0FBQTtBQUFBLElBQTRCO0FBRzlCLFVBQUEsbUJBQUEsT0FBQSxXQUFBLGVBQUEsQ0FBQSxDQUFBLE9BQUEsV0FBQSxPQUFBLE9BQUEsUUFBQSxnQkFBQTtBQUtBLFFBQUEsa0JBQUE7QUFDRSxhQUFBLElBQUEsUUFBQSxDQUFBLFlBQUE7QUFDRSxZQUFBLFdBQUE7QUFFQSxZQUFBO0FBQ0UsaUJBQUEsUUFBQTtBQUFBLFlBQWUsRUFBQSxNQUFBLGdCQUFBLEtBQUEsU0FBQTtBQUFBLFlBQ3lCLENBQUEsYUFBQTtBQUVwQyxvQkFBQSxNQUFBLE9BQUEsUUFBQTtBQUNBLGtCQUFBLEtBQUE7QUFDRSx3QkFBQSxLQUFBLDRCQUFBLElBQUEsT0FBQTtBQUNBLHVDQUFBLFFBQUE7QUFDQSxvQkFBQSxDQUFBLFVBQUE7QUFDRSw2QkFBQTtBQUNBLDBCQUFBLElBQUE7QUFBQSxnQkFBWTtBQUVkO0FBQUEsY0FBQTtBQUdGLGtCQUFBLENBQUEsWUFBQSxTQUFBLE9BQUEsT0FBQTtBQUNFLG9CQUFBLFVBQUEsT0FBQTtBQUNFLDBCQUFBLEtBQUEsb0NBQUEsU0FBQSxLQUFBO0FBQUEsZ0JBQStEO0FBRWpFLHVDQUFBLFFBQUE7QUFDQSxvQkFBQSxDQUFBLFVBQUE7QUFDRSw2QkFBQTtBQUNBLDBCQUFBLElBQUE7QUFBQSxnQkFBWTtBQUVkO0FBQUEsY0FBQTtBQUdGLGtCQUFBLENBQUEsVUFBQTtBQUNFLDJCQUFBO0FBQ0Esd0JBQUEsSUFBQTtBQUFBLGNBQVk7QUFBQSxZQUNkO0FBQUEsVUFDRjtBQUlGLGlCQUFBLFdBQUEsTUFBQTtBQUNFLGdCQUFBLENBQUEsVUFBQTtBQUNFLHFDQUFBLFFBQUE7QUFDQSx5QkFBQTtBQUNBLHNCQUFBLElBQUE7QUFBQSxZQUFZO0FBQUEsVUFDZCxHQUFBLEdBQUE7QUFBQSxRQUNLLFNBQUEsR0FBQTtBQUVQLGtCQUFBLEtBQUEsNEJBQUEsQ0FBQTtBQUNBLGlDQUFBLFFBQUE7QUFDQSxjQUFBLENBQUEsU0FBQSxTQUFBLElBQUE7QUFBQSxRQUEyQjtBQUFBLE1BQzdCLENBQUE7QUFBQSxJQUNEO0FBSUgsMkJBQUEsUUFBQTtBQUNBLFdBQUEsUUFBQSxRQUFBLElBQUE7QUFBQSxFQUNGO0FBS0EsV0FBQSx1QkFBQSxLQUFBO0FBQ0UsUUFBQSxPQUFBLGFBQUEsWUFBQTtBQUVBLFVBQUEsU0FBQSxTQUFBLGNBQUEsR0FBQTtBQUNBLFdBQUEsT0FBQTtBQUNBLFdBQUEsU0FBQTtBQUNBLFdBQUEsTUFBQTtBQUNBLFdBQUEsTUFBQSxVQUFBO0FBRUEsYUFBQSxLQUFBLFlBQUEsTUFBQTtBQUNBLFdBQUEsTUFBQTtBQUVBLFdBQUEsV0FBQSxNQUFBO0FBQ0UsYUFBQSxPQUFBO0FBQUEsSUFBYyxHQUFBLENBQUE7QUFBQSxFQUVsQjtBQUVBLFdBQUEsTUFBQSxJQUFBO0FBQ0UsV0FBQSxJQUFBLFFBQUEsQ0FBQSxZQUFBLE9BQUEsV0FBQSxTQUFBLEVBQUEsQ0FBQTtBQUFBLEVBQ0Y7QUFNQSxXQUFBLG9CQUFBO0FBQ0UsUUFBQSxDQUFBLGtCQUFBLEVBQUE7QUFDQSxpQkFBQTtBQUNBLG1CQUFBO0FBQUEsRUFDRjtBQUVBLFFBQUEsYUFBQSxvQkFBQTtBQUFBLElBQW1DLFNBQUEsQ0FBQSxnQ0FBQTtBQUFBLElBQ1MsT0FBQTtBQUFBLElBQ25DLE9BQUE7QUFFTCx3QkFBQTtBQUFBLElBQWtCO0FBQUEsRUFFdEIsQ0FBQTtBQzV1Qk8sUUFBTUMsWUFBVSxXQUFXLFNBQVMsU0FBUyxLQUNoRCxXQUFXLFVBQ1gsV0FBVztBQ0ZSLFFBQU0sVUFBVUM7QUNEdkIsV0FBU0MsUUFBTSxXQUFXLE1BQU07QUFFOUIsUUFBSSxPQUFPLEtBQUssQ0FBQyxNQUFNLFVBQVU7QUFDL0IsWUFBTSxVQUFVLEtBQUssTUFBQTtBQUNyQixhQUFPLFNBQVMsT0FBTyxJQUFJLEdBQUcsSUFBSTtBQUFBLElBQ3BDLE9BQU87QUFDTCxhQUFPLFNBQVMsR0FBRyxJQUFJO0FBQUEsSUFDekI7QUFBQSxFQUNGO0FBQ08sUUFBTUMsV0FBUztBQUFBLElBQ3BCLE9BQU8sSUFBSSxTQUFTRCxRQUFNLFFBQVEsT0FBTyxHQUFHLElBQUk7QUFBQSxJQUNoRCxLQUFLLElBQUksU0FBU0EsUUFBTSxRQUFRLEtBQUssR0FBRyxJQUFJO0FBQUEsSUFDNUMsTUFBTSxJQUFJLFNBQVNBLFFBQU0sUUFBUSxNQUFNLEdBQUcsSUFBSTtBQUFBLElBQzlDLE9BQU8sSUFBSSxTQUFTQSxRQUFNLFFBQVEsT0FBTyxHQUFHLElBQUk7QUFBQSxFQUNsRDtBQUFBLEVDYk8sTUFBTSwrQkFBK0IsTUFBTTtBQUFBLElBQ2hELFlBQVksUUFBUSxRQUFRO0FBQzFCLFlBQU0sdUJBQXVCLFlBQVksRUFBRTtBQUMzQyxXQUFLLFNBQVM7QUFDZCxXQUFLLFNBQVM7QUFBQSxJQUNoQjtBQUFBLElBQ0EsT0FBTyxhQUFhLG1CQUFtQixvQkFBb0I7QUFBQSxFQUM3RDtBQUNPLFdBQVMsbUJBQW1CLFdBQVc7QUFDNUMsV0FBTyxHQUFHLFNBQVMsU0FBUyxFQUFFLElBQUksU0FBMEIsSUFBSSxTQUFTO0FBQUEsRUFDM0U7QUNWTyxXQUFTLHNCQUFzQixLQUFLO0FBQ3pDLFFBQUk7QUFDSixRQUFJO0FBQ0osV0FBTztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsTUFLTCxNQUFNO0FBQ0osWUFBSSxZQUFZLEtBQU07QUFDdEIsaUJBQVMsSUFBSSxJQUFJLFNBQVMsSUFBSTtBQUM5QixtQkFBVyxJQUFJLFlBQVksTUFBTTtBQUMvQixjQUFJLFNBQVMsSUFBSSxJQUFJLFNBQVMsSUFBSTtBQUNsQyxjQUFJLE9BQU8sU0FBUyxPQUFPLE1BQU07QUFDL0IsbUJBQU8sY0FBYyxJQUFJLHVCQUF1QixRQUFRLE1BQU0sQ0FBQztBQUMvRCxxQkFBUztBQUFBLFVBQ1g7QUFBQSxRQUNGLEdBQUcsR0FBRztBQUFBLE1BQ1I7QUFBQSxJQUNKO0FBQUEsRUFDQTtBQUFBLEVDZk8sTUFBTSxxQkFBcUI7QUFBQSxJQUNoQyxZQUFZLG1CQUFtQixTQUFTO0FBQ3RDLFdBQUssb0JBQW9CO0FBQ3pCLFdBQUssVUFBVTtBQUNmLFdBQUssa0JBQWtCLElBQUksZ0JBQWU7QUFDMUMsVUFBSSxLQUFLLFlBQVk7QUFDbkIsYUFBSyxzQkFBc0IsRUFBRSxrQkFBa0IsS0FBSSxDQUFFO0FBQ3JELGFBQUssZUFBYztBQUFBLE1BQ3JCLE9BQU87QUFDTCxhQUFLLHNCQUFxQjtBQUFBLE1BQzVCO0FBQUEsSUFDRjtBQUFBLElBQ0EsT0FBTyw4QkFBOEI7QUFBQSxNQUNuQztBQUFBLElBQ0o7QUFBQSxJQUNFLGFBQWEsT0FBTyxTQUFTLE9BQU87QUFBQSxJQUNwQztBQUFBLElBQ0Esa0JBQWtCLHNCQUFzQixJQUFJO0FBQUEsSUFDNUMscUJBQXFDLG9CQUFJLElBQUc7QUFBQSxJQUM1QyxJQUFJLFNBQVM7QUFDWCxhQUFPLEtBQUssZ0JBQWdCO0FBQUEsSUFDOUI7QUFBQSxJQUNBLE1BQU0sUUFBUTtBQUNaLGFBQU8sS0FBSyxnQkFBZ0IsTUFBTSxNQUFNO0FBQUEsSUFDMUM7QUFBQSxJQUNBLElBQUksWUFBWTtBQUNkLFVBQUksUUFBUSxRQUFRLE1BQU0sTUFBTTtBQUM5QixhQUFLLGtCQUFpQjtBQUFBLE1BQ3hCO0FBQ0EsYUFBTyxLQUFLLE9BQU87QUFBQSxJQUNyQjtBQUFBLElBQ0EsSUFBSSxVQUFVO0FBQ1osYUFBTyxDQUFDLEtBQUs7QUFBQSxJQUNmO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQWNBLGNBQWMsSUFBSTtBQUNoQixXQUFLLE9BQU8saUJBQWlCLFNBQVMsRUFBRTtBQUN4QyxhQUFPLE1BQU0sS0FBSyxPQUFPLG9CQUFvQixTQUFTLEVBQUU7QUFBQSxJQUMxRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQVlBLFFBQVE7QUFDTixhQUFPLElBQUksUUFBUSxNQUFNO0FBQUEsTUFDekIsQ0FBQztBQUFBLElBQ0g7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFNQSxZQUFZLFNBQVMsU0FBUztBQUM1QixZQUFNLEtBQUssWUFBWSxNQUFNO0FBQzNCLFlBQUksS0FBSyxRQUFTLFNBQU87QUFBQSxNQUMzQixHQUFHLE9BQU87QUFDVixXQUFLLGNBQWMsTUFBTSxjQUFjLEVBQUUsQ0FBQztBQUMxQyxhQUFPO0FBQUEsSUFDVDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQU1BLFdBQVcsU0FBUyxTQUFTO0FBQzNCLFlBQU0sS0FBSyxXQUFXLE1BQU07QUFDMUIsWUFBSSxLQUFLLFFBQVMsU0FBTztBQUFBLE1BQzNCLEdBQUcsT0FBTztBQUNWLFdBQUssY0FBYyxNQUFNLGFBQWEsRUFBRSxDQUFDO0FBQ3pDLGFBQU87QUFBQSxJQUNUO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFPQSxzQkFBc0IsVUFBVTtBQUM5QixZQUFNLEtBQUssc0JBQXNCLElBQUksU0FBUztBQUM1QyxZQUFJLEtBQUssUUFBUyxVQUFTLEdBQUcsSUFBSTtBQUFBLE1BQ3BDLENBQUM7QUFDRCxXQUFLLGNBQWMsTUFBTSxxQkFBcUIsRUFBRSxDQUFDO0FBQ2pELGFBQU87QUFBQSxJQUNUO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsSUFPQSxvQkFBb0IsVUFBVSxTQUFTO0FBQ3JDLFlBQU0sS0FBSyxvQkFBb0IsSUFBSSxTQUFTO0FBQzFDLFlBQUksQ0FBQyxLQUFLLE9BQU8sUUFBUyxVQUFTLEdBQUcsSUFBSTtBQUFBLE1BQzVDLEdBQUcsT0FBTztBQUNWLFdBQUssY0FBYyxNQUFNLG1CQUFtQixFQUFFLENBQUM7QUFDL0MsYUFBTztBQUFBLElBQ1Q7QUFBQSxJQUNBLGlCQUFpQixRQUFRLE1BQU0sU0FBUyxTQUFTO0FBQy9DLFVBQUksU0FBUyxzQkFBc0I7QUFDakMsWUFBSSxLQUFLLFFBQVMsTUFBSyxnQkFBZ0IsSUFBRztBQUFBLE1BQzVDO0FBQ0EsYUFBTztBQUFBLFFBQ0wsS0FBSyxXQUFXLE1BQU0sSUFBSSxtQkFBbUIsSUFBSSxJQUFJO0FBQUEsUUFDckQ7QUFBQSxRQUNBO0FBQUEsVUFDRSxHQUFHO0FBQUEsVUFDSCxRQUFRLEtBQUs7QUFBQSxRQUNyQjtBQUFBLE1BQ0E7QUFBQSxJQUNFO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxJQUtBLG9CQUFvQjtBQUNsQixXQUFLLE1BQU0sb0NBQW9DO0FBQy9DQyxlQUFPO0FBQUEsUUFDTCxtQkFBbUIsS0FBSyxpQkFBaUI7QUFBQSxNQUMvQztBQUFBLElBQ0U7QUFBQSxJQUNBLGlCQUFpQjtBQUNmLGFBQU87QUFBQSxRQUNMO0FBQUEsVUFDRSxNQUFNLHFCQUFxQjtBQUFBLFVBQzNCLG1CQUFtQixLQUFLO0FBQUEsVUFDeEIsV0FBVyxLQUFLLE9BQU0sRUFBRyxTQUFTLEVBQUUsRUFBRSxNQUFNLENBQUM7QUFBQSxRQUNyRDtBQUFBLFFBQ007QUFBQSxNQUNOO0FBQUEsSUFDRTtBQUFBLElBQ0EseUJBQXlCLE9BQU87QUFDOUIsWUFBTSx1QkFBdUIsTUFBTSxNQUFNLFNBQVMscUJBQXFCO0FBQ3ZFLFlBQU0sc0JBQXNCLE1BQU0sTUFBTSxzQkFBc0IsS0FBSztBQUNuRSxZQUFNLGlCQUFpQixDQUFDLEtBQUssbUJBQW1CLElBQUksTUFBTSxNQUFNLFNBQVM7QUFDekUsYUFBTyx3QkFBd0IsdUJBQXVCO0FBQUEsSUFDeEQ7QUFBQSxJQUNBLHNCQUFzQixTQUFTO0FBQzdCLFVBQUksVUFBVTtBQUNkLFlBQU0sS0FBSyxDQUFDLFVBQVU7QUFDcEIsWUFBSSxLQUFLLHlCQUF5QixLQUFLLEdBQUc7QUFDeEMsZUFBSyxtQkFBbUIsSUFBSSxNQUFNLEtBQUssU0FBUztBQUNoRCxnQkFBTSxXQUFXO0FBQ2pCLG9CQUFVO0FBQ1YsY0FBSSxZQUFZLFNBQVMsaUJBQWtCO0FBQzNDLGVBQUssa0JBQWlCO0FBQUEsUUFDeEI7QUFBQSxNQUNGO0FBQ0EsdUJBQWlCLFdBQVcsRUFBRTtBQUM5QixXQUFLLGNBQWMsTUFBTSxvQkFBb0IsV0FBVyxFQUFFLENBQUM7QUFBQSxJQUM3RDtBQUFBLEVBQ0Y7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwyLDMsNCw1LDYsN119
content;