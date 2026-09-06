#!/usr/bin/env python3
"""Repo Triage Burst — implements workflows/repo-triage-burst.md.

Usage:
    python3 repo_triage.py            # gather -> Telegram brief -> await go -> execute -> receipt
    python3 repo_triage.py --dry-run  # gather -> print brief to stdout, no side effects
    python3 repo_triage.py --approve "go 1 2"   # non-interactive: brief + immediate approval

Credentials: ~/.config/cqd-workflows/telegram.env  (TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID)
Stdlib only. Read-only except after explicit approval.
"""

import json
import os
import re
import subprocess
import sys
import time
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
STATE_FILE = REPO_ROOT / ".workflow-state" / "triage-last-run.json"
TG_ENV = Path.home() / ".config" / "cqd-workflows" / "telegram.env"
APPROVAL_TIMEOUT_S = 3600
STALE_DAYS = 14
MAX_READY_BEADS = 5
MAX_BRIEF_LINES = 40

# ---------------------------------------------------------------- utilities


def sh(cmd: list[str], timeout: int = 60) -> tuple[int, str]:
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, cwd=REPO_ROOT)
        return proc.returncode, (proc.stdout or "") + (proc.stderr or "")
    except subprocess.TimeoutExpired:
        return 124, "timeout"


def gh_json(args: list[str], timeout: int = 60):
    code, out = sh(["gh"] + args, timeout=timeout)
    if code != 0:
        return None
    try:
        return json.loads(out)
    except json.JSONDecodeError:
        return None


def load_telegram_env() -> dict[str, str]:
    if not TG_ENV.exists():
        return {}
    out = {}
    for line in TG_ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, _, v = line.partition("=")
            out[k.strip()] = v.strip()
    return out


def tg_api(method: str, payload: dict) -> dict | None:
    env = load_telegram_env()
    token = env.get("TELEGRAM_BOT_TOKEN", "")
    if not token:
        return None
    url = f"https://api.telegram.org/bot{token}/{method}"
    data = json.dumps(payload).encode()
    req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=40) as resp:
            return json.loads(resp.read().decode())
    except Exception as exc:  # noqa: BLE001
        print(f"[triage] telegram {method} failed: {exc}", file=sys.stderr)
        return None


# ---------------------------------------------------------------- gather


def semver_bump(title: str) -> str:
    low = title.lower()
    if "digest" in low:
        return "digest"
    if "pin" in low and "dependency" in low:
        return "pin"
    versions = re.findall(r"(\d+)\.(\d+)\.(\d+)", title)
    if len(versions) >= 2:
        old, new = versions[0], versions[-1]
        if new[0] != old[0]:
            return "major"
        if new[1] != old[1]:
            return "minor"
        return "patch"
    return "unknown"


def check_rollup_state(rollup: list | None) -> str:
    if not rollup:
        return "none"
    if any(c.get("status") != "COMPLETED" for c in rollup):
        return "pending"
    states = [c.get("conclusion") for c in rollup if c.get("status") == "COMPLETED"]
    if any(c not in (None, "SUCCESS", "SKIPPED", "NEUTRAL") for c in states):
        return "red"
    return "green"


def gather_all_open_prs() -> list[dict]:
    prs = gh_json([
        "pr", "list", "--state", "open",
        "--json", "number,title,statusCheckRollup,updatedAt,author",
    ]) or []
    out = []
    for pr in prs:
        author = pr.get("author", {}).get("login", "?")
        low = author.lower()
        kind = "dep_bot" if ("renovate" in low or "dependabot" in low) else "human"
        out.append({
            "kind": kind,
            "author": author,
            "number": pr["number"],
            "title": pr["title"],
            "bump": semver_bump(pr["title"]) if kind == "dep_bot" else "n/a",
            "checks": check_rollup_state(pr.get("statusCheckRollup")),
            "updated": pr.get("updatedAt", ""),
        })
    return out


def gather_renovate() -> list[dict]:
    return [p for p in gather_all_open_prs() if p["kind"] == "dep_bot"]


def gather_ci_failures() -> list[dict]:
    issues = gh_json([
        "issue", "list", "--label", "ci-failure", "--state", "open",
        "--json", "number,title,url",
    ]) or []
    # Spec: bead should link issue + run URL. One call covers all items.
    run_url = ""
    failed = gh_json(["run", "list", "--workflow", "ci.yml", "--status", "failure",
                      "--limit", "1", "--json", "url"])
    if isinstance(failed, list) and failed:
        run_url = failed[0].get("url", "")
    return [{"kind": "ci_failure", "number": i["number"], "title": i["title"],
             "url": i["url"], "run_url": run_url} for i in issues]


def gather_ready_beads() -> list[str]:
    code, out = sh(["bd", "ready"])
    lines = [
        ln.strip() for ln in out.splitlines()
        if "Classroom-Quick-Downloader-" in ln and ln.strip().startswith(("○", "◐"))
    ]
    return lines[:MAX_READY_BEADS]


