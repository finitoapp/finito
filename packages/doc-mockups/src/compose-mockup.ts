import { Buffer } from "node:buffer"
import { fileURLToPath } from "node:url"
import sharp from "sharp"
import {
  captureHeight,
  captureWidth,
  contentBottomInset,
  contentTopInset,
  deviceScaleFactor,
  frameHeight,
  frameScreenCornerRadius,
  frameScreenHeight,
  frameScreenLeft,
  frameScreenTop,
  frameScreenWidth,
  frameWidth,
  outputWidth,
} from "./phone-frame-geometry.ts"

/**
 * The screens an app's documentation screenshots show, by file name. An app
 * captures the ones it has; the landing and the Zapstore listings name them.
 */
export type ShotName =
  | "home"
  | "payment"
  | "paid"
  | "settings"
  | "bill"
  | "tables"
  | "table-bill"
  | "items"
  | "split"
  | "stats"
  | "stats-charts"

const framePath = fileURLToPath(new URL("./phone-frame.svg", import.meta.url))
const capturedWidth = captureWidth * deviceScaleFactor
const capturedHeight = captureHeight * deviceScaleFactor
const appScreenshotHeight = Math.round(
  (capturedHeight / capturedWidth) * outputWidth
)
const outputHeight = contentTopInset + appScreenshotHeight + contentBottomInset

function createFrameScreenMask(): Buffer {
  return Buffer.from(`
    <svg xmlns="http://www.w3.org/2000/svg" width="${frameScreenWidth}" height="${frameScreenHeight}" viewBox="0 0 ${frameScreenWidth} ${frameScreenHeight}">
      <rect width="${frameScreenWidth}" height="${frameScreenHeight}" rx="${frameScreenCornerRadius}" fill="#ffffff"/>
    </svg>
  `)
}

/**
 * Turns one raw capture, taken at the capture viewport and
 * `deviceScaleFactor`, into the two images the documentation keeps: the
 * screenshot (the capture padded top and bottom with `background`, the app's
 * dark background, as a phone screen) and the mockup (that screenshot in the
 * phone frame).
 */
export async function composeMockup({
  rawPath,
  screenshotPath,
  mockupPath,
  background,
}: {
  readonly rawPath: string
  readonly screenshotPath: string
  readonly mockupPath: string
  readonly background: string
}): Promise<void> {
  const raw = await sharp(rawPath).metadata()

  if (raw.width !== capturedWidth || raw.height !== capturedHeight) {
    throw new Error(
      `Expected ${rawPath} to be ${capturedWidth}x${capturedHeight}, received ${raw.width}x${raw.height}.`
    )
  }

  const appScreenshot = await sharp(rawPath)
    .resize({ width: outputWidth })
    .toBuffer()

  const phoneScreenshot = await sharp({
    create: {
      width: outputWidth,
      height: outputHeight,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: appScreenshot,
        top: contentTopInset,
        left: 0,
      },
    ])
    .png()
    .toBuffer()

  await sharp(phoneScreenshot).png().toFile(screenshotPath)

  const frameScreenshot = await sharp(phoneScreenshot)
    .resize({
      width: frameScreenWidth,
      height: frameScreenHeight,
      fit: "cover",
      position: "centre",
    })
    .toBuffer()

  const clippedFrameScreenshot = await sharp(frameScreenshot)
    .ensureAlpha()
    .composite([{ input: createFrameScreenMask(), blend: "dest-in" }])
    .png()
    .toBuffer()

  await sharp({
    create: {
      width: frameWidth,
      height: frameHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([
      {
        input: clippedFrameScreenshot,
        top: frameScreenTop,
        left: frameScreenLeft,
      },
      { input: framePath, top: 0, left: 0 },
    ])
    .webp({ lossless: true })
    .toFile(mockupPath)
}
