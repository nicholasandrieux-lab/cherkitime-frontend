const sharp = require('sharp');
const path = require('path');

const INPUT = path.join(require('os').homedir(), 'Downloads/rayan-cherki-manchester-city-premier-league-france-french-footballers-footballers-uniqrenders.com.png');
const BG_COLOR = { r: 108, g: 171, b: 221 }; // #6CABDD Man City blue

async function makeIcon(size) {
  const meta = await sharp(INPUT).metadata();
  const srcW = meta.width;
  const srcH = meta.height;

  // Crop the top portion (bust/head) — take the top 60% of the image
  const cropH = Math.round(srcH * 0.60);
  const cropped = sharp(INPUT).extract({ left: 0, top: 0, width: srcW, height: cropH });

  // Fit inside the icon with the MC blue background
  const icon = await cropped
    .resize(size, size, { fit: 'contain', background: BG_COLOR })
    .flatten({ background: BG_COLOR })
    .toBuffer();

  // Rounded corners mask
  const radius = Math.round(size * 0.18);
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="white"/>
    </svg>`
  );

  await sharp(icon)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toFile(path.join(__dirname, `icon-${size}.png`));

  console.log(`✅ icon-${size}.png créé`);
}

(async () => {
  await makeIcon(512);
  await makeIcon(192);
})();
