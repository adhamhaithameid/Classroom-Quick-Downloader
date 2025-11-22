var background = (function() {
  "use strict";
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const pendingByRequestId = /* @__PURE__ */ new Map();
  const pendingByDownloadId = /* @__PURE__ */ new Map();
  const pendingByUrl = /* @__PURE__ */ new Map();
  const pendingByBypassTabId = /* @__PURE__ */ new Map();
  const cancelledByUs = /* @__PURE__ */ new Set();
  const AUTHUSER_CANDIDATES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  function extractAuthUserFromUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const qp = url.searchParams.get("authuser") ?? url.searchParams.get("u");
      const pathMatch = url.pathname.match(/\/u\/(\d+)\//);
      const raw = qp ?? (pathMatch ? pathMatch[1] : void 0);
      if (raw == null) return void 0;
      const parsed = parseInt(raw, 10);
      if (Number.isNaN(parsed)) return void 0;
      if (!AUTHUSER_CANDIDATES.includes(parsed)) return void 0;
      return parsed;
    } catch {
      return void 0;
    }
  }
  const definition = defineBackground(() => {
    console.log("[CQD] Background ready - PRODUCTION ROBUST MODE (merged)");
    chrome.runtime.onMessage.addListener((message, sender) => {
      if (!message || !sender.tab || sender.tab.id == null) return;
      const tabId = sender.tab.id;
      const pending = pendingByBypassTabId.get(tabId);
      if (!pending && typeof message.type === "string" && message.type.startsWith("CQD_")) {
        return;
      }
      if (message.type === "CQD_BYPASS_SUCCESS") {
        if (pending) {
          console.log("[CQD] Bypass SUCCESS reported from Drive tab.");
          sendStatusToTab(pending, "success");
          pending.finalized = true;
        }
        pendingByBypassTabId.delete(tabId);
        setTimeout(() => {
          try {
            chrome.tabs.remove(tabId);
          } catch {
          }
        }, 5e3);
        return;
      }
      if (message.type === "CQD_403_SEEN" && pending) {
        console.log("[CQD] 403 page detected in Drive tab.");
        pending.confirmed403 = true;
        pendingByBypassTabId.delete(tabId);
        try {
          chrome.tabs.remove(tabId);
        } catch {
        }
        if (!pending.htmlSeen) {
          pending.htmlSeen = true;
          sendStatusToTab(
            pending,
            "trying",
            "Trying other Google accounts...",
            "AUTH_LOOP"
          );
        }
        startNextDriveAttempt(pending);
        return;
      }
      if (message.type === "CQD_AUTH_CORRECTING" && pending) {
        console.log(
          "[CQD] Content script is correcting authuser. Waiting for reload..."
        );
        return;
      }
      if (message.type === "CQD_REGISTER_BYPASS_URL" && pending && typeof message.url === "string") {
        pendingByUrl.set(message.url, pending);
        return;
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
      if (looksLikeHtml && !userWantedHtml && pending.isDrive) {
        console.log(
          "[CQD] Drive returned HTML (403 or virus). Intercepting. authuser=",
          pending.currentAuthUser
        );
        cancelledByUs.add(item.id);
        chrome.downloads.cancel(item.id, () => {
          pendingByDownloadId.delete(item.id);
          if (!pending.htmlSeen) {
            pending.htmlSeen = true;
            sendStatusToTab(
              pending,
              "trying",
              "Google Drive needs an extra step...",
              "HTML_INTERCEPT"
            );
          }
          if (pending.confirmed403) {
            startNextDriveAttempt(pending);
            return;
          }
          if (!pending.fallbackStarted) {
            pending.fallbackStarted = true;
            const driveUrl = item.finalUrl || item.url || pending.baseUrl;
            openDriveBypassTab(pending, driveUrl);
          }
        });
        return;
      }
      sendStatusToTab(pending, "success");
      if (pending.fileMeta?.name) {
        suggest({ filename: pending.fileMeta.name, conflictAction: "uniquify" });
      } else {
        suggest({ conflictAction: "uniquify" });
      }
    });
    chrome.downloads.onChanged.addListener((delta) => {
      const pending = pendingByDownloadId.get(delta.id);
      if (!pending) return;
      if (delta.state && delta.state.current === "complete") {
        cleanup(pending, delta.id);
        return;
      }
      if (delta.state && delta.state.current === "interrupted") {
        if (cancelledByUs.has(delta.id)) {
          cancelledByUs.delete(delta.id);
          pendingByDownloadId.delete(delta.id);
          return;
        }
        sendStatusToTab(pending, "error", "Download interrupted.");
        cleanup(pending, delta.id);
      }
    });
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.type !== "CQD_DOWNLOAD") return;
      const rawUrl = message.url;
      const fileMeta = message.fileMeta;
      const requestId = message.requestId || `req-${Date.now()}`;
      if (!rawUrl) {
        sendResponse?.({ started: false, userMessage: "No valid link found." });
        return;
      }
      const { baseUrl, isDrive } = normalizeUrl(rawUrl);
      const initialAuthUser = isDrive ? extractAuthUserFromUrl(rawUrl) : void 0;
      const pending = {
        requestId,
        originalUrl: rawUrl,
        baseUrl,
        isDrive,
        fileMeta,
        tabId: sender.tab?.id,
        attemptedAuthUsers: []
      };
      if (typeof initialAuthUser === "number") {
        pending.initialAuthUser = initialAuthUser;
        pending.attemptedAuthUsers.push(initialAuthUser);
        pending.currentAuthUser = initialAuthUser;
      }
      pendingByRequestId.set(requestId, pending);
      let responseSent = false;
      const respondOnce = (payload) => {
        if (responseSent) return;
        responseSent = true;
        sendResponse?.(payload);
      };
      if (isDrive) {
        const firstUrl = typeof pending.currentAuthUser === "number" ? buildUrlWithAuthUser(pending.baseUrl, pending.currentAuthUser) : pending.baseUrl;
        chrome.downloads.download(
          {
            url: firstUrl,
            saveAs: false,
            conflictAction: "uniquify"
          },
          (id) => {
            if (chrome.runtime.lastError || !id) {
              console.warn(
                "[CQD] Initial Drive download start failed:",
                chrome.runtime.lastError?.message
              );
              if (!pending.fallbackStarted) {
                pending.fallbackStarted = true;
                openDriveBypassTab(pending, pending.baseUrl);
                respondOnce({
                  started: true,
                  requestId,
                  userMessage: "Browser blocked. Trying Drive tab…"
                });
              } else {
                respondOnce({
                  started: false,
                  userMessage: "Browser blocked download."
                });
              }
              return;
            }
            pending.currentDownloadId = id;
            pendingByDownloadId.set(id, pending);
            respondOnce({ started: true, requestId, downloadId: id });
          }
        );
      } else {
        startSingleAttempt(pending, respondOnce);
      }
      return true;
    });
  });
  function startSingleAttempt(pending, respondOnce) {
    chrome.downloads.download(
      {
        url: pending.baseUrl,
        saveAs: false,
        conflictAction: "uniquify"
      },
      (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          cleanup(pending);
          respondOnce?.({
            started: false,
            userMessage: "Browser blocked download."
          });
          return;
        }
        pending.currentDownloadId = downloadId;
        pendingByDownloadId.set(downloadId, pending);
        respondOnce?.({
          started: true,
          requestId: pending.requestId,
          downloadId
        });
      }
    );
  }
  function startNextDriveAttempt(pending) {
    pending.htmlSeen = false;
    pending.fallbackStarted = false;
    pending.confirmed403 = false;
    const nextAuth = AUTHUSER_CANDIDATES.find(
      (n) => !pending.attemptedAuthUsers.includes(n)
    );
    if (nextAuth == null) {
      console.log("[CQD] All authusers failed.");
      sendStatusToTab(
        pending,
        "error",
        "Access denied for all accounts.",
        "AUTH_ALL_FAILED"
      );
      cleanup(pending);
      return;
    }
    pending.attemptedAuthUsers.push(nextAuth);
    pending.currentAuthUser = nextAuth;
    const attemptUrl = buildUrlWithAuthUser(pending.baseUrl, nextAuth);
    console.log("[CQD] Looping authuser=", nextAuth);
    chrome.downloads.download(
      {
        url: attemptUrl,
        saveAs: false,
        conflictAction: "uniquify"
      },
      (downloadId) => {
        if (chrome.runtime.lastError || !downloadId) {
          startNextDriveAttempt(pending);
          return;
        }
        pending.currentDownloadId = downloadId;
        pendingByDownloadId.set(downloadId, pending);
      }
    );
  }
  function openDriveBypassTab(pending, url) {
    console.log("[CQD] Opening Drive bypass tab:", url);
    chrome.tabs.create({ url, active: false }, (tab) => {
      if (tab?.id != null) {
        pendingByBypassTabId.set(tab.id, pending);
      }
    });
  }
  function normalizeUrl(rawUrl) {
    try {
      const url = new URL(rawUrl);
      const isDrive = url.hostname.includes("drive");
      if (!isDrive) return { baseUrl: rawUrl, isDrive: false };
      url.searchParams.delete("authuser");
      if (url.pathname.includes("/open")) {
        url.pathname = "/uc";
      }
      if (!url.searchParams.has("export")) {
        url.searchParams.set("export", "download");
      }
      return { baseUrl: url.toString(), isDrive: true };
    } catch {
      return { baseUrl: rawUrl, isDrive: false };
    }
  }
  function buildUrlWithAuthUser(baseUrl, authuser) {
    try {
      const url = new URL(baseUrl);
      url.searchParams.set("authuser", String(authuser));
      return url.toString();
    } catch {
      return baseUrl;
    }
  }
  function cleanup(pending, downloadId) {
    pendingByRequestId.delete(pending.requestId);
    if (downloadId != null) {
      pendingByDownloadId.delete(downloadId);
      cancelledByUs.delete(downloadId);
    }
    for (const [url, p] of pendingByUrl.entries()) {
      if (p.requestId === pending.requestId) {
        pendingByUrl.delete(url);
      }
    }
    for (const [tabId, p] of pendingByBypassTabId.entries()) {
      if (p.requestId === pending.requestId) {
        pendingByBypassTabId.delete(tabId);
        try {
          chrome.tabs.remove(tabId);
        } catch {
        }
      }
    }
  }
  function getFilenameExt(filename) {
    if (!filename) return void 0;
    const m = filename.match(/\.([a-zA-Z0-9]{1,6})$/);
    return m ? m[1].toLowerCase() : void 0;
  }
  function sendStatusToTab(pending, status, userMessage, errorCode) {
    if (pending.finalized && status === "success") return;
    if (status === "success") pending.finalized = true;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL2VudHJ5cG9pbnRzL2JhY2tncm91bmQudHMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHd4dC1kZXYrYnJvd3NlckAwLjEuNC9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L2Jyb3dzZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3ZWJleHQtY29yZSttYXRjaC1wYXR0ZXJuc0AxLjAuMy9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL21hdGNoLXBhdHRlcm5zL2xpYi9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQmFja2dyb3VuZChhcmcpIHtcbiAgaWYgKGFyZyA9PSBudWxsIHx8IHR5cGVvZiBhcmcgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHsgbWFpbjogYXJnIH07XG4gIHJldHVybiBhcmc7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvYmFja2dyb3VuZC50c1xuXG50eXBlIEZpbGVNZXRhTXNnID0ge1xuICBuYW1lPzogc3RyaW5nO1xuICBleHQ/OiBzdHJpbmc7XG4gIGtpbmQ/OiBzdHJpbmc7XG59O1xuXG50eXBlIERvd25sb2FkU3RhdHVzID1cbiAgfCAnY29tcGxldGUnXG4gIHwgJ2ludGVycnVwdGVkJ1xuICB8ICdibG9ja2VkX2h0bWwnXG4gIHwgJ2Vycm9yJ1xuICB8ICdzdWNjZXNzJ1xuICB8ICd0cnlpbmcnO1xuXG50eXBlIFBlbmRpbmdEb3dubG9hZCA9IHtcbiAgcmVxdWVzdElkOiBzdHJpbmc7XG5cbiAgb3JpZ2luYWxVcmw6IHN0cmluZztcbiAgYmFzZVVybDogc3RyaW5nO1xuICBpc0RyaXZlOiBib29sZWFuO1xuXG4gIGZpbGVNZXRhPzogRmlsZU1ldGFNc2c7XG4gIHRhYklkPzogbnVtYmVyO1xuXG4gIGF0dGVtcHRlZEF1dGhVc2VyczogbnVtYmVyW107XG4gIGN1cnJlbnRBdXRoVXNlcj86IG51bWJlcjtcbiAgaW5pdGlhbEF1dGhVc2VyPzogbnVtYmVyO1xuICBjdXJyZW50RG93bmxvYWRJZD86IG51bWJlcjtcblxuICBmYWxsYmFja1N0YXJ0ZWQ/OiBib29sZWFuO1xuXG4gIGh0bWxTZWVuPzogYm9vbGVhbjtcbiAgY29uZmlybWVkNDAzPzogYm9vbGVhbjtcbiAgY29uZmlybWVkVmlydXM/OiBib29sZWFuO1xuICBmaW5hbGl6ZWQ/OiBib29sZWFuO1xufTtcblxuY29uc3QgcGVuZGluZ0J5UmVxdWVzdElkID0gbmV3IE1hcDxzdHJpbmcsIFBlbmRpbmdEb3dubG9hZD4oKTtcbmNvbnN0IHBlbmRpbmdCeURvd25sb2FkSWQgPSBuZXcgTWFwPG51bWJlciwgUGVuZGluZ0Rvd25sb2FkPigpO1xuY29uc3QgcGVuZGluZ0J5VXJsID0gbmV3IE1hcDxzdHJpbmcsIFBlbmRpbmdEb3dubG9hZD4oKTtcbmNvbnN0IHBlbmRpbmdCeUJ5cGFzc1RhYklkID0gbmV3IE1hcDxudW1iZXIsIFBlbmRpbmdEb3dubG9hZD4oKTtcblxuY29uc3QgY2FuY2VsbGVkQnlVcyA9IG5ldyBTZXQ8bnVtYmVyPigpO1xuXG5jb25zdCBBVVRIVVNFUl9DQU5ESURBVEVTID0gWzAsIDEsIDIsIDMsIDQsIDUsIDYsIDcsIDgsIDldO1xuXG5mdW5jdGlvbiBleHRyYWN0QXV0aFVzZXJGcm9tVXJsKHJhd1VybDogc3RyaW5nKTogbnVtYmVyIHwgdW5kZWZpbmVkIHtcbiAgdHJ5IHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJhd1VybCk7XG5cbiAgICAvLyBUcnkgcXVlcnkgcGFyYW1zIGZpcnN0ICg/YXV0aHVzZXI9MiwgP3U9MilcbiAgICBjb25zdCBxcCA9IHVybC5zZWFyY2hQYXJhbXMuZ2V0KCdhdXRodXNlcicpID8/IHVybC5zZWFyY2hQYXJhbXMuZ2V0KCd1Jyk7XG5cbiAgICAvLyBUaGVuIHBhdGggZm9ybWF0IC91LzIvLi4uXG4gICAgY29uc3QgcGF0aE1hdGNoID0gdXJsLnBhdGhuYW1lLm1hdGNoKC9cXC91XFwvKFxcZCspXFwvLyk7XG4gICAgY29uc3QgcmF3ID0gcXAgPz8gKHBhdGhNYXRjaCA/IHBhdGhNYXRjaFsxXSA6IHVuZGVmaW5lZCk7XG4gICAgaWYgKHJhdyA9PSBudWxsKSByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgY29uc3QgcGFyc2VkID0gcGFyc2VJbnQocmF3LCAxMCk7XG4gICAgaWYgKE51bWJlci5pc05hTihwYXJzZWQpKSByZXR1cm4gdW5kZWZpbmVkO1xuXG4gICAgaWYgKCFBVVRIVVNFUl9DQU5ESURBVEVTLmluY2x1ZGVzKHBhcnNlZCkpIHJldHVybiB1bmRlZmluZWQ7XG4gICAgcmV0dXJuIHBhcnNlZDtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcbiAgY29uc29sZS5sb2coJ1tDUURdIEJhY2tncm91bmQgcmVhZHkgLSBQUk9EVUNUSU9OIFJPQlVTVCBNT0RFIChtZXJnZWQpJyk7XG5cbiAgLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiAxKSBNZXNzYWdlcyBmcm9tIGRyaXZlX2J5cGFzcy5jb250ZW50LnRzIChEcml2ZSB0YWIpXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbiAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIpID0+IHtcbiAgICBpZiAoIW1lc3NhZ2UgfHwgIXNlbmRlci50YWIgfHwgc2VuZGVyLnRhYi5pZCA9PSBudWxsKSByZXR1cm47XG5cbiAgICBjb25zdCB0YWJJZCA9IHNlbmRlci50YWIuaWQ7XG4gICAgY29uc3QgcGVuZGluZyA9IHBlbmRpbmdCeUJ5cGFzc1RhYklkLmdldCh0YWJJZCk7XG5cbiAgICAvLyBOb3QgcmVsYXRlZCB0byBhbnkgYnlwYXNzIHRhYiB3ZSdyZSB0cmFja2luZ1xuICAgIGlmICghcGVuZGluZyAmJiB0eXBlb2YgbWVzc2FnZS50eXBlID09PSAnc3RyaW5nJyAmJiBtZXNzYWdlLnR5cGUuc3RhcnRzV2l0aCgnQ1FEXycpKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgLy8gQSkgU1VDQ0VTUzogRHJpdmUgdGFiIGNsaWNrZWQgRG93bmxvYWQgLyBEb3dubG9hZCBhbnl3YXlcbiAgICBpZiAobWVzc2FnZS50eXBlID09PSAnQ1FEX0JZUEFTU19TVUNDRVNTJykge1xuICAgICAgaWYgKHBlbmRpbmcpIHtcbiAgICAgICAgY29uc29sZS5sb2coJ1tDUURdIEJ5cGFzcyBTVUNDRVNTIHJlcG9ydGVkIGZyb20gRHJpdmUgdGFiLicpO1xuICAgICAgICAvLyAxLiBVcGRhdGUgVUkgaW1tZWRpYXRlbHkgdG8gR3JlZW4vU3VjY2Vzc1xuICAgICAgICBzZW5kU3RhdHVzVG9UYWIocGVuZGluZywgJ3N1Y2Nlc3MnKTtcbiAgICAgICAgcGVuZGluZy5maW5hbGl6ZWQgPSB0cnVlO1xuICAgICAgfVxuXG4gICAgICAvLyAyLiBTdG9wIHRyYWNraW5nIHRoaXMgdGFiXG4gICAgICBwZW5kaW5nQnlCeXBhc3NUYWJJZC5kZWxldGUodGFiSWQpO1xuXG4gICAgICAvLyAzLiBDbG9zZSB0aGUgdGFiIGFmdGVyIGEgc2FmZSBkZWxheSAoYWxsb3dzIGRvd25sb2FkIHRvIGluaXRpYXRlKVxuICAgICAgc2V0VGltZW91dCgoKSA9PiB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgY2hyb21lLnRhYnMucmVtb3ZlKHRhYklkKTtcbiAgICAgICAgfSBjYXRjaCB7XG4gICAgICAgICAgLyogaWdub3JlICovXG4gICAgICAgIH1cbiAgICAgIH0sIDUwMDApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIEIpIDQwMyBTRUVOOiBEcml2ZSB0YWIgc2F5cyBcIkkgc2VlIGFjY2VzcyBkZW5pZWRcIlxuICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdDUURfNDAzX1NFRU4nICYmIHBlbmRpbmcpIHtcbiAgICAgIGNvbnNvbGUubG9nKCdbQ1FEXSA0MDMgcGFnZSBkZXRlY3RlZCBpbiBEcml2ZSB0YWIuJyk7XG4gICAgICBwZW5kaW5nLmNvbmZpcm1lZDQwMyA9IHRydWU7XG5cbiAgICAgIC8vIENsb3NlIHRoaXMgdGFiLCB3ZSBhcmUgZG9uZSB3aXRoIHRoaXMgc3BlY2lmaWMgYXR0ZW1wdFxuICAgICAgcGVuZGluZ0J5QnlwYXNzVGFiSWQuZGVsZXRlKHRhYklkKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNocm9tZS50YWJzLnJlbW92ZSh0YWJJZCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLyogaWdub3JlICovXG4gICAgICB9XG5cbiAgICAgIC8vIE5vdGlmeSBVSSB3ZSBhcmUgbG9vcGluZ1xuICAgICAgaWYgKCFwZW5kaW5nLmh0bWxTZWVuKSB7XG4gICAgICAgIHBlbmRpbmcuaHRtbFNlZW4gPSB0cnVlO1xuICAgICAgICBzZW5kU3RhdHVzVG9UYWIoXG4gICAgICAgICAgcGVuZGluZyxcbiAgICAgICAgICAndHJ5aW5nJyxcbiAgICAgICAgICAnVHJ5aW5nIG90aGVyIEdvb2dsZSBhY2NvdW50cy4uLicsXG4gICAgICAgICAgJ0FVVEhfTE9PUCcsXG4gICAgICAgICk7XG4gICAgICB9XG5cbiAgICAgIHN0YXJ0TmV4dERyaXZlQXR0ZW1wdChwZW5kaW5nKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBDKSBBVVRIIENPUlJFQ1RJTkc6IERyaXZlIHRhYiBzYXlzIFwiSSBhbSBmaXhpbmcgdGhlIFVSTCwgd2FpdC5cIlxuICAgIGlmIChtZXNzYWdlLnR5cGUgPT09ICdDUURfQVVUSF9DT1JSRUNUSU5HJyAmJiBwZW5kaW5nKSB7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgJ1tDUURdIENvbnRlbnQgc2NyaXB0IGlzIGNvcnJlY3RpbmcgYXV0aHVzZXIuIFdhaXRpbmcgZm9yIHJlbG9hZC4uLicsXG4gICAgICApO1xuICAgICAgLy8gRG8gTk9UIGNsb3NlIHRoZSB0YWIuIERvIE5PVCBzdGFydCBuZXh0IGF0dGVtcHQuIEp1c3Qgd2FpdC5cbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBEKSBMRUdBQ1k6IFVSTCBSZWdpc3RyYXRpb24gKGtlcHQgZm9yIHNhZmV0eSlcbiAgICBpZiAoXG4gICAgICBtZXNzYWdlLnR5cGUgPT09ICdDUURfUkVHSVNURVJfQllQQVNTX1VSTCcgJiZcbiAgICAgIHBlbmRpbmcgJiZcbiAgICAgIHR5cGVvZiBtZXNzYWdlLnVybCA9PT0gJ3N0cmluZydcbiAgICApIHtcbiAgICAgIHBlbmRpbmdCeVVybC5zZXQobWVzc2FnZS51cmwsIHBlbmRpbmcpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cbiAgfSk7XG5cbiAgLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiAyKSBkb3dubG9hZHMub25EZXRlcm1pbmluZ0ZpbGVuYW1lXG4gICAqIERldGVjdCBIVE1MIHZzIHJlYWwgZmlsZVxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4gIGNocm9tZS5kb3dubG9hZHMub25EZXRlcm1pbmluZ0ZpbGVuYW1lLmFkZExpc3RlbmVyKChpdGVtLCBzdWdnZXN0KSA9PiB7XG4gICAgbGV0IHBlbmRpbmcgPSBwZW5kaW5nQnlEb3dubG9hZElkLmdldChpdGVtLmlkKTtcbiAgICBpZiAoIXBlbmRpbmcpIHtcbiAgICAgIHBlbmRpbmcgPVxuICAgICAgICBwZW5kaW5nQnlVcmwuZ2V0KGl0ZW0udXJsKSA/P1xuICAgICAgICBwZW5kaW5nQnlVcmwuZ2V0KGl0ZW0uZmluYWxVcmwgfHwgaXRlbS51cmwpO1xuICAgIH1cblxuICAgIGlmICghcGVuZGluZykge1xuICAgICAgc3VnZ2VzdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IGFjdHVhbE1pbWUgPSAoaXRlbS5taW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGFjdHVhbEV4dCA9IGdldEZpbGVuYW1lRXh0KGl0ZW0uZmlsZW5hbWUpO1xuICAgIGNvbnN0IGV4cGVjdGVkS2luZCA9IHBlbmRpbmcuZmlsZU1ldGE/LmtpbmQ7XG4gICAgY29uc3QgZXhwZWN0ZWRFeHQgPSBwZW5kaW5nLmZpbGVNZXRhPy5leHQ/LnRvTG93ZXJDYXNlKCk7XG5cbiAgICBjb25zdCBsb29rc0xpa2VIdG1sID1cbiAgICAgIGFjdHVhbE1pbWUuaW5jbHVkZXMoJ2h0bWwnKSB8fFxuICAgICAgYWN0dWFsRXh0ID09PSAnaHRtbCcgfHxcbiAgICAgIGFjdHVhbEV4dCA9PT0gJ2h0bSc7XG5cbiAgICBjb25zdCB1c2VyV2FudGVkSHRtbCA9XG4gICAgICBleHBlY3RlZEtpbmQgPT09ICdodG1sJyB8fFxuICAgICAgZXhwZWN0ZWRFeHQgPT09ICdodG1sJyB8fFxuICAgICAgZXhwZWN0ZWRFeHQgPT09ICdodG0nO1xuXG4gICAgLy8gRFJJVkU6IEhUTUwgd2hlbiB3ZSBleHBlY3RlZCBhIGZpbGUg4oaSIGVpdGhlciA0MDMgb3IgdmlydXMgcGFnZS5cbiAgICBpZiAobG9va3NMaWtlSHRtbCAmJiAhdXNlcldhbnRlZEh0bWwgJiYgcGVuZGluZy5pc0RyaXZlKSB7XG4gICAgICBjb25zb2xlLmxvZyhcbiAgICAgICAgJ1tDUURdIERyaXZlIHJldHVybmVkIEhUTUwgKDQwMyBvciB2aXJ1cykuIEludGVyY2VwdGluZy4gYXV0aHVzZXI9JyxcbiAgICAgICAgcGVuZGluZy5jdXJyZW50QXV0aFVzZXIsXG4gICAgICApO1xuXG4gICAgICBjYW5jZWxsZWRCeVVzLmFkZChpdGVtLmlkKTtcblxuICAgICAgY2hyb21lLmRvd25sb2Fkcy5jYW5jZWwoaXRlbS5pZCwgKCkgPT4ge1xuICAgICAgICBwZW5kaW5nQnlEb3dubG9hZElkLmRlbGV0ZShpdGVtLmlkKTtcblxuICAgICAgICBpZiAoIXBlbmRpbmcuaHRtbFNlZW4pIHtcbiAgICAgICAgICBwZW5kaW5nLmh0bWxTZWVuID0gdHJ1ZTtcbiAgICAgICAgICBzZW5kU3RhdHVzVG9UYWIoXG4gICAgICAgICAgICBwZW5kaW5nLFxuICAgICAgICAgICAgJ3RyeWluZycsXG4gICAgICAgICAgICAnR29vZ2xlIERyaXZlIG5lZWRzIGFuIGV4dHJhIHN0ZXAuLi4nLFxuICAgICAgICAgICAgJ0hUTUxfSU5URVJDRVBUJyxcbiAgICAgICAgICApO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgd2UgYWxyZWFkeSBjb25maXJtZWQgYSA0MDMsIGtlZXAgbG9vcGluZyBhdXRodXNlclxuICAgICAgICBpZiAocGVuZGluZy5jb25maXJtZWQ0MDMpIHtcbiAgICAgICAgICBzdGFydE5leHREcml2ZUF0dGVtcHQocGVuZGluZyk7XG4gICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gT3RoZXJ3aXNlLCBvcGVuIGEgaGlkZGVuIERyaXZlIHRhYiBzbyB0aGUgY29udGVudCBzY3JpcHRcbiAgICAgICAgLy8gY2FuIGZpeCBhdXRodXNlciAvIGNsaWNrIFwiRG93bmxvYWQgYW55d2F5XCIgLyBjbGFzc2lmeSA0MDMuXG4gICAgICAgIGlmICghcGVuZGluZy5mYWxsYmFja1N0YXJ0ZWQpIHtcbiAgICAgICAgICBwZW5kaW5nLmZhbGxiYWNrU3RhcnRlZCA9IHRydWU7XG4gICAgICAgICAgY29uc3QgZHJpdmVVcmwgPSBpdGVtLmZpbmFsVXJsIHx8IGl0ZW0udXJsIHx8IHBlbmRpbmcuYmFzZVVybDtcbiAgICAgICAgICBvcGVuRHJpdmVCeXBhc3NUYWIocGVuZGluZywgZHJpdmVVcmwpO1xuICAgICAgICB9XG4gICAgICB9KTtcblxuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIFNVQ0NFU1M6IFJlYWwgZmlsZSAob3IgdXNlciBleHBsaWNpdGx5IHdhbnRlZCBIVE1MKVxuICAgIHNlbmRTdGF0dXNUb1RhYihwZW5kaW5nLCAnc3VjY2VzcycpO1xuXG4gICAgaWYgKHBlbmRpbmcuZmlsZU1ldGE/Lm5hbWUpIHtcbiAgICAgIHN1Z2dlc3QoeyBmaWxlbmFtZTogcGVuZGluZy5maWxlTWV0YS5uYW1lLCBjb25mbGljdEFjdGlvbjogJ3VuaXF1aWZ5JyB9KTtcbiAgICB9IGVsc2Uge1xuICAgICAgc3VnZ2VzdCh7IGNvbmZsaWN0QWN0aW9uOiAndW5pcXVpZnknIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiAzKSBkb3dubG9hZHMub25DaGFuZ2VkIChjb21wbGV0aW9uIC8gaW50ZXJydXB0aW9ucylcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuICBjaHJvbWUuZG93bmxvYWRzLm9uQ2hhbmdlZC5hZGRMaXN0ZW5lcigoZGVsdGEpID0+IHtcbiAgICBjb25zdCBwZW5kaW5nID0gcGVuZGluZ0J5RG93bmxvYWRJZC5nZXQoZGVsdGEuaWQpO1xuICAgIGlmICghcGVuZGluZykgcmV0dXJuO1xuXG4gICAgaWYgKGRlbHRhLnN0YXRlICYmIGRlbHRhLnN0YXRlLmN1cnJlbnQgPT09ICdjb21wbGV0ZScpIHtcbiAgICAgIGNsZWFudXAocGVuZGluZywgZGVsdGEuaWQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChkZWx0YS5zdGF0ZSAmJiBkZWx0YS5zdGF0ZS5jdXJyZW50ID09PSAnaW50ZXJydXB0ZWQnKSB7XG4gICAgICBpZiAoY2FuY2VsbGVkQnlVcy5oYXMoZGVsdGEuaWQpKSB7XG4gICAgICAgIGNhbmNlbGxlZEJ5VXMuZGVsZXRlKGRlbHRhLmlkKTtcbiAgICAgICAgcGVuZGluZ0J5RG93bmxvYWRJZC5kZWxldGUoZGVsdGEuaWQpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBzZW5kU3RhdHVzVG9UYWIocGVuZGluZywgJ2Vycm9yJywgJ0Rvd25sb2FkIGludGVycnVwdGVkLicpO1xuICAgICAgY2xlYW51cChwZW5kaW5nLCBkZWx0YS5pZCk7XG4gICAgfVxuICB9KTtcblxuICAvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIDQpIENRRF9ET1dOTE9BRCBmcm9tIENsYXNzcm9vbSBjb250ZW50IHNjcmlwdFxuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4gIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICBpZiAoIW1lc3NhZ2UgfHwgbWVzc2FnZS50eXBlICE9PSAnQ1FEX0RPV05MT0FEJykgcmV0dXJuO1xuXG4gICAgY29uc3QgcmF3VXJsID0gbWVzc2FnZS51cmwgYXMgc3RyaW5nIHwgdW5kZWZpbmVkO1xuICAgIGNvbnN0IGZpbGVNZXRhID0gbWVzc2FnZS5maWxlTWV0YSBhcyBGaWxlTWV0YU1zZyB8IHVuZGVmaW5lZDtcbiAgICBjb25zdCByZXF1ZXN0SWQgPSBtZXNzYWdlLnJlcXVlc3RJZCB8fCBgcmVxLSR7RGF0ZS5ub3coKX1gO1xuXG4gICAgaWYgKCFyYXdVcmwpIHtcbiAgICAgIHNlbmRSZXNwb25zZT8uKHsgc3RhcnRlZDogZmFsc2UsIHVzZXJNZXNzYWdlOiAnTm8gdmFsaWQgbGluayBmb3VuZC4nIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHsgYmFzZVVybCwgaXNEcml2ZSB9ID0gbm9ybWFsaXplVXJsKHJhd1VybCk7XG4gICAgY29uc3QgaW5pdGlhbEF1dGhVc2VyID0gaXNEcml2ZSA/IGV4dHJhY3RBdXRoVXNlckZyb21VcmwocmF3VXJsKSA6IHVuZGVmaW5lZDtcblxuICAgIGNvbnN0IHBlbmRpbmc6IFBlbmRpbmdEb3dubG9hZCA9IHtcbiAgICAgIHJlcXVlc3RJZCxcbiAgICAgIG9yaWdpbmFsVXJsOiByYXdVcmwsXG4gICAgICBiYXNlVXJsLFxuICAgICAgaXNEcml2ZSxcbiAgICAgIGZpbGVNZXRhLFxuICAgICAgdGFiSWQ6IHNlbmRlci50YWI/LmlkLFxuICAgICAgYXR0ZW1wdGVkQXV0aFVzZXJzOiBbXSxcbiAgICB9O1xuXG4gICAgaWYgKHR5cGVvZiBpbml0aWFsQXV0aFVzZXIgPT09ICdudW1iZXInKSB7XG4gICAgICBwZW5kaW5nLmluaXRpYWxBdXRoVXNlciA9IGluaXRpYWxBdXRoVXNlcjtcbiAgICAgIHBlbmRpbmcuYXR0ZW1wdGVkQXV0aFVzZXJzLnB1c2goaW5pdGlhbEF1dGhVc2VyKTtcbiAgICAgIHBlbmRpbmcuY3VycmVudEF1dGhVc2VyID0gaW5pdGlhbEF1dGhVc2VyO1xuICAgIH1cblxuICAgIHBlbmRpbmdCeVJlcXVlc3RJZC5zZXQocmVxdWVzdElkLCBwZW5kaW5nKTtcblxuICAgIGxldCByZXNwb25zZVNlbnQgPSBmYWxzZTtcbiAgICBjb25zdCByZXNwb25kT25jZSA9IChwYXlsb2FkOiBhbnkpID0+IHtcbiAgICAgIGlmIChyZXNwb25zZVNlbnQpIHJldHVybjtcbiAgICAgIHJlc3BvbnNlU2VudCA9IHRydWU7XG4gICAgICBzZW5kUmVzcG9uc2U/LihwYXlsb2FkKTtcbiAgICB9O1xuXG4gICAgaWYgKGlzRHJpdmUpIHtcbiAgICAgIC8vIFRyeSBkaXJlY3QgZG93bmxvYWQgZmlyc3QuXG4gICAgICAvLyBJZiBDbGFzc3Jvb20vcmF3VXJsIGhhZCBhbiBleHBsaWNpdCBhdXRodXNlciwgaG9ub3IgdGhhdCBmb3IgdGhlIGZpcnN0IGF0dGVtcHQuXG4gICAgICBjb25zdCBmaXJzdFVybCA9XG4gICAgICAgIHR5cGVvZiBwZW5kaW5nLmN1cnJlbnRBdXRoVXNlciA9PT0gJ251bWJlcidcbiAgICAgICAgICA/IGJ1aWxkVXJsV2l0aEF1dGhVc2VyKHBlbmRpbmcuYmFzZVVybCwgcGVuZGluZy5jdXJyZW50QXV0aFVzZXIpXG4gICAgICAgICAgOiBwZW5kaW5nLmJhc2VVcmw7XG5cbiAgICAgIGNocm9tZS5kb3dubG9hZHMuZG93bmxvYWQoXG4gICAgICAgIHtcbiAgICAgICAgICB1cmw6IGZpcnN0VXJsLFxuICAgICAgICAgIHNhdmVBczogZmFsc2UsXG4gICAgICAgICAgY29uZmxpY3RBY3Rpb246ICd1bmlxdWlmeScsXG4gICAgICAgIH0sXG4gICAgICAgIChpZCkgPT4ge1xuICAgICAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IgfHwgIWlkKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXG4gICAgICAgICAgICAgICdbQ1FEXSBJbml0aWFsIERyaXZlIGRvd25sb2FkIHN0YXJ0IGZhaWxlZDonLFxuICAgICAgICAgICAgICBjaHJvbWUucnVudGltZS5sYXN0RXJyb3I/Lm1lc3NhZ2UsXG4gICAgICAgICAgICApO1xuXG4gICAgICAgICAgICBpZiAoIXBlbmRpbmcuZmFsbGJhY2tTdGFydGVkKSB7XG4gICAgICAgICAgICAgIHBlbmRpbmcuZmFsbGJhY2tTdGFydGVkID0gdHJ1ZTtcbiAgICAgICAgICAgICAgb3BlbkRyaXZlQnlwYXNzVGFiKHBlbmRpbmcsIHBlbmRpbmcuYmFzZVVybCk7XG4gICAgICAgICAgICAgIHJlc3BvbmRPbmNlKHtcbiAgICAgICAgICAgICAgICBzdGFydGVkOiB0cnVlLFxuICAgICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgICB1c2VyTWVzc2FnZTogJ0Jyb3dzZXIgYmxvY2tlZC4gVHJ5aW5nIERyaXZlIHRhYuKApicsXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgcmVzcG9uZE9uY2Uoe1xuICAgICAgICAgICAgICAgIHN0YXJ0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgICAgIHVzZXJNZXNzYWdlOiAnQnJvd3NlciBibG9ja2VkIGRvd25sb2FkLicsXG4gICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgIH1cblxuICAgICAgICAgIHBlbmRpbmcuY3VycmVudERvd25sb2FkSWQgPSBpZDtcbiAgICAgICAgICBwZW5kaW5nQnlEb3dubG9hZElkLnNldChpZCwgcGVuZGluZyk7XG4gICAgICAgICAgcmVzcG9uZE9uY2UoeyBzdGFydGVkOiB0cnVlLCByZXF1ZXN0SWQsIGRvd25sb2FkSWQ6IGlkIH0pO1xuICAgICAgICB9LFxuICAgICAgKTtcbiAgICB9IGVsc2Uge1xuICAgICAgLy8gTm9uLURyaXZlXG4gICAgICBzdGFydFNpbmdsZUF0dGVtcHQocGVuZGluZywgcmVzcG9uZE9uY2UpO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9KTtcbn0pO1xuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBOb24tRHJpdmUgc2luZ2xlIGF0dGVtcHRcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmZ1bmN0aW9uIHN0YXJ0U2luZ2xlQXR0ZW1wdChcbiAgcGVuZGluZzogUGVuZGluZ0Rvd25sb2FkLFxuICByZXNwb25kT25jZT86IChwYXlsb2FkOiBhbnkpID0+IHZvaWQsXG4pIHtcbiAgY2hyb21lLmRvd25sb2Fkcy5kb3dubG9hZChcbiAgICB7XG4gICAgICB1cmw6IHBlbmRpbmcuYmFzZVVybCxcbiAgICAgIHNhdmVBczogZmFsc2UsXG4gICAgICBjb25mbGljdEFjdGlvbjogJ3VuaXF1aWZ5JyxcbiAgICB9LFxuICAgIChkb3dubG9hZElkKSA9PiB7XG4gICAgICBpZiAoY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yIHx8ICFkb3dubG9hZElkKSB7XG4gICAgICAgIGNsZWFudXAocGVuZGluZyk7XG4gICAgICAgIHJlc3BvbmRPbmNlPy4oe1xuICAgICAgICAgIHN0YXJ0ZWQ6IGZhbHNlLFxuICAgICAgICAgIHVzZXJNZXNzYWdlOiAnQnJvd3NlciBibG9ja2VkIGRvd25sb2FkLicsXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBwZW5kaW5nLmN1cnJlbnREb3dubG9hZElkID0gZG93bmxvYWRJZDtcbiAgICAgIHBlbmRpbmdCeURvd25sb2FkSWQuc2V0KGRvd25sb2FkSWQsIHBlbmRpbmcpO1xuICAgICAgcmVzcG9uZE9uY2U/Lih7XG4gICAgICAgIHN0YXJ0ZWQ6IHRydWUsXG4gICAgICAgIHJlcXVlc3RJZDogcGVuZGluZy5yZXF1ZXN0SWQsXG4gICAgICAgIGRvd25sb2FkSWQsXG4gICAgICB9KTtcbiAgICB9LFxuICApO1xufVxuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiBEcml2ZSBhdXRodXNlciBsb29wICgwLi45KVxuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuZnVuY3Rpb24gc3RhcnROZXh0RHJpdmVBdHRlbXB0KHBlbmRpbmc6IFBlbmRpbmdEb3dubG9hZCkge1xuICAvLyBSZXNldCBwZXItYXR0ZW1wdCBIVE1MIC8gZmFsbGJhY2sgc3RhdGUuXG4gIC8vIE90aGVyd2lzZSwgYSA0MDMgc2VlbiBvbiBhIHByZXZpb3VzIGF1dGh1c2VyIHdvdWxkIGNhdXNlIHVzXG4gIC8vIHRvIHNraXAgdGhlIERyaXZlIHRhYiBmb3IgZnV0dXJlIEhUTUwgcmVzcG9uc2VzIChpbmNsdWRpbmdcbiAgLy8gbGFyZ2UtZmlsZSB2aXJ1cyB3YXJuaW5ncyksIGJyZWFraW5nIGJpZyBkb3dubG9hZHMuXG4gIHBlbmRpbmcuaHRtbFNlZW4gPSBmYWxzZTtcbiAgcGVuZGluZy5mYWxsYmFja1N0YXJ0ZWQgPSBmYWxzZTtcbiAgcGVuZGluZy5jb25maXJtZWQ0MDMgPSBmYWxzZTtcblxuICBjb25zdCBuZXh0QXV0aCA9IEFVVEhVU0VSX0NBTkRJREFURVMuZmluZChcbiAgICAobikgPT4gIXBlbmRpbmcuYXR0ZW1wdGVkQXV0aFVzZXJzLmluY2x1ZGVzKG4pLFxuICApO1xuXG4gIGlmIChuZXh0QXV0aCA9PSBudWxsKSB7XG4gICAgY29uc29sZS5sb2coJ1tDUURdIEFsbCBhdXRodXNlcnMgZmFpbGVkLicpO1xuICAgIHNlbmRTdGF0dXNUb1RhYihcbiAgICAgIHBlbmRpbmcsXG4gICAgICAnZXJyb3InLFxuICAgICAgJ0FjY2VzcyBkZW5pZWQgZm9yIGFsbCBhY2NvdW50cy4nLFxuICAgICAgJ0FVVEhfQUxMX0ZBSUxFRCcsXG4gICAgKTtcbiAgICBjbGVhbnVwKHBlbmRpbmcpO1xuICAgIHJldHVybjtcbiAgfVxuXG4gIHBlbmRpbmcuYXR0ZW1wdGVkQXV0aFVzZXJzLnB1c2gobmV4dEF1dGgpO1xuICBwZW5kaW5nLmN1cnJlbnRBdXRoVXNlciA9IG5leHRBdXRoO1xuXG4gIGNvbnN0IGF0dGVtcHRVcmwgPSBidWlsZFVybFdpdGhBdXRoVXNlcihwZW5kaW5nLmJhc2VVcmwsIG5leHRBdXRoKTtcbiAgY29uc29sZS5sb2coJ1tDUURdIExvb3BpbmcgYXV0aHVzZXI9JywgbmV4dEF1dGgpO1xuXG4gIGNocm9tZS5kb3dubG9hZHMuZG93bmxvYWQoXG4gICAge1xuICAgICAgdXJsOiBhdHRlbXB0VXJsLFxuICAgICAgc2F2ZUFzOiBmYWxzZSxcbiAgICAgIGNvbmZsaWN0QWN0aW9uOiAndW5pcXVpZnknLFxuICAgIH0sXG4gICAgKGRvd25sb2FkSWQpID0+IHtcbiAgICAgIGlmIChjaHJvbWUucnVudGltZS5sYXN0RXJyb3IgfHwgIWRvd25sb2FkSWQpIHtcbiAgICAgICAgLy8gSW1tZWRpYXRlIGZhaWwgLT4gdHJ5IG5leHQgYXV0aHVzZXJcbiAgICAgICAgc3RhcnROZXh0RHJpdmVBdHRlbXB0KHBlbmRpbmcpO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG4gICAgICBwZW5kaW5nLmN1cnJlbnREb3dubG9hZElkID0gZG93bmxvYWRJZDtcbiAgICAgIHBlbmRpbmdCeURvd25sb2FkSWQuc2V0KGRvd25sb2FkSWQsIHBlbmRpbmcpO1xuICAgIH0sXG4gICk7XG59XG5cbi8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEhlbHBlcnNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmZ1bmN0aW9uIG9wZW5Ecml2ZUJ5cGFzc1RhYihwZW5kaW5nOiBQZW5kaW5nRG93bmxvYWQsIHVybDogc3RyaW5nKSB7XG4gIGNvbnNvbGUubG9nKCdbQ1FEXSBPcGVuaW5nIERyaXZlIGJ5cGFzcyB0YWI6JywgdXJsKTtcbiAgY2hyb21lLnRhYnMuY3JlYXRlKHsgdXJsLCBhY3RpdmU6IGZhbHNlIH0sICh0YWIpID0+IHtcbiAgICBpZiAodGFiPy5pZCAhPSBudWxsKSB7XG4gICAgICBwZW5kaW5nQnlCeXBhc3NUYWJJZC5zZXQodGFiLmlkLCBwZW5kaW5nKTtcbiAgICB9XG4gIH0pO1xufVxuXG5mdW5jdGlvbiBub3JtYWxpemVVcmwocmF3VXJsOiBzdHJpbmcpOiB7IGJhc2VVcmw6IHN0cmluZzsgaXNEcml2ZTogYm9vbGVhbiB9IHtcbiAgdHJ5IHtcbiAgICBjb25zdCB1cmwgPSBuZXcgVVJMKHJhd1VybCk7XG4gICAgY29uc3QgaXNEcml2ZSA9IHVybC5ob3N0bmFtZS5pbmNsdWRlcygnZHJpdmUnKTtcbiAgICBpZiAoIWlzRHJpdmUpIHJldHVybiB7IGJhc2VVcmw6IHJhd1VybCwgaXNEcml2ZTogZmFsc2UgfTtcblxuICAgIHVybC5zZWFyY2hQYXJhbXMuZGVsZXRlKCdhdXRodXNlcicpO1xuXG4gICAgaWYgKHVybC5wYXRobmFtZS5pbmNsdWRlcygnL29wZW4nKSkge1xuICAgICAgdXJsLnBhdGhuYW1lID0gJy91Yyc7XG4gICAgfVxuICAgIGlmICghdXJsLnNlYXJjaFBhcmFtcy5oYXMoJ2V4cG9ydCcpKSB7XG4gICAgICB1cmwuc2VhcmNoUGFyYW1zLnNldCgnZXhwb3J0JywgJ2Rvd25sb2FkJyk7XG4gICAgfVxuXG4gICAgcmV0dXJuIHsgYmFzZVVybDogdXJsLnRvU3RyaW5nKCksIGlzRHJpdmU6IHRydWUgfTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHsgYmFzZVVybDogcmF3VXJsLCBpc0RyaXZlOiBmYWxzZSB9O1xuICB9XG59XG5cbmZ1bmN0aW9uIGJ1aWxkVXJsV2l0aEF1dGhVc2VyKGJhc2VVcmw6IHN0cmluZywgYXV0aHVzZXI6IG51bWJlcik6IHN0cmluZyB7XG4gIHRyeSB7XG4gICAgY29uc3QgdXJsID0gbmV3IFVSTChiYXNlVXJsKTtcbiAgICB1cmwuc2VhcmNoUGFyYW1zLnNldCgnYXV0aHVzZXInLCBTdHJpbmcoYXV0aHVzZXIpKTtcbiAgICByZXR1cm4gdXJsLnRvU3RyaW5nKCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBiYXNlVXJsO1xuICB9XG59XG5cbmZ1bmN0aW9uIGNsZWFudXAocGVuZGluZzogUGVuZGluZ0Rvd25sb2FkLCBkb3dubG9hZElkPzogbnVtYmVyKSB7XG4gIHBlbmRpbmdCeVJlcXVlc3RJZC5kZWxldGUocGVuZGluZy5yZXF1ZXN0SWQpO1xuICBpZiAoZG93bmxvYWRJZCAhPSBudWxsKSB7XG4gICAgcGVuZGluZ0J5RG93bmxvYWRJZC5kZWxldGUoZG93bmxvYWRJZCk7XG4gICAgY2FuY2VsbGVkQnlVcy5kZWxldGUoZG93bmxvYWRJZCk7XG4gIH1cbiAgZm9yIChjb25zdCBbdXJsLCBwXSBvZiBwZW5kaW5nQnlVcmwuZW50cmllcygpKSB7XG4gICAgaWYgKHAucmVxdWVzdElkID09PSBwZW5kaW5nLnJlcXVlc3RJZCkge1xuICAgICAgcGVuZGluZ0J5VXJsLmRlbGV0ZSh1cmwpO1xuICAgIH1cbiAgfVxuICBmb3IgKGNvbnN0IFt0YWJJZCwgcF0gb2YgcGVuZGluZ0J5QnlwYXNzVGFiSWQuZW50cmllcygpKSB7XG4gICAgaWYgKHAucmVxdWVzdElkID09PSBwZW5kaW5nLnJlcXVlc3RJZCkge1xuICAgICAgcGVuZGluZ0J5QnlwYXNzVGFiSWQuZGVsZXRlKHRhYklkKTtcbiAgICAgIHRyeSB7XG4gICAgICAgIGNocm9tZS50YWJzLnJlbW92ZSh0YWJJZCk7XG4gICAgICB9IGNhdGNoIHtcbiAgICAgICAgLyogaWdub3JlICovXG4gICAgICB9XG4gICAgfVxuICB9XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVuYW1lRXh0KGZpbGVuYW1lPzogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKCFmaWxlbmFtZSkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgY29uc3QgbSA9IGZpbGVuYW1lLm1hdGNoKC9cXC4oW2EtekEtWjAtOV17MSw2fSkkLyk7XG4gIHJldHVybiBtID8gbVsxXS50b0xvd2VyQ2FzZSgpIDogdW5kZWZpbmVkO1xufVxuXG5mdW5jdGlvbiBzZW5kU3RhdHVzVG9UYWIoXG4gIHBlbmRpbmc6IFBlbmRpbmdEb3dubG9hZCxcbiAgc3RhdHVzOiBEb3dubG9hZFN0YXR1cyxcbiAgdXNlck1lc3NhZ2U/OiBzdHJpbmcsXG4gIGVycm9yQ29kZT86IHN0cmluZyxcbik6IHZvaWQge1xuICBpZiAocGVuZGluZy5maW5hbGl6ZWQgJiYgc3RhdHVzID09PSAnc3VjY2VzcycpIHJldHVybjtcbiAgaWYgKHN0YXR1cyA9PT0gJ3N1Y2Nlc3MnKSBwZW5kaW5nLmZpbmFsaXplZCA9IHRydWU7XG4gIGlmIChwZW5kaW5nLnRhYklkID09IG51bGwpIHJldHVybjtcblxuICB0cnkge1xuICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHBlbmRpbmcudGFiSWQsIHtcbiAgICAgIHR5cGU6ICdDUURfRE9XTkxPQURfU1RBVFVTJyxcbiAgICAgIHJlcXVlc3RJZDogcGVuZGluZy5yZXF1ZXN0SWQsXG4gICAgICBzdGF0dXMsXG4gICAgICBlcnJvckNvZGUsXG4gICAgICB1c2VyTWVzc2FnZSxcbiAgICB9KTtcbiAgfSBjYXRjaCB7XG4gICAgLyogaWdub3JlICovXG4gIH1cbn1cbiIsIi8vICNyZWdpb24gc25pcHBldFxuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBnbG9iYWxUaGlzLmJyb3dzZXI/LnJ1bnRpbWU/LmlkXG4gID8gZ2xvYmFsVGhpcy5icm93c2VyXG4gIDogZ2xvYmFsVGhpcy5jaHJvbWU7XG4vLyAjZW5kcmVnaW9uIHNuaXBwZXRcbiIsImltcG9ydCB7IGJyb3dzZXIgYXMgX2Jyb3dzZXIgfSBmcm9tIFwiQHd4dC1kZXYvYnJvd3NlclwiO1xuZXhwb3J0IGNvbnN0IGJyb3dzZXIgPSBfYnJvd3NlcjtcbmV4cG9ydCB7fTtcbiIsIi8vIHNyYy9pbmRleC50c1xudmFyIF9NYXRjaFBhdHRlcm4gPSBjbGFzcyB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybikge1xuICAgIGlmIChtYXRjaFBhdHRlcm4gPT09IFwiPGFsbF91cmxzPlwiKSB7XG4gICAgICB0aGlzLmlzQWxsVXJscyA9IHRydWU7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IFsuLi5fTWF0Y2hQYXR0ZXJuLlBST1RPQ09MU107XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBcIipcIjtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgIH0gZWxzZSB7XG4gICAgICBjb25zdCBncm91cHMgPSAvKC4qKTpcXC9cXC8oLio/KShcXC8uKikvLmV4ZWMobWF0Y2hQYXR0ZXJuKTtcbiAgICAgIGlmIChncm91cHMgPT0gbnVsbClcbiAgICAgICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBcIkluY29ycmVjdCBmb3JtYXRcIik7XG4gICAgICBjb25zdCBbXywgcHJvdG9jb2wsIGhvc3RuYW1lLCBwYXRobmFtZV0gPSBncm91cHM7XG4gICAgICB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpO1xuICAgICAgdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKTtcbiAgICAgIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSk7XG4gICAgICB0aGlzLnByb3RvY29sTWF0Y2hlcyA9IHByb3RvY29sID09PSBcIipcIiA/IFtcImh0dHBcIiwgXCJodHRwc1wiXSA6IFtwcm90b2NvbF07XG4gICAgICB0aGlzLmhvc3RuYW1lTWF0Y2ggPSBob3N0bmFtZTtcbiAgICAgIHRoaXMucGF0aG5hbWVNYXRjaCA9IHBhdGhuYW1lO1xuICAgIH1cbiAgfVxuICBpbmNsdWRlcyh1cmwpIHtcbiAgICBpZiAodGhpcy5pc0FsbFVybHMpXG4gICAgICByZXR1cm4gdHJ1ZTtcbiAgICBjb25zdCB1ID0gdHlwZW9mIHVybCA9PT0gXCJzdHJpbmdcIiA/IG5ldyBVUkwodXJsKSA6IHVybCBpbnN0YW5jZW9mIExvY2F0aW9uID8gbmV3IFVSTCh1cmwuaHJlZikgOiB1cmw7XG4gICAgcmV0dXJuICEhdGhpcy5wcm90b2NvbE1hdGNoZXMuZmluZCgocHJvdG9jb2wpID0+IHtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJodHRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBzXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzSHR0cHNNYXRjaCh1KTtcbiAgICAgIGlmIChwcm90b2NvbCA9PT0gXCJmaWxlXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRmlsZU1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZ0cFwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc0Z0cE1hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcInVyblwiKVxuICAgICAgICByZXR1cm4gdGhpcy5pc1Vybk1hdGNoKHUpO1xuICAgIH0pO1xuICB9XG4gIGlzSHR0cE1hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cDpcIiAmJiB0aGlzLmlzSG9zdFBhdGhNYXRjaCh1cmwpO1xuICB9XG4gIGlzSHR0cHNNYXRjaCh1cmwpIHtcbiAgICByZXR1cm4gdXJsLnByb3RvY29sID09PSBcImh0dHBzOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIb3N0UGF0aE1hdGNoKHVybCkge1xuICAgIGlmICghdGhpcy5ob3N0bmFtZU1hdGNoIHx8ICF0aGlzLnBhdGhuYW1lTWF0Y2gpXG4gICAgICByZXR1cm4gZmFsc2U7XG4gICAgY29uc3QgaG9zdG5hbWVNYXRjaFJlZ2V4cyA9IFtcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaCksXG4gICAgICB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLmhvc3RuYW1lTWF0Y2gucmVwbGFjZSgvXlxcKlxcLi8sIFwiXCIpKVxuICAgIF07XG4gICAgY29uc3QgcGF0aG5hbWVNYXRjaFJlZ2V4ID0gdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5wYXRobmFtZU1hdGNoKTtcbiAgICByZXR1cm4gISFob3N0bmFtZU1hdGNoUmVnZXhzLmZpbmQoKHJlZ2V4KSA9PiByZWdleC50ZXN0KHVybC5ob3N0bmFtZSkpICYmIHBhdGhuYW1lTWF0Y2hSZWdleC50ZXN0KHVybC5wYXRobmFtZSk7XG4gIH1cbiAgaXNGaWxlTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZpbGU6Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGlzRnRwTWF0Y2godXJsKSB7XG4gICAgdGhyb3cgRXJyb3IoXCJOb3QgaW1wbGVtZW50ZWQ6IGZ0cDovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNVcm5NYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogdXJuOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBjb252ZXJ0UGF0dGVyblRvUmVnZXgocGF0dGVybikge1xuICAgIGNvbnN0IGVzY2FwZWQgPSB0aGlzLmVzY2FwZUZvclJlZ2V4KHBhdHRlcm4pO1xuICAgIGNvbnN0IHN0YXJzUmVwbGFjZWQgPSBlc2NhcGVkLnJlcGxhY2UoL1xcXFxcXCovZywgXCIuKlwiKTtcbiAgICByZXR1cm4gUmVnRXhwKGBeJHtzdGFyc1JlcGxhY2VkfSRgKTtcbiAgfVxuICBlc2NhcGVGb3JSZWdleChzdHJpbmcpIHtcbiAgICByZXR1cm4gc3RyaW5nLnJlcGxhY2UoL1suKis/XiR7fSgpfFtcXF1cXFxcXS9nLCBcIlxcXFwkJlwiKTtcbiAgfVxufTtcbnZhciBNYXRjaFBhdHRlcm4gPSBfTWF0Y2hQYXR0ZXJuO1xuTWF0Y2hQYXR0ZXJuLlBST1RPQ09MUyA9IFtcImh0dHBcIiwgXCJodHRwc1wiLCBcImZpbGVcIiwgXCJmdHBcIiwgXCJ1cm5cIl07XG52YXIgSW52YWxpZE1hdGNoUGF0dGVybiA9IGNsYXNzIGV4dGVuZHMgRXJyb3Ige1xuICBjb25zdHJ1Y3RvcihtYXRjaFBhdHRlcm4sIHJlYXNvbikge1xuICAgIHN1cGVyKGBJbnZhbGlkIG1hdGNoIHBhdHRlcm4gXCIke21hdGNoUGF0dGVybn1cIjogJHtyZWFzb259YCk7XG4gIH1cbn07XG5mdW5jdGlvbiB2YWxpZGF0ZVByb3RvY29sKG1hdGNoUGF0dGVybiwgcHJvdG9jb2wpIHtcbiAgaWYgKCFNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmluY2x1ZGVzKHByb3RvY29sKSAmJiBwcm90b2NvbCAhPT0gXCIqXCIpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgJHtwcm90b2NvbH0gbm90IGEgdmFsaWQgcHJvdG9jb2wgKCR7TWF0Y2hQYXR0ZXJuLlBST1RPQ09MUy5qb2luKFwiLCBcIil9KWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVIb3N0bmFtZShtYXRjaFBhdHRlcm4sIGhvc3RuYW1lKSB7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIjpcIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4obWF0Y2hQYXR0ZXJuLCBgSG9zdG5hbWUgY2Fubm90IGluY2x1ZGUgYSBwb3J0YCk7XG4gIGlmIChob3N0bmFtZS5pbmNsdWRlcyhcIipcIikgJiYgaG9zdG5hbWUubGVuZ3RoID4gMSAmJiAhaG9zdG5hbWUuc3RhcnRzV2l0aChcIiouXCIpKVxuICAgIHRocm93IG5ldyBJbnZhbGlkTWF0Y2hQYXR0ZXJuKFxuICAgICAgbWF0Y2hQYXR0ZXJuLFxuICAgICAgYElmIHVzaW5nIGEgd2lsZGNhcmQgKCopLCBpdCBtdXN0IGdvIGF0IHRoZSBzdGFydCBvZiB0aGUgaG9zdG5hbWVgXG4gICAgKTtcbn1cbmZ1bmN0aW9uIHZhbGlkYXRlUGF0aG5hbWUobWF0Y2hQYXR0ZXJuLCBwYXRobmFtZSkge1xuICByZXR1cm47XG59XG5leHBvcnQge1xuICBJbnZhbGlkTWF0Y2hQYXR0ZXJuLFxuICBNYXRjaFBhdHRlcm5cbn07XG4iXSwibmFtZXMiOlsiYnJvd3NlciIsIl9icm93c2Vy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
