const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

// ClueTube icon SVG - magnifying glass with YouTube play button inside, playful style
const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" width="128" height="128">
  <!-- Dark rounded background -->
  <rect width="128" height="128" rx="22" fill="#1a1a2e"/>

  <!-- Magnifying glass lens ring -->
  <circle cx="50" cy="50" r="30" fill="none" stroke="#00d4aa" stroke-width="8"/>

  <!-- Red YouTube-style circle inside lens -->
  <circle cx="50" cy="50" r="20" fill="#ff3333"/>

  <!-- White play triangle inside red circle -->
  <polygon points="42,40 42,60 65,50" fill="white"/>

  <!-- Magnifying glass handle -->
  <line x1="72" y1="72" x2="100" y2="100" stroke="#00d4aa" stroke-width="11" stroke-linecap="round"/>

  <!-- Playful sparkle dots -->
  <circle cx="24" cy="24" r="3" fill="#ffd700" opacity="0.8"/>
  <circle cx="18" cy="38" r="2" fill="#00d4aa" opacity="0.7"/>
  <circle cx="36" cy="16" r="2" fill="#ff6b6b" opacity="0.7"/>
</svg>`;

const svgIconTransparent = svgIcon.replace('<rect width="128" height="128" rx="22" fill="#1a1a2e"/>', '');

const sizes = [16, 48, 128];
const outputDir = path.join(__dirname, 'assets', 'icons');

if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

(async () => {
  for (const size of sizes) {
    const outPath = path.join(outputDir, `icon${size}.png`);
    await sharp(Buffer.from(svgIcon))
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`✅ Generated: icon${size}.png`);
  }

  // Generate transparent version for the popup
  const outPathTransparent = path.join(outputDir, `icon48-transparent.png`);
  await sharp(Buffer.from(svgIconTransparent))
    .resize(48, 48)
    .png()
    .toFile(outPathTransparent);
  console.log(`✅ Generated: icon48-transparent.png`);

  console.log('\n🎉 All ClueTube icons generated successfully!');
})();
