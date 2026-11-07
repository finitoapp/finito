import {
  captureHeight,
  captureWidth,
} from "@payky/doc-mockups/phone-frame-geometry"

/**
 * Split out of fixtures.ts so non-Playwright consumers (the Remotion video
 * composition) can import the viewport size without pulling in
 * @playwright/test — Remotion bundles for the browser, and playwright-core
 * doesn't resolve there. The size is the documentation captures' one, so the
 * screenshots and videos the specs' helpers drive frame like every app's.
 */
export const pageWidth = captureWidth
export const pageHeight = captureHeight
