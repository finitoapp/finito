/**
 * Geometry shared between the screenshot mockup compositor
 * (compose-mockup.ts, via sharp) and the web app's video mockup composition
 * (remotion/ScenarioVideo.tsx, via CSS) so both frame their captures
 * identically. Keep this the single source of truth for these numbers
 * instead of duplicating them.
 */

// The viewport, in CSS pixels, every app's screenshots and videos are
// captured at, so their mockups share one layout.
export const captureWidth = 406
export const captureHeight = 818

// Screenshots are captured at this pixel density for crispness; the ratio
// math below is scale-invariant, but the absolute inset pixel amounts
// (contentTopInset/contentBottomInset) are expressed at this scale.
export const deviceScaleFactor = 3.5
export const outputWidth = 1260

// Padding added above/below the raw capture before it's fit into the
// frame's screen cutout, sized so the "cover" fit below only ever crops
// into this padding — never into the real captured content.
export const contentTopInset = Math.round(60 * deviceScaleFactor)
export const contentBottomInset = Math.round(38 * deviceScaleFactor)

// Native size of phone-frame.svg and the screen cutout inside it, in the
// frame artwork's own coordinate space.
export const frameWidth = 1164
export const frameHeight = 2044
export const frameScreenLeft = 202
export const frameScreenTop = 201
export const frameScreenWidth = 760
export const frameScreenHeight = 1629
export const frameScreenCornerRadius = 80

// Tight bounding box of the visible phone body within the frame artwork
// (frameWidth x frameHeight above), i.e. excluding the drop-shadow's
// margin — derived once from the body path/button rects in
// phone-frame.svg, plus a little padding so the shadow isn't
// clipped hard. Only the video composition uses this: it wants the frame to
// fill its canvas edge to edge, whereas the screenshot mockup keeps the
// shadow's margin on purpose (reads better as a standalone image).
export const frameBodyLeft = 177
export const frameBodyTop = 168
export const frameBodyWidth = 819
export const frameBodyHeight = 1695

export interface FramedContentLayout {
  /** Fraction of frameScreenWidth, relative to the cutout's left edge. */
  readonly leftFraction: number
  /** Fraction of frameScreenHeight, relative to the cutout's top edge. */
  readonly topFraction: number
  readonly widthFraction: number
  readonly heightFraction: number
}

/**
 * Replicates compose-mockup.ts's composeMockup pipeline
 * (resize to outputWidth, pad top/bottom by the content insets, "cover"-fit
 * into the screen cutout) algebraically, so any renderer can place a
 * `contentWidth x contentHeight` capture inside the cutout the same way,
 * without going through actual image resizing.
 */
export function computeFramedContentLayout(
  contentWidth: number,
  contentHeight: number
): FramedContentLayout {
  const canvasWidth = outputWidth
  const scaledContentHeight = Math.round(
    (contentHeight / contentWidth) * outputWidth
  )
  const canvasHeight =
    contentTopInset + scaledContentHeight + contentBottomInset

  const coverScale = Math.max(
    frameScreenWidth / canvasWidth,
    frameScreenHeight / canvasHeight
  )
  const scaledCanvasWidth = canvasWidth * coverScale
  const scaledCanvasHeight = canvasHeight * coverScale
  const cropLeft = (scaledCanvasWidth - frameScreenWidth) / 2
  const cropTop = (scaledCanvasHeight - frameScreenHeight) / 2

  return {
    leftFraction: -cropLeft / frameScreenWidth,
    topFraction: (contentTopInset * coverScale - cropTop) / frameScreenHeight,
    widthFraction: scaledCanvasWidth / frameScreenWidth,
    heightFraction: (scaledContentHeight * coverScale) / frameScreenHeight,
  }
}
