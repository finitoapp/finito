import phoneFrame from "@payky/doc-mockups/phone-frame.svg"
import {
  computeFramedContentLayout,
  frameBodyHeight as FRAME_BODY_HEIGHT,
  frameBodyLeft as FRAME_BODY_LEFT,
  frameBodyTop as FRAME_BODY_TOP,
  frameBodyWidth as FRAME_BODY_WIDTH,
  frameHeight as FRAME_HEIGHT,
  frameScreenHeight as FRAME_SCREEN_HEIGHT,
  frameScreenLeft as FRAME_SCREEN_LEFT,
  frameScreenCornerRadius as FRAME_SCREEN_RADIUS,
  frameScreenTop as FRAME_SCREEN_TOP,
  frameScreenWidth as FRAME_SCREEN_WIDTH,
  frameWidth as FRAME_WIDTH,
} from "@payky/doc-mockups/phone-frame-geometry"
import type { FC } from "react"
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  useCurrentFrame,
  useVideoConfig,
} from "remotion"
import { z } from "zod"
import { pageHeight, pageWidth } from "../e2e/support/viewport.ts"
import type { CaptionTimelineFile } from "../scripts/video/captions.ts"

// A real zod schema (rather than a plain interface) is what lets
// <Composition>'s generics resolve to this exact prop shape — see Root.tsx.
// `timeline` isn't user-editable in Remotion Studio (calculateMetadata
// fetches it programmatically), so it's typed but not structurally
// validated at runtime.
export const scenarioVideoSchema = z.object({
  videoSrc: z.string(),
  timelineSrc: z.string(),
  timeline: z.custom<CaptionTimelineFile | null>(),
  // How much of the raw recording's start (the app-loading dead time) is
  // trimmed off — see Root.tsx's calculateMetadata. Captions are timed
  // against the raw recording, so this also shifts the comparison forward.
  trimBeforeMs: z.number(),
})

export type ScenarioVideoProps = z.infer<typeof scenarioVideoSchema>

const CAPTION_FADE_MS = 200
// TODO: temporarily hidden, flip back to true to re-enable captions.
const SHOW_CAPTIONS = false

// Same placement generate-doc-screenshots.ts derives for the static
// mockups: full width, no cropping of real content, top/bottom padding
// sized from the same content insets. Every scenario shares the same
// captured viewport size, so this is shared across scenarios too.
const videoLayout = computeFramedContentLayout(pageWidth, pageHeight)

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value))
}

export const ScenarioVideo: FC<ScenarioVideoProps> = ({
  videoSrc,
  timeline,
  trimBeforeMs,
}) => {
  const frame = useCurrentFrame()
  const { fps, width, height } = useVideoConfig()
  // "cover" the canvas with the phone body's own bounding box (not the full
  // frame artwork, which has margin around the body for its drop shadow) —
  // width- or height-bound, whichever needs more zoom — so the body fills
  // the video edge to edge with no empty margin around it.
  const scale = Math.max(width / FRAME_BODY_WIDTH, height / FRAME_BODY_HEIGHT)
  const frameLeft =
    -FRAME_BODY_LEFT * scale + (width - FRAME_BODY_WIDTH * scale) / 2
  const frameTop =
    -FRAME_BODY_TOP * scale + (height - FRAME_BODY_HEIGHT * scale) / 2
  const trimBeforeFrames = Math.round((trimBeforeMs / 1000) * fps)
  // Cue timestamps are relative to the raw (untrimmed) recording, so shift
  // the current position forward by the trimmed lead to compare correctly.
  const nowMs = (frame / fps) * 1000 + trimBeforeMs

  const activeCue =
    timeline?.cues.find((cue) => nowMs >= cue.startMs && nowMs < cue.endMs) ??
    null
  const captionOpacity = activeCue
    ? clamp01(
        Math.min(
          (nowMs - activeCue.startMs) / CAPTION_FADE_MS,
          (activeCue.endMs - nowMs) / CAPTION_FADE_MS
        )
      )
    : 0

  const cutoutLeft = frameLeft + FRAME_SCREEN_LEFT * scale
  const cutoutTop = frameTop + FRAME_SCREEN_TOP * scale
  const cutoutWidth = FRAME_SCREEN_WIDTH * scale
  const cutoutHeight = FRAME_SCREEN_HEIGHT * scale

  return (
    <AbsoluteFill style={{ backgroundColor: "#101314", overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: cutoutTop,
          left: cutoutLeft,
          width: cutoutWidth,
          height: cutoutHeight,
          borderRadius: FRAME_SCREEN_RADIUS * scale,
          overflow: "hidden",
        }}
      >
        <OffthreadVideo
          src={videoSrc}
          muted
          trimBefore={trimBeforeFrames}
          style={{
            position: "absolute",
            left: videoLayout.leftFraction * cutoutWidth,
            top: videoLayout.topFraction * cutoutHeight,
            width: videoLayout.widthFraction * cutoutWidth,
            height: videoLayout.heightFraction * cutoutHeight,
          }}
        />

        {SHOW_CAPTIONS && (
          <div
            style={{
              position: "absolute",
              top: "50%",
              left: 0,
              right: 0,
              transform: "translateY(-50%)",
              textAlign: "center",
              opacity: captionOpacity,
            }}
          >
            <span
              style={{
                display: "inline-block",
                padding: "10px 18px",
                borderRadius: 999,
                backgroundColor: "rgba(16, 19, 20, 0.78)",
                color: "white",
                fontFamily: "system-ui, sans-serif",
                fontSize: 26,
                fontWeight: 600,
              }}
            >
              {activeCue?.text ?? ""}
            </span>
          </div>
        )}
      </div>

      <Img
        src={phoneFrame}
        style={{
          position: "absolute",
          top: frameTop,
          left: frameLeft,
          width: FRAME_WIDTH * scale,
          height: FRAME_HEIGHT * scale,
        }}
      />
    </AbsoluteFill>
  )
}
