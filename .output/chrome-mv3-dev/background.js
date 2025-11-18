var background = (function() {
  "use strict";
  function defineBackground(arg) {
    if (arg == null || typeof arg === "function") return { main: arg };
    return arg;
  }
  const pendingByRequestId = /* @__PURE__ */ new Map();
  const pendingByDownloadId = /* @__PURE__ */ new Map();
  const definition = defineBackground(() => {
    console.log("[CQD] Background ready");
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
      const pending = pendingByDownloadId.get(item.id);
      if (!pending) {
        suggest();
        return;
      }
      const mime = item.mime || "";
      const expectedExt = pending.fileMeta?.ext?.toLowerCase();
      const host = safeHostname(item.url);
      const isGoogleHost = host === "drive.google.com" || host === "classroom.google.com";
      if (isGoogleHost && mime.toLowerCase().startsWith("text/html") && expectedExt && expectedExt !== "html" && expectedExt !== "htm") {
        chrome.downloads.cancel(item.id, () => {
          void (async () => {
            const resolved = await tryResolveDriveVirusInterstitial(item.url);
            if (resolved?.ok) {
              chrome.downloads.download(
                {
                  url: resolved.finalUrl,
                  saveAs: false,
                  conflictAction: "uniquify"
                },
                (newId) => {
                  const err = chrome.runtime.lastError;
                  if (err || newId == null) {
                    const msg = "Google returned a web page instead of the file, and Quick Downloader could not bypass it.";
                    sendStatusToTab(
                      pending,
                      "blocked_html",
                      msg,
                      "BLOCKED_HTML"
                    );
                    pendingByRequestId.delete(pending.requestId);
                    pendingByDownloadId.delete(item.id);
                    return;
                  }
                  pendingByDownloadId.delete(item.id);
                  pendingByDownloadId.set(newId, pending);
                }
              );
            } else {
              const msg = 'Google returned a web page instead of the file. Open the attachment once in a normal tab (to login or click "Download anyway"), then try again.';
              sendStatusToTab(pending, "blocked_html", msg, "BLOCKED_HTML");
              pendingByRequestId.delete(pending.requestId);
              pendingByDownloadId.delete(item.id);
            }
          })();
        });
        suggest({ filename: item.filename });
        return;
      }
      suggest({ filename: item.filename });
    });
    chrome.downloads.onChanged.addListener((delta) => {
      const pending = pendingByDownloadId.get(delta.id);
      if (!pending) return;
      if (delta.state && delta.state.current === "complete") {
        sendStatusToTab(pending, "complete");
        pendingByDownloadId.delete(delta.id);
        pendingByRequestId.delete(pending.requestId);
        return;
      }
      if (delta.state && delta.state.current === "interrupted") {
        const errCode = delta.error?.current || "UNKNOWN";
        const userMessage = userMessageForDownloadError(errCode, pending);
        sendStatusToTab(pending, "interrupted", userMessage, errCode);
        pendingByDownloadId.delete(delta.id);
        pendingByRequestId.delete(pending.requestId);
      }
    });
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      if (!message || message.type !== "CQD_DOWNLOAD") {
        return;
      }
      const rawUrl = typeof message.url === "string" ? message.url : null;
      const requestId = typeof message.requestId === "string" ? message.requestId : `req-${Date.now()}`;
      const fileMeta = message.fileMeta;
      if (!rawUrl) {
        sendResponse?.({
          started: false,
          requestId,
          userMessage: "This attachment does not have a valid download link."
        });
        return;
      }
      if (!chrome.downloads || typeof chrome.downloads.download !== "function") {
        sendResponse?.({
          started: false,
          requestId,
          userMessage: "Your browser does not allow background downloads for this extension."
        });
        return;
      }
      const tabId = sender.tab?.id;
      const url = rawUrl;
      chrome.downloads.download(
        {
          url,
          saveAs: false,
          conflictAction: "uniquify"
        },
        (downloadId) => {
          const err = chrome.runtime.lastError;
          if (err || downloadId === void 0 || downloadId === null) {
            console.warn("[CQD] downloads.download error:", err?.message);
            sendResponse?.({
              started: false,
              requestId,
              userMessage: "The browser could not start the download. Try again or open the attachment normally."
            });
            return;
          }
          const pending = {
            requestId,
            url,
            fileMeta,
            tabId
          };
          pendingByRequestId.set(requestId, pending);
          pendingByDownloadId.set(downloadId, pending);
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
  function safeHostname(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return void 0;
    }
  }
  async function tryResolveDriveVirusInterstitial(url) {
    const host = safeHostname(url);
    if (host !== "drive.google.com") return null;
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        credentials: "include"
      });
      const finalHost = safeHostname(res.url || url);
      if (finalHost !== "drive.google.com") {
        return { ok: false };
      }
      const text = await res.text();
      const match = text.match(/href="(\/uc\?[^"]*?export=download[^"]*?confirm=[^"]*?id=[^"]+?)"/) || text.match(
        /href="(https:\/\/drive\.google\.com\/uc\?[^"]*?export=download[^"]*?confirm=[^"]*?id=[^"]+?)"/
      );
      if (!match) {
        return { ok: false };
      }
      const confirmUrl = new URL(
        match[1],
        "https://drive.google.com"
      ).toString();
      return { ok: true, finalUrl: confirmUrl };
    } catch (e) {
      console.warn("[CQD] tryResolveDriveVirusInterstitial failed:", e);
      return { ok: false };
    }
  }
  function userMessageForDownloadError(errorCode, pending) {
    const displayName = pending.fileMeta?.name ? `"${pending.fileMeta.name}"` : "this file";
    switch (errorCode) {
      case "NETWORK_FAILED":
      case "NETWORK_TIMEOUT":
      case "NETWORK_DISCONNECTED":
        return `Your internet connection dropped or Google could not be reached while downloading ${displayName}. Try again.`;
      case "SERVER_FORBIDDEN":
      case "SERVER_UNAUTHORIZED":
        return `Google says you do not have permission to download ${displayName}. Open it once normally or request access, then try again.`;
      case "USER_CANCELED":
        return "You cancelled this download from the browser.";
      case "INSUFFICIENT_SPACE":
        return "Your device does not have enough space to finish this download.";
      default:
        return "The download was interrupted by the browser. Try again or open the attachment normally in a tab.";
    }
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
    } catch (e) {
      console.warn("[CQD] sendStatusToTab failed:", e);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUyLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL2VudHJ5cG9pbnRzL2JhY2tncm91bmQudHMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHd4dC1kZXYrYnJvd3NlckAwLjEuNC9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUyLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L2Jyb3dzZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3ZWJleHQtY29yZSttYXRjaC1wYXR0ZXJuc0AxLjAuMy9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL21hdGNoLXBhdHRlcm5zL2xpYi9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQmFja2dyb3VuZChhcmcpIHtcbiAgaWYgKGFyZyA9PSBudWxsIHx8IHR5cGVvZiBhcmcgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHsgbWFpbjogYXJnIH07XG4gIHJldHVybiBhcmc7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvYmFja2dyb3VuZC50c1xudHlwZSBGaWxlTWV0YU1zZyA9IHtcbiAgbmFtZT86IHN0cmluZztcbiAgZXh0Pzogc3RyaW5nO1xuICBraW5kPzogc3RyaW5nO1xufTtcblxudHlwZSBQZW5kaW5nRG93bmxvYWQgPSB7XG4gIHJlcXVlc3RJZDogc3RyaW5nO1xuICB1cmw6IHN0cmluZztcbiAgZmlsZU1ldGE/OiBGaWxlTWV0YU1zZztcbiAgdGFiSWQ/OiBudW1iZXI7XG59O1xuXG50eXBlIERvd25sb2FkU3RhdHVzID0gJ2NvbXBsZXRlJyB8ICdpbnRlcnJ1cHRlZCcgfCAnYmxvY2tlZF9odG1sJztcblxuY29uc3QgcGVuZGluZ0J5UmVxdWVzdElkID0gbmV3IE1hcDxzdHJpbmcsIFBlbmRpbmdEb3dubG9hZD4oKTtcbmNvbnN0IHBlbmRpbmdCeURvd25sb2FkSWQgPSBuZXcgTWFwPG51bWJlciwgUGVuZGluZ0Rvd25sb2FkPigpO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcbiAgY29uc29sZS5sb2coJ1tDUURdIEJhY2tncm91bmQgcmVhZHknKTtcblxuICAvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogZG93bmxvYWRzLm9uRGV0ZXJtaW5pbmdGaWxlbmFtZVxuICAgKiAgLT4gYmxvY2sgdW5leHBlY3RlZCBIVE1MIGFuZCBvcHRpb25hbGx5XG4gICAqICAgICB0cnkgdG8gYXV0by1yZXNvbHZlIERyaXZlIFwiRG93bmxvYWQgYW55d2F5XCJcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4gIGNocm9tZS5kb3dubG9hZHMub25EZXRlcm1pbmluZ0ZpbGVuYW1lLmFkZExpc3RlbmVyKChpdGVtLCBzdWdnZXN0KSA9PiB7XG4gICAgY29uc3QgcGVuZGluZyA9IHBlbmRpbmdCeURvd25sb2FkSWQuZ2V0KGl0ZW0uaWQpO1xuICAgIGlmICghcGVuZGluZykge1xuICAgICAgc3VnZ2VzdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG1pbWUgPSBpdGVtLm1pbWUgfHwgJyc7XG4gICAgY29uc3QgZXhwZWN0ZWRFeHQgPSBwZW5kaW5nLmZpbGVNZXRhPy5leHQ/LnRvTG93ZXJDYXNlKCk7XG4gICAgY29uc3QgaG9zdCA9IHNhZmVIb3N0bmFtZShpdGVtLnVybCk7XG5cbiAgICAvLyBXZSBvbmx5IGNhcmUgYWJvdXQgR29vZ2xlIERyaXZlIC8gQ2xhc3Nyb29tIEhUTUwgd2VpcmRuZXNzXG4gICAgY29uc3QgaXNHb29nbGVIb3N0ID1cbiAgICAgIGhvc3QgPT09ICdkcml2ZS5nb29nbGUuY29tJyB8fCBob3N0ID09PSAnY2xhc3Nyb29tLmdvb2dsZS5jb20nO1xuXG4gICAgaWYgKFxuICAgICAgaXNHb29nbGVIb3N0ICYmXG4gICAgICBtaW1lLnRvTG93ZXJDYXNlKCkuc3RhcnRzV2l0aCgndGV4dC9odG1sJykgJiZcbiAgICAgIGV4cGVjdGVkRXh0ICYmXG4gICAgICBleHBlY3RlZEV4dCAhPT0gJ2h0bWwnICYmXG4gICAgICBleHBlY3RlZEV4dCAhPT0gJ2h0bSdcbiAgICApIHtcbiAgICAgIC8vIENhbmNlbCB0aGlzIEhUTUwgZG93bmxvYWQ7IHRyeSB0byByZXNvbHZlIGEgcmVhbCBmaWxlIFVSTC5cbiAgICAgIGNocm9tZS5kb3dubG9hZHMuY2FuY2VsKGl0ZW0uaWQsICgpID0+IHtcbiAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgdHJ5UmVzb2x2ZURyaXZlVmlydXNJbnRlcnN0aXRpYWwoaXRlbS51cmwpO1xuXG4gICAgICAgICAgaWYgKHJlc29sdmVkPy5vaykge1xuICAgICAgICAgICAgY2hyb21lLmRvd25sb2Fkcy5kb3dubG9hZChcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIHVybDogcmVzb2x2ZWQuZmluYWxVcmwsXG4gICAgICAgICAgICAgICAgc2F2ZUFzOiBmYWxzZSxcbiAgICAgICAgICAgICAgICBjb25mbGljdEFjdGlvbjogJ3VuaXF1aWZ5JyxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgKG5ld0lkKSA9PiB7XG4gICAgICAgICAgICAgICAgY29uc3QgZXJyID0gY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yO1xuICAgICAgICAgICAgICAgIGlmIChlcnIgfHwgbmV3SWQgPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgY29uc3QgbXNnID1cbiAgICAgICAgICAgICAgICAgICAgJ0dvb2dsZSByZXR1cm5lZCBhIHdlYiBwYWdlIGluc3RlYWQgb2YgdGhlIGZpbGUsIGFuZCBRdWljayBEb3dubG9hZGVyIGNvdWxkIG5vdCBieXBhc3MgaXQuJztcbiAgICAgICAgICAgICAgICAgIHNlbmRTdGF0dXNUb1RhYihcbiAgICAgICAgICAgICAgICAgICAgcGVuZGluZyxcbiAgICAgICAgICAgICAgICAgICAgJ2Jsb2NrZWRfaHRtbCcsXG4gICAgICAgICAgICAgICAgICAgIG1zZyxcbiAgICAgICAgICAgICAgICAgICAgJ0JMT0NLRURfSFRNTCcsXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgcGVuZGluZ0J5UmVxdWVzdElkLmRlbGV0ZShwZW5kaW5nLnJlcXVlc3RJZCk7XG4gICAgICAgICAgICAgICAgICBwZW5kaW5nQnlEb3dubG9hZElkLmRlbGV0ZShpdGVtLmlkKTtcbiAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBSZS1iaW5kIHRoaXMgcGVuZGluZyBkb3dubG9hZCB0byB0aGUgbmV3IGlkXG4gICAgICAgICAgICAgICAgcGVuZGluZ0J5RG93bmxvYWRJZC5kZWxldGUoaXRlbS5pZCk7XG4gICAgICAgICAgICAgICAgcGVuZGluZ0J5RG93bmxvYWRJZC5zZXQobmV3SWQsIHBlbmRpbmcpO1xuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgKTtcbiAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgY29uc3QgbXNnID1cbiAgICAgICAgICAgICAgJ0dvb2dsZSByZXR1cm5lZCBhIHdlYiBwYWdlIGluc3RlYWQgb2YgdGhlIGZpbGUuIE9wZW4gdGhlIGF0dGFjaG1lbnQgb25jZSBpbiBhIG5vcm1hbCB0YWIgKHRvIGxvZ2luIG9yIGNsaWNrIFwiRG93bmxvYWQgYW55d2F5XCIpLCB0aGVuIHRyeSBhZ2Fpbi4nO1xuICAgICAgICAgICAgc2VuZFN0YXR1c1RvVGFiKHBlbmRpbmcsICdibG9ja2VkX2h0bWwnLCBtc2csICdCTE9DS0VEX0hUTUwnKTtcbiAgICAgICAgICAgIHBlbmRpbmdCeVJlcXVlc3RJZC5kZWxldGUocGVuZGluZy5yZXF1ZXN0SWQpO1xuICAgICAgICAgICAgcGVuZGluZ0J5RG93bmxvYWRJZC5kZWxldGUoaXRlbS5pZCk7XG4gICAgICAgICAgfVxuICAgICAgICB9KSgpO1xuICAgICAgfSk7XG5cbiAgICAgIHN1Z2dlc3QoeyBmaWxlbmFtZTogaXRlbS5maWxlbmFtZSB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICAvLyBOb3JtYWwgcGF0aCDigJMganVzdCBhY2NlcHQgQ2hyb21l4oCZcyBmaWxlbmFtZSBjaG9pY2VcbiAgICBzdWdnZXN0KHsgZmlsZW5hbWU6IGl0ZW0uZmlsZW5hbWUgfSk7XG4gIH0pO1xuXG4gIC8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBkb3dubG9hZHMub25DaGFuZ2VkXG4gICAqICAtPiBjb21wbGV0aW9uIC8gbmV0d29yayAvIGF1dGggZXJyb3JzXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuICBjaHJvbWUuZG93bmxvYWRzLm9uQ2hhbmdlZC5hZGRMaXN0ZW5lcigoZGVsdGEpID0+IHtcbiAgICBjb25zdCBwZW5kaW5nID0gcGVuZGluZ0J5RG93bmxvYWRJZC5nZXQoZGVsdGEuaWQpO1xuICAgIGlmICghcGVuZGluZykgcmV0dXJuO1xuXG4gICAgaWYgKGRlbHRhLnN0YXRlICYmIGRlbHRhLnN0YXRlLmN1cnJlbnQgPT09ICdjb21wbGV0ZScpIHtcbiAgICAgIHNlbmRTdGF0dXNUb1RhYihwZW5kaW5nLCAnY29tcGxldGUnKTtcbiAgICAgIHBlbmRpbmdCeURvd25sb2FkSWQuZGVsZXRlKGRlbHRhLmlkKTtcbiAgICAgIHBlbmRpbmdCeVJlcXVlc3RJZC5kZWxldGUocGVuZGluZy5yZXF1ZXN0SWQpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmIChkZWx0YS5zdGF0ZSAmJiBkZWx0YS5zdGF0ZS5jdXJyZW50ID09PSAnaW50ZXJydXB0ZWQnKSB7XG4gICAgICBjb25zdCBlcnJDb2RlID0gZGVsdGEuZXJyb3I/LmN1cnJlbnQgfHwgJ1VOS05PV04nO1xuICAgICAgY29uc3QgdXNlck1lc3NhZ2UgPSB1c2VyTWVzc2FnZUZvckRvd25sb2FkRXJyb3IoZXJyQ29kZSwgcGVuZGluZyk7XG4gICAgICBzZW5kU3RhdHVzVG9UYWIocGVuZGluZywgJ2ludGVycnVwdGVkJywgdXNlck1lc3NhZ2UsIGVyckNvZGUpO1xuICAgICAgcGVuZGluZ0J5RG93bmxvYWRJZC5kZWxldGUoZGVsdGEuaWQpO1xuICAgICAgcGVuZGluZ0J5UmVxdWVzdElkLmRlbGV0ZShwZW5kaW5nLnJlcXVlc3RJZCk7XG4gICAgfVxuICB9KTtcblxuICAvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogcnVudGltZS5vbk1lc3NhZ2U6IENRRF9ET1dOTE9BRFxuICAgKiAgLT4gc3RhcnQgZG93bmxvYWQgdmlhIGNocm9tZS5kb3dubG9hZHNcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4gIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICBpZiAoIW1lc3NhZ2UgfHwgbWVzc2FnZS50eXBlICE9PSAnQ1FEX0RPV05MT0FEJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHJhd1VybCA9IHR5cGVvZiBtZXNzYWdlLnVybCA9PT0gJ3N0cmluZycgPyBtZXNzYWdlLnVybCA6IG51bGw7XG4gICAgY29uc3QgcmVxdWVzdElkID1cbiAgICAgIHR5cGVvZiBtZXNzYWdlLnJlcXVlc3RJZCA9PT0gJ3N0cmluZydcbiAgICAgICAgPyBtZXNzYWdlLnJlcXVlc3RJZFxuICAgICAgICA6IGByZXEtJHtEYXRlLm5vdygpfWA7XG4gICAgY29uc3QgZmlsZU1ldGE6IEZpbGVNZXRhTXNnIHwgdW5kZWZpbmVkID0gbWVzc2FnZS5maWxlTWV0YTtcblxuICAgIGlmICghcmF3VXJsKSB7XG4gICAgICBzZW5kUmVzcG9uc2U/Lih7XG4gICAgICAgIHN0YXJ0ZWQ6IGZhbHNlLFxuICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgIHVzZXJNZXNzYWdlOiAnVGhpcyBhdHRhY2htZW50IGRvZXMgbm90IGhhdmUgYSB2YWxpZCBkb3dubG9hZCBsaW5rLicsXG4gICAgICB9KTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBpZiAoIWNocm9tZS5kb3dubG9hZHMgfHwgdHlwZW9mIGNocm9tZS5kb3dubG9hZHMuZG93bmxvYWQgIT09ICdmdW5jdGlvbicpIHtcbiAgICAgIHNlbmRSZXNwb25zZT8uKHtcbiAgICAgICAgc3RhcnRlZDogZmFsc2UsXG4gICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgdXNlck1lc3NhZ2U6XG4gICAgICAgICAgJ1lvdXIgYnJvd3NlciBkb2VzIG5vdCBhbGxvdyBiYWNrZ3JvdW5kIGRvd25sb2FkcyBmb3IgdGhpcyBleHRlbnNpb24uJyxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhYklkID0gc2VuZGVyLnRhYj8uaWQ7XG4gICAgY29uc3QgdXJsID0gcmF3VXJsO1xuXG4gICAgY2hyb21lLmRvd25sb2Fkcy5kb3dubG9hZChcbiAgICAgIHtcbiAgICAgICAgdXJsLFxuICAgICAgICBzYXZlQXM6IGZhbHNlLFxuICAgICAgICBjb25mbGljdEFjdGlvbjogJ3VuaXF1aWZ5JyxcbiAgICAgIH0sXG4gICAgICAoZG93bmxvYWRJZCkgPT4ge1xuICAgICAgICBjb25zdCBlcnIgPSBjaHJvbWUucnVudGltZS5sYXN0RXJyb3I7XG4gICAgICAgIGlmIChlcnIgfHwgZG93bmxvYWRJZCA9PT0gdW5kZWZpbmVkIHx8IGRvd25sb2FkSWQgPT09IG51bGwpIHtcbiAgICAgICAgICBjb25zb2xlLndhcm4oJ1tDUURdIGRvd25sb2Fkcy5kb3dubG9hZCBlcnJvcjonLCBlcnI/Lm1lc3NhZ2UpO1xuICAgICAgICAgIHNlbmRSZXNwb25zZT8uKHtcbiAgICAgICAgICAgIHN0YXJ0ZWQ6IGZhbHNlLFxuICAgICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgICAgdXNlck1lc3NhZ2U6XG4gICAgICAgICAgICAgICdUaGUgYnJvd3NlciBjb3VsZCBub3Qgc3RhcnQgdGhlIGRvd25sb2FkLiBUcnkgYWdhaW4gb3Igb3BlbiB0aGUgYXR0YWNobWVudCBub3JtYWxseS4nLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHBlbmRpbmc6IFBlbmRpbmdEb3dubG9hZCA9IHtcbiAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgdXJsLFxuICAgICAgICAgIGZpbGVNZXRhLFxuICAgICAgICAgIHRhYklkLFxuICAgICAgICB9O1xuXG4gICAgICAgIHBlbmRpbmdCeVJlcXVlc3RJZC5zZXQocmVxdWVzdElkLCBwZW5kaW5nKTtcbiAgICAgICAgcGVuZGluZ0J5RG93bmxvYWRJZC5zZXQoZG93bmxvYWRJZCwgcGVuZGluZyk7XG5cbiAgICAgICAgc2VuZFJlc3BvbnNlPy4oe1xuICAgICAgICAgIHN0YXJ0ZWQ6IHRydWUsXG4gICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgIGRvd25sb2FkSWQsXG4gICAgICAgIH0pO1xuICAgICAgfSxcbiAgICApO1xuXG4gICAgcmV0dXJuIHRydWU7IC8vIGtlZXAgY2hhbm5lbCBvcGVuIGZvciBhc3luYyBzZW5kUmVzcG9uc2VcbiAgfSk7XG59KTtcblxuLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqIEhlbHBlcnNcbiAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmZ1bmN0aW9uIHNhZmVIb3N0bmFtZSh1cmw6IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIHRyeSB7XG4gICAgcmV0dXJuIG5ldyBVUkwodXJsKS5ob3N0bmFtZTtcbiAgfSBjYXRjaCB7XG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB0cnlSZXNvbHZlRHJpdmVWaXJ1c0ludGVyc3RpdGlhbChcbiAgdXJsOiBzdHJpbmcsXG4pOiBQcm9taXNlPHsgb2s6IHRydWU7IGZpbmFsVXJsOiBzdHJpbmcgfSB8IHsgb2s6IGZhbHNlIH0gfCBudWxsPiB7XG4gIGNvbnN0IGhvc3QgPSBzYWZlSG9zdG5hbWUodXJsKTtcbiAgaWYgKGhvc3QgIT09ICdkcml2ZS5nb29nbGUuY29tJykgcmV0dXJuIG51bGw7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICByZWRpcmVjdDogJ2ZvbGxvdycsXG4gICAgICBjcmVkZW50aWFsczogJ2luY2x1ZGUnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZmluYWxIb3N0ID0gc2FmZUhvc3RuYW1lKHJlcy51cmwgfHwgdXJsKTtcbiAgICBpZiAoZmluYWxIb3N0ICE9PSAnZHJpdmUuZ29vZ2xlLmNvbScpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSB9O1xuICAgIH1cblxuICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXMudGV4dCgpO1xuXG4gICAgLy8gTG9vayBmb3IgdGhlIFwiRG93bmxvYWQgYW55d2F5XCIgY29uZmlybSBsaW5rXG4gICAgY29uc3QgbWF0Y2ggPVxuICAgICAgdGV4dC5tYXRjaCgvaHJlZj1cIihcXC91Y1xcP1teXCJdKj9leHBvcnQ9ZG93bmxvYWRbXlwiXSo/Y29uZmlybT1bXlwiXSo/aWQ9W15cIl0rPylcIi8pIHx8XG4gICAgICB0ZXh0Lm1hdGNoKFxuICAgICAgICAvaHJlZj1cIihodHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL3VjXFw/W15cIl0qP2V4cG9ydD1kb3dubG9hZFteXCJdKj9jb25maXJtPVteXCJdKj9pZD1bXlwiXSs/KVwiLyxcbiAgICAgICk7XG5cbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UgfTtcbiAgICB9XG5cbiAgICBjb25zdCBjb25maXJtVXJsID0gbmV3IFVSTChcbiAgICAgIG1hdGNoWzFdLFxuICAgICAgJ2h0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbScsXG4gICAgKS50b1N0cmluZygpO1xuXG4gICAgcmV0dXJuIHsgb2s6IHRydWUsIGZpbmFsVXJsOiBjb25maXJtVXJsIH07XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLndhcm4oJ1tDUURdIHRyeVJlc29sdmVEcml2ZVZpcnVzSW50ZXJzdGl0aWFsIGZhaWxlZDonLCBlKTtcbiAgICByZXR1cm4geyBvazogZmFsc2UgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiB1c2VyTWVzc2FnZUZvckRvd25sb2FkRXJyb3IoXG4gIGVycm9yQ29kZTogc3RyaW5nLFxuICBwZW5kaW5nOiBQZW5kaW5nRG93bmxvYWQsXG4pOiBzdHJpbmcge1xuICBjb25zdCBkaXNwbGF5TmFtZSA9IHBlbmRpbmcuZmlsZU1ldGE/Lm5hbWVcbiAgICA/IGBcIiR7cGVuZGluZy5maWxlTWV0YS5uYW1lfVwiYFxuICAgIDogJ3RoaXMgZmlsZSc7XG5cbiAgc3dpdGNoIChlcnJvckNvZGUpIHtcbiAgICBjYXNlICdORVRXT1JLX0ZBSUxFRCc6XG4gICAgY2FzZSAnTkVUV09SS19USU1FT1VUJzpcbiAgICBjYXNlICdORVRXT1JLX0RJU0NPTk5FQ1RFRCc6XG4gICAgICByZXR1cm4gYFlvdXIgaW50ZXJuZXQgY29ubmVjdGlvbiBkcm9wcGVkIG9yIEdvb2dsZSBjb3VsZCBub3QgYmUgcmVhY2hlZCB3aGlsZSBkb3dubG9hZGluZyAke2Rpc3BsYXlOYW1lfS4gVHJ5IGFnYWluLmA7XG4gICAgY2FzZSAnU0VSVkVSX0ZPUkJJRERFTic6XG4gICAgY2FzZSAnU0VSVkVSX1VOQVVUSE9SSVpFRCc6XG4gICAgICByZXR1cm4gYEdvb2dsZSBzYXlzIHlvdSBkbyBub3QgaGF2ZSBwZXJtaXNzaW9uIHRvIGRvd25sb2FkICR7ZGlzcGxheU5hbWV9LiBPcGVuIGl0IG9uY2Ugbm9ybWFsbHkgb3IgcmVxdWVzdCBhY2Nlc3MsIHRoZW4gdHJ5IGFnYWluLmA7XG4gICAgY2FzZSAnVVNFUl9DQU5DRUxFRCc6XG4gICAgICByZXR1cm4gJ1lvdSBjYW5jZWxsZWQgdGhpcyBkb3dubG9hZCBmcm9tIHRoZSBicm93c2VyLic7XG4gICAgY2FzZSAnSU5TVUZGSUNJRU5UX1NQQUNFJzpcbiAgICAgIHJldHVybiAnWW91ciBkZXZpY2UgZG9lcyBub3QgaGF2ZSBlbm91Z2ggc3BhY2UgdG8gZmluaXNoIHRoaXMgZG93bmxvYWQuJztcbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuICdUaGUgZG93bmxvYWQgd2FzIGludGVycnVwdGVkIGJ5IHRoZSBicm93c2VyLiBUcnkgYWdhaW4gb3Igb3BlbiB0aGUgYXR0YWNobWVudCBub3JtYWxseSBpbiBhIHRhYi4nO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNlbmRTdGF0dXNUb1RhYihcbiAgcGVuZGluZzogUGVuZGluZ0Rvd25sb2FkLFxuICBzdGF0dXM6IERvd25sb2FkU3RhdHVzLFxuICB1c2VyTWVzc2FnZT86IHN0cmluZyxcbiAgZXJyb3JDb2RlPzogc3RyaW5nLFxuKTogdm9pZCB7XG4gIGlmIChwZW5kaW5nLnRhYklkID09IG51bGwpIHJldHVybjtcblxuICB0cnkge1xuICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHBlbmRpbmcudGFiSWQsIHtcbiAgICAgIHR5cGU6ICdDUURfRE9XTkxPQURfU1RBVFVTJyxcbiAgICAgIHJlcXVlc3RJZDogcGVuZGluZy5yZXF1ZXN0SWQsXG4gICAgICBzdGF0dXMsXG4gICAgICBlcnJvckNvZGUsXG4gICAgICB1c2VyTWVzc2FnZSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybignW0NRRF0gc2VuZFN0YXR1c1RvVGFiIGZhaWxlZDonLCBlKTtcbiAgfVxufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJuYW1lcyI6WyJicm93c2VyIiwiX2Jyb3dzZXIiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxpQkFBaUIsS0FBSztBQUNwQyxRQUFJLE9BQU8sUUFBUSxPQUFPLFFBQVEsV0FBWSxRQUFP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QUFBLElBQ25GO0FBQUEsSUFDQSxXQUFXLEtBQUs7QUFDZCxZQUFNLE1BQU0sb0VBQW9FO0FBQUEsSUFDbEY7QUFBQSxJQUNBLFdBQVcsS0FBSztBQUNkLFlBQU0sTUFBTSxvRUFBb0U7QUFBQSxJQUNsRjtBQUFBLElBQ0Esc0JBQXNCLFNBQVM7QUFDN0IsWUFBTSxVQUFVLEtBQUssZUFBZSxPQUFPO0FBQzNDLFlBQU0sZ0JBQWdCLFFBQVEsUUFBUSxTQUFTLElBQUk7QUFDbkQsYUFBTyxPQUFPLElBQUksYUFBYSxHQUFHO0FBQUEsSUFDcEM7QUFBQSxJQUNBLGVBQWUsUUFBUTtBQUNyQixhQUFPLE9BQU8sUUFBUSx1QkFBdUIsTUFBTTtBQUFBLElBQ3JEO0FBQUEsRUFDRjtBQUNBLE1BQUksZUFBZTtBQUNuQixlQUFhLFlBQVksQ0FBQyxRQUFRLFNBQVMsUUFBUSxPQUFPLEtBQUs7QUFDL0QsTUFBSSxzQkFBc0IsY0FBYyxNQUFNO0FBQUEsSUFDNUMsWUFBWSxjQUFjLFFBQVE7QUFDaEMsWUFBTSwwQkFBMEIsWUFBWSxNQUFNLE1BQU0sRUFBRTtBQUFBLElBQzVEO0FBQUEsRUFDRjtBQUNBLFdBQVMsaUJBQWlCLGNBQWMsVUFBVTtBQUNoRCxRQUFJLENBQUMsYUFBYSxVQUFVLFNBQVMsUUFBUSxLQUFLLGFBQWE7QUFDN0QsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0EsR0FBRyxRQUFRLDBCQUEwQixhQUFhLFVBQVUsS0FBSyxJQUFJLENBQUM7QUFBQSxNQUM1RTtBQUFBLEVBQ0E7QUFDQSxXQUFTLGlCQUFpQixjQUFjLFVBQVU7QUFDaEQsUUFBSSxTQUFTLFNBQVMsR0FBRztBQUN2QixZQUFNLElBQUksb0JBQW9CLGNBQWMsZ0NBQWdDO0FBQzlFLFFBQUksU0FBUyxTQUFTLEdBQUcsS0FBSyxTQUFTLFNBQVMsS0FBSyxDQUFDLFNBQVMsV0FBVyxJQUFJO0FBQzVFLFlBQU0sSUFBSTtBQUFBLFFBQ1I7QUFBQSxRQUNBO0FBQUEsTUFDTjtBQUFBLEVBQ0E7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OzsiLCJ4X2dvb2dsZV9pZ25vcmVMaXN0IjpbMCwyLDMsNF19
