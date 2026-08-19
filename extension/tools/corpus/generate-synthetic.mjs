#!/usr/bin/env node
/**
 * Generates SYNTHETIC corpus cases: realistic Classroom DOM shells with
 * labels that are true BY CONSTRUCTION (the template decides what a human
 * would see). Provenance is recorded as "synthetic" in manifest.json until a
 * live capture replaces the case (see tools/corpus/README.md).
 *
 * Positive comment shells use the real L0 DOM-truth structure (.qCWAqb >
 * .huI6Cb) because that is what live Classroom ships. Edited markers use
 * exact strings from entrypoints/content/detection-keywords.ts so a failure
 * means a detection defect, not a template typo — EXCEPT Hungarian, which has
 * no keyword entries at all; its edited cases are expected baseline failures.
 *
 * Usage: node tools/corpus/generate-synthetic.mjs   (idempotent; regenerates)
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

const ROOT = resolve(process.cwd(), 'tests/accuracy/corpus');

const LOCALES = [
  { code: 'en', count: '5', editedText: 'Posted Mar 1 (Edited Mar 10)' },
  { code: 'ar', count: '٣', editedText: 'نُشر في ١ مارس (تم التعديل في ١٠ مارس)' },
  { code: 'es', count: '2', editedText: 'Publicado el 1 de marzo (editado el 10 de marzo)' },
  { code: 'ru', count: '7', editedText: 'Опубликовано 1 марта (изменено 10 марта)' },
  { code: 'ja', count: '4', editedText: '3月1日に投稿 (編集済み 3月10日)' },
  { code: 'hu', count: '6', editedText: 'Közzétéve: márc. 1. (szerkesztve: márc. 10.)' },
];

const HOSTILE_ACTION = {
  en: ['Add class comment', 'Commentary on the reading is due next week.'],
  ar: ['إضافة تعليق', 'يرجى إرسال التعليق كتابيًا قبل الموعد.'],
  es: ['Añadir comentario', 'Comentario final antes de la clase.'],
  ru: ['Добавить комментарий', 'Комментарий по чтению нужен к следующему занятию.'],
  ja: ['コメントを追加', '次回の授業までにコメントを提出してください。'],
  hu: ['Megjegyzés hozzáadása', 'Az olvasmányhoz észrevétel jár a jövő hétre.'],
};

const NUM = { en: '5', ar: '٣', es: '2', ru: '7', ja: '4', hu: '6' };
const NUM_VAL = { en: 5, ar: 3, es: 2, ru: 7, ja: 4, hu: 6 };

function card(postId, lang, { comments = null, editedText = null, hostile = false }) {
  const dir = lang === 'ar' ? ' dir="rtl"' : '';
  const meta =
    editedText !== null
      ? `<div class="JZk9qf Vu2fZd">${editedText}</div>`
      : '<div class="JZk9qf Vu2fZd">Posted</div>';
  const commentBlock =
    comments !== null
      ? `\n  <div class="qCWAqb"><div class="huI6Cb">${comments}</div></div>`
      : '\n  <div class="qCWAqb seqYL"><span aria-hidden="true"></span></div>';
  const body = hostile ? HOSTILE_ACTION[lang][1] : 'Reminder: review the attached material.';
  const action = hostile ? `\n  <button role="button">${HOSTILE_ACTION[lang][0]}</button>` : '';
  return `<article class="n4xnA JUr7jb" data-stream-item-id="${postId}"${dir}>
  <header class="IMvYId">
    <div class="author-row">Test User</div>
    ${meta}
  </header>
  <div class="asQXV QRiHXd">
    <p>${body}</p>
  </div>${commentBlock}${action}
</article>`;
}

function writeCase(caseId, spec) {
  const dir = join(ROOT, caseId);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'page.html'), spec.html);
  writeFileSync(
    join(dir, 'expected.json'),
    JSON.stringify({ ...spec.expected, caseId }, null, 2) + '\n',
  );
}

for (const loc of LOCALES) {
  const l = loc.code;
  const n = NUM[l];

  writeCase(`syn-${l}-plain-negative`, {
    html: card(`synth-${l}-1`, l, {}),
    expected: {
      viewKind: 'stream',
      lang: l,
      note: `Synthetic negative control (${l}): no flags present. Any flag is a false positive.`,
      origin: 'synthetic',
      posts: [
        { postId: `synth-${l}-1`, commentPresent: false, commentCount: null, editedPresent: false },
      ],
    },
  });

  writeCase(`syn-${l}-comments-l0`, {
    html: card(`synth-${l}-2`, l, { comments: n }),
    expected: {
      viewKind: 'stream',
      lang: l,
      note: `Synthetic (${l}): ${n} class comments in the real L0 DOM-truth shell (.qCWAqb > .huI6Cb). Count is language-free.`,
      origin: 'synthetic',
      posts: [
        { postId: `synth-${l}-2`, commentPresent: true, commentCount: NUM_VAL[l], editedPresent: false },
      ],
    },
  });

  writeCase(`syn-${l}-edited-only`, {
    html: card(`synth-${l}-3`, l, { editedText: loc.editedText }),
    expected: {
      viewKind: 'stream',
      lang: l,
      note: `Synthetic (${l}): edited marker inside the golden date container (.JZk9qf.Vu2fZd).`,
      origin: 'synthetic',
      posts: [
        { postId: `synth-${l}-3`, commentPresent: false, commentCount: null, editedPresent: true },
      ],
    },
  });

  writeCase(`syn-${l}-both-flags`, {
    html: card(`synth-${l}-4`, l, { comments: n, editedText: loc.editedText }),
    expected: {
      viewKind: 'stream',
      lang: l,
      note: `Synthetic (${l}): both signals on one card.`,
      origin: 'synthetic',
      posts: [
        { postId: `synth-${l}-4`, commentPresent: true, commentCount: NUM_VAL[l], editedPresent: true },
      ],
    },
  });

  writeCase(`syn-${l}-hostile-negative`, {
    html: card(`synth-${l}-5`, l, { hostile: true }),
    expected: {
      viewKind: 'stream',
      lang: l,
      note: `Synthetic (${l}): localized "add comment" action button plus flag-like body words. Must produce NO flags.`,
      origin: 'synthetic',
      posts: [
        { postId: `synth-${l}-5`, commentPresent: false, commentCount: null, editedPresent: false },
      ],
    },
  });
}

// Three structural extras to hit exactly 40 cases / 6 locales.
writeCase('syn-en-multi-post-mixed', {
  html:
    card('synth-en-a', 'en', { comments: '2' }) +
    '\n' +
    card('synth-en-b', 'en', {}) +
    '\n' +
    card('synth-en-c', 'en', { editedText: LOCALES[0].editedText }),
  expected: {
    viewKind: 'stream',
    lang: 'en',
    note: 'Synthetic: three cards in one page with different flag states; segmentation must keep them distinct.',
    origin: 'synthetic',
    posts: [
      { postId: 'synth-en-a', commentPresent: true, commentCount: 2, editedPresent: false },
      { postId: 'synth-en-b', commentPresent: false, commentCount: null, editedPresent: false },
      { postId: 'synth-en-c', commentPresent: false, commentCount: null, editedPresent: true },
    ],
  },
});

writeCase('syn-ar-count-only-shell', {
  html: card('synth-ar-9', 'ar', { comments: '٨' }),
  expected: {
    viewKind: 'stream',
    lang: 'ar',
    note: 'Synthetic: Arabic-Indic numeral 8 in the L0 shell; exercises cross-script digit parsing.',
    origin: 'synthetic',
    posts: [
      { postId: 'synth-ar-9', commentPresent: true, commentCount: 8, editedPresent: false },
    ],
  },
});

writeCase('syn-es-nested-duplicate-id', {
  html: `<article data-stream-item-id="synth-es-x">${card('synth-es-x', 'es', { comments: '3' }).replace('<article class="n4xnA JUr7jb"', '<span>').replace('</article>', '</span>')}
  <section><div data-stream-item-id="synth-es-x" jscontroller="h38nBf"></div></section>
</article>`,
  expected: {
    viewKind: 'stream',
    lang: 'es',
    note: 'Synthetic: nested elements repeating the parent stream-item-id must not be scored twice.',
    origin: 'synthetic',
    posts: [
      { postId: 'synth-es-x', commentPresent: true, commentCount: 3, editedPresent: false },
    ],
  },
});

// eslint-disable-next-line no-console
console.log(`synthetic cases written under ${ROOT} (skipped none; all regenerated)`);
if (!existsSync(join(ROOT, 'manifest.json'))) {
  writeFileSync(join(ROOT, 'manifest.json'), JSON.stringify({ _readme: 'populated by tools/corpus/build-manifest.mjs' }, null, 2));
}
