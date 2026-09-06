const path = require("path");
const { createCanvas, GlobalFonts, loadImage } = require("@napi-rs/canvas");

const BANNER_DIR = path.join(__dirname, "..", "..", "banner");
const FONTS_DIR = path.join(BANNER_DIR, "fonts");

const FONT_DRUK = "DrukWide";
const FONT_SECULAR = "SecularOne";
const FONT_STILU = "Stilu";

const fontsRegistered = (() => {
  try {
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, "DrukWideBold.ttf"), FONT_DRUK);
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, "SecularOne-Regular.ttf"), FONT_SECULAR);
    GlobalFonts.registerFromPath(path.join(FONTS_DIR, "stilu.regular.otf"), FONT_STILU);
    return true;
  } catch (error) {
    return false;
  }
})();

const WIDTH = 930;
const HEIGHT = 280;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

function rgba(hex, a) {
  const value = String(hex || "").replace("#", "");
  if (value.length !== 6) return `rgba(255,255,255,${a})`;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function rand(n) {
  const q = Math.sin(n * 9999.91) * 43758.5453;
  return q - Math.floor(q);
}

function fit(text, max, maxSize, min, font, weight = 400, ctx) {
  let s = maxSize;
  while (s > min) {
    ctx.font = `${weight} ${s}px ${font}`;
    if (ctx.measureText(text).width <= max) return s;
    s -= 1;
  }
  return min;
}

function cover(ctx, im, dx, dy, dw, dh, zoom = 1) {
  if (!im) return;
  const ir = im.width / im.height;
  const tr = dw / dh;
  let w;
  let h;
  if (ir > tr) {
    h = dh;
    w = h * ir;
  } else {
    w = dw;
    h = w / ir;
  }
  w *= zoom;
  h *= zoom;
  ctx.drawImage(im, dx + (dw - w) / 2, dy + (dh - h) / 2, w, h);
}

function drawCover(ctx, image, x, y, width, height) {
  if (!image) return;
  const scale = Math.max(width / image.width, height / image.height);
  const sourceWidth = width / scale;
  const sourceHeight = height / scale;
  const sourceX = (image.width - sourceWidth) / 2;
  const sourceY = (image.height - sourceHeight) / 2;
  ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, x, y, width, height);
}

async function fetchImage(url) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return null;
    const response = await fetch(parsed, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const declaredSize = Number(response.headers.get("content-length") || 0);
    if (declaredSize > MAX_IMAGE_BYTES) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.length > MAX_IMAGE_BYTES) return null;
    return await loadImage(buffer);
  } catch {
    return null;
  }
}

function particles(ctx, t, col) {
  for (let i = 0; i < 125; i += 1) {
    const bx = rand(i * 3.17) * WIDTH;
    const by = rand(i * 7.71) * HEIGHT;
    const px = bx + Math.sin(t * 0.25 + i * 0.8) * 5;
    const py = by + Math.cos(t * 0.2 + i) * 3;
    const s = rand(i * 2.33) * 1.7 + 0.35;
    const a = (0.12 + rand(i * 5.12) * 0.72) * (0.65 + Math.sin(t * 2 + i * 4) * 0.35);
    ctx.beginPath();
    ctx.arc(px, py, s, 0, Math.PI * 2);
    ctx.fillStyle = rgba(col, a);
    ctx.fill();
  }
}

function glow(ctx, px, py, r, col, a) {
  const g = ctx.createRadialGradient(px, py, 0, px, py, r);
  g.addColorStop(0, rgba(col, a));
  g.addColorStop(0.4, rgba(col, a * 0.28));
  g.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = g;
  ctx.fillRect(px - r, py - r, r * 2, r * 2);
}

function avatarCircle(ctx, cx, cy, size, col, avatar) {
  ctx.save();
  ctx.shadowColor = col;
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 + 4, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(col, 0.98);
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.save();
  ctx.clip();
  if (avatar) {
    cover(ctx, avatar, cx - size / 2, cy - size / 2, size, size, 1.03);
  } else {
    const g = ctx.createRadialGradient(cx - 20, cy - 25, 4, cx, cy, size);
    g.addColorStop(0, "#e8d2ff");
    g.addColorStop(0.5, "#8246d2");
    g.addColorStop(1, "#1b0d30");
    ctx.fillStyle = g;
    ctx.fillRect(cx - size / 2, cy - size / 2, size, size);
  }
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 - 2, 0, Math.PI * 2);
  ctx.strokeStyle = rgba(col, 0.62);
  ctx.lineWidth = 2;
  ctx.stroke();
}

