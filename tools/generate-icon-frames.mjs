// filepath: tools/generate-icon-frames.mjs
/**
 * Generate toolbar animation frames (bead 08fg.1). Reads the committed base
 * icons, measures their geometry per size, and renders:
 *   spin-{0..7}-{16,32,48}.png  white 270° arc sweeping the inner ring
 *   success-{16,32,48}.png      white check on the green field
 *   error-{16,32,48}.png        white X on the green field
 * Output: extension/src/icon/fx/. Run: node tools/generate-icon-frames.mjs
 * Re-run whenever the base icon changes so brand geometry stays exact.
 */
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('@playwright/test');

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const iconDir = join(root, 'extension', 'src', 'icon');
const outDir = join(iconDir, 'fx');
const SIZES = [16, 32, 48];
const FRAMES = 8;

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.setContent('<canvas id="c"></canvas>');

  const render = (size, mode, frame) =>
    page.evaluate(
      async ([size, mode, frame, baseB64]) => {
        const base = new Image();
        base.src = `data:image/png;base64,${baseB64}`;
        await base.decode();

        const canvas = document.getElementById('c');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        ctx.drawImage(base, 0, 0, size, size);

        const img = ctx.getImageData(0, 0, size, size).data;
        const px = (x, y) => {
          const i = (y * size + x) * 4;
          return [img[i], img[i + 1], img[i + 2], img[i + 3]];
        };
        const isWhiteish = ([r, g, b, a]) => a > 40 && r > 180 && g > 180 && b > 180;
        const isYellowish = ([r, g, b, a]) => a > 40 && r > 180 && g > 140 && b < 120;

        // Measure: yellow border thickness and the white ring bounds along
        // the horizontal center line of the real base icon.
        const cy = Math.floor(size / 2);
        let border = 0;
        while (border < size && isYellowish(px(border, cy))) border += 1;
        let firstWhite = -1;
        let lastWhite = -1;
        for (let x = border; x < size - border; x += 1) {
          if (isWhiteish(px(x, cy))) {
            if (firstWhite === -1) firstWhite = x;
            lastWhite = x;
          }
        }
        if (firstWhite === -1) throw new Error(`no ring found at size ${size}`);
        const cx = (firstWhite + lastWhite) / 2;
        const outerR = (lastWhite - firstWhite) / 2;
        // Ring stroke: scan outward from the ring's left edge until green.
        let stroke = 1;
        while (firstWhite + stroke < size && isWhiteish(px(firstWhite + stroke, cy))) stroke += 1;
        // Green field sample: on the center line between the border and the
        // ring's left edge — always field color, never border or ring.
        const green = px(Math.round((border + firstWhite) / 2), cy);

        ctx.clearRect(0, 0, size, size);
        ctx.drawImage(base, 0, 0, size, size);
        // Blank the inner disk (ring + arrow) with the field color.
        ctx.fillStyle = `rgb(${green[0]},${green[1]},${green[2]})`;
        ctx.beginPath();
        ctx.arc(cx, cy, outerR + stroke, 0, Math.PI * 2);
        ctx.fill();

        ctx.strokeStyle = '#ffffff';
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        if (mode === 'spin') {
          ctx.lineWidth = Math.max(1, stroke);
          const start = -Math.PI / 2 + (frame * 2 * Math.PI) / 8;
          ctx.beginPath();
          ctx.arc(cx, cy, outerR - stroke / 2, start, start + 1.5 * Math.PI);
          ctx.stroke();
        } else if (mode === 'success') {
          ctx.lineWidth = Math.max(1.5, stroke * 1.2);
          const r = outerR - stroke / 2;
          ctx.beginPath();
          ctx.moveTo(cx - r * 0.5, cy + r * 0.02);
          ctx.lineTo(cx - r * 0.12, cy + r * 0.42);
          ctx.lineTo(cx + r * 0.55, cy - r * 0.38);
          ctx.stroke();
        } else {
          ctx.lineWidth = Math.max(1.5, stroke * 1.1);
          const r = (outerR - stroke / 2) * 0.55;
          ctx.beginPath();
          ctx.moveTo(cx - r, cy - r);
          ctx.lineTo(cx + r, cy + r);
          ctx.moveTo(cx + r, cy - r);
          ctx.lineTo(cx - r, cy + r);
          ctx.stroke();
        }

        const out = canvas.toDataURL('image/png');
        return out.slice(out.indexOf(',') + 1);
      },
      [size, mode, frame, readFileSync(join(iconDir, `${size}.png`)).toString('base64')],
    );

  for (const size of SIZES) {
    for (let f = 0; f < FRAMES; f += 1) {
      const b64 = await render(size, 'spin', f);
      writeFileSync(join(outDir, `spin-${f}-${size}.png`), Buffer.from(b64, 'base64'));
    }
    writeFileSync(
      join(outDir, `success-${size}.png`),
      Buffer.from(await render(size, 'success', 0), 'base64'),
    );
    writeFileSync(
      join(outDir, `error-${size}.png`),
      Buffer.from(await render(size, 'error', 0), 'base64'),
    );
  }

  // Update-available dot variants (bead 08fg.3): base icon + red dot with a
  // white rim at the top-right corner. Full size set — the decoration
  // replaces the default icon everywhere, including chrome://extensions.
  const dotDir = join(iconDir, 'dot');
  const dotGrayDir = join(iconDir, 'dot-gray');
  mkdirSync(dotDir, { recursive: true });
  mkdirSync(dotGrayDir, { recursive: true });
  for (const size of [...SIZES, 96, 128]) {
    const base64Of = (name) => readFileSync(join(iconDir, name)).toString('base64');
    for (const [dir, baseName] of [
      [dotDir, `${size}.png`],
      [dotGrayDir, `${size}-gray.png`],
    ]) {
      const b64 = await page.evaluate(
        async ([size, baseB64]) => {
          const base = new Image();
          base.src = `data:image/png;base64,${baseB64}`;
          await base.decode();
          const canvas = document.getElementById('c');
          canvas.width = size;
          canvas.height = size;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(base, 0, 0, size, size);
          const cx = size * 0.76;
          const cy = size * 0.24;
          const r = size * 0.17;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.fillStyle = '#ea4335';
          ctx.fill();
          ctx.lineWidth = Math.max(1, size * 0.05);
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
          const dataUrl = canvas.toDataURL('image/png');
          return dataUrl.slice(dataUrl.indexOf(',') + 1);
        },
        [size, base64Of(baseName)],
      );
      writeFileSync(join(dir, `${size}.png`), Buffer.from(b64, 'base64'));
    }
  }
  console.log(
    `generated ${(FRAMES + 2) * SIZES.length} frames + ${SIZES.length + 1} * 2 dot icons`,
  );
} finally {
  await browser.close();
}
