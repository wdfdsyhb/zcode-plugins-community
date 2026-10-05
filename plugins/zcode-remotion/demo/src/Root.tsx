import React from "react";
import { Composition, Folder } from "remotion";
import { ZCodeRemotionDemo } from "./ZCodeRemotionDemo";
import { ScenePrompt, SCENE_PROMPT_DURATION } from "./scenes/ScenePrompt";
import { SceneCode, SCENE_CODE_DURATION } from "./scenes/SceneCode";
import { SceneTimeline, SCENE_TIMELINE_DURATION } from "./scenes/SceneTimeline";
import { SceneRender, SCENE_RENDER_DURATION } from "./scenes/SceneRender";
import { SceneOutro, SCENE_OUTRO_DURATION } from "./scenes/SceneOutro";
import {
  FPS,
  TRANSITION_DURATION,
  VIDEO_FRAMES,
  VIDEO_HEIGHT,
  VIDEO_WIDTH,
} from "./shared";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Folder name="Scenes">
        <Composition
          id="ScenePrompt"
          component={ScenePrompt}
          durationInFrames={SCENE_PROMPT_DURATION + TRANSITION_DURATION}
          fps={FPS}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
        />
        <Composition
          id="SceneCode"
          component={SceneCode}
          durationInFrames={SCENE_CODE_DURATION + TRANSITION_DURATION}
          fps={FPS}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
        />
        <Composition
          id="SceneTimeline"
          component={SceneTimeline}
          durationInFrames={SCENE_TIMELINE_DURATION + TRANSITION_DURATION}
          fps={FPS}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
        />
        <Composition
          id="SceneRender"
          component={SceneRender}
          durationInFrames={SCENE_RENDER_DURATION + TRANSITION_DURATION}
          fps={FPS}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
        />
        <Composition
          id="SceneOutro"
          component={SceneOutro}
          durationInFrames={SCENE_OUTRO_DURATION}
          fps={FPS}
          width={VIDEO_WIDTH}
          height={VIDEO_HEIGHT}
        />
      </Folder>
      <Composition
        id="ZCodeRemotionDemo"
        component={ZCodeRemotionDemo}
        durationInFrames={VIDEO_FRAMES}
        fps={FPS}
        width={VIDEO_WIDTH}
        height={VIDEO_HEIGHT}
      />
    </>
  );
};
