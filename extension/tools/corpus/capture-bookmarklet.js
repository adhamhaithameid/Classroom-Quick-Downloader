/**
 * CAPTURE BOOKMARKLET — paste the minified body into a DevTools console on a
 * real Classroom page (stream, classwork, assignment details, student work).
 * It collects each post card's outerHTML plus its stream-item id and triggers
 * a JSON download. Run sanitize-capture.mjs on the file afterwards.
 *
 * Nothing leaves the machine: no fetch, no XHR — only a local Blob download.
 */
(function () {
  const cards = document.querySelectorAll('[data-stream-item-id]');
  const seen = new Set();
  const captures = [];
  for (const el of cards) {
    const postId = el.getAttribute('data-stream-item-id');
    if (!postId || seen.has(postId) || el.parentElement?.closest('[data-stream-item-id]')) continue;
    seen.add(postId);
    captures.push({ postId, html: el.outerHTML });
  }
  const blob = new Blob(
    [JSON.stringify({ capturedOn: new Date().toISOString(), url: location.pathname, captures }, null, 2)],
    { type: 'application/json' },
  );
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cqd-capture-${Date.now()}.json`;
  a.click();
  console.log(`captured ${captures.length} cards`);
})();
