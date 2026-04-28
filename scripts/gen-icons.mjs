import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
mkdirSync(publicDir, { recursive: true });

// High-res source SVG tuned to render well at 192/512 px.
const SOURCE_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1e3a8a"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" rx="96" fill="url(#g)"/>
  <g transform="translate(72 168)">
    <rect x="0" y="0" width="240" height="150" rx="14" fill="#ffffff"/>
    <path d="M240 42 h70 l50 52 v56 h-120 z" fill="#ffffff"/>
    <rect x="0" y="0" width="240" height="150" rx="14" fill="none" stroke="#0b1120" stroke-width="4" stroke-opacity="0.08"/>
    <circle cx="72" cy="168" r="26" fill="#0b1120"/>
    <circle cx="72" cy="168" r="10" fill="#ffffff"/>
    <circle cx="288" cy="168" r="26" fill="#0b1120"/>
    <circle cx="288" cy="168" r="10" fill="#ffffff"/>
  </g>
  <text x="256" y="430" text-anchor="middle"
        font-family="Inter, Arial, sans-serif"
        font-size="72" font-weight="800" fill="#ffffff" letter-spacing="6">BSC</text>
</svg>
`;

const buf = Buffer.from(SOURCE_SVG);

async function build() {
  await sharp(buf, { density: 384 }).resize(192, 192).png().toFile(join(publicDir, "icon-192.png"));
  await sharp(buf, { density: 384 }).resize(512, 512).png().toFile(join(publicDir, "icon-512.png"));
  await sharp(buf, { density: 384 }).resize(180, 180).png().toFile(join(publicDir, "apple-touch-icon.png"));
  await sharp(buf, { density: 384 }).resize(32, 32).png().toFile(join(publicDir, "favicon-32.png"));
  writeFileSync(join(publicDir, "icon.svg"), SOURCE_SVG.trim());
  console.log("Icons generated in", publicDir);
}

build().catch((e) => {
  console.error(e);
  process.exit(1);
});