def gather_stale_prs(dep_numbers: set[int]) -> list[dict]:
    prs = [p for p in gather_all_open_prs() if p["number"] not in dep_numbers]
    cutoff = time.time() - STALE_DAYS * 86400
    out = []
    for pr in prs:
        try:
            updated = datetime.fromisoformat(pr["updated"].replace("Z", "+00:00")).timestamp()
        except Exception:  # noqa: BLE001
            continue
        if updated < cutoff:
            age_days = int((time.time() - updated) / 86400)
            out.append({"kind": "stale_pr", "number": pr["number"], "title": pr["title"], "age_days": age_days})
    return out


def gather_release_drafts() -> list[dict]:
    rels = gh_json(["release", "list", "--draft", "--json", "tagName,createdAt"]) or []
    return [{"kind": "draft", "tag": r.get("tagName", "?"), "created": r.get("createdAt", "?")} for r in rels]


def gather_monitor_failures(since_ts: float) -> list[str]:
    runs = gh_json([
        "run", "list", "--workflow", "https-endpoint-monitor.yml",
        "--json", "conclusion,createdAt,displayTitle",
    ]) or []
    out = []
    for run in runs:
        if run.get("conclusion") not in ("success", "skipped", None):
            try:
                created = datetime.fromisoformat(run["createdAt"].replace("Z", "+00:00")).timestamp()
            except Exception:  # noqa: BLE001
                continue
            if created >= since_ts:
                out.append(f"{run.get('displayTitle', 'endpoint monitor')} — {run.get('conclusion')}")
    return out


def read_last_run() -> float:
    try:
        return float(json.loads(STATE_FILE.read_text())["last_run_ts"])
    except Exception:  # noqa: BLE001
        return 0.0


# ------------------------------------------------------- bot: extra gatherers

REPO_API = "repos/adhamhaithameid/Classroom-Quick-Downloader"


def get_repo_variables() -> dict[str, str]:
    """Public repo variables (endpoint URLs etc.) — values readable, no secrets."""
    out: dict[str, str] = {}
    data = gh_json(["variable", "list", "--json", "name,value"])
    if isinstance(data, list):
        for v in data:
            if isinstance(v, dict) and v.get("name"):
                out[v["name"]] = v.get("value", "")
    return out


def probe_endpoint(url: str, timeout_s: float = 8.0) -> tuple[int, int]:
    """GET an endpoint; returns (http_code|0 for unreachable, latency_ms)."""
    start = time.perf_counter()
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "cqd-repo-bot/1.0"})
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            code = resp.status
    except urllib.error.HTTPError as exc:
        code = exc.code
    except Exception:  # noqa: BLE001
        code = 0
    ms = int((time.perf_counter() - start) * 1000)
    return code, ms


def coerce_snapshot_metrics(payload: dict | None) -> dict[str, int]:
    """Defensively extract product telemetry from the public snapshot API."""

    def _int(v) -> int:
        try:
            iv = int(v)
            return iv if iv >= 0 else 0
        except (TypeError, ValueError):
            return 0

    overview = (payload or {}).get("overview") or {}
    totals = overview.get("totals") or {}
    installs = overview.get("installs") or {}
    return {
        "downloads": _int(totals.get("downloads")),
        "success": _int(totals.get("success")),
        "fail": _int(totals.get("fail")),
        "cancelled": _int(totals.get("cancelled")),
        "users": _int(installs.get("usersTotal")),
    }


def gather_endpoint_health() -> list[dict]:
    vars_ = get_repo_variables()
    targets = []
    site = vars_.get("PUBLIC_SITE_URL")
    worker = vars_.get("PUBLIC_WORKER_BASE_URL")
    oracle = vars_.get("PUBLIC_ORACLE_API_BASE_URL")
    if site:
        targets.append(("marketing site", site.rstrip("/") + "/"))
    if worker:
        targets.append(("worker /health", worker.rstrip("/") + "/health"))
    if oracle:
        targets.append(("oracle public API", oracle.rstrip("/") + "/api/public/website/snapshot"))
    results = []
    for name, url in targets:
        code, ms = probe_endpoint(url)
        results.append({"name": name, "url": url, "code": code, "ms": ms})
    return results


def gather_snapshot_metrics() -> dict[str, int]:
    vars_ = get_repo_variables()
    worker = vars_.get("PUBLIC_WORKER_BASE_URL")
    oracle = vars_.get("PUBLIC_ORACLE_API_BASE_URL")
    for base in (worker, oracle):
        if not base:
            continue
        for path in ("/api/public/website/snapshot", "/api/site/v1/snapshot"):
            req = urllib.request.Request(
                base.rstrip("/") + path,
                headers={"User-Agent": "cqd-repo-bot/1.0", "Accept": "application/json"},
            )
            try:
                with urllib.request.urlopen(req, timeout=6) as resp:
                    return coerce_snapshot_metrics(json.loads(resp.read().decode()))
            except Exception:  # noqa: BLE001
                continue
    return coerce_snapshot_metrics(None)


