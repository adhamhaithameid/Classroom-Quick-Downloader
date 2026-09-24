# Asset provenance

- `composition/assets/logo.png`: copied from website/static/favicon-512x512.png, existing CQD product identity.
- `chrome.svg`, `firefox.svg`, `edge.svg`: existing repository browser marks, used solely to identify supported browsers.
- `cqd-controls.css`, `download.svg`, `success.svg`: extracted directly from the extension's styles.ts and icons.ts. Extraction script included. Video overrides freeze CSS transitions and deepen completion green for readable text.
- `PlusJakartaSans.ttf`: Google Fonts, google/fonts/ofl/plusjakartasans/PlusJakartaSans[wght].ttf. SIL Open Font License; OFL.txt included.
- `gsap.min.js`: GSAP 3.14.2 from jsDelivr, bundled locally for deterministic rendering. Runtime dependency, not a product feature.
- `music.wav` and `soundtrack.wav`: original procedural instrumental composition and synchronized UI accents, synthesized locally by scripts/make-audio.py. No sampled recordings or external music track used. Reproducible fixed seed, 110 BPM, 23 seconds.
- `audio-data.json` / `.js`: bands extracted from original music by the installed Hyperframes creative helper.
- All attachment names and course context in the demo are fictional. Native UI source, not a generative video model, determines the controls.

Higgsfield capability lookup was attempted and returned USER_NOT_LOGGED_IN. No Higgsfield job was submitted and no paid generation was used.
