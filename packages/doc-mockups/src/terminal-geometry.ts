import { terminalShotHeight, terminalShotWidth } from "./terminal-shots.ts"

/**
 * How Finito's card terminal documentation (terminal-shots.ts) is captured:
 * the NEXGO N92's display, 720×1600 pixels, as a 405×900 CSS-pixel viewport
 * at a device pixel ratio of 16/9, so a raw capture is exactly the
 * terminal's resolution. A ratio of 2 (360×800) drew the screens larger than
 * the terminal shows them; 16/9 matches what it looks like on the device.
 *
 * TODO: confirm the ratio on the device with `adb shell wm density` (a
 * density of 284 dpi is a ratio of 16/9); a different one changes the CSS
 * viewport, not the raw size.
 */
export const terminalDeviceScaleFactor = 16 / 9
export const terminalCaptureWidth =
  terminalShotWidth / terminalDeviceScaleFactor
export const terminalCaptureHeight =
  terminalShotHeight / terminalDeviceScaleFactor

/** The width a shot is kept at in the documentation, in pixels. */
export const terminalOutputWidth = 600

/** The rounding of the screen's corners at `terminalOutputWidth`. */
export const terminalOutputCornerRadius = 28