def gather_versions() -> dict[str, str]:
    def pkg_version(path: str) -> str:
        try:
            return json.loads((REPO_ROOT / path).read_text(encoding="utf-8")).get("version", "?")
        except Exception:  # noqa: BLE001
            return "?"

    latest = "?"
    rels = gh_json(["release", "list", "--limit", "10", "--json", "tagName,isDraft,isLatest"])
    if isinstance(rels, list):
        for rel in rels:
            if rel.get("isLatest") and not rel.get("isDraft"):
                latest = rel.get("tagName", "?")
                break
    return {
        "root monorepo": pkg_version("package.json"),
        "extension": pkg_version("extension/package.json"),
        "cloudflare-worker": pkg_version("cloudflare-worker/package.json"),
        "website": pkg_version("website/package.json"),
        "latest release": latest,
    }


DEPLOY_WORKFLOWS = [
    ("website → Cloudflare", "website-deploy.yml"),
    ("worker → Cloudflare", "deploy-cloudflare-worker.yml"),
    ("oracle dashboard", "oracle-dashboard-deploy.yml"),
    ("graph → GH Pages", "github-pages.yml"),
]


def gather_deployments() -> list[dict]:
    out = []
    for name, wf in DEPLOY_WORKFLOWS:
        runs = gh_json(["run", "list", "--workflow", wf, "--limit", "1",
                        "--json", "conclusion,createdAt"])
        if isinstance(runs, list) and runs:
            created = runs[0].get("createdAt", "")
            try:
                age_h = int((time.time() - datetime.fromisoformat(
                    created.replace("Z", "+00:00")).timestamp()) / 3600)
                age = f"{age_h}h ago"
            except Exception:  # noqa: BLE001
                age = "?"
            out.append({"name": name, "conclusion": runs[0].get("conclusion", "?"), "age": age})
        else:
            out.append({"name": name, "conclusion": "no runs", "age": "-"})
    return out


def gather_security() -> dict:
    """Dependabot + CodeQL + secret-scanning alerts.

    Sets '_unavailable' when the GitHub API itself failed for a source, so
    callers can distinguish 'zero alerts' from 'couldn't check' — reporting a
    fabricated all-clear would be worse than admitting blindness.
    """
    out: dict = {"dependabot": [], "codeql": [], "secret": [], "_unavailable": False}
    dep = gh_json(["api", f"{REPO_API}/dependabot/alerts?state=open", "--jq",
                   "[.[] | {severity: .security_alerts.severity, pkg: .dependency.package.name, num: .number}]"])
    if isinstance(dep, list):
        out["dependabot"] = dep
    else:
        out["_unavailable"] = True
    codeql = gh_json(["api", f"{REPO_API}/code-scanning/alerts?state=open&per_page=100", "--jq",
                      "[.[] | {sev: .rule.security_severity_level, rule: .rule.description, num: .number}]"])
    if isinstance(codeql, list):
        out["codeql"] = codeql
    else:
        out["_unavailable"] = True
    secret = gh_json(["api", f"{REPO_API}/secret-scanning/alerts?state=open", "--jq",
                      "[.[] | {secret_type, num: .number}]"])
    if isinstance(secret, list):
        out["secret"] = secret
    else:
        out["_unavailable"] = True
    return out


def gather_failed_runs(limit: int = 8) -> list[str]:
    runs = gh_json([
        "run", "list", "--status", "failure",
        "--json", "workflowName,displayTitle,createdAt,event",
    ]) or []
    out = []
    for run in runs[:limit]:
        try:
            created = datetime.fromisoformat(run["createdAt"].replace("Z", "+00:00"))
            age_h = int((time.time() - created.timestamp()) / 3600)
            out.append(f"{run.get('workflowName', '?')} — {age_h}h ago")
        except Exception:  # noqa: BLE001
            continue
    return out


def gather_bd_summary() -> tuple[int, int, int]:
    code, out = sh(["bd", "stats"])
    total = ready = blocked = 0
    for ln in out.splitlines():
        if "Total Issues:" in ln:
            m = re.search(r"(\d+)", ln)
            total = int(m.group(1)) if m else total
        elif "Blocked:" in ln:
            m = re.search(r"(\d+)", ln)
            blocked = int(m.group(1)) if m else blocked
        elif "Ready to Work:" in ln:
            m = re.search(r"(\d+)", ln)
            ready = int(m.group(1)) if m else ready
    return total, ready, blocked


def gather_open_issues() -> list[dict]:
    issues = gh_json([
        "issue", "list", "--state", "open",
        "--json", "number,title,labels,createdAt",
    ]) or []
    out = []
    for i in issues:
        labels = [lb.get("name", "") for lb in i.get("labels", [])]
        out.append({"number": i["number"], "title": i["title"], "labels": labels})
    return out


# ---------------------------------------------------------------- brief


