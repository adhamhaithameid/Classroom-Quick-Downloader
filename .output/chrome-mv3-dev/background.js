var background = (function() {
  "use strict";
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const pendingByRequestId = /* @__PURE__ */ new Map();
  const pendingByDownloadId = /* @__PURE__ */ new Map();
  const pendingByUrl = /* @__PURE__ */ new Map();
  const definition = defineBackground(() => {
    console.log("[CQD] Background ready - Immediate Success Mode");
    chrome.runtime.onMessage.addListener((message, sender) => {
      if (message?.type === "CQD_BYPASS_SUCCESS" && sender.tab?.id != null) {
        const tabId = sender.tab.id;
        setTimeout(() => {
          chrome.tabs.remove(tabId, () => {
            void chrome.runtime.lastError;
          });
        }, 5e3);
      }
    });
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
      let pending = pendingByDownloadId.get(item.id);
      if (!pending) {
        pending = pendingByUrl.get(item.url) ?? pendingByUrl.get(item.finalUrl || item.url);
      }
      if (!pending) {
        suggest();
        return;
      }
      const actualMime = (item.mime || "").toLowerCase();
      const actualExt = getFilenameExt(item.filename);
      const expectedKind = pending.fileMeta?.kind;
      const expectedExt = pending.fileMeta?.ext?.toLowerCase();
      const looksLikeHtml = actualMime.includes("html") || actualExt === "html" || actualExt === "htm";
      const userWantedHtml = expectedKind === "html" || expectedExt === "html" || expectedExt === "htm";
      if (looksLikeHtml && !userWantedHtml) {
        console.log("[CQD] HTML (virus / interstitial) detected. Opening background tab.");
        chrome.downloads.cancel(item.id, () => {
          chrome.tabs.create(
            {
              url: item.finalUrl || item.url,
              active: false
              // <- user stays on Classroom
            },
            () => {
              cleanup(pending, item.id);
            }
          );
        });
        return;
      }
      if (pending.fileMeta?.name) {
        suggest({ filename: pending.fileMeta.name, conflictAction: "uniquify" });
      } else {
        suggest({ conflictAction: "uniquify" });
      }
    });
    chrome.downloads.onChanged.addListener((delta) => {
      const pending = pendingByDownloadId.get(delta.id);
      if (!pending) return;
      if (delta.state && delta.state.current === "complete" || delta.state && delta.state.current === "interrupted") {
        cleanup(pending, delta.id);
      }
    });
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.type !== "CQD_DOWNLOAD") return;
      const requestId = typeof message.requestId === "string" ? message.requestId : `req-${Date.now()}`;
      const rawUrl = typeof message.url === "string" ? message.url : null;
      const fileMeta = message.fileMeta;
      if (!rawUrl) {
        sendStatusToTab(
          {
            requestId,
            url: "",
            fileMeta,
            tabId: sender.tab?.id
          },
          "interrupted",
          "No valid link found.",
          "NO_URL"
        );
        sendResponse?.({
          started: false,
          requestId,
          userMessage: "No valid link found."
        });
        return;
      }
      const pending = {
        requestId,
        url: rawUrl,
        fileMeta,
        tabId: sender.tab?.id
      };
      pendingByRequestId.set(requestId, pending);
      pendingByUrl.set(rawUrl, pending);
      chrome.downloads.download(
        {
          url: rawUrl,
          saveAs: false,
          conflictAction: "uniquify"
        },
        (downloadId) => {
          const err = chrome.runtime.lastError;
          if (err || !downloadId) {
            console.warn("[CQD] downloads.download failed:", err?.message);
            sendStatusToTab(
              pending,
              "interrupted",
              "Browser could not start the download.",
              "START_FAILED"
            );
            cleanup(pending);
            sendResponse?.({
              started: false,
              requestId,
              userMessage: "Browser blocked download start."
            });
            return;
          }
          console.log("[CQD] Download started:", downloadId);
          pendingByDownloadId.set(downloadId, pending);
          sendStatusToTab(pending, "complete");
          sendResponse?.({
            started: true,
            requestId,
            downloadId
          });
        }
      );
      return true;
    });
  });
  function cleanup(pending, downloadId) {
    pendingByRequestId.delete(pending.requestId);
    pendingByUrl.delete(pending.url);
    if (downloadId != null) {
      pendingByDownloadId.delete(downloadId);
    }
  }
  function getFilenameExt(filename) {
    if (!filename) return void 0;
    const m = filename.match(/\.([a-zA-Z0-9]{1,6})$/);
    return m ? m[1].toLowerCase() : void 0;
  }
  function sendStatusToTab(pending, status, userMessage, errorCode) {
    if (pending.tabId == null) return;
    try {
      chrome.tabs.sendMessage(pending.tabId, {
        type: "CQD_DOWNLOAD_STATUS",
        requestId: pending.requestId,
        status,
        errorCode,
        userMessage
      });
    } catch {
    }
  }
  function initPlugins() {
  }
  const browser$1 = globalThis.browser?.runtime?.id ? globalThis.browser : globalThis.chrome;
  const browser = browser$1;
  var _MatchPattern = class {
    constructor(matchPattern) {
      if (matchPattern === "<all_urls>") {
        this.isAllUrls = true;
        this.protocolMatches = [..._MatchPattern.PROTOCOLS];
        this.hostnameMatch = "*";
        this.pathnameMatch = "*";
      } else {
        const groups = /(.*):\/\/(.*?)(\/.*)/.exec(matchPattern);
        if (groups == null)
          throw new InvalidMatchPattern(matchPattern, "Incorrect format");
        const [_, protocol, hostname, pathname] = groups;
        validateProtocol(matchPattern, protocol);
        validateHostname(matchPattern, hostname);
        this.protocolMatches = protocol === "*" ? ["http", "https"] : [protocol];
        this.hostnameMatch = hostname;
        this.pathnameMatch = pathname;
      }
    }
    includes(url) {
      if (this.isAllUrls)
        return true;
      const u = typeof url === "string" ? new URL(url) : url instanceof Location ? new URL(url.href) : url;
      return !!this.protocolMatches.find((protocol) => {
        if (protocol === "http")
          return this.isHttpMatch(u);
        if (protocol === "https")
          return this.isHttpsMatch(u);
        if (protocol === "file")
          return this.isFileMatch(u);
        if (protocol === "ftp")
          return this.isFtpMatch(u);
        if (protocol === "urn")
          return this.isUrnMatch(u);
      });
    }
    isHttpMatch(url) {
      return url.protocol === "http:" && this.isHostPathMatch(url);
    }
    isHttpsMatch(url) {
      return url.protocol === "https:" && this.isHostPathMatch(url);
    }
    isHostPathMatch(url) {
      if (!this.hostnameMatch || !this.pathnameMatch)
        return false;
      const hostnameMatchRegexs = [
        this.convertPatternToRegex(this.hostnameMatch),
        this.convertPatternToRegex(this.hostnameMatch.replace(/^\*\./, ""))
      ];
      const pathnameMatchRegex = this.convertPatternToRegex(this.pathnameMatch);
      return !!hostnameMatchRegexs.find((regex) => regex.test(url.hostname)) && pathnameMatchRegex.test(url.pathname);
    }
    isFileMatch(url) {
      throw Error("Not implemented: file:// pattern matching. Open a PR to add support");
    }
    isFtpMatch(url) {
      throw Error("Not implemented: ftp:// pattern matching. Open a PR to add support");
    }
    isUrnMatch(url) {
      throw Error("Not implemented: urn:// pattern matching. Open a PR to add support");
    }
    convertPatternToRegex(pattern) {
      const escaped = this.escapeForRegex(pattern);
      const starsReplaced = escaped.replace(/\\\*/g, ".*");
      return RegExp(`^${starsReplaced}$`);
    }
    escapeForRegex(string) {
      return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
  };
  var MatchPattern = _MatchPattern;
  MatchPattern.PROTOCOLS = ["http", "https", "file", "ftp", "urn"];
  var InvalidMatchPattern = class extends Error {
    constructor(matchPattern, reason) {
      super(`Invalid match pattern "${matchPattern}": ${reason}`);
    }
  };
  function validateProtocol(matchPattern, protocol) {
    if (!MatchPattern.PROTOCOLS.includes(protocol) && protocol !== "*")
      throw new InvalidMatchPattern(
        matchPattern,
        `${protocol} not a valid protocol (${MatchPattern.PROTOCOLS.join(", ")})`
      );
  }
  function validateHostname(matchPattern, hostname) {
    if (hostname.includes(":"))
      throw new InvalidMatchPattern(matchPattern, `Hostname cannot include a port`);
    if (hostname.includes("*") && hostname.length > 1 && !hostname.startsWith("*."))
      throw new InvalidMatchPattern(
        matchPattern,
        `If using a wildcard (*), it must go at the start of the hostname`
      );
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
  let ws;
  function getDevServerWebSocket() {
    if (ws == null) {
      const serverUrl = "ws://localhost:3000";
      logger.debug("Connecting to dev server @", serverUrl);
      ws = new WebSocket(serverUrl, "vite-hmr");
      ws.addWxtEventListener = ws.addEventListener.bind(ws);
      ws.sendCustom = (event, payload) => ws?.send(JSON.stringify({ type: "custom", event, payload }));
      ws.addEventListener("open", () => {
        logger.debug("Connected to dev server");
      });
      ws.addEventListener("close", () => {
        logger.debug("Disconnected from dev server");
      });
      ws.addEventListener("error", (event) => {
        logger.error("Failed to connect to dev server", event);
      });
      ws.addEventListener("message", (e) => {
        try {
          const message = JSON.parse(e.data);
          if (message.type === "custom") {
            ws?.dispatchEvent(
              new CustomEvent(message.event, { detail: message.data })
            );
          }
        } catch (err) {
          logger.error("Failed to handle message", err);
        }
      });
    }
    return ws;
  }
  function keepServiceWorkerAlive() {
    setInterval(async () => {
      await browser.runtime.getPlatformInfo();
    }, 5e3);
  }
  function reloadContentScript(payload) {
    const manifest = browser.runtime.getManifest();
    if (manifest.manifest_version == 2) {
      void reloadContentScriptMv2();
    } else {
      void reloadContentScriptMv3(payload);
    }
  }
  async function reloadContentScriptMv3({
    registration,
    contentScript
  }) {
    if (registration === "runtime") {
      await reloadRuntimeContentScriptMv3(contentScript);
    } else {
      await reloadManifestContentScriptMv3(contentScript);
    }
  }
  async function reloadManifestContentScriptMv3(contentScript) {
    const id = `wxt:${contentScript.js[0]}`;
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const existing = registered.find((cs) => cs.id === id);
    if (existing) {
      logger.debug("Updating content script", existing);
      await browser.scripting.updateContentScripts([
        {
          ...contentScript,
          id,
          css: contentScript.css ?? []
        }
      ]);
    } else {
      logger.debug("Registering new content script...");
      await browser.scripting.registerContentScripts([
        {
          ...contentScript,
          id,
          css: contentScript.css ?? []
        }
      ]);
    }
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadRuntimeContentScriptMv3(contentScript) {
    logger.log("Reloading content script:", contentScript);
    const registered = await browser.scripting.getRegisteredContentScripts();
    logger.debug("Existing scripts:", registered);
    const matches = registered.filter((cs) => {
      const hasJs = contentScript.js?.find((js) => cs.js?.includes(js));
      const hasCss = contentScript.css?.find((css) => cs.css?.includes(css));
      return hasJs || hasCss;
    });
    if (matches.length === 0) {
      logger.log(
        "Content script is not registered yet, nothing to reload",
        contentScript
      );
      return;
    }
    await browser.scripting.updateContentScripts(matches);
    await reloadTabsForContentScript(contentScript);
  }
  async function reloadTabsForContentScript(contentScript) {
    const allTabs = await browser.tabs.query({});
    const matchPatterns = contentScript.matches.map(
      (match) => new MatchPattern(match)
    );
    const matchingTabs = allTabs.filter((tab) => {
      const url = tab.url;
      if (!url) return false;
      return !!matchPatterns.find((pattern) => pattern.includes(url));
    });
    await Promise.all(
      matchingTabs.map(async (tab) => {
        try {
          await browser.tabs.reload(tab.id);
        } catch (err) {
          logger.warn("Failed to reload tab:", err);
        }
      })
    );
  }
  async function reloadContentScriptMv2(_payload) {
    throw Error("TODO: reloadContentScriptMv2");
  }
  {
    try {
      const ws2 = getDevServerWebSocket();
      ws2.addWxtEventListener("wxt:reload-extension", () => {
        browser.runtime.reload();
      });
      ws2.addWxtEventListener("wxt:reload-content-script", (event) => {
        reloadContentScript(event.detail);
      });
      if (true) {
        ws2.addEventListener(
          "open",
          () => ws2.sendCustom("wxt:background-initialized")
        );
        keepServiceWorkerAlive();
      }
    } catch (err) {
      logger.error("Failed to setup web socket connection with dev server", err);
    }
    browser.commands.onCommand.addListener((command) => {
      if (command === "wxt:reload-extension") {
        browser.runtime.reload();
      }
    });
  }
  let result;
  try {
    initPlugins();
    result = definition.main();
    if (result instanceof Promise) {
      console.warn(
        "The background's main() function return a promise, but it must be synchronous"
      );
    }
  } catch (err) {
    logger.error("The background crashed on startup!");
    throw err;
  }
  const result$1 = result;
  return result$1;
})();
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL2VudHJ5cG9pbnRzL2JhY2tncm91bmQudHMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHd4dC1kZXYrYnJvd3NlckAwLjEuNC9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L2Jyb3dzZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3ZWJleHQtY29yZSttYXRjaC1wYXR0ZXJuc0AxLjAuMy9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL21hdGNoLXBhdHRlcm5zL2xpYi9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQmFja2dyb3VuZChhcmcpIHtcbiAgaWYgKGFyZyA9PSBudWxsIHx8IHR5cGVvZiBhcmcgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHsgbWFpbjogYXJnIH07XG4gIHJldHVybiBhcmc7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvYmFja2dyb3VuZC50c1xuXG50eXBlIEZpbGVNZXRhTXNnID0ge1xuICBuYW1lPzogc3RyaW5nO1xuICBleHQ/OiBzdHJpbmc7XG4gIGtpbmQ/OiBzdHJpbmc7XG59O1xuXG50eXBlIFBlbmRpbmdEb3dubG9hZCA9IHtcbiAgcmVxdWVzdElkOiBzdHJpbmc7XG4gIHVybDogc3RyaW5nO1xuICBmaWxlTWV0YT86IEZpbGVNZXRhTXNnO1xuICB0YWJJZD86IG51bWJlcjtcbn07XG5cbnR5cGUgRG93bmxvYWRTdGF0dXMgPSAnY29tcGxldGUnIHwgJ2ludGVycnVwdGVkJyB8ICdibG9ja2VkX2h0bWwnO1xuXG5jb25zdCBwZW5kaW5nQnlSZXF1ZXN0SWQgPSBuZXcgTWFwPHN0cmluZywgUGVuZGluZ0Rvd25sb2FkPigpO1xuY29uc3QgcGVuZGluZ0J5RG93bmxvYWRJZCA9IG5ldyBNYXA8bnVtYmVyLCBQZW5kaW5nRG93bmxvYWQ+KCk7XG5jb25zdCBwZW5kaW5nQnlVcmwgPSBuZXcgTWFwPHN0cmluZywgUGVuZGluZ0Rvd25sb2FkPigpO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcbiAgY29uc29sZS5sb2coJ1tDUURdIEJhY2tncm91bmQgcmVhZHkgLSBJbW1lZGlhdGUgU3VjY2VzcyBNb2RlJyk7XG5cbiAgLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIDEuIEhhbmRsZSBieXBhc3Mgc3VjY2VzcyAoYXV0by1jbG9zZSBoZWxwZXIgdGFiKVxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbiAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIpID0+IHtcbiAgICBpZiAobWVzc2FnZT8udHlwZSA9PT0gJ0NRRF9CWVBBU1NfU1VDQ0VTUycgJiYgc2VuZGVyLnRhYj8uaWQgIT0gbnVsbCkge1xuICAgICAgY29uc3QgdGFiSWQgPSBzZW5kZXIudGFiLmlkO1xuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIC8vIE1WMyBzdHlsZSBjYWxsYmFjayAobm8gLmNhdGNoKVxuICAgICAgICBjaHJvbWUudGFicy5yZW1vdmUodGFiSWQsICgpID0+IHtcbiAgICAgICAgICB2b2lkIGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcjtcbiAgICAgICAgfSk7XG4gICAgICB9LCA1MDAwKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiAyLiBkb3dubG9hZHMub25EZXRlcm1pbmluZ0ZpbGVuYW1lXG4gICAqICAgIC0+IEhUTUwgdnMgZXhwZWN0ZWQgZmlsZSB0eXBlXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuICBjaHJvbWUuZG93bmxvYWRzLm9uRGV0ZXJtaW5pbmdGaWxlbmFtZS5hZGRMaXN0ZW5lcigoaXRlbSwgc3VnZ2VzdCkgPT4ge1xuICAgIGxldCBwZW5kaW5nID0gcGVuZGluZ0J5RG93bmxvYWRJZC5nZXQoaXRlbS5pZCk7XG4gICAgaWYgKCFwZW5kaW5nKSB7XG4gICAgICBwZW5kaW5nID1cbiAgICAgICAgcGVuZGluZ0J5VXJsLmdldChpdGVtLnVybCkgPz9cbiAgICAgICAgcGVuZGluZ0J5VXJsLmdldChpdGVtLmZpbmFsVXJsIHx8IGl0ZW0udXJsKTtcbiAgICB9XG5cbiAgICBpZiAoIXBlbmRpbmcpIHtcbiAgICAgIHN1Z2dlc3QoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBhY3R1YWxNaW1lID0gKGl0ZW0ubWltZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBhY3R1YWxFeHQgPSBnZXRGaWxlbmFtZUV4dChpdGVtLmZpbGVuYW1lKTtcbiAgICBjb25zdCBleHBlY3RlZEtpbmQgPSBwZW5kaW5nLmZpbGVNZXRhPy5raW5kO1xuICAgIGNvbnN0IGV4cGVjdGVkRXh0ID0gcGVuZGluZy5maWxlTWV0YT8uZXh0Py50b0xvd2VyQ2FzZSgpO1xuXG4gICAgY29uc3QgbG9va3NMaWtlSHRtbCA9XG4gICAgICBhY3R1YWxNaW1lLmluY2x1ZGVzKCdodG1sJykgfHxcbiAgICAgIGFjdHVhbEV4dCA9PT0gJ2h0bWwnIHx8XG4gICAgICBhY3R1YWxFeHQgPT09ICdodG0nO1xuXG4gICAgY29uc3QgdXNlcldhbnRlZEh0bWwgPVxuICAgICAgZXhwZWN0ZWRLaW5kID09PSAnaHRtbCcgfHxcbiAgICAgIGV4cGVjdGVkRXh0ID09PSAnaHRtbCcgfHxcbiAgICAgIGV4cGVjdGVkRXh0ID09PSAnaHRtJztcblxuICAgIC8vIElmIERyaXZlIHJldHVybmVkIGFuIEhUTUwgcGFnZSBidXQgd2UgZXhwZWN0ZWQgYSBiaW5hcnkgZmlsZVxuICAgIGlmIChsb29rc0xpa2VIdG1sICYmICF1c2VyV2FudGVkSHRtbCkge1xuICAgICAgY29uc29sZS5sb2coJ1tDUURdIEhUTUwgKHZpcnVzIC8gaW50ZXJzdGl0aWFsKSBkZXRlY3RlZC4gT3BlbmluZyBiYWNrZ3JvdW5kIHRhYi4nKTtcblxuICAgICAgY2hyb21lLmRvd25sb2Fkcy5jYW5jZWwoaXRlbS5pZCwgKCkgPT4ge1xuICAgICAgICBjaHJvbWUudGFicy5jcmVhdGUoXG4gICAgICAgICAge1xuICAgICAgICAgICAgdXJsOiBpdGVtLmZpbmFsVXJsIHx8IGl0ZW0udXJsLFxuICAgICAgICAgICAgYWN0aXZlOiBmYWxzZSwgLy8gPC0gdXNlciBzdGF5cyBvbiBDbGFzc3Jvb21cbiAgICAgICAgICB9LFxuICAgICAgICAgICgpID0+IHtcbiAgICAgICAgICAgIC8vIFdlIGRvbid0IHRvdWNoIHRoZSBVSSBoZXJlOyBpdCBhbHJlYWR5IHdlbnQgXCJzdWNjZXNzXCJcbiAgICAgICAgICAgIGNsZWFudXAocGVuZGluZyEsIGl0ZW0uaWQpO1xuICAgICAgICAgIH0sXG4gICAgICAgICk7XG4gICAgICB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBOb3JtYWwgZmlsZW5hbWUgaGFuZGxpbmdcbiAgICBpZiAocGVuZGluZy5maWxlTWV0YT8ubmFtZSkge1xuICAgICAgc3VnZ2VzdCh7IGZpbGVuYW1lOiBwZW5kaW5nLmZpbGVNZXRhLm5hbWUsIGNvbmZsaWN0QWN0aW9uOiAndW5pcXVpZnknIH0pO1xuICAgIH0gZWxzZSB7XG4gICAgICBzdWdnZXN0KHsgY29uZmxpY3RBY3Rpb246ICd1bmlxdWlmeScgfSk7XG4gICAgfVxuICB9KTtcblxuICAvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogMy4gZG93bmxvYWRzLm9uQ2hhbmdlZFxuICAgKiAgICAtPiBjbGVhbnVwIG9ubHksIG5vIFVJIGNoYW5nZXNcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4gIGNocm9tZS5kb3dubG9hZHMub25DaGFuZ2VkLmFkZExpc3RlbmVyKChkZWx0YSkgPT4ge1xuICAgIGNvbnN0IHBlbmRpbmcgPSBwZW5kaW5nQnlEb3dubG9hZElkLmdldChkZWx0YS5pZCk7XG4gICAgaWYgKCFwZW5kaW5nKSByZXR1cm47XG5cbiAgICBpZiAoXG4gICAgICAoZGVsdGEuc3RhdGUgJiYgZGVsdGEuc3RhdGUuY3VycmVudCA9PT0gJ2NvbXBsZXRlJykgfHxcbiAgICAgIChkZWx0YS5zdGF0ZSAmJiBkZWx0YS5zdGF0ZS5jdXJyZW50ID09PSAnaW50ZXJydXB0ZWQnKVxuICAgICkge1xuICAgICAgY2xlYW51cChwZW5kaW5nLCBkZWx0YS5pZCk7XG4gICAgfVxuICB9KTtcblxuICAvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogNC4gcnVudGltZS5vbk1lc3NhZ2U6IENRRF9ET1dOTE9BRFxuICAgKiAgICAtPiBJTU1FRElBVEUgc3VjY2Vzcy9lcnJvclxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbiAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIGlmICghbWVzc2FnZSB8fCBtZXNzYWdlLnR5cGUgIT09ICdDUURfRE9XTkxPQUQnKSByZXR1cm47XG5cbiAgICBjb25zdCByZXF1ZXN0SWQgPVxuICAgICAgdHlwZW9mIG1lc3NhZ2UucmVxdWVzdElkID09PSAnc3RyaW5nJ1xuICAgICAgICA/IG1lc3NhZ2UucmVxdWVzdElkXG4gICAgICAgIDogYHJlcS0ke0RhdGUubm93KCl9YDtcbiAgICBjb25zdCByYXdVcmwgPSB0eXBlb2YgbWVzc2FnZS51cmwgPT09ICdzdHJpbmcnID8gbWVzc2FnZS51cmwgOiBudWxsO1xuICAgIGNvbnN0IGZpbGVNZXRhOiBGaWxlTWV0YU1zZyB8IHVuZGVmaW5lZCA9IG1lc3NhZ2UuZmlsZU1ldGE7XG5cbiAgICBpZiAoIXJhd1VybCkge1xuICAgICAgLy8gaW1tZWRpYXRlIGVycm9yOiBubyBVUkwgYXQgYWxsXG4gICAgICBzZW5kU3RhdHVzVG9UYWIoXG4gICAgICAgIHtcbiAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgdXJsOiAnJyxcbiAgICAgICAgICBmaWxlTWV0YSxcbiAgICAgICAgICB0YWJJZDogc2VuZGVyLnRhYj8uaWQsXG4gICAgICAgIH0sXG4gICAgICAgICdpbnRlcnJ1cHRlZCcsXG4gICAgICAgICdObyB2YWxpZCBsaW5rIGZvdW5kLicsXG4gICAgICAgICdOT19VUkwnLFxuICAgICAgKTtcbiAgICAgIHNlbmRSZXNwb25zZT8uKHtcbiAgICAgICAgc3RhcnRlZDogZmFsc2UsXG4gICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgdXNlck1lc3NhZ2U6ICdObyB2YWxpZCBsaW5rIGZvdW5kLicsXG4gICAgICB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBwZW5kaW5nOiBQZW5kaW5nRG93bmxvYWQgPSB7XG4gICAgICByZXF1ZXN0SWQsXG4gICAgICB1cmw6IHJhd1VybCxcbiAgICAgIGZpbGVNZXRhLFxuICAgICAgdGFiSWQ6IHNlbmRlci50YWI/LmlkLFxuICAgIH07XG5cbiAgICBwZW5kaW5nQnlSZXF1ZXN0SWQuc2V0KHJlcXVlc3RJZCwgcGVuZGluZyk7XG4gICAgcGVuZGluZ0J5VXJsLnNldChyYXdVcmwsIHBlbmRpbmcpO1xuXG4gICAgY2hyb21lLmRvd25sb2Fkcy5kb3dubG9hZChcbiAgICAgIHtcbiAgICAgICAgdXJsOiByYXdVcmwsXG4gICAgICAgIHNhdmVBczogZmFsc2UsXG4gICAgICAgIGNvbmZsaWN0QWN0aW9uOiAndW5pcXVpZnknLFxuICAgICAgfSxcbiAgICAgIChkb3dubG9hZElkKSA9PiB7XG4gICAgICAgIGNvbnN0IGVyciA9IGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcjtcblxuICAgICAgICAvLyDinYwgSW1tZWRpYXRlIGVycm9yOiBicm93c2VyIHJlZnVzZWQgdG8gc3RhcnQgZG93bmxvYWRcbiAgICAgICAgaWYgKGVyciB8fCAhZG93bmxvYWRJZCkge1xuICAgICAgICAgIGNvbnNvbGUud2FybignW0NRRF0gZG93bmxvYWRzLmRvd25sb2FkIGZhaWxlZDonLCBlcnI/Lm1lc3NhZ2UpO1xuXG4gICAgICAgICAgc2VuZFN0YXR1c1RvVGFiKFxuICAgICAgICAgICAgcGVuZGluZyxcbiAgICAgICAgICAgICdpbnRlcnJ1cHRlZCcsXG4gICAgICAgICAgICAnQnJvd3NlciBjb3VsZCBub3Qgc3RhcnQgdGhlIGRvd25sb2FkLicsXG4gICAgICAgICAgICAnU1RBUlRfRkFJTEVEJyxcbiAgICAgICAgICApO1xuXG4gICAgICAgICAgY2xlYW51cChwZW5kaW5nKTtcblxuICAgICAgICAgIHNlbmRSZXNwb25zZT8uKHtcbiAgICAgICAgICAgIHN0YXJ0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgdXNlck1lc3NhZ2U6ICdCcm93c2VyIGJsb2NrZWQgZG93bmxvYWQgc3RhcnQuJyxcbiAgICAgICAgICB9KTtcbiAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICAvLyDinIUgSW1tZWRpYXRlIHN1Y2Nlc3M6IGJyb3dzZXIgYWNjZXB0ZWQgdGhlIGRvd25sb2FkXG4gICAgICAgIGNvbnNvbGUubG9nKCdbQ1FEXSBEb3dubG9hZCBzdGFydGVkOicsIGRvd25sb2FkSWQpO1xuICAgICAgICBwZW5kaW5nQnlEb3dubG9hZElkLnNldChkb3dubG9hZElkLCBwZW5kaW5nKTtcblxuICAgICAgICAvLyBUZWxsIHRoZSBVSTogXCJTdWNjZXNzXCIgUklHSFQgTk9XXG4gICAgICAgIHNlbmRTdGF0dXNUb1RhYihwZW5kaW5nLCAnY29tcGxldGUnKTtcblxuICAgICAgICBzZW5kUmVzcG9uc2U/Lih7XG4gICAgICAgICAgc3RhcnRlZDogdHJ1ZSxcbiAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgZG93bmxvYWRJZCxcbiAgICAgICAgfSk7XG4gICAgICB9LFxuICAgICk7XG5cbiAgICByZXR1cm4gdHJ1ZTsgLy8gYXN5bmMgcmVzcG9uc2VcbiAgfSk7XG59KTtcblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEhlbHBlcnNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIGNsZWFudXAocGVuZGluZzogUGVuZGluZ0Rvd25sb2FkLCBkb3dubG9hZElkPzogbnVtYmVyKSB7XG4gIHBlbmRpbmdCeVJlcXVlc3RJZC5kZWxldGUocGVuZGluZy5yZXF1ZXN0SWQpO1xuICBwZW5kaW5nQnlVcmwuZGVsZXRlKHBlbmRpbmcudXJsKTtcbiAgaWYgKGRvd25sb2FkSWQgIT0gbnVsbCkge1xuICAgIHBlbmRpbmdCeURvd25sb2FkSWQuZGVsZXRlKGRvd25sb2FkSWQpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVuYW1lRXh0KGZpbGVuYW1lPzogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKCFmaWxlbmFtZSkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgY29uc3QgbSA9IGZpbGVuYW1lLm1hdGNoKC9cXC4oW2EtekEtWjAtOV17MSw2fSkkLyk7XG4gIHJldHVybiBtID8gbVsxXS50b0xvd2VyQ2FzZSgpIDogdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBzZW5kU3RhdHVzVG9UYWIoXG4gIHBlbmRpbmc6IFBlbmRpbmdEb3dubG9hZCxcbiAgc3RhdHVzOiBEb3dubG9hZFN0YXR1cyxcbiAgdXNlck1lc3NhZ2U/OiBzdHJpbmcsXG4gIGVycm9yQ29kZT86IHN0cmluZyxcbik6IHZvaWQge1xuICBpZiAocGVuZGluZy50YWJJZCA9PSBudWxsKSByZXR1cm47XG5cbiAgdHJ5IHtcbiAgICBjaHJvbWUudGFicy5zZW5kTWVzc2FnZShwZW5kaW5nLnRhYklkLCB7XG4gICAgICB0eXBlOiAnQ1FEX0RPV05MT0FEX1NUQVRVUycsXG4gICAgICByZXF1ZXN0SWQ6IHBlbmRpbmcucmVxdWVzdElkLFxuICAgICAgc3RhdHVzLFxuICAgICAgZXJyb3JDb2RlLFxuICAgICAgdXNlck1lc3NhZ2UsXG4gICAgfSk7XG4gIH0gY2F0Y2gge1xuICAgIC8vIGlnbm9yZVxuICB9XG59XG4iLCIvLyAjcmVnaW9uIHNuaXBwZXRcbmV4cG9ydCBjb25zdCBicm93c2VyID0gZ2xvYmFsVGhpcy5icm93c2VyPy5ydW50aW1lPy5pZFxuICA/IGdsb2JhbFRoaXMuYnJvd3NlclxuICA6IGdsb2JhbFRoaXMuY2hyb21lO1xuLy8gI2VuZHJlZ2lvbiBzbmlwcGV0XG4iLCJpbXBvcnQgeyBicm93c2VyIGFzIF9icm93c2VyIH0gZnJvbSBcIkB3eHQtZGV2L2Jyb3dzZXJcIjtcbmV4cG9ydCBjb25zdCBicm93c2VyID0gX2Jyb3dzZXI7XG5leHBvcnQge307XG4iLCIvLyBzcmMvaW5kZXgudHNcbnZhciBfTWF0Y2hQYXR0ZXJuID0gY2xhc3Mge1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4pIHtcbiAgICBpZiAobWF0Y2hQYXR0ZXJuID09PSBcIjxhbGxfdXJscz5cIikge1xuICAgICAgdGhpcy5pc0FsbFVybHMgPSB0cnVlO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBbLi4uX01hdGNoUGF0dGVybi5QUk9UT0NPTFNdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gXCIqXCI7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICB9IGVsc2Uge1xuICAgICAgY29uc3QgZ3JvdXBzID0gLyguKik6XFwvXFwvKC4qPykoXFwvLiopLy5leGVjKG1hdGNoUGF0dGVybik7XG4gICAgICBpZiAoZ3JvdXBzID09IG51bGwpXG4gICAgICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgXCJJbmNvcnJlY3QgZm9ybWF0XCIpO1xuICAgICAgY29uc3QgW18sIHByb3RvY29sLCBob3N0bmFtZSwgcGF0aG5hbWVdID0gZ3JvdXBzO1xuICAgICAgdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKTtcbiAgICAgIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSk7XG4gICAgICB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpO1xuICAgICAgdGhpcy5wcm90b2NvbE1hdGNoZXMgPSBwcm90b2NvbCA9PT0gXCIqXCIgPyBbXCJodHRwXCIsIFwiaHR0cHNcIl0gOiBbcHJvdG9jb2xdO1xuICAgICAgdGhpcy5ob3N0bmFtZU1hdGNoID0gaG9zdG5hbWU7XG4gICAgICB0aGlzLnBhdGhuYW1lTWF0Y2ggPSBwYXRobmFtZTtcbiAgICB9XG4gIH1cbiAgaW5jbHVkZXModXJsKSB7XG4gICAgaWYgKHRoaXMuaXNBbGxVcmxzKVxuICAgICAgcmV0dXJuIHRydWU7XG4gICAgY29uc3QgdSA9IHR5cGVvZiB1cmwgPT09IFwic3RyaW5nXCIgPyBuZXcgVVJMKHVybCkgOiB1cmwgaW5zdGFuY2VvZiBMb2NhdGlvbiA/IG5ldyBVUkwodXJsLmhyZWYpIDogdXJsO1xuICAgIHJldHVybiAhIXRoaXMucHJvdG9jb2xNYXRjaGVzLmZpbmQoKHByb3RvY29sKSA9PiB7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwc1wiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0h0dHBzTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZmlsZVwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0ZpbGVNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmdHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGdHBNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJ1cm5cIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNVcm5NYXRjaCh1KTtcbiAgICB9KTtcbiAgfVxuICBpc0h0dHBNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHA6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0h0dHBzTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwczpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSG9zdFBhdGhNYXRjaCh1cmwpIHtcbiAgICBpZiAoIXRoaXMuaG9zdG5hbWVNYXRjaCB8fCAhdGhpcy5wYXRobmFtZU1hdGNoKVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIGNvbnN0IGhvc3RuYW1lTWF0Y2hSZWdleHMgPSBbXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gpLFxuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoLnJlcGxhY2UoL15cXCpcXC4vLCBcIlwiKSlcbiAgICBdO1xuICAgIGNvbnN0IHBhdGhuYW1lTWF0Y2hSZWdleCA9IHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMucGF0aG5hbWVNYXRjaCk7XG4gICAgcmV0dXJuICEhaG9zdG5hbWVNYXRjaFJlZ2V4cy5maW5kKChyZWdleCkgPT4gcmVnZXgudGVzdCh1cmwuaG9zdG5hbWUpKSAmJiBwYXRobmFtZU1hdGNoUmVnZXgudGVzdCh1cmwucGF0aG5hbWUpO1xuICB9XG4gIGlzRmlsZU1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmaWxlOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc0Z0cE1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiBmdHA6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzVXJuTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IHVybjovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgY29udmVydFBhdHRlcm5Ub1JlZ2V4KHBhdHRlcm4pIHtcbiAgICBjb25zdCBlc2NhcGVkID0gdGhpcy5lc2NhcGVGb3JSZWdleChwYXR0ZXJuKTtcbiAgICBjb25zdCBzdGFyc1JlcGxhY2VkID0gZXNjYXBlZC5yZXBsYWNlKC9cXFxcXFwqL2csIFwiLipcIik7XG4gICAgcmV0dXJuIFJlZ0V4cChgXiR7c3RhcnNSZXBsYWNlZH0kYCk7XG4gIH1cbiAgZXNjYXBlRm9yUmVnZXgoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5yZXBsYWNlKC9bLiorP14ke30oKXxbXFxdXFxcXF0vZywgXCJcXFxcJCZcIik7XG4gIH1cbn07XG52YXIgTWF0Y2hQYXR0ZXJuID0gX01hdGNoUGF0dGVybjtcbk1hdGNoUGF0dGVybi5QUk9UT0NPTFMgPSBbXCJodHRwXCIsIFwiaHR0cHNcIiwgXCJmaWxlXCIsIFwiZnRwXCIsIFwidXJuXCJdO1xudmFyIEludmFsaWRNYXRjaFBhdHRlcm4gPSBjbGFzcyBleHRlbmRzIEVycm9yIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuLCByZWFzb24pIHtcbiAgICBzdXBlcihgSW52YWxpZCBtYXRjaCBwYXR0ZXJuIFwiJHttYXRjaFBhdHRlcm59XCI6ICR7cmVhc29ufWApO1xuICB9XG59O1xuZnVuY3Rpb24gdmFsaWRhdGVQcm90b2NvbChtYXRjaFBhdHRlcm4sIHByb3RvY29sKSB7XG4gIGlmICghTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5pbmNsdWRlcyhwcm90b2NvbCkgJiYgcHJvdG9jb2wgIT09IFwiKlwiKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYCR7cHJvdG9jb2x9IG5vdCBhIHZhbGlkIHByb3RvY29sICgke01hdGNoUGF0dGVybi5QUk9UT0NPTFMuam9pbihcIiwgXCIpfSlgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlSG9zdG5hbWUobWF0Y2hQYXR0ZXJuLCBob3N0bmFtZSkge1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCI6XCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKG1hdGNoUGF0dGVybiwgYEhvc3RuYW1lIGNhbm5vdCBpbmNsdWRlIGEgcG9ydGApO1xuICBpZiAoaG9zdG5hbWUuaW5jbHVkZXMoXCIqXCIpICYmIGhvc3RuYW1lLmxlbmd0aCA+IDEgJiYgIWhvc3RuYW1lLnN0YXJ0c1dpdGgoXCIqLlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGBJZiB1c2luZyBhIHdpbGRjYXJkICgqKSwgaXQgbXVzdCBnbyBhdCB0aGUgc3RhcnQgb2YgdGhlIGhvc3RuYW1lYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZVBhdGhuYW1lKG1hdGNoUGF0dGVybiwgcGF0aG5hbWUpIHtcbiAgcmV0dXJuO1xufVxuZXhwb3J0IHtcbiAgSW52YWxpZE1hdGNoUGF0dGVybixcbiAgTWF0Y2hQYXR0ZXJuXG59O1xuIl0sIm5hbWVzIjpbImJyb3dzZXIiLCJfYnJvd3NlciJdLCJtYXBwaW5ncyI6Ijs7QUFBTyxXQUFTLGlCQUFpQixLQUFLO0FBQ3BDLFFBQUksT0FBTyxRQUFRLE9BQU8sUUFBUSxXQUFZLFFBQU8sRUFBRSxNQUFNLElBQUc7QUFDaEUsV0FBTztBQUFBLEVBQ1Q7QUNjQSxRQUFBLHFCQUFBLG9CQUFBLElBQUE7QUFDQSxRQUFBLHNCQUFBLG9CQUFBLElBQUE7QUFDQSxRQUFBLGVBQUEsb0JBQUEsSUFBQTtBQUVBLFFBQUEsYUFBQSxpQkFBQSxNQUFBO0FBQ0UsWUFBQSxJQUFBLGlEQUFBO0FBS0EsV0FBQSxRQUFBLFVBQUEsWUFBQSxDQUFBLFNBQUEsV0FBQTtBQUNFLFVBQUEsU0FBQSxTQUFBLHdCQUFBLE9BQUEsS0FBQSxNQUFBLE1BQUE7QUFDRSxjQUFBLFFBQUEsT0FBQSxJQUFBO0FBQ0EsbUJBQUEsTUFBQTtBQUVFLGlCQUFBLEtBQUEsT0FBQSxPQUFBLE1BQUE7QUFDRSxpQkFBQSxPQUFBLFFBQUE7QUFBQSxVQUFvQixDQUFBO0FBQUEsUUFDckIsR0FBQSxHQUFBO0FBQUEsTUFDSTtBQUFBLElBQ1QsQ0FBQTtBQU9GLFdBQUEsVUFBQSxzQkFBQSxZQUFBLENBQUEsTUFBQSxZQUFBO0FBQ0UsVUFBQSxVQUFBLG9CQUFBLElBQUEsS0FBQSxFQUFBO0FBQ0EsVUFBQSxDQUFBLFNBQUE7QUFDRSxrQkFBQSxhQUFBLElBQUEsS0FBQSxHQUFBLEtBQUEsYUFBQSxJQUFBLEtBQUEsWUFBQSxLQUFBLEdBQUE7QUFBQSxNQUU0QztBQUc5QyxVQUFBLENBQUEsU0FBQTtBQUNFLGdCQUFBO0FBQ0E7QUFBQSxNQUFBO0FBR0YsWUFBQSxjQUFBLEtBQUEsUUFBQSxJ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YUFBYSxVQUFVLEtBQUssSUFBSSxDQUFDO0FBQUEsTUFDNUU7QUFBQSxFQUNBO0FBQ0EsV0FBUyxpQkFBaUIsY0FBYyxVQUFVO0FBQ2hELFFBQUksU0FBUyxTQUFTLEdBQUc7QUFDdkIsWUFBTSxJQUFJLG9CQUFvQixjQUFjLGdDQUFnQztBQUM5RSxRQUFJLFNBQVMsU0FBUyxHQUFHLEtBQUssU0FBUyxTQUFTLEtBQUssQ0FBQyxTQUFTLFdBQVcsSUFBSTtBQUM1RSxZQUFNLElBQUk7QUFBQSxRQUNSO0FBQUEsUUFDQTtBQUFBLE1BQ047QUFBQSxFQUNBOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7IiwieF9nb29nbGVfaWdub3JlTGlzdCI6WzAsMiwzLDRdfQ==
