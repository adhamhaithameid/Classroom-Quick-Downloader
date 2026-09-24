// filepath: tests/e2e/live/language-reconcile.spec.ts
/**
 * ============================================================================
 * LANGUAGE RECONCILE — audit engine keyword lists against REAL Classroom text
 * ============================================================================
 *
 * Answers one question per language: does the string the detection engine
 * keys on (detection-keywords.ts comment/edited lists) actually appear on
 * real Classroom in that language?
 *
 * Two data sources:
 * 1. Fixture corpus (ALWAYS): the committed fixtures are sanitized captures
 *    of real Classroom DOM, so English and Arabic are audited against real
 *    Google-rendered strings on every CI run.
 * 2. Live corpus (when present): qa-artifacts/live-languages/<lang>.json,
 *    produced by `pnpm test:live:langs` on the signed-in profile — up to the
 *    full Classroom language set.
 *
 * Output: qa-artifacts/live-languages/audit.json + AUDIT.md (verified /
 * missing / unobserved per language). Load-bearing real-data matches are
 * asserted; everything else is reported, because "missing" usually means
 * "the corpus page didn't render that phrase", not "the keyword is wrong".
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  COMMENT_KEYWORDS,
  EDITED_KEYWORDS,
  getCommentKeywords,
  getEditedKeywords,
} from "../../../extension/entrypoints/content/detection-keywords";
import { auditKeywords, corpusPageFromHtml, loadCorpus, corpusStrings, normalizeForCorpus } from "./lang-corpus.mjs";

const REPO_ROOT = path.resolve(__dirname, "../../..");
const FIXTURES_DIR = path.join(REPO_ROOT, "extension/tests/fixtures/classroom");
const LIVE_CORPUS_DIR = path.join(REPO_ROOT, "qa-artifacts/live-languages/corpus");

const fixture = (name: string): string => fs.readFileSync(path.join(FIXTURES_DIR, name), "utf-8");

/** English fixture corpus — real Classroom DOM (sanitized captures). */
const EN_CORPUS = {
  lang: "en",
  htmlLang: "en",
  pages: {
    announcement: corpusPageFromHtml("fixture://announcement-detail-en.html", fixture("announcement-detail-en.html")),
    assignment: corpusPageFromHtml("fixture://assignment-details-en.html", fixture("assignment-details-en.html")),
    classwork: corpusPageFromHtml("fixture://classwork-material-post-en.html", fixture("classwork-material-post-en.html")),
    stream: corpusPageFromHtml("fixture://stream-flagged-post-en.html", fixture("stream-flagged-post-en.html")),
    material: corpusPageFromHtml("fixture://material-details-en.html", fixture("material-details-en.html")),
    submissions: corpusPageFromHtml("fixture://student-submissions-en.html", fixture("student-submissions-en.html")),
    studentWork: corpusPageFromHtml("fixture://student-work-teacher-en.html", fixture("student-work-teacher-en.html")),
    mixed: corpusPageFromHtml("fixture://mixed-links-post-en.html", fixture("mixed-links-post-en.html")),
  },
};

/** Arabic fixture corpus — real RTL Classroom DOM. */
const AR_CORPUS = {
  lang: "ar",
  htmlLang: "ar",
  pages: { post: corpusPageFromHtml("fixture://rtl-flagged-post-ar.html", fixture("rtl-flagged-post-ar.html")) },
};

test.describe("fixture audit — engine keywords vs REAL Classroom DOM", () => {
  test("English engine keywords verify against real English renderings", () => {
    const en = getCommentKeywords("en");
    const edited = getEditedKeywords("en");
    const commentAudit = auditKeywords(EN_CORPUS, [...en.plural, ...en.classComment]);
    const editedAudit = auditKeywords(EN_CORPUS, edited);

    // Load-bearing matches — these strings are load-bearing for the comment
    // and edited detectors and ARE present in real Classroom captures.
    const verifiedComment = commentAudit.verified.map((v) => v.keyword);
    expect(verifiedComment).toContain("class comments");
    expect(verifiedComment).toContain("class comment");

    const verifiedEdited = editedAudit.verified.map((v) => v.keyword);
    expect(verifiedEdited).toContain("edited");

    // Documented engine gap (real string, not listed): the empty state
    // "No class comments" renders on announcement/material pages. It still
    // matches the detector transitively via the token "comments", so no
    // behavioral bug — but the live-language audit should make gaps like
    // this visible per language.
    expect(corpusStrings(EN_CORPUS).some((s) => /^No class comments$/.test(s))).toBe(true);
    expect(
      [...en.plural, ...en.classComment].some((k) => normalizeForCorpus(k) === normalizeForCorpus("no class comments")),
    ).toBe(false);

    console.log("[lang-audit] en comment verified:", verifiedComment.join(", "));
    console.log("[lang-audit] en edited verified:", verifiedEdited.join(", "));
    console.log("[lang-audit] en comment not-rendered-in-fixtures:", commentAudit.missing.join(", ") || "none");
    console.log("[lang-audit] en edited not-rendered-in-fixtures:", editedAudit.missing.join(", ") || "none");
  });

  test("Arabic engine keywords verify against the real RTL rendering", () => {
    const ar = getCommentKeywords("ar");
    const edited = getEditedKeywords("ar");
    const commentAudit = auditKeywords(AR_CORPUS, [...ar.singular, ...ar.plural, ...ar.classComment]);
    const editedAudit = auditKeywords(AR_CORPUS, edited);

    const verifiedComment = commentAudit.verified.map((v) => v.keyword);
    // Real rendering: "٥ تعليقات صفية" (5 class comments).
    expect(verifiedComment).toContain("تعليقات صفية");

    const verifiedEdited = editedAudit.verified.map((v) => v.keyword);
    // Real rendering: "تم التعديل في ١٠ مارس" (Edited on 10 Mar).
    expect(verifiedEdited).toContain("تم التعديل");

    console.log("[lang-audit] ar comment verified:", verifiedComment.join(", "));
    console.log("[lang-audit] ar edited verified:", verifiedEdited.join(", "));
  });
});

