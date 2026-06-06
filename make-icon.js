const sharp = require('sharp');
const path = require('path');

const INPUT = path.join(require('os').homedir(), 'Downloads/rayan-cherki-manchester-city-premier-league-france-french-footballers-footballers-uniqrenders.com.png');
const BG_COLOR = { r: 108, g: 171, b: 221 }; // #6CABDD Man City blue
const OUTLINE_PX = 8;

function toRad(deg) { return deg * Math.PI / 180; }

// Returns [x, y] at `dist` from center, `angleDeg` clockwise from 12 o'clock
function pt(cx, cy, dist, angleDeg) {
  const a = toRad(angleDeg - 90);
  return [cx + dist * Math.cos(a), cy + dist * Math.sin(a)];
}

function clockSVG(size) {
  const cx = size / 2;
  const cy = size / 2;
  const s = size / 512; // scale factor

  const clockR   = Math.round(200 * s);
  const borderW  = Math.round(40  * s);
  const tickOut  = Math.round(175 * s); // tick outer edge (just inside border)
  const tickMaj  = Math.round(148 * s); // major tick inner edge
  const tickMin  = Math.round(162 * s); // minor tick inner edge
  const numR     = Math.round(128 * s); // number radius
  const fontSize = Math.round(38  * s);
  const hourLen  = Math.round(118 * s);
  const hourBack = Math.round(18  * s);
  const hourW    = Math.round(18  * s);
  const minLen   = Math.round(158 * s);
  const minBack  = Math.round(12  * s);
  const minW     = Math.round(11  * s);
  const secLen   = Math.round(166 * s);
  const secBack  = Math.round(42  * s);
  const secW     = Math.round(4   * s);
  const dotR     = Math.round(13  * s);
  const dotInner = Math.round(6   * s);

  const lines = [
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`,
    // Clock face
    `  <circle cx="${cx}" cy="${cy}" r="${clockR}" fill="white" stroke="black" stroke-width="${borderW}"/>`,
  ];

  // Tick marks at all 12 positions
  for (let h = 0; h < 12; h++) {
    const deg = h * 30;
    const [ox, oy] = pt(cx, cy, tickOut, deg);
    const isMajor = h % 3 === 0;
    const [ix, iy] = pt(cx, cy, isMajor ? tickMaj : tickMin, deg);
    const w = isMajor ? Math.round(7 * s) : Math.round(3.5 * s);
    lines.push(`  <line x1="${ox.toFixed(1)}" y1="${oy.toFixed(1)}" x2="${ix.toFixed(1)}" y2="${iy.toFixed(1)}" stroke="black" stroke-width="${w}" stroke-linecap="round"/>`);
  }

  // Numbers: 12, 3, 6, 9
  for (const [n, deg] of [['12', 0], ['3', 90], ['6', 180], ['9', 270]]) {
    const [x, y] = pt(cx, cy, numR, deg);
    lines.push(`  <text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="central" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="${fontSize}" fill="black">${n}</text>`);
  }

  // Hour hand — ~10h = 300° clockwise from 12
  const [hx, hy]   = pt(cx, cy,  hourLen,  300);
  const [hbx, hby] = pt(cx, cy, -hourBack, 300);
  lines.push(`  <line x1="${hbx.toFixed(1)}" y1="${hby.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}" stroke="black" stroke-width="${hourW}" stroke-linecap="round"/>`);

  // Minute hand — 12h = 0°
  const [mx, my]   = pt(cx, cy,  minLen,  0);
  const [mbx, mby] = pt(cx, cy, -minBack, 0);
  lines.push(`  <line x1="${mbx.toFixed(1)}" y1="${mby.toFixed(1)}" x2="${mx.toFixed(1)}" y2="${my.toFixed(1)}" stroke="black" stroke-width="${minW}" stroke-linecap="round"/>`);

  // Second hand — 12h = 0°, red, thin
  const [sx, sy]   = pt(cx, cy,  secLen,  0);
  const [sbx, sby] = pt(cx, cy, -secBack, 0);
  lines.push(`  <line x1="${sbx.toFixed(1)}" y1="${sby.toFixed(1)}" x2="${sx.toFixed(1)}" y2="${sy.toFixed(1)}" stroke="#ED1C24" stroke-width="${secW}" stroke-linecap="round"/>`);

  // Center dot
  lines.push(`  <circle cx="${cx}" cy="${cy}" r="${dotR}" fill="black"/>`);
  lines.push(`  <circle cx="${cx}" cy="${cy}" r="${dotInner}" fill="#ED1C24"/>`);

  lines.push(`</svg>`);
  return Buffer.from(lines.join('\n'));
}

async function makeIcon(size) {
  // 1. Full body resize with transparent padding
  const resized = await sharp(INPUT)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // 2. Extract alpha and dilate for white outline
  const { data: alphaData, info: alphaInfo } = await sharp(resized)
    .extractChannel('alpha')
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: dilatedAlpha } = await sharp(alphaData, {
    raw: { width: alphaInfo.width, height: alphaInfo.height, channels: 1 },
  })
    .blur(OUTLINE_PX)
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 3. White halo layer from dilated alpha
  const whiteRaw = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    whiteRaw[i * 4]     = 255;
    whiteRaw[i * 4 + 1] = 255;
    whiteRaw[i * 4 + 2] = 255;
    whiteRaw[i * 4 + 3] = dilatedAlpha[i];
  }
  const whiteSilhouette = await sharp(whiteRaw, {
    raw: { width: size, height: size, channels: 4 },
  }).png().toBuffer();

  // 4. Composite: blue bg → clock → white halo → player
  const composite = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: BG_COLOR.r, g: BG_COLOR.g, b: BG_COLOR.b, alpha: 255 } },
  })
    .composite([
      { input: clockSVG(size) },
      { input: whiteSilhouette },
      { input: resized },
    ])
    .flatten({ background: BG_COLOR })
    .png()
    .toBuffer();

  // 5. Rounded corners
  const radius = Math.round(size * 0.18);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}">
      <rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`
  );

  await sharp(composite)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(path.join(__dirname, `icon-${size}.png`));

  console.log(`✅ icon-${size}.png créé`);
}

(async () => {
  await makeIcon(512);
  await makeIcon(192);
})();