def build_items_and_brief(reno, fails, beads, stale, drafts, alerts):
    items: list[dict] = []   # executable/decision items (numbered)
    fyi: list[str] = []

    red: list[str] = []
    yellow: list[str] = []

    for pr in reno:
        if pr["bump"] == "major":
            idx = len(items) + 1
            items.append({"kind": "major_bead", "number": pr["number"], "title": pr["title"]})
            red.append(f"{pr['title'][:60]} — MAJOR bump: hold, review manually [bead on go {idx}]")
        elif pr["checks"] == "green" and pr["bump"] in {"patch", "minor", "pin", "digest"}:
            idx = len(items) + 1
            items.append({"kind": "merge", "number": pr["number"], "title": pr["title"]})
            m = re.search(r"bump (.+?) from (\S+) to (\S+)", pr["title"], re.IGNORECASE)
            if m:
                dep, frm, to = m.group(1)[:24], m.group(2), m.group(3)
                yellow.append(f"PR #{pr['number']} {dep} {frm}→{to} ({pr['bump']}) — checks ✅ [go {idx}]")
            else:
                yellow.append(f"PR #{pr['number']} {pr['title'][:52]} ({pr['bump']}, ✅) [go {idx}]")
        elif pr["checks"] in {"pending", "unknown"}:
            fyi.append(f"PR #{pr['number']} {pr['title'][:52]} — checks {pr['checks']}, next burst")
        else:
            idx = len(items) + 1
            items.append({"kind": "failure_bead", "ref": f"PR #{pr['number']}", "title": pr["title"]})
            red.append(f"PR #{pr['number']} {pr['title'][:48]} — checks ❌ [file bead on go {idx}]")

    for issue in fails:
        idx = len(items) + 1
        items.append({"kind": "failure_bead", "ref": f"issue #{issue['number']}", "title": issue["title"], "url": issue["url"]})
        red.append(f"CI failure issue #{issue['number']}: {issue['title'][:44]} [file bead on go {idx}]")

    if alerts:
        idx = len(items) + 1
        items.append({"kind": "monitor_bead",
                      "title": f"endpoint monitor failing ({len(alerts)} runs since last burst): {alerts[0]}"})
        red.append(f"Endpoint monitor failing ({len(alerts)} runs since last burst) "
                   f"— latest: {alerts[0][:40]} [file bead on go {idx}]")

    for sp in stale:
        idx = len(items) + 1
        items.append({"kind": "stale_close", "number": sp["number"], "title": sp["title"]})
        red.append(f"Stale {sp['age_days']}d: PR #{sp['number']} {sp['title'][:38]} [close on go {idx}]")

    for d in drafts:
        fyi.append(f"Draft release {d['tag']} waiting to publish (manual store uploads)")
    for b in beads:
        fyi.append(f"ready: {b[:70]}")

    lines = ["📋 TRIAGE BURST", ""]
    if red:
        lines.append("🔴 NEEDS DECISION")
        lines += [f"  {r}" for r in red]
        lines.append("")
    if yellow:
        lines.append("🟡 READY TO MERGE")
        lines += [f"  {y}" for y in yellow]
        lines.append("")
    if fyi:
        lines.append("🔵 FYI")
        lines += [f"  {f}" for f in fyi]

    trimmed = lines[: MAX_BRIEF_LINES - 2]
    total = len(red) + len(yellow)
    tail = "" if total == 0 else f"\nReply: go all / go 1 2 3 / go none"
    return items, "\n".join(trimmed[: MAX_BRIEF_LINES - 2]) + tail


# ---------------------------------------------------------------- telegram io


def tg_send(text: str) -> bool:
    res = tg_api("sendMessage", {
        "chat_id": load_telegram_env().get("TELEGRAM_CHAT_ID", ""),
        "text": text,
        "disable_web_page_preview": True,
    })
    return bool(res and res.get("ok"))


def tg_await_approval(deadline_s: int, since_ts: float = 0.0) -> str:
    """Long-poll getUpdates for a 'go ...' message from our chat.

    since_ts: ignore messages older than this burst's start — prevents stale
    queued 'go' messages (24h Telegram retention) from approving a new burst.
    """
    env = load_telegram_env()
    token, chat_id = env.get("TELEGRAM_BOT_TOKEN", ""), env.get("TELEGRAM_CHAT_ID", "")
    if not token or not chat_id:
        return ""
    offset = 0
    deadline = time.time() + deadline_s
    while time.time() < deadline:
        url = (
            f"https://api.telegram.org/bot{token}/getUpdates?timeout=25&offset={offset}"
            "&allowed_updates=[\"message\"]"
        )
        try:
            with urllib.request.urlopen(url, timeout=35) as resp:
                data = json.loads(resp.read().decode())
        except Exception:  # noqa: BLE001
            time.sleep(3)
            continue
        for upd in data.get("result", []):
            offset = upd["update_id"] + 1
            msg = upd.get("message") or {}
            if str(msg.get("chat", {}).get("id")) != str(chat_id):
                continue
            if msg.get("date", 0) < since_ts - 5:
                continue
            text = (msg.get("text") or "").strip()
            if text.lower().startswith("go"):
                return text
    return ""


# ---------------------------------------------------------------- execute


