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
    console.log("[CQD] Background ready");
    chrome.downloads.onDeterminingFilename.addListener((item, suggest) => {
      let pending = pendingByDownloadId.get(item.id);
      if (!pending) {
        pending = pendingByUrl.get(item.url) ?? pendingByUrl.get(item.finalUrl || item.url);
      }
      if (!pending) {
        suggest();
        return;
      }
      const mime = (item.mime || "").toLowerCase();
      const expectedExt = pending.fileMeta?.ext?.toLowerCase();
      const expectedKind = pending.fileMeta?.kind;
      const actualExt = getFilenameExt(item.filename);
      const host = safeHostname(item.url);
      const isGoogleHost = host === "drive.google.com" || host === "classroom.google.com" || host === "drive.usercontent.google.com";
      const weExpectHtml = expectedKind === "html" || expectedExt === "html" || expectedExt === "htm";
      const looksLikeHtml = mime.startsWith("text/html") || actualExt === "html" || actualExt === "htm";
      if (isGoogleHost && looksLikeHtml && !weExpectHtml) {
        chrome.downloads.cancel(item.id, () => {
          void (async () => {
            const resolved = await tryResolveDriveVirusInterstitial(
              item.finalUrl || item.url
            );
            if (resolved && resolved.ok) {
              chrome.downloads.download(
                {
                  url: resolved.finalUrl,
                  saveAs: false,
                  conflictAction: "uniquify"
                },
                (newId) => {
                  const err = chrome.runtime.lastError;
                  if (err || newId == null) {
                    const msg = "Google returned a web page instead of the file. Quick Downloader could not bypass it.";
                    const errorCode = "BLOCKED_HTML";
                    sendStatusToTab(
                      pending,
                      "blocked_html",
                      msg,
                      errorCode
                    );
                    pendingByRequestId.delete(pending.requestId);
                    pendingByDownloadId.delete(item.id);
                    return;
                  }
                  pendingByDownloadId.delete(item.id);
                  pendingByDownloadId.set(newId, pending);
                  pendingByUrl.set(resolved.finalUrl, pending);
                }
              );
            } else {
              const fallbackMsg = "Google returned a web page instead of the file. Open it in a tab (login / access / “Download anyway”), then try again.";
              const msg = resolved && !resolved.ok && resolved.userMessage ? resolved.userMessage : fallbackMsg;
              const reason = resolved && !resolved.ok && resolved.reason;
              const errorCode = reason === "login_required" ? "LOGIN_REQUIRED" : reason === "permission_required" ? "PERMISSION_REQUIRED" : reason === "virus_interstitial" ? "VIRUS_INTERSTITIAL" : "BLOCKED_HTML";
              sendStatusToTab(
                pending,
                "blocked_html",
                msg,
                errorCode
              );
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
          userMessage: "No valid download link for this attachment."
        });
        return;
      }
      if (!chrome.downloads || typeof chrome.downloads.download !== "function") {
        sendResponse?.({
          started: false,
          requestId,
          userMessage: "Browser does not allow background downloads for this extension."
        });
        return;
      }
      const tabId = sender.tab?.id;
      const url = rawUrl;
      const pending = {
        requestId,
        url,
        fileMeta,
        tabId
      };
      pendingByRequestId.set(requestId, pending);
      pendingByUrl.set(url, pending);
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
            pendingByRequestId.delete(requestId);
            pendingByUrl.delete(url);
            sendResponse?.({
              started: false,
              requestId,
              userMessage: "Browser could not start the download. Try again or open it normally."
            });
            return;
          }
          pendingByDownloadId.set(downloadId, pending);
          setTimeout(() => {
            const stillPending = pendingByRequestId.get(requestId);
            if (!stillPending) return;
            sendStatusToTab(
              stillPending,
              "interrupted",
              "Download is taking too long. Check Downloads or try again.",
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
    if (host !== "drive.google.com" && host !== "classroom.google.com" && host !== "drive.usercontent.google.com") {
      return null;
    }
    try {
      const res = await fetch(url, {
        method: "GET",
        redirect: "follow",
        credentials: "include"
      });
      const finalHost = safeHostname(res.url || url);
      if (finalHost && finalHost !== "drive.google.com") {
        const lowerUrl = (res.url || url).toLowerCase();
        if (lowerUrl.includes("accounts.google.com")) {
          return {
            ok: false,
            reason: "login_required",
            userMessage: "Sign in to the right Google account in a normal tab, then try again."
          };
        }
      }
      if (res.status === 401) {
        return {
          ok: false,
          reason: "login_required",
          userMessage: "Sign in to the right Google account in a normal tab, then try again."
        };
      }
      if (res.status === 403) {
        return {
          ok: false,
          reason: "permission_required",
          userMessage: "You need permission for this file. Open it in a tab and click “Request access”."
        };
      }
      const text = await res.text();
      const lower = text.toLowerCase();
      const hrefMatch = text.match(/href=["']([^"']*?confirm=[^"']+?)["']/i) || text.match(/data-href=["']([^"']*?confirm=[^"']+?)["']/i);
      const actionMatch = text.match(/action=["']([^"']*?confirm=[^"']+?)["']/i);
      const explicitConfirm = hrefMatch || actionMatch;
      if (explicitConfirm) {
        const raw = explicitConfirm[1];
        try {
          const confirmUrl = new URL(raw, res.url || url).toString();
          return { ok: true, finalUrl: confirmUrl };
        } catch (e) {
          console.warn("[CQD] could not build confirm URL from match", e);
        }
      }
      const formUrl = extractDownloadFormUrl(text, res.url || url);
      if (formUrl) {
        return { ok: true, finalUrl: formUrl };
      }
      if (lower.includes("you need access") || lower.includes("request access")) {
        return {
          ok: false,
          reason: "permission_required",
          userMessage: "You need permission for this file. Open it in a tab and click “Request access”."
        };
      }
      if (lower.includes("sign in") && (lower.includes("to continue to google drive") || lower.includes("to continue to drive") || lower.includes("to continue to google"))) {
        return {
          ok: false,
          reason: "login_required",
          userMessage: "Sign in to the right Google account in a normal tab, then try again."
        };
      }
      const looksLikeVirusPage = lower.includes("can't be scanned for viruses") || lower.includes("cant be scanned for viruses") || lower.includes("can't scan this file for viruses") || lower.includes("cant scan this file for viruses") || lower.includes("too large for google to scan") || lower.includes("too large to be scanned for viruses") || lower.includes("download anyway");
      if (looksLikeVirusPage) {
        const confirmUrl = buildConfirmUrlFromVirusPage(url, res.url);
        if (confirmUrl) {
          return { ok: true, finalUrl: confirmUrl };
        }
        const userContentGuess = buildUserContentDownloadGuess(url, res.url);
        if (userContentGuess) {
          return { ok: true, finalUrl: userContentGuess };
        }
        return {
          ok: false,
          reason: "virus_interstitial",
          userMessage: "Google can’t scan this file. Open it and click “Download anyway”, then try again."
        };
      }
      return { ok: false, reason: "other_html" };
    } catch (e) {
      console.warn("[CQD] tryResolveDriveVirusInterstitial failed:", e);
      return { ok: false, reason: "other_html" };
    }
  }
  function userMessageForDownloadError(errorCode, pending) {
    const displayName = pending.fileMeta?.name ? `"${pending.fileMeta.name}"` : "this file";
    switch (errorCode) {
      // -------- FILE SYSTEM / DISK PROBLEMS --------
      case "FILE_NO_SPACE":
        return "Not enough disk space. Free some space and try again.";
      case "FILE_ACCESS_DENIED":
        return "Browser could not write to Downloads. Check folder permissions.";
      case "FILE_FAILED":
        return `Problem saving ${displayName}. Try again.`;
      case "FILE_NAME_TOO_LONG":
        return "File name is too long. Rename it in Drive and try again.";
      case "FILE_TOO_LARGE":
        return `${displayName} is too large. Try downloading it directly from Google Drive.`;
      case "FILE_VIRUS_INFECTED":
      case "FILE_BLOCKED":
      case "FILE_SECURITY_CHECK_FAILED":
        return `${displayName} was blocked as unsafe. Check the browser’s Downloads list.`;
      // -------- NETWORK PROBLEMS --------
      case "NETWORK_FAILED":
      case "NETWORK_TIMEOUT":
      case "NETWORK_DISCONNECTED":
        return `Network error while downloading ${displayName}. Check your connection and try again.`;
      case "NETWORK_SERVER_DOWN":
        return "Google’s servers could not be reached. Try again later.";
      // -------- SERVER / HTTP PROBLEMS --------
      case "SERVER_FAILED":
      case "SERVER_BAD_CONTENT":
        return `Google had a problem sending ${displayName}. Try again later.`;
      case "SERVER_NO_RANGE":
        return "Server does not support partial downloads. Try downloading directly from Drive.";
      case "SERVER_UNAUTHORIZED":
      case "SERVER_FORBIDDEN":
        return `You don’t have permission for ${displayName}. Open it in a tab (login / request access) and try again.`;
      // -------- USER / BROWSER ACTIONS --------
      case "USER_CANCELED":
        return "You cancelled this download.";
      case "CRASH":
        return "The browser process crashed. Reopen the browser and try again.";
      default:
        return "The download was interrupted. Try again or open the file normally in a tab.";
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
  function extractDownloadFormUrl(html, baseUrl) {
    let formMatch = html.match(
      /<form[^>]*id=["']download-form["'][^>]*action=["']([^"']+)["'][^>]*>([\s\S]*?)<\/form>/i
    ) || // Fallback: any form that posts to drive.usercontent.google.com/download
    html.match(
      /<form[^>]*action=["']([^"']*drive\.usercontent\.google\.com\/download[^"']*)["'][^>]*>([\s\S]*?)<\/form>/i
    );
    if (!formMatch) return null;
    const action = formMatch[1];
    const inner = formMatch[2];
    const params = new URLSearchParams();
    const inputRegex = /<input[^>]*name=["']([^"']+)["'][^>]*value=["']([^"']*)["'][^>]*>/gi;
    let m;
    while (m = inputRegex.exec(inner)) {
      const name = m[1];
      const value = m[2];
      params.set(name, value);
    }
    try {
      const actionUrl = new URL(action, baseUrl);
      const sp = actionUrl.searchParams;
      params.forEach((value, key) => {
        sp.set(key, value);
      });
      return actionUrl.toString();
    } catch (e) {
      console.warn("[CQD] extractDownloadFormUrl: failed to build URL", e);
      return null;
    }
  }
  function buildConfirmUrlFromVirusPage(originalUrl, responseUrl) {
    const candidate = responseUrl || originalUrl;
    try {
      const u = new URL(candidate);
      if (u.hostname !== "drive.google.com") return null;
      let id = u.searchParams.get("id") || void 0;
      if (!id) {
        const m = u.pathname.match(/\/file\/d\/([^/]+)/);
        if (m) id = m[1];
      }
      if (!id) return null;
      const confirmUrl = new URL("https://drive.google.com/uc");
      confirmUrl.searchParams.set("export", "download");
      confirmUrl.searchParams.set("id", id);
      confirmUrl.searchParams.set("confirm", "t");
      return confirmUrl.toString();
    } catch {
      return null;
    }
  }
  function buildUserContentDownloadGuess(originalUrl, responseUrl) {
    const candidate = responseUrl || originalUrl;
    try {
      const u = new URL(candidate);
      let id = u.searchParams.get("id") || void 0;
      if (!id) {
        const m = u.pathname.match(/\/file\/d\/([^/]+)/);
        if (m) id = m[1];
      }
      if (!id) return null;
      const authuser = u.searchParams.get("authuser") || "0";
      const out = new URL("https://drive.usercontent.google.com/download");
      out.searchParams.set("id", id);
      out.searchParams.set("export", "download");
      out.searchParams.set("authuser", authuser);
      out.searchParams.set("confirm", "t");
      return out.toString();
    } catch {
      return null;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja2dyb3VuZC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L3V0aWxzL2RlZmluZS1iYWNrZ3JvdW5kLm1qcyIsIi4uLy4uL2VudHJ5cG9pbnRzL2JhY2tncm91bmQudHMiLCIuLi8uLi8uLi8uLi8uLi9ub2RlX21vZHVsZXMvLnBucG0vQHd4dC1kZXYrYnJvd3NlckAwLjEuNC9ub2RlX21vZHVsZXMvQHd4dC1kZXYvYnJvd3Nlci9zcmMvaW5kZXgubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL3d4dEAwLjIwLjExX0B0eXBlcytub2RlQDI0LjEwLjFfaml0aUAyLjYuMV9saWdodG5pbmdjc3NAMS4zMC4xX3JvbGx1cEA0LjUzLjIvbm9kZV9tb2R1bGVzL3d4dC9kaXN0L2Jyb3dzZXIubWpzIiwiLi4vLi4vLi4vLi4vLi4vbm9kZV9tb2R1bGVzLy5wbnBtL0B3ZWJleHQtY29yZSttYXRjaC1wYXR0ZXJuc0AxLjAuMy9ub2RlX21vZHVsZXMvQHdlYmV4dC1jb3JlL21hdGNoLXBhdHRlcm5zL2xpYi9pbmRleC5qcyJdLCJzb3VyY2VzQ29udGVudCI6WyJleHBvcnQgZnVuY3Rpb24gZGVmaW5lQmFja2dyb3VuZChhcmcpIHtcbiAgaWYgKGFyZyA9PSBudWxsIHx8IHR5cGVvZiBhcmcgPT09IFwiZnVuY3Rpb25cIikgcmV0dXJuIHsgbWFpbjogYXJnIH07XG4gIHJldHVybiBhcmc7XG59XG4iLCIvLyBmaWxlcGF0aDogZW50cnlwb2ludHMvYmFja2dyb3VuZC50c1xuXG50eXBlIEZpbGVNZXRhTXNnID0ge1xuICBuYW1lPzogc3RyaW5nO1xuICBleHQ/OiBzdHJpbmc7XG4gIGtpbmQ/OiBzdHJpbmc7XG59O1xuXG50eXBlIFBlbmRpbmdEb3dubG9hZCA9IHtcbiAgcmVxdWVzdElkOiBzdHJpbmc7XG4gIHVybDogc3RyaW5nO1xuICBmaWxlTWV0YT86IEZpbGVNZXRhTXNnO1xuICB0YWJJZD86IG51bWJlcjtcbn07XG5cbnR5cGUgRG93bmxvYWRTdGF0dXMgPSAnY29tcGxldGUnIHwgJ2ludGVycnVwdGVkJyB8ICdibG9ja2VkX2h0bWwnO1xuXG50eXBlIERyaXZlSHRtbFJlYXNvbiA9XG4gIHwgJ2xvZ2luX3JlcXVpcmVkJ1xuICB8ICdwZXJtaXNzaW9uX3JlcXVpcmVkJ1xuICB8ICd2aXJ1c19pbnRlcnN0aXRpYWwnXG4gIHwgJ290aGVyX2h0bWwnO1xuXG50eXBlIERyaXZlSW50ZXJzdGl0aWFsUmVzdWx0ID1cbiAgfCB7IG9rOiB0cnVlOyBmaW5hbFVybDogc3RyaW5nIH1cbiAgfCB7IG9rOiBmYWxzZTsgcmVhc29uPzogRHJpdmVIdG1sUmVhc29uOyB1c2VyTWVzc2FnZT86IHN0cmluZyB9XG4gIHwgbnVsbDtcblxuY29uc3QgcGVuZGluZ0J5UmVxdWVzdElkID0gbmV3IE1hcDxzdHJpbmcsIFBlbmRpbmdEb3dubG9hZD4oKTtcbmNvbnN0IHBlbmRpbmdCeURvd25sb2FkSWQgPSBuZXcgTWFwPG51bWJlciwgUGVuZGluZ0Rvd25sb2FkPigpO1xuY29uc3QgcGVuZGluZ0J5VXJsID0gbmV3IE1hcDxzdHJpbmcsIFBlbmRpbmdEb3dubG9hZD4oKTtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQmFja2dyb3VuZCgoKSA9PiB7XG4gIGNvbnNvbGUubG9nKCdbQ1FEXSBCYWNrZ3JvdW5kIHJlYWR5Jyk7XG5cbiAgLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIGRvd25sb2Fkcy5vbkRldGVybWluaW5nRmlsZW5hbWVcbiAgICogIC0+IGJsb2NrIHVuZXhwZWN0ZWQgSFRNTCBhbmQgb3B0aW9uYWxseVxuICAgKiAgICAgdHJ5IHRvIGF1dG8tcmVzb2x2ZSBEcml2ZSBcIkRvd25sb2FkIGFueXdheVwiXG4gICAqIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuICBjaHJvbWUuZG93bmxvYWRzLm9uRGV0ZXJtaW5pbmdGaWxlbmFtZS5hZGRMaXN0ZW5lcigoaXRlbSwgc3VnZ2VzdCkgPT4ge1xuICAgIGxldCBwZW5kaW5nID0gcGVuZGluZ0J5RG93bmxvYWRJZC5nZXQoaXRlbS5pZCk7XG4gICAgaWYgKCFwZW5kaW5nKSB7XG4gICAgICBwZW5kaW5nID1cbiAgICAgICAgcGVuZGluZ0J5VXJsLmdldChpdGVtLnVybCkgPz9cbiAgICAgICAgcGVuZGluZ0J5VXJsLmdldChpdGVtLmZpbmFsVXJsIHx8IGl0ZW0udXJsKTtcbiAgICB9XG5cbiAgICBpZiAoIXBlbmRpbmcpIHtcbiAgICAgIHN1Z2dlc3QoKTtcbiAgICAgIHJldHVybjtcbiAgICB9XG5cbiAgICBjb25zdCBtaW1lID0gKGl0ZW0ubWltZSB8fCAnJykudG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBleHBlY3RlZEV4dCA9IHBlbmRpbmcuZmlsZU1ldGE/LmV4dD8udG9Mb3dlckNhc2UoKTtcbiAgICBjb25zdCBleHBlY3RlZEtpbmQgPSBwZW5kaW5nLmZpbGVNZXRhPy5raW5kO1xuICAgIGNvbnN0IGFjdHVhbEV4dCA9IGdldEZpbGVuYW1lRXh0KGl0ZW0uZmlsZW5hbWUpO1xuICAgIGNvbnN0IGhvc3QgPSBzYWZlSG9zdG5hbWUoaXRlbS51cmwpO1xuXG4gICAgY29uc3QgaXNHb29nbGVIb3N0ID1cbiAgICAgIGhvc3QgPT09ICdkcml2ZS5nb29nbGUuY29tJyB8fFxuICAgICAgaG9zdCA9PT0gJ2NsYXNzcm9vbS5nb29nbGUuY29tJyB8fFxuICAgICAgaG9zdCA9PT0gJ2RyaXZlLnVzZXJjb250ZW50Lmdvb2dsZS5jb20nO1xuXG4gICAgY29uc3Qgd2VFeHBlY3RIdG1sID1cbiAgICAgIGV4cGVjdGVkS2luZCA9PT0gJ2h0bWwnIHx8XG4gICAgICBleHBlY3RlZEV4dCA9PT0gJ2h0bWwnIHx8XG4gICAgICBleHBlY3RlZEV4dCA9PT0gJ2h0bSc7XG5cbiAgICBjb25zdCBsb29rc0xpa2VIdG1sID1cbiAgICAgIG1pbWUuc3RhcnRzV2l0aCgndGV4dC9odG1sJykgfHxcbiAgICAgIGFjdHVhbEV4dCA9PT0gJ2h0bWwnIHx8XG4gICAgICBhY3R1YWxFeHQgPT09ICdodG0nO1xuXG4gICAgaWYgKGlzR29vZ2xlSG9zdCAmJiBsb29rc0xpa2VIdG1sICYmICF3ZUV4cGVjdEh0bWwpIHtcbiAgICAgIGNocm9tZS5kb3dubG9hZHMuY2FuY2VsKGl0ZW0uaWQsICgpID0+IHtcbiAgICAgICAgdm9pZCAoYXN5bmMgKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHJlc29sdmVkID0gYXdhaXQgdHJ5UmVzb2x2ZURyaXZlVmlydXNJbnRlcnN0aXRpYWwoXG4gICAgICAgICAgICBpdGVtLmZpbmFsVXJsIHx8IGl0ZW0udXJsLFxuICAgICAgICAgICk7XG5cbiAgICAgICAgICBpZiAocmVzb2x2ZWQgJiYgcmVzb2x2ZWQub2spIHtcbiAgICAgICAgICAgIGNocm9tZS5kb3dubG9hZHMuZG93bmxvYWQoXG4gICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICB1cmw6IHJlc29sdmVkLmZpbmFsVXJsLFxuICAgICAgICAgICAgICAgIHNhdmVBczogZmFsc2UsXG4gICAgICAgICAgICAgICAgY29uZmxpY3RBY3Rpb246ICd1bmlxdWlmeScsXG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIChuZXdJZCkgPT4ge1xuICAgICAgICAgICAgICAgIGNvbnN0IGVyciA9IGNocm9tZS5ydW50aW1lLmxhc3RFcnJvcjtcbiAgICAgICAgICAgICAgICBpZiAoZXJyIHx8IG5ld0lkID09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgIGNvbnN0IG1zZyA9XG4gICAgICAgICAgICAgICAgICAgICdHb29nbGUgcmV0dXJuZWQgYSB3ZWIgcGFnZSBpbnN0ZWFkIG9mIHRoZSBmaWxlLiBRdWljayBEb3dubG9hZGVyIGNvdWxkIG5vdCBieXBhc3MgaXQuJztcbiAgICAgICAgICAgICAgICAgIGNvbnN0IGVycm9yQ29kZSA9ICdCTE9DS0VEX0hUTUwnO1xuXG4gICAgICAgICAgICAgICAgICBzZW5kU3RhdHVzVG9UYWIoXG4gICAgICAgICAgICAgICAgICAgIHBlbmRpbmcgYXMgUGVuZGluZ0Rvd25sb2FkLFxuICAgICAgICAgICAgICAgICAgICAnYmxvY2tlZF9odG1sJyxcbiAgICAgICAgICAgICAgICAgICAgbXNnLFxuICAgICAgICAgICAgICAgICAgICBlcnJvckNvZGUsXG4gICAgICAgICAgICAgICAgICApO1xuICAgICAgICAgICAgICAgICAgcGVuZGluZ0J5UmVxdWVzdElkLmRlbGV0ZShwZW5kaW5nIS5yZXF1ZXN0SWQpO1xuICAgICAgICAgICAgICAgICAgcGVuZGluZ0J5RG93bmxvYWRJZC5kZWxldGUoaXRlbS5pZCk7XG4gICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgcGVuZGluZ0J5RG93bmxvYWRJZC5kZWxldGUoaXRlbS5pZCk7XG4gICAgICAgICAgICAgICAgcGVuZGluZ0J5RG93bmxvYWRJZC5zZXQobmV3SWQsIHBlbmRpbmcgYXMgUGVuZGluZ0Rvd25sb2FkKTtcbiAgICAgICAgICAgICAgICBwZW5kaW5nQnlVcmwuc2V0KHJlc29sdmVkLmZpbmFsVXJsLCBwZW5kaW5nIGFzIFBlbmRpbmdEb3dubG9hZCk7XG4gICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICApO1xuICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBjb25zdCBmYWxsYmFja01zZyA9XG4gICAgICAgICAgICAgICdHb29nbGUgcmV0dXJuZWQgYSB3ZWIgcGFnZSBpbnN0ZWFkIG9mIHRoZSBmaWxlLiBPcGVuIGl0IGluIGEgdGFiIChsb2dpbiAvIGFjY2VzcyAvIOKAnERvd25sb2FkIGFueXdheeKAnSksIHRoZW4gdHJ5IGFnYWluLic7XG5cbiAgICAgICAgICAgIGNvbnN0IG1zZyA9XG4gICAgICAgICAgICAgIHJlc29sdmVkICYmICFyZXNvbHZlZC5vayAmJiByZXNvbHZlZC51c2VyTWVzc2FnZVxuICAgICAgICAgICAgICAgID8gcmVzb2x2ZWQudXNlck1lc3NhZ2VcbiAgICAgICAgICAgICAgICA6IGZhbGxiYWNrTXNnO1xuXG4gICAgICAgICAgICBjb25zdCByZWFzb24gPSByZXNvbHZlZCAmJiAhcmVzb2x2ZWQub2sgJiYgcmVzb2x2ZWQucmVhc29uO1xuICAgICAgICAgICAgY29uc3QgZXJyb3JDb2RlID1cbiAgICAgICAgICAgICAgcmVhc29uID09PSAnbG9naW5fcmVxdWlyZWQnXG4gICAgICAgICAgICAgICAgPyAnTE9HSU5fUkVRVUlSRUQnXG4gICAgICAgICAgICAgICAgOiByZWFzb24gPT09ICdwZXJtaXNzaW9uX3JlcXVpcmVkJ1xuICAgICAgICAgICAgICAgID8gJ1BFUk1JU1NJT05fUkVRVUlSRUQnXG4gICAgICAgICAgICAgICAgOiByZWFzb24gPT09ICd2aXJ1c19pbnRlcnN0aXRpYWwnXG4gICAgICAgICAgICAgICAgPyAnVklSVVNfSU5URVJTVElUSUFMJ1xuICAgICAgICAgICAgICAgIDogJ0JMT0NLRURfSFRNTCc7XG5cbiAgICAgICAgICAgIHNlbmRTdGF0dXNUb1RhYihcbiAgICAgICAgICAgICAgcGVuZGluZyBhcyBQZW5kaW5nRG93bmxvYWQsXG4gICAgICAgICAgICAgICdibG9ja2VkX2h0bWwnLFxuICAgICAgICAgICAgICBtc2csXG4gICAgICAgICAgICAgIGVycm9yQ29kZSxcbiAgICAgICAgICAgICk7XG4gICAgICAgICAgICBwZW5kaW5nQnlSZXF1ZXN0SWQuZGVsZXRlKHBlbmRpbmchLnJlcXVlc3RJZCk7XG4gICAgICAgICAgICBwZW5kaW5nQnlEb3dubG9hZElkLmRlbGV0ZShpdGVtLmlkKTtcbiAgICAgICAgICB9XG4gICAgICAgIH0pKCk7XG4gICAgICB9KTtcblxuICAgICAgc3VnZ2VzdCh7IGZpbGVuYW1lOiBpdGVtLmZpbGVuYW1lIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIHN1Z2dlc3QoeyBmaWxlbmFtZTogaXRlbS5maWxlbmFtZSB9KTtcbiAgfSk7XG5cbiAgLyogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gICAqIGRvd25sb2Fkcy5vbkNoYW5nZWRcbiAgICogIC0+IGNvbXBsZXRpb24gLyBuZXR3b3JrIC8gYXV0aCBlcnJvcnNcbiAgICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG4gIGNocm9tZS5kb3dubG9hZHMub25DaGFuZ2VkLmFkZExpc3RlbmVyKChkZWx0YSkgPT4ge1xuICAgIGNvbnN0IHBlbmRpbmcgPSBwZW5kaW5nQnlEb3dubG9hZElkLmdldChkZWx0YS5pZCk7XG4gICAgaWYgKCFwZW5kaW5nKSByZXR1cm47XG5cbiAgICBpZiAoZGVsdGEuc3RhdGUgJiYgZGVsdGEuc3RhdGUuY3VycmVudCA9PT0gJ2NvbXBsZXRlJykge1xuICAgICAgc2VuZFN0YXR1c1RvVGFiKHBlbmRpbmcsICdjb21wbGV0ZScpO1xuICAgICAgcGVuZGluZ0J5RG93bmxvYWRJZC5kZWxldGUoZGVsdGEuaWQpO1xuICAgICAgcGVuZGluZ0J5UmVxdWVzdElkLmRlbGV0ZShwZW5kaW5nLnJlcXVlc3RJZCk7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgaWYgKGRlbHRhLnN0YXRlICYmIGRlbHRhLnN0YXRlLmN1cnJlbnQgPT09ICdpbnRlcnJ1cHRlZCcpIHtcbiAgICAgIGNvbnN0IGVyckNvZGUgPSBkZWx0YS5lcnJvcj8uY3VycmVudCB8fCAnVU5LTk9XTic7XG4gICAgICBjb25zdCB1c2VyTWVzc2FnZSA9IHVzZXJNZXNzYWdlRm9yRG93bmxvYWRFcnJvcihlcnJDb2RlLCBwZW5kaW5nKTtcbiAgICAgIHNlbmRTdGF0dXNUb1RhYihwZW5kaW5nLCAnaW50ZXJydXB0ZWQnLCB1c2VyTWVzc2FnZSwgZXJyQ29kZSk7XG4gICAgICBwZW5kaW5nQnlEb3dubG9hZElkLmRlbGV0ZShkZWx0YS5pZCk7XG4gICAgICBwZW5kaW5nQnlSZXF1ZXN0SWQuZGVsZXRlKHBlbmRpbmcucmVxdWVzdElkKTtcbiAgICB9XG4gIH0pO1xuXG4gIC8qIC0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICAgKiBydW50aW1lLm9uTWVzc2FnZTogQ1FEX0RPV05MT0FEXG4gICAqICAtPiBzdGFydCBkb3dubG9hZCB2aWEgY2hyb21lLmRvd25sb2Fkc1xuICAgKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbiAgY2hyb21lLnJ1bnRpbWUub25NZXNzYWdlLmFkZExpc3RlbmVyKChtZXNzYWdlLCBzZW5kZXIsIHNlbmRSZXNwb25zZSkgPT4ge1xuICAgIGlmICghbWVzc2FnZSB8fCBtZXNzYWdlLnR5cGUgIT09ICdDUURfRE9XTkxPQUQnKSB7XG4gICAgICByZXR1cm47XG4gICAgfVxuXG4gICAgY29uc3QgcmF3VXJsID0gdHlwZW9mIG1lc3NhZ2UudXJsID09PSAnc3RyaW5nJyA/IG1lc3NhZ2UudXJsIDogbnVsbDtcbiAgICBjb25zdCByZXF1ZXN0SWQgPVxuICAgICAgdHlwZW9mIG1lc3NhZ2UucmVxdWVzdElkID09PSAnc3RyaW5nJ1xuICAgICAgICA/IG1lc3NhZ2UucmVxdWVzdElkXG4gICAgICAgIDogYHJlcS0ke0RhdGUubm93KCl9YDtcbiAgICBjb25zdCBmaWxlTWV0YTogRmlsZU1ldGFNc2cgfCB1bmRlZmluZWQgPSBtZXNzYWdlLmZpbGVNZXRhO1xuXG4gICAgaWYgKCFyYXdVcmwpIHtcbiAgICAgIHNlbmRSZXNwb25zZT8uKHtcbiAgICAgICAgc3RhcnRlZDogZmFsc2UsXG4gICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgdXNlck1lc3NhZ2U6ICdObyB2YWxpZCBkb3dubG9hZCBsaW5rIGZvciB0aGlzIGF0dGFjaG1lbnQuJyxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICghY2hyb21lLmRvd25sb2FkcyB8fCB0eXBlb2YgY2hyb21lLmRvd25sb2Fkcy5kb3dubG9hZCAhPT0gJ2Z1bmN0aW9uJykge1xuICAgICAgc2VuZFJlc3BvbnNlPy4oe1xuICAgICAgICBzdGFydGVkOiBmYWxzZSxcbiAgICAgICAgcmVxdWVzdElkLFxuICAgICAgICB1c2VyTWVzc2FnZTpcbiAgICAgICAgICAnQnJvd3NlciBkb2VzIG5vdCBhbGxvdyBiYWNrZ3JvdW5kIGRvd25sb2FkcyBmb3IgdGhpcyBleHRlbnNpb24uJyxcbiAgICAgIH0pO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGNvbnN0IHRhYklkID0gc2VuZGVyLnRhYj8uaWQ7XG4gICAgY29uc3QgdXJsID0gcmF3VXJsO1xuXG4gICAgY29uc3QgcGVuZGluZzogUGVuZGluZ0Rvd25sb2FkID0ge1xuICAgICAgcmVxdWVzdElkLFxuICAgICAgdXJsLFxuICAgICAgZmlsZU1ldGEsXG4gICAgICB0YWJJZCxcbiAgICB9O1xuXG4gICAgcGVuZGluZ0J5UmVxdWVzdElkLnNldChyZXF1ZXN0SWQsIHBlbmRpbmcpO1xuICAgIHBlbmRpbmdCeVVybC5zZXQodXJsLCBwZW5kaW5nKTtcblxuICAgIGNocm9tZS5kb3dubG9hZHMuZG93bmxvYWQoXG4gICAgICB7XG4gICAgICAgIHVybCxcbiAgICAgICAgc2F2ZUFzOiBmYWxzZSxcbiAgICAgICAgY29uZmxpY3RBY3Rpb246ICd1bmlxdWlmeScsXG4gICAgICB9LFxuICAgICAgKGRvd25sb2FkSWQpID0+IHtcbiAgICAgICAgY29uc3QgZXJyID0gY2hyb21lLnJ1bnRpbWUubGFzdEVycm9yO1xuICAgICAgICBpZiAoZXJyIHx8IGRvd25sb2FkSWQgPT09IHVuZGVmaW5lZCB8fCBkb3dubG9hZElkID09PSBudWxsKSB7XG4gICAgICAgICAgY29uc29sZS53YXJuKCdbQ1FEXSBkb3dubG9hZHMuZG93bmxvYWQgZXJyb3I6JywgZXJyPy5tZXNzYWdlKTtcblxuICAgICAgICAgIHBlbmRpbmdCeVJlcXVlc3RJZC5kZWxldGUocmVxdWVzdElkKTtcbiAgICAgICAgICBwZW5kaW5nQnlVcmwuZGVsZXRlKHVybCk7XG5cbiAgICAgICAgICBzZW5kUmVzcG9uc2U/Lih7XG4gICAgICAgICAgICBzdGFydGVkOiBmYWxzZSxcbiAgICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICAgIHVzZXJNZXNzYWdlOlxuICAgICAgICAgICAgICAnQnJvd3NlciBjb3VsZCBub3Qgc3RhcnQgdGhlIGRvd25sb2FkLiBUcnkgYWdhaW4gb3Igb3BlbiBpdCBub3JtYWxseS4nLFxuICAgICAgICAgIH0pO1xuICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIHBlbmRpbmdCeURvd25sb2FkSWQuc2V0KGRvd25sb2FkSWQsIHBlbmRpbmcpO1xuXG4gICAgICAgIHNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgIGNvbnN0IHN0aWxsUGVuZGluZyA9IHBlbmRpbmdCeVJlcXVlc3RJZC5nZXQocmVxdWVzdElkKTtcbiAgICAgICAgICBpZiAoIXN0aWxsUGVuZGluZykgcmV0dXJuO1xuXG4gICAgICAgICAgc2VuZFN0YXR1c1RvVGFiKFxuICAgICAgICAgICAgc3RpbGxQZW5kaW5nLFxuICAgICAgICAgICAgJ2ludGVycnVwdGVkJyxcbiAgICAgICAgICAgICdEb3dubG9hZCBpcyB0YWtpbmcgdG9vIGxvbmcuIENoZWNrIERvd25sb2FkcyBvciB0cnkgYWdhaW4uJyxcbiAgICAgICAgICAgICdUSU1FT1VUX1dBVENIRE9HJyxcbiAgICAgICAgICApO1xuICAgICAgICAgIHBlbmRpbmdCeVJlcXVlc3RJZC5kZWxldGUocmVxdWVzdElkKTtcbiAgICAgICAgICBmb3IgKGNvbnN0IFtpZCwgcF0gb2YgcGVuZGluZ0J5RG93bmxvYWRJZC5lbnRyaWVzKCkpIHtcbiAgICAgICAgICAgIGlmIChwLnJlcXVlc3RJZCA9PT0gcmVxdWVzdElkKSB7XG4gICAgICAgICAgICAgIHBlbmRpbmdCeURvd25sb2FkSWQuZGVsZXRlKGlkKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICB9XG4gICAgICAgIH0sIDUgKiA2MCAqIDEwMDApO1xuXG4gICAgICAgIHNlbmRSZXNwb25zZT8uKHtcbiAgICAgICAgICBzdGFydGVkOiB0cnVlLFxuICAgICAgICAgIHJlcXVlc3RJZCxcbiAgICAgICAgICBkb3dubG9hZElkLFxuICAgICAgICB9KTtcbiAgICAgIH0sXG4gICAgKTtcblxuICAgIHJldHVybiB0cnVlO1xuICB9KTtcbn0pO1xuXG4vKiAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogSGVscGVyc1xuICogLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuZnVuY3Rpb24gc2FmZUhvc3RuYW1lKHVybDogc3RyaW5nKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcbiAgdHJ5IHtcbiAgICByZXR1cm4gbmV3IFVSTCh1cmwpLmhvc3RuYW1lO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xuICB9XG59XG5cbi8vIEhUTUwgcmVzb2x2ZXIgZm9yIFwid2VicGFnZSBpbnN0ZWFkIG9mIGZpbGVcIiBjYXNlcyBmcm9tIERyaXZlLlxuYXN5bmMgZnVuY3Rpb24gdHJ5UmVzb2x2ZURyaXZlVmlydXNJbnRlcnN0aXRpYWwoXG4gIHVybDogc3RyaW5nLFxuKTogUHJvbWlzZTxEcml2ZUludGVyc3RpdGlhbFJlc3VsdD4ge1xuICBjb25zdCBob3N0ID0gc2FmZUhvc3RuYW1lKHVybCk7XG4gIGlmIChcbiAgICBob3N0ICE9PSAnZHJpdmUuZ29vZ2xlLmNvbScgJiZcbiAgICBob3N0ICE9PSAnY2xhc3Nyb29tLmdvb2dsZS5jb20nICYmXG4gICAgaG9zdCAhPT0gJ2RyaXZlLnVzZXJjb250ZW50Lmdvb2dsZS5jb20nXG4gICkge1xuICAgIHJldHVybiBudWxsO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCByZXMgPSBhd2FpdCBmZXRjaCh1cmwsIHtcbiAgICAgIG1ldGhvZDogJ0dFVCcsXG4gICAgICByZWRpcmVjdDogJ2ZvbGxvdycsXG4gICAgICBjcmVkZW50aWFsczogJ2luY2x1ZGUnLFxuICAgIH0pO1xuXG4gICAgY29uc3QgZmluYWxIb3N0ID0gc2FmZUhvc3RuYW1lKHJlcy51cmwgfHwgdXJsKTtcblxuICAgIC8vIFJlZGlyZWN0IHRvIGFjY291bnRzLmdvb2dsZS5jb20gZXRjLiAtPiBsb2dpbiBpc3N1ZVxuICAgIGlmIChmaW5hbEhvc3QgJiYgZmluYWxIb3N0ICE9PSAnZHJpdmUuZ29vZ2xlLmNvbScpIHtcbiAgICAgIGNvbnN0IGxvd2VyVXJsID0gKHJlcy51cmwgfHwgdXJsKS50b0xvd2VyQ2FzZSgpO1xuICAgICAgaWYgKGxvd2VyVXJsLmluY2x1ZGVzKCdhY2NvdW50cy5nb29nbGUuY29tJykpIHtcbiAgICAgICAgcmV0dXJuIHtcbiAgICAgICAgICBvazogZmFsc2UsXG4gICAgICAgICAgcmVhc29uOiAnbG9naW5fcmVxdWlyZWQnLFxuICAgICAgICAgIHVzZXJNZXNzYWdlOlxuICAgICAgICAgICAgJ1NpZ24gaW4gdG8gdGhlIHJpZ2h0IEdvb2dsZSBhY2NvdW50IGluIGEgbm9ybWFsIHRhYiwgdGhlbiB0cnkgYWdhaW4uJyxcbiAgICAgICAgfTtcbiAgICAgIH1cbiAgICAgIC8vIENvdWxkIGJlIHVzZXJjb250ZW50IGhlcmUsIGJ1dCBpZiBpdCdzIGFscmVhZHkgdGhlIGZpbGUsIHRoZXJlIGlzIG5vIEhUTUwgdG8gcGFyc2UuXG4gICAgICAvLyBXZSBzdGlsbCBjb250aW51ZSBiZWxvdyB3aXRoIEhUTUwgcGFyc2luZy5cbiAgICB9XG5cbiAgICBpZiAocmVzLnN0YXR1cyA9PT0gNDAxKSB7XG4gICAgICByZXR1cm4ge1xuICAgICAgICBvazogZmFsc2UsXG4gICAgICAgIHJlYXNvbjogJ2xvZ2luX3JlcXVpcmVkJyxcbiAgICAgICAgdXNlck1lc3NhZ2U6XG4gICAgICAgICAgJ1NpZ24gaW4gdG8gdGhlIHJpZ2h0IEdvb2dsZSBhY2NvdW50IGluIGEgbm9ybWFsIHRhYiwgdGhlbiB0cnkgYWdhaW4uJyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgaWYgKHJlcy5zdGF0dXMgPT09IDQwMykge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICByZWFzb246ICdwZXJtaXNzaW9uX3JlcXVpcmVkJyxcbiAgICAgICAgdXNlck1lc3NhZ2U6XG4gICAgICAgICAgJ1lvdSBuZWVkIHBlcm1pc3Npb24gZm9yIHRoaXMgZmlsZS4gT3BlbiBpdCBpbiBhIHRhYiBhbmQgY2xpY2sg4oCcUmVxdWVzdCBhY2Nlc3PigJ0uJyxcbiAgICAgIH07XG4gICAgfVxuXG4gICAgY29uc3QgdGV4dCA9IGF3YWl0IHJlcy50ZXh0KCk7XG4gICAgY29uc3QgbG93ZXIgPSB0ZXh0LnRvTG93ZXJDYXNlKCk7XG5cbiAgICAvLyAxKSBUcnkgdG8gZmluZCBhbnkgY29uZmlybT0gVVJMIChhbmNob3IsIGRhdGEtaHJlZiwgb3IgZm9ybSBhY3Rpb24pXG4gICAgY29uc3QgaHJlZk1hdGNoID1cbiAgICAgIHRleHQubWF0Y2goL2hyZWY9W1wiJ10oW15cIiddKj9jb25maXJtPVteXCInXSs/KVtcIiddL2kpIHx8XG4gICAgICB0ZXh0Lm1hdGNoKC9kYXRhLWhyZWY9W1wiJ10oW15cIiddKj9jb25maXJtPVteXCInXSs/KVtcIiddL2kpO1xuICAgIGNvbnN0IGFjdGlvbk1hdGNoID1cbiAgICAgIHRleHQubWF0Y2goL2FjdGlvbj1bXCInXShbXlwiJ10qP2NvbmZpcm09W15cIiddKz8pW1wiJ10vaSk7XG5cbiAgICBjb25zdCBleHBsaWNpdENvbmZpcm0gPSBocmVmTWF0Y2ggfHwgYWN0aW9uTWF0Y2g7XG4gICAgaWYgKGV4cGxpY2l0Q29uZmlybSkge1xuICAgICAgY29uc3QgcmF3ID0gZXhwbGljaXRDb25maXJtWzFdO1xuICAgICAgdHJ5IHtcbiAgICAgICAgY29uc3QgY29uZmlybVVybCA9IG5ldyBVUkwocmF3LCByZXMudXJsIHx8IHVybCkudG9TdHJpbmcoKTtcbiAgICAgICAgcmV0dXJuIHsgb2s6IHRydWUsIGZpbmFsVXJsOiBjb25maXJtVXJsIH07XG4gICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgIGNvbnNvbGUud2FybignW0NRRF0gY291bGQgbm90IGJ1aWxkIGNvbmZpcm0gVVJMIGZyb20gbWF0Y2gnLCBlKTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyAyKSBUcnkgdG8gc2ltdWxhdGUgcHJlc3NpbmcgdGhlIFwiRG93bmxvYWQgYW55d2F5XCIgYnV0dG9uIGJ5XG4gICAgLy8gICAgcGFyc2luZyA8Zm9ybSAuLi4gYWN0aW9uPVwiaHR0cHM6Ly9kcml2ZS51c2VyY29udGVudC5nb29nbGUuY29tL2Rvd25sb2FkXCI+LlxuICAgIGNvbnN0IGZvcm1VcmwgPSBleHRyYWN0RG93bmxvYWRGb3JtVXJsKHRleHQsIHJlcy51cmwgfHwgdXJsKTtcbiAgICBpZiAoZm9ybVVybCkge1xuICAgICAgcmV0dXJuIHsgb2s6IHRydWUsIGZpbmFsVXJsOiBmb3JtVXJsIH07XG4gICAgfVxuXG4gICAgLy8gMykgTm8gZXhwbGljaXQgY29uZmlybSBsaW5rL2Zvcm0gZm91bmQg4oCTIGNsYXNzaWZ5IHBhZ2UgYnkgY29udGVudFxuXG4gICAgLy8gXCJZb3UgbmVlZCBhY2Nlc3NcIiAvIHBlcm1pc3Npb24gcGFnZVxuICAgIGlmIChsb3dlci5pbmNsdWRlcygneW91IG5lZWQgYWNjZXNzJykgfHwgbG93ZXIuaW5jbHVkZXMoJ3JlcXVlc3QgYWNjZXNzJykpIHtcbiAgICAgIHJldHVybiB7XG4gICAgICAgIG9rOiBmYWxzZSxcbiAgICAgICAgcmVhc29uOiAncGVybWlzc2lvbl9yZXF1aXJlZCcsXG4gICAgICAgIHVzZXJNZXNzYWdlOlxuICAgICAgICAgICdZb3UgbmVlZCBwZXJtaXNzaW9uIGZvciB0aGlzIGZpbGUuIE9wZW4gaXQgaW4gYSB0YWIgYW5kIGNsaWNrIOKAnFJlcXVlc3QgYWNjZXNz4oCdLicsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIExvZ2luIC8gc2lnbi1pblxuICAgIGlmIChcbiAgICAgIGxvd2VyLmluY2x1ZGVzKCdzaWduIGluJykgJiZcbiAgICAgIChsb3dlci5pbmNsdWRlcygndG8gY29udGludWUgdG8gZ29vZ2xlIGRyaXZlJykgfHxcbiAgICAgICAgbG93ZXIuaW5jbHVkZXMoJ3RvIGNvbnRpbnVlIHRvIGRyaXZlJykgfHxcbiAgICAgICAgbG93ZXIuaW5jbHVkZXMoJ3RvIGNvbnRpbnVlIHRvIGdvb2dsZScpKVxuICAgICkge1xuICAgICAgcmV0dXJuIHtcbiAgICAgICAgb2s6IGZhbHNlLFxuICAgICAgICByZWFzb246ICdsb2dpbl9yZXF1aXJlZCcsXG4gICAgICAgIHVzZXJNZXNzYWdlOlxuICAgICAgICAgICdTaWduIGluIHRvIHRoZSByaWdodCBHb29nbGUgYWNjb3VudCBpbiBhIG5vcm1hbCB0YWIsIHRoZW4gdHJ5IGFnYWluLicsXG4gICAgICB9O1xuICAgIH1cblxuICAgIC8vIDQpIFZpcnVzIHNjYW4gaW50ZXJzdGl0aWFsICh2YXJpb3VzIHBocmFzaW5ncylcbiAgICBjb25zdCBsb29rc0xpa2VWaXJ1c1BhZ2UgPVxuICAgICAgbG93ZXIuaW5jbHVkZXMoXCJjYW4ndCBiZSBzY2FubmVkIGZvciB2aXJ1c2VzXCIpIHx8XG4gICAgICBsb3dlci5pbmNsdWRlcygnY2FudCBiZSBzY2FubmVkIGZvciB2aXJ1c2VzJykgfHxcbiAgICAgIGxvd2VyLmluY2x1ZGVzKFwiY2FuJ3Qgc2NhbiB0aGlzIGZpbGUgZm9yIHZpcnVzZXNcIikgfHxcbiAgICAgIGxvd2VyLmluY2x1ZGVzKCdjYW50IHNjYW4gdGhpcyBmaWxlIGZvciB2aXJ1c2VzJykgfHxcbiAgICAgIGxvd2VyLmluY2x1ZGVzKCd0b28gbGFyZ2UgZm9yIGdvb2dsZSB0byBzY2FuJykgfHxcbiAgICAgIGxvd2VyLmluY2x1ZGVzKCd0b28gbGFyZ2UgdG8gYmUgc2Nhbm5lZCBmb3IgdmlydXNlcycpIHx8XG4gICAgICBsb3dlci5pbmNsdWRlcygnZG93bmxvYWQgYW55d2F5Jyk7XG5cbiAgICBpZiAobG9va3NMaWtlVmlydXNQYWdlKSB7XG4gICAgICAvLyBUcnkgYSBzeW50aGV0aWMgXCJjb25maXJtXCIgVVJMIGJhc2VkIG9uIHRoZSBEcml2ZSAvdWMgZW5kcG9pbnRcbiAgICAgIGNvbnN0IGNvbmZpcm1VcmwgPSBidWlsZENvbmZpcm1VcmxGcm9tVmlydXNQYWdlKHVybCwgcmVzLnVybCk7XG4gICAgICBpZiAoY29uZmlybVVybCkge1xuICAgICAgICByZXR1cm4geyBvazogdHJ1ZSwgZmluYWxVcmw6IGNvbmZpcm1VcmwgfTtcbiAgICAgIH1cblxuICAgICAgLy8gQXMgYW4gZXh0cmEgZmFsbGJhY2ssIGd1ZXNzIGEgZGlyZWN0IGRyaXZlLnVzZXJjb250ZW50Lmdvb2dsZS5jb20gVVJMXG4gICAgICBjb25zdCB1c2VyQ29udGVudEd1ZXNzID0gYnVpbGRVc2VyQ29udGVudERvd25sb2FkR3Vlc3ModXJsLCByZXMudXJsKTtcbiAgICAgIGlmICh1c2VyQ29udGVudEd1ZXNzKSB7XG4gICAgICAgIHJldHVybiB7IG9rOiB0cnVlLCBmaW5hbFVybDogdXNlckNvbnRlbnRHdWVzcyB9O1xuICAgICAgfVxuXG4gICAgICByZXR1cm4ge1xuICAgICAgICBvazogZmFsc2UsXG4gICAgICAgIHJlYXNvbjogJ3ZpcnVzX2ludGVyc3RpdGlhbCcsXG4gICAgICAgIHVzZXJNZXNzYWdlOlxuICAgICAgICAgICdHb29nbGUgY2Fu4oCZdCBzY2FuIHRoaXMgZmlsZS4gT3BlbiBpdCBhbmQgY2xpY2sg4oCcRG93bmxvYWQgYW55d2F54oCdLCB0aGVuIHRyeSBhZ2Fpbi4nLFxuICAgICAgfTtcbiAgICB9XG5cbiAgICAvLyBEZWZhdWx0OiBzb21lIG90aGVyIERyaXZlIEhUTUwgcGFnZVxuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgcmVhc29uOiAnb3RoZXJfaHRtbCcgfTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybignW0NRRF0gdHJ5UmVzb2x2ZURyaXZlVmlydXNJbnRlcnN0aXRpYWwgZmFpbGVkOicsIGUpO1xuICAgIHJldHVybiB7IG9rOiBmYWxzZSwgcmVhc29uOiAnb3RoZXJfaHRtbCcgfTtcbiAgfVxufVxuXG5mdW5jdGlvbiB1c2VyTWVzc2FnZUZvckRvd25sb2FkRXJyb3IoXG4gIGVycm9yQ29kZTogc3RyaW5nLFxuICBwZW5kaW5nOiBQZW5kaW5nRG93bmxvYWQsXG4pOiBzdHJpbmcge1xuICBjb25zdCBkaXNwbGF5TmFtZSA9IHBlbmRpbmcuZmlsZU1ldGE/Lm5hbWVcbiAgICA/IGBcIiR7cGVuZGluZy5maWxlTWV0YS5uYW1lfVwiYFxuICAgIDogJ3RoaXMgZmlsZSc7XG5cbiAgc3dpdGNoIChlcnJvckNvZGUpIHtcbiAgICAvLyAtLS0tLS0tLSBGSUxFIFNZU1RFTSAvIERJU0sgUFJPQkxFTVMgLS0tLS0tLS1cbiAgICBjYXNlICdGSUxFX05PX1NQQUNFJzpcbiAgICAgIHJldHVybiAnTm90IGVub3VnaCBkaXNrIHNwYWNlLiBGcmVlIHNvbWUgc3BhY2UgYW5kIHRyeSBhZ2Fpbi4nO1xuICAgIGNhc2UgJ0ZJTEVfQUNDRVNTX0RFTklFRCc6XG4gICAgICByZXR1cm4gJ0Jyb3dzZXIgY291bGQgbm90IHdyaXRlIHRvIERvd25sb2Fkcy4gQ2hlY2sgZm9sZGVyIHBlcm1pc3Npb25zLic7XG4gICAgY2FzZSAnRklMRV9GQUlMRUQnOlxuICAgICAgcmV0dXJuIGBQcm9ibGVtIHNhdmluZyAke2Rpc3BsYXlOYW1lfS4gVHJ5IGFnYWluLmA7XG4gICAgY2FzZSAnRklMRV9OQU1FX1RPT19MT05HJzpcbiAgICAgIHJldHVybiAnRmlsZSBuYW1lIGlzIHRvbyBsb25nLiBSZW5hbWUgaXQgaW4gRHJpdmUgYW5kIHRyeSBhZ2Fpbi4nO1xuICAgIGNhc2UgJ0ZJTEVfVE9PX0xBUkdFJzpcbiAgICAgIHJldHVybiBgJHtkaXNwbGF5TmFtZX0gaXMgdG9vIGxhcmdlLiBUcnkgZG93bmxvYWRpbmcgaXQgZGlyZWN0bHkgZnJvbSBHb29nbGUgRHJpdmUuYDtcbiAgICBjYXNlICdGSUxFX1ZJUlVTX0lORkVDVEVEJzpcbiAgICBjYXNlICdGSUxFX0JMT0NLRUQnOlxuICAgIGNhc2UgJ0ZJTEVfU0VDVVJJVFlfQ0hFQ0tfRkFJTEVEJzpcbiAgICAgIHJldHVybiBgJHtkaXNwbGF5TmFtZX0gd2FzIGJsb2NrZWQgYXMgdW5zYWZlLiBDaGVjayB0aGUgYnJvd3NlcuKAmXMgRG93bmxvYWRzIGxpc3QuYDtcblxuICAgIC8vIC0tLS0tLS0tIE5FVFdPUksgUFJPQkxFTVMgLS0tLS0tLS1cbiAgICBjYXNlICdORVRXT1JLX0ZBSUxFRCc6XG4gICAgY2FzZSAnTkVUV09SS19USU1FT1VUJzpcbiAgICBjYXNlICdORVRXT1JLX0RJU0NPTk5FQ1RFRCc6XG4gICAgICByZXR1cm4gYE5ldHdvcmsgZXJyb3Igd2hpbGUgZG93bmxvYWRpbmcgJHtkaXNwbGF5TmFtZX0uIENoZWNrIHlvdXIgY29ubmVjdGlvbiBhbmQgdHJ5IGFnYWluLmA7XG4gICAgY2FzZSAnTkVUV09SS19TRVJWRVJfRE9XTic6XG4gICAgICByZXR1cm4gJ0dvb2dsZeKAmXMgc2VydmVycyBjb3VsZCBub3QgYmUgcmVhY2hlZC4gVHJ5IGFnYWluIGxhdGVyLic7XG5cbiAgICAvLyAtLS0tLS0tLSBTRVJWRVIgLyBIVFRQIFBST0JMRU1TIC0tLS0tLS0tXG4gICAgY2FzZSAnU0VSVkVSX0ZBSUxFRCc6XG4gICAgY2FzZSAnU0VSVkVSX0JBRF9DT05URU5UJzpcbiAgICAgIHJldHVybiBgR29vZ2xlIGhhZCBhIHByb2JsZW0gc2VuZGluZyAke2Rpc3BsYXlOYW1lfS4gVHJ5IGFnYWluIGxhdGVyLmA7XG4gICAgY2FzZSAnU0VSVkVSX05PX1JBTkdFJzpcbiAgICAgIHJldHVybiAnU2VydmVyIGRvZXMgbm90IHN1cHBvcnQgcGFydGlhbCBkb3dubG9hZHMuIFRyeSBkb3dubG9hZGluZyBkaXJlY3RseSBmcm9tIERyaXZlLic7XG4gICAgY2FzZSAnU0VSVkVSX1VOQVVUSE9SSVpFRCc6XG4gICAgY2FzZSAnU0VSVkVSX0ZPUkJJRERFTic6XG4gICAgICByZXR1cm4gYFlvdSBkb27igJl0IGhhdmUgcGVybWlzc2lvbiBmb3IgJHtkaXNwbGF5TmFtZX0uIE9wZW4gaXQgaW4gYSB0YWIgKGxvZ2luIC8gcmVxdWVzdCBhY2Nlc3MpIGFuZCB0cnkgYWdhaW4uYDtcblxuICAgIC8vIC0tLS0tLS0tIFVTRVIgLyBCUk9XU0VSIEFDVElPTlMgLS0tLS0tLS1cbiAgICBjYXNlICdVU0VSX0NBTkNFTEVEJzpcbiAgICAgIHJldHVybiAnWW91IGNhbmNlbGxlZCB0aGlzIGRvd25sb2FkLic7XG4gICAgY2FzZSAnQ1JBU0gnOlxuICAgICAgcmV0dXJuICdUaGUgYnJvd3NlciBwcm9jZXNzIGNyYXNoZWQuIFJlb3BlbiB0aGUgYnJvd3NlciBhbmQgdHJ5IGFnYWluLic7XG5cbiAgICBkZWZhdWx0OlxuICAgICAgcmV0dXJuICdUaGUgZG93bmxvYWQgd2FzIGludGVycnVwdGVkLiBUcnkgYWdhaW4gb3Igb3BlbiB0aGUgZmlsZSBub3JtYWxseSBpbiBhIHRhYi4nO1xuICB9XG59XG5cbmZ1bmN0aW9uIHNlbmRTdGF0dXNUb1RhYihcbiAgcGVuZGluZzogUGVuZGluZ0Rvd25sb2FkLFxuICBzdGF0dXM6IERvd25sb2FkU3RhdHVzLFxuICB1c2VyTWVzc2FnZT86IHN0cmluZyxcbiAgZXJyb3JDb2RlPzogc3RyaW5nLFxuKTogdm9pZCB7XG4gIGlmIChwZW5kaW5nLnRhYklkID09IG51bGwpIHJldHVybjtcblxuICB0cnkge1xuICAgIGNocm9tZS50YWJzLnNlbmRNZXNzYWdlKHBlbmRpbmcudGFiSWQsIHtcbiAgICAgIHR5cGU6ICdDUURfRE9XTkxPQURfU1RBVFVTJyxcbiAgICAgIHJlcXVlc3RJZDogcGVuZGluZy5yZXF1ZXN0SWQsXG4gICAgICBzdGF0dXMsXG4gICAgICBlcnJvckNvZGUsXG4gICAgICB1c2VyTWVzc2FnZSxcbiAgICB9KTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybignW0NRRF0gc2VuZFN0YXR1c1RvVGFiIGZhaWxlZDonLCBlKTtcbiAgfVxufVxuXG5mdW5jdGlvbiBnZXRGaWxlbmFtZUV4dChmaWxlbmFtZT86IHN0cmluZyk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG4gIGlmICghZmlsZW5hbWUpIHJldHVybiB1bmRlZmluZWQ7XG4gIGNvbnN0IG0gPSBmaWxlbmFtZS5tYXRjaCgvXFwuKFthLXpBLVowLTldezEsNn0pJC8pO1xuICByZXR1cm4gbSA/IG1bMV0udG9Mb3dlckNhc2UoKSA6IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBUcnkgdG8gcmVjb25zdHJ1Y3QgdGhlIFVSTCB0aGF0IHRoZSBcIkRvd25sb2FkIGFueXdheVwiIGJ1dHRvbiBzdWJtaXRzOlxuICogPGZvcm0gLi4uIGFjdGlvbj1cImh0dHBzOi8vZHJpdmUudXNlcmNvbnRlbnQuZ29vZ2xlLmNvbS9kb3dubG9hZFwiPlxuICogICA8aW5wdXQgdHlwZT1cImhpZGRlblwiIG5hbWU9XCJpZFwiIHZhbHVlPVwiLi4uXCI+XG4gKiAgIC4uLlxuICogPC9mb3JtPlxuICovXG5mdW5jdGlvbiBleHRyYWN0RG93bmxvYWRGb3JtVXJsKGh0bWw6IHN0cmluZywgYmFzZVVybDogc3RyaW5nKTogc3RyaW5nIHwgbnVsbCB7XG4gIC8vIEZpcnN0LCBwcmVmZXIgYW4gZXhwbGljaXQgaWQ9XCJkb3dubG9hZC1mb3JtXCIgaWYgcHJlc2VudFxuICBsZXQgZm9ybU1hdGNoID1cbiAgICBodG1sLm1hdGNoKFxuICAgICAgLzxmb3JtW14+XSppZD1bXCInXWRvd25sb2FkLWZvcm1bXCInXVtePl0qYWN0aW9uPVtcIiddKFteXCInXSspW1wiJ11bXj5dKj4oW1xcc1xcU10qPyk8XFwvZm9ybT4vaSxcbiAgICApIHx8XG4gICAgLy8gRmFsbGJhY2s6IGFueSBmb3JtIHRoYXQgcG9zdHMgdG8gZHJpdmUudXNlcmNvbnRlbnQuZ29vZ2xlLmNvbS9kb3dubG9hZFxuICAgIGh0bWwubWF0Y2goXG4gICAgICAvPGZvcm1bXj5dKmFjdGlvbj1bXCInXShbXlwiJ10qZHJpdmVcXC51c2VyY29udGVudFxcLmdvb2dsZVxcLmNvbVxcL2Rvd25sb2FkW15cIiddKilbXCInXVtePl0qPihbXFxzXFxTXSo/KTxcXC9mb3JtPi9pLFxuICAgICk7XG5cbiAgaWYgKCFmb3JtTWF0Y2gpIHJldHVybiBudWxsO1xuXG4gIGNvbnN0IGFjdGlvbiA9IGZvcm1NYXRjaFsxXTtcbiAgY29uc3QgaW5uZXIgPSBmb3JtTWF0Y2hbMl07XG5cbiAgY29uc3QgcGFyYW1zID0gbmV3IFVSTFNlYXJjaFBhcmFtcygpO1xuICBjb25zdCBpbnB1dFJlZ2V4ID1cbiAgICAvPGlucHV0W14+XSpuYW1lPVtcIiddKFteXCInXSspW1wiJ11bXj5dKnZhbHVlPVtcIiddKFteXCInXSopW1wiJ11bXj5dKj4vZ2k7XG5cbiAgbGV0IG06IFJlZ0V4cEV4ZWNBcnJheSB8IG51bGw7XG4gIHdoaWxlICgobSA9IGlucHV0UmVnZXguZXhlYyhpbm5lcikpKSB7XG4gICAgY29uc3QgbmFtZSA9IG1bMV07XG4gICAgY29uc3QgdmFsdWUgPSBtWzJdO1xuICAgIHBhcmFtcy5zZXQobmFtZSwgdmFsdWUpO1xuICB9XG5cbiAgdHJ5IHtcbiAgICBjb25zdCBhY3Rpb25VcmwgPSBuZXcgVVJMKGFjdGlvbiwgYmFzZVVybCk7XG4gICAgY29uc3Qgc3AgPSBhY3Rpb25Vcmwuc2VhcmNoUGFyYW1zO1xuXG4gICAgcGFyYW1zLmZvckVhY2goKHZhbHVlLCBrZXkpID0+IHtcbiAgICAgIHNwLnNldChrZXksIHZhbHVlKTtcbiAgICB9KTtcblxuICAgIHJldHVybiBhY3Rpb25VcmwudG9TdHJpbmcoKTtcbiAgfSBjYXRjaCAoZSkge1xuICAgIGNvbnNvbGUud2FybignW0NRRF0gZXh0cmFjdERvd25sb2FkRm9ybVVybDogZmFpbGVkIHRvIGJ1aWxkIFVSTCcsIGUpO1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogT2xkZXIgc3R5bGU6IGJ1aWxkIGEgL3VjP2V4cG9ydD1kb3dubG9hZCZjb25maXJtPS4uLiBVUkwgZnJvbSBhIERyaXZlIHBhZ2UuXG4gKi9cbmZ1bmN0aW9uIGJ1aWxkQ29uZmlybVVybEZyb21WaXJ1c1BhZ2UoXG4gIG9yaWdpbmFsVXJsOiBzdHJpbmcsXG4gIHJlc3BvbnNlVXJsPzogc3RyaW5nLFxuKTogc3RyaW5nIHwgbnVsbCB7XG4gIGNvbnN0IGNhbmRpZGF0ZSA9IHJlc3BvbnNlVXJsIHx8IG9yaWdpbmFsVXJsO1xuXG4gIHRyeSB7XG4gICAgY29uc3QgdSA9IG5ldyBVUkwoY2FuZGlkYXRlKTtcblxuICAgIGlmICh1Lmhvc3RuYW1lICE9PSAnZHJpdmUuZ29vZ2xlLmNvbScpIHJldHVybiBudWxsO1xuXG4gICAgLy8gVHJ5IHRvIGdldCB0aGUgZmlsZSBpZCBmcm9tIHF1ZXJ5XG4gICAgbGV0IGlkID0gdS5zZWFyY2hQYXJhbXMuZ2V0KCdpZCcpIHx8IHVuZGVmaW5lZDtcblxuICAgIC8vIEZhbGxiYWNrOiAvZmlsZS9kLzxpZD4vIHN0eWxlIFVSTHNcbiAgICBpZiAoIWlkKSB7XG4gICAgICBjb25zdCBtID0gdS5wYXRobmFtZS5tYXRjaCgvXFwvZmlsZVxcL2RcXC8oW14vXSspLyk7XG4gICAgICBpZiAobSkgaWQgPSBtWzFdO1xuICAgIH1cblxuICAgIGlmICghaWQpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgY29uZmlybVVybCA9IG5ldyBVUkwoJ2h0dHBzOi8vZHJpdmUuZ29vZ2xlLmNvbS91YycpO1xuICAgIGNvbmZpcm1Vcmwuc2VhcmNoUGFyYW1zLnNldCgnZXhwb3J0JywgJ2Rvd25sb2FkJyk7XG4gICAgY29uZmlybVVybC5zZWFyY2hQYXJhbXMuc2V0KCdpZCcsIGlkKTtcbiAgICAvLyBcInRcIiBpcyB3aGF0IERyaXZlIHVzZXMgaW4gdGhlIGhpZGRlbiBpbnB1dCBpbiB5b3VyIHNuaXBwZXQuXG4gICAgY29uZmlybVVybC5zZWFyY2hQYXJhbXMuc2V0KCdjb25maXJtJywgJ3QnKTtcblxuICAgIHJldHVybiBjb25maXJtVXJsLnRvU3RyaW5nKCk7XG4gIH0gY2F0Y2gge1xuICAgIHJldHVybiBudWxsO1xuICB9XG59XG5cbi8qKlxuICogRXh0cmEgZmFsbGJhY2s6IHRyeSB0byBkaXJlY3RseSBoaXQgZHJpdmUudXNlcmNvbnRlbnQuZ29vZ2xlLmNvbS9kb3dubG9hZFxuICogdXNpbmcgb25seSB0aGUgZmlsZSBpZCArIGF1dGh1c2VyLCB3aXRoIGNvbmZpcm09dC5cbiAqIFRoaXMgbWlycm9ycyB0aGUgVVJMIHlvdSBwYXN0ZWQ6XG4gKiAgIGh0dHBzOi8vZHJpdmUudXNlcmNvbnRlbnQuZ29vZ2xlLmNvbS9kb3dubG9hZD9pZD0uLi4mZXhwb3J0PWRvd25sb2FkJmF1dGh1c2VyPTAmY29uZmlybT10XG4gKi9cbmZ1bmN0aW9uIGJ1aWxkVXNlckNvbnRlbnREb3dubG9hZEd1ZXNzKFxuICBvcmlnaW5hbFVybDogc3RyaW5nLFxuICByZXNwb25zZVVybD86IHN0cmluZyxcbik6IHN0cmluZyB8IG51bGwge1xuICBjb25zdCBjYW5kaWRhdGUgPSByZXNwb25zZVVybCB8fCBvcmlnaW5hbFVybDtcblxuICB0cnkge1xuICAgIGNvbnN0IHUgPSBuZXcgVVJMKGNhbmRpZGF0ZSk7XG5cbiAgICAvLyBFeHRyYWN0IERyaXZlIGZpbGUgaWQgZnJvbSBxdWVyeSBvciAvZmlsZS9kLzxpZD4vIHBhdGhcbiAgICBsZXQgaWQgPSB1LnNlYXJjaFBhcmFtcy5nZXQoJ2lkJykgfHwgdW5kZWZpbmVkO1xuICAgIGlmICghaWQpIHtcbiAgICAgIGNvbnN0IG0gPSB1LnBhdGhuYW1lLm1hdGNoKC9cXC9maWxlXFwvZFxcLyhbXi9dKykvKTtcbiAgICAgIGlmIChtKSBpZCA9IG1bMV07XG4gICAgfVxuICAgIGlmICghaWQpIHJldHVybiBudWxsO1xuXG4gICAgY29uc3QgYXV0aHVzZXIgPSB1LnNlYXJjaFBhcmFtcy5nZXQoJ2F1dGh1c2VyJykgfHwgJzAnO1xuXG4gICAgY29uc3Qgb3V0ID0gbmV3IFVSTCgnaHR0cHM6Ly9kcml2ZS51c2VyY29udGVudC5nb29nbGUuY29tL2Rvd25sb2FkJyk7XG4gICAgb3V0LnNlYXJjaFBhcmFtcy5zZXQoJ2lkJywgaWQpO1xuICAgIG91dC5zZWFyY2hQYXJhbXMuc2V0KCdleHBvcnQnLCAnZG93bmxvYWQnKTtcbiAgICBvdXQuc2VhcmNoUGFyYW1zLnNldCgnYXV0aHVzZXInLCBhdXRodXNlcik7XG4gICAgb3V0LnNlYXJjaFBhcmFtcy5zZXQoJ2NvbmZpcm0nLCAndCcpOyAvLyBtYXRjaGVzIHlvdXIgZm9ybSdzIGhpZGRlbiB2YWx1ZVxuXG4gICAgcmV0dXJuIG91dC50b1N0cmluZygpO1xuICB9IGNhdGNoIHtcbiAgICByZXR1cm4gbnVsbDtcbiAgfVxufVxuIiwiLy8gI3JlZ2lvbiBzbmlwcGV0XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IGdsb2JhbFRoaXMuYnJvd3Nlcj8ucnVudGltZT8uaWRcbiAgPyBnbG9iYWxUaGlzLmJyb3dzZXJcbiAgOiBnbG9iYWxUaGlzLmNocm9tZTtcbi8vICNlbmRyZWdpb24gc25pcHBldFxuIiwiaW1wb3J0IHsgYnJvd3NlciBhcyBfYnJvd3NlciB9IGZyb20gXCJAd3h0LWRldi9icm93c2VyXCI7XG5leHBvcnQgY29uc3QgYnJvd3NlciA9IF9icm93c2VyO1xuZXhwb3J0IHt9O1xuIiwiLy8gc3JjL2luZGV4LnRzXG52YXIgX01hdGNoUGF0dGVybiA9IGNsYXNzIHtcbiAgY29uc3RydWN0b3IobWF0Y2hQYXR0ZXJuKSB7XG4gICAgaWYgKG1hdGNoUGF0dGVybiA9PT0gXCI8YWxsX3VybHM+XCIpIHtcbiAgICAgIHRoaXMuaXNBbGxVcmxzID0gdHJ1ZTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gWy4uLl9NYXRjaFBhdHRlcm4uUFJPVE9DT0xTXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IFwiKlwiO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gXCIqXCI7XG4gICAgfSBlbHNlIHtcbiAgICAgIGNvbnN0IGdyb3VwcyA9IC8oLiopOlxcL1xcLyguKj8pKFxcLy4qKS8uZXhlYyhtYXRjaFBhdHRlcm4pO1xuICAgICAgaWYgKGdyb3VwcyA9PSBudWxsKVxuICAgICAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIFwiSW5jb3JyZWN0IGZvcm1hdFwiKTtcbiAgICAgIGNvbnN0IFtfLCBwcm90b2NvbCwgaG9zdG5hbWUsIHBhdGhuYW1lXSA9IGdyb3VwcztcbiAgICAgIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCk7XG4gICAgICB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpO1xuICAgICAgdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKTtcbiAgICAgIHRoaXMucHJvdG9jb2xNYXRjaGVzID0gcHJvdG9jb2wgPT09IFwiKlwiID8gW1wiaHR0cFwiLCBcImh0dHBzXCJdIDogW3Byb3RvY29sXTtcbiAgICAgIHRoaXMuaG9zdG5hbWVNYXRjaCA9IGhvc3RuYW1lO1xuICAgICAgdGhpcy5wYXRobmFtZU1hdGNoID0gcGF0aG5hbWU7XG4gICAgfVxuICB9XG4gIGluY2x1ZGVzKHVybCkge1xuICAgIGlmICh0aGlzLmlzQWxsVXJscylcbiAgICAgIHJldHVybiB0cnVlO1xuICAgIGNvbnN0IHUgPSB0eXBlb2YgdXJsID09PSBcInN0cmluZ1wiID8gbmV3IFVSTCh1cmwpIDogdXJsIGluc3RhbmNlb2YgTG9jYXRpb24gPyBuZXcgVVJMKHVybC5ocmVmKSA6IHVybDtcbiAgICByZXR1cm4gISF0aGlzLnByb3RvY29sTWF0Y2hlcy5maW5kKChwcm90b2NvbCkgPT4ge1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImh0dHBcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiaHR0cHNcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNIdHRwc01hdGNoKHUpO1xuICAgICAgaWYgKHByb3RvY29sID09PSBcImZpbGVcIilcbiAgICAgICAgcmV0dXJuIHRoaXMuaXNGaWxlTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwiZnRwXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzRnRwTWF0Y2godSk7XG4gICAgICBpZiAocHJvdG9jb2wgPT09IFwidXJuXCIpXG4gICAgICAgIHJldHVybiB0aGlzLmlzVXJuTWF0Y2godSk7XG4gICAgfSk7XG4gIH1cbiAgaXNIdHRwTWF0Y2godXJsKSB7XG4gICAgcmV0dXJuIHVybC5wcm90b2NvbCA9PT0gXCJodHRwOlwiICYmIHRoaXMuaXNIb3N0UGF0aE1hdGNoKHVybCk7XG4gIH1cbiAgaXNIdHRwc01hdGNoKHVybCkge1xuICAgIHJldHVybiB1cmwucHJvdG9jb2wgPT09IFwiaHR0cHM6XCIgJiYgdGhpcy5pc0hvc3RQYXRoTWF0Y2godXJsKTtcbiAgfVxuICBpc0hvc3RQYXRoTWF0Y2godXJsKSB7XG4gICAgaWYgKCF0aGlzLmhvc3RuYW1lTWF0Y2ggfHwgIXRoaXMucGF0aG5hbWVNYXRjaClcbiAgICAgIHJldHVybiBmYWxzZTtcbiAgICBjb25zdCBob3N0bmFtZU1hdGNoUmVnZXhzID0gW1xuICAgICAgdGhpcy5jb252ZXJ0UGF0dGVyblRvUmVnZXgodGhpcy5ob3N0bmFtZU1hdGNoKSxcbiAgICAgIHRoaXMuY29udmVydFBhdHRlcm5Ub1JlZ2V4KHRoaXMuaG9zdG5hbWVNYXRjaC5yZXBsYWNlKC9eXFwqXFwuLywgXCJcIikpXG4gICAgXTtcbiAgICBjb25zdCBwYXRobmFtZU1hdGNoUmVnZXggPSB0aGlzLmNvbnZlcnRQYXR0ZXJuVG9SZWdleCh0aGlzLnBhdGhuYW1lTWF0Y2gpO1xuICAgIHJldHVybiAhIWhvc3RuYW1lTWF0Y2hSZWdleHMuZmluZCgocmVnZXgpID0+IHJlZ2V4LnRlc3QodXJsLmhvc3RuYW1lKSkgJiYgcGF0aG5hbWVNYXRjaFJlZ2V4LnRlc3QodXJsLnBhdGhuYW1lKTtcbiAgfVxuICBpc0ZpbGVNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZmlsZTovLyBwYXR0ZXJuIG1hdGNoaW5nLiBPcGVuIGEgUFIgdG8gYWRkIHN1cHBvcnRcIik7XG4gIH1cbiAgaXNGdHBNYXRjaCh1cmwpIHtcbiAgICB0aHJvdyBFcnJvcihcIk5vdCBpbXBsZW1lbnRlZDogZnRwOi8vIHBhdHRlcm4gbWF0Y2hpbmcuIE9wZW4gYSBQUiB0byBhZGQgc3VwcG9ydFwiKTtcbiAgfVxuICBpc1Vybk1hdGNoKHVybCkge1xuICAgIHRocm93IEVycm9yKFwiTm90IGltcGxlbWVudGVkOiB1cm46Ly8gcGF0dGVybiBtYXRjaGluZy4gT3BlbiBhIFBSIHRvIGFkZCBzdXBwb3J0XCIpO1xuICB9XG4gIGNvbnZlcnRQYXR0ZXJuVG9SZWdleChwYXR0ZXJuKSB7XG4gICAgY29uc3QgZXNjYXBlZCA9IHRoaXMuZXNjYXBlRm9yUmVnZXgocGF0dGVybik7XG4gICAgY29uc3Qgc3RhcnNSZXBsYWNlZCA9IGVzY2FwZWQucmVwbGFjZSgvXFxcXFxcKi9nLCBcIi4qXCIpO1xuICAgIHJldHVybiBSZWdFeHAoYF4ke3N0YXJzUmVwbGFjZWR9JGApO1xuICB9XG4gIGVzY2FwZUZvclJlZ2V4KHN0cmluZykge1xuICAgIHJldHVybiBzdHJpbmcucmVwbGFjZSgvWy4qKz9eJHt9KCl8W1xcXVxcXFxdL2csIFwiXFxcXCQmXCIpO1xuICB9XG59O1xudmFyIE1hdGNoUGF0dGVybiA9IF9NYXRjaFBhdHRlcm47XG5NYXRjaFBhdHRlcm4uUFJPVE9DT0xTID0gW1wiaHR0cFwiLCBcImh0dHBzXCIsIFwiZmlsZVwiLCBcImZ0cFwiLCBcInVyblwiXTtcbnZhciBJbnZhbGlkTWF0Y2hQYXR0ZXJuID0gY2xhc3MgZXh0ZW5kcyBFcnJvciB7XG4gIGNvbnN0cnVjdG9yKG1hdGNoUGF0dGVybiwgcmVhc29uKSB7XG4gICAgc3VwZXIoYEludmFsaWQgbWF0Y2ggcGF0dGVybiBcIiR7bWF0Y2hQYXR0ZXJufVwiOiAke3JlYXNvbn1gKTtcbiAgfVxufTtcbmZ1bmN0aW9uIHZhbGlkYXRlUHJvdG9jb2wobWF0Y2hQYXR0ZXJuLCBwcm90b2NvbCkge1xuICBpZiAoIU1hdGNoUGF0dGVybi5QUk9UT0NPTFMuaW5jbHVkZXMocHJvdG9jb2wpICYmIHByb3RvY29sICE9PSBcIipcIilcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihcbiAgICAgIG1hdGNoUGF0dGVybixcbiAgICAgIGAke3Byb3RvY29sfSBub3QgYSB2YWxpZCBwcm90b2NvbCAoJHtNYXRjaFBhdHRlcm4uUFJPVE9DT0xTLmpvaW4oXCIsIFwiKX0pYFxuICAgICk7XG59XG5mdW5jdGlvbiB2YWxpZGF0ZUhvc3RuYW1lKG1hdGNoUGF0dGVybiwgaG9zdG5hbWUpIHtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiOlwiKSlcbiAgICB0aHJvdyBuZXcgSW52YWxpZE1hdGNoUGF0dGVybihtYXRjaFBhdHRlcm4sIGBIb3N0bmFtZSBjYW5ub3QgaW5jbHVkZSBhIHBvcnRgKTtcbiAgaWYgKGhvc3RuYW1lLmluY2x1ZGVzKFwiKlwiKSAmJiBob3N0bmFtZS5sZW5ndGggPiAxICYmICFob3N0bmFtZS5zdGFydHNXaXRoKFwiKi5cIikpXG4gICAgdGhyb3cgbmV3IEludmFsaWRNYXRjaFBhdHRlcm4oXG4gICAgICBtYXRjaFBhdHRlcm4sXG4gICAgICBgSWYgdXNpbmcgYSB3aWxkY2FyZCAoKiksIGl0IG11c3QgZ28gYXQgdGhlIHN0YXJ0IG9mIHRoZSBob3N0bmFtZWBcbiAgICApO1xufVxuZnVuY3Rpb24gdmFsaWRhdGVQYXRobmFtZShtYXRjaFBhdHRlcm4sIHBhdGhuYW1lKSB7XG4gIHJldHVybjtcbn1cbmV4cG9ydCB7XG4gIEludmFsaWRNYXRjaFBhdHRlcm4sXG4gIE1hdGNoUGF0dGVyblxufTtcbiJd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
