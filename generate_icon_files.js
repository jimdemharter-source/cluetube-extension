const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const svg = `<svg width="128" height="128" viewBox="0 0 128 128" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#1a1c2e"/>
      <stop offset="100%" stop-color="#0c0d18"/>
    </linearGradient>
    <linearGradient id="shieldGrad" x1="0" y1="0" x2="0.6" y2="1">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
    <linearGradient id="shieldShine" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="rgba(255,255,255,0.18)"/>
      <stop offset="100%" stop-color="rgba(255,255,255,0)"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="5" flood-color="#1D4ED8" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Dark background -->
  <rect x="0" y="0" width="128" height="128" rx="24" fill="url(#bgGrad)"/>

  <!-- Shield body — large, centered, fills the canvas -->
  <path d="M 64 10 L 112 28 L 112 68 Q 112 102 64 120 Q 16 102 16 68 L 16 28 Z"
        fill="url(#shieldGrad)" filter="url(#shadow)"/>

  <!-- Shield inner shine -->
  <path d="M 64 18 L 104 33 L 104 68 Q 104 96 64 112 Q 64 112 64 112 L 64 18 Z"
        fill="url(#shieldShine)"/>

  <!-- Bold checkmark -->
  <polyline points="42,66 57,82 86,48"
            fill="none" stroke="white" stroke-width="11"
            stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const sizes = [16, 48, 128];
const assetsDir = path.join(__dirname, 'assets', 'icons');

if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

Promise.all(sizes.map(size => {
  return sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(path.join(assetsDir, `icon${size}.png`))
    .then(() => console.log(`Generated icon${size}.png`));
})).then(() => {
  console.log("All icons generated!");
}).catch(err => {
  console.error(err);
});
