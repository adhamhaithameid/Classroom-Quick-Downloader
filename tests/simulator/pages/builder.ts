// filepath: tests/simulator/pages/builder.ts
/**
 * ============================================================================
 * PAGE BUILDER — scenario data → Classroom-like DOM (Manual-QA Replay)
 * ============================================================================
 *
 * Composes the captured Classroom structural primitives CQD actually keys on
 * (card classes, attachment containers, count chips, headers, comment shells)
 * from typed scenario data. These are structural-contract fixtures, NOT a
 * Classroom recreation: only what CQD needs to exercise, nothing more.
 */

import type {
  AttachmentSpec,
  LinkSpec,
  PostSpec,
  RouteSpec,
  Scenario,
} from "../scenario";
import { linkHref } from "../scenario";

/** Escape text for safe interpolation into HTML. */
function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** gstatic-style media icon per attachment kind, mirroring Classroom markup. */
const KIND_ICON: Record<string, string> = {
  drive: "icon_3_pdf_x16.png",
  docs: "icon_3_document_x16.png",
  sheets: "icon_3_spreadsheet_x16.png",
  forms: "icon_3_form_x16.png",
  youtube: "icon_3_video_x16.png",
  external: "icon_3_https_x16.png",
};

function looseLinkHtml(link: LinkSpec): string {
  return `<a href="${esc(linkHref(link))}">${esc(link.name)}</a>`;
}

function attachmentCardHtml(att: AttachmentSpec, containerClass: string, containerAttr: string, hrefOverride?: string): string {
  const icon = KIND_ICON[att.kind] ?? KIND_ICON.drive;
  return `
      <div class="${containerClass}" ${containerAttr}>
        <a
          class="VkhHKd e7EEH nQaZq"
          aria-label="Attachment: ${esc(att.name)}"
          href="${esc(hrefOverride ?? linkHref(att))}"
        >
          <div class="rzTfPe xSP5ic">
            <img src="//ssl.gstatic.com/docs/doclist/images/mediatype/${icon}" alt="" />
          </div>
          <div class="YVvGBb VjRxGc">${esc(att.name)}</div>
        </a>
      </div>`;
}

function attachmentsBlockHtml(attachments: AttachmentSpec[] | undefined, containerClass: string, attrFor: (a: AttachmentSpec) => string): string {
  if (!attachments || attachments.length === 0) return "";
  const cards = attachments.map((a) => attachmentCardHtml(a, containerClass, attrFor(a))).join("\n");
  return `\n    <div class="attachments">\n${cards}\n    </div>`;
}

function commentsChipHtml(count: number | null | undefined): string {
  if (count == null) return "";
  return `
    <div class="qCWAqb"><div class="huI6Cb">${count}</div></div>`;
}

function commentShellHtml(postId: string, count: number | null | undefined): string {
  if (count == null) return "";
  return `
    <section class="n4xnA comment-shell">
      <div data-stream-item-id="${esc(postId)}" jscontroller="h38nBf"></div>
      <div class="comment-count">${count} class comments</div>
    </section>`;
}

function bodyHtml(post: PostSpec): string {
  const text = post.body ? `<p>${esc(post.body)}</p>` : "";
  const links = (post.looseLinks ?? []).map(looseLinkHtml).join("\n      ");
  if (!text && !links) return "";
  return `
    <div class="asQXV QRiHXd">
      ${text}${links ? `\n      ${links}` : ""}
    </div>`;
}

function postHtml(post: PostSpec): string {
  const editedDate = post.edited?.date ? `\n      <div class="meta-row">Edited ${esc(post.edited.date)}</div>` : "";
  return `<article class="n4xnA JUr7jb" data-stream-item-id="${esc(post.id)}">
    <header class="IMvYId">
      <div class="author-row">${esc(post.author ?? "Test Teacher")}</div>${editedDate}
    </header>${bodyHtml(post)}${attachmentsBlockHtml(post.attachments, "luto0c", (a) => `data-attachment-id="${esc(a.id ?? a.name)}"`)}${commentsChipHtml(post.comments)}${commentShellHtml(post.id, post.comments)}
  </article>`;
}

function classworkPostHtml(post: PostSpec): string {
  return `<li data-stream-item-id="${esc(post.id)}" class="n4xnA">${postHtml(post)}</li>`;
}

