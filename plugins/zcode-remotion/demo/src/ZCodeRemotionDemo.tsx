import React from "react";
import { AbsoluteFill } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Vignette } from "./components/Vignette";
import { ScenePrompt, SCENE_PROMPT_DURATION } from "./scenes/ScenePrompt";
import { SceneCode, SCENE_CODE_DURATION } from "./scenes/SceneCode";
import { SceneTimeline, SCENE_TIMELINE_DURATION } from "./scenes/SceneTimeline";
import { SceneRender, SCENE_RENDER_DURATION } from "./scenes/SceneRender";
import { SceneOutro, SCENE_OUTRO_DURATION } from "./scenes/SceneOutro";
import { COLORS, TRANSITION_DURATION, VIDEO_FRAMES } from "./shared";

/**
 * 一句话，一部片 — the video shows ITSELF being made.
 *
 * Scene budgets: 135 + 150 + 150 + 120 + 135 = 690 visible frames.
 * TransitionSeries shortens the timeline by the transition overlaps, so the
 * first four sequences carry 12 extra tail frames (their held end state plays
 * under the incoming scene's fade-in). Total:
 *   (135+12) + (150+12) + (150+12) + (120+12) + 135 - 4*12 = 690 frames.
 */
export const ZCodeRemotionDemo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDeep }}>
      <TransitionSeries>
        <TransitionSeries.Sequence
          durationInFrames={SCENE_PROMPT_DURATION + TRANSITION_DURATION}
          name="Prompt"
        >
          <ScenePrompt />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        <TransitionSeries.Sequence
          durationInFrames={SCENE_CODE_DURATION + TRANSITION_DURATION}
          name="Code"
        >
          <SceneCode />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        <TransitionSeries.Sequence
          durationInFrames={SCENE_TIMELINE_DURATION + TRANSITION_DURATION}
          name="Timeline"
        >
          <SceneTimeline />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        <TransitionSeries.Sequence
          durationInFrames={SCENE_RENDER_DURATION + TRANSITION_DURATION}
          name="Render"
        >
          <SceneRender />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_DURATION })}
        />

        <TransitionSeries.Sequence
          durationInFrames={SCENE_OUTRO_DURATION}
          name="Outro"
        >
          <SceneOutro />
        </TransitionSeries.Sequence>
      </TransitionSeries>
      <Vignette />
    </AbsoluteFill>
  );
};

export const ZCODE_DEMO_TOTAL_FRAMES =
  SCENE_PROMPT_DURATION +
  TRANSITION_DURATION +
  SCENE_CODE_DURATION +
  TRANSITION_DURATION +
  SCENE_TIMELINE_DURATION +
  TRANSITION_DURATION +
  SCENE_RENDER_DURATION +
  TRANSITION_DURATION +
  SCENE_OUTRO_DURATION -
  4 * TRANSITION_DURATION; // = VIDEO_FRAMES (690)

if (ZCODE_DEMO_TOTAL_FRAMES !== VIDEO_FRAMES) {
  throw new Error(
    `Scene durations add up to ${ZCODE_DEMO_TOTAL_FRAMES}, expected ${VIDEO_FRAMES}`
  );
}
