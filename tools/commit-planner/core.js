/*
 * core.js - shared, dependency-free logic for the Commit Planner.
 *
 * Loaded two ways:
 *   - Browser:  <script src="core.js"> attaches window.CP_CORE.
 *   - Node:     require("./core.js") via createRequire (tests, scan.mjs).
 *
 * Pure functions only: no filesystem, no git, no DOM. Everything here is
 * covered by tests/core.test.mjs.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.CP_CORE = api;
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var PLAN_VERSION = "CQP1";
  var CRYPTO = typeof require === "function" ? require("crypto") : null;

  // ---------------------------------------------------------------- IDs

  // sha256 of the path, first 8 hex chars. Not a security primitive: a
  // stable identifier so ids survive rescans and can ride in plan strings.
  // Requires Node crypto; the browser only ever consumes pre-hashed ids
  // from data.js and never calls fileId().
  function pathHash(text) {
    if (!CRYPTO) throw new Error("fileId needs Node crypto; browser code must use ids from data.js");
    return CRYPTO.createHash("sha256").update(text, "utf8").digest("hex");
  }

  // Stable across rescans: derived from the path, never from row order.
  function fileId(path) {
    return pathHash(path).slice(0, 8);
  }

  // ------------------------------------------------------- Categories

  var CATEGORIES = ["website", "cloudflare", "oracle", "extension", "docs", "tooling"];

  function categoryOf(path) {
    if (path.indexOf("website/") === 0) return "website";
    if (path.indexOf("cloudflare-worker/") === 0) return "cloudflare";
    if (path.indexOf("oracle-backend/") === 0) return "oracle";
    if (path.indexOf("extension/") === 0) return "extension";
    if (path.indexOf("docs/") === 0) return "docs";
    if (/\.md$/.test(path)) return "docs"; // root changelogs + readme-class files
    return "tooling";
  }

  function extOf(path) {
    var base = path.split("/").pop();
    var i = base.lastIndexOf(".");
    return i > 0 ? base.slice(i + 1).toLowerCase() : "(none)";
  }

  function kindOf(path, status) {
    if (/\.mimosa\//.test(path)) return "toolstate";
    if (/\.beads\//.test(path)) return "tracking";
    if (/(^|\/)(tests?|__tests__|e2e|qa)\//.test(path) || /\.(test|spec|guard|snapshot)\.[a-z]+$/.test(path)) return "test";
    if (/\.md$/i.test(path)) return "docs";
    if (/(^|\/)(changelog|release-version)[^/]*\.(json|ts)$/.test(path)) return "content";
    if (/\.(json|ya?ml|toml|lock)$/.test(path)) return "config";
    if (/\.(css)$/.test(path)) return "styles";
    if (/\.(png|jpe?g|gif|svg|webp|ico|woff2?|ttf)$/.test(path)) return "asset";
    return "source";
  }

  // --------------------------------------------------- Feature areas / task

  var AREA_RULES = [
    [/analytics/i, "analytics"],
    [/changelog|release-version|store-listing/i, "changelog-release"],
    [/seo|llms\.txt|site-map|ai-visibility/i, "seo"],
    [/privacy/i, "privacy"],
    [/snapshot|publicSite/i, "site-snapshot-api"],
    [/glass\.css|app\.css|routes\/|SeoContentPage|overview|uninstall|404/, "website-ui"],
    [/oracle|public_website/i, "oracle-public-site"],
    [/downloads_do|d1|auth/i, "worker-api"],
    [/simulator|origins/i, "qa-simulator"],
    [/wxt\.config|package\.json|workflows/i, "build-ci"],
    [/background|entrypoints/i, "extension-background"],
    [/hook-state|finding-ledger|history|mimosa/i, "scanner-tool-state"],
  ];

  var TASK_RULES = [
    [/changelog/i, "Changelog + release content"],
    [/release-version/i, "Release versioning"],
    [/analytics/i, "Analytics events pipeline"],
    [/seo|llms\.txt|site-map|ai-visibility/i, "SEO / AI visibility"],
    [/privacy/i, "Privacy page"],
    [/snapshot|publicSite/i, "Site snapshot API (website + worker)"],
    [/glass\.css|app\.css|routes\/|SeoContentPage|overview|uninstall|404/, "Website UI + styling"],
    [/oracle-backend|public_website|ORACLE/i, "Oracle backend"],
    [/cloudflare-worker|downloads_do|worker/i, "Cloudflare worker"],
    [/simulator|origins/i, "QA simulator harness"],
    [/STORE_LISTINGS|LAUNCH_PACKAGE/i, "Store listing / launch docs"],
    [/RELEASE_SEQUENCE/i, "Release sequence docs"],
    [/ORACLE_RECOVERY/i, "Oracle recovery runbook"],
    [/ANALYTICS_EVENTS/i, "Analytics docs"],
    [/SEO_DEPLOY/i, "SEO deploy checklist"],
    [/superpowers\/plans/i, "Planning notes"],
    [/wxt\.config/i, "Extension build config"],
    [/package\.json$/, "Repo scripts + deps"],
    [/workflows/i, "CI workflow"],
    [/\.beads\//i, "Issue-tracker export"],
    [/\.mimosa\//i, "Scanner tool state (probably never commit)"],
  ];

  function firstMatch(rules, text, fallback) {
    for (var i = 0; i < rules.length; i++) if (rules[i][0].test(text)) return rules[i][1];
    return fallback;
  }

  function areaOf(path) {
    return firstMatch(AREA_RULES, path, "general");
  }

  function taskOf(path) {
    return firstMatch(TASK_RULES, path, "General change");
  }

  // ------------------------------------------------------------ Tags

  function freshness(dateIso, nowIso) {
    var t = new Date(dateIso).getTime();
    if (!isFinite(t)) return "unknown-date";
    var days = (new Date(nowIso).getTime() - t) / 86400000;
    if (days <= 2) return "fresh-2d";
    if (days <= 7) return "this-week";
    if (days <= 31) return "this-month";
    return "older";
  }

  function sizeBucket(plus, minus) {
    var n = (plus || 0) + (minus || 0);
    if (n === 0) return "size:empty";
    if (n < 10) return "size:small";
    if (n < 100) return "size:medium";
    return "size:large";
  }

  // file: { path, status: staged|unstaged|partially|untracked, letters,
  //         worktree: null|"wt-<slug>", branch, date, lastSubject, plus, minus }
  function tagsFor(file, nowIso) {
    var tags = [file.status, "cat:" + categoryOf(file.path), "kind:" + (file.kind || kindOf(file.path, file.status)),
      "ext:" + extOf(file.path), "area:" + areaOf(file.path), freshness(file.date, nowIso)];
    if (file.letters) tags.push("change:" + file.letters.replace(/\s/g, ""));
    if (file.worktree) tags.push("worktree:" + file.worktree);
    if (file.branch) tags.push("branch:" + file.branch);
    tags.push(sizeBucket(file.plus, file.minus));
    if (file.plus != null) tags.push("lines:+" + file.plus + "/-" + (file.minus || 0));
    return tags;
  }

  // ------------------------------------------- caveman-commit drafts

  var TYPES = ["feat", "fix", "refactor", "perf", "docs", "test", "chore", "build", "ci", "style", "revert"];

  function scopeOf(path) {
    var cat = categoryOf(path);
    return cat === "tooling" ? "repo" : cat;
  }

  function humanBase(path) {
    var segs = path.split("/");
    var base = segs[segs.length - 1].replace(/\.[a-z]+$/i, "").toLowerCase();
    var dir = (segs[segs.length - 2] || "").toLowerCase();
    // Qualify with the parent dir when the bare name is generic or very
    // short (flush.ts -> analytics flush), but never repeat the scope.
    var generic = ["index", "main", "types", "constants", "config", "helpers", "utils"];
    var qualify = dir && dir !== scopeOf(path) && (generic.indexOf(base) >= 0 || base.length < 8);
    return (qualify ? dir + " " + base : base).replace(/[-_.]/g, " ");
  }

  function defaultType(file) {
    var kind = kindOf(file.path, file.status);
    if (kind === "test") return "test";
    if (kind === "docs") return "docs";
    return "feat";
  }

  // Single-quote shell escaping: ' -> '\'' (closes, escapes, reopens).
  function shq(text) {
    return String(text).replace(/'/g, "'\\''");
  }

  // Draft message in caveman-commit style with the user's own rule on top:
  // every commit carries a title AND a description. The description is the
  // factual context a one-file commit wants (diff size, last commit that
  // touched the file) - refine the why when you have it.
  function draftMessage(file, parsedType) {
    var type = TYPES.indexOf(parsedType) >= 0 ? parsedType : defaultType(file);
    var verb = file.status === "untracked" ? "add" : "update";
    var subject = type + "(" + scopeOf(file.path) + "): " + verb + " " + humanBase(file.path);
    if (subject.length > 72) subject = subject.slice(0, 72);
    var body = [];
    if (file.status === "untracked") body.push("New file: " + file.path);
    else body.push(file.path + " (" + (file.plus || 0) + "+/" + (file.minus || 0) + "- vs HEAD)");
    if (file.lastSubject) body.push("Last touched by: " + file.lastSubject);
    if (!body.length) body.push("One-file commit of " + file.path);
    return { subject: subject, body: body.join("\n"), type: type };
  }

  // --------------------------------------------------- Plan strings

  // CQP1:<repo>|G<idx>[@YYYY-MM-DD][~<slug>][:<id8>,<id8>]|P<branch>@YYYY-MM-DD
  function encodePlan(plan) {
    var segs = [PLAN_VERSION + ":" + plan.repo];
    (plan.groups || []).forEach(function (g) {
      var seg = "G" + g.index;
      seg += "@" + (g.date || "-");
      if (g.slug) seg += "~" + g.slug;
      seg += ":" + (g.ids || []).join(",");
      segs.push(seg);
    });
    (plan.pushes || []).forEach(function (p) {
      segs.push("P" + p.branch + "@" + (p.date || "-"));
    });
    return segs.join("|");
  }

  function parsePlan(text) {
    var out = { ok: false, errors: [], repo: null, groups: [], pushes: [] };
    if (!text || typeof text !== "string") { out.errors.push("empty input"); return out; }
    var segs = text.trim().replace(/^\s*`?/,"").replace(/`?\s*$/,"").split("|");
    var head = segs.shift() || "";
    if (head.indexOf(PLAN_VERSION + ":") !== 0) {
      out.errors.push("header must start with " + PLAN_VERSION + ":<repo>");
      return out;
    }
    out.repo = head.slice(PLAN_VERSION.length + 1);
    var re = /^G(\d+)@([^~:]*)(?:~([A-Za-z0-9_-]+))?:?(.*)$/;
    for (var i = 0; i < segs.length; i++) {
      var seg = segs[i];
      if (seg.charAt(0) === "P") {
        var m = /^P([^@]+)@(.*)$/.exec(seg);
        if (!m) { out.errors.push("bad push segment: " + seg); continue; }
        out.pushes.push({ branch: m[1], date: m[2] === "-" ? null : m[2] });
        continue;
      }
      var g = re.exec(seg);
      if (!g) { out.errors.push("bad group segment: " + seg); continue; }
      var ids = g[4] ? g[4].split(",").filter(Boolean) : [];
      var badIds = ids.filter(function (x) { return !/^[0-9a-f]{8}$/.test(x); });
      if (badIds.length) { out.errors.push("bad ids in G" + g[1] + ": " + badIds.join(",")); }
      out.groups.push({
        index: parseInt(g[1], 10),
        date: g[2] === "-" ? null : g[2],
        slug: g[3] || null,
        ids: ids.filter(function (x) { return /^[0-9a-f]{8}$/.test(x); }),
      });
    }
    out.ok = out.errors.length === 0;
    return out;
  }

  // -------------------------------------------- Commit-plan assembly

  // plan: parsed plan; filesById: id -> file row from data.
  // Returns ordered commands: one file per commit, grouped, with dates as
  // comments, plus push lines. Pure: returns strings, never runs git.
  function buildSequence(plan, filesById, repoRoot) {
    var lines = [];
    var byDate = {};
    (plan.groups || []).slice().sort(function (a, b) { return a.index - b.index; }).forEach(function (g) {
      var date = g.date || "unscheduled";
      (byDate[date] = byDate[date] || { groups: [], pushes: [] }).groups.push(g);
    });
    (plan.pushes || []).forEach(function (p) {
      var date = p.date || "unscheduled";
      (byDate[date] = byDate[date] || { groups: [], pushes: [] }).pushes.push(p);
    });
    var dates = Object.keys(byDate).sort(function (a, b) {
      if (a === "unscheduled") return 1;
      if (b === "unscheduled") return -1;
      return a < b ? -1 : 1;
    });
    dates.forEach(function (date) {
      var day = byDate[date];
      lines.push("# ===== " + date + " =====");
      day.groups.forEach(function (g) {
        var label = g.slug ? (" [" + g.slug + "]") : "";
        lines.push("# group G" + g.index + label);
        g.ids.forEach(function (id) {
          var f = filesById[id];
          if (!f) { lines.push("# !! unknown id " + id + " (file gone from scan?)"); return; }
          var msg = draftMessage(f, f.typeOverride);
          var git = f.worktree ? "git -C " + f.worktree.cwd : "git";
          lines.push(git + " add -- '" + shq(f.path) + "'");
          lines.push(git + " commit -m \"" + msg.subject.replace(/"/g, "'") + "\"" +
            " -m \"" + msg.body.replace(/"/g, "'").replace(/\r?\n/g, " / ") + "\"");
        });
      });
      day.pushes.forEach(function (p) {
        lines.push("git push origin " + p.branch);
      });
      lines.push("");
    });
    return lines.join("\n");
  }

  // ------------------------------------------------- branch organization

  // b: { name, tipDate, aheadVsOrigin, upstream, worktree, existsRemotely,
  //      dirtyFiles, isCurrent }
  // Returns { cat, why, action, suggestedRemote, deletable, risks[], ageDays }.
  // Pure presentation logic so tests can pin the policy.
  function classifyBranch(b) {
    var ageDays = (Date.now() - new Date(b.tipDate).getTime()) / 86400000;
    var cat, why, action;
    var risks = [];
    if (b.aheadVsOrigin == null) {
      cat = "unknown"; why = "could not compare with origin/main (missing remote ref?)";
      action = "inspect manually before any push or delete - ahead count unknown";
      risks.push("ahead count unknown - do not treat this branch as merged");
      return { cat: cat, why: why, action: action, suggestedRemote: null,
        deletable: false, risks: risks, ageDays: Math.round(ageDays) };
    }
    if (b.isCurrent) {
      cat = "current"; why = "checked out here";
      action = "commit its files through the plan, then push";
      risks.push("deleting or renaming the checked-out branch needs a checkout first");
    } else if (b.worktree && b.dirtyFiles > 0) {
      cat = "active-wip"; why = "worktree has " + b.dirtyFiles + " uncommitted files";
      action = "commit or stash inside that worktree before organizing";
      risks.push("deleting a branch checked out in a worktree is blocked by git until the worktree is removed");
    } else if (/^backup\//.test(b.name)) {
      cat = "archive"; why = "pre-rewrite history backup, " + (b.aheadVsOrigin || 0) + " commits not on origin";
      action = "push to archive/<name> if you want it on GitHub, or keep local";
      if ((b.aheadVsOrigin || 0) > 0) risks.push("pushing publishes " + b.aheadVsOrigin + " historical commits");
    } else if (b.worktree) {
      cat = "worktree-branch"; why = "clean worktree at " + b.worktree;
      action = (b.aheadVsOrigin || 0) > 0 ? "push the archived work, then remove the worktree if done" : "keep or remove the worktree - nothing unique";
      if ((b.aheadVsOrigin || 0) > 0) risks.push("the unique commit is an archived WIP snapshot, not merge-ready work");
    } else if ((b.aheadVsOrigin || 0) === 0 && !b.existsRemotely) {
      cat = "merged-idle"; why = "fully contained in origin/main, no remote copy";
      action = "safe to keep locally or delete";
    } else if ((b.aheadVsOrigin || 0) > 0 && ageDays > 30) {
      cat = "stale"; why = "unique commits, untouched " + Math.round(ageDays) + " days";
      action = "inspect, then push to archive/<name> or delete";
      risks.push("old branch may predate the history rewrite - inspect before pushing");
    } else if ((b.aheadVsOrigin || 0) > 0) {
      cat = "active"; why = b.aheadVsOrigin + " unique commits";
      action = "push to origin/" + b.name;
    } else {
      cat = "tracking"; why = "mirrors origin";
      action = "keep, or delete (fully merged)";
    }
    var suggestedRemote = null;
    if (/^backup\//.test(b.name)) suggestedRemote = "archive/" + b.name.split("/").join("-");
    else if (cat === "stale") suggestedRemote = "archive/" + b.name.split("/").join("-");
    else if ((b.aheadVsOrigin || 0) > 0 && !b.existsRemotely && !b.isCurrent) suggestedRemote = b.name;
    var deletable = !b.isCurrent && !(b.worktree && b.worktree.length > 0);
    return { cat: cat, why: why, action: action, suggestedRemote: suggestedRemote, deletable: deletable, risks: risks, ageDays: Math.round(ageDays) };
  }

  // -------------------------------------------------------- plan warnings

  // plan: parsed plan; filesById: id -> file; todayIso: YYYY-MM-DD;
  // branchNames (optional): valid push targets.
  // Returns [{level, code, msg, groupIndex}] sorted error > warn > info.
  // This is the error-prevention layer: the export tab surfaces these and
  // blocks one-click copy while errors exist.
  function planWarnings(plan, filesById, todayIso, branchNames) {
    var out = [];
    var seenSlug = {};
    var plannedIds = {};
    var seenPush = {};
    (plan.groups || []).forEach(function (g) {
      if (!g.ids.length) out.push({ level: "info", code: "empty-group", msg: "Group G" + g.index + " is empty - it produces no commits.", groupIndex: g.index });
      if (g.slug) {
        if (seenSlug[g.slug]) out.push({ level: "warn", code: "dup-slug", msg: 'Group name "' + g.slug + '" is used twice - script comments will be ambiguous.', groupIndex: g.index });
        seenSlug[g.slug] = true;
      }
      if (!g.date) out.push({ level: "warn", code: "no-date", msg: "Group G" + g.index + (g.slug ? " " + g.slug : "") + " has no date - it lands in the unscheduled section.", groupIndex: g.index });
      else if (g.date < todayIso) out.push({ level: "warn", code: "past-date", msg: "Group G" + g.index + (g.slug ? " " + g.slug : "") + " is dated " + g.date + ", in the past.", groupIndex: g.index });
      (g.ids || []).forEach(function (id) {
        var f = filesById[id];
        if (!f) { out.push({ level: "error", code: "unknown-id", msg: "G" + g.index + " contains id " + id + " which is not in this scan - the file was committed, deleted, or the scan is stale.", groupIndex: g.index }); return; }
        if (plannedIds[id]) out.push({ level: "error", code: "dup-id", msg: f.path + " is in two groups (G" + plannedIds[id] + " and G" + g.index + ") - one-file-per-commit would be violated.", groupIndex: g.index });
        else plannedIds[id] = g.index;
        if (f.kind === "toolstate" || f.kind === "artifact") out.push({ level: "error", code: "noise-planned", msg: f.path + " is collapsed tool state / run artifacts - committing it would bloat the repo. Remove it from the plan.", groupIndex: g.index });
        else if (f.status === "partially") out.push({ level: "warn", code: "partial-stage", msg: f.path + " has staged AND unstaged changes - 'git add' in this script commits both together as one commit.", groupIndex: g.index });
      });
    });
    (plan.pushes || []).forEach(function (p, i) {
      if (!p.date) out.push({ level: "warn", code: "push-no-date", msg: "Push of " + p.branch + " has no date - it lands in the unscheduled section." });
      else if (p.date < todayIso) out.push({ level: "warn", code: "push-past-date", msg: "Push of " + p.branch + " is dated " + p.date + ", in the past." });
      if (seenPush[p.branch] != null) out.push({ level: "warn", code: "push-dup", msg: "Branch " + p.branch + " is scheduled for push twice." });
      seenPush[p.branch] = i;
      if (branchNames && branchNames.indexOf(p.branch) < 0) out.push({ level: "warn", code: "push-unknown-branch", msg: "Push target '" + p.branch + "' is not a local branch in this scan." });
    });
    var order = { error: 0, warn: 1, info: 2 };
    out.sort(function (a, b) { return order[a.level] - order[b.level]; });
    return out;
  }

  return {
    PLAN_VERSION: PLAN_VERSION,
    CATEGORIES: CATEGORIES,
    TYPES: TYPES,
    fileId: fileId,
    categoryOf: categoryOf,
    extOf: extOf,
    kindOf: kindOf,
    areaOf: areaOf,
    taskOf: taskOf,
    freshness: freshness,
    sizeBucket: sizeBucket,
    tagsFor: tagsFor,
    defaultType: defaultType,
    draftMessage: draftMessage,
    encodePlan: encodePlan,
    parsePlan: parsePlan,
    buildSequence: buildSequence,
    classifyBranch: classifyBranch,
    planWarnings: planWarnings,
  };
});
