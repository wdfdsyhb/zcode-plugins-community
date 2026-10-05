import React from "react";
import {
  AbsoluteFill,
  Easing,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Background } from "../components/Background";
import { COLORS, FONTS, FONT_STACKS, GRADIENT, SAFE, VIDEO_FRAMES } from "../shared";

export const SCENE_TIMELINE_DURATION = 150;

/**
 * Bottom-heavy timeline UI: 4 scene blocks, an eased playhead sweep,
 * staggered floating labels and a frame counter ticking 0 -> 690.
 */

const SWEEP_START = 18;
const SWEEP_END = 122;
const SWEEP_EASING = Easing.bezier(0.5, 0, 0.5, 1);

const TRACK_X = SAFE;
const TRACK_W = 1920 - SAFE * 2;
const TRACK_GAP = 16;
const BLOCK_H = 140;

type Block = {
  label: string;
  en: string;
  frames: number;
  range: string;
  color: string;
  rgba: (alpha: number) => string;
  chip: string;
};

const BLOCKS: Block[] = [
  {
    label: "提示词",
    en: "PROMPT",
    frames: 135,
    range: "0–135f",
    color: COLORS.cyan,
    rgba: (a) => `rgba(34, 211, 238, ${a})`,
    chip: "一句话输入",
  },
  {
    label: "代码",
    en: "CODE",
    frames: 150,
    range: "135–285f",
    color: COLORS.violet,
    rgba: (a) => `rgba(139, 92, 246, ${a})`,
    chip: "生成 React 代码",
  },
  {
    label: "时间线",
    en: "TIMELINE",
    frames: 150,
    range: "285–435f",
    color: COLORS.magenta,
    rgba: (a) => `rgba(232, 121, 249, ${a})`,
    chip: "编排 690 帧",
  },
  {
    label: "渲染",
    en: "RENDER",
    frames: 120,
    range: "435–555f",
    color: COLORS.magenta,
    rgba: (a) => `rgba(232, 121, 249, ${a})`,
    chip: "输出 demo.mp4",
  },
];

const TOTAL_BLOCK_FRAMES = BLOCKS.reduce((sum, b) => sum + b.frames, 0);
const USABLE_W = TRACK_W - TRACK_GAP * (BLOCKS.length - 1);

const GEOMETRY = (() => {
  let x = TRACK_X;
  return BLOCKS.map((block) => {
    const w = (block.frames / TOTAL_BLOCK_FRAMES) * USABLE_W;
    const rect = { x, w, center: x + w / 2 };
    x += w + TRACK_GAP;
    return rect;
  });
})();

const playheadX = (f: number) =>
  interpolate(f, [SWEEP_START, SWEEP_END], [TRACK_X, TRACK_X + TRACK_W], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: SWEEP_EASING,
  });

// Exact frame at which the playhead crosses each block start (deterministic)
const CROSS_FRAMES = GEOMETRY.map((g) => {
  for (let f = SWEEP_START; f <= SWEEP_END; f++) {
    if (playheadX(f) >= g.x) return f;
  }
  return SWEEP_END;
});

const RULER_Y = 525;
const BLOCK_Y = RULER_Y + 34;

// Ruler ticks every 30 frames (major every 150)
const TICKS: { f: number; major: boolean }[] = (() => {
  const ticks: { f: number; major: boolean }[] = [];
  for (let f = 0; f <= VIDEO_FRAMES; f += 30) {
    ticks.push({ f, major: f % 150 === 0 });
  }
  return ticks;
})();

const tickX = (f: number) => TRACK_X + (f / VIDEO_FRAMES) * TRACK_W;

const pad3 = (n: number) => ("00" + Math.max(0, Math.min(999, n))).slice(-3);

