// ============================================================================
// Генератор PNG-иконок LangCards. Запуск: node scripts/gen-icons.mjs
// ----------------------------------------------------------------------------
// Рисуем знак (квадратный пузырь-карточка + кремовая L) напрямую в пиксели:
// геометрия задана функциями расстояния (SDF), сглаживание — суперсэмплингом,
// PNG собирается вручную поверх встроенного zlib. Так в проекте не появляется
// нативных графических зависимостей (sharp/resvg), а иконки пересобираются
// одной командой и байт-в-байт одинаково на любой машине.
//
// ИСТОЧНИК ПРАВДЫ по форме — те же координаты, что в public/icon.svg. Меняя
// знак, правьте и SVG, и константы ниже (ART), затем пересоберите PNG.
// ============================================================================

import { writeFileSync, mkdirSync } from "node:fs";
import { deflateSync } from "node:zlib";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PUB = join(dirname(fileURLToPath(import.meta.url)), "..", "public");

// ---------- Палитра Ember ----------
const CHARCOAL = [24, 17, 13]; // #18110D — тёплый уголь (фон, тёмная)
const TERRACOTTA = [192, 95, 54]; // #C05F36 — пузырь
const CREAM = [255, 250, 246]; // #FFFAF6 — буква L

// ---------- Геометрия знака в пространстве 512×512 (как в icon.svg) ----------
const ART = {
  // Тело пузыря: прямоугольник со скруглениями, кроме нижне-левого угла —
  // там начинается «хвостик» реплики.
  body: { x0: 88, y0: 84, x1: 424, y1: 384, rTL: 72, rTR: 72, rBR: 72, rBL: 0 },
  // Хвостик: треугольник от нижней грани вниз-влево до острия.
  tail: [
    [88, 384],
    [88, 452],
    [200, 384],
  ],
  // Буква L — две «капсулы» (толстые отрезки с круглыми концами).
  stroke: 22, // половина толщины (в SVG stroke-width=44)
  lVert: [200, 164, 200, 304],
  lHoriz: [200, 304, 312, 304],
};

// Безопасная зона maskable: знак ужимаем и центрируем, чтобы он целиком
// попадал в круг диаметром 80% иконки (те же числа, что в icon-maskable.svg).
const MASK_SCALE = 0.815;
const MASK_TX = 47.4;
const MASK_TY = 37.6;

// ---------- SDF-примитивы (расстояние < 0 — внутри фигуры) ----------
function sdRoundBox(px, py, b) {
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  const hw = (b.x1 - b.x0) / 2;
  const hh = (b.y1 - b.y0) / 2;
  const qx = px - cx;
  const qy = py - cy;
  const r = qx < 0 ? (qy < 0 ? b.rTL : b.rBL) : qy < 0 ? b.rTR : b.rBR;
  const dx = Math.abs(qx) - (hw - r);
  const dy = Math.abs(qy) - (hh - r);
  const outside = Math.hypot(Math.max(dx, 0), Math.max(dy, 0));
  return outside + Math.min(Math.max(dx, dy), 0) - r;
}

function sdCapsule(px, py, ax, ay, bx, by, r) {
  const pax = px - ax;
  const pay = py - ay;
  const bax = bx - ax;
  const bay = by - ay;
  const h = Math.max(
    0,
    Math.min(1, (pax * bax + pay * bay) / (bax * bax + bay * bay)),
  );
  return Math.hypot(pax - bax * h, pay - bay * h) - r;
}

