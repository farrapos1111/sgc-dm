import sharp from "sharp";
import pngToIco from "png-to-ico";
import { writeFileSync, readFileSync } from "fs";

let svg = readFileSync("public/favicon-black.svg", "utf8");
svg = svg.replaceAll("currentColor", "#111111");
svg = svg.replace(/<style>[\s\S]*?<\/style>/, "");

const glyph = await sharp(Buffer.from(svg))
  .resize(256, 256, {
    fit: "contain",
    background: { r: 255, g: 255, b: 255, alpha: 0 },
  })
  .png()
  .toBuffer();

const buffers = [];
for (const size of [16, 32, 48]) {
  buffers.push(await sharp(glyph).resize(size, size).png().toBuffer());
}
writeFileSync("public/favicon.ico", await pngToIco(buffers));

// iOS prefers opaque apple-touch icons
await sharp({
  create: {
    width: 180,
    height: 180,
    channels: 4,
    background: { r: 255, g: 255, b: 255, alpha: 1 },
  },
})
  .composite([{ input: await sharp(glyph).resize(140, 140).png().toBuffer(), gravity: "centre" }])
  .png()
  .toFile("public/apple-touch-icon.png");

console.log("ok");
