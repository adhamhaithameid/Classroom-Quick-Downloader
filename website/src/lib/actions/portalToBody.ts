/* Anchors a fixed-position element to <body>, escaping transformed ancestors.
   The layout's footer-reveal promotes <main> with translate + will-change:
   translate, which turns every position:fixed descendant into a
   document-anchored box rendered at the top of the page. Overlay-style
   elements (modals, celebrations) must live outside that subtree. */
export function portalToBody(node: HTMLElement): { destroy(): void } {
  if (node.parentElement === document.body) return { destroy: () => undefined };
  document.body.appendChild(node);
  return {
    destroy: () => node.remove()
  };
}
