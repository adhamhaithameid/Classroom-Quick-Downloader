# Hyperframes composition brief

Produce the 23-second, 1920×1080, 30fps film defined in brag-plan.md. Output composition/ and brag.mp4; choose a settled product-action poster and bake it as frame zero without changing duration or audio.

## Creative contract
Show the same post before and after controls appear. Make the native blue Download all control the decisive gesture. Keep product typography and original icon. Use a light green-tinted canvas, large dark type, deliberate whitespace and a large legible demo, not stock imagery. The only miniature UI is the enlarged product context. Fictional attachments: Lecture notes.pdf, Practice sheet.pdf and Seminar slides.pptx. No teacher names, student identifiers or real class details. Visible “Illustrative demo · download time varies” avoids implying recorded transfer speed.

Scenes: hook 0–3; primary flow 3–13.1; trust 13.1–17.5; closing 17.5–23. Keep the independent-project disclaimer readable throughout: “Independent project. Not affiliated with Google or Google Classroom.”

Copy and timing from brag-plan.md are normative. Native controls may be scaled for legibility; preserve source geometry, colors, icon and wording. Completion green may be darkened minimally if required by the video contrast audit; document it. Render with a single worker given available memory.

## Source material
- README.md; extension/README.md; extension/package.json; extension/wxt.config.ts
- extension/entrypoints/content/styles.ts, icons.ts, button-state.ts, download-handler.ts
- extension/src/download-all/button-controller.ts and refresh.ts
- extension/entrypoints/popup/App.tsx and App.css (local stats, settings, beta boundaries)
- extension/entrypoints/utils/analytics/types.ts; PRIVACY.md
- docs/ARCHITECTURE.md; cloudflare-worker/README.md
- website/src/app.css; website/src/routes/overview/+page.svelte
- docs/readme/usage-download-buttons.jpg; docs/readme/usage-success-state.png
- website/static/favicon-512x512.png; website/static/images/{chrome,firefox,edge}.svg
- Public landing page inspected on 2026-09-21; privacy and version inconsistencies excluded from creative claims.

## Audio and motion
No narration. Original 110 BPM instrumental audio, low mix with a clean final fade. Sparse click and completion accents aligned to visible actions. Generate source audio locally; extract frequency bands with installed hyperframes-creative helper. Use precomputed data only, seek-safe animation, local font and GSAP assets. Beat locks and reading holds take precedence over flourish. Music-reactive structural rule must remain subtle.

## Tooling and delivery
Hyperframes 0.8.58, five current domain skills installed from heygen-com/hyperframes. Author one paused registered GSAP timeline; clip lifecycle belongs to the framework. Run check with layout, runtime, motion and contrast; inspect proof snapshots. The user explicitly requests the completed rendered video, so rendering is authorized. Higgsfield returned USER_NOT_LOGGED_IN; do not fabricate a generation or use it as an obstacle to the local render. No commit, push, app changes or publication.
