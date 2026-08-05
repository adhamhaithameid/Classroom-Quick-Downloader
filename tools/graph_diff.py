#!/usr/bin/env python3
"""Diff two graphify graph.json exports and emit a Markdown summary.

Usage: python3 tools/graph_diff.py <old.json> <new.json>
Used by .github/workflows/github-pages.yml to comment graph deltas on PRs.
"""

import json
import sys
from collections import Counter
from pathlib import Path


def load(path: str) -> dict:
    return json.loads(Path(path).read_text(encoding="utf-8"))


def degree_tops(g: dict, n: int = 5) -> list[tuple[str, int]]:
    deg: Counter = Counter()
    for e in g.get("links", []):
        deg[e["source"]] += 1
        deg[e["target"]] += 1
    labels = {node["id"]: node.get("label", node["id"]) for node in g.get("nodes", [])}
    return [(labels.get(nid, nid), cnt) for nid, cnt in deg.most_common(n)]


def main() -> int:
    old, new = load(sys.argv[1]), load(sys.argv[2])
    on, nn = len(old.get("nodes", [])), len(new.get("nodes", []))
    oe, ne = len(old.get("links", [])), len(new.get("links", []))
    oh, nh = len(old.get("hyperedges", [])), len(new.get("hyperedges", []))

    old_ids = {n_["id"] for n_ in old.get("nodes", [])}
    new_ids = {n_["id"] for n_ in new.get("nodes", [])}
    added = new_ids - old_ids
    removed = old_ids - new_ids

    lines = ["📊 **Knowledge graph diff**", ""]
    icon = lambda d: "🟢" if d > 0 else ("🔴" if d < 0 else "⚪")  # noqa: E731
    lines.append(f"- {icon(nn-on)} Nodes: **{on:,} → {nn:,}** ({nn-on:+,})")
    lines.append(f"- {icon(ne-oe)} Edges: **{oe:,} → {ne:,}** ({ne-oe:+,})")
    lines.append(f"- {icon(nh-oh)} Hyperedges: **{oh} → {nh}** ({nh-oh:+})")

    if added:
        labels = {n_["id"]: n_.get("label", n_["id"]) for n_ in new.get("nodes", [])}
        sample = ", ".join(sorted((labels[a] for a in added))[:10])
        more = f" … (+{len(added)-10} more)" if len(added) > 10 else ""
        lines.append(f"- 🆕 New nodes ({len(added)}): {sample}{more}")
    if removed:
        lines.append(f"- 🗑️ Removed nodes: {len(removed)}")

    do, dn = degree_tops(old), degree_tops(new)
    if [x[0] for x in do] != [x[0] for x in dn]:
        lines.append("")
        lines.append("🔝 **Most-connected nodes (new):** " + ", ".join(f"{lbl} ({cnt})" for lbl, cnt in dn))

    lines.append("")
    lines.append("<sub>Deterministic JSON diff — no AI involved. Full report lives in the workflow artifact.</sub>")
    print("\n".join(lines))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
