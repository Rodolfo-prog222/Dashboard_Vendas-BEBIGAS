// Recorta o bujão de gás de public/logo-bebigas.png e gera:
//  - public/icone-bujao.png (recorte avulso, fundo transparente)
//  - public/favicon.ico (16/32/48px, a partir do recorte)
// Rodar de novo com: node scripts/make-favicon.mjs
import sharp from "sharp";
import fs from "node:fs";

const SOURCE = "public/logo-bebigas.png";
const CANISTER_REGION = { left: 0, top: 0, width: 340, height: 363 }; // logo tem 1624x363; o bujão fica nesta faixa à esquerda
const SIZES = [16, 32, 48];

async function buildCanisterPng() {
  const cropped = await sharp(SOURCE).extract(CANISTER_REGION).png().toBuffer();
  const trimmed = await sharp(cropped).trim({ threshold: 10 }).png().toBuffer();
  fs.writeFileSync("public/icone-bujao.png", trimmed);
  return trimmed;
}

function buildIco(images) {
  const count = images.length;
  let offset = 6 + count * 16;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(count, 4);

  const entries = [];
  const datas = [];
  for (const { size, buf } of images) {
    const entry = Buffer.alloc(16);
    entry.writeUInt8(size >= 256 ? 0 : size, 0);
    entry.writeUInt8(size >= 256 ? 0 : size, 1);
    entry.writeUInt8(0, 2);
    entry.writeUInt8(0, 3);
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(buf.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += buf.length;
    entries.push(entry);
    datas.push(buf);
  }
  return Buffer.concat([header, ...entries, ...datas]);
}

const canisterPng = await buildCanisterPng();

const images = [];
for (const size of SIZES) {
  const buf = await sharp(canisterPng)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  images.push({ size, buf });
}

fs.writeFileSync("public/favicon.ico", buildIco(images));
console.log("OK: public/icone-bujao.png e public/favicon.ico gerados.");