def execute(items: list[dict], approved_idx: set[int]) -> list[str]:
    results = []
    for idx, item in enumerate(items, start=1):
        if idx not in approved_idx:
            continue
        kind = item["kind"]
        if kind == "merge":
            code, out = sh(["gh", "pr", "merge", str(item["number"]), "--squash", "--auto", "--delete-branch"])
            results.append(f"#{item['number']} merge({'ok' if code == 0 else 'FAIL'})")
        elif kind == "stale_close":
            code, _ = sh(["gh", "pr", "close", str(item["number"]),
                          "--comment", "Closing as stale — revive anytime."])
            results.append(f"#{item['number']} close({'ok' if code == 0 else 'FAIL'})")
        elif kind in {"failure_bead", "monitor_bead"}:
            ref = item.get("ref", "monitor alert")
            code, out = sh(["bd", "create", f"Triage: investigate {ref} {item['title'][:60]}",
                            "-p", "1", "-t", "bug",
                            "--description", f"Filed by repo-triage-burst from {ref}. {item.get('url', '')}{(' run: ' + item['run_url']) if item.get('run_url') else ''}"])
            m = re.search(r"Classroom-Quick-Downloader-[a-z0-9]+", out)
            results.append(f"bead {m.group(0) if m else '?'} filed for {ref}")
        elif kind == "major_bead":
            code, out = sh(["bd", "create", f"Review major bump: {item['title'][:60]}",
                            "-p", "1", "-t", "task",
                            "--description", f"Majors are never auto-merged. PR #{item['number']}."])
            m = re.search(r"Classroom-Quick-Downloader-[a-z0-9]+", out)
            results.append(f"bead {m.group(0) if m else '?'} for major #{item['number']}")
    return results


# ------------------------------------------------------- bot: reply builders

HELP_TEXT = (
    "🤖 CQD Repo Bot — commands:\n"
    "/status — everything, one screen\n"
    "/prs — all open PRs + check state\n"
    "/issues — open issues (ci-failure first)\n"
    "/security — Dependabot · CodeQL · secrets\n"
    "/deps — library updates pending\n"
    "/runs — recent failed workflow runs\n"
    "/plans — beads: plans & blockers\n"
    "/releases — releases + drafts\n"
    "/endpoints — site/worker/oracle health + latency\n"
    "/metrics — live product telemetry\n"
    "/versions — monorepo version matrix\n"
    "/deploys — recent deploy results\n"
    "/access — what this bot can read/write\n"
    "/triage — full burst w/ approval\n"
    "/help — this list"
)


def fmt_endpoints() -> str:
    results = gather_endpoint_health()
    if not results:
        return ("No endpoint URLs found — repo variables PUBLIC_SITE_URL / "
                "PUBLIC_WORKER_BASE_URL / PUBLIC_ORACLE_API_BASE_URL are not readable.")
    lines = ["🌐 ENDPOINT HEALTH"]
    for res in results:
        icon = "✅" if 200 <= res["code"] < 400 else "🔴"
        code = res["code"] if res["code"] else "DOWN"
        lines.append(f"{icon} {res['name']}: HTTP {code} ({res['ms']}ms)")
    return "\n".join(lines)


def fmt_metrics() -> str:
    m = gather_snapshot_metrics()
    if m["downloads"] == 0 and m["users"] == 0:
        return "📈 Metrics: snapshot API unreachable right now."
    lines = [
        "📈 PRODUCT TELEMETRY (public snapshot API)",
        f"  Downloads: {m['downloads']:,}",
        f"  Success: {m['success']:,} · Fail: {m['fail']:,} · Cancelled: {m['cancelled']:,}",
        f"  Install users: {m['users']:,}",
    ]
    return "\n".join(lines)


def fmt_versions() -> str:
    v = gather_versions()
    lines = ["🏷 VERSION MATRIX"]
    lines += [f"  {k}: {val}" for k, val in v.items()]
    return "\n".join(lines)


def fmt_deploys() -> str:
    deps = gather_deployments()
    lines = ["🚀 DEPLOYMENTS (latest run per pipeline)"]
    for d in deps:
        icon = {"success": "✅", "failure": "🔴", "in_progress": "⏳", None: "⏳"}.get(
            d["conclusion"], "⚪")
        lines.append(f"{icon} {d['name']}: {d['conclusion']} ({d['age']})")
    return "\n".join(lines)


ACCESS_TEXT = (
    "🔑 BOT ACCESS\n"
    "READS: GitHub (PRs/issues/runs/security alerts/releases/vars via gh),\n"
    "  beads DB, site+worker+oracle public HTTP, local package versions.\n"
    "WRITES: only after your go — squash-merge safe dep PRs, close stale PRs,\n"
    "  file investigation beads.\n"
    "NEVER: university data, personal email content, secret VALUES,\n"
    "  store dashboards, force-push, direct main pushes."
)


def _clip(lines: list[str], cap: int = 38) -> str:
    body = "\n".join(lines[:cap])
    more = "" if len(lines) <= cap else f"\n… (+{len(lines) - cap} more)"
    return body + more


