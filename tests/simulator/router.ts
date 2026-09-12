// filepath: tests/simulator/router.ts
/**
 * ============================================================================
 * ROUTER — the simulator's SPA runtime (embedded into the app document)
 * ============================================================================
 *
 * A minimal client-side router that mimics the Classroom behaviors CQD must
 * survive: pushState navigation without reloads, DOM replacement, delayed
 * post insertion, scroll load-more, and controllable DOM churn. Deliberately
 * NOT a Classroom UI — it is the dynamic-DOM test surface.
 *
 * This module exports the router SOURCE as a string; server.ts embeds it into
 * the served document. (Content-script-adjacent code cannot import modules
 * from the extension bundle, and the simulator must stay dependency-free.)
 */

export const ROUTER_SOURCE = String.raw`
(function () {
  "use strict";

  var ROUTES = /** ROUTES_JSON **/;

  function matchRoute(pathname) {
    // Exact match first, then :param matching.
    for (var i = 0; i < ROUTES.length; i++) {
      if (ROUTES[i].path === pathname) return ROUTES[i].path;
    }
    for (var j = 0; j < ROUTES.length; j++) {
      var pattern = ROUTES[j].path;
      var patternParts = pattern.split("/");
      var pathParts = pathname.split("/");
      if (patternParts.length !== pathParts.length) continue;
      var ok = true;
      for (var k = 0; k < patternParts.length; k++) {
        var pp = patternParts[k];
        if (pp === ":" + pp.slice(1) || pp.charAt(0) === ":") continue; // param part
        if (pp !== pathParts[k]) { ok = false; break; }
      }
      if (ok) return pattern;
    }
    return null;
  }

  function templateFor(path) {
    return document.querySelector('template[data-route="' + path + '"]');
  }

  var insertTimers = [];

  function clearPending() {
    insertTimers.forEach(function (t) { clearTimeout(t); });
    insertTimers = [];
  }

  function activate(container) {
    // Delayed posts: <template data-insert-after="ms"> → append after ms.
    var delayed = container.querySelectorAll("template[data-insert-after]");
    delayed.forEach(function (tpl) {
      var ms = parseInt(tpl.getAttribute("data-insert-after"), 10) || 0;
      var timer = setTimeout(function () {
        while (tpl.content.firstChild) {
          container.appendChild(tpl.content.firstChild);
        }
        tpl.remove();
      }, ms);
      insertTimers.push(timer);
    });

    // Scroll load-more: <template data-load-more> appended when the sentinel
    // becomes visible OR when tests call window.__cqdSimLoadMore().
    var loadMore = container.querySelector("template[data-load-more]");
    var sentinel = container.querySelector("#cqd-load-more-sentinel");
    if (loadMore && sentinel) {
      var reveal = function () {
        while (loadMore.content.firstChild) {
          container.insertBefore(loadMore.content.firstChild, sentinel);
        }
        loadMore.remove();
      };
      window.__cqdSimLoadMore = reveal;
      var onScroll = function () {
        var rect = sentinel.getBoundingClientRect();
        if (rect.top < window.innerHeight + 40) {
          reveal();
          window.removeEventListener("scroll", onScroll);
        }
      };
      window.addEventListener("scroll", onScroll);
    }
  }

  var currentPath = null;

  function render(path, push) {
    var tpl = templateFor(path);
    if (!tpl) return false;
    if (push) history.pushState({}, "", path);
    var page = document.getElementById("page");
    page.innerHTML = "";
    clearPending();
    window.__cqdSimLoadMore = null;
    page.appendChild(tpl.content.cloneNode(true));
    currentPath = path;
    activate(page);
    return true;
  }

  // Navigation: any <a data-cqd-nav="path"> triggers SPA navigation.
  document.addEventListener("click", function (event) {
    var target = event.target && event.target.closest
      ? event.target.closest("a[data-cqd-nav]")
      : null;
    if (!target) return;
    event.preventDefault();
    var path = target.getAttribute("data-cqd-nav");
    if (render(path, true)) return;
    // Unknown in-simulator route: full navigation (served by the same doc).
    window.location.href = path;
  });

  window.addEventListener("popstate", function () {
    render(window.location.pathname, false);
  });

  // Test-facing controls (the only simulator API QA journeys may drive).
  window.__cqdSimNavigate = function (path) { return render(path, true); };
  window.__cqdSimChurn = function (times, host) {
    var root = host || document.querySelector("[data-stream-item-id]") || document.body;
    for (var i = 0; i < (times || 12); i++) {
      var noise = document.createElement("div");
      noise.textContent = "sim-noise-" + i;
      root.appendChild(noise);
      noise.remove();
      root.appendChild(noise);
    }
  };

  render(window.location.pathname, false);
})();
`;
