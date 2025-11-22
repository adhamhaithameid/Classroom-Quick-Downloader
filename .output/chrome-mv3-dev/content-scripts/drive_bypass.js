var drivebypass = (function() {
  "use strict";
  function defineContentScript(definition2) {
    return definition2;
  }
  const definition = defineContentScript({
    matches: [
      "https://drive.google.com/*",
      "https://drive.usercontent.google.com/*"
    ],
    // Start early so we can react quickly to 403 / virus / preview pages
    runAt: "document_start",
    main() {
      let virusHandled = false;
      let previewClicked = false;
      let auth403Reported = false;
      const tick = () => {
        const url = window.location.href;
        const body = document.body;
        const bodyText = (body?.innerText || "").toLowerCase();
        if (!virusHandled && isVirusWarningPage(bodyText)) {
          console.log(
            '[CQD] Virus / large-file warning detected. Auto-clicking "Download anyway"...'
          );
          if (handleVirusBypassClick()) {
            virusHandled = true;
            notifySuccessFlood();
            return;
          }
        }
        if (!previewClicked && isDrivePreviewUI()) {
          const clicked = clickDriveToolbarDownload();
          if (clicked) {
            previewClicked = true;
            console.log(
              "[CQD] Drive preview toolbar Download clicked. Notifying background success…"
            );
            notifySuccessFlood();
          }
        }
        if (!auth403Reported && (url.includes("drive.google.com") || url.includes("drive.usercontent.google.com")) && isAccessDeniedPage(bodyText)) {
          auth403Reported = true;
          console.log(
            "[CQD] Hard 403 in Drive tab. Reporting CQD_403_SEEN to background…"
          );
          try {
            chrome.runtime.sendMessage({ type: "CQD_403_SEEN" });
          } catch {
          }
        }
      };
      tick();
      const intervalId = window.setInterval(tick, 300);
      window.setTimeout(() => {
        window.clearInterval(intervalId);
      }, 45e3);
    }
  });
  function isVirusWarningPage(bodyText) {
    return bodyText.includes("can't be scanned for viruses") || bodyText.includes("cant be scanned for viruses") || bodyText.includes("can't scan this file for viruses") || bodyText.includes("download anyway") || bodyText.includes("تنزيل على أي حال") || !!document.getElementById("uc-download-link");
  }
  function isDrivePreviewUI() {
    return document.querySelector('div[aria-label="Download"]') !== null || document.querySelector('div[data-tooltip="Download"]') !== null || document.querySelector('div[role="button"][aria-label="Download"]') !== null || window.location.href.includes("/view");
  }
  function isAccessDeniedPage(bodyText) {
    return bodyText.includes("forbidden") || bodyText.includes("you do not have access") || bodyText.includes("access to this page is restricted") || bodyText.includes("request access") || bodyText.includes("switch accounts") || bodyText.includes("403") || // generic 403 detection
    bodyText.includes("that’s an error") || bodyText.includes("that's an error") || bodyText.includes("we're sorry, but you do not have access");
  }
  function handleVirusBypassClick() {
    let clicked = false;
    const directBtn = document.getElementById("uc-download-link");
    if (directBtn instanceof HTMLElement) {
      directBtn.click();
      clicked = true;
    }
    if (!clicked) {
      const form = document.querySelector('form[action*="confirm="]');
      if (form instanceof HTMLFormElement) {
        form.submit();
        clicked = true;
      }
    }
    if (!clicked) {
      const candidates = document.querySelectorAll(
        'a, button, input[type="submit"]'
      );
      for (const el of candidates) {
        const text = (el.innerText || el.getAttribute("value") || "").toLowerCase();
        if (text.includes("download anyway") || text.includes("تنزيل على أي حال")) {
          el.click();
          clicked = true;
          break;
        }
      }
    }
    if (clicked) {
      console.log(
        '[CQD] "Download anyway" / virus-bypass action triggered successfully.'
      );
    }
    return clicked;
  }
  function notifySuccessFlood() {
    const send = () => {
      try {
        chrome.runtime.sendMessage({ type: "CQD_BYPASS_SUCCESS" });
      } catch {
      }
    };
    send();
    let count = 0;
    const maxBursts = 8;
    const id = window.setInterval(() => {
      count += 1;
      if (count > maxBursts) {
        window.clearInterval(id);
        return;
      }
      send();
    }, 1e3);
  }
  function clickDriveToolbarDownload() {
    const btn = document.querySelector('div[aria-label="Download"]') || document.querySelector('div[data-tooltip="Download"]') || document.querySelector(
      'div[role="button"][aria-label="Download"]'
    );
    if (!btn) return false;
    simulateHumanClick(btn);
    return true;
  }
  function simulateHumanClick(element) {
    const opts = {
      bubbles: true,
      cancelable: true,
      view: window
    };
    element.dispatchEvent(new MouseEvent("mousedown", opts));
    element.dispatchEvent(new MouseEvent("mouseup", opts));
    element.dispatchEvent(new MouseEvent("click", opts));
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
    return `${browser?.runtime?.id}:${"drive_bypass"}:${eventName}`;
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
      const ctx = new ContentScriptContext("drive_bypass", options);
      return await main(ctx);
    } catch (err) {
      logger.error(
        `The content script "${"drive_bypass"}" crashed on startup!`,
        err
      );
      throw err;
    }
  })();
  return result;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZHJpdmVfYnlwYXNzLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vd3h0QDAuMjAuMTFfQHR5cGVzK25vZGVAMjQuMTAuMV9qaXRpQDIuNi4xX2xpZ2h0bmluZ2Nzc0AxLjMwLjFfcm9sbHVwQDQuNTMuMi9ub2RlX21vZHVsZXMvd3h0L2Rpc3QvdXRpbHMvZGVmaW5lLWNvbnRlbnQtc2NyaXB0Lm1qcyIsIi4uLy4uLy4uL2VudHJ5cG9pbnRzL2RyaXZlX2J5cGFzcy5jb250ZW50LnRzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3eHQtZGV2K2Jyb3dzZXJAMC4xLjQvbm9kZV9tb2R1bGVzL0B3eHQtZGV2L2Jyb3dzZXIvc3JjL2luZGV4Lm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC9icm93c2VyLm1qcyIsIi4uLy4uLy4uLy4uLy4uLy4uL25vZGVfbW9kdWxlcy8ucG5wbS93eHRAMC4yMC4xMV9AdHlwZXMrbm9kZUAyNC4xMC4xX2ppdGlAMi42LjFfbGlnaHRuaW5nY3NzQDEuMzAuMV9yb2xsdXBANC41My4yL25vZGVfbW9kdWxlcy93eHQvZGlzdC91dGlscy9pbnRlcm5hbC9sb2dnZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2N1c3RvbS1ldmVudHMubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2ludGVybmFsL2xvY2F0aW9uLXdhdGNoZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2NvbnRlbnQtc2NyaXB0LWNvbnRleHQubWpzIl0sInNvdXJjZXNDb250ZW50IjpbImV4cG9ydCBmdW5jdGlvbiBkZWZpbmVDb250ZW50U2NyaXB0KGRlZmluaXRpb24pIHtcbiAgcmV0dXJuIGRlZmluaXRpb247XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvZHJpdmVfYnlwYXNzLmNvbnRlbnQudHNcblxudHlwZSBQYWdlU3RhdGUgPVxuICB8ICdTVEFURV9MT0FESU5HJ1xuICB8ICdTVEFURV9WSVJVU19XQVJOSU5HJ1xuICB8ICdTVEFURV9EUklWRV9QUkVWSUVXJ1xuICB8ICdTVEFURV9BQ0NFU1NfREVOSUVEJztcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29udGVudFNjcmlwdCh7XG4gIG1hdGNoZXM6IFtcbiAgICAnaHR0cHM6Ly9kcml2ZS5nb29nbGUuY29tLyonLFxuICAgICdodHRwczovL2RyaXZlLnVzZXJjb250ZW50Lmdvb2dsZS5jb20vKicsXG4gIF0sXG4gIC8vIFN0YXJ0IGVhcmx5IHNvIHdlIGNhbiByZWFjdCBxdWlja2x5IHRvIDQwMyAvIHZpcnVzIC8gcHJldmlldyBwYWdlc1xuICBydW5BdDogJ2RvY3VtZW50X3N0YXJ0JyxcbiAgbWFpbigpIHtcbiAgICBsZXQgdmlydXNIYW5kbGVkID0gZmFsc2U7XG4gICAgbGV0IHByZXZpZXdDbGlja2VkID0gZmFsc2U7XG4gICAgbGV0IGF1dGg0MDNSZXBvcnRlZCA9IGZhbHNlO1xuXG4gICAgY29uc3QgdGljayA9ICgpID0+IHtcbiAgICAgIGNvbnN0IHVybCA9IHdpbmRvdy5sb2NhdGlvbi5ocmVmO1xuICAgICAgY29uc3QgYm9keSA9IGRvY3VtZW50LmJvZHk7XG4gICAgICBjb25zdCBib2R5VGV4dCA9IChib2R5Py5pbm5lclRleHQgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG5cbiAgICAgIC8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAgICAgKiAxKSBWaXJ1cyAvIGxhcmdlIGZpbGUgd2FybmluZyDihpIgYXV0byBcIkRvd25sb2FkIGFueXdheVwiXG4gICAgICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSAqL1xuICAgICAgaWYgKCF2aXJ1c0hhbmRsZWQgJiYgaXNWaXJ1c1dhcm5pbmdQYWdlKGJvZHlUZXh0KSkge1xuICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAnW0NRRF0gVmlydXMgLyBsYXJnZS1maWxlIHdhcm5pbmcgZGV0ZWN0ZWQuIEF1dG8tY2xpY2tpbmcgXCJEb3dubG9hZCBhbnl3YXlcIi4uLicsXG4gICAgICAgICk7XG4gICAgICAgIGlmIChoYW5kbGVWaXJ1c0J5cGFzc0NsaWNrKCkpIHtcbiAgICAgICAgICB2aXJ1c0hhbmRsZWQgPSB0cnVlO1xuXG4gICAgICAgICAgLy8gVGVsbCBiYWNrZ3JvdW5kIFwiYnlwYXNzIHRyaWdnZXJlZCwgZmxpcCBVSSB0byBzdWNjZXNzXCJcbiAgICAgICAgICBub3RpZnlTdWNjZXNzRmxvb2QoKTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAqIDIpIERyaXZlIFByZXZpZXcgVUkg4oaSIGNsaWNrIHRvb2xiYXIgRG93bmxvYWRcbiAgICAgICAqICAgIChOT1JNQUwgU01BTEwgLyBNRURJVU0gZmlsZXMgcGF0aClcbiAgICAgICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tICovXG4gICAgICBpZiAoIXByZXZpZXdDbGlja2VkICYmIGlzRHJpdmVQcmV2aWV3VUkoKSkge1xuICAgICAgICBjb25zdCBjbGlja2VkID0gY2xpY2tEcml2ZVRvb2xiYXJEb3dubG9hZCgpO1xuICAgICAgICBpZiAoY2xpY2tlZCkge1xuICAgICAgICAgIHByZXZpZXdDbGlja2VkID0gdHJ1ZTtcbiAgICAgICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgICAgICdbQ1FEXSBEcml2ZSBwcmV2aWV3IHRvb2xiYXIgRG93bmxvYWQgY2xpY2tlZC4gTm90aWZ5aW5nIGJhY2tncm91bmQgc3VjY2Vzc+KApicsXG4gICAgICAgICAgKTtcblxuICAgICAgICAgIC8vIFNhbWUgc3VjY2VzcyBwYXRoOiBwcmV2aWV3IFVJIHRyaWdnZXJlZCB0aGUgcmVhbCBmaWxlIGRvd25sb2FkXG4gICAgICAgICAgbm90aWZ5U3VjY2Vzc0Zsb29kKCk7XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICAgICAqIDMpIEhhcmQgNDAzIG9uIERyaXZlIChnb29nbGUuY29tIG9yIHVzZXJjb250ZW50KSDihpIgcmVwb3J0IHRvIGJhY2tncm91bmRcbiAgICAgICAqICAgICh3aGVuIGF1dGh1c2VyIGxvb3AgaW4gYmFja2dyb3VuZCBzaG91bGQgdGFrZSBvdmVyKVxuICAgICAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0gKi9cbiAgICAgIGlmIChcbiAgICAgICAgIWF1dGg0MDNSZXBvcnRlZCAmJlxuICAgICAgICAodXJsLmluY2x1ZGVzKCdkcml2ZS5nb29nbGUuY29tJykgfHxcbiAgICAgICAgICB1cmwuaW5jbHVkZXMoJ2RyaXZlLnVzZXJjb250ZW50Lmdvb2dsZS5jb20nKSkgJiZcbiAgICAgICAgaXNBY2Nlc3NEZW5pZWRQYWdlKGJvZHlUZXh0KVxuICAgICAgKSB7XG4gICAgICAgIGF1dGg0MDNSZXBvcnRlZCA9IHRydWU7XG4gICAgICAgIGNvbnNvbGUubG9nKFxuICAgICAgICAgICdbQ1FEXSBIYXJkIDQwMyBpbiBEcml2ZSB0YWIuIFJlcG9ydGluZyBDUURfNDAzX1NFRU4gdG8gYmFja2dyb3VuZOKApicsXG4gICAgICAgICk7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY2hyb21lLnJ1bnRpbWUuc2VuZE1lc3NhZ2UoeyB0eXBlOiAnQ1FEXzQwM19TRUVOJyB9KTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLyogaWdub3JlICovXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9O1xuXG4gICAgLy8gUnVuIGltbWVkaWF0ZWx5ICYga2VlcCB3YXRjaGluZyDigJMgRHJpdmUgdXBkYXRlcyBET00gZHluYW1pY2FsbHlcbiAgICB0aWNrKCk7XG5cbiAgICAvLyBTbGlnaHRseSBmYXN0ZXIgdGhhbiBiZWZvcmU6IGV2ZXJ5IDMwMCBtcyAod2FzIDUwMCBtcylcbiAgICBjb25zdCBpbnRlcnZhbElkID0gd2luZG93LnNldEludGVydmFsKHRpY2ssIDMwMCk7XG5cbiAgICAvLyBTYWZldHk6IHN0b3AgYWZ0ZXIgfjQ1cyBpZiBub3RoaW5nIGludGVyZXN0aW5nIGhhcHBlbnNcbiAgICB3aW5kb3cuc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICB3aW5kb3cuY2xlYXJJbnRlcnZhbChpbnRlcnZhbElkKTtcbiAgICB9LCA0NTAwMCk7XG4gIH0sXG59KTtcblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIERldGVjdGlvbiBoZWxwZXJzXG4gKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5mdW5jdGlvbiBpc1ZpcnVzV2FybmluZ1BhZ2UoYm9keVRleHQ6IHN0cmluZyk6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIGJvZHlUZXh0LmluY2x1ZGVzKFwiY2FuJ3QgYmUgc2Nhbm5lZCBmb3IgdmlydXNlc1wiKSB8fFxuICAgIGJvZHlUZXh0LmluY2x1ZGVzKCdjYW50IGJlIHNjYW5uZWQgZm9yIHZpcnVzZXMnKSB8fFxuICAgIGJvZHlUZXh0LmluY2x1ZGVzKFwiY2FuJ3Qgc2NhbiB0aGlzIGZpbGUgZm9yIHZpcnVzZXNcIikgfHxcbiAgICBib2R5VGV4dC5pbmNsdWRlcygnZG93bmxvYWQgYW55d2F5JykgfHxcbiAgICBib2R5VGV4dC5pbmNsdWRlcygn2KrZhtiy2YrZhCDYudmE2Ykg2KPZiiDYrdin2YQnKSB8fFxuICAgICEhZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoJ3VjLWRvd25sb2FkLWxpbmsnKVxuICApO1xufVxuXG5mdW5jdGlvbiBpc0RyaXZlUHJldmlld1VJKCk6IGJvb2xlYW4ge1xuICByZXR1cm4gKFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2RpdlthcmlhLWxhYmVsPVwiRG93bmxvYWRcIl0nKSAhPT0gbnVsbCB8fFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2RpdltkYXRhLXRvb2x0aXA9XCJEb3dubG9hZFwiXScpICE9PSBudWxsIHx8XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcignZGl2W3JvbGU9XCJidXR0b25cIl1bYXJpYS1sYWJlbD1cIkRvd25sb2FkXCJdJykgIT09XG4gICAgICBudWxsIHx8XG4gICAgd2luZG93LmxvY2F0aW9uLmhyZWYuaW5jbHVkZXMoJy92aWV3JylcbiAgKTtcbn1cblxuZnVuY3Rpb24gaXNBY2Nlc3NEZW5pZWRQYWdlKGJvZHlUZXh0OiBzdHJpbmcpOiBib29sZWFuIHtcbiAgcmV0dXJuIChcbiAgICBib2R5VGV4dC5pbmNsdWRlcygnZm9yYmlkZGVuJykgfHxcbiAgICBib2R5VGV4dC5pbmNsdWRlcygneW91IGRvIG5vdCBoYXZlIGFjY2VzcycpIHx8XG4gICAgYm9keVRleHQuaW5jbHVkZXMoJ2FjY2VzcyB0byB0aGlzIHBhZ2UgaXMgcmVzdHJpY3RlZCcpIHx8XG4gICAgYm9keVRleHQuaW5jbHVkZXMoJ3JlcXVlc3QgYWNjZXNzJykgfHxcbiAgICBib2R5VGV4dC5pbmNsdWRlcygnc3dpdGNoIGFjY291bnRzJykgfHxcbiAgICBib2R5VGV4dC5pbmNsdWRlcygnNDAzJykgfHwgLy8gZ2VuZXJpYyA0MDMgZGV0ZWN0aW9uXG4gICAgYm9keVRleHQuaW5jbHVkZXMoXCJ0aGF04oCZcyBhbiBlcnJvclwiKSB8fFxuICAgIGJvZHlUZXh0LmluY2x1ZGVzKFwidGhhdCdzIGFuIGVycm9yXCIpIHx8XG4gICAgYm9keVRleHQuaW5jbHVkZXMoXCJ3ZSdyZSBzb3JyeSwgYnV0IHlvdSBkbyBub3QgaGF2ZSBhY2Nlc3NcIilcbiAgKTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFZpcnVzIC8gbGFyZ2UtZmlsZSBieXBhc3MgKG9yaWdpbmFsIGJlaGF2aW9yKVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gaGFuZGxlVmlydXNCeXBhc3NDbGljaygpOiBib29sZWFuIHtcbiAgbGV0IGNsaWNrZWQgPSBmYWxzZTtcblxuICAvLyBTdHJhdGVneSAxOiBkaXJlY3QgSUQgKG1vc3QgY29tbW9uKVxuICBjb25zdCBkaXJlY3RCdG4gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgndWMtZG93bmxvYWQtbGluaycpO1xuICBpZiAoZGlyZWN0QnRuIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQpIHtcbiAgICBkaXJlY3RCdG4uY2xpY2soKTtcbiAgICBjbGlja2VkID0gdHJ1ZTtcbiAgfVxuXG4gIC8vIFN0cmF0ZWd5IDI6IGZvcm0gd2l0aCBjb25maXJtPSBpbiBhY3Rpb25cbiAgaWYgKCFjbGlja2VkKSB7XG4gICAgY29uc3QgZm9ybSA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3IoJ2Zvcm1bYWN0aW9uKj1cImNvbmZpcm09XCJdJyk7XG4gICAgaWYgKGZvcm0gaW5zdGFuY2VvZiBIVE1MRm9ybUVsZW1lbnQpIHtcbiAgICAgIGZvcm0uc3VibWl0KCk7XG4gICAgICBjbGlja2VkID0gdHJ1ZTtcbiAgICB9XG4gIH1cblxuICAvLyBTdHJhdGVneSAzOiB0ZXh0IHNlYXJjaCBmYWxsYmFjayAoXCJEb3dubG9hZCBhbnl3YXlcIiBFbmdsaXNoL0FyYWJpYylcbiAgaWYgKCFjbGlja2VkKSB7XG4gICAgY29uc3QgY2FuZGlkYXRlcyA9IGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3JBbGw8SFRNTEVsZW1lbnQ+KFxuICAgICAgJ2EsIGJ1dHRvbiwgaW5wdXRbdHlwZT1cInN1Ym1pdFwiXScsXG4gICAgKTtcblxuICAgIGZvciAoY29uc3QgZWwgb2YgY2FuZGlkYXRlcykge1xuICAgICAgY29uc3QgdGV4dCA9XG4gICAgICAgIChlbC5pbm5lclRleHQgfHwgZWwuZ2V0QXR0cmlidXRlKCd2YWx1ZScpIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKFxuICAgICAgICB0ZXh0LmluY2x1ZGVzKCdkb3dubG9hZCBhbnl3YXknKSB8fFxuICAgICAgICB0ZXh0LmluY2x1ZGVzKCfYqtmG2LLZitmEINi52YTZiSDYo9mKINit2KfZhCcpXG4gICAgICApIHtcbiAgICAgICAgZWwuY2xpY2soKTtcbiAgICAgICAgY2xpY2tlZCA9IHRydWU7XG4gICAgICAgIGJyZWFrO1xuICAgICAgfVxuICAgIH1cbiAgfVxuXG4gIGlmIChjbGlja2VkKSB7XG4gICAgY29uc29sZS5sb2coXG4gICAgICAnW0NRRF0gXCJEb3dubG9hZCBhbnl3YXlcIiAvIHZpcnVzLWJ5cGFzcyBhY3Rpb24gdHJpZ2dlcmVkIHN1Y2Nlc3NmdWxseS4nLFxuICAgICk7XG4gIH1cblxuICByZXR1cm4gY2xpY2tlZDtcbn1cblxuLyoqXG4gKiBLZWVwIHRlbGxpbmcgYmFja2dyb3VuZCBcImJ5cGFzcyB0cmlnZ2VyZWRcIiBzbyBpdDpcbiAqICAtIGZsaXBzIHRoZSBDbGFzc3Jvb20gYnV0dG9uIHRvIFNVQ0NFU1MgcXVpY2tseVxuICogIC0gYXV0by1jbG9zZXMgdGhlIGhpZGRlbiBEcml2ZSB0YWIgYWZ0ZXIgYSBmZXcgc2Vjb25kc1xuICovXG5mdW5jdGlvbiBub3RpZnlTdWNjZXNzRmxvb2QoKSB7XG4gIGNvbnN0IHNlbmQgPSAoKSA9PiB7XG4gICAgdHJ5IHtcbiAgICAgIGNocm9tZS5ydW50aW1lLnNlbmRNZXNzYWdlKHsgdHlwZTogJ0NRRF9CWVBBU1NfU1VDQ0VTUycgfSk7XG4gICAgfSBjYXRjaCB7XG4gICAgICAvKiBpZ25vcmUgKi9cbiAgICB9XG4gIH07XG5cbiAgLy8gRmlyZSBvbmNlIGltbWVkaWF0ZWx5XG4gIHNlbmQoKTtcblxuICAvLyBUaGVuIHNwYW0gYSBiaXQgZm9yIHJvYnVzdG5lc3MgKGJhY2tncm91bmQgbWlnaHQgbWFwIHRhYklkIGEgYml0IGxhdGVyKVxuICBsZXQgY291bnQgPSAwO1xuICBjb25zdCBtYXhCdXJzdHMgPSA4OyAvLyB+OCBzZWNvbmRzIHRvdGFsXG4gIGNvbnN0IGlkID0gd2luZG93LnNldEludGVydmFsKCgpID0+IHtcbiAgICBjb3VudCArPSAxO1xuICAgIGlmIChjb3VudCA+IG1heEJ1cnN0cykge1xuICAgICAgd2luZG93LmNsZWFySW50ZXJ2YWwoaWQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgICBzZW5kKCk7XG4gIH0sIDEwMDApO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogUHJldmlldyB0b29sYmFyIGRvd25sb2FkIGNsaWNrIGZvciBub3JtYWwvc21hbGwgZmlsZXNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGNsaWNrRHJpdmVUb29sYmFyRG93bmxvYWQoKTogYm9vbGVhbiB7XG4gIGNvbnN0IGJ0biA9XG4gICAgZG9jdW1lbnQucXVlcnlTZWxlY3RvcjxIVE1MRWxlbWVudD4oJ2RpdlthcmlhLWxhYmVsPVwiRG93bmxvYWRcIl0nKSB8fFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KCdkaXZbZGF0YS10b29sdGlwPVwiRG93bmxvYWRcIl0nKSB8fFxuICAgIGRvY3VtZW50LnF1ZXJ5U2VsZWN0b3I8SFRNTEVsZW1lbnQ+KFxuICAgICAgJ2Rpdltyb2xlPVwiYnV0dG9uXCJdW2FyaWEtbGFiZWw9XCJEb3dubG9hZFwiXScsXG4gICAgKTtcblxuICBpZiAoIWJ0bikgcmV0dXJuIGZhbHNlO1xuXG4gIHNpbXVsYXRlSHVtYW5DbGljayhidG4pO1xuICByZXR1cm4gdHJ1ZTtcbn1cblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIFV0aWxpdHlcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIHNpbXVsYXRlSHVtYW5DbGljayhlbGVtZW50OiBIVE1MRWxlbWVudCkge1xuICBjb25zdCBvcHRzOiBNb3VzZUV2ZW50SW5pdCA9IHtcbiAgICBidWJibGVzOiB0cnVlLFxuICAgIGNhbmNlbGFibGU6IHRydWUsXG4gICAgdmlldzogd2luZG93LFxuICB9O1xuICBlbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoJ21vdXNlZG93bicsIG9wdHMpKTtcbiAgZWxlbWVudC5kaXNwYXRjaEV2ZW50KG5ldyBNb3VzZUV2ZW50KCdtb3VzZXVwJywgb3B0cykpO1xuICBlbGVtZW50LmRpc3BhdGNoRXZlbnQobmV3IE1vdXNlRXZlbnQoJ2NsaWNrJywgb3B0cykpO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiZnVuY3Rpb24gcHJpbnQobWV0aG9kLCAuLi5hcmdzKSB7XG4gIGlmIChpbXBvcnQubWV0YS5lbnYuTU9ERSA9PT0gXCJwcm9kdWN0aW9uXCIpIHJldHVybjtcbiAgaWYgKHR5cGVvZiBhcmdzWzBdID09PSBcInN0cmluZ1wiKSB7XG4gICAgY29uc3QgbWVzc2FnZSA9IGFyZ3Muc2hpZnQoKTtcbiAgICBtZXRob2QoYFt3eHRdICR7bWVzc2FnZX1gLCAuLi5hcmdzKTtcbiAgfSBlbHNlIHtcbiAgICBtZXRob2QoXCJbd3h0XVwiLCAuLi5hcmdzKTtcbiAgfVxufVxuZXhwb3J0IGNvbnN0IGxvZ2dlciA9IHtcbiAgZGVidWc6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmRlYnVnLCAuLi5hcmdzKSxcbiAgbG9nOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS5sb2csIC4uLmFyZ3MpLFxuICB3YXJuOiAoLi4uYXJncykgPT4gcHJpbnQoY29uc29sZS53YXJuLCAuLi5hcmdzKSxcbiAgZXJyb3I6ICguLi5hcmdzKSA9PiBwcmludChjb25zb2xlLmVycm9yLCAuLi5hcmdzKVxufTtcbiIsImltcG9ydCB7IGJyb3dzZXIgfSBmcm9tIFwid3h0L2Jyb3dzZXJcIjtcbmV4cG9ydCBjbGFzcyBXeHRMb2NhdGlvbkNoYW5nZUV2ZW50IGV4dGVuZHMgRXZlbnQge1xuICBjb25zdHJ1Y3RvcihuZXdVcmwsIG9sZFVybCkge1xuICAgIHN1cGVyKFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQuRVZFTlRfTkFNRSwge30pO1xuICAgIHRoaXMubmV3VXJsID0gbmV3VXJsO1xuICAgIHRoaXMub2xkVXJsID0gb2xkVXJsO1xuICB9XG4gIHN0YXRpYyBFVkVOVF9OQU1FID0gZ2V0VW5pcXVlRXZlbnROYW1lKFwid3h0OmxvY2F0aW9uY2hhbmdlXCIpO1xufVxuZXhwb3J0IGZ1bmN0aW9uIGdldFVuaXF1ZUV2ZW50TmFtZShldmVudE5hbWUpIHtcbiAgcmV0dXJuIGAke2Jyb3dzZXI/LnJ1bnRpbWU/LmlkfToke2ltcG9ydC5tZXRhLmVudi5FTlRSWVBPSU5UfToke2V2ZW50TmFtZX1gO1xufVxuIiwiaW1wb3J0IHsgV3h0TG9jYXRpb25DaGFuZ2VFdmVudCB9IGZyb20gXCIuL2N1c3RvbS1ldmVudHMubWpzXCI7XG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTG9jYXRpb25XYXRjaGVyKGN0eCkge1xuICBsZXQgaW50ZXJ2YWw7XG4gIGxldCBvbGRVcmw7XG4gIHJldHVybiB7XG4gICAgLyoqXG4gICAgICogRW5zdXJlIHRoZSBsb2NhdGlvbiB3YXRjaGVyIGlzIGFjdGl2ZWx5IGxvb2tpbmcgZm9yIFVSTCBjaGFuZ2VzLiBJZiBpdCdzIGFscmVhZHkgd2F0Y2hpbmcsXG4gICAgICogdGhpcyBpcyBhIG5vb3AuXG4gICAgICovXG4gICAgcnVuKCkge1xuICAgICAgaWYgKGludGVydmFsICE9IG51bGwpIHJldHVybjtcbiAgICAgIG9sZFVybCA9IG5ldyBVUkwobG9jYXRpb24uaHJlZik7XG4gICAgICBpbnRlcnZhbCA9IGN0eC5zZXRJbnRlcnZhbCgoKSA9PiB7XG4gICAgICAgIGxldCBuZXdVcmwgPSBuZXcgVVJMKGxvY2F0aW9uLmhyZWYpO1xuICAgICAgICBpZiAobmV3VXJsLmhyZWYgIT09IG9sZFVybC5ocmVmKSB7XG4gICAgICAgICAgd2luZG93LmRpc3BhdGNoRXZlbnQobmV3IFd4dExvY2F0aW9uQ2hhbmdlRXZlbnQobmV3VXJsLCBvbGRVcmwpKTtcbiAgICAgICAgICBvbGRVcmwgPSBuZXdVcmw7XG4gICAgICAgIH1cbiAgICAgIH0sIDFlMyk7XG4gICAgfVxuICB9O1xufVxuIiwiaW1wb3J0IHsgYnJvd3NlciB9IGZyb20gXCJ3eHQvYnJvd3NlclwiO1xuaW1wb3J0IHsgbG9nZ2VyIH0gZnJvbSBcIi4uL3V0aWxzL2ludGVybmFsL2xvZ2dlci5tanNcIjtcbmltcG9ydCB7XG4gIGdldFVuaXF1ZUV2ZW50TmFtZVxufSBmcm9tIFwiLi9pbnRlcm5hbC9jdXN0b20tZXZlbnRzLm1qc1wiO1xuaW1wb3J0IHsgY3JlYXRlTG9jYXRpb25XYXRjaGVyIH0gZnJvbSBcIi4vaW50ZXJuYWwvbG9jYXRpb24td2F0Y2hlci5tanNcIjtcbmV4cG9ydCBjbGFzcyBDb250ZW50U2NyaXB0Q29udGV4dCB7XG4gIGNvbnN0cnVjdG9yKGNvbnRlbnRTY3JpcHROYW1lLCBvcHRpb25zKSB7XG4gICAgdGhpcy5jb250ZW50U2NyaXB0TmFtZSA9IGNvbnRlbnRTY3JpcHROYW1lO1xuICAgIHRoaXMub3B0aW9ucyA9IG9wdGlvbnM7XG4gICAgdGhpcy5hYm9ydENvbnRyb2xsZXIgPSBuZXcgQWJvcnRDb250cm9sbGVyKCk7XG4gICAgaWYgKHRoaXMuaXNUb3BGcmFtZSkge1xuICAgICAgdGhpcy5saXN0ZW5Gb3JOZXdlclNjcmlwdHMoeyBpZ25vcmVGaXJzdEV2ZW50OiB0cnVlIH0pO1xuICAgICAgdGhpcy5zdG9wT2xkU2NyaXB0cygpO1xuICAgIH0gZWxzZSB7XG4gICAgICB0aGlzLmxpc3RlbkZvck5ld2VyU2NyaXB0cygpO1xuICAgIH1cbiAgfVxuICBzdGF0aWMgU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFID0gZ2V0VW5pcXVlRXZlbnROYW1lKFxuICAgIFwid3h0OmNvbnRlbnQtc2NyaXB0LXN0YXJ0ZWRcIlxuICApO1xuICBpc1RvcEZyYW1lID0gd2luZG93LnNlbGYgPT09IHdpbmRvdy50b3A7XG4gIGFib3J0Q29udHJvbGxlcjtcbiAgbG9jYXRpb25XYXRjaGVyID0gY3JlYXRlTG9jYXRpb25XYXRjaGVyKHRoaXMpO1xuICByZWNlaXZlZE1lc3NhZ2VJZHMgPSAvKiBAX19QVVJFX18gKi8gbmV3IFNldCgpO1xuICBnZXQgc2lnbmFsKCkge1xuICAgIHJldHVybiB0aGlzLmFib3J0Q29udHJvbGxlci5zaWduYWw7XG4gIH1cbiAgYWJvcnQocmVhc29uKSB7XG4gICAgcmV0dXJuIHRoaXMuYWJvcnRDb250cm9sbGVyLmFib3J0KHJlYXNvbik7XG4gIH1cbiAgZ2V0IGlzSW52YWxpZCgpIHtcbiAgICBpZiAoYnJvd3Nlci5ydW50aW1lLmlkID09IG51bGwpIHtcbiAgICAgIHRoaXMubm90aWZ5SW52YWxpZGF0ZWQoKTtcbiAgICB9XG4gICAgcmV0dXJuIHRoaXMuc2lnbmFsLmFib3J0ZWQ7XG4gIH1cbiAgZ2V0IGlzVmFsaWQoKSB7XG4gICAgcmV0dXJuICF0aGlzLmlzSW52YWxpZDtcbiAgfVxuICAvKipcbiAgICogQWRkIGEgbGlzdGVuZXIgdGhhdCBpcyBjYWxsZWQgd2hlbiB0aGUgY29udGVudCBzY3JpcHQncyBjb250ZXh0IGlzIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBAcmV0dXJucyBBIGZ1bmN0aW9uIHRvIHJlbW92ZSB0aGUgbGlzdGVuZXIuXG4gICAqXG4gICAqIEBleGFtcGxlXG4gICAqIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UuYWRkTGlzdGVuZXIoY2IpO1xuICAgKiBjb25zdCByZW1vdmVJbnZhbGlkYXRlZExpc3RlbmVyID0gY3R4Lm9uSW52YWxpZGF0ZWQoKCkgPT4ge1xuICAgKiAgIGJyb3dzZXIucnVudGltZS5vbk1lc3NhZ2UucmVtb3ZlTGlzdGVuZXIoY2IpO1xuICAgKiB9KVxuICAgKiAvLyAuLi5cbiAgICogcmVtb3ZlSW52YWxpZGF0ZWRMaXN0ZW5lcigpO1xuICAgKi9cbiAgb25JbnZhbGlkYXRlZChjYikge1xuICAgIHRoaXMuc2lnbmFsLmFkZEV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gICAgcmV0dXJuICgpID0+IHRoaXMuc2lnbmFsLnJlbW92ZUV2ZW50TGlzdGVuZXIoXCJhYm9ydFwiLCBjYik7XG4gIH1cbiAgLyoqXG4gICAqIFJldHVybiBhIHByb21pc2UgdGhhdCBuZXZlciByZXNvbHZlcy4gVXNlZnVsIGlmIHlvdSBoYXZlIGFuIGFzeW5jIGZ1bmN0aW9uIHRoYXQgc2hvdWxkbid0IHJ1blxuICAgKiBhZnRlciB0aGUgY29udGV4dCBpcyBleHBpcmVkLlxuICAgKlxuICAgKiBAZXhhbXBsZVxuICAgKiBjb25zdCBnZXRWYWx1ZUZyb21TdG9yYWdlID0gYXN5bmMgKCkgPT4ge1xuICAgKiAgIGlmIChjdHguaXNJbnZhbGlkKSByZXR1cm4gY3R4LmJsb2NrKCk7XG4gICAqXG4gICAqICAgLy8gLi4uXG4gICAqIH1cbiAgICovXG4gIGJsb2NrKCkge1xuICAgIHJldHVybiBuZXcgUHJvbWlzZSgoKSA9PiB7XG4gICAgfSk7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cuc2V0SW50ZXJ2YWxgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIEludGVydmFscyBjYW4gYmUgY2xlYXJlZCBieSBjYWxsaW5nIHRoZSBub3JtYWwgYGNsZWFySW50ZXJ2YWxgIGZ1bmN0aW9uLlxuICAgKi9cbiAgc2V0SW50ZXJ2YWwoaGFuZGxlciwgdGltZW91dCkge1xuICAgIGNvbnN0IGlkID0gc2V0SW50ZXJ2YWwoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhckludGVydmFsKGlkKSk7XG4gICAgcmV0dXJuIGlkO1xuICB9XG4gIC8qKlxuICAgKiBXcmFwcGVyIGFyb3VuZCBgd2luZG93LnNldFRpbWVvdXRgIHRoYXQgYXV0b21hdGljYWxseSBjbGVhcnMgdGhlIGludGVydmFsIHdoZW4gaW52YWxpZGF0ZWQuXG4gICAqXG4gICAqIFRpbWVvdXRzIGNhbiBiZSBjbGVhcmVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgc2V0VGltZW91dGAgZnVuY3Rpb24uXG4gICAqL1xuICBzZXRUaW1lb3V0KGhhbmRsZXIsIHRpbWVvdXQpIHtcbiAgICBjb25zdCBpZCA9IHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgaWYgKHRoaXMuaXNWYWxpZCkgaGFuZGxlcigpO1xuICAgIH0sIHRpbWVvdXQpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjbGVhclRpbWVvdXQoaWQpKTtcbiAgICByZXR1cm4gaWQ7XG4gIH1cbiAgLyoqXG4gICAqIFdyYXBwZXIgYXJvdW5kIGB3aW5kb3cucmVxdWVzdEFuaW1hdGlvbkZyYW1lYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsQW5pbWF0aW9uRnJhbWVgIGZ1bmN0aW9uLlxuICAgKi9cbiAgcmVxdWVzdEFuaW1hdGlvbkZyYW1lKGNhbGxiYWNrKSB7XG4gICAgY29uc3QgaWQgPSByZXF1ZXN0QW5pbWF0aW9uRnJhbWUoKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICh0aGlzLmlzVmFsaWQpIGNhbGxiYWNrKC4uLmFyZ3MpO1xuICAgIH0pO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiBjYW5jZWxBbmltYXRpb25GcmFtZShpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICAvKipcbiAgICogV3JhcHBlciBhcm91bmQgYHdpbmRvdy5yZXF1ZXN0SWRsZUNhbGxiYWNrYCB0aGF0IGF1dG9tYXRpY2FsbHkgY2FuY2VscyB0aGUgcmVxdWVzdCB3aGVuXG4gICAqIGludmFsaWRhdGVkLlxuICAgKlxuICAgKiBDYWxsYmFja3MgY2FuIGJlIGNhbmNlbGVkIGJ5IGNhbGxpbmcgdGhlIG5vcm1hbCBgY2FuY2VsSWRsZUNhbGxiYWNrYCBmdW5jdGlvbi5cbiAgICovXG4gIHJlcXVlc3RJZGxlQ2FsbGJhY2soY2FsbGJhY2ssIG9wdGlvbnMpIHtcbiAgICBjb25zdCBpZCA9IHJlcXVlc3RJZGxlQ2FsbGJhY2soKC4uLmFyZ3MpID0+IHtcbiAgICAgIGlmICghdGhpcy5zaWduYWwuYWJvcnRlZCkgY2FsbGJhY2soLi4uYXJncyk7XG4gICAgfSwgb3B0aW9ucyk7XG4gICAgdGhpcy5vbkludmFsaWRhdGVkKCgpID0+IGNhbmNlbElkbGVDYWxsYmFjayhpZCkpO1xuICAgIHJldHVybiBpZDtcbiAgfVxuICBhZGRFdmVudExpc3RlbmVyKHRhcmdldCwgdHlwZSwgaGFuZGxlciwgb3B0aW9ucykge1xuICAgIGlmICh0eXBlID09PSBcInd4dDpsb2NhdGlvbmNoYW5nZVwiKSB7XG4gICAgICBpZiAodGhpcy5pc1ZhbGlkKSB0aGlzLmxvY2F0aW9uV2F0Y2hlci5ydW4oKTtcbiAgICB9XG4gICAgdGFyZ2V0LmFkZEV2ZW50TGlzdGVuZXI/LihcbiAgICAgIHR5cGUuc3RhcnRzV2l0aChcInd4dDpcIikgPyBnZXRVbmlxdWVFdmVudE5hbWUodHlwZSkgOiB0eXBlLFxuICAgICAgaGFuZGxlcixcbiAgICAgIHtcbiAgICAgICAgLi4ub3B0aW9ucyxcbiAgICAgICAgc2lnbmFsOiB0aGlzLnNpZ25hbFxuICAgICAgfVxuICAgICk7XG4gIH1cbiAgLyoqXG4gICAqIEBpbnRlcm5hbFxuICAgKiBBYm9ydCB0aGUgYWJvcnQgY29udHJvbGxlciBhbmQgZXhlY3V0ZSBhbGwgYG9uSW52YWxpZGF0ZWRgIGxpc3RlbmVycy5cbiAgICovXG4gIG5vdGlmeUludmFsaWRhdGVkKCkge1xuICAgIHRoaXMuYWJvcnQoXCJDb250ZW50IHNjcmlwdCBjb250ZXh0IGludmFsaWRhdGVkXCIpO1xuICAgIGxvZ2dlci5kZWJ1ZyhcbiAgICAgIGBDb250ZW50IHNjcmlwdCBcIiR7dGhpcy5jb250ZW50U2NyaXB0TmFtZX1cIiBjb250ZXh0IGludmFsaWRhdGVkYFxuICAgICk7XG4gIH1cbiAgc3RvcE9sZFNjcmlwdHMoKSB7XG4gICAgd2luZG93LnBvc3RNZXNzYWdlKFxuICAgICAge1xuICAgICAgICB0eXBlOiBDb250ZW50U2NyaXB0Q29udGV4dC5TQ1JJUFRfU1RBUlRFRF9NRVNTQUdFX1RZUEUsXG4gICAgICAgIGNvbnRlbnRTY3JpcHROYW1lOiB0aGlzLmNvbnRlbnRTY3JpcHROYW1lLFxuICAgICAgICBtZXNzYWdlSWQ6IE1hdGgucmFuZG9tKCkudG9TdHJpbmcoMzYpLnNsaWNlKDIpXG4gICAgICB9LFxuICAgICAgXCIqXCJcbiAgICApO1xuICB9XG4gIHZlcmlmeVNjcmlwdFN0YXJ0ZWRFdmVudChldmVudCkge1xuICAgIGNvbnN0IGlzU2NyaXB0U3RhcnRlZEV2ZW50ID0gZXZlbnQuZGF0YT8udHlwZSA9PT0gQ29udGVudFNjcmlwdENvbnRleHQuU0NSSVBUX1NUQVJURURfTUVTU0FHRV9UWVBFO1xuICAgIGNvbnN0IGlzU2FtZUNvbnRlbnRTY3JpcHQgPSBldmVudC5kYXRhPy5jb250ZW50U2NyaXB0TmFtZSA9PT0gdGhpcy5jb250ZW50U2NyaXB0TmFtZTtcbiAgICBjb25zdCBpc05vdER1cGxpY2F0ZSA9ICF0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5oYXMoZXZlbnQuZGF0YT8ubWVzc2FnZUlkKTtcbiAgICByZXR1cm4gaXNTY3JpcHRTdGFydGVkRXZlbnQgJiYgaXNTYW1lQ29udGVudFNjcmlwdCAmJiBpc05vdER1cGxpY2F0ZTtcbiAgfVxuICBsaXN0ZW5Gb3JOZXdlclNjcmlwdHMob3B0aW9ucykge1xuICAgIGxldCBpc0ZpcnN0ID0gdHJ1ZTtcbiAgICBjb25zdCBjYiA9IChldmVudCkgPT4ge1xuICAgICAgaWYgKHRoaXMudmVyaWZ5U2NyaXB0U3RhcnRlZEV2ZW50KGV2ZW50KSkge1xuICAgICAgICB0aGlzLnJlY2VpdmVkTWVzc2FnZUlkcy5hZGQoZXZlbnQuZGF0YS5tZXNzYWdlSWQpO1xuICAgICAgICBjb25zdCB3YXNGaXJzdCA9IGlzRmlyc3Q7XG4gICAgICAgIGlzRmlyc3QgPSBmYWxzZTtcbiAgICAgICAgaWYgKHdhc0ZpcnN0ICYmIG9wdGlvbnM/Lmlnbm9yZUZpcnN0RXZlbnQpIHJldHVybjtcbiAgICAgICAgdGhpcy5ub3RpZnlJbnZhbGlkYXRlZCgpO1xuICAgICAgfVxuICAgIH07XG4gICAgYWRkRXZlbnRMaXN0ZW5lcihcIm1lc3NhZ2VcIiwgY2IpO1xuICAgIHRoaXMub25JbnZhbGlkYXRlZCgoKSA9PiByZW1vdmVFdmVudExpc3RlbmVyKFwibWVzc2FnZVwiLCBjYikpO1xuICB9XG59XG4iXSwibmFtZXMiOlsiZGVmaW5pdGlvbiIsImJyb3dzZXIiLCJfYnJvd3NlciIsInByaW50IiwibG9nZ2VyIl0sIm1hcHBpbmdzIjoiOztBQUFPLFdBQVMsb0JBQW9CQSxhQUFZO0FBQzlDLFdBQU9BO0FBQUEsRUFDVDtBQ01BLFFBQUEsYUFBQSxvQkFBQTtBQUFBLElBQW1DLFNBQUE7QUFBQSxNQUN4QjtBQUFBLE1BQ1A7QUFBQSxJQUNBO0FBQUE7QUFBQSxJQUNGLE9BQUE7QUFBQSxJQUVPLE9BQUE7QUFFTCxVQUFBLGVBQUE7QUFDQSxVQUFBLGlCQUFBO0FBQ0EsVUFBQSxrQkFBQTtBQUVBLFlBQUEsT0FBQSxNQUFBO0FBQ0UsY0FBQSxNQUFBLE9BQUEsU0FBQTtBQUNBLGNBQUEsT0FBQSxTQUFBO0FBQ0EsY0FBQSxZQUFBLE1BQUEsYUFBQSxJQUFBLFlBQUE7QUFLQSxZQUFBLENBQUEsZ0JBQUEsbUJBQUEsUUFBQSxHQUFBO0FBQ0Usa0JBQUE7QUFB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
drivebypass;