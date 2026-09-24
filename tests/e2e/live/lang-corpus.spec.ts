// filepath: tests/e2e/live/lang-corpus.spec.ts
/**
 * ============================================================================
 * LANGUAGE CORPUS UNIT TESTS — offline, against REAL captured Classroom DOM
 * ============================================================================
 *
 * The committed fixtures (extension/tests/fixtures/classroom/) are sanitized
 * captures of REAL Classroom pages, so they double as ground truth for the
 * corpus pipeline: the English and Arabic strings asserted here are what
 * Google actually rendered, not guesses. Everything else in this file tests
 * the shared corpus schema/matching that both the live capture tool and the
 * reconcile audit import.
 */

import fs from "node:fs";
import path from "node:path";
import { test, expect } from "@playwright/test";
import {
  ariaLabelsFromHtml,
  auditKeywords,
  candidateLanguages,
  corpusFileUnder,
  corpusPageFromHtml,
  corpusStrings,
  htmlLangFromHtml,
  isProbeableLanguage,
  normalizeForCorpus,
  textLinesFromHtml,
} from "./lang-corpus.mjs";

const FIXTURES = path.resolve(__dirname, "../../../extension/tests/fixtures/classroom");

function fixtureHtml(name: string): string {
  return fs.readFileSync(path.join(FIXTURES, name), "utf-8");
}

test.describe("corpus building from real fixture HTML", () => {
  test("extracts the REAL Arabic comment and edited strings Classroom rendered", () => {
    const raw = fixtureHtml("rtl-flagged-post-ar.html");
    const page = corpusPageFromHtml("fixture://rtl-flagged-post-ar.html", raw);
    const strings = corpusStrings({ pages: { post: page } });
    // Ground truth captured from real Classroom (sanitized fixture).
    expect(strings.some((s) => s.includes("٥ تعليقات صفية"))).toBe(true);
    expect(strings.some((s) => s.includes("تم التعديل في ١٠ مارس"))).toBe(true);
  });

  test("extracts the REAL English comment, edited, and due strings", () => {
    const stream = corpusPageFromHtml("fixture://stream", fixtureHtml("stream-flagged-post-en.html"));
    const details = corpusPageFromHtml("fixture://details", fixtureHtml("assignment-details-en.html"));
    const strings = corpusStrings({ pages: { stream, details } });
    expect(strings.some((s) => /^5 class comments$/.test(s))).toBe(true);
    expect(strings.some((s) => /^Edited Mar 10$/.test(s))).toBe(true);
    expect(strings.some((s) => s.startsWith("Due Dec 18, 2025"))).toBe(true);
    expect(strings.some((s) => /^10 points$/.test(s))).toBe(true);
  });

  test("htmlLangFromHtml reads the rendered page language", () => {
    expect(htmlLangFromHtml('<html lang="de-DE" dir="ltr">')).toBe("de-DE");
    expect(htmlLangFromHtml("<html>no lang</html>")).toBeNull();
  });

  test("no script/style content leaks into corpus texts", () => {
    const raw = `<html><body><script>var x = "class comments";</script><p>3 class comments</p></body></html>`;
    const texts = textLinesFromHtml(raw);
    expect(texts).toEqual(["3 class comments"]);
  });
});

test.describe("keyword audit against real strings", () => {
  test("engine Arabic keywords verify against the real Arabic rendering", () => {
    const page = corpusPageFromHtml("fixture://ar", fixtureHtml("rtl-flagged-post-ar.html"));
    const corpus = { lang: "ar", htmlLang: "ar", pages: { post: page } };
    const result = auditKeywords(corpus, ["تعليقات صفية", "تم التعديل", "تعليق"]);
    expect(result.hasData).toBe(true);
    expect(result.verified.map((v) => v.keyword)).toEqual(["تعليقات صفية", "تم التعديل", "تعليق"]);
  });

  test("a wrong guess is reported missing, not silently passing", () => {
    const page = corpusPageFromHtml("fixture://ar", fixtureHtml("rtl-flagged-post-ar.html"));
    // 'تعليق واحد من الصف' is one of the engine's unverified Arabic guesses —
    // the real rendering says "٥ تعليقات صفية".
    const result = auditKeywords({ pages: { post: page } }, ["تعليق واحد من الصف"]);
    expect(result.verified).toHaveLength(0);
    expect(result.missing).toEqual(["تعليق واحد من الصف"]);
  });

  test("empty corpus reports unobserved instead of fake results", () => {
    const result = auditKeywords({ pages: {} }, ["edited", "comment"]);
    expect(result.hasData).toBe(false);
    expect(result.verified).toHaveLength(0);
    expect(result.unobserved).toEqual(["edited", "comment"]);
  });
});

test.describe("normalization", () => {
  test("case, diacritics, and whitespace do not affect matching", () => {
    expect(normalizeForCorpus("  ÉDITÉ   ")).toBe(normalizeForCorpus("edité"));
    expect(normalizeForCorpus("تمَ التعديل")).toBe(normalizeForCorpus("تم التعديل"));
    expect(normalizeForCorpus("Class  Comments")).toBe("class comments");
  });
});

test.describe("candidate language filtering", () => {
  test("joke locales are excluded, real languages kept, dedupe applied", () => {
    const candidates = candidateLanguages(["en", "ar", "xx-pirate", "tlh", "xx-bork", "de", "AR", "en"]);
    expect(candidates).toEqual(["en", "ar", "de"]);
  });

  test("isProbeableLanguage gates the live probe", () => {
    expect(isProbeableLanguage("xx-hacker")).toBe(false);
    expect(isProbeableLanguage("kri")).toBe(false);
    expect(isProbeableLanguage("pt-BR")).toBe(true);
  });
});

test.describe("corpus store boundary", () => {
  test("corpusFileUnder sanitizes names (basename) and keeps every result inside the root", () => {
    const root = "/tmp/cqd-corpus-test";
    expect(corpusFileUnder(root, "de")).toBe(path.resolve(root, "de.json"));
    // Defense-by-sanitization: "../escape" collapses to "escape.json" INSIDE
    // the root rather than escaping or throwing.
    expect(corpusFileUnder(root, "../escape")).toBe(path.resolve(root, "escape.json"));
  });

  test("aria extraction dedupes and caps", () => {
    const raw = `<div aria-label="Class comments"></div><div aria-label="Class comments"></div>` +
      Array.from({ length: 400 }, (_, i) => `<div aria-label="label ${i}"></div>`).join("");
    const labels = ariaLabelsFromHtml(raw);
    expect(labels[0]).toBe("Class comments");
    expect(labels.length).toBeLessThanOrEqual(300);
  });
});
