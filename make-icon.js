const sharp = require('sharp');
const path = require('path');

const INPUT = path.join(require('os').homedir(), 'Downloads/rayan-cherki-manchester-city-premier-league-france-french-footballers-footballers-uniqrenders.com.png');
const BG_COLOR = { r: 108, g: 171, b: 221 }; // #6CABDD Man City blue
const OUTLINE_PX = 8;

async function makeIcon(size) {
  // 1. Full body — fit entire player inside the square, centered, transparent padding
  const resized = await sharp(INPUT)
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  // 2. Extract alpha and dilate it to create the white halo shape
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

  // 3. Build a white RGBA layer using the dilated alpha as transparency mask
  const whiteRaw = Buffer.alloc(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    whiteRaw[i * 4]     = 255; // R
    whiteRaw[i * 4 + 1] = 255; // G
    whiteRaw[i * 4 + 2] = 255; // B
    whiteRaw[i * 4 + 3] = dilatedAlpha[i]; // A from dilated mask
  }
  const whiteSilhouette = await sharp(whiteRaw, {
    raw: { width: size, height: size, channels: 4 },
  }).png().toBuffer();

  // 4. Composite: blue bg → white halo → player
  const composite = await sharp({
    create: { width: size, height: size, channels: 4, background: { r: BG_COLOR.r, g: BG_COLOR.g, b: BG_COLOR.b, alpha: 255 } },
  })
    .composite([
      { input: whiteSilhouette },
      { input: resized },
    ])
    .flatten({ background: BG_COLOR })
    .png()
    .toBuffer();

  // 5. Rounded corners mask
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
