import { Buffer } from "node:buffer"
import sharp from "sharp"
import {
  terminalOutputCornerRadius,
  terminalOutputWidth,
} from "./terminal-geometry.ts"
import { terminalShotHeight, terminalShotWidth } from "./terminal-shots.ts"

const outputHeight = Math.round(
  (terminalShotHeight / terminalShotWidth) * terminalOutputWidth
)

const cornerMask = Buffer.from(`
  <svg xmlns="http://www.w3.org/2000/svg" width="${terminalOutputWidth}" height="${outputHeight}" viewBox="0 0 ${terminalOutputWidth} ${outputHeight}">
    <rect width="${terminalOutputWidth}" height="${outputHeight}" rx="${terminalOutputCornerRadius}" fill="#ffffff"/>
  </svg>
`)

/**
 * Turns one raw capture of the terminal's display (terminal-geometry.ts)
 * into the documentation's image: no phone frame, only the screen with
 * rounded corners, scaled down to `terminalOutputWidth` and kept as WebP
 * alone, at a quality where the app's text stays sharp.
 */
export async function composeTerminalShot({
  rawPath,
  outputPath,
}: {
  readonly rawPath: string
  readonly outputPath: string
}): Promise<void> {
  const raw = await sharp(rawPath).metadata()

  if (raw.width !== terminalShotWidth || raw.height !== terminalShotHeight) {
    throw new Error(
      `Expected ${rawPath} to be ${terminalShotWidth}x${terminalShotHeight}, received ${raw.width}x${raw.height}.`
    )
  }

  const screen = await sharp(rawPath)
    .resize({ width: terminalOutputWidth, height: outputHeight })
    .ensureAlpha()
    .composite([{ input: cornerMask, blend: "dest-in" }])
    .png()
    .toBuffer()

  await sharp(screen)
    .webp({ quality: 90, alphaQuality: 100, smartSubsample: true })
    .toFile(outputPath)
}
