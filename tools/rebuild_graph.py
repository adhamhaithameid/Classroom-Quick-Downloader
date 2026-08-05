#!/usr/bin/env python3
"""Rebuild the graphify knowledge graph and stage it into the website.

Used by .github/workflows/github-pages.yml and runnable locally:
    GEMINI_API_KEY=... python3 tools/rebuild_graph.py

With GEMINI_API_KEY set: full pipeline (AST + Gemini semantic extraction of
docs/images + LLM community labels). Without it: deterministic code-only
fallback (AST + path-derived labels), so PR builds never fail on secrets.
"""

import json
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "graphify-out"
SITE_GRAPH_DIR = ROOT / "graphify-out" / "site"
SCOPED_DIRS = ("extension/", "website/", "oracle-backend/", "cloudflare-worker/")
VIS_NETWORK_URL = "https://unpkg.com/vis-network@9.1.6/standalone/umd/vis-network.min.js"

sys.path.insert(0, str(OUT / ".graphify_site_packages")) if (OUT / ".graphify_site_packages").exists() else None


def main() -> int:
    import os

    from graphify.analyze import god_nodes, suggest_questions, surprising_connections
    from graphify.build import build_from_json
    from graphify.cluster import cluster, score_all
    from graphify.detect import detect, save_manifest
    from graphify.export import to_json
    from graphify.extract import collect_files, extract
    from graphify.report import generate

    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    backend = "gemini" if api_key else None
    if backend:
        os.environ["GEMINI_API_KEY"] = api_key

    OUT.mkdir(exist_ok=True)

    # 1. Detect (scoped to product code dirs)
    result = detect(ROOT)
    files = {}
    total = 0
    for cat, fl in result["files"].items():
        kept = [f for f in fl if any(f.startswith(str(ROOT) + "/" + r) for r in SCOPED_DIRS)]
        if kept:
            files[cat] = kept
            total += len(kept)
    result["files"] = files
    result["total_files"] = total
    words = 0
    for fl in files.values():
        for f in fl:
            try:
                words += len(Path(f).read_text(encoding="utf-8", errors="ignore").split())
            except Exception:
                pass
    result["total_words"] = words
    (OUT / ".graphify_detect.json").write_text(json.dumps(result, ensure_ascii=False), encoding="utf-8")
    print(f"[graph] detect: {total} files, {words:,} words")

    # 2. AST extraction (deterministic, cached)
    code_files = []
    for f in files.get("code", []):
        p = Path(f)
        code_files.extend(collect_files(p) if p.is_dir() else [p])
    ast = extract(code_files, cache_root=ROOT)
    (OUT / ".graphify_ast.json").write_text(json.dumps(ast, ensure_ascii=False), encoding="utf-8")
    print(f"[graph] AST: {len(ast['nodes'])} nodes, {len(ast['edges'])} edges")

    # 3. Semantic extraction (Gemini) or code-only fallback
    if backend:
        from graphify.llm import extract_corpus_parallel

        docs = [f for cat in ("document", "paper", "image") for f in files.get(cat, [])]
        sem = extract_corpus_parallel([Path(f) for f in docs], backend="gemini", root=ROOT, cache_root=ROOT)
        print(
            f"[graph] gemini semantic: {len(sem['nodes'])} nodes, {len(sem['edges'])} edges "
            f"({sem.get('input_tokens', 0):,} in / {sem.get('output_tokens', 0):,} out)"
        )
    else:
        sem = {"nodes": [], "edges": [], "hyperedges": [], "input_tokens": 0, "output_tokens": 0}
        print("[graph] no GEMINI_API_KEY - code-only mode (semantic extraction skipped)")

    seen = {n["id"] for n in ast["nodes"]}
    nodes = list(ast["nodes"])
    for n in sem["nodes"]:
        if n["id"] not in seen:
            nodes.append(n)
            seen.add(n["id"])
    extraction = {
        "nodes": nodes,
        "edges": ast["edges"] + sem["edges"],
        "hyperedges": sem.get("hyperedges", []),
        "input_tokens": sem.get("input_tokens", 0),
        "output_tokens": sem.get("output_tokens", 0),
    }
    (OUT / ".graphify_extract.json").write_text(json.dumps(extraction, ensure_ascii=False), encoding="utf-8")

    # 4. Build, cluster, analyze
    G = build_from_json(extraction, root=str(ROOT), directed=False)
    if G.number_of_nodes() == 0:
        print("[graph] ERROR: empty graph", file=sys.stderr)
        return 1
    communities = cluster(G)
    cohesion = score_all(G, communities)
    gods = god_nodes(G)
    surprises = surprising_connections(G, communities)

    # 5. Labels: LLM when backend available, else path-derived
    if backend:
        from graphify.llm import label_communities

        labels = label_communities(G, communities, backend="gemini")
    else:
        from collections import Counter

        src = {n["id"]: n.get("source_file", "") for n in extraction["nodes"]}
        labels = {}
        for cid, members in communities.items():
            dirs = Counter()
            for m in members:
                parts = [p for p in src.get(m, "").split("/") if p]
                if len(parts) >= 2:
                    dirs["/".join(parts[:2])] += 1
            labels[cid] = (
                dirs.most_common(1)[0][0].replace("_", " ").title()[:40] if dirs else f"Community {cid}"
            )
    questions = suggest_questions(G, communities, labels)

    # 6. Export (full rebuild => force overwrite is intentional)
    if not to_json(G, communities, str(OUT / "graph.json"), force=True):
        print("[graph] ERROR: export refused", file=sys.stderr)
        return 1
    report = generate(
        G, communities, cohesion, labels, gods, surprises, result,
        {"input": extraction["input_tokens"], "output": extraction["output_tokens"]},
        str(ROOT), suggested_questions=questions,
    )
    (OUT / "GRAPH_REPORT.md").write_text(report, encoding="utf-8")
    (OUT / ".graphify_labels.json").write_text(
        json.dumps({str(k): v for k, v in labels.items()}, ensure_ascii=False), encoding="utf-8"
    )
    save_manifest(result.get("all_files") or result["files"], root=str(ROOT))
    print(f"[graph] built: {G.number_of_nodes()} nodes, {G.number_of_edges()} edges, {len(communities)} communities")

    # 7. Stage standalone graph site (deployed to GitHub Pages as-is)
    SITE_GRAPH_DIR.mkdir(parents=True, exist_ok=True)
    vis = SITE_GRAPH_DIR / "vis-network.min.js"
    if not vis.exists():
        urllib.request.urlretrieve(VIS_NETWORK_URL, vis)
    html = (OUT / "graph.html").read_text(encoding="utf-8")
    html = html.replace(
        "https://unpkg.com/vis-network@9.1.6/standalone/umd/vis-network.min.js",
        "./vis-network.min.js",
    )
    (SITE_GRAPH_DIR / "index.html").write_text(html, encoding="utf-8")
    assert "unpkg.com" not in (SITE_GRAPH_DIR / "index.html").read_text(encoding="utf-8"), "CDN ref leaked"
    print(f"[graph] staged: {SITE_GRAPH_DIR}/index.html ({vis.stat().st_size // 1024}KB vis-network vendored)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