function draw(ctx, {
  bg,
  avatar,
  small,
  title,
  desc,
  footer,
  col,
  t,
}) {
  ctx.clearRect(0, 0, WIDTH, HEIGHT);

  if (bg) {
    const mx = Math.sin(t * 0.16) * 8;
    const my = Math.cos(t * 0.13) * 4;
    cover(ctx, bg, mx, my, WIDTH, HEIGHT, 1.08);
  } else {
    const g = ctx.createLinearGradient(0, 0, WIDTH, HEIGHT);
    g.addColorStop(0, "#10061f");
    g.addColorStop(0.3, "#30105a");
    g.addColorStop(0.65, "#5a249d");
    g.addColorStop(1, "#120527");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
  }

  const ov = ctx.createLinearGradient(0, 0, WIDTH, 0);
  ov.addColorStop(0, "rgba(3,2,10,0.48)");
  ov.addColorStop(0.38, "rgba(5,2,12,0.10)");
  ov.addColorStop(0.75, "rgba(7,2,15,0.13)");
  ov.addColorStop(1, "rgba(3,2,10,0.42)");
  ctx.fillStyle = ov;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  glow(ctx, 690 + Math.sin(t * 0.34) * 105, 128 + Math.cos(t * 0.27) * 40, 270, col, 0.25);
  glow(ctx, 300 + Math.cos(t * 0.21) * 65, 95, 190, "#7138ff", 0.14);
  particles(ctx, t, col);

  const vign = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, 90, WIDTH / 2, HEIGHT / 2, 560);
  vign.addColorStop(0, "rgba(0,0,0,0)");
  vign.addColorStop(0.7, "rgba(0,0,0,0.08)");
  vign.addColorStop(1, "rgba(0,0,0,0.55)");
  ctx.fillStyle = vign;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  avatarCircle(ctx, 148, 140, 145, col, avatar);

  const left = 255;
  const max = 650;

  const ss = fit(small, max, 21, 12, FONT_SECULAR, 400, ctx);
  ctx.font = `400 ${ss}px ${FONT_SECULAR}`;
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(255,255,255,0.96)";
  ctx.fillText(small, left, 76);

  const ts = fit(title, max, 73, 28, FONT_DRUK, 900, ctx);
  ctx.font = `900 ${ts}px ${FONT_DRUK}`;
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = 3.2;
  ctx.strokeStyle = col;
  ctx.shadowColor = rgba(col, 0.45);
  ctx.shadowBlur = 9;
  ctx.strokeText(title, left, 151);
  ctx.shadowBlur = 0;

  const lg = ctx.createLinearGradient(left, 0, 850, 0);
  lg.addColorStop(0, rgba(col, 0.85));
  lg.addColorStop(0.7, rgba(col, 0.25));
  lg.addColorStop(1, rgba(col, 0));
  ctx.fillStyle = lg;
  ctx.fillRect(left, 173, 580, 1.3);

  const ds = fit(desc, max, 18, 10, FONT_STILU, 400, ctx);
  ctx.font = `400 ${ds}px ${FONT_STILU}`;
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.fillText(desc, left, 202);

  ctx.font = `400 12px ${FONT_SECULAR}`;
  ctx.fillStyle = "rgba(255,255,255,0.58)";
  ctx.fillText(footer, left, 232);
}

async function renderHelpBanner({
  small = "MUSIC BOT",
  title = "EUPHORIA",
  desc = "LET THE MUSIC FLOW AND ACCOMPANY YOUR EVERY MOMENT",
  footer = "discord.gg/euphoria",
  col = "#b873ff",
  avatarUrl = null,
  backgroundUrl = null,
} = {}) {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  const [avatar, bg] = await Promise.all([fetchImage(avatarUrl), fetchImage(backgroundUrl)]);
  draw(ctx, { bg, avatar, small, title, desc, footer, col, t: 0 });

  return await canvas.encode("png");
}

const HELP_BANNER_FILE = "shafed-billi-help.png";

async function buildHelpBanner(options = {}) {
  try {
    const buffer = await renderHelpBanner(options);
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) return null;
    return buffer;
  } catch (error) {
    return null;
  }
}

module.exports = {
  HELP_BANNER_FILE,
  buildHelpBanner,
  renderHelpBanner,
};