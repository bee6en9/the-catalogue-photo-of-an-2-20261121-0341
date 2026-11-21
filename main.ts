// The Catalogue Photo of an Impossible Gadget — "USB Pet Rock" (Pebble).
// Node 22, standard library only. No network, no external assets.
// Renders a 1024x1024 studio catalogue photograph to /output/entry.png
// (or $MAKEFUN_OUTPUT_DIR/entry.png). Deterministic: no randomness,
// no clocks, no timestamps anywhere in the output.
//
// The joke, readable at a glance: a polished pebble, manufactured as a
// gadget — a USB-C port cut into its side, a small LED glowing amber
// (charging), and one white USB cable plugged into it, draping away.
// The product name "Pebble" is printed small on the stone itself.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

// ---------------------------------------------------------------------------
// Canvas: a plain RGB framebuffer, 1024 by 1024.
// ---------------------------------------------------------------------------
const W = 1024;
const H = 1024;
const buf = new Uint8Array(W * H * 3);

type RGB = [number, number, number];
const WHITE: RGB = [255, 255, 255];
const BG_TOP: RGB = [252, 252, 250];
const BG_MID: RGB = [241, 241, 239];
const FLOOR_TOP: RGB = [233, 233, 230];
const FLOOR_BOT: RGB = [216, 216, 213];
const STONE_TOP: RGB = [206, 208, 213];
const STONE_MID: RGB = [158, 160, 167];
const STONE_BOT: RGB = [102, 104, 111];
const STONE_EDGE: RGB = [88, 90, 97];
const CABLE: RGB = [246, 246, 244];
const CABLE_SHADE: RGB = [210, 210, 206];
const CABLE_LINE: RGB = [196, 196, 192];
const PORT_DARK: RGB = [16, 16, 18];
const PORT_INNER: RGB = [6, 6, 8];
const METAL: RGB = [176, 180, 187];
const METAL_DARK: RGB = [120, 124, 132];
const LED: RGB = [255, 178, 36];
const LED_CORE: RGB = [255, 214, 120];
const TEXT_DARK: RGB = [52, 54, 60];
const TEXT_LIGHT: RGB = [205, 207, 212];
const BLACK: RGB = [0, 0, 0];

function put(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  buf[i] = c[0];
  buf[i + 1] = c[1];
  buf[i + 2] = c[2];
}

function blend(x: number, y: number, c: RGB, a: number): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  if (a <= 0) return;
  if (a >= 1) {
    put(x, y, c);
    return;
  }
  const i = (y * W + x) * 3;
  buf[i] = Math.round(buf[i] * (1 - a) + c[0] * a);
  buf[i + 1] = Math.round(buf[i + 1] * (1 - a) + c[1] * a);
  buf[i + 2] = Math.round(buf[i + 2] * (1 - a) + c[2] * a);
}

function rect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) put(xx, yy, c);
  }
}

function disc(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) put(x, y, c);
    }
  }
}

function discBlend(cx: number, cy: number, r: number, c: RGB, a: number): void {
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) blend(x, y, c, a);
    }
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function mix(c1: RGB, c2: RGB, t: number): RGB {
  return [
    Math.round(lerp(c1[0], c2[0], t)),
    Math.round(lerp(c1[1], c2[1], t)),
    Math.round(lerp(c1[2], c2[2], t)),
  ];
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Only the glyphs the product name needs: P, e, b, l.
// Each glyph is 7 rows of 5 cells; '#' is ink, '.' is blank.
// ---------------------------------------------------------------------------
const GLYPHS: Record<string, string[]> = {
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  e: ['.....', '.....', '.###.', '#...#', '#####', '#....', '.###.'],
  b: ['#....', '#....', '####.', '#...#', '#...#', '#...#', '####.'],
  l: ['.##..', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
};

const CHAR_W = 6; // 5 pixels of glyph plus 1 of space

function drawGlyph(x: number, y: number, ch: string, scale: number, c: RGB): void {
  const g = GLYPHS[ch];
  if (!g) return;
  for (let r = 0; r < 7; r++) {
    const row = g[r];
    for (let col = 0; col < 5; col++) {
      if (row[col] === '#') {
        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            put(x + col * scale + dx, y + r * scale + dy, c);
          }
        }
      }
    }
  }
}

function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  let cx = x;
  for (const ch of s) {
    drawGlyph(cx, y, ch, scale, c);
    cx += CHAR_W * scale;
  }
}

// ---------------------------------------------------------------------------
// PNG encoder: signature, IHDR, one IDAT (zlib, filter 0 per row), IEND.
// ---------------------------------------------------------------------------
const CRC_TABLE = ((): Uint32Array => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i++) c = CRC_TABLE[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    raw[y * (1 + W * 3)] = 0;
    raw.set(buf.subarray(y * W * 3, (y + 1) * W * 3), y * (1 + W * 3) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', idat),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Scene: bright studio catalogue photograph.
// ---------------------------------------------------------------------------

// --- Studio background: soft vertical gradient, seamless cove floor. -------
const HORIZON = 780;
for (let y = 0; y < H; y++) {
  let c: RGB;
  if (y < HORIZON) {
    const t = y / HORIZON;
    c = mix(BG_TOP, BG_MID, t);
  } else {
    const t = (y - HORIZON) / (H - HORIZON);
    c = mix(FLOOR_TOP, FLOOR_BOT, t);
  }
  for (let x = 0; x < W; x++) {
    // Gentle top-left key light: brighten near the upper left.
    const dx = (x - 380) / 700;
    const dy = (y - 180) / 700;
    const d2 = dx * dx + dy * dy;
    const lift = Math.max(0, 7 * (1 - Math.min(1, d2)));
    // Soft vignette: darken the far corners slightly.
    const vx = (x - 512) / 640;
    const vy = (y - 512) / 640;
    const v2 = vx * vx + vy * vy;
    const dim = Math.max(0, v2 - 0.55) * 14;
    put(x, y, [
      Math.max(0, Math.min(255, Math.round(c[0] + lift - dim))),
      Math.max(0, Math.min(255, Math.round(c[1] + lift - dim))),
      Math.max(0, Math.min(255, Math.round(c[2] + lift - dim))),
    ]);
  }
}
// Faint cove seam where wall meets floor.
for (let x = 0; x < W; x++) {
  blend(x, HORIZON, [200, 200, 197], 0.18);
  blend(x, HORIZON + 1, [200, 200, 197], 0.1);
}

// --- Cable shadow on the floor (drawn before the cable itself). ------------
function cubic(
  p0: number[],
  p1: number[],
  p2: number[],
  p3: number[],
  t: number,
): number[] {
  const u = 1 - t;
  const x =
    u * u * u * p0[0] +
    3 * u * u * t * p1[0] +
    3 * u * t * t * p2[0] +
    t * t * t * p3[0];
  const y =
    u * u * u * p0[1] +
    3 * u * u * t * p1[1] +
    3 * u * t * t * p2[1] +
    t * t * t * p3[1];
  return [x, y];
}

// Cable path: from the plug at the pebble's right side, draping down
// to the bottom edge, exiting the frame.
const C0 = [840, 591];
const C1 = [955, 612];
const C2 = [978, 795];
const C3 = [888, 1014];
for (let i = 0; i <= 220; i++) {
  const t = i / 220;
  const [x, y] = cubic(C0, C1, C2, C3, t);
  // Only where the cord lies over the floor: a shadow in mid-air would
  // read as a second cord.
  if (y < 805) continue;
  discBlend(Math.round(x + 18), Math.round(y + 20), 11, BLACK, 0.05);
}

// --- Soft shadow under the pebble. ------------------------------------------
const SH_CX = 470;
const SH_CY = 794;
const SH_RX = 345;
const SH_RY = 30;
for (let y = SH_CY - SH_RY - 6; y <= SH_CY + SH_RY + 6; y++) {
  for (let x = SH_CX - SH_RX - 6; x <= SH_CX + SH_RX + 6; x++) {
    const nx = (x - SH_CX) / SH_RX;
    const ny = (y - SH_CY) / SH_RY;
    const s = nx * nx + ny * ny;
    if (s < 1) {
      const a = 0.26 * Math.pow(1 - s, 1.4);
      blend(x, y, BLACK, a);
    }
  }
}
// Darker contact shadow right where the stone meets the floor.
const CT_RX = 295;
const CT_RY = 17;
for (let y = SH_CY - CT_RY; y <= SH_CY + CT_RY; y++) {
  for (let x = SH_CX - CT_RX; x <= SH_CX + CT_RX; x++) {
    const nx = (x - SH_CX) / CT_RX;
    const ny = (y - SH_CY) / CT_RY;
    const s = nx * nx + ny * ny;
    if (s < 1) {
      const a = 0.3 * Math.pow(1 - s, 1.8);
      blend(x, y, BLACK, a);
    }
  }
}

// --- The cable itself: thick white cord with a sheen and a shaded edge. ----
for (let i = 0; i <= 240; i++) {
  const t = i / 240;
  const [x, y] = cubic(C0, C1, C2, C3, t);
  disc(Math.round(x), Math.round(y), 12, CABLE);
}
for (let i = 0; i <= 240; i++) {
  const t = i / 240;
  const [x, y] = cubic(C0, C1, C2, C3, t);
  // Sheen along the upper edge, shade along the lower edge.
  disc(Math.round(x - 3), Math.round(y - 4), 2, WHITE);
  disc(Math.round(x + 3), Math.round(y + 5), 2, CABLE_SHADE);
}

// --- The pebble: a smooth superellipse stone, polished like ceramic. -------
const PB_CX = 470;
const PB_CY = 580;
const PB_A = 320;
const PB_B = 195;
const PB_N = 2.6; // superellipse exponent: pebble, not circle
const HL_X = PB_CX - 118;
const HL_Y = PB_CY - 92;

function superS(nx: number, ny: number): number {
  return Math.pow(Math.pow(Math.abs(nx), PB_N) + Math.pow(Math.abs(ny), PB_N), 1 / PB_N);
}

for (let y = PB_CY - PB_B - 2; y <= PB_CY + PB_B + 2; y++) {
  for (let x = PB_CX - PB_A - 2; x <= PB_CX + PB_A + 2; x++) {
    const nx = (x - PB_CX) / PB_A;
    const ny = (y - PB_CY) / PB_B;
    const s = superS(nx, ny);
    if (s > 1) continue;
    // Base gradient: light from the top-left, darker toward the bottom.
    const light = 1 - 0.5 * (nx * 0.55 + ny * 0.85);
    const t = Math.max(0, Math.min(1, light));
    let c = mix(STONE_BOT, STONE_TOP, t);
    // Polished specular highlight, top-left.
    const hdx = (x - HL_X) / 95;
    const hdy = (y - HL_Y) / 70;
    const hd2 = hdx * hdx + hdy * hdy;
    const hot = Math.exp(-hd2 * 2.2) * 0.85;
    c = mix(c, WHITE, Math.min(1, hot));
    // Tight hot spot inside the highlight.
    const h2 = Math.exp(-hd2 * 7) * 0.55;
    c = mix(c, WHITE, Math.min(1, h2));
    // Rounded-edge darkening near the rim (ambient occlusion).
    if (s > 0.86) {
      const rim = (s - 0.86) / 0.14;
      c = mix(c, STONE_EDGE, rim * 0.45);
    }
    // Thin bright rim where the key light catches the top-left edge.
    if (s > 0.96 && nx < -0.35 && ny < -0.15) {
      c = mix(c, WHITE, 0.22);
    }
    // Whisper of stone grain: deterministic, barely visible.
    const grain = Math.sin(x * 0.31 + y * 0.17) * Math.sin(x * 0.07 - y * 0.11);
    const g = Math.round(grain * 1.0);
    put(x, y, [
      Math.max(0, Math.min(255, c[0] + g)),
      Math.max(0, Math.min(255, c[1] + g)),
      Math.max(0, Math.min(255, c[2] + g)),
    ]);
  }
}

// --- USB-C port: a dark recessed pill slot on the pebble's right side. ------
const PORT_CY = 591;
const PORT_X0 = 714;
const PORT_X1 = 776;
// Metal rim of the port housing.
disc(PORT_X0 + 13, PORT_CY, 14, METAL_DARK);
disc(PORT_X1 - 13, PORT_CY, 14, METAL_DARK);
rect(PORT_X0 + 13, PORT_CY - 14, PORT_X1 - PORT_X0 - 26, 28, METAL_DARK);
// Dark opening.
disc(PORT_X0 + 13, PORT_CY, 11, PORT_DARK);
disc(PORT_X1 - 13, PORT_CY, 11, PORT_DARK);
rect(PORT_X0 + 13, PORT_CY - 11, PORT_X1 - PORT_X0 - 26, 22, PORT_DARK);
// Inner cavity.
disc(PORT_X0 + 15, PORT_CY, 8, PORT_INNER);
disc(PORT_X1 - 15, PORT_CY, 8, PORT_INNER);
rect(PORT_X0 + 15, PORT_CY - 8, PORT_X1 - PORT_X0 - 30, 16, PORT_INNER);
// Metal tongue inside the port.
rect(PORT_X0 + 22, PORT_CY - 3, PORT_X1 - PORT_X0 - 44, 7, [190, 194, 201]);

// --- USB-C plug: white housing, metal tip seated in the port. ---------------
// Metal tip (inserted into the port).
rect(764, PORT_CY - 7, 16, 14, METAL);
rect(764, PORT_CY - 7, 16, 2, [205, 208, 214]);
rect(764, PORT_CY + 5, 16, 2, METAL_DARK);
// White plug housing.
disc(786, PORT_CY, 12, CABLE);
disc(838, PORT_CY, 12, CABLE);
rect(786, PORT_CY - 12, 52, 24, CABLE);
// Plug outline and seam.
disc(786, PORT_CY, 12, CABLE_LINE);
disc(838, PORT_CY, 12, CABLE_LINE);
rect(786, PORT_CY - 12, 52, 1, CABLE_LINE);
rect(786, PORT_CY + 11, 52, 1, CABLE_LINE);
// Re-fill the housing interior so only a thin outline remains.
disc(786, PORT_CY, 10, CABLE);
disc(838, PORT_CY, 10, CABLE);
rect(786, PORT_CY - 10, 52, 20, CABLE);
// Seam across the plug where the two halves meet.
for (let y = PORT_CY - 9; y <= PORT_CY + 9; y++) put(818, y, CABLE_LINE);

// --- LED: small amber glow below the port — the stone is "charging". --------
const LED_X = 718;
const LED_Y = 650;
discBlend(LED_X, LED_Y, 24, LED, 0.12);
discBlend(LED_X, LED_Y, 15, LED, 0.22);
discBlend(LED_X, LED_Y, 9, LED, 0.45);
disc(LED_X, LED_Y, 6, LED);
disc(LED_X, LED_Y, 2, LED_CORE);

// --- Product name, printed small on the stone itself. -----------------------
drawText(331, 656, 'Pebble', 3, TEXT_LIGHT); // engraved highlight offset
drawText(330, 655, 'Pebble', 3, TEXT_DARK);

// ---------------------------------------------------------------------------
// Write the file.
// ---------------------------------------------------------------------------
const outDir = process.env.MAKEFUN_OUTPUT_DIR || '/output';
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'entry.png');
fs.writeFileSync(outPath, encodePng());
const st = fs.statSync(outPath);
console.log(`wrote ${outPath} ${st.size} bytes`);
