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
      const mime = (item.mime || "").toLowerCase();
      const expectedExt = pending.fileMeta?.ext?.toLowerCase();
      const expectedKind = pending.fileMeta?.kind;
      const actualExt = getFilenameExt(item.filename);
      const host = safeHostname(item.url);
      const isGoogleHost = host === "drive.google.com" || host === "classroom.google.com";
      const weExpectHtml = expectedKind === "html" || expectedExt === "html" || expectedExt === "htm";
      const looksLikeHtml = mime.startsWith("text/html") || actualExt === "html" || actualExt === "htm";
      if (isGoogleHost && looksLikeHtml && !weExpectHtml && (expectedExt || expectedKind)) {
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
              const msg = 'Google returned a web page instead of the file. Open the attachment once in a normal tab (to login, grant access, or click "Download anyway"), then try again.';
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
      (async () => {
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
        const preflight = await preflightUrl(url, fileMeta);
        if (!preflight.ok) {
          sendResponse?.({
            started: false,
            requestId,
            userMessage: preflight.userMessage
          });
          return;
        }
        const finalUrl = preflight.url;
        chrome.downloads.download(
          {
            url: finalUrl,
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
              url: finalUrl,
              fileMeta,
              tabId
            };
            pendingByRequestId.set(requestId, pending);
            pendingByDownloadId.set(downloadId, pending);
            setTimeout(() => {
              const stillPending = pendingByRequestId.get(requestId);
              if (!stillPending) return;
              sendStatusToTab(
                stillPending,
                "interrupted",
                "The download is taking unusually long. Check your Downloads list or try again.",
                "TIMEOUT_WATCHDOG"
              );
              pendingByRequestId.delete(requestId);
              for (const [id, p] of pendingByDownloadId.entries()) {
                if (p.requestId === requestId) {
                  pendingByDownloadId.delete(id);
                }
              }
            }, 5 * 60 * 1e3);
            sendResponse?.({
              started: true,
              requestId,
              downloadId
            });
          }
        );
      })();
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
  async function preflightUrl(url, fileMeta) {
    const host = safeHostname(url);
    if (!host) {
      return { ok: true, url };
    }
    const isGoogleHost = host === "drive.google.com" || host === "classroom.google.com";
    if (!isGoogleHost) {
      return { ok: true, url };
    }
    const displayName = fileMeta?.name ? `"${fileMeta.name}"` : "this file";
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        credentials: "include",
        headers: {
          // Ask only for the first ~1KB so we don't pull full files.
          Range: "bytes=0-1023"
        }
      });
      const status = res.status;
      const finalUrl = res.url || url;
      const finalHost = safeHostname(finalUrl) ?? host;
      const contentType = (res.headers.get("content-type") || "").toLowerCase();
      if (status === 401) {
        return {
          ok: false,
          userMessage: `You need to log in to your Google account before downloading ${displayName}. Open it normally in a tab, sign in, then try again.`
        };
      }
      if (status === 403) {
        return {
          ok: false,
          userMessage: `Google says you don't have permission to download ${displayName}. Open it normally to request access or switch to an account with access, then try again.`
        };
      }
      if (contentType.startsWith("text/html")) {
        const text = await res.text();
        const snippet = text.slice(0, 4e3);
        if (finalHost === "accounts.google.com") {
          return {
            ok: false,
            userMessage: "Google needs you to complete a sign-in or permission screen before this file can be downloaded. Open it normally in a tab, finish the login/permission flow, then try again."
          };
        }
        if (/you need access|request access|ask for access/i.test(snippet)) {
          return {
            ok: false,
            userMessage: `Google shows a "You need access" page for ${displayName}. Open it normally, request access, wait for approval, then try again.`
          };
        }
      }
      return { ok: true, url: finalUrl };
    } catch (e) {
      console.warn("[CQD] preflightUrl failed:", e);
      return { ok: true, url };
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
      // -------- FILE SYSTEM / DISK PROBLEMS --------
      case "FILE_NO_SPACE":
        return "Your device does not have enough space to finish this download. Free up some space, then try again.";
      case "FILE_ACCESS_DENIED":
        return "The browser was not allowed to save this file. Check your Downloads folder permissions or try another folder.";
      case "FILE_FAILED":
        return `The browser ran into a problem while saving ${displayName}. Try again or restart the browser.`;
      case "FILE_NAME_TOO_LONG":
        return "The file name is too long for your operating system. Try renaming the attachment in Google Drive and then download again.";
      case "FILE_TOO_LARGE":
        return `${displayName} is too large for the browser or file system to handle. Try downloading it directly from Google Drive.`;
      case "FILE_VIRUS_INFECTED":
      case "FILE_BLOCKED":
      case "FILE_SECURITY_CHECK_FAILED":
        return `${displayName} was blocked as potentially unsafe. Check your browser’s Downloads list for more details.`;
      // -------- NETWORK PROBLEMS --------
      case "NETWORK_FAILED":
      case "NETWORK_TIMEOUT":
      case "NETWORK_DISCONNECTED":
        return `Your internet connection dropped or became unstable while downloading ${displayName}. Check your connection, then try again.`;
      case "NETWORK_SERVER_DOWN":
        return "Google’s servers could not be reached while downloading this file. Try again in a few minutes.";
      // -------- SERVER / HTTP PROBLEMS --------
      case "SERVER_FAILED":
      case "SERVER_BAD_CONTENT":
        return `Google had a problem sending ${displayName}. Try again later.`;
      case "SERVER_NO_RANGE":
        return `The server does not support resuming or partial downloads for ${displayName}. Try downloading it directly from Google Drive.`;
      case "SERVER_UNAUTHORIZED":
      case "SERVER_FORBIDDEN":
        return `Google says you do not have permission to download ${displayName}. Open it once normally (to login or request access), then try again.`;
      // -------- USER / BROWSER ACTIONS --------
      case "USER_CANCELED":
        return "You cancelled this download from the browser.";
      case "CRASH":
        return "The browser process handling the download crashed. Reopen the browser and try again.";
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
  function getFilenameExt(filename) {
    if (!filename) return void 0;
    const m = filename.match(/\.([a-zA-Z0-9]{1,6})$/);
    return m ? m[1].toLowerCase() : void 0;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUyLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL2VudHJ5cG9pbnRzL2JhY2tncm91bmQudHMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHd4dC1kZXYrYnJvd3NlckAwLjEuNC9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUyLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L2Jyb3dzZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3ZWJleHQtY29yZSttYXRjaC1wYXR0ZXJuc0AxLjAuMy9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL21hdGNoLXBhdHRlcm5zL2xpYi9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQmFja2dyb3VuZChhcmcpIHtcbiAgaWYgKGFyZyA9PSBudWxsIHx8IHR5cGVvZiBhcmcgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHsgbWFpbjogYXJnIH07XG4gIHJldHVybiBhcmc7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvYmFja2dyb3VuZC50c1xudHlwZSBGaWxlTWV0YU1zZyA9IHtcbiAgbmFtZT86IHN0cmluZztcbiAgZXh0Pzogc3RyaW5nO1xuICBraW5kPzogc3RyaW5nO1xufTtcblxudHlwZSBQZW5kaW5nRG93bmxvYWQgPSB7XG4gIHJlcXVlc3RJZDogc3RyaW5nO1xuICB1cmw6IHN0cmluZztcbiAgZmlsZU1ldGE/OiBGaWxlTWV0YU1zZztcbiAgdGFiSWQ/OiBudW1iZXI7XG59O1xuXG50eXBlIERvd25sb2FkU3RhdHVzID0gJ2NvbXBsZXRlJyB8ICdpbnRlcnJ1cHRlZCcgfCAnYmxvY2tlZF9odG1sJztcblxuY29uc3QgcGVuZGluZ0J5UmVxdWVzdElkID0gbmV3IE1hcDxzdHJpbmcsIFBlbmRpbmdEb3dubG9hZD4oKTtcbmNvbnN0IHBlbmRpbmdCeURvd25sb2FkSWQgPSBuZXcgTWFwPG51bWJlciwgUGVuZGluZ0Rvd25sb2FkPigpO1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVCYWNrZ3JvdW5kKCgpID0+IHtcbiAgY29uc29sZS5sb2coJ1tDUURdIEJhY2tncm91bmQgcmVhZHknKTtcblxuICAvKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAgICogZG93bmxvYWRzLm9uRGV0ZXJtaW5pbmdGaWxlbmFtZVxuICAgKiAgLT4gYmxvY2sgdW5leHBlY3RlZCBIVE1MIGFuZCBvcHRpb25hbGx5XG4gICAqICAgICB0cnkgdG8gYXV0by1yZXNvbHZlIERyaXZlIFwiRG93bmxvYWQgYW55d2F5XCJcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4gIGNocm9tZS5kb3dubG9hZHMub25EZXRlcm1pbmluZ0ZpbGVuYW1lLmFkZExpc3RlbmVyKChpdGVtLCBzdWdnZXN0KSA9PiB7XG4gICAgY29uc3QgcGVuZGluZyA9IHBlbmRpbmdCeURvd25sb2FkSWQuZ2V0KGl0ZW0uaWQpO1xuICAgIGlmICghcGVuZGluZykge1xuICAgICAgc3VnZ2VzdCgpO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IG1pbWUgPSAoaXRlbS5taW1lIHx8ICcnKS50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGV4cGVjdGVkRXh0ID0gcGVuZGluZy5maWxlTWV0YT8uZXh0Py50b0xvd2VyQ2FzZSgpO1xuICAgIGNvbnN0IGV4cGVjdGVkS2luZCA9IHBlbmRpbmcuZmlsZU1ldGE/LmtpbmQ7XG4gICAgY29uc3QgYWN0dWFsRXh0ID0gZ2V0RmlsZW5hbWVFeHQoaXRlbS5maWxlbmFtZSk7XG4gICAgY29uc3QgaG9zdCA9IHNhZmVIb3N0bmFtZShpdGVtLnVybCk7XG5cbiAgICBjb25zdCBpc0dvb2dsZUhvc3QgPVxuICAgICAgaG9zdCA9PT0gJ2RyaXZlLmdvb2dsZS5jb20nIHx8IGhvc3QgPT09ICdjbGFzc3Jvb20uZ29vZ2xlLmNvbSc7XG5cbiAgICBjb25zdCB3ZUV4cGVjdEh0bWwgPVxuICAgICAgZXhwZWN0ZWRLaW5kID09PSAnaHRtbCcgfHxcbiAgICAgIGV4cGVjdGVkRXh0ID09PSAnaHRtbCcgfHxcbiAgICAgIGV4cGVjdGVkRXh0ID09PSAnaHRtJztcblxuICAgIGNvbnN0IGxvb2tzTGlrZUh0bWwgPVxuICAgICAgbWltZS5zdGFydHNXaXRoKCd0ZXh0L2h0bWwnKSB8fFxuICAgICAgYWN0dWFsRXh0ID09PSAnaHRtbCcgfHxcbiAgICAgIGFjdHVhbEV4dCA9PT0gJ2h0bSc7XG5cbiAgICAvLyBPbmx5IGJsb2NrIGlmIHdlIGhhdmUgc29tZSBleHBlY3RhdGlvbiAoZXh0IG9yIGtpbmQpXG4gICAgaWYgKFxuICAgICAgaXNHb29nbGVIb3N0ICYmXG4gICAgICBsb29rc0xpa2VIdG1sICYmXG4gICAgICAhd2VFeHBlY3RIdG1sICYmXG4gICAgICAoZXhwZWN0ZWRFeHQgfHwgZXhwZWN0ZWRLaW5kKVxuICAgICkge1xuICAgICAgLy8gQ2FuY2VsIHRoaXMgSFRNTCBkb3dubG9hZDsgdHJ5IHRvIHJlc29sdmUgYSByZWFsIGZpbGUgVVJMLlxuICAgICAgY2hyb21lLmRvd25sb2Fkcy5jYW5jZWwoaXRlbS5pZCwgKCkgPT4ge1xuICAgICAgICB2b2lkIChhc3luYyAoKSA9PiB7XG4gICAgICAgICAgY29uc3QgcmVzb2x2ZWQgPSBhd2FpdCB0cnlSZXNvbHZlRHJpdmVWaXJ1c0ludGVyc3RpdGlhbChpdGVtLnVybCk7XG5cbiAgICAgICAgICBpZiAocmVzb2x2ZWQ/Lm9rKSB7XG4gICAgICAgICAgICBjaHJvbWUuZG93bmxvYWRzLmRvd25sb2FkKFxuICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgdXJsOiByZXNvbHZlZC5maW5hbFVybCxcbiAgICAgICAgICAgICAgICBzYXZlQXM6IGZhbHNlLFxuICAgICAgICAgICAgICAgIGNvbmZsaWN0QWN0aW9uOiAndW5pcXVpZnknLFxuICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAobmV3SWQpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zdCBlcnIgPSBjaHJvbWUucnVudGltZS5sYXN0RXJyb3I7XG4gICAgICAgICAgICAgICAgaWYgKGVyciB8fCBuZXdJZCA9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICBjb25zdCBtc2cgPVxuICAgICAgICAgICAgICAgICAgICAnR29vZ2xlIHJldHVybmVkIGEgd2ViIHBhZ2UgaW5zdGVhZCBvZiB0aGUgZmlsZSwgYW5kIFF1aWNrIERvd25sb2FkZXIgY291bGQgbm90IGJ5cGFzcyBpdC4nO1xuICAgICAgICAgICAgICAgICAgc2VuZFN0YXR1c1RvVGFiKFxuICAgICAgICAgICAgICAgICAgICBwZW5kaW5nLFxuICAgICAgICAgICAgICAgICAgICAnYmxvY2tlZF9odG1sJyxcbiAgICAgICAgICAgICAgICAgICAgbXNnLFxuICAgICAgICAgICAgICAgICAgICAnQkxPQ0tFRF9IVE1MJyxcbiAgICAgICAgICAgICAgICAgICk7XG4gICAgICAgICAgICAgICAgICBwZW5kaW5nQnlSZXF1ZXN0SWQuZGVsZXRlKHBlbmRpbmcucmVxdWVzdElkKTtcbiAgICAgICAgICAgICAgICAgIHBlbmRpbmdCeURvd25sb2FkSWQuZGVsZXRlKGl0ZW0uaWQpO1xuICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIFJlLWJpbmQgdGhpcyBwZW5kaW5nIGRvd25sb2FkIHRvIHRoZSBuZXcgaWRcbiAgICAgICAgICAgICAgICBwZW5kaW5nQnlEb3dubG9hZElkLmRlbGV0ZShpdGVtLmlkKTtcbiAgICAgICAgICAgICAgICBwZW5kaW5nQnlEb3dubG9hZElkLnNldChuZXdJZCwgcGVuZGluZyk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBtc2cgPVxuICAgICAgICAgICAgICAnR29vZ2xlIHJldHVybmVkIGEgd2ViIHBhZ2UgaW5zdGVhZCBvZiB0aGUgZmlsZS4gT3BlbiB0aGUgYXR0YWNobWVudCBvbmNlIGluIGEgbm9ybWFsIHRhYiAodG8gbG9naW4sIGdyYW50IGFjY2Vzcywgb3IgY2xpY2sgXCJEb3dubG9hZCBhbnl3YXlcIiksIHRoZW4gdHJ5IGFnYWluLic7XG4gICAgICAgICAgICBzZW5kU3RhdHVzVG9UYWIocGVuZGluZywgJ2Jsb2NrZWRfaHRtbCcsIG1zZywgJ0JMT0NLRURfSFRNTCcpO1xuICAgICAgICAgICAgcGVuZGluZ0J5UmVxdWVzdElkLmRlbGV0ZShwZW5kaW5nLnJlcXVlc3RJZCk7XG4gICAgICAgICAgICBwZW5kaW5nQnlEb3dubG9hZElkLmRlbGV0ZShpdGVtLmlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pKCk7XG4gICAgICB9KTtcblxuICAgICAgc3VnZ2VzdCh7IGZpbGVuYW1lOiBpdGVtLmZpbGVuYW1lIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIE5vcm1hbCBwYXRoIOKAkyBqdXN0IGFjY2VwdCBDaHJvbWXigJlzIGZpbGVuYW1lIGNob2ljZVxuICAgIHN1Z2dlc3QoeyBmaWxlbmFtZTogaXRlbS5maWxlbmFtZSB9KTtcbiAgfSk7XG5cbiAgLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIGRvd25sb2Fkcy5vbkNoYW5nZWRcbiAgICogIC0+IGNvbXBsZXRpb24gLyBuZXR3b3JrIC8gYXV0aCBlcnJvcnNcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4gIGNocm9tZS5kb3dubG9hZHMub25DaGFuZ2VkLmFkZExpc3RlbmVyKChkZWx0YSkgPT4ge1xuICAgIGNvbnN0IHBlbmRpbmcgPSBwZW5kaW5nQnlEb3dubG9hZElkLmdldChkZWx0YS5pZCk7XG4gICAgaWYgKCFwZW5kaW5nKSByZXR1cm47XG5cbiAgICBpZiAoZGVsdGEuc3RhdGUgJiYgZGVsdGEuc3RhdGUuY3VycmVudCA9PT0gJ2NvbXBsZXRlJykge1xuICAgICAgc2VuZFN0YXR1c1RvVGFiKHBlbmRpbmcsICdjb21wbGV0ZScpO1xuICAgICAgcGVuZGluZ0J5RG93bmxvYWRJZC5kZWxldGUoZGVsdGEuaWQpO1xuICAgICAgcGVuZGluZ0J5UmVxdWVzdElkLmRlbGV0ZShwZW5kaW5nLnJlcXVlc3RJZCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGRlbHRhLnN0YXRlICYmIGRlbHRhLnN0YXRlLmN1cnJlbnQgPT09ICdpbnRlcnJ1cHRlZCcpIHtcbiAgICAgIGNvbnN0IGVyckNvZGUgPSBkZWx0YS5lcnJvcj8uY3VycmVudCB8fCAnVU5LTk9XTic7XG4gICAgICBjb25zdCB1c2VyTWVzc2FnZSA9IHVzZXJNZXNzYWdlRm9yRG93bmxvYWRFcnJvcihlcnJDb2RlLCBwZW5kaW5nKTtcbiAgICAgIHNlbmRTdGF0dXNUb1RhYihwZW5kaW5nLCAnaW50ZXJydXB0ZWQnLCB1c2VyTWVzc2FnZSwgZXJyQ29kZSk7XG4gICAgICBwZW5kaW5nQnlEb3dubG9hZElkLmRlbGV0ZShkZWx0YS5pZCk7XG4gICAgICBwZW5kaW5nQnlSZXF1ZXN0SWQuZGVsZXRlKHBlbmRpbmcucmVxdWVzdElkKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBydW50aW1lLm9uTWVzc2FnZTogQ1FEX0RPV05MT0FEXG4gICAqICAtPiBwcmVmbGlnaHQgY2hlY2ssIHRoZW4gc3RhcnQgZG93bmxvYWRcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4gIGNocm9tZS5ydW50aW1lLm9uTWVzc2FnZS5hZGRMaXN0ZW5lcigobWVzc2FnZSwgc2VuZGVyLCBzZW5kUmVzcG9uc2UpID0+IHtcbiAgICBpZiAoIW1lc3NhZ2UgfHwgbWVzc2FnZS50eXBlICE9PSAnQ1FEX0RPV05MT0FEJykge1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHJhd1VybCA9IHR5cGVvZiBtZXNzYWdlLnVybCA9PT0gJ3N0cmluZycgPyBtZXNzYWdlLnVybCA6IG51bGw7XG4gICAgY29uc3QgcmVxdWVzdElkID1cbiAgICAgIHR5cGVvZiBtZXNzYWdlLnJlcXVlc3RJZCA9PT0gJ3N0cmluZydcbiAgICAgICAgPyBtZXNzYWdlLnJlcXVlc3RJZFxuICAgICAgICA6IGByZXEtJHtEYXRlLm5vdygpfWA7XG4gICAgY29uc3QgZmlsZU1ldGE6IEZpbGVNZXRhTXNnIHwgdW5kZWZpbmVkID0gbWVzc2FnZS5maWxlTWV0YTtcblxuICAgIC8vIFdyYXAgdGhlIHdob2xlIGZsb3cgaW4gYW4gYXN5bmMgSUlGRSBzbyB3ZSBjYW4gdXNlIGF3YWl0LlxuICAgIChhc3luYyAoKSA9PiB7XG4gICAgICBpZiAoIXJhd1VybCkge1xuICAgICAgICBzZW5kUmVzcG9uc2U/Lih7XG4gICAgICAgICAgc3RhcnRlZDogZmFsc2UsXG4gICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgIHVzZXJNZXNzYWdlOiAnVGhpcyBhdHRhY2htZW50IGRvZXMgbm90IGhhdmUgYSB2YWxpZCBkb3dubG9hZCBsaW5rLicsXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGlmICghY2hyb21lLmRvd25sb2FkcyB8fCB0eXBlb2YgY2hyb21lLmRvd25sb2Fkcy5kb3dubG9hZCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgICBzZW5kUmVzcG9uc2U/Lih7XG4gICAgICAgICAgc3RhcnRlZDogZmFsc2UsXG4gICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgIHVzZXJNZXNzYWdlOlxuICAgICAgICAgICAgJ1lvdXIgYnJvd3NlciBkb2VzIG5vdCBhbGxvdyBiYWNrZ3JvdW5kIGRvd25sb2FkcyBmb3IgdGhpcyBleHRlbnNpb24uJyxcbiAgICAgICAgfSk7XG4gICAgICAgIHJldHVybjtcbiAgICAgIH1cblxuICAgICAgY29uc3QgdGFiSWQgPSBzZW5kZXIudGFiPy5pZDtcbiAgICAgIGNvbnN0IHVybCA9IHJhd1VybDtcblxuICAgICAgLy8g8J+UjSBORVc6IHByZWZsaWdodCBjaGVjayBmb3IgYXV0aCAvIEhUTUwgXCJhY2Nlc3NcIiBwYWdlc1xuICAgICAgY29uc3QgcHJlZmxpZ2h0ID0gYXdhaXQgcHJlZmxpZ2h0VXJsKHVybCwgZmlsZU1ldGEpO1xuXG4gICAgICBpZiAoIXByZWZsaWdodC5vaykge1xuICAgICAgICAvLyBGYWlsIGZhc3Q6IGRvbid0IGV2ZW4gc3RhcnQgdGhlIGRvd25sb2FkLCBqdXN0IHNob3cgYSBjbGVhciBtZXNzYWdlLlxuICAgICAgICBzZW5kUmVzcG9uc2U/Lih7XG4gICAgICAgICAgc3RhcnRlZDogZmFsc2UsXG4gICAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICAgIHVzZXJNZXNzYWdlOiBwcmVmbGlnaHQudXNlck1lc3NhZ2UsXG4gICAgICAgIH0pO1xuICAgICAgICByZXR1cm47XG4gICAgICB9XG5cbiAgICAgIGNvbnN0IGZpbmFsVXJsID0gcHJlZmxpZ2h0LnVybDtcblxuICAgICAgY2hyb21lLmRvd25sb2Fkcy5kb3dubG9hZChcbiAgICAgICAge1xuICAgICAgICAgIHVybDogZmluYWxVcmwsXG4gICAgICAgICAgc2F2ZUFzOiBmYWxzZSxcbiAgICAgICAgICBjb25mbGljdEFjdGlvbjogJ3VuaXF1aWZ5JyxcbiAgICAgICAgfSxcbiAgICAgICAgKGRvd25sb2FkSWQpID0+IHtcbiAgICAgICAgICBjb25zdCBlcnIgPSBjaHJvbWUucnVudGltZS5sYXN0RXJyb3I7XG4gICAgICAgICAgaWYgKGVyciB8fCBkb3dubG9hZElkID09PSB1bmRlZmluZWQgfHwgZG93bmxvYWRJZCA9PT0gbnVsbCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKCdbQ1FEXSBkb3dubG9hZHMuZG93bmxvYWQgZXJyb3I6JywgZXJyPy5tZXNzYWdlKTtcbiAgICAgICAgICAgIHNlbmRSZXNwb25zZT8uKHtcbiAgICAgICAgICAgICAgc3RhcnRlZDogZmFsc2UsXG4gICAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgICAgdXNlck1lc3NhZ2U6XG4gICAgICAgICAgICAgICAgJ1RoZSBicm93c2VyIGNvdWxkIG5vdCBzdGFydCB0aGUgZG93bmxvYWQuIFRyeSBhZ2FpbiBvciBvcGVuIHRoZSBhdHRhY2htZW50IG5vcm1hbGx5LicsXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICB9XG5cbiAgICAgICAgICBjb25zdCBwZW5kaW5nOiBQZW5kaW5nRG93bmxvYWQgPSB7XG4gICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICB1cmw6IGZpbmFsVXJsLFxuICAgICAgICAgICAgZmlsZU1ldGEsXG4gICAgICAgICAgICB0YWJJZCxcbiAgICAgICAgICB9O1xuXG4gICAgICAgICAgcGVuZGluZ0J5UmVxdWVzdElkLnNldChyZXF1ZXN0SWQsIHBlbmRpbmcpO1xuICAgICAgICAgIHBlbmRpbmdCeURvd25sb2FkSWQuc2V0KGRvd25sb2FkSWQsIHBlbmRpbmcpO1xuXG4gICAgICAgICAgLy8gU2ltcGxlIHdhdGNoZG9nOiBpZiBzdGlsbCBwZW5kaW5nIGFmdGVyIDUgbWludXRlcywgcmVwb3J0IHRpbWVvdXRcbiAgICAgICAgICBzZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgIGNvbnN0IHN0aWxsUGVuZGluZyA9IHBlbmRpbmdCeVJlcXVlc3RJZC5nZXQocmVxdWVzdElkKTtcbiAgICAgICAgICAgIGlmICghc3RpbGxQZW5kaW5nKSByZXR1cm47XG4gICAgICAgICAgICBzZW5kU3RhdHVzVG9UYWIoXG4gICAgICAgICAgICAgIHN0aWxsUGVuZGluZyxcbiAgICAgICAgICAgICAgJ2ludGVycnVwdGVkJyxcbiAgICAgICAgICAgICAgJ1RoZSBkb3dubG9hZCBpcyB0YWtpbmcgdW51c3VhbGx5IGxvbmcuIENoZWNrIHlvdXIgRG93bmxvYWRzIGxpc3Qgb3IgdHJ5IGFnYWluLicsXG4gICAgICAgICAgICAgICdUSU1FT1VUX1dBVENIRE9HJyxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBwZW5kaW5nQnlSZXF1ZXN0SWQuZGVsZXRlKHJlcXVlc3RJZCk7XG4gICAgICAgICAgICBmb3IgKGNvbnN0IFtpZCwgcF0gb2YgcGVuZGluZ0J5RG93bmxvYWRJZC5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgICAgaWYgKHAucmVxdWVzdElkID09PSByZXF1ZXN0SWQpIHtcbiAgICAgICAgICAgICAgICBwZW5kaW5nQnlEb3dubG9hZElkLmRlbGV0ZShpZCk7XG4gICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9LCA1ICogNjAgKiAxMDAwKTtcblxuICAgICAgICAgIHNlbmRSZXNwb25zZT8uKHtcbiAgICAgICAgICAgIHN0YXJ0ZWQ6IHRydWUsXG4gICAgICAgICAgICByZXF1ZXN0SWQsXG4gICAgICAgICAgICBkb3dubG9hZElkLFxuICAgICAgICAgIH0pO1xuICAgICAgICB9LFxuICAgICAgKTtcbiAgICB9KSgpO1xuXG4gICAgLy8gVGVsbCBDaHJvbWUgd2UnbGwgcmVzcG9uZCBhc3luY2hyb25vdXNseVxuICAgIHJldHVybiB0cnVlO1xuICB9KTtcbn0pO1xuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogSGVscGVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gc2FmZUhvc3RuYW1lKHVybDogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gbmV3IFVSTCh1cmwpLmhvc3RuYW1lO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbi8qKlxuICog8J+UjSBQcmVmbGlnaHQgYXV0aCAvIGFjY2VzcyBjaGVjay5cbiAqXG4gKiBPbmx5IHJ1bnMgZm9yIEdvb2dsZSBob3N0cyAoRHJpdmUgLyBDbGFzc3Jvb20pLlxuICogLSA0MDEgLyA0MDMg4oaSIGNsZWFyIGxvZ2luIC8gcGVybWlzc2lvbiBtZXNzYWdlcy5cbiAqIC0gdGV4dC9odG1sIGZyb20gYWNjb3VudHMuZ29vZ2xlLmNvbSBvciBcIllvdSBuZWVkIGFjY2Vzc1wiIHBhZ2Ug4oaSIGNsZWFyIGFjY2VzcyBtZXNzYWdlLlxuICogLSBPdGhlcndpc2Ug4oaSIGxldCB0aGUgbm9ybWFsIGRvd25sb2FkICsgb25EZXRlcm1pbmluZ0ZpbGVuYW1lL29uQ2hhbmdlZFxuICogICBsb2dpYyBoYW5kbGUgZXZlcnl0aGluZy5cbiAqL1xuYXN5bmMgZnVuY3Rpb24gcHJlZmxpZ2h0VXJsKFxuICB1cmw6IHN0cmluZyxcbiAgZmlsZU1ldGE/OiBGaWxlTWV0YU1zZyxcbik6IFByb21pc2U8eyBvazogdHJ1ZTsgdXJsOiBzdHJpbmcgfSB8IHsgb2s6IGZhbHNlOyB1c2VyTWVzc2FnZTogc3RyaW5nIH0+IHtcbiAgY29uc3QgaG9zdCA9IHNhZmVIb3N0bmFtZSh1cmwpO1xuICBpZiAoIWhvc3QpIHtcbiAgICAvLyBJZiB3ZSBjYW4ndCBldmVuIHBhcnNlIHRoZSBob3N0LCBmYWxsIHRocm91Z2ggdG8gbm9ybWFsIGRvd25sb2FkLlxuICAgIHJldHVybiB7IG9rOiB0cnVlLCB1cmwgfTtcbiAgfVxuXG4gIGNvbnN0IGlzR29vZ2xlSG9zdCA9XG4gICAgaG9zdCA9PT0gJ2RyaXZlLmdvb2dsZS5jb20nIHx8IGhvc3QgPT09ICdjbGFzc3Jvb20uZ29vZ2xlLmNvbSc7XG5cbiAgLy8gT25seSBwcmVmbGlnaHQgR29vZ2xlIENsYXNzcm9vbSAvIERyaXZlLiBFdmVyeXRoaW5nIGVsc2UgdXNlcyB0aGUgb2xkIHBhdGguXG4gIGlmICghaXNHb29nbGVIb3N0KSB7XG4gICAgcmV0dXJuIHsgb2s6IHRydWUsIHVybCB9O1xuICB9XG5cbiAgY29uc3QgZGlzcGxheU5hbWUgPSBmaWxlTWV0YT8ubmFtZSA/IGBcIiR7ZmlsZU1ldGEubmFtZX1cImAgOiAndGhpcyBmaWxlJztcblxuICB0cnkge1xuICAgIGNvbnN0IHJlcyA9IGF3YWl0IGZldGNoKHVybCwge1xuICAgICAgbWV0aG9kOiAnR0VUJyxcbiAgICAgIHJlZGlyZWN0OiAnZm9sbG93JyxcbiAgICAgIGNyZWRlbnRpYWxzOiAnaW5jbHVkZScsXG4gICAgICBoZWFkZXJzOiB7XG4gICAgICAgIC8vIEFzayBvbmx5IGZvciB0aGUgZmlyc3QgfjFLQiBzbyB3ZSBkb24ndCBwdWxsIGZ1bGwgZmlsZXMuXG4gICAgICAgIFJhbmdlOiAnYnl0ZXM9MC0xMDIzJyxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBzdGF0dXMgPSByZXMuc3RhdHVzO1xuICAgIGNvbnN0IGZpbmFsVXJsID0gcmVzLnVybCB8fCB1cmw7XG4gICAgY29uc3QgZmluYWxIb3N0ID0gc2FmZUhvc3RuYW1lKGZpbmFsVXJsKSA/PyBob3N0O1xuICAgIGNvbnN0IGNvbnRlbnRUeXBlID0gKHJlcy5oZWFkZXJzLmdldCgnY29udGVudC10eXBlJykgfHwgJycpLnRvTG93ZXJDYXNlKCk7XG5cbiAgICAvLyBIYXJkIGF1dGggZmFpbHVyZXNcbiAgICBpZiAoc3RhdHVzID09PSA0MDEpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgdXNlck1lc3NhZ2U6IGBZb3UgbmVlZCB0byBsb2cgaW4gdG8geW91ciBHb29nbGUgYWNjb3VudCBiZWZvcmUgZG93bmxvYWRpbmcgJHtkaXNwbGF5TmFtZX0uIE9wZW4gaXQgbm9ybWFsbHkgaW4gYSB0YWIsIHNpZ24gaW4sIHRoZW4gdHJ5IGFnYWluLmAsXG4gICAgICB9O1xuICAgIH1cblxuICAgIGlmIChzdGF0dXMgPT09IDQwMykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICB1c2VyTWVzc2FnZTogYEdvb2dsZSBzYXlzIHlvdSBkb24ndCBoYXZlIHBlcm1pc3Npb24gdG8gZG93bmxvYWQgJHtkaXNwbGF5TmFtZX0uIE9wZW4gaXQgbm9ybWFsbHkgdG8gcmVxdWVzdCBhY2Nlc3Mgb3Igc3dpdGNoIHRvIGFuIGFjY291bnQgd2l0aCBhY2Nlc3MsIHRoZW4gdHJ5IGFnYWluLmAsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIElmIEdvb2dsZSBpcyBnaXZpbmcgdXMgYW4gSFRNTCBwYWdlIGluc3RlYWQgb2YgYnl0ZXMsIHRyeSB0byBjbGFzc2lmeSBpdC5cbiAgICBpZiAoY29udGVudFR5cGUuc3RhcnRzV2l0aCgndGV4dC9odG1sJykpIHtcbiAgICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXMudGV4dCgpO1xuICAgICAgY29uc3Qgc25pcHBldCA9IHRleHQuc2xpY2UoMCwgNDAwMCk7IC8vIGVub3VnaCB0byBzY2FuIGZvciBrZXkgcGhyYXNlc1xuXG4gICAgICAvLyBMb2dpbiAvIGNvbnNlbnQgcGFnZVxuICAgICAgaWYgKGZpbmFsSG9zdCA9PT0gJ2FjY291bnRzLmdvb2dsZS5jb20nKSB7XG4gICAgICAgIHJldHVybiB7XG4gICAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICAgIHVzZXJNZXNzYWdlOlxuICAgICAgICAgICAgJ0dvb2dsZSBuZWVkcyB5b3UgdG8gY29tcGxldGUgYSBzaWduLWluIG9yIHBlcm1pc3Npb24gc2NyZWVuIGJlZm9yZSB0aGlzIGZpbGUgY2FuIGJlIGRvd25sb2FkZWQuIE9wZW4gaXQgbm9ybWFsbHkgaW4gYSB0YWIsIGZpbmlzaCB0aGUgbG9naW4vcGVybWlzc2lvbiBmbG93LCB0aGVuIHRyeSBhZ2Fpbi4nLFxuICAgICAgICB9O1xuICAgICAgfVxuXG4gICAgICAvLyBBY2Nlc3MtZGVuaWVkIHN0eWxlIHBhZ2VzXG4gICAgICBpZiAoL3lvdSBuZWVkIGFjY2Vzc3xyZXF1ZXN0IGFjY2Vzc3xhc2sgZm9yIGFjY2Vzcy9pLnRlc3Qoc25pcHBldCkpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgdXNlck1lc3NhZ2U6IGBHb29nbGUgc2hvd3MgYSBcIllvdSBuZWVkIGFjY2Vzc1wiIHBhZ2UgZm9yICR7ZGlzcGxheU5hbWV9LiBPcGVuIGl0IG5vcm1hbGx5LCByZXF1ZXN0IGFjY2Vzcywgd2FpdCBmb3IgYXBwcm92YWwsIHRoZW4gdHJ5IGFnYWluLmAsXG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfVxuXG4gICAgLy8gRXZlcnl0aGluZyBsb29rcyBmaW5lIChvciBhdCBsZWFzdCBub3QgY2xlYXJseSBiYWQpOiBwcm9jZWVkIHdpdGggbm9ybWFsIGRvd25sb2FkLlxuICAgIHJldHVybiB7IG9rOiB0cnVlLCB1cmw6IGZpbmFsVXJsIH07XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLndhcm4oJ1tDUURdIHByZWZsaWdodFVybCBmYWlsZWQ6JywgZSk7XG4gICAgLy8gSWYgcHJlZmxpZ2h0IGl0c2VsZiBmYWlscyAobmV0d29yaywgQ09SUywgZXRjLiksIGRvbid0IHJlZ3Jlc3M6XG4gICAgLy8gZmFsbCBiYWNrIHRvIHRoZSBub3JtYWwgZG93bmxvYWQgcGF0aCBhbmQgbGV0IG9uQ2hhbmdlZCBoYW5kbGUgZXJyb3JzLlxuICAgIHJldHVybiB7IG9rOiB0cnVlLCB1cmwgfTtcbiAgfVxufVxuXG5hc3luYyBmdW5jdGlvbiB0cnlSZXNvbHZlRHJpdmVWaXJ1c0ludGVyc3RpdGlhbChcbiAgdXJsOiBzdHJpbmcsXG4pOiBQcm9taXNlPHsgb2s6IHRydWU7IGZpbmFsVXJsOiBzdHJpbmcgfSB8IHsgb2s6IGZhbHNlIH0gfCBudWxsPiB7XG4gIGNvbnN0IGhvc3QgPSBzYWZlSG9zdG5hbWUodXJsKTtcbiAgaWYgKGhvc3QgIT09ICdkcml2ZS5nb29nbGUuY29tJykgcmV0dXJuIG51bGw7XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICByZWRpcmVjdDogJ2ZvbGxvdycsXG4gICAgICBjcmVkZW50aWFsczogJ2luY2x1ZGUnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZmluYWxIb3N0ID0gc2FmZUhvc3RuYW1lKHJlcy51cmwgfHwgdXJsKTtcbiAgICBpZiAoZmluYWxIb3N0ICE9PSAnZHJpdmUuZ29vZ2xlLmNvbScpIHtcbiAgICAgIHJldHVybiB7IG9rOiBmYWxzZSB9O1xuICAgIH1cblxuICAgIGNvbnN0IHRleHQgPSBhd2FpdCByZXMudGV4dCgpO1xuXG4gICAgLy8gTG9vayBmb3IgdGhlIFwiRG93bmxvYWQgYW55d2F5XCIgY29uZmlybSBsaW5rXG4gICAgY29uc3QgbWF0Y2ggPVxuICAgICAgdGV4dC5tYXRjaCgvaHJlZj1cIihcXC91Y1xcP1teXCJdKj9leHBvcnQ9ZG93bmxvYWRbXlwiXSo/Y29uZmlybT1bXlwiXSo/aWQ9W15cIl0rPylcIi8pIHx8XG4gICAgICB0ZXh0Lm1hdGNoKFxuICAgICAgICAvaHJlZj1cIihodHRwczpcXC9cXC9kcml2ZVxcLmdvb2dsZVxcLmNvbVxcL3VjXFw/W15cIl0qP2V4cG9ydD1kb3dubG9hZFteXCJdKj9jb25maXJtPVteXCJdKj9pZD1bXlwiXSs/KVwiLyxcbiAgICAgICk7XG5cbiAgICBpZiAoIW1hdGNoKSB7XG4gICAgICByZXR1cm4geyBvazogZmFsc2UgfTtcbiAgICB9XG5cbiAgICBjb25zdCBjb25maXJtVXJsID0gbmV3IFVSTChcbiAgICAgIG1hdGNoWzFdLFxuICAgICAgJ2h0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbScsXG4gICAgKS50b1N0cmluZygpO1xuXG4gICAgcmV0dXJuIHsgb2s6IHRydWUsIGZpbmFsVXJsOiBjb25maXJtVXJsIH07XG4gIH0gY2F0Y2ggKGUpIHtcbiAgICBjb25zb2xlLndhcm4oJ1tDUURdIHRyeVJlc29sdmVEcml2ZVZpcnVzSW50ZXJzdGl0aWFsIGZhaWxlZDonLCBlKTtcbiAgICByZXR1cm4geyBvazogZmFsc2UgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiB1c2VyTWVzc2FnZUZvckRvd25sb2FkRXJyb3IoXG4gIGVycm9yQ29kZTogc3RyaW5nLFxuICBwZW5kaW5nOiBQZW5kaW5nRG93bmxvYWQsXG4pOiBzdHJpbmcge1xuICBjb25zdCBkaXNwbGF5TmFtZSA9IHBlbmRpbmcuZmlsZU1ldGE/Lm5hbWVcbiAgICA/IGBcIiR7cGVuZGluZy5maWxlTWV0YS5uYW1lfVwiYFxuICAgIDogJ3RoaXMgZmlsZSc7XG5cbiAgc3dpdGNoIChlcnJvckNvZGUpIHtcbiAgICAvLyAtLS0tLS0tLSBGSUxFIFNZU1RFTSAvIERJU0sgUFJPQkxFTVMgLS0tLS0tLS1cbiAgICBjYXNlICdGSUxFX05PX1NQQUNFJzpcbiAgICAgIHJldHVybiAnWW91ciBkZXZpY2UgZG9lcyBub3QgaGF2ZSBlbm91Z2ggc3BhY2UgdG8gZmluaXNoIHRoaXMgZG93bmxvYWQuIEZyZWUgdXAgc29tZSBzcGFjZSwgdGhlbiB0cnkgYWdhaW4uJztcbiAgICBjYXNlICdGSUxFX0FDQ0VTU19ERU5JRUQnOlxuICAgICAgcmV0dXJuICdUaGUgYnJvd3NlciB3YXMgbm90IGFsbG93ZWQgdG8gc2F2ZSB0aGlzIGZpbGUuIENoZWNrIHlvdXIgRG93bmxvYWRzIGZvbGRlciBwZXJtaXNzaW9ucyBvciB0cnkgYW5vdGhlciBmb2xkZXIuJztcbiAgICBjYXNlICdGSUxFX0ZBSUxFRCc6XG4gICAgICByZXR1cm4gYFRoZSBicm93c2VyIHJhbiBpbnRvIGEgcHJvYmxlbSB3aGlsZSBzYXZpbmcgJHtkaXNwbGF5TmFtZX0uIFRyeSBhZ2FpbiBvciByZXN0YXJ0IHRoZSBicm93c2VyLmA7XG4gICAgY2FzZSAnRklMRV9OQU1FX1RPT19MT05HJzpcbiAgICAgIHJldHVybiAnVGhlIGZpbGUgbmFtZSBpcyB0b28gbG9uZyBmb3IgeW91ciBvcGVyYXRpbmcgc3lzdGVtLiBUcnkgcmVuYW1pbmcgdGhlIGF0dGFjaG1lbnQgaW4gR29vZ2xlIERyaXZlIGFuZCB0aGVuIGRvd25sb2FkIGFnYWluLic7XG4gICAgY2FzZSAnRklMRV9UT09fTEFSR0UnOlxuICAgICAgcmV0dXJuIGAke2Rpc3BsYXlOYW1lfSBpcyB0b28gbGFyZ2UgZm9yIHRoZSBicm93c2VyIG9yIGZpbGUgc3lzdGVtIHRvIGhhbmRsZS4gVHJ5IGRvd25sb2FkaW5nIGl0IGRpcmVjdGx5IGZyb20gR29vZ2xlIERyaXZlLmA7XG4gICAgY2FzZSAnRklMRV9WSVJVU19JTkZFQ1RFRCc6XG4gICAgY2FzZSAnRklMRV9CTE9DS0VEJzpcbiAgICBjYXNlICdGSUxFX1NFQ1VSSVRZX0NIRUNLX0ZBSUxFRCc6XG4gICAgICByZXR1cm4gYCR7ZGlzcGxheU5hbWV9IHdhcyBibG9ja2VkIGFzIHBvdGVudGlhbGx5IHVuc2FmZS4gQ2hlY2sgeW91ciBicm93c2Vy4oCZcyBEb3dubG9hZHMgbGlzdCBmb3IgbW9yZSBkZXRhaWxzLmA7XG5cbiAgICAvLyAtLS0tLS0tLSBORVRXT1JLIFBST0JMRU1TIC0tLS0tLS0tXG4gICAgY2FzZSAnTkVUV09SS19GQUlMRUQnOlxuICAgIGNhc2UgJ05FVFdPUktfVElNRU9VVCc6XG4gICAgY2FzZSAnTkVUV09SS19ESVNDT05ORUNURUQnOlxuICAgICAgcmV0dXJuIGBZb3VyIGludGVybmV0IGNvbm5lY3Rpb24gZHJvcHBlZCBvciBiZWNhbWUgdW5zdGFibGUgd2hpbGUgZG93bmxvYWRpbmcgJHtkaXNwbGF5TmFtZX0uIENoZWNrIHlvdXIgY29ubmVjdGlvbiwgdGhlbiB0cnkgYWdhaW4uYDtcbiAgICBjYXNlICdORVRXT1JLX1NFUlZFUl9ET1dOJzpcbiAgICAgIHJldHVybiAnR29vZ2xl4oCZcyBzZXJ2ZXJzIGNvdWxkIG5vdCBiZSByZWFjaGVkIHdoaWxlIGRvd25sb2FkaW5nIHRoaXMgZmlsZS4gVHJ5IGFnYWluIGluIGEgZmV3IG1pbnV0ZXMuJztcblxuICAgIC8vIC0tLS0tLS0tIFNFUlZFUiAvIEhUVFAgUFJPQkxFTVMgLS0tLS0tLS1cbiAgICBjYXNlICdTRVJWRVJfRkFJTEVEJzpcbiAgICBjYXNlICdTRVJWRVJfQkFEX0NPTlRFTlQnOlxuICAgICAgcmV0dXJuIGBHb29nbGUgaGFkIGEgcHJvYmxlbSBzZW5kaW5nICR7ZGlzcGxheU5hbWV9LiBUcnkgYWdhaW4gbGF0ZXIuYDtcbiAgICBjYXNlICdTRVJWRVJfTk9fUkFOR0UnOlxuICAgICAgcmV0dXJuIGBUaGUgc2VydmVyIGRvZXMgbm90IHN1cHBvcnQgcmVzdW1pbmcgb3IgcGFydGlhbCBkb3dubG9hZHMgZm9yICR7ZGlzcGxheU5hbWV9LiBUcnkgZG93bmxvYWRpbmcgaXQgZGlyZWN0bHkgZnJvbSBHb29nbGUgRHJpdmUuYDtcbiAgICBjYXNlICdTRVJWRVJfVU5BVVRIT1JJWkVEJzpcbiAgICBjYXNlICdTRVJWRVJfRk9SQklEREVOJzpcbiAgICAgIHJldHVybiBgR29vZ2xlIHNheXMgeW91IGRvIG5vdCBoYXZlIHBlcm1pc3Npb24gdG8gZG93bmxvYWQgJHtkaXNwbGF5TmFtZX0uIE9wZW4gaXQgb25jZSBub3JtYWxseSAodG8gbG9naW4gb3IgcmVxdWVzdCBhY2Nlc3MpLCB0aGVuIHRyeSBhZ2Fpbi5gO1xuXG4gICAgLy8gLS0tLS0tLS0gVVNFUiAvIEJST1dTRVIgQUNUSU9OUyAtLS0tLS0tLVxuICAgIGNhc2UgJ1VTRVJfQ0FOQ0VMRUQnOlxuICAgICAgcmV0dXJuICdZb3UgY2FuY2VsbGVkIHRoaXMgZG93bmxvYWQgZnJvbSB0aGUgYnJvd3Nlci4nO1xuICAgIGNhc2UgJ0NSQVNIJzpcbiAgICAgIHJldHVybiAnVGhlIGJyb3dzZXIgcHJvY2VzcyBoYW5kbGluZyB0aGUgZG93bmxvYWQgY3Jhc2hlZC4gUmVvcGVuIHRoZSBicm93c2VyIGFuZCB0cnkgYWdhaW4uJztcblxuICAgIGRlZmF1bHQ6XG4gICAgICByZXR1cm4gJ1RoZSBkb3dubG9hZCB3YXMgaW50ZXJydXB0ZWQgYnkgdGhlIGJyb3dzZXIuIFRyeSBhZ2FpbiBvciBvcGVuIHRoZSBhdHRhY2htZW50IG5vcm1hbGx5IGluIGEgdGFiLic7XG4gIH1cbn1cblxuZnVuY3Rpb24gc2VuZFN0YXR1c1RvVGFiKFxuICBwZW5kaW5nOiBQZW5kaW5nRG93bmxvYWQsXG4gIHN0YXR1czogRG93bmxvYWRTdGF0dXMsXG4gIHVzZXJNZXNzYWdlPzogc3RyaW5nLFxuICBlcnJvckNvZGU/OiBzdHJpbmcsXG4pOiB2b2lkIHtcbiAgaWYgKHBlbmRpbmcudGFiSWQgPT0gbnVsbCkgcmV0dXJuO1xuXG4gIHRyeSB7XG4gICAgY2hyb21lLnRhYnMuc2VuZE1lc3NhZ2UocGVuZGluZy50YWJJZCwge1xuICAgICAgdHlwZTogJ0NRRF9ET1dOTE9BRF9TVEFUVVMnLFxuICAgICAgcmVxdWVzdElkOiBwZW5kaW5nLnJlcXVlc3RJZCxcbiAgICAgIHN0YXR1cyxcbiAgICAgIGVycm9yQ29kZSxcbiAgICAgIHVzZXJNZXNzYWdlLFxuICAgIH0pO1xuICB9IGNhdGNoIChlKSB7XG4gICAgY29uc29sZS53YXJuKCdbQ1FEXSBzZW5kU3RhdHVzVG9UYWIgZmFpbGVkOicsIGUpO1xuICB9XG59XG5cbmZ1bmN0aW9uIGdldEZpbGVuYW1lRXh0KGZpbGVuYW1lPzogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgaWYgKCFmaWxlbmFtZSkgcmV0dXJuIHVuZGVmaW5lZDtcbiAgY29uc3QgbSA9IGZpbGVuYW1lLm1hdGNoKC9cXC4oW2EtekEtWjAtOV17MSw2fSkkLyk7XG4gIHJldHVybiBtID8gbVsxXS50b0xvd2VyQ2FzZSgpIDogdW5kZWZpbmVkO1xufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJdLCJuYW1lcyI6WyJicm93c2VyIiwiX2Jyb3dzZXIiXSwibWFwcGluZ3MiOiI7O0FBQU8sV0FBUyxpQkFBaUIsS0FBSztBQUNwQyxRQUFJLE9BQU8sUUFBUSxPQUFPLFFBQVEsV0FBWSxRQUFPLEVBQUUsTUFBTSxJQUFHO0FBQ2hFLFdBQU87QUFBQSxFQUNUO0FDYUEsUUFBQSxxQkFBQSxvQkFBQSxJQUFBO0FBQ0EsUUFBQSxzQkFBQSxvQkFBQSxJQUFBO0FBRUEsUUFBQSxhQUFBLGlCQUFBLE1BQUE7QUFDRSxZQUFBLElBQUEsd0JBQUE7QUFPQSxXQUFBLFVBQUEsc0JBQUEsWUFBQSxDQUFBLE1BQUEsWUFBQTtBQUNFLFlBQUEsVUFBQSxvQkFBQSxJQUFBLEtBQUEsRUFBQTtBQUNBLFVBQUEsQ0FBQSxTQUFBO0FB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LFNBQVMsRUFBRSxDQUFDO0FBQUEsTUFDeEU7QUFDSSxZQUFNLHFCQUFxQixLQUFLLHNCQUFzQixLQUFLLGFBQWE7QUFDeEUsYUFBTyxDQUFDLENBQUMsb0JBQW9CLEtBQUssQ0FBQyxVQUFVLE1BQU0sS0FBSyxJQUFJLFFBQVEsQ0FBQyxLQUFLLG1CQUFtQixLQUFLLElBQUksUUFBUTtBQUFBLElBQ2hIO0FBQUEsSUFDQSxZQUFZLEtBQUs7QUFDZixZQUFNLE1BQU0scUVBQXFFO0FBQUEsSUFDbkY7QUFBQSxJQUNBLFdBQVcsS0FBSztBQUNkLFlBQU0sTUFBTSxvRUFBb0U7QUFBQSxJQUNsRjtBQUFBLElBQ0EsV0FBVyxLQUFLO0FBQ2QsWUFBTSxNQUFNLG9FQUFvRTtBQUFBLElBQ2xGO0FBQUEsSUFDQSxzQkFBc0IsU0FBUztBQUM3QixZQUFNLFVBQVUsS0FBSyxlQUFlLE9BQU87QUFDM0MsWUFBTSxnQkFBZ0IsUUFBUSxRQUFRLFNBQVMsSUFBSTtBQUNuRCxhQUFPLE9BQU8sSUFBSSxhQUFhLEdBQUc7QUFBQSxJQUNwQztBQUFBLElBQ0EsZUFBZSxRQUFRO0FBQ3JCLGFBQU8sT0FBTyxRQUFRLHVCQUF1QixNQUFNO0FBQUEsSUFDckQ7QUFBQSxFQUNGO0FBQ0EsTUFBSSxlQUFlO0FBQ25CLGVBQWEsWUFBWSxDQUFDLFFBQVEsU0FBUyxRQUFRLE9BQU8sS0FBSztBQUMvRCxNQUFJLHNCQUFzQixjQUFjLE1BQU07QUFBQSxJQUM1QyxZQUFZLGNBQWMsUUFBUTtBQUNoQyxZQUFNLDBCQUEwQixZQUFZLE1BQU0sTUFBTSxFQUFFO0FBQUEsSUFDNUQ7QUFBQSxFQUNGO0FBQ0EsV0FBUyxpQkFBaUIsY0FBYyxVQUFVO0FBQ2hELFFBQUksQ0FBQyxhQUFhLFVBQVUsU0FBUyxRQUFRLEtBQUssYUFBYTtBQUM3RCxZQUFNLElBQUk7QUFBQSxRQUNSO0FBQUEsUUFDQSxHQUFHLFFBQVEsMEJBQTBCLGFBQWEsVUFBVSxLQUFLLElBQUksQ0FBQztBQUFBLE1BQzVFO0FBQUEsRUFDQTtBQUNBLFdBQVMsaUJBQWlCLGNBQWMsVUFBVTtBQUNoRCxRQUFJLFNBQVMsU0FBUyxHQUFHO0FBQ3ZCLFlBQU0sSUFBSSxvQkFBb0IsY0FBYyxnQ0FBZ0M7QUFDOUUsUUFBSSxTQUFTLFNBQVMsR0FBRyxLQUFLLFNBQVMsU0FBUyxLQUFLLENBQUMsU0FBUyxXQUFXLElBQUk7QUFDNUUsWUFBTSxJQUFJO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxNQUNOO0FBQUEsRUFDQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OyIsInhfZ29vZ2xlX2lnbm9yZUxpc3QiOlswLDIsMyw0XX0=