function detailsHtml(route: Extract<RouteSpec, { kind: "details" }>): string {
  const d = route.details;
  const kindLabel = d.kind === "assignment" ? "Assignment" : "Material";
  // Real Classroom wraps detail views in a stream-item card — CQD's Download
  // All grouping keys on that root, so the simulator must carry it too.
  return `<article class="n4xnA JUr7jb" data-stream-item-id="${esc(d.id)}">
    <section class="detailsview-${d.kind}" data-page="${d.kind}-details">
      <div class="Iwp0Ue xWw7yd material-shell">
        <header class="detail-header">
          <div class="PazDv">${kindLabel}</div>
          <h1 class="YVvGBb">${esc(d.title)}</h1>
        </header>${attachmentsBlockHtml(d.attachments, "KlRXdf", (a) => `data-drive-id="${esc(a.id ?? a.name)}"`)}
      </div>${bodyHtml({ id: d.id, body: undefined, looseLinks: d.looseLinks }).replace('asQXV QRiHXd', 'VYv8If QRiHXd aHTZpf')}${commentsChipHtml(d.comments)}${commentShellHtml(d.id, d.comments)}
    </section>
  </article>`;
}

function submissionsHtml(route: Extract<RouteSpec, { kind: "submissions" }>): string {
  const rows = route.submissions.rows
    .map((row) => {
      // Real submissions rows anchor attachments to the Classroom student-work
      // viewer (/g/tg/…) with the Drive id as a query param — that is the
      // container contract the student-work scripts key on.
      const cards = row.attachments
        .map((a) =>
          attachmentCardHtml(
            a,
            "WkZsyc",
            `data-submission-attachment-id="${esc(a.id ?? a.name)}"`,
            `https://classroom.google.com/g/tg/submission-attachment/viewer?id=${encodeURIComponent(a.id ?? a.name)}`,
          ),
        )
        .join("\n");
      return `  <div class="student-row" data-item-id="${esc(row.id)}" data-stream-item-id="${esc(row.id)}">
    <div class="author-row">${esc(row.student)}</div>
    ${cards}
  </div>`;
    })
    .join("\n");
  return `<section class="detailsview-submissions" data-page="submissions">
${rows}
  </section>`;
}

function routeInnerHtml(route: RouteSpec): string {
  switch (route.kind) {
    case "stream":
      return route.posts.map(postHtml).join("\n");
    case "classwork":
      return route.posts.map(classworkPostHtml).join("\n");
    case "details":
      return detailsHtml(route);
    case "submissions":
      return submissionsHtml(route);
  }
}

/** Delayed posts are staged in their own templates, inserted by the router. */
function delayedTemplatesHtml(kind: "stream" | "classwork", posts: PostSpec[]): string {
  const emit = kind === "classwork" ? classworkPostHtml : postHtml;
  return posts
    .filter((p) => p.insertAfterMs)
    .map(
      (p) =>
        `<template data-insert-after="${p.insertAfterMs}">${emit(p)}</template>`,
    )
    .join("\n");
}

/** Load-more posts are staged in a sentinel-fed template. */
function loadMoreTemplateHtml(route: Extract<RouteSpec, { kind: "stream" | "classwork" }>): string {
  if (!route.loadMorePosts || route.loadMorePosts.length === 0) return "";
  const inner = route.loadMorePosts
    .map((p) => (route.kind === "classwork" ? classworkPostHtml(p) : postHtml(p)))
    .join("\n");
  return `<template data-load-more>${inner}</template>`;
}

/**
 * Build one `<template data-route="…">` per scenario route. The router
 * (router.ts) clones the matching template into #page on navigation.
 */
export function buildRouteTemplates(scenario: Scenario): string {
  return scenario.routes
    .map((route) => {
      const isFeed = route.kind === "stream" || route.kind === "classwork";
      const immediate = isFeed
        ? route.posts.filter((p) => !p.insertAfterMs).map(route.kind === "classwork" ? classworkPostHtml : postHtml).join("\n")
        : routeInnerHtml(route);
      const delayed = isFeed ? delayedTemplatesHtml(route.kind, route.posts) : "";
      const loadMore = isFeed ? loadMoreTemplateHtml(route) : "";
      const listOpen = route.kind === "classwork" ? '<ul class="classwork-list">' : "";
      const listClose = route.kind === "classwork" ? "</ul>" : "";
      const sentinel = isFeed ? '\n    <div id="cqd-load-more-sentinel" aria-hidden="true"></div>' : "";
      return `<template data-route="${esc(route.path)}">${listOpen}\n${immediate}${delayed}${loadMore}${sentinel}${listClose}</template>`;
    })
    .join("\n");
}