export const SceneTimeline: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const px = playheadX(frame);
  const frameCount = Math.round(
    interpolate(frame, [SWEEP_START, SWEEP_END], [0, VIDEO_FRAMES], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: SWEEP_EASING,
    })
  );

  // Panel entrance
  const panelIn = spring({ frame: frame - 2, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDeep }}>
      <Background />

      {/* Kicker */}
      <div
        style={{
          position: "absolute",
          top: SAFE,
          left: SAFE,
          opacity: interpolate(panelIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
          translate: interpolate(panelIn, [0, 1], ["0px -16px", "0px 0px"]),
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 17,
            letterSpacing: 5,
            color: COLORS.textSecondary,
          }}
        >
          03 / TIMELINE
        </div>
        <div
          style={{
            marginTop: 10,
            fontFamily: FONTS.chinese,
            fontSize: 34,
            fontWeight: 500,
            color: COLORS.textPrimary,
          }}
        >
          自动编排时间线
        </div>
        <div
          style={{
            marginTop: 12,
            fontFamily: FONTS.chinese,
            fontSize: 22,
            color: COLORS.textSecondary,
          }}
        >
          四个场景，一次渲染
        </div>
      </div>

      {/* Frame counter */}
      <div
        style={{
          position: "absolute",
          top: SAFE - 8,
          right: SAFE,
          textAlign: "right",
          opacity: interpolate(frame, [4, 14], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 92,
            fontWeight: 700,
            lineHeight: 1,
            color: COLORS.textPrimary,
            fontVariantNumeric: "tabular-nums",
            textShadow: `0 0 30px rgba(139, 92, 246, ${interpolate(frame, [SWEEP_START, SWEEP_END], [0.05, 0.45], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })})`,
          }}
        >
          {pad3(frameCount)}
        </div>
        <div
          style={{
            marginTop: 6,
            fontFamily: FONT_STACKS.mono,
            fontSize: 17,
            color: COLORS.textSecondary,
            letterSpacing: 3,
          }}
        >
          帧 / {VIDEO_FRAMES} FRAMES
        </div>
      </div>

      {/* Ruler */}
      <div style={{ position: "absolute", top: RULER_Y, left: 0, width: "100%" }}>
        {TICKS.map((tick, i) => {
          const x = tickX(tick.f);
          const passed = x <= px;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: x,
                top: tick.major ? 0 : 6,
                width: 1.5,
                height: tick.major ? 20 : 12,
                backgroundColor: passed
                  ? "rgba(255, 255, 255, 0.55)"
                  : "rgba(255, 255, 255, 0.16)",
              }}
            />
            );
        })}
        {TICKS.filter((t) => t.major).map((tick, i) => (
          <div
            key={`l${i}`}
            style={{
              position: "absolute",
              left: tickX(tick.f) + 8,
              top: 2,
              fontFamily: FONTS.mono,
              fontSize: 14,
              color: COLORS.textDim,
            }}
          >
            {tick.f}f
          </div>
        ))}
        {/* Elapsed baseline */}
        <div
          style={{
            position: "absolute",
            left: TRACK_X,
            top: 28,
            height: 2,
            width: px - TRACK_X,
            background: GRADIENT,
            boxShadow: "0 0 14px rgba(34, 211, 238, 0.5)",
            borderRadius: 1,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: TRACK_X,
            top: 28,
            height: 2,
            width: TRACK_W,
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderRadius: 1,
          }}
        />
      </div>

      {/* Scene blocks */}
      {BLOCKS.map((block, i) => {
        const g = GEOMETRY[i];
        const cross = CROSS_FRAMES[i];
        const entered = spring({
          frame: frame - (6 + i * 4),
          fps,
          config: { damping: 15 },
        });
        const lift = spring({
          frame: frame - cross,
          fps,
          config: { damping: 12 },
        });
        const proximity = interpolate(Math.abs(px - g.center), [0, 280], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        const isGradient = i === BLOCKS.length - 1;
        return (
          <div key={i}>
            {/* Floating mini-label */}
            <div
              style={{
                position: "absolute",
                left: g.center,
                top: RULER_Y - 58,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                opacity: interpolate(lift, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
                scale: interpolate(lift, [0, 1], [0.6, 1]),
                translate: interpolate(lift, [0, 1], ["-50% 14px", "-50% 0px"]),
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.chinese,
                  fontSize: 21,
                  fontWeight: 500,
                  color: block.color,
                  whiteSpace: "nowrap",
                  padding: "9px 18px",
                  borderRadius: 999,
                  backgroundColor: block.rgba(0.1),
                  border: `1px solid ${block.rgba(0.45)}`,
                  boxShadow: `0 0 ${8 + proximity * 26}px ${block.rgba(0.35)}`,
                }}
              >
                {block.chip}
              </div>
              <div
                style={{
                  width: 1.5,
                  height: 16,
                  backgroundColor: block.rgba(0.5),
                  marginTop: 4,
                }}
              />
            </div>

            {/* Block */}
            <div
              style={{
                position: "absolute",
                left: g.x,
                top: BLOCK_Y,
                width: g.w,
                height: BLOCK_H,
                borderRadius: 16,
                background: isGradient
                  ? `linear-gradient(135deg, rgba(34, 211, 238, 0.16), rgba(139, 92, 246, 0.18), rgba(232, 121, 249, 0.2))`
                  : block.rgba(0.14),
                border: `1px solid ${block.rgba(0.45)}`,
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
                alignItems: "center",
                gap: 6,
                opacity: interpolate(entered, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
                translate: `0px ${
                  interpolate(entered, [0, 1], [40, 0]) +
                  interpolate(lift, [0, 1], [0, -10])
                }px`,
                scale: interpolate(entered, [0, 1], [0.9, 1]) * (1 + proximity * 0.015),
                boxShadow: `0 0 ${10 + proximity * 44}px ${block.rgba(interpolate(
                  proximity,
                  [0, 1],
                  [0.08, 0.5]
                ))}, 0 18px 50px rgba(0, 0, 0, 0.45)`,
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.chinese,
                  fontSize: 38,
                  fontWeight: 500,
                  color: COLORS.textPrimary,
                }}
              >
                {block.label}
              </div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 16,
                  letterSpacing: 2,
                  color: COLORS.textSecondary,
                }}
              >
                {block.en} {block.range}
              </div>
            </div>
          </div>
        );
      })}

      {/* Playhead */}
      <div
        style={{
          position: "absolute",
          left: px,
          top: RULER_Y - 18,
          width: 3,
          height: BLOCK_Y + BLOCK_H - RULER_Y + 26,
          translate: "-50% 0%",
          background: GRADIENT,
          borderRadius: 2,
          boxShadow: "0 0 20px rgba(34, 211, 238, 0.8), 0 0 46px rgba(139, 92, 246, 0.5)",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -6,
            left: "50%",
            translate: "-50% 0%",
            width: 0,
            height: 0,
            borderLeft: "9px solid transparent",
            borderRight: "9px solid transparent",
            borderTop: `12px solid ${COLORS.cyan}`,
            filter: `drop-shadow(0 0 8px ${COLORS.cyan})`,
          }}
        />
      </div>

      {/* Bottom meta */}
      <div
        style={{
          position: "absolute",
          bottom: SAFE - 26,
          width: "100%",
          textAlign: "center",
          fontFamily: FONT_STACKS.mono,
          fontSize: 18,
          letterSpacing: 2,
          color: COLORS.textDim,
          opacity: interpolate(frame, [10, 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        ZCodeRemotionDemo · 1920×1080 · 30fps · 690 frames
      </div>
    </AbsoluteFill>
  );
};
