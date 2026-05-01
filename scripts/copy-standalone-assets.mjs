// Copies the assets that `next build --output=standalone` does not include in
// the standalone bundle (.next/static and public/), so `node .next/standalone/server.js`
// can be launched from the project root with everything in place.
//
// Cross-platform replacement for `xcopy /E /I` / `cp -r`.

import { copyFile, cp, mkdir, rm, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const standalone = resolve(root, ".next", "standalone");

if (!existsSync(standalone)) {
  console.error(
    "[copy-standalone-assets] .next/standalone not found — did `next build` run with output: 'standalone'?",
  );
  process.exit(1);
}

async function syncDir(src, dest, label) {
  if (!existsSync(src)) {
    console.warn(`[copy-standalone-assets] skipping ${label} (no ${src})`);
    return;
  }
  const t0 = Date.now();
  await rm(dest, { recursive: true, force: true });
  await mkdir(dest, { recursive: true });
  await cp(src, dest, { recursive: true, force: true });
  console.log(
    `[copy-standalone-assets] copied ${label} (${Date.now() - t0}ms)`,
  );
}

await syncDir(
  resolve(root, "public"),
  resolve(standalone, "public"),
  "public/",
);

await syncDir(
  resolve(root, ".next", "static"),
  resolve(standalone, ".next", "static"),
  ".next/static/",
);

// Prisma client engine: Next's standalone tracer usually picks this up, but
// when the SQLite query engine sits in node_modules/.prisma, double-check it
// landed inside .next/standalone/node_modules/.prisma. If not, copy it.
const prismaEngineSrc = resolve(root, "node_modules", ".prisma");
const prismaEngineDest = resolve(standalone, "node_modules", ".prisma");
try {
  await stat(prismaEngineDest);
} catch {
  await syncDir(prismaEngineSrc, prismaEngineDest, "node_modules/.prisma/");
}

// Drop .env.production.local next to server.js so Next's runtime env loader
// (@next/env) overrides the dev `.env` that the standalone bundler shipped.
const envSrc = resolve(root, ".env.production.local");
if (existsSync(envSrc)) {
  await copyFile(envSrc, resolve(standalone, ".env.production.local"));
  console.log("[copy-standalone-assets] copied .env.production.local");
} else {
  console.warn(
    "[copy-standalone-assets] .env.production.local not found — using bundled .env",
  );
}

console.log("[copy-standalone-assets] done.");
