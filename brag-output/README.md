# Classroom Quick Downloader launch package

- **brag.mp4** — final 23-second 1080p/30fps film with original music, UI accents and a baked first-frame poster.
- **brag.jpg** — selected product result at 10.8 seconds, for custom-thumbnail upload.
- **share-copy.txt** — canonical launch caption with installation link.
- **share-copy-variants.md** — LinkedIn, X, Product Hunt, GitHub and short caption variants.
- **launch-report.md** — creative decisions, verified claims, exclusions, assumptions and publishing next steps.
- **brag-plan.md / composition-brief.md** — storyboard and creative contract.
- **composition/** — editable Hyperframes project with local assets.
- **validation/** — check report, render log, encoded output checks and contact sheet.

## Preview

While the local server runs: http://localhost:3017/#project/composition

To start it again, from composition/:

```sh
npx --yes hyperframes@0.8.58 preview --background --port 3017
```

## Re-render

From composition/, after editing the HTML:

```sh
npx --yes hyperframes@0.8.58 check
npx --yes hyperframes@0.8.58 render --quality delivery --fps 30 --workers 1 --output ../brag.mp4
python3 ../scripts/finalize.py
```

The finalization script chooses the settled result frame at 10.8 seconds, replaces frame zero, preserves audio packets, and checks duration, frame count and full decode.

The source-generation scripts are optional. build-composition.py regenerates the HTML from the original template and will overwrite manual composition edits. make-audio.py needs NumPy; extract-controls.cjs needs this repository's TypeScript dependency. Finalize and re-render do not need those scripts or NumPy.

Use the install link in the accompanying post: the video end card points viewers there. Do not publish installation-notes or validation logs as social copy. No application code changes, commits, pushes or publication were performed.
