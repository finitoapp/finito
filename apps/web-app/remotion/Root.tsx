import {
  frameBodyHeight as FRAME_BODY_HEIGHT,
  frameBodyWidth as FRAME_BODY_WIDTH,
} from "@payky/doc-mockups/phone-frame-geometry"
import type { FC } from "react"
import { Composition, staticFile } from "remotion"
import type { CaptionTimelineFile } from "../scripts/video/captions.ts"
import { ScenarioVideo, scenarioVideoSchema } from "./ScenarioVideo.tsx"

const FPS = 30
const WIDTH = 630
// Matches the phone body's own aspect ratio (not the full frame artwork,
// which has margin around the body for its drop shadow), so the frame fills
// the composition with no cropping and no empty margin around it.
const HEIGHT = Math.round((WIDTH * FRAME_BODY_HEIGHT) / FRAME_BODY_WIDTH)
// How much of the real first cue's lead-in to keep when trimming away the
// boring app-loading time at the start of the recording.
const LEAD_IN_MS = 400
const LANGUAGE = "cs"

/** One <Composition> per scenario name recorded by generate-doc-videos.ts. */
const scenarioNames = ["payment", "bill"] as const

export const RemotionRoot: FC = () => {
  return (
    <>
      {scenarioNames.map((name) => (
        <Composition
          key={name}
          id={`${name}-${LANGUAGE}`}
          component={ScenarioVideo}
          schema={scenarioVideoSchema}
          fps={FPS}
          width={WIDTH}
          height={HEIGHT}
          durationInFrames={FPS * 6}
          defaultProps={{
            videoSrc: staticFile(`generated/${LANGUAGE}/${name}.webm`),
            timelineSrc: staticFile(
              `generated/${LANGUAGE}/${name}.captions.json`
            ),
            timeline: null,
            trimBeforeMs: 0,
          }}
          calculateMetadata={async ({ props }) => {
            const response = await fetch(props.timelineSrc)
            const timeline = (await response.json()) as CaptionTimelineFile
            const firstCueStart = timeline.cues[0]?.startMs ?? 0
            const trimBeforeMs = Math.max(0, firstCueStart - LEAD_IN_MS)

            return {
              durationInFrames: Math.max(
                1,
                Math.ceil(((timeline.durationMs - trimBeforeMs) / 1000) * FPS)
              ),
              props: { ...props, timeline, trimBeforeMs },
            }
          }}
        />
      ))}
    </>
  )
}
