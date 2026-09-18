/*
 * app.js - Commit Planner UI (v2). Vanilla JS, no dependencies, file:// safe.
 * Reads window.CP_DATA (data.js) and window.CP_CORE (core.js).
 *
 * Safety model: the tool NEVER runs git. Risky intents (push, delete,
 * overwrite) go through a confirm modal that spells out the exact command
 * and its consequences; confirmed commands land in a review queue you copy.
 * Destructive plan edits are undoable via toast.
 */
(function () {
  "use strict";
  var CORE = window.CP_CORE;
  var DATA = window.CP_DATA;
  if (!DATA) {
    document.body.innerHTML = '<div class="boot-error"><h1>No scan data</h1>' +
      "<p>The planner reads a scan file that does not exist yet. Generate it (read-only), then reload:</p>" +
      "<pre>node tools/commit-planner/scan.mjs</pre></div>";
    return;
  }
  var LS_KEY = "cqd-commit-planner-v1";

  var $ = function (id) { return document.getElementById(id); };
  // Paths and commit subjects go into innerHTML; keep <> & " honest.
  function esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ------------------------------------------------------------ state

  var state = {
    tab: "files",
    search: "",
    commitSearch: "",
    filters: { cat: {}, status: {}, kind: {} },
    hideNoise: true,
    density: "comfortable",
    sort: { key: "path", dir: 1 },
    selected: {},          // id -> true
    expanded: {},          // id -> true
    activeGroup: null,
    commitFilter: "all",
    calMonth: new Date().getFullYear() + "-" + (new Date().getMonth() + 1),
    plan: { repo: DATA.repo, groups: [], pushes: [] },
    overrides: {},         // id -> commit type
    queue: [],             // reviewed git commands (never executed here)
    hideGuide: false,
  };

  // filesById across every surface; worktree files carry their cwd.
  var FILES = {};
  (DATA.surfaces || []).forEach(function (s) {
    (s.files || []).forEach(function (f) {
      var copy = Object.assign({}, f);
      copy.worktree = s.slug ? { cwd: s.relPath, slug: s.slug, branch: s.branch } : null;
      if (!FILES[copy.id]) FILES[copy.id] = copy;
      else {
        // Same path changed in two surfaces. Plan ids stay 8-hex, so only
        // the first copy is planable; the row flags the other surface so
        // both get committed separately.
        FILES[copy.id].dupIn = s.slug || "main";
        copy.dupIn = FILES[copy.id].worktree ? FILES[copy.id].worktree.slug : "main";
      }
    });
  });

  function isNoise(f) { return f.kind === "toolstate" || f.kind === "artifact"; }
  function allFiles() { return Object.keys(FILES).map(function (k) { return FILES[k]; }); }
  function todayIso() { return new Date().toISOString().slice(0, 10); }
  function planWarnings() {
    return CORE.planWarnings(state.plan, FILES, todayIso(), knownPushBranches());
  }

  // ----------------------------------------------------- persistence

  function save() {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({
        plan: state.plan, overrides: state.overrides, hideGuide: state.hideGuide,
        density: state.density, savedAt: new Date().toISOString(),
      }));
      setSaved("saved " + new Date().toLocaleTimeString());
    } catch (e) { setSaved("save failed: " + e.message); }
  }

  function load() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return;
      var p = JSON.parse(raw);
      if (p.plan && p.plan.repo === DATA.repo) state.plan = p.plan;
      if (p.overrides) state.overrides = p.overrides;
      if (typeof p.hideGuide === "boolean") state.hideGuide = p.hideGuide;
      if (p.density) state.density = p.density;
      if (p.dataGeneratedAt && p.dataGeneratedAt !== DATA.generatedAt) {
        setSaved("plan from " + String(p.dataGeneratedAt).slice(0, 10) + " scan - run self-check if ids fail");
      } else setSaved("plan restored");
    } catch (e) { /* fresh start */ }
  }

  function setSaved(msg) {
    var el = document.getElementById("saveState");
    if (el) el.textContent = msg;
  }

  // ------------------------------------------------------ toasts + modal

  function toast(msg, opts) {
    opts = opts || {};
    var root = document.getElementById("toasts");
    var el = document.createElement("div");
    el.className = "toast " + (opts.kind || "");
    el.setAttribute("role", "status");
    var html = "<span>" + esc(msg) + "</span>";
    if (opts.undo) html += ' <button class="mini" data-tundo>undo</button>';
    el.innerHTML = html;
    root.appendChild(el);
    if (opts.undo) {
      el.querySelector("[data-tundo]").addEventListener("click", function () {
        opts.undo(); el.remove();
      });
    }
    setTimeout(function () { el.classList.add("gone"); }, 5200);
    setTimeout(function () { el.remove(); }, 5600);
    if (root.children.length > 4) root.children[0].remove();
  }

  // askConfirm({title, body, consequences:[], confirmLabel, danger, onConfirm})
  // Every risky action in the app flows through here: the modal states the
  // exact command/intent and each consequence before anything happens.
  function askConfirm(o) {
    var root = document.getElementById("modal");
    root.innerHTML =
      '<div class="modal-card" role="alertdialog" aria-modal="true" aria-label="' + esc(o.title) + '">' +
      '<h3 class="' + (o.danger ? "danger-text" : "") + '">' + esc(o.title) + "</h3>" +
      (o.body ? '<p class="modal-body">' + esc(o.body) + "</p>" : "") +
      (o.consequences && o.consequences.length
        ? '<ul class="cons">' + o.consequences.map(function (c) { return "<li>" + esc(c) + "</li>"; }).join("") + "</ul>"
        : "") +
      '<div class="modal-actions">' +
      '<button class="btn ghost" data-mcancel>cancel</button>' +
      '<button class="btn ' + (o.danger ? "danger" : "primary") + '" data-mok>' + esc(o.confirmLabel || "confirm") + "</button>" +
      "</div></div>";
    root.hidden = false;
    var ok = root.querySelector("[data-mok]");
    ok.focus();
    root.querySelector("[data-mcancel]").addEventListener("click", closeModal);
    ok.addEventListener("click", function () { closeModal(); o.onConfirm(); });
  }
  function closeModal() { var root = document.getElementById("modal"); root.hidden = true; root.innerHTML = ""; }
  function modalOpen() { return !document.getElementById("modal").hidden; }

  // ------------------------------------------------------- filtering

  function visibleFiles() {
    var q = state.search.trim().toLowerCase();
    var rows = allFiles().filter(function (f) {
      if (state.hideNoise && isNoise(f)) return false;
      if (state.filters.cat[CORE.categoryOf(f.path)]) return false;
      if (state.filters.status[f.status]) return false;
      if (state.filters.kind[f.kind]) return false;
      if (q) {
        var hay = (f.path + " " + (f.task || "") + " " + (f.lastSubject || "") + " " + f.tags.join(" ")).toLowerCase();
        if (hay.indexOf(q) < 0) return false;
      }
      return true;
    });
    var k = state.sort.key, d = state.sort.dir;
    rows.sort(function (a, b) {
      var va = k === "date" ? a.date : k === "cat" ? CORE.categoryOf(a.path) : a.path;
      var vb = k === "date" ? b.date : k === "cat" ? CORE.categoryOf(b.path) : b.path;
      return va < vb ? -d : va > vb ? d : a.path < b.path ? -1 : 1;
    });
    return rows;
  }

  // ------------------------------------------------------ plan model

  function nextGroupIndex() {
    return state.plan.groups.reduce(function (m, g) { return Math.max(m, g.index); }, 0) + 1;
  }
  function findGroup(i) { return state.plan.groups.filter(function (g) { return g.index === i; })[0]; }
  function groupOf(id) {
    for (var i = 0; i < state.plan.groups.length; i++) {
      if (state.plan.groups[i].ids.indexOf(id) >= 0) return state.plan.groups[i];
    }
    return null;
  }
  function slugify(text) {
    return (text || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
  }

  function addToGroup(ids, index, silent) {
    var g = findGroup(index);
    if (!g) return;
    var moved = 0;
    ids.forEach(function (id) {
      state.plan.groups.forEach(function (other) {
        var at = other.ids.indexOf(id);
        if (at >= 0 && other.index !== index) other.ids.splice(at, 1);
      });
      if (g.ids.indexOf(id) < 0) { g.ids.push(id); moved++; }
    });
    save(); render();
    if (!silent) toast(moved + " file" + (moved === 1 ? "" : "s") + " added to G" + g.index + (g.slug ? " " + g.slug : "") + (moved < ids.length ? " (moved out of their old groups)" : ""));
  }

  function newGroup(slug, ids, date) {
    var g = { index: nextGroupIndex(), date: date || null, slug: slug || null, ids: [] };
    state.plan.groups.push(g);
    if (ids && ids.length) addToGroup(ids, g.index, true);
    save(); render();
    return g;
  }

  function removeGroup(index) {
    var g = findGroup(index);
    if (!g) return;
    var backup = JSON.parse(JSON.stringify(g));
    state.plan.groups = state.plan.groups.filter(function (x) { return x.index !== index; });
    if (state.activeGroup === index) state.activeGroup = null;
    save(); render();
    toast("Deleted G" + index + (g.slug ? " " + g.slug : "") + " (" + g.ids.length + " files)", {
      undo: function () { state.plan.groups.push(backup); save(); render(); toast("Group restored"); },
    });
  }

  function removeFromGroup(id, index) {
    var g = findGroup(index);
    if (!g) return;
    var at = g.ids.indexOf(id);
    if (at < 0) return;
    g.ids.splice(at, 1);
    save(); render();
    var f = FILES[id];
    toast("Removed " + (f ? f.path : id) + " from G" + index, {
      undo: function () {
        var live = findGroup(index);
        if (!live) { toast("That group no longer exists - nothing to undo", { kind: "warn" }); return; }
        if (live.ids.indexOf(id) < 0) live.ids.push(id);
        save(); render(); toast("Restored in G" + index);
      },
    });
  }

  function clearPlan() {
    var backup = JSON.parse(JSON.stringify(state.plan));
    state.plan = { repo: DATA.repo, groups: [], pushes: [] };
    state.activeGroup = null;
    save(); render();
    toast("Plan cleared (" + backup.groups.length + " groups)", {
      undo: function () { state.plan = backup; save(); render(); toast("Plan restored"); },
    });
  }

  function knownPushBranches() {
    var set = {};
    (DATA.branches || []).forEach(function (b) { set[b.name] = true; });
    return Object.keys(set).sort();
  }

  // ------------------------------------------------------ render: root

  function render() {
    document.body.classList.toggle("compact", state.density === "compact");
    $("statFiles").textContent = DATA.stats.filesCommittable;
    $("statCommits").textContent = DATA.stats.commitsUnpushed;
    $("statBranches").textContent = DATA.branches.length;
    $("generated").textContent = "scan " + new Date(DATA.generatedAt).toLocaleString();
    var errs = planWarnings().filter(function (w) { return w.level === "error"; }).length;
    var planned = state.plan.groups.reduce(function (n, g) { return n + g.ids.length; }, 0);
    $("tabExportNote").textContent = errs ? "!" + errs : (planned ? planned + " files" : "");
    document.querySelectorAll("[data-tab]").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-tab") === state.tab);
    });
    ["files", "workspace", "history", "calendar", "export"].forEach(function (t) {
      $("panel-" + t).hidden = state.tab !== t;
    });
    if (state.tab === "files") renderFiles();
    if (state.tab === "workspace") renderWorkspace();
    if (state.tab === "history") renderHistory();
    if (state.tab === "calendar") renderCalendar();
    if (state.tab === "export") renderExport();
    renderRail();
    renderActionBar();
  }

  // ----------------------------------------------------- render: files

  function chip(group, value, label) {
    var active = state.filters[group][value];
    return '<button class="chip' + (active ? " off" : "") + '" data-fgroup="' + group + '" data-fval="' + value + '" aria-pressed="' + (!active) + '">' + (label || value) + "</button>";
  }

  function renderFiles() {
    var counts = { cat: {}, status: {}, kind: {} };
    allFiles().forEach(function (f) {
      counts.cat[CORE.categoryOf(f.path)] = (counts.cat[CORE.categoryOf(f.path)] || 0) + 1;
      counts.status[f.status] = (counts.status[f.status] || 0) + 1;
      counts.kind[f.kind] = (counts.kind[f.kind] || 0) + 1;
    });
    var bar = [];
    CORE.CATEGORIES.forEach(function (c) { bar.push(chip("cat", c, c + " " + (counts.cat[c] || 0))); });
    ["staged", "partially", "unstaged", "untracked", "unmerged"].forEach(function (s) { bar.push(chip("status", s, s + " " + (counts.status[s] || 0))); });
    ["source", "test", "docs", "config", "content", "styles", "asset", "tracking", "toolstate", "artifact"].forEach(function (k) {
      if (counts.kind[k]) bar.push(chip("kind", k, k + " " + counts.kind[k]));
    });
    $("filterBar").innerHTML = bar.join("");

    var guide = "";
    if (!state.hideGuide && !state.plan.groups.length) {
      guide = '<div class="guide"><h3>How this works</h3><ol>' +
        "<li><b>Triage</b> - filter this list, open a row to see what changed and why it matters.</li>" +
        "<li><b>Group</b> - tick files, then use the bar at the bottom to create a named group (one theme per group).</li>" +
        "<li><b>Schedule</b> - give each group a commit date on the calendar, and a push date for main.</li>" +
        "<li><b>Export</b> - copy the reviewed script or the plan string and hand it to your agent.</li>" +
        "</ol><button class=\"btn ghost\" id=\"dismissGuide\">got it, hide this</button></div>";
    }

    var rows = visibleFiles();
    var html = [guide, '<table class="files"><thead><tr>',
      '<th class="c-sel"><input type="checkbox" id="selAll" aria-label="select all visible"/></th>',
      '<th class="c-st">st</th>',
      '<th class="c-path' + (state.sort.key === "path" ? " sorted" : "") + '" data-sort="path">file</th>',
      '<th class="c-task">task</th>',
      '<th class="c-tags">tags</th>',
      '<th class="c-date' + (state.sort.key === "date" ? " sorted" : "") + '" data-sort="date">date</th>',
      '<th class="c-group">plan</th>',
      "</tr></thead><tbody>"];
    rows.forEach(function (f) { html.push(rowHtml(f)); });
    html.push("</tbody></table>");
    if (!rows.length) {
      html = [guide, '<div class="empty">No files match the current filters.<br/><button class="btn ghost" id="clearFilters">clear all filters</button></div>'];
    }
    $("fileList").innerHTML = html.join("");
    var selAll = $("selAll");
    if (selAll) selAll.checked = rows.length > 0 && rows.every(function (f) { return state.selected[f.id]; });
  }

  function stBadge(f) {
    var map = { staged: "S", partially: "S+U", unstaged: "U", untracked: "??", unmerged: "UU" };
    return '<span class="st st-' + f.status + '" title="' + f.status + '">' + (map[f.status] || "?") + "</span>";
  }

  function rowHtml(f) {
    var cat = CORE.categoryOf(f.path);
    var inPlan = groupOf(f.id);
    var draft = CORE.draftMessage(f, state.overrides[f.id]);
    var open = state.expanded[f.id];
    var h = '<tr class="frow' + (state.selected[f.id] ? " sel" : "") + '" data-id="' + f.id + '">';
    h += '<td class="c-sel"><input type="checkbox" class="rowsel" data-id="' + f.id + '"' + (state.selected[f.id] ? " checked" : "") + ' aria-label="select ' + esc(f.path) + '"/></td>';
    h += "<td>" + stBadge(f) + "</td>";
    h += '<td class="c-path"><span class="cat-dot cat-' + cat + '" title="' + cat + '"></span><span class="path" title="' + esc(f.path) + '">' + esc(f.path) + "</span>";
    if (f.worktree) h += ' <span class="wt">' + esc(f.worktree.slug) + "</span>";
    if (f.collapsedCount) h += ' <span class="wt">collapsed</span>';
    if (f.dupIn) h += ' <span class="wt" title="same path also changed in ' + esc(f.dupIn) + ' - handle both surfaces">also in ' + esc(f.dupIn) + "</span>";
    h += "</td>";
    h += '<td class="c-task">' + esc(f.task || CORE.taskOf(f.path)) + "</td>";
    var show = f.tags.slice(0, 4);
    var extra = f.tags.length > 4 ? '<span class="tag">+' + (f.tags.length - 4) + "</span>" : "";
    h += '<td class="c-tags">' + show.map(function (t) { return '<button class="tag" data-tag="' + esc(t) + '" title="filter by ' + esc(t) + '">' + esc(t) + "</button>"; }).join("") + extra + "</td>";
    h += '<td class="c-date">' + (f.date || "").slice(0, 10) + "</td>";
    h += '<td class="c-group">' + (inPlan
      ? '<button class="gchip" data-jumpgroup="' + inPlan.index + '" title="jump to group">G' + inPlan.index + (inPlan.slug ? " " + inPlan.slug : "") + "</button>"
      : '<button class="mini ghost" data-quickadd="' + f.id + '">+ plan</button>') + "</td>";
    h += "</tr>";
    if (open) {
      var warns = [];
      if (f.status === "partially") warns.push("This file has staged AND unstaged changes. The exported script runs one 'git add', so both go into the same single-file commit.");
      if (isNoise(f)) warns.push("This is collapsed tool state or run artifacts. Committing it bloats the repo - you probably want it ignored instead.");
      if (f.dupIn) warns.push("The same path is also changed in surface '" + f.dupIn + "'. Each surface needs its own commit.");
      h += '<tr class="detail"><td></td><td colspan="6"><div class="detail-in">';
      if (warns.length) h += '<div class="callout warn">' + warns.map(esc).join("<br/>") + "</div>";
      h += '<div class="d-row"><span class="d-k">id</span><code>' + f.id + "</code></div>";
      h += '<div class="d-row"><span class="d-k">status</span>' + f.status + (f.letters ? " (" + f.letters + ")" : "") + "</div>";
      if (f.plus != null) h += '<div class="d-row"><span class="d-k">diff vs HEAD</span>+' + f.plus + " / -" + (f.minus || 0) + " lines</div>";
      if (f.lastSubject) h += '<div class="d-row"><span class="d-k">last commit touching file</span><span class="mono">' + esc(f.lastSubject) + "</span></div>";
      if (f.worktree) h += '<div class="d-row"><span class="d-k">worktree</span>' + esc(f.worktree.slug) + " (" + esc(f.worktree.branch) + ")</div>";
      h += '<div class="d-row"><span class="d-k">all tags</span>' + f.tags.map(function (t) { return '<button class="tag" data-tag="' + esc(t) + '">' + esc(t) + "</button>"; }).join("") + "</div>";
      h += '<div class="d-row"><span class="d-k">commit type</span><select data-type="' + f.id + '">' +
        CORE.TYPES.map(function (t) { return "<option" + (draft.type === t ? " selected" : "") + ">" + t + "</option>"; }).join("") +
        '</select><span class="hint">draft message - edit wording in Export</span></div>';
      h += '<pre class="msg">' + esc(draft.subject + (draft.body ? "\n\n" + draft.body : "")) + "</pre>";
      h += '<div class="d-actions"><button class="btn small" data-addone="' + f.id + '">add to active group</button>' +
        '<button class="btn small ghost" data-copymsg="' + f.id + '">copy message</button></div>';
      h += "</div></td></tr>";
    }
    return h;
  }

  // ------------------------------------------------- render: workspace

  function branchVerdicts() {
    return (DATA.branches || []).map(function (b) {
      return { b: b, v: CORE.classifyBranch(b) };
    }).sort(function (x, y) {
      var order = { current: 0, "active-wip": 1, "worktree-branch": 2, active: 3, stale: 4, archive: 5, "merged-idle": 6, tracking: 7 };
      return order[x.v.cat] - order[y.v.cat];
    });
  }

  function renderWorkspace() {
    var h = "";

    // Worktree section (out-of-folder work).
    var wts = (DATA.surfaces || []).filter(function (s) { return s.slug; });
    h += '<h3 class="sub-h">Worktrees outside this folder</h3>';
    h += '<p class="hint">Each worktree is its own checkout of this repo on its own branch. Nothing here is on origin until pushed.</p>';
    if (!wts.length) h += '<div class="empty">No linked worktrees.</div>';
    wts.forEach(function (s) {
      var b = (DATA.branches || []).filter(function (x) { return x.name === s.branch; })[0] || {};
      var v = CORE.classifyBranch(Object.assign({}, b, {
        worktree: s.relPath,
        dirtyFiles: s.files.length,
      }));
      h += '<div class="wcard">';
      h += '<div class="w-head"><strong>' + esc(s.slug) + '</strong><span class="bcat b-' + v.cat + '">' + v.cat + "</span>";
      h += '<span class="hint">' + esc(s.relPath) + " on " + esc(s.branch) + "</span></div>";
      h += '<div class="w-line"><span class="d-k">state</span>' + (s.files.length ? s.files.length + " uncommitted files" : "clean working tree") + ", " + (b.aheadVsOrigin || 0) + " commit(s) ahead of origin/main</div>";
      h += '<div class="w-line"><span class="d-k">verdict</span>' + esc(v.action) + "</div>";
      if (v.risks.length) h += '<div class="w-line"><span class="d-k">risks</span><ul class="cons">' + v.risks.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul></div>";
      h += '<div class="w-files mono">' + (s.files.length ? s.files.slice(0, 8).map(function (f) { return "<div>" + esc(f.path) + "</div>"; }).join("") : "") + (s.files.length > 8 ? "<div>... " + (s.files.length - 8) + " more</div>" : "") + "</div>";
      if ((b.aheadVsOrigin || 0) > 0) {
        h += '<div class="d-actions"><button class="btn small" data-bpushwt="' + esc(s.branch) + '">publish this work to GitHub</button>' +
          '<button class="btn small ghost" data-binspect="' + esc(s.branch) + '">copy inspect commands</button></div>';
      } else {
        h += '<div class="d-actions"><button class="btn small ghost" data-binspect="' + esc(s.branch) + '">copy inspect commands</button></div>';
      }
      h += "</div>";
    });

    // Branch organizer.
    h += '<h3 class="sub-h">Local branches and where they should live</h3>';
    h += '<p class="hint">Every action only <b>prepares a command</b> - nothing runs until you copy the queue and execute it. Deletions are force deletes and are only safe after a push or a backup.</p>';
    h += '<div class="org-actions"><button class="btn" id="genOrg">build full organization sequence</button>' +
      '<button class="btn ghost" id="clearQueue">clear queue</button>' +
      '<span class="hint" id="queueCount">' + state.queue.length + " commands queued</span></div>";
    branchVerdicts().forEach(function (pair) {
      var b = pair.b, v = pair.v;
      h += '<div class="wcard' + (v.cat === "current" ? " current" : "") + '">';
      h += '<div class="w-head"><strong class="mono">' + esc(b.name) + '</strong><span class="bcat b-' + v.cat + '">' + v.cat + "</span>";
      h += "<span class=\"hint\">tip " + b.tipDate.slice(0, 10) + " - " + (b.aheadVsOrigin == null ? "?" : b.aheadVsOrigin) + " ahead of origin/main - " + (b.existsRemotely ? "on origin" : "not on origin") + (b.upstream ? " - tracks " + esc(b.upstream) : "") + "</span></div>";
      h += '<div class="w-line"><span class="d-k">why</span>' + esc(v.why) + "</div>";
      h += '<div class="w-line"><span class="d-k">suggested</span>' + esc(v.action) + "</div>";
      if (v.risks.length) h += '<div class="w-line"><span class="d-k">risks</span><ul class="cons">' + v.risks.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul></div>";
      h += '<div class="d-actions">';
      if (v.suggestedRemote) {
        h += '<button class="btn small" data-bpush="' + esc(b.name) + "|" + esc(v.suggestedRemote) + '">push as ' + esc(v.suggestedRemote) + "</button>";
      }
      if ((b.aheadVsOrigin || 0) > 0 && !v.suggestedRemote && v.cat !== "current") {
        h += '<button class="btn small" data-bpush="' + esc(b.name) + "|" + esc(b.name) + '">push as ' + esc(b.name) + "</button>";
      }
      h += '<button class="btn small ghost" data-binspect="' + esc(b.name) + '">copy inspect commands</button>';
      if (v.deletable) {
        h += '<button class="btn small danger-ghost" data-bdel="' + esc(b.name) + '">delete local branch</button>';
      } else {
        h += '<button class="btn small danger-ghost" disabled title="' + esc(v.risks[0] || "cannot delete the current or checked-out branch") + '">delete (blocked: ' + esc(v.cat) + ")</button>";
      }
      h += "</div></div>";
    });

    // Command queue.
    h += '<h3 class="sub-h">Command queue (reviewed, not executed)</h3>';
    if (!state.queue.length) h += '<div class="empty">Queue is empty. Confirm an action above to stage its command here.</div>';
    else {
      h += '<pre class="msg" id="queueBox">' + esc(state.queue.join("\n")) + "</pre>";
      h += '<div class="d-actions"><button class="btn small" id="copyQueue">copy queue</button><button class="btn small ghost" id="clearQueue2">clear queue</button></div>';
    }
    h += '<h3 class="sub-h">Stashes (' + DATA.stashes.length + ")</h3>";
    if (DATA.stashes.length) {
      h += '<table class="files"><thead><tr><th>ref</th><th>date</th><th>subject</th><th>hint</th></tr></thead><tbody>';
      DATA.stashes.forEach(function (s) {
        h += "<tr><td><code>" + esc(s.ref) + "</code></td><td>" + s.date.slice(0, 10) + '</td><td><span class="path">' + esc(s.subject) + "</span></td><td class='c-task'>git stash show -p " + esc(s.ref) + "</td></tr>";
      });
      h += "</tbody></table>";
    } else h += '<div class="empty">No stashes.</div>';
    $("workspaceList").innerHTML = h;
  }

  // ------------------------------------------------- render: history

  function commitType(subject) {
    var m = /^(\w+)(\([^)]*\))?[:!]/.exec(subject || "");
    return m ? m[1] : "other";
  }

  function renderHistory() {
    var types = {};
    DATA.commits.forEach(function (c) { var t = commitType(c.subject); types[t] = (types[t] || 0) + 1; });
    var opts = ['<button class="chip' + (state.commitFilter === "all" ? " off" : "") + '" data-ctype="all">all ' + DATA.commits.length + "</button>"];
    Object.keys(types).sort(function (a, b) { return types[b] - types[a]; }).forEach(function (t) {
      opts.push('<button class="chip' + (state.commitFilter === t ? " off" : "") + '" data-ctype="' + t + '">' + t + " " + types[t] + "</button>");
    });
    $("commitFilters").innerHTML = opts.join("");
    var q = state.commitSearch.trim().toLowerCase();
    var rows = DATA.commits.filter(function (c) {
      if (state.commitFilter !== "all" && commitType(c.subject) !== state.commitFilter) return false;
      if (q && (c.subject + " " + c.short).toLowerCase().indexOf(q) < 0) return false;
      return true;
    });
    var html = ['<table class="files commits-t"><thead><tr><th class="c-date">date</th><th>hash</th><th>subject</th><th class="c-n">files</th></tr></thead><tbody>'];
    rows.forEach(function (c) {
      var areas = {};
      c.files.forEach(function (p) { areas[CORE.categoryOf(p)] = 1; });
      html.push("<tr><td>" + c.date.slice(0, 10) + '</td><td><code class="hash">' + c.short + '</code></td><td><span class="path">' + esc(c.subject) + "</span> " +
        Object.keys(areas).map(function (a) { return '<span class="cat-tag cat-' + a + '">' + a + "</span>"; }).join("") + "</td><td>" + c.files.length + "</td></tr>");
    });
    html.push("</tbody></table>");
    if (!rows.length) html = ['<div class="empty">No commits match.</div>'];
    $("commitList").innerHTML = html.join("");
  }

  // ------------------------------------------------- render: calendar

  function dateBuckets() {
    var byDay = {};
    state.plan.groups.forEach(function (g) {
      if (!g.date) return;
      (byDay[g.date] = byDay[g.date] || { groups: [], pushes: [] }).groups.push(g);
    });
    state.plan.pushes.forEach(function (p) {
      if (!p.date) return;
      (byDay[p.date] = byDay[p.date] || { groups: [], pushes: [] }).pushes.push(p);
    });
    return byDay;
  }

  function renderCalendar() {
    var parts = state.calMonth.split("-");
    var y = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
    var first = new Date(y, m - 1, 1);
    var startDow = first.getDay();
    var days = new Date(y, m, 0).getDate();
    var byDay = dateBuckets();
    var sel = '<select id="activeGroupSel" aria-label="active group"><option value="">- active group: pick -</option>';
    state.plan.groups.forEach(function (g) {
      sel += '<option value="' + g.index + '"' + (state.activeGroup === g.index ? " selected" : "") + ">G" + g.index + (g.slug ? " " + g.slug : "") + " (" + g.ids.length + ")</option>";
    });
    sel += "</select>";
    var html = '<div class="cal-head">' + sel +
      '<button class="btn small ghost" data-cal="-1" aria-label="previous month">&larr;</button><strong>' +
      first.toLocaleString("en-US", { month: "long", year: "numeric" }) + '</strong><button class="btn small ghost" data-cal="1" aria-label="next month">&rarr;</button>' +
      '<span class="hint">pick a group, then click a day to commit it then</span></div><div class="cal-grid">';
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function (d) { html += '<div class="cal-dow">' + d + "</div>"; });
    for (var i = 0; i < startDow; i++) html += "<div></div>";
    var today = todayIso();
    for (var dnum = 1; dnum <= days; dnum++) {
      var iso = y + "-" + ("0" + m).slice(-2) + "-" + ("0" + dnum).slice(-2);
      var day = byDay[iso];
      html += '<div class="cal-day' + (iso === today ? " today" : "") + (day ? " busy" : "") + '" data-day="' + iso + '" role="button" tabindex="0" aria-label="assign active group to ' + iso + '"><span class="dnum">' + dnum + "</span>";
      if (day) {
        day.groups.forEach(function (g) { html += '<span class="cal-g">G' + g.index + (g.slug ? " " + g.slug : "") + " (" + g.ids.length + ")</span>"; });
        day.pushes.forEach(function (p) { html += '<span class="cal-p">push ' + esc(p.branch) + "</span>"; });
      }
      html += "</div>";
    }
    html += "</div>";
    var unscheduled = state.plan.groups.filter(function (g) { return !g.date; });
    if (unscheduled.length) {
      html += '<h3 class="sub-h">Waiting for a date</h3><div class="unsched">';
      unscheduled.forEach(function (g) {
        html += '<span class="unsched-g">G' + g.index + (g.slug ? " " + g.slug : "") + " (" + g.ids.length + ' files) <button class="mini" data-dategroup="' + g.index + '">today</button></span>';
      });
      html += "</div>";
    }
    $("calendarGrid").innerHTML = html;
    var selEl = $("activeGroupSel");
    if (selEl) selEl.value = state.activeGroup || "";
  }

  // --------------------------------------------------- render: export

  function renderExport() {
    var warnings = planWarnings();
    var errors = warnings.filter(function (w) { return w.level === "error"; });
    var warns = warnings.filter(function (w) { return w.level === "warn"; });
    var infos = warnings.filter(function (w) { return w.level === "info"; });
    var h = "";
    if (warnings.length) {
      h += '<div class="wpanel">';
      var render = function (list, cls) {
        return list.map(function (w) { return '<div class="' + cls + '"><b>' + w.level.toUpperCase() + "</b> " + esc(w.msg) + "</div>"; }).join("");
      };
      h += render(errors, "wrow err") + render(warns, "wrow warn") + render(infos, "wrow info");
      h += "</div>";
      if (errors.length) h += '<p class="hint">Errors block one-click copy on purpose. Fix them (or confirm the override) before exporting.</p>';
    } else {
      h += '<div class="callout ok">No problems detected: every group has a date, every id resolves, nothing noisy is planned.</div>';
    }
    $("warnPanel").innerHTML = h;

    var seq = CORE.buildSequence(state.plan, plannedFilesById(), DATA.repoRoot);
    $("exportScript").textContent = seq || "# plan is empty - group files in Triage first";
    $("planOut").value = CORE.encodePlan(state.plan);
  }

  function plannedFilesById() {
    var byId = {};
    Object.keys(FILES).forEach(function (id) {
      byId[id] = Object.assign({}, FILES[id], { typeOverride: state.overrides[id] });
    });
    return byId;
  }

  // ----------------------------------------------------- render: rail

  function renderRail() {
    var planned = state.plan.groups.reduce(function (n, g) { return n + g.ids.length; }, 0);
    var h = '<div class="rail-block"><h3>Plan summary</h3>' +
      '<div class="rail-stats"><span><b>' + state.plan.groups.length + "</b> groups</span><span><b>" + planned + "</b> files planned</span><span><b>" + state.plan.pushes.length + "</b> pushes</span></div></div>";
    h += '<div class="rail-block"><h3>Groups</h3>';
    if (!state.plan.groups.length) h += '<p class="hint">No groups yet. Tick files in Triage, then use the bottom bar.</p>';
    state.plan.groups.forEach(function (g) {
      var act = state.activeGroup === g.index ? " active" : "";
      h += '<div class="group' + act + '">';
      h += '<div class="g-head"><button class="g-name" data-focus-group="' + g.index + '" title="set as active group">G' + g.index + (g.slug ? " " + g.slug : "") + "</button>";
      h += '<span class="count">' + g.ids.length + "</span>";
      h += '<button class="mini ghost" data-delgroup="' + g.index + '" aria-label="delete group G' + g.index + '">&times;</button></div>';
      h += '<div class="row-wrap"><input type="date" value="' + (g.date || "") + '" data-gdate="' + g.index + '" aria-label="commit date for G' + g.index + '"/></div>';
      h += '<div class="g-files mono">' + (g.ids.length ? g.ids.map(function (id) {
        var f = FILES[id];
        return '<div class="g-file" title="' + esc(f ? f.path : "unknown id " + id) + '"><button class="mini ghost" data-rmfile="' + id + '" data-fromgroup="' + g.index + '" aria-label="remove from group">&times;</button>' + esc(f ? f.path : id + " (unknown - rescan?)") + "</div>";
      }).join("") : '<span class="hint">empty</span>') + "</div>";
      h += "</div>";
    });
    h += "</div>";
    h += '<div class="rail-block"><h3>Pushes</h3><div class="row-wrap"><select id="pushBranch">' +
      knownPushBranches().map(function (b) { return "<option>" + esc(b) + "</option>"; }).join("") +
      '</select><button class="btn small" id="addPush">schedule</button></div>';
    state.plan.pushes.forEach(function (p, i) {
      h += '<div class="row-wrap"><code class="hash">' + esc(p.branch) + '</code><input type="date" value="' + (p.date || "") + '" data-pdate="' + i + '"/><button class="mini ghost" data-delpush="' + i + '" aria-label="remove push">&times;</button></div>';
    });
    h += '<p class="hint">A push publishes everything already committed on that branch - including the 175 on main.</p></div>';
    $("rail").innerHTML = h;
  }

  // -------------------------------------------------- selection bar

  function renderActionBar() {
    var bar = $("actionBar");
    var n = Object.keys(state.selected).length;
    if (!n) { bar.hidden = true; bar.innerHTML = ""; return; }
    bar.hidden = false;
    var opts = '<option value="">- pick group -</option>';
    state.plan.groups.forEach(function (g) {
      opts += '<option value="' + g.index + '">G' + g.index + (g.slug ? " " + g.slug : "") + " (" + g.ids.length + ")</option>";
    });
    bar.innerHTML =
      '<span class="bar-count">' + n + " selected</span>" +
      '<select id="barGroupSel" aria-label="target group">' + opts + "</select>" +
      '<button class="btn small" id="barAdd">add to group</button>' +
      '<span class="bar-sep"></span>' +
      '<input id="barNewSlug" placeholder="new group name" aria-label="new group name"/>' +
      '<button class="btn small primary" id="barCreate">create group</button>' +
      '<span class="bar-sep"></span>' +
      '<button class="btn small ghost" id="barClear">clear selection</button>';
  }

  // ------------------------------------------------------------ events

  function toggleSelect(id, on) {
    if (on) state.selected[id] = true; else delete state.selected[id];
  }

  function queueCommand(cmd, o) {
    state.queue.push(cmd);
    toast("Command queued (" + state.queue.length + " total) - nothing executed", o || {});
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(function () { fallbackCopy(text); });
    } else fallbackCopy(text);
  }
  function fallbackCopy(text) {
    var ta = document.createElement("textarea");
    ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch (e) { /* ignore */ }
    document.body.removeChild(ta);
  }

  document.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape" && modalOpen()) { closeModal(); return; }
    if (ev.key === "Escape") { state.selected = {}; renderFiles(); renderActionBar(); return; }
    if (ev.key === "/" && !modalOpen() && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) {
      ev.preventDefault(); $("search").focus();
    }
  });

  document.addEventListener("click", function (ev) {
    if (ev.target.id === "modal") { closeModal(); return; }

    // Checkboxes before closest(): a click on the input must not resolve to
    // the row branch, or selection dies.
    if (ev.target.matches(".rowsel")) {
      toggleSelect(ev.target.getAttribute("data-id"), ev.target.checked);
      renderFiles(); renderActionBar(); return;
    }
    if (ev.target.id === "selAll") {
      var on = ev.target.checked;
      visibleFiles().forEach(function (f) { toggleSelect(f.id, on); });
      renderFiles(); renderActionBar(); return;
    }

    var t = ev.target.closest("button, .frow, .cal-day, th[data-sort]");
    if (!t) return;

    if (t.matches("[data-tab]")) { state.tab = t.getAttribute("data-tab"); render(); return; }

    // ---- files tab
    if (t.matches(".chip[data-fgroup]")) {
      state.filters[t.getAttribute("data-fgroup")][t.getAttribute("data-fval")] =
        !state.filters[t.getAttribute("data-fgroup")][t.getAttribute("data-fval")];
      renderFiles(); return;
    }
    if (t.matches(".chip[data-ctype]")) { state.commitFilter = t.getAttribute("data-ctype"); renderHistory(); return; }
    if (t.matches("th[data-sort]")) {
      var key = t.getAttribute("data-sort");
      if (state.sort.key === key) state.sort.dir *= -1; else { state.sort.key = key; state.sort.dir = 1; }
      renderFiles(); return;
    }
    if (t.matches(".tag")) {
      state.search = t.getAttribute("data-tag"); $("search").value = state.search; renderFiles(); return;
    }
    if (t.id === "dismissGuide") { state.hideGuide = true; save(); renderFiles(); return; }
    if (t.id === "clearFilters") {
      state.filters = { cat: {}, status: {}, kind: {} }; state.search = ""; $("search").value = ""; renderFiles(); return;
    }
    if (t.hasAttribute("data-jumpgroup")) {
      state.tab = "calendar"; state.activeGroup = parseInt(t.getAttribute("data-jumpgroup"), 10); render(); return;
    }
    if (t.hasAttribute("data-quickadd")) {
      var qid = t.getAttribute("data-quickadd");
      if (!state.plan.groups.length) {
        var ng = newGroup("group-1", [qid]); state.activeGroup = ng.index;
        toast("Created G1 with this file - rename it via the group flow in Triage");
      } else {
        var target = state.activeGroup || state.plan.groups[0].index;
        addToGroup([qid], target);
      }
      return;
    }
    if (t.hasAttribute("data-addone")) {
      if (!state.plan.groups.length) { var g0 = newGroup("group-1", [t.getAttribute("data-addone")]); state.activeGroup = g0.index; return; }
      if (!state.activeGroup) { toast("Pick an active group first (calendar toolbar or group name)", { kind: "warn" }); return; }
      addToGroup([t.getAttribute("data-addone")], state.activeGroup); return;
    }
    if (t.hasAttribute("data-copymsg")) {
      var mf = FILES[t.getAttribute("data-copymsg")];
      var msg = CORE.draftMessage(mf, state.overrides[mf.id]);
      copyText(msg.subject + "\n\n" + msg.body);
      toast("Commit message copied"); return;
    }
    if (t.matches(".frow")) {
      if (ev.target.closest("input,button,select")) return;
      var fid = t.getAttribute("data-id");
      state.expanded[fid] = !state.expanded[fid];
      renderFiles(); return;
    }
    if (t.id === "densityToggle") {
      state.density = state.density === "compact" ? "comfortable" : "compact";
      save(); render(); return;
    }

    // ---- selection bar
    if (t.id === "barAdd") {
      var sel = $("barGroupSel");
      if (!sel.value) { toast("Pick a target group first", { kind: "warn" }); return; }
      addToGroup(Object.keys(state.selected), parseInt(sel.value, 10));
      return;
    }
    if (t.id === "barCreate") {
      var slug = slugify($("barNewSlug").value);
      if (!slug) { toast("Give the group a short name first - it becomes the commit theme", { kind: "warn" }); return; }
      var dup = state.plan.groups.some(function (g) { return g.slug === slug; });
      var create = function () {
        var g2 = newGroup(slug, Object.keys(state.selected));
        state.activeGroup = g2.index;
        state.selected = {};
        renderFiles(); renderActionBar();
        toast("Created G" + g2.index + " " + slug + " - next: give it a date on Schedule");
      };
      if (dup) {
        askConfirm({
          title: 'Group name "' + slug + '" already exists',
          body: "You can still use it, but two groups with one name read ambiguously in scripts and plans.",
          consequences: ["Creates G" + nextGroupIndex() + " with the same slug as an existing group", "Warnings on Review will flag the duplicate name"],
          confirmLabel: "create anyway", danger: false, onConfirm: create,
        });
      } else create();
      return;
    }
    if (t.id === "barClear") { state.selected = {}; renderFiles(); renderActionBar(); return; }

    // ---- rail / groups
    if (t.hasAttribute("data-focus-group")) { state.activeGroup = parseInt(t.getAttribute("data-focus-group"), 10); render(); return; }
    if (t.hasAttribute("data-delgroup")) {
      removeGroup(parseInt(t.getAttribute("data-delgroup"), 10)); return;
    }
    if (t.hasAttribute("data-rmfile")) {
      removeFromGroup(t.getAttribute("data-rmfile"), parseInt(t.getAttribute("data-fromgroup"), 10)); return;
    }
    if (t.id === "addPush") {
      var pb = $("pushBranch");
      state.plan.pushes.push({ branch: pb.value, date: null });
      save(); render(); toast("Push of " + pb.value + " added - give it a date"); return;
    }
    if (t.hasAttribute("data-delpush")) {
      var pi = parseInt(t.getAttribute("data-delpush"), 10);
      var backupPush = state.plan.pushes[pi];
      state.plan.pushes.splice(pi, 1); save(); render();
      toast("Removed push of " + backupPush.branch, { undo: function () {
        if (state.plan.pushes.indexOf(backupPush) < 0) state.plan.pushes.splice(Math.min(pi, state.plan.pushes.length), 0, backupPush);
        save(); render();
      } });
      return;
    }

    // ---- plan io
    if (t.id === "copyPlan") {
      var errs = planWarnings().filter(function (w) { return w.level === "error"; });
      var doCopy = function () { copyText(CORE.encodePlan(state.plan)); toast("Plan string copied"); };
      if (errs.length) {
        askConfirm({
          title: "Plan has " + errs.length + " error" + (errs.length > 1 ? "s" : ""),
          body: "The plan string will still copy, but an agent executing it will hit the same problems. Fix them on this page first if you can.",
          consequences: errs.slice(0, 4).map(function (w) { return w.msg; }),
          confirmLabel: "copy anyway", danger: true, onConfirm: doCopy,
        });
      } else doCopy();
      return;
    }
    if (t.id === "clearPlan") {
      if (!state.plan.groups.length && !state.plan.pushes.length) { toast("Plan is already empty"); return; }
      askConfirm({
        title: "Clear the whole plan?",
        body: "Removes every group, file assignment, date and push entry. One undo is offered right after.",
        consequences: ["Groups and dates are deleted from the plan", "Files themselves are untouched - this only edits the plan"],
        confirmLabel: "clear plan", danger: true, onConfirm: clearPlan,
      });
      return;
    }
    if (t.id === "loadPlan") {
      var parsed = CORE.parsePlan($("planIn").value);
      var pm = $("planMsg");
      if (!parsed.ok) { pm.textContent = "errors: " + parsed.errors.join("; "); return; }
      if (parsed.repo !== DATA.repo) { pm.textContent = "plan is for repo '" + parsed.repo + "', this scan is '" + DATA.repo + "'"; return; }
      var newIds = [], oldIds = [];
      parsed.groups.forEach(function (g) {
        g.ids.forEach(function (id) { (FILES[id] ? newIds : oldIds).push(id); });
      });
      var applyLoad = function () {
        var backup = JSON.parse(JSON.stringify(state.plan));
        state.plan = parsed;
        state.activeGroup = findGroup(state.activeGroup || -1) ? state.activeGroup : null;
        save(); render();
        toast("Loaded " + parsed.groups.length + " groups", {
          undo: function () { state.plan = backup; save(); render(); toast("Previous plan restored"); },
        });
      };
      if (state.plan.groups.length) {
        askConfirm({
          title: "Replace the current plan?",
          body: "Loading overwrites your " + state.plan.groups.length + " existing group(s). Undo is offered after.",
          consequences: newIds.length + " ids resolve in this scan" + (oldIds.length ? "; " + oldIds.length + " do NOT (stale scan?) - they are kept and flagged" : ""),
          confirmLabel: "replace plan", danger: state.plan.groups.length > 0, onConfirm: applyLoad,
        });
      } else applyLoad();
      return;
    }

    // ---- export
    if (t.id === "copyScript") {
      var errs2 = planWarnings().filter(function (w) { return w.level === "error"; });
      var doScript = function () { copyText($("exportScript").textContent); toast("Script copied - review in a terminal before running"); };
      if (errs2.length) {
        askConfirm({
          title: "Copy a script with " + errs2.length + " error" + (errs2.length > 1 ? "s" : "") + "?",
          body: "Errors mean the script would fail or commit the wrong things. This is your last checkpoint.",
          consequences: errs2.slice(0, 4).map(function (w) { return w.msg; }),
          confirmLabel: "copy anyway", danger: true, onConfirm: doScript,
        });
      } else doScript();
      return;
    }
    if (t.id === "dlScript") {
      var errsDl = planWarnings().filter(function (w) { return w.level === "error"; });
      var doDownload = function () {
        var blob = new Blob(["#!/bin/sh\nset -e\n# Generated by Commit Planner - review before running.\n" + $("exportScript").textContent + "\n"], { type: "text/x-sh" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
        a.download = "commit-plan-" + todayIso() + ".sh";
        a.click();
        toast("Script downloaded (downloads folder)");
      };
      if (errsDl.length) {
        askConfirm({
          title: "Download a script with " + errsDl.length + " error" + (errsDl.length > 1 ? "s" : "") + "?",
          body: "Errors mean the script would fail or commit the wrong things.",
          consequences: errsDl.slice(0, 4).map(function (w) { return w.msg; }),
          confirmLabel: "download anyway", danger: true, onConfirm: doDownload,
        });
      } else doDownload();
      return;
    }
    if (t.id === "runTests") { runSelfCheck(); return; }
    if (t.id === "expJson") {
      var jb = new Blob([JSON.stringify({ plan: state.plan, overrides: state.overrides }, null, 1)], { type: "application/json" });
      var ja = document.createElement("a");
      ja.href = URL.createObjectURL(jb);
      ja.download = "commit-plan-" + todayIso() + ".json";
      ja.click(); toast("Plan JSON downloaded"); return;
    }

    // ---- workspace
    if (t.hasAttribute("data-bpush")) {
      var parts = t.getAttribute("data-bpush").split("|");
      requestPush(parts[0], parts[1]); return;
    }
    if (t.hasAttribute("data-bpushwt")) {
      var br = t.getAttribute("data-bpushwt");
      var s = (DATA.surfaces || []).filter(function (x) { return x.branch === br; })[0];
      var cmd = "git" + (s && s.slug ? " -C " + s.relPath : "") + " push -u origin " + br;
      var bb = (DATA.branches || []).filter(function (x) { return x.name === br; })[0] || {};
      askConfirm({
        title: "Publish " + br + "?",
        body: "This creates the branch on GitHub from the worktree work.",
        consequences: [
          "Command: " + cmd,
          "Publishes " + (bb.aheadVsOrigin || 0) + " commit(s) that exist only on this machine",
          CORE.classifyBranch(Object.assign({}, bb, { worktree: s ? s.relPath : null, dirtyFiles: s ? s.files.length : 0 })).risks.join("; ") || "No known risks",
        ],
        confirmLabel: "queue push command", danger: false,
        onConfirm: function () { queueCommand(cmd); renderWorkspace(); },
      });
      return;
    }
    if (t.hasAttribute("data-bdel")) {
      var dn = t.getAttribute("data-bdel");
      var db = (DATA.branches || []).filter(function (x) { return x.name === dn; })[0] || {};
      askConfirm({
        title: "Delete local branch " + dn + "?",
        body: "This force-deletes the branch on this machine. It is only safe if the commits exist somewhere else.",
        consequences: [
          "Command: git branch -D " + dn,
          db.existsRemotely ? "A copy exists on origin - recoverable" : "NO remote copy - the commits would be unrecoverable without the reflog",
          (db.aheadVsOrigin || 0) > 0 ? db.aheadVsOrigin + " commit(s) are not on origin/main" : "Fully contained in origin/main",
        ],
        confirmLabel: "queue delete command", danger: true,
        onConfirm: function () { queueCommand("git branch -D " + dn); renderWorkspace(); },
      });
      return;
    }
    if (t.hasAttribute("data-binspect")) {
      var bn = t.getAttribute("data-binspect");
      copyText(
        "git log --oneline origin/main.." + bn + " | head -30\n" +
        "git diff --stat origin/main..." + bn + " | tail -5\n" +
        "git log -3 --format='%h %cI %s' " + bn
      );
      toast("Inspect commands copied"); return;
    }
    if (t.id === "genOrg") { proposeOrganization(); return; }
    if (t.id === "clearQueue" || t.id === "clearQueue2") {
      if (!state.queue.length) { toast("Queue already empty"); return; }
      var backupQ = state.queue.slice();
      state.queue = [];
      renderWorkspace();
      toast("Queue cleared", { undo: function () { state.queue = backupQ; renderWorkspace(); } });
      return;
    }
    if (t.id === "copyQueue") { copyText(state.queue.join("\n")); toast("Queue copied - run them one by one, reading each"); return; }

    // ---- calendar
    if (t.matches("[data-cal]")) {
      var cp = state.calMonth.split("-").map(Number);
      var dt = new Date(cp[0], cp[1] - 1 + parseInt(t.getAttribute("data-cal"), 10), 1);
      state.calMonth = dt.getFullYear() + "-" + (dt.getMonth() + 1);
      renderCalendar(); return;
    }
    if (t.matches(".cal-day")) {
      var ag = state.activeGroup ? findGroup(state.activeGroup) : null;
      if (!ag) { toast("Pick an active group in the toolbar above the calendar first", { kind: "warn" }); return; }
      var day = t.getAttribute("data-day");
      var prev = ag.date;
      var assign = function () {
        ag.date = day; save(); render();
        toast("G" + ag.index + (ag.slug ? " " + ag.slug : "") + " will commit on " + day, {
          undo: function () {
            var live = findGroup(ag.index);
            if (!live) { toast("That group no longer exists - nothing to undo", { kind: "warn" }); return; }
            live.date = prev; save(); render();
          },
        });
      };
      if (prev && prev !== day) {
        askConfirm({
          title: "Move G" + ag.index + " from " + prev + " to " + day + "?",
          body: "The group already has a commit date.",
          consequences: ["All " + ag.ids.length + " file(s) in the group move to " + day, "Undo is offered after"],
          confirmLabel: "move date", danger: false, onConfirm: assign,
        });
      } else assign();
      return;
    }
    if (t.hasAttribute("data-dategroup")) {
      var dg = findGroup(parseInt(t.getAttribute("data-dategroup"), 10));
      if (dg) { dg.date = todayIso(); save(); render(); toast("G" + dg.index + " scheduled for today"); }
      return;
    }
  });

  function requestPush(branch, remoteName) {
    var b = (DATA.branches || []).filter(function (x) { return x.name === branch; })[0] || {};
    var v = CORE.classifyBranch(b);
    var cmd = "git push -u origin " + branch + ":" + remoteName;
    var cons = [
      "Command: " + cmd,
      "Creates " + remoteName + " on GitHub" + (remoteName === branch ? " (same name)" : " (renamed for the remote)"),
    ];
    if ((b.aheadVsOrigin || 0) > 0) cons.push("Publishes " + b.aheadVsOrigin + " commit(s) that exist only on this machine");
    if (v.cat === "archive") cons.push("This is a history backup - thousands of old commits become public on your repo");
    v.risks.forEach(function (r) { cons.push("Risk: " + r); });
    askConfirm({
      title: "Push " + branch + " as " + remoteName + "?",
      body: "Nothing runs now - confirming stages the command in the queue below for you to copy and run.",
      consequences: cons,
      confirmLabel: "queue push command", danger: v.cat === "archive",
      onConfirm: function () { queueCommand(cmd); renderWorkspace(); },
    });
  }

  function proposeOrganization() {
    var cmds = [], notes = [];
    branchVerdicts().forEach(function (p) {
      var b = p.b, v = p.v;
      if (v.cat === "current") { notes.push(b.name + ": current branch - schedule its commits via the plan, then push on the plan's push date"); return; }
      if (b.worktree && v.cat === "active-wip") { notes.push(b.name + ": has uncommitted worktree files - commit them first (Triage tab)"); return; }
      if ((b.aheadVsOrigin || 0) > 0 && v.suggestedRemote) {
        cmds.push("git push -u origin " + b.name + ":" + v.suggestedRemote);
        notes.push(b.name + " -> origin/" + v.suggestedRemote + " (" + v.why + ")");
      } else if (v.cat === "merged-idle") {
        notes.push(b.name + ": nothing unique - candidate for local deletion, nothing to push");
      } else if (v.cat === "tracking") {
        notes.push(b.name + ": mirrors origin - nothing to push");
      }
    });
    if (DATA.stats.commitsUnpushed > 0) {
      notes.push("main: " + DATA.stats.commitsUnpushed + " unpushed commits - schedule its push on the Schedule tab");
    }
    var bodyText = (cmds.length ? cmds.join("\n") + "\n\n" : "") + notes.map(function (n) { return "# " + n; }).join("\n");
    askConfirm({
      title: "Build the full organization sequence?",
      body: "Reviews every branch, proposes a remote home for each, and stages the push commands in the queue. Nothing executes.",
      consequences: ["Adds " + cmds.length + " push command(s) to the queue", "Notes are copied to your clipboard for review"],
      confirmLabel: cmds.length ? "build sequence (" + cmds.length + " pushes)" : "copy notes only", danger: false,
      onConfirm: function () {
        state.queue = state.queue.concat(cmds);
        copyText(bodyText);
        renderWorkspace();
        toast(cmds.length + " push commands queued; notes copied");
      },
    });
  }

  // change events
  document.addEventListener("change", function (ev) {
    var t = ev.target;
    if (t.id === "hideNoise") { state.hideNoise = t.checked; renderFiles(); return; }
    if (t.id === "activeGroupSel") { state.activeGroup = t.value ? parseInt(t.value, 10) : null; renderCalendar(); renderRail(); return; }
    if (t.matches("[data-gdate]")) {
      var g = findGroup(parseInt(t.getAttribute("data-gdate"), 10));
      if (g) {
        var prevG = g.date;
        if ((t.value || null) === (prevG || null)) return;
        g.date = t.value || null; save();
        toast(t.value ? "G" + g.index + " will commit on " + t.value : "Date cleared for G" + g.index, {
          undo: function () {
            var live = findGroup(g.index);
            if (!live) { toast("That group no longer exists - nothing to undo", { kind: "warn" }); return; }
            live.date = prevG; save(); render();
          },
        });
      }
      return;
    }
    if (t.matches("[data-pdate]")) { state.plan.pushes[parseInt(t.getAttribute("data-pdate"), 10)].date = t.value || null; save(); return; }
    if (t.matches("[data-type]")) { state.overrides[t.getAttribute("data-type")] = t.value; save(); renderFiles(); return; }
    if (t.id === "impJson" && t.files && t.files[0]) {
      var r = new FileReader();
      r.onload = function () {
        try {
          var p = JSON.parse(r.result);
          if (p.plan && p.plan.repo === DATA.repo) {
            askConfirm({
              title: "Import this plan JSON?",
              body: "It replaces the current plan. Undo is offered after.",
              consequences: [p.plan.groups.length + " groups, " + p.plan.pushes.length + " pushes in the file"],
              confirmLabel: "import plan", danger: false,
              onConfirm: function () {
                var backup = JSON.parse(JSON.stringify(state.plan));
                state.plan = p.plan; state.overrides = p.overrides || {};
                state.activeGroup = findGroup(state.activeGroup || -1) ? state.activeGroup : null;
                save(); render();
                toast("Plan JSON imported", { undo: function () { state.plan = backup; save(); render(); } });
              },
            });
          } else toast("Import rejected: repo mismatch or bad file", { kind: "warn" });
        } catch (e) { toast("Import failed: " + e.message, { kind: "warn" }); }
      };
      r.readAsText(t.files[0]);
    }
  });

  document.addEventListener("input", function (ev) {
    if (ev.target.id === "search") { state.search = ev.target.value; renderFiles(); }
    if (ev.target.id === "commitSearch") { state.commitSearch = ev.target.value; renderHistory(); }
  });

  // auto-group (with confirm: it replaces existing groups)
  document.addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-auto]");
    if (!b) return;
    var mode = b.getAttribute("data-auto");
    var apply = function () {
      var keyFn = mode === "task" ? function (f) { return f.task || CORE.taskOf(f.path); }
        : mode === "status" ? function (f) { return f.status; }
        : function (f) { return CORE.categoryOf(f.path); };
      var buckets = {};
      visibleFiles().forEach(function (f) {
        if (isNoise(f)) return;
        var k = keyFn(f);
        (buckets[k] = buckets[k] || []).push(f.id);
      });
      var backup = JSON.parse(JSON.stringify(state.plan));
      state.plan.groups = [];
      state.activeGroup = null;
      Object.keys(buckets).sort().forEach(function (k, i) {
        state.plan.groups.push({ index: i + 1, date: null, slug: slugify(k), ids: buckets[k] });
      });
      save(); render();
      toast("Auto-grouped by " + mode + ": " + state.plan.groups.length + " groups", {
        undo: function () { state.plan = backup; save(); render(); },
      });
    };
    if (state.plan.groups.length) {
      askConfirm({
        title: "Replace " + state.plan.groups.length + " existing group(s)?",
        body: "Auto-group rebuilds the plan from scratch based on the " + mode + " of currently visible files.",
        consequences: ["Current groups and their dates are discarded", "One undo is offered right after"],
        confirmLabel: "replace groups", danger: true, onConfirm: apply,
      });
    } else apply();
  });

  // ------------------------------------------------------ self-check

  function runSelfCheck() {
    var out = [];
    var ok = function (name, cond, detail) { out.push((cond ? "PASS " : "FAIL ") + name + (detail ? " - " + detail : "")); };
    var plan = { repo: DATA.repo, groups: [{ index: 1, date: "2026-01-01", slug: "t", ids: ["a1b2c3d4"] }], pushes: [] };
    var rt = CORE.parsePlan(CORE.encodePlan(plan));
    ok("plan string round-trip", rt.ok && rt.groups[0].ids[0] === "a1b2c3d4");
    var ids = allFiles().map(function (f) { return f.id; });
    ok("file ids unique", new Set(ids).size === ids.length);
    var planned = [];
    state.plan.groups.forEach(function (g) { planned = planned.concat(g.ids); });
    var unknown = planned.filter(function (id) { return !FILES[id]; });
    ok("all planned ids exist in this scan", unknown.length === 0, unknown.length ? "unknown: " + unknown.join(",") : "");
    ok("scan present", !!DATA.generatedAt, DATA.generatedAt);
    ok("commits parsed with files", DATA.commits.length === 0 || DATA.commits.every(function (c) { return c.files.length > 0; }));
    ok("no file in two groups", planned.length === new Set(planned).size);
    ok("branch classification present", (DATA.branches || []).every(function (b) { return b.existsRemotely != null; }));
    $("testOut").innerHTML = out.map(function (l) { return '<div class="' + (l.indexOf("PASS") === 0 ? "pass" : "fail") + '">' + esc(l) + "</div>"; }).join("");
  }

  // ------------------------------------------------------------ boot

  var params = new URLSearchParams(location.search);
  var wantTab = params.get("tab");
  if (wantTab && $("panel-" + wantTab)) state.tab = wantTab;
  load();
  document.body.classList.toggle("compact", state.density === "compact");
  if (params.get("demo")) {
    var pool = allFiles().filter(function (f) { return !isNoise(f); });
    var pick = function (n) { return pool.splice(0, Math.min(n, pool.length)).map(function (f) { return f.id; }); };
    state.plan.groups = [
      { index: 1, date: todayIso(), slug: "demo-analytics", ids: pick(3) },
      { index: 2, date: null, slug: "demo-docs", ids: pick(4) },
    ];
    state.plan.pushes = [{ branch: "main", date: new Date(Date.now() + 172800000).toISOString().slice(0, 10) }];
    state.activeGroup = 1;
  }
  render();
  if (params.get("selftest")) runSelfCheck();
})();