// Внутри треугольника? (знак нам не нужен — только принадлежность)
function inTriangle(px, py, t) {
  const sign = (ax, ay, bx, by, cx, cy) =>
    (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
  const d1 = sign(px, py, t[0][0], t[0][1], t[1][0], t[1][1]);
  const d2 = sign(px, py, t[1][0], t[1][1], t[2][0], t[2][1]);
  const d3 = sign(px, py, t[2][0], t[2][1], t[0][0], t[0][1]);
  const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
  const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
  return !(hasNeg && hasPos);
}

// Цвет знака в точке (x,y) арт-пространства или null, если знака там нет.
function artColorAt(x, y) {
  if (
    sdCapsule(x, y, ...ART.lVert, ART.stroke) < 0 ||
    sdCapsule(x, y, ...ART.lHoriz, ART.stroke) < 0
  ) {
    // L рисуем только там, где под ней есть пузырь (иначе буква «вылезет»).
    return CREAM;
  }
  if (sdRoundBox(x, y, ART.body) < 0 || inTriangle(x, y, ART.tail)) {
    return TERRACOTTA;
  }
  return null;
}

/**
 * Рендер иконки.
 * @param {number} size    — сторона в пикселях
 * @param {object} opts    — { bg: [r,g,b]|null, radius: number, maskable: bool }
 *   bg=null → прозрачный фон; radius — скругление подложки в 512-пространстве.
 */
function renderIcon(size, { bg, radius = 0, maskable = false }) {
  const SS = 3; // суперсэмплинг для сглаживания
  const rgba = Buffer.alloc(size * size * 4);
  const unit = 512 / size; // сколько единиц 512-пространства в одном пикселе
  const bgBox = { x0: 0, y0: 0, x1: 512, y1: 512, rTL: radius, rTR: radius, rBR: radius, rBL: radius };

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let sy = 0; sy < SS; sy += 1) {
        for (let sx = 0; sx < SS; sx += 1) {
          const ux = (px + (sx + 0.5) / SS) * unit;
          const uy = (py + (sy + 0.5) / SS) * unit;

          // Подложка (в координатах иконки).
          let color = null;
          let alpha = 0;
          if (bg && sdRoundBox(ux, uy, bgBox) < 0) {
            color = bg;
            alpha = 1;
          }

          // Знак: для maskable сначала переводим точку в арт-пространство.
          const ax = maskable ? (ux - MASK_TX) / MASK_SCALE : ux;
          const ay = maskable ? (uy - MASK_TY) / MASK_SCALE : uy;
          const art = artColorAt(ax, ay);
          if (art) {
            color = art;
            alpha = 1;
          }

          if (color) {
            r += color[0];
            g += color[1];
            b += color[2];
            a += alpha;
          }
        }
      }
      const n = SS * SS;
      const i = (py * size + px) * 4;
      // Цвет усредняем по ПОКРЫТЫМ сэмплам (иначе края темнеют), альфа — по всем.
      const cov = a || 1;
      rgba[i] = Math.round(r / cov);
      rgba[i + 1] = Math.round(g / cov);
      rgba[i + 2] = Math.round(b / cov);
      rgba[i + 3] = Math.round((a / n) * 255);
    }
  }
  return rgba;
}

// ---------- Минимальный кодировщик PNG (RGBA, без фильтров) ----------
const CRC_TABLE = (() => {
  const table = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePNG(size, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // бит на канал
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y += 1) {
    raw[y * (size * 4 + 1)] = 0; // тип фильтра «none»
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------- Что генерируем ----------
// any      — скруглённая подложка, прозрачные углы (обычные иконки, favicon)
// maskable — фон во весь квадрат, знак в безопасной зоне (Android adaptive)
// apple    — фон во весь квадрат без скруглений и без альфы (iOS маскирует сам)
const TARGETS = [
  ["icons/icon-96.png", 96, { bg: CHARCOAL, radius: 112 }],
  ["icons/icon-128.png", 128, { bg: CHARCOAL, radius: 112 }],
  ["icons/icon-192.png", 192, { bg: CHARCOAL, radius: 112 }],
  ["icons/icon-256.png", 256, { bg: CHARCOAL, radius: 112 }],
  ["icons/icon-384.png", 384, { bg: CHARCOAL, radius: 112 }],
  ["icons/icon-512.png", 512, { bg: CHARCOAL, radius: 112 }],
  ["icons/icon-maskable-192.png", 192, { bg: CHARCOAL, radius: 0, maskable: true }],
  ["icons/icon-maskable-512.png", 512, { bg: CHARCOAL, radius: 0, maskable: true }],
  ["apple-touch-icon.png", 180, { bg: CHARCOAL, radius: 0 }],
  ["favicon-32.png", 32, { bg: CHARCOAL, radius: 112 }],
  ["favicon-16.png", 16, { bg: CHARCOAL, radius: 112 }],
];

mkdirSync(join(PUB, "icons"), { recursive: true });
for (const [name, size, opts] of TARGETS) {
  const png = encodePNG(size, renderIcon(size, opts));
  writeFileSync(join(PUB, name), png);
  console.log(`✓ ${name} — ${size}×${size}, ${(png.length / 1024).toFixed(1)} KB`);
}
console.log(`\nГотово: ${TARGETS.length} файлов в public/.`);
