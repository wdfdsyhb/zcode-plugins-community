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
import { COLORS, FONTS, FONT_STACKS, GRADIENT, SAFE } from "../shared";

export const SCENE_RENDER_DURATION = 120;

/**
 * Render progress ring 0 -> 100%, milestone sparks,
 * then a flip to a materializing demo.mp4 file card.
 */

const PROGRESS_START = 10;
const PROGRESS_END = 78;
const PROGRESS_EASING = Easing.bezier(0.42, 0, 0.3, 1);
const CARD_AT = 84;

const RING_SIZE = 360;
const RING_R = 150;
const RING_C = 2 * Math.PI * RING_R;

const progress = (f: number) =>
  interpolate(f, [PROGRESS_START, PROGRESS_END], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: PROGRESS_EASING,
  });

// Frames at which progress crosses each milestone (deterministic)
const MILESTONES = [0.25, 0.5, 0.75].map((value) => ({
  value,
  frame: (() => {
    for (let f = PROGRESS_START; f <= PROGRESS_END; f++) {
      if (progress(f) >= value) return f;
    }
    return PROGRESS_END;
  })(),
}));

// Frames at which progress crosses each 10% step, for the counting pulse
const TEN_STEPS = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1].map(
  (value) => ({
    value,
    frame: (() => {
      for (let f = PROGRESS_START; f <= PROGRESS_END; f++) {
        if (progress(f) >= value) return f;
      }
      return PROGRESS_END;
    })(),
  })
);

// +/-3% scale pulse right after each 10% step is crossed
const milestonePulse = (f: number) => {
  for (let i = TEN_STEPS.length - 1; i >= 0; i--) {
    if (f >= TEN_STEPS[i].frame) {
      const age = f - TEN_STEPS[i].frame;
      if (age > 10) return 0;
      return Math.sin((age / 10) * Math.PI) * 0.03;
    }
  }
  return 0;
};

const FilmIcon: React.FC = () => (
  <svg width={44} height={44} viewBox="0 0 24 24" fill="none">
    <rect x={2.5} y={4} width={19} height={16} rx={2.5} stroke="#07070C" strokeWidth={1.9} />
    <rect x={6.5} y={8} width={11} height={8} rx={1} stroke="#07070C" strokeWidth={1.6} />
    <rect x={4.4} y={6.2} width={1.4} height={1.8} fill="#07070C" />
    <rect x={4.4} y={10.1} width={1.4} height={1.8} fill="#07070C" />
    <rect x={4.4} y={14} width={1.4} height={1.8} fill="#07070C" />
    <rect x={18.2} y={6.2} width={1.4} height={1.8} fill="#07070C" />
    <rect x={18.2} y={10.1} width={1.4} height={1.8} fill="#07070C" />
    <rect x={18.2} y={14} width={1.4} height={1.8} fill="#07070C" />
  </svg>
);