test.describe("live corpus audit — all captured languages", () => {
  const liveCorpusDirExists = fs.existsSync(LIVE_CORPUS_DIR);
  const corpusFiles = liveCorpusDirExists
    ? fs.readdirSync(LIVE_CORPUS_DIR).filter((f) => f.endsWith(".json"))
    : [];
  test.skip(
    !liveCorpusDirExists || corpusFiles.length === 0,
    `no live language corpus yet — sign in (pnpm test:live:login) and run \`pnpm test:live:langs\` to capture real Classroom strings per language`,
  );

  test("audits every captured language and writes the audit report", async () => {
    test.setTimeout(120_000);
    const reports: unknown[] = [];
    const mdLines: string[] = [
      "# Language Keyword Audit",
      "",
      "Engine keyword lists (detection-keywords.ts) vs real Classroom strings.",
      "Generated by tests/e2e/live/language-reconcile.spec.ts — regenerate with",
      "`pnpm test:live:langs` then `pnpm test:live:langs:audit`.",
      "",
      "| lang | htmlLang | comment verified | comment missing | edited verified | edited missing |",
      "| --- | --- | --- | --- | --- | --- |",
    ];

    for (const file of corpusFiles) {
      const lang = file.replace(/\.json$/, "");
      const corpus = loadCorpus(LIVE_CORPUS_DIR, lang);
      if (!corpus) continue;

      // Data integrity: the rendered page language must match the request.
      const requested = String(corpus.lang ?? lang).toLowerCase().split("-")[0];
      const rendered = String(corpus.htmlLang ?? "").toLowerCase().split("-")[0];
      expect(
        rendered,
        `corpus ${lang}: rendered htmlLang "${corpus.htmlLang}" does not match requested "${corpus.lang}" — the capture probe failed`,
      ).toBe(requested);
      expect(corpusStrings(corpus).length, `corpus ${lang} is empty`).toBeGreaterThan(0);

      const comment = getCommentKeywords(corpus.lang);
      const edited = getEditedKeywords(corpus.lang);
      const commentAudit = auditKeywords(corpus, [...comment.singular, ...comment.plural, ...comment.classComment]);
      const editedAudit = auditKeywords(corpus, edited);

      reports.push({
        lang: corpus.lang,
        htmlLang: corpus.htmlLang,
        source: corpus.source ?? "live",
        comment: commentAudit,
        edited: editedAudit,
        engineCoverage: {
          commentListed: COMMENT_KEYWORDS[corpus.lang] ? true : COMMENT_KEYWORDS[requested] ? "short-code" : false,
          editedListed: EDITED_KEYWORDS[corpus.lang] ? true : EDITED_KEYWORDS[requested] ? "short-code" : false,
        },
      });
      mdLines.push(
        `| ${corpus.lang} | ${corpus.htmlLang} | ${commentAudit.verified.length}/${commentAudit.verified.length + commentAudit.missing.length} | ${commentAudit.missing.length} | ${editedAudit.verified.length}/${editedAudit.verified.length + editedAudit.missing.length} | ${editedAudit.missing.length} |`,
      );
      console.log(
        `[lang-audit] ${corpus.lang} (${corpus.htmlLang}): comment ${commentAudit.verified.length}✓ ${commentAudit.missing.length}✗ · edited ${editedAudit.verified.length}✓ ${editedAudit.missing.length}✗`,
      );
    }

    expect(reports.length, "corpus files existed but none parsed").toBeGreaterThan(0);
    const outDir = path.join(REPO_ROOT, "qa-artifacts/live-languages");
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "audit.json"), `${JSON.stringify(reports, null, 2)}\n`);
    fs.writeFileSync(path.join(outDir, "AUDIT.md"), `${mdLines.join("\n")}\n`);
    console.log(`[lang-audit] wrote ${path.relative(REPO_ROOT, path.join(outDir, "audit.json"))} and AUDIT.md`);
  });
});
