// Turns the Voidmon drawings (assets/voidmon/voidmon-*.svg, the design
// source) into the PNG images the app and website show
// (assets/voidmon/voidmon-*.png, 1024px wide, transparent).
//
//   node app/scripts/voidmon-art.mjs      (from the repo root, after editing a drawing)
//
// The loading pose also gets two layers, voidmon-loading-body.png and
// voidmon-loading-orbit.png, so the dots can spin around a still Voidmon.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "assets", "voidmon");
const WIDTH = 1024;
const png = (svg, name) => sharp(Buffer.from(svg), { density: 600 }).resize({ width: WIDTH }).png().toFile(join(dir, `${name}.png`));

const made = [];
for (const file of readdirSync(dir).filter((f) => /^voidmon-[a-z]+\.svg$/.test(f)).sort()) {
  const name = file.slice(0, -4);
  const svg = readFileSync(join(dir, file), "utf8");
  await png(svg, name);
  made.push(name);
  const orbit = svg.match(/<g class="orbit">[\s\S]*?<\/g>/);
  if (orbit) {
    await png(svg.replace(orbit[0], ""), `${name}-body`);
    await png(svg.replace(/<defs>[\s\S]*?<\/defs>/, "").replace(/<title>[^<]*<\/title>/, "")
      .replace(/(<g transform="[^"]+">)[\s\S]*<\/g><\/svg>/, `$1${orbit[0]}</g></svg>`), `${name}-orbit`);
    made.push(`${name}-body`, `${name}-orbit`);
  }
}
console.log(`PNG: ${made.join(", ")}`);
