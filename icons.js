// Inline SVG icon helpers for Classroom Quick Downloader.
// No network requests, no <img> tags — CSP-proof and resolution independent.

(function (global) {
  const NS = "http://www.w3.org/2000/svg";

  function svgEl(tag, attrs = {}) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    return el;
  }

  /**
   * Creates a rounded "download" icon.
   * @param {number} size - CSS pixels (e.g., 16, 20, 24, 28)
   * @returns {SVGElement}
   */
  function createDownloadIcon(size = 20) {
    const svg = svgEl("svg", {
      viewBox: "0 0 24 24",
      width: String(size),
      height: String(size),
      "aria-hidden": "true",
      focusable: "false",
      class: "cqd-ico-svg"
    });

    // Tray
    svg.appendChild(
      svgEl("path", { d: "M5 20h14v-2H5v2z" })
    );
    // Arrow (rounded-ish)
    svg.appendChild(
      svgEl("path", {
        d: "M12 4a1 1 0 0 1 1 1v8.59l2.3-2.3a1 1 0 1 1 1.4 1.42l-4 4a1 1 0 0 1-1.4 0l-4-4a1 1 0 0 1 1.4-1.42l2.3 2.3V5a1 1 0 0 1 1-1z"
      })
    );

    // Inherit button color
    svg.style.fill = "currentColor";
    svg.style.display = "inline-block";
    svg.style.verticalAlign = "middle";
    return svg;
  }

  // Expose
  global.CQD_ICONS = { createDownloadIcon };
})(window);
