/**
 * JARVIS DCS PWA Icon Generator
 *
 * Generates all required PWA icons using sharp.
 * Run: node apps/web/scripts/generate-icons.mjs
 *
 * Output:
 *   public/icons/icon-192x192.png       -- standard 192x192
 *   public/icons/icon-512x512.png       -- standard 512x512
 *   public/icons/icon-maskable-512x512.png -- maskable 512x512 (J in safe zone)
 *   public/icons/apple-touch-icon.png   -- Apple touch 180x180
 */

import { fileURLToPath } from 'url'
import { dirname, resolve, join } from 'path'
import { mkdirSync } from 'fs'
import { createRequire } from 'module'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// sharp lives in pnpm virtual store under the web app's node_modules
// Use createRequire pointing at the web app package.json so pnpm resolution works
const webAppDir = resolve(__dirname, '..')
const require = createRequire(join(webAppDir, 'package.json'))

let sharp
try {
  // Try standard resolution first (works if sharp is linked at top-level)
  sharp = require('sharp')
} catch {
  // Fallback: resolve directly from pnpm virtual store
  const sharpPath = join(
    webAppDir,
    'node_modules/.pnpm/sharp@0.34.5/node_modules/sharp'
  )
  sharp = require(sharpPath)
}

const OUTPUT_DIR = resolve(__dirname, '../public/icons')
mkdirSync(OUTPUT_DIR, { recursive: true })

/**
 * Generate an icon SVG buffer.
 * @param {number} size - Icon dimension (square)
 * @param {number} fontSize - Font size for the "J" letter
 */
function buildSvg(size, fontSize) {
  return Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${size}" height="${size}" fill="#010a1a"/>
  <text
    x="50%"
    y="55%"
    text-anchor="middle"
    dominant-baseline="middle"
    font-family="monospace"
    font-size="${fontSize}"
    font-weight="bold"
    fill="#00ffff"
  >J</text>
</svg>`)
}

const icons = [
  {
    filename: 'icon-192x192.png',
    size: 192,
    // 60% of height -- standard icon sizing
    fontSize: Math.round(192 * 0.6),
    description: 'Standard 192x192 PWA icon',
  },
  {
    filename: 'icon-512x512.png',
    size: 512,
    // 60% of height -- standard icon sizing
    fontSize: Math.round(512 * 0.6),
    description: 'Standard 512x512 PWA icon',
  },
  {
    filename: 'icon-maskable-512x512.png',
    size: 512,
    // 50% of height -- stays within center 80% safe zone (outer 10% may be cropped by OS)
    fontSize: Math.round(512 * 0.5),
    description: 'Maskable 512x512 PWA icon (J in safe zone)',
  },
  {
    filename: 'apple-touch-icon.png',
    size: 180,
    // 60% of height -- standard icon sizing
    fontSize: Math.round(180 * 0.6),
    description: 'Apple touch icon 180x180',
  },
]

async function generateIcons() {
  console.log('Generating JARVIS DCS PWA icons...\n')

  for (const icon of icons) {
    const outputPath = join(OUTPUT_DIR, icon.filename)
    const svg = buildSvg(icon.size, icon.fontSize)

    await sharp(svg)
      .png()
      .toFile(outputPath)

    console.log(`  [OK] ${icon.filename} (${icon.size}x${icon.size}) -- ${icon.description}`)
  }

  console.log('\nAll icons generated successfully.')
  console.log(`Output: ${OUTPUT_DIR}`)
}

generateIcons().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
