// One-off generator, not part of the build: rasterizes scripts/icon-source.svg
// (a frozen, bold static mark — NOT a snapshot of the live animated <Logo>,
// which would be the wrong source for a PNG) into every icon file the PWA
// manifest and index.html reference. Re-run whenever icon-source.svg changes.
//
// Usage: node scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const pngToIcoModule = require('png-to-ico'); // ESM-only package — CJS require() lands the default export under .default
const pngToIco = pngToIcoModule.default || pngToIcoModule;

const SRC = path.join(__dirname, 'icon-source.svg');
const PUBLIC = path.join(__dirname, '..', 'public');
const INK = '#121211';

async function render(size, outFile, { padPct = 0 } = {}) {
  const svg = fs.readFileSync(SRC);
  let pipeline = sharp(svg, { density: 384 }).resize(size, size);

  if (padPct > 0) {
    // Maskable icons need the artwork to sit inside a safe zone — the OS
    // mask (circle/squircle/rounded-square, varies by platform) can crop
    // right up to the edge otherwise. Render smaller, then pad with the
    // icon's own background color so the padding is invisible, not a
    // visible border.
    const inner = Math.round(size * (1 - padPct * 2));
    const pad = Math.round((size - inner) / 2);
    pipeline = sharp(svg, { density: 384 }).resize(inner, inner).extend({
      top: pad, bottom: size - inner - pad, left: pad, right: size - inner - pad,
      background: INK
    });
  }

  await pipeline.png().toFile(path.join(PUBLIC, outFile));
  console.log(`wrote ${outFile} (${size}x${size}${padPct ? `, ${Math.round(padPct * 200)}% safe-zone padding` : ''})`);
}

async function main() {
  await render(192, 'logo192.png');
  await render(512, 'logo512.png');
  await render(512, 'maskable512.png', { padPct: 0.1 }); // 20% total padding — well inside the ~80%-diameter safe zone
  await render(180, 'apple-touch-icon.png');

  const icoSizes = [16, 32, 48, 64];
  const tmpFiles = [];
  for (const size of icoSizes) {
    const tmp = path.join(PUBLIC, `._favicon-${size}.png`);
    await sharp(fs.readFileSync(SRC), { density: 384 }).resize(size, size).png().toFile(tmp);
    tmpFiles.push(tmp);
  }
  const icoBuffer = await pngToIco(tmpFiles);
  fs.writeFileSync(path.join(PUBLIC, 'favicon.ico'), icoBuffer);
  tmpFiles.forEach((f) => fs.unlinkSync(f));
  console.log(`wrote favicon.ico (${icoSizes.join('/')})`);
}

main().catch((err) => { console.error(err); process.exit(1); });
