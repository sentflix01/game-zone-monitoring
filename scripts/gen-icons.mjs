/**
 * Icon generation script.
 * Reads public/icon-512.svg and outputs PNG icons for:
 *   - Electron  → build/icons/
 *   - Android   → android/app/src/main/res/
 *   - iOS       → ios/App/App/Assets.xcassets/AppIcon.appiconset/
 *   - Web/PWA   → public/
 */

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const SRC_SVG = 'public/icon-512.svg';

// ── Helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function png(size, dest) {
  ensureDir(path.dirname(dest));
  await sharp(SRC_SVG).resize(size, size).png().toFile(dest);
  console.log(`  ✓ ${dest} (${size}px)`);
}

// ── Electron icons ────────────────────────────────────────────────────────────

async function genElectron() {
  console.log('\nElectron icons → build/icons/');
  const sizes = [16, 32, 48, 64, 128, 256, 512, 1024];
  for (const s of sizes) {
    await png(s, `build/icons/${s}x${s}.png`);
  }
  // Main icon used by electron-builder
  await png(512, 'build/icons/icon.png');
}

// ── Android adaptive icons ────────────────────────────────────────────────────

async function genAndroid() {
  console.log('\nAndroid icons → android/app/src/main/res/');
  const densities = [
    { dir: 'mipmap-mdpi',    size: 48  },
    { dir: 'mipmap-hdpi',    size: 72  },
    { dir: 'mipmap-xhdpi',   size: 96  },
    { dir: 'mipmap-xxhdpi',  size: 144 },
    { dir: 'mipmap-xxxhdpi', size: 192 },
  ];
  const base = 'android/app/src/main/res';
  for (const { dir, size } of densities) {
    await png(size, `${base}/${dir}/ic_launcher.png`);
    await png(size, `${base}/${dir}/ic_launcher_round.png`);
  }
  // Foreground layer for adaptive icons
  for (const { dir, size } of densities) {
    await png(size, `${base}/${dir}/ic_launcher_foreground.png`);
  }
}

// ── iOS icons ─────────────────────────────────────────────────────────────────

async function genIos() {
  console.log('\niOS icons → ios/App/App/Assets.xcassets/AppIcon.appiconset/');
  const dir = 'ios/App/App/Assets.xcassets/AppIcon.appiconset';
  const sizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];
  for (const s of sizes) {
    await png(s, `${dir}/icon-${s}.png`);
  }

  // Write Contents.json so Xcode recognises the icons
  const contents = {
    images: [
      { idiom: 'iphone', scale: '2x', size: '20x20',   filename: 'icon-40.png'   },
      { idiom: 'iphone', scale: '3x', size: '20x20',   filename: 'icon-60.png'   },
      { idiom: 'iphone', scale: '2x', size: '29x29',   filename: 'icon-58.png'   },
      { idiom: 'iphone', scale: '3x', size: '29x29',   filename: 'icon-87.png'   },
      { idiom: 'iphone', scale: '2x', size: '40x40',   filename: 'icon-80.png'   },
      { idiom: 'iphone', scale: '3x', size: '40x40',   filename: 'icon-120.png'  },
      { idiom: 'iphone', scale: '2x', size: '60x60',   filename: 'icon-120.png'  },
      { idiom: 'iphone', scale: '3x', size: '60x60',   filename: 'icon-180.png'  },
      { idiom: 'ipad',   scale: '1x', size: '20x20',   filename: 'icon-20.png'   },
      { idiom: 'ipad',   scale: '2x', size: '20x20',   filename: 'icon-40.png'   },
      { idiom: 'ipad',   scale: '1x', size: '29x29',   filename: 'icon-29.png'   },
      { idiom: 'ipad',   scale: '2x', size: '29x29',   filename: 'icon-58.png'   },
      { idiom: 'ipad',   scale: '1x', size: '40x40',   filename: 'icon-40.png'   },
      { idiom: 'ipad',   scale: '2x', size: '40x40',   filename: 'icon-80.png'   },
      { idiom: 'ipad',   scale: '1x', size: '76x76',   filename: 'icon-76.png'   },
      { idiom: 'ipad',   scale: '2x', size: '76x76',   filename: 'icon-152.png'  },
      { idiom: 'ipad',   scale: '2x', size: '83.5x83.5', filename: 'icon-167.png' },
      { idiom: 'ios-marketing', scale: '1x', size: '1024x1024', filename: 'icon-1024.png' },
    ],
    info: { author: 'xcode', version: 1 },
  };
  fs.writeFileSync(`${dir}/Contents.json`, JSON.stringify(contents, null, 2));
  console.log(`  ✓ ${dir}/Contents.json`);
}

// ── Web/PWA icons ─────────────────────────────────────────────────────────────

async function genWeb() {
  console.log('\nWeb/PWA icons → public/');
  await png(192, 'public/icon-192.png');
  await png(512, 'public/icon-512.png');
  await png(180, 'public/apple-touch-icon.png');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  if (!fs.existsSync(SRC_SVG)) {
    console.error(`Source SVG not found: ${SRC_SVG}`);
    process.exit(1);
  }
  console.log(`Generating icons from ${SRC_SVG}...`);
  await genElectron();
  if (fs.existsSync('android')) await genAndroid();
  if (fs.existsSync('ios')) await genIos();
  await genWeb();
  console.log('\nDone.');
}

main().catch((err) => { console.error(err); process.exit(1); });