def fmt_status() -> str:
    reno = gather_renovate()
    fails = gather_ci_failures()
    sec = gather_security()
    total, ready, blocked = gather_bd_summary()
    runs = gather_failed_runs(limit=3)
    drafts = gather_release_drafts()
    humans = gh_json(["pr", "list", "--state", "open", "--json", "number"]) or []
    endpoints = gather_endpoint_health()
    down = [e for e in endpoints if not (200 <= e["code"] < 400)]
    metrics = gather_snapshot_metrics()
    majors = [p for p in reno if p["bump"] == "major"]
    lines = [
        "📊 REPO STATUS",
        f"PRs open: {len(humans)} ({len(reno)} dep-bot, {len(majors)} major)",
        f"CI-failure issues: {len(fails)}",
        f"Security: {('dep=' + str(len(sec['dependabot'])) + ' codeql=' + str(len(sec['codeql'])) + ' secrets=' + str(len(sec['secret']))) if not sec.get('_unavailable') else 'source unavailable ⚠️'}",
        f"Beads: {total} total · {ready} ready · {blocked} blocked",
        f"Release drafts: {len(drafts)}",
        f"Failing runs (recent): {len(runs)}",
        f"Endpoints: {len(endpoints) - len(down)}/{len(endpoints)} up"
        + (f" — 🔴 {', '.join(e['name'] for e in down)}" if down else ""),
        f"Downloads: {metrics['downloads']:,} · users: {metrics['users']:,}",
    ]
    last = read_last_run()
    if last > 0:
        age_h = int((time.time() - last) / 3600)
        lines.append(f"Last burst: {age_h}h ago")
    if fails:
        lines.append("🔴 " + "; ".join(f"#{f_['number']}" for f_ in fails[:4]))
    if runs:
        lines.append("⚠️ " + runs[0])
    return "\n".join(lines)


def fmt_prs() -> str:
    prs = gather_all_open_prs()
    if not prs:
        return "No open PRs."
    now = time.time()
    lines = ["🔀 OPEN PRs"]
    for pr in sorted(prs, key=lambda p: p["number"]):
        tag = "🤖" if pr["kind"] == "dep_bot" else "👤"
        icon = {"green": "✅", "red": "❌", "pending": "⏳", "none": "—", "unknown": "?"}[pr["checks"]]
        try:
            age_d = int((now - datetime.fromisoformat(
                pr["updated"].replace("Z", "+00:00")).timestamp()) / 86400)
            age = f"{age_d}d"
        except Exception:  # noqa: BLE001
            age = "?"
        extra = f" [{pr['bump']}]" if pr["kind"] == "dep_bot" and pr["bump"] != "unknown" else ""
        lines.append(f"{tag} #{pr['number']} {icon} {pr['title'][:44]} ({age}){extra}")
    return _clip(lines)


def fmt_issues() -> str:
    issues = gather_open_issues()
    if not issues:
        return "No open issues."
    ci_fail = [i for i in issues if "ci-failure" in i["labels"]]
    rest = [i for i in issues if "ci-failure" not in i["labels"]]
    lines = ["🎫 OPEN ISSUES"]
    for i in ci_fail:
        lines.append(f"🔴 #{i['number']} {i['title'][:52]}")
    for i in rest[:10]:
        labels = ",".join(i["labels"][:2])
        lines.append(f"#{i['number']} {i['title'][:50]} {('[' + labels + ']') if labels else ''}")
    return _clip(lines)


SEV_ORDER = {"CRITICAL": 0, "HIGH": 1, "MODERATE": 2, "MEDIUM": 2, "LOW": 3}


def fmt_security() -> str:
    sec = gather_security()
    if sec.get("_unavailable"):
        return "🔒 Security: source unavailable right now (GitHub API error) — treat as UNKNOWN, not clear."
    dep = sec["dependabot"]
    codeql = sec["codeql"]
    secret = sec["secret"]
    clean = not dep and not codeql and not secret
    if clean:
        return "🔒 Security: all clear (0 dependabot · 0 codeql · 0 secret-scanning)"
    lines = ["🔒 SECURITY"]
    if dep:
        dep_sorted = sorted(dep, key=lambda a: SEV_ORDER.get(str(a.get("severity", "")).upper(), 9))
        lines.append(f"Dependabot open: {len(dep)}")
        for a in dep_sorted[:6]:
            lines.append(f"  [{a.get('severity', '?')}] {a.get('pkg', '?')} (alert {a.get('num')})")
    if codeql:
        codeql_sorted = sorted(codeql, key=lambda a: SEV_ORDER.get(str(a.get('sev', '')).upper(), 9))
        lines.append(f"CodeQL open: {len(codeql)}")
        for a in codeql_sorted[:5]:
            lines.append(f"  [{a.get('sev', '?')}] {str(a.get('rule', ''))[:48]}")
    if secret:
        lines.append(f"Secret scanning open: {len(secret)}")
        for a in secret[:5]:
            lines.append(f"  ⚠️ {a.get('secret_type', '?')}")
    return "\n".join(lines)