export const SceneRender: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const p = progress(frame);
  const pct = Math.round(p * 100);
  const done = frame >= PROGRESS_END;

  // Ring group flips out, file card flips in
  const ringSquash = interpolate(frame, [PROGRESS_END, CARD_AT], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const ringOpacity = interpolate(frame, [PROGRESS_END, CARD_AT], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const cardSquash = interpolate(frame, [CARD_AT, CARD_AT + 9], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.3, 0.64, 1),
  });
  const cardPop = spring({ frame: frame - CARD_AT, fps, config: { damping: 12 } });
  const popScale = interpolate(cardPop, [0, 1], [0.92, 1]);
  const burst = interpolate(frame, [CARD_AT - 2, CARD_AT + 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.16, 1, 0.3, 1),
  });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDeep }}>
      <Background />

      {/* Kicker */}
      <div
        style={{
          position: "absolute",
          top: SAFE,
          left: SAFE,
          opacity: interpolate(frame, [0, 10], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
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
          04 / RENDER
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
          渲染成片
        </div>
      </div>

      {/* Progress ring group */}
      <AbsoluteFill
        style={{
          justifyContent: "center",
          alignItems: "center",
          opacity: ringOpacity,
          scale: `${ringSquash} 1`,
        }}
      >
        <div style={{ position: "relative", width: RING_SIZE, height: RING_SIZE }}>
          <svg width={RING_SIZE} height={RING_SIZE} style={{ rotate: "-90deg", display: "block" }}>
            <defs>
              <linearGradient id="renderRing" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor={COLORS.cyan} />
                <stop offset="50%" stopColor={COLORS.violet} />
                <stop offset="100%" stopColor={COLORS.magenta} />
              </linearGradient>
            </defs>
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={12}
            />
            <circle
              cx={RING_SIZE / 2}
              cy={RING_SIZE / 2}
              r={RING_R}
              fill="none"
              stroke="url(#renderRing)"
              strokeWidth={12}
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={RING_C * (1 - p)}
              style={{
                filter: `drop-shadow(0 0 ${interpolate(frame, [PROGRESS_END - 6, PROGRESS_END + 6], [10, 34], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                })}px rgba(139, 92, 246, 0.75))`,
              }}
            />
          </svg>

          {/* Milestone sparks */}
          {MILESTONES.map((m, i) => {
            const age = frame - m.frame;
            if (age < 0 || age > 18) return null;
            const angle = -90 + 360 * m.value;
            const rad = (angle * Math.PI) / 180;
            const cx = RING_SIZE / 2 + Math.cos(rad) * RING_R;
            const cy = RING_SIZE / 2 + Math.sin(rad) * RING_R;
            const fade = interpolate(age, [0, 4, 18], [0, 1, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            });
            return (
              <div key={i}>
                <div
                  style={{
                    position: "absolute",
                    left: cx,
                    top: cy,
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: "#FFFFFF",
                    translate: "-50% -50%",
                    opacity: fade,
                    boxShadow: "0 0 18px rgba(255, 255, 255, 0.95)",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    left: cx,
                    top: cy,
                    width: 64,
                    height: 64,
                    borderRadius: "50%",
                    border: `2px solid ${COLORS.cyan}`,
                    translate: "-50% -50%",
                    opacity: fade * 0.8,
                    scale: interpolate(age, [0, 18], [0.2, 1.6], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                  }}
                />
              </div>
            );
          })}

          {/* Percentage (pulses on each 10% milestone) */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              gap: 8,
              scale: `${1 + milestonePulse(frame)} ${1 + milestonePulse(frame)}`,
            }}
          >
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 110,
                fontWeight: 700,
                color: COLORS.textPrimary,
                fontVariantNumeric: "tabular-nums",
                textShadow: "0 0 36px rgba(139, 92, 246, 0.45)",
              }}
            >
              {pct}
            </div>
            <div
              style={{
                fontFamily: FONTS.mono,
                fontSize: 48,
                fontWeight: 500,
                color: COLORS.textSecondary,
                marginBottom: 14,
              }}
            >
              %
            </div>
          </div>
        </div>
        <div
          style={{
            marginTop: 34,
            fontFamily: FONTS.chinese,
            fontSize: 30,
            letterSpacing: 4,
            color: COLORS.textSecondary,
          }}
        >
          正在渲染 690 帧
        </div>
      </AbsoluteFill>

      {/* File card */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        {/* Glow burst */}
        <div
          style={{
            position: "absolute",
            width: 560,
            height: 560,
            borderRadius: "50%",
            background: `radial-gradient(circle, rgba(34, 211, 238, 0.5) 0%, rgba(139, 92, 246, 0.35) 35%, transparent 70%)`,
            scale: interpolate(burst, [0, 1], [0.2, 2.1]),
            opacity: interpolate(frame, [CARD_AT - 2, CARD_AT + 8, CARD_AT + 24], [0, 0.95, 0], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            filter: "blur(6px)",
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 34,
            padding: "44px 56px",
            borderRadius: 26,
            backgroundColor: "rgba(12, 12, 22, 0.95)",
            border: `1px solid ${COLORS.border}`,
            boxShadow: `0 40px 110px rgba(0, 0, 0, 0.6), 0 0 ${interpolate(cardPop, [0, 1], [0, 60])}px rgba(139, 92, 246, ${interpolate(cardPop, [0, 1], [0, 0.4])})`,
            opacity: interpolate(frame, [CARD_AT, CARD_AT + 4], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            scale: `${cardSquash * popScale} ${popScale}`,
          }}
        >
          <div
            style={{
              width: 104,
              height: 104,
              borderRadius: 24,
              background: GRADIENT,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              boxShadow: `0 0 ${interpolate(cardPop, [0, 1], [8, 44])}px rgba(34, 211, 238, 0.55)`,
            }}
          >
            <FilmIcon />
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div
              style={{
                fontFamily: FONTS.display,
                fontSize: 52,
                fontWeight: 700,
                color: COLORS.textPrimary,
                letterSpacing: 1,
              }}
            >
              demo.mp4
            </div>
            <div
              style={{
                fontFamily: FONT_STACKS.mono,
                fontSize: 23,
                color: COLORS.textSecondary,
                letterSpacing: 2,
              }}
            >
              1920×1080 · 30fps · H.264
            </div>
            <div
              style={{
                marginTop: 4,
                display: "flex",
                alignItems: "center",
                gap: 9,
                opacity: interpolate(frame, [CARD_AT + 12, CARD_AT + 22], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              <svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <circle cx={12} cy={12} r={10} stroke={COLORS.cyan} strokeWidth={2} />
                <path d="M8 12.5l2.6 2.6L16 9.6" stroke={COLORS.cyan} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span
                style={{
                  fontFamily: FONTS.chinese,
                  fontSize: 21,
                  color: COLORS.cyan,
                }}
              >
                {done ? "渲染完成" : "渲染中"}
              </span>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
