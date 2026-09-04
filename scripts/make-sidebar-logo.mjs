// Gera public/logo-bebigas-sidebar.png: mesma logo, mas com o texto "bebigás"
// (verde #00a859) recolorido pra branco, pra usar em cima do fundo verde sólido
// da sidebar. O bujão (cinza/branco/amarelo) fica como está — já tem contraste
// bom em qualquer fundo verde escuro.
import sharp from "sharp";

const SOURCE = "public/logo-bebigas.png";

const { data, info } = await sharp(SOURCE).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
const { width, height, channels } = info;

// pixels "esverdeados" (canal G nitidamente maior que R e B) viram branco — pega o
// wordmark cheio E as bordas anti-aliased (que misturam pro branco mantendo G alto),
// sem tocar no cinza do bujão (R≈G≈B) nem no amarelo (R e G altos, B baixo).
for (let i = 0; i < data.length; i += channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2];
  if (g > r + 15 && g > b + 15) {
    data[i] = 255;
    data[i + 1] = 255;
    data[i + 2] = 255;
  }
}

await sharp(data, { raw: { width, height, channels } })
  .png()
  .toFile("public/logo-bebigas-sidebar.png");

console.log("OK: public/logo-bebigas-sidebar.png gerado.");