def fmt_deps() -> str:
    reno = gather_renovate()
    backlog = [i for i in gather_open_issues() if "dependenc" in i["title"].lower()]
    by_bump: dict[str, int] = {}
    for pr in reno:
        by_bump[pr["bump"]] = by_bump.get(pr["bump"], 0) + 1
    lines = [f"📦 PENDING LIBRARY UPDATES — {len(reno)} Renovate PRs"]
    for bump in ("major", "minor", "patch", "pin", "digest", "unknown"):
        if by_bump.get(bump):
            lines.append(f"  {bump}: {by_bump[bump]}")
    majors = [p for p in reno if p["bump"] == "major"]
    for p in majors[:5]:
        lines.append(f"  ⚠️ major: {p['title'][:56]}")
    for b in backlog[:3]:
        lines.append(f"backlog issue: #{b['number']} {b['title'][:44]}")
    if len(reno) == 0:
        lines.append("Nothing waiting 🎉")
    return "\n".join(lines)


def fmt_runs() -> str:
    runs = gather_failed_runs(limit=8)
    if not runs:
        return "✅ No failed workflow runs recently."
    return "\n".join(["⚙️ FAILED RUNS"] + [f"  • {r}" for r in runs])


def fmt_plans() -> str:
    total, ready, blocked = gather_bd_summary()
    ready_list = gather_ready_beads()
    lines = [
        f"🗺 PLANS (beads) — {total} total · {ready} ready · {blocked} blocked",
    ]
    lines += [f"  {b[:66]}" for b in ready_list]
    return "\n".join(lines)


def fmt_releases() -> str:
    rels = gh_json(["release", "list", "--limit", "5", "--json", "tagName,isDraft,isLatest,createdAt"]) or []
    if not rels:
        return "No releases yet."
    lines = ["🏷 RELEASES"]
    for r in rels:
        flag = "📝 DRAFT" if r.get("isDraft") else ("⭐ latest" if r.get("isLatest") else "")
        lines.append(f"  {r.get('tagName', '?')} {flag}")
    return "\n".join(lines)


# ------------------------------------------------------- bot: daemon


def handle_command(text: str) -> str:
    low = text.strip().lower()
    if low.startswith("/triage"):
        return run_burst(lambda sent_at: tg_await_approval(APPROVAL_TIMEOUT_S, since_ts=sent_at))

    table = {
        "/status": fmt_status, "status": fmt_status,
        "/prs": fmt_prs, "prs": fmt_prs,
        "/issues": fmt_issues, "issues": fmt_issues,
        "/security": fmt_security, "security": fmt_security,
        "/deps": fmt_deps, "deps": fmt_deps,
        "/runs": fmt_runs, "runs": fmt_runs,
        "/plans": fmt_plans, "plans": fmt_plans,
        "/releases": fmt_releases, "releases": fmt_releases,
        "/endpoints": fmt_endpoints, "endpoints": fmt_endpoints,
        "/metrics": fmt_metrics, "metrics": fmt_metrics,
        "/versions": fmt_versions, "versions": fmt_versions,
        "/deploys": fmt_deploys, "deploys": fmt_deploys,
        "/access": lambda: ACCESS_TEXT, "access": lambda: ACCESS_TEXT,
        "/help": lambda: HELP_TEXT, "help": lambda: HELP_TEXT,
    }
    fn = table.get(low)
    return fn() if fn else HELP_TEXT


def register_command_menu() -> None:
    """Publish the command list so Telegram shows an autocomplete menu."""
    commands = [
        {"command": "status", "description": "Everything, one screen"},
        {"command": "prs", "description": "Open PRs + check state"},
        {"command": "issues", "description": "Open issues"},
        {"command": "security", "description": "Security alerts (Dependabot/CodeQL/secrets)"},
        {"command": "deps", "description": "Pending library updates"},
        {"command": "runs", "description": "Recent failed runs"},
        {"command": "plans", "description": "Bead plans & blockers"},
        {"command": "releases", "description": "Releases & drafts"},
        {"command": "endpoints", "description": "Site/worker/oracle health"},
        {"command": "metrics", "description": "Live product telemetry"},
        {"command": "versions", "description": "Version matrix"},
        {"command": "deploys", "description": "Recent deploy results"},
        {"command": "access", "description": "What this bot can access"},
        {"command": "triage", "description": "Full burst w/ approval"},
    ]
    tg_api("setMyCommands", {"commands": commands})


OFFSET_FILE = REPO_ROOT / ".workflow-state" / "tg-offset.txt"


def serve() -> int:
    env = load_telegram_env()
    if not env.get("TELEGRAM_BOT_TOKEN"):
        print("[bot] telegram not configured; see TG_ENV:", TG_ENV)
        return 1
    offset = 0
    try:
        offset = int(OFFSET_FILE.read_text().strip())
    except Exception:  # noqa: BLE001
        pass
    chat_id = env.get("TELEGRAM_CHAT_ID", "")
    print(f"[bot] serving chat {chat_id}; Ctrl+C to stop.")
    register_command_menu()
    while True:
        url = (
            f"https://api.telegram.org/bot{env['TELEGRAM_BOT_TOKEN']}/getUpdates"
            f"?timeout=30&offset={offset}&allowed_updates=%5B%22message%22%5D"
        )
        try:
            with urllib.request.urlopen(url, timeout=45) as resp:
                data = json.loads(resp.read().decode())
        except Exception as exc:  # noqa: BLE001
            print(f"[bot] poll error: {exc}", file=sys.stderr)
            time.sleep(5)
            continue
        for upd in data.get("result", []):
            offset = upd["update_id"] + 1
            OFFSET_FILE.parent.mkdir(exist_ok=True)
            OFFSET_FILE.write_text(str(offset))
            msg = upd.get("message") or {}
            if str(msg.get("chat", {}).get("id")) != str(chat_id):
                continue
            text = (msg.get("text") or "").strip()
            if not text:
                continue
            try:
                reply = handle_command(text)
            except Exception as exc:  # noqa: BLE001
                reply = f"⚠️ handler error: {exc}"
            tg_send(reply[:4000])





def parse_approval(text: str, total_items: int) -> set[int] | None:
    """Parse a 'go ...' reply into approved item indexes; None if unparsable."""
    m = re.fullmatch(r"go\s+(all|none|\d+(?:\s+\d+)*)", text.strip(), re.IGNORECASE)
    if not m:
        return None
    token = m.group(1).lower()
    if token == "all":
        return set(range(1, total_items + 1))
    if token == "none":
        return set()
    return {int(n) for n in token.split()}


def iso_ts(value: str) -> float:
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except Exception:  # noqa: BLE001
        return 0.0


def run_burst(approval_provider) -> str:
    """Gather -> brief -> send -> approve -> execute -> receipt.

    approval_provider(brief_sent_at: float) -> approval string ('' = timeout).
    Returns the receipt text (caller decides how to deliver it).
    """
    items, brief = build_items_and_brief(
        gather_renovate(), gather_ci_failures(), gather_ready_beads(),
        gather_stale_prs({p["number"] for p in gather_all_open_prs() if p["kind"] == "dep_bot"}),
        gather_release_drafts(), gather_monitor_failures(read_last_run()))

    sent_at = time.time()
    delivered = False
    for attempt in range(2):  # spec: fall back only after TWO failed sends
        if tg_send(brief):
            delivered = True
            break
        time.sleep(3)
    if not delivered:
        p = REPO_ROOT / "workflows" / "briefs" / f"{datetime.now(timezone.utc):%Y-%m-%d}-triage.md"
        p.parent.mkdir(exist_ok=True)
        p.write_text(brief, encoding="utf-8")
        return f"Telegram unreachable — brief written to {p}"

    approval = approval_provider(sent_at)
    asked_once = False
    while True:
        if not approval:
            STATE_FILE.parent.mkdir(exist_ok=True)
            STATE_FILE.write_text(json.dumps(
                {"last_run_ts": time.time(), "approved": []}, indent=2))
            return "⏱ No approval within the window — nothing was executed."
        approved = parse_approval(approval, len(items))
        if approved is not None:
            break
        if asked_once:
            return "🤖 Still couldn't parse the approval — nothing executed. Reply like: go 1 2"
        asked_once = True
        approval = approval_provider(sent_at)

    results = execute(items, approved)
    STATE_FILE.parent.mkdir(exist_ok=True)
    STATE_FILE.write_text(json.dumps(
        {"last_run_ts": time.time(), "approved": sorted(approved)}, indent=2))
    receipt = f"Applied ✓ {len(results)} items"
    if results:
        receipt += "\n" + "\n".join(f"• {r}" for r in results)
    return receipt


# ---------------------------------------------------------------- main


def main() -> int:
    args = sys.argv[1:]
    dry = "--dry-run" in args
    pre_approved = ""
    if "--approve" in args:
        i = args.index("--approve")
        pre_approved = args[i + 1] if len(args) > i + 1 else ""

    env = load_telegram_env()
    has_tg = bool(env.get("TELEGRAM_BOT_TOKEN"))
    if dry:
        # Dry-run prints the brief only; share the exact gather path.
        items, brief = build_items_and_brief(
            gather_renovate(), gather_ci_failures(), gather_ready_beads(),
            gather_stale_prs({p["number"] for p in gather_all_open_prs() if p["kind"] == "dep_bot"}),
            gather_release_drafts(), gather_monitor_failures(read_last_run()))
        print(brief)
        print(f"\n[dry-run] {len(items)} decision items; no messages sent, no state advanced.")
        return 0

    if not has_tg and not pre_approved:
        (REPO_ROOT / "workflows" / "briefs").mkdir(parents=True, exist_ok=True)
        print(f"[triage] Telegram not configured ({TG_ENV}). Run with --dry-run for a local "
              "brief, or set up the bot per docs/TELEGRAM_BOT.md.")
        return 1

    def provider(sent_at: float) -> str:
        if pre_approved:
            return pre_approved
        return tg_await_approval(APPROVAL_TIMEOUT_S, since_ts=sent_at)

    receipt = run_burst(provider)
    tg_send(receipt)
    print(receipt)
    return 0


if __name__ == "__main__":
    if "--serve" in sys.argv:
        raise SystemExit(serve())
    raise SystemExit(main())
