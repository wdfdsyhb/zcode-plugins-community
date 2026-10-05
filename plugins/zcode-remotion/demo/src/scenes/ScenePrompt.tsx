import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Background } from "../components/Background";
import { COLORS, FONTS, GRADIENT } from "../shared";

export const SCENE_PROMPT_DURATION = 135;

const PROMPT_TEXT = "帮我做一个10秒的产品宣传视频";

// Variable 2-4 frame delay per character (deterministic)
const CHAR_DELAYS = [3, 2, 3, 2, 4, 2, 2, 3, 2, 3, 4, 2, 3, 2, 3];

// Cumulative frame offset at which each character appears
const CHAR_STARTS: number[] = (() => {
  const starts: number[] = [];
  let acc = 0;
  for (const delay of CHAR_DELAYS) {
    starts.push(acc);
    acc += delay;
  }
  return starts;
})();

const TYPING_START = 16;
const SEND_PULSE = 62;
const BUBBLE_MOVE = 78;
const WORDMARK_START = 88;
const SHIMMER_START = 110;

const WORDMARK_LETTERS = ["Z", "C", "O", "D", "E"];
const LETTER_STAGGER = 3;

const ChatIcon: React.FC = () => (
  <svg width={34} height={34} viewBox="0 0 24 24" fill="none">
    <path
      d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H9l-4.2 3.4c-.5.4-1.3 0-1.3-.6V5.5Z"
      stroke={COLORS.textSecondary}
      strokeWidth={1.6}
      strokeLinejoin="round"
    />
    <circle cx={8.6} cy={9.5} r={1} fill={COLORS.textSecondary} />
    <circle cx={12} cy={9.5} r={1} fill={COLORS.textSecondary} />
    <circle cx={15.4} cy={9.5} r={1} fill={COLORS.textSecondary} />
  </svg>
);

const SendIcon: React.FC = () => (
  <svg width={26} height={26} viewBox="0 0 24 24" fill="none">
    <path
      d="M5 12h13M13 6.5 18.5 12 13 17.5"
      stroke="#07070C"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export const ScenePrompt: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const visibleChars = CHAR_STARTS.filter(
    (start) => frame >= TYPING_START + start
  ).length;
  const typedText = PROMPT_TEXT.slice(0, visibleChars);
  const typingDone = frame >= TYPING_START + CHAR_STARTS[CHAR_STARTS.length - 1] + 2;

  const cursorOn = Math.floor(frame / 7) % 2 === 0;

  // Bubble entrance
  const bubbleIn = spring({ frame: frame - 8, fps, config: { damping: 16 } });
  // Send button pulse
  const pulse = interpolate(frame, [SEND_PULSE, SEND_PULSE + 5, SEND_PULSE + 10, SEND_PULSE + 14], [1, 1.18, 0.94, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const sendGlow = interpolate(frame, [SEND_PULSE, SEND_PULSE + 8, SEND_PULSE + 16], [0, 1, 0.55], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  // Bubble springs up-left after sending
  const move = spring({ frame: frame - BUBBLE_MOVE, fps, config: { damping: 13, stiffness: 110 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDeep }}>
      <Background fadeInFrames={26} starDrift={0.02} />

      {/* Ambient gradient halo behind the bubble (soft cyan -> violet, breathing) */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            position: "absolute",
            width: 1150,
            height: 720,
            borderRadius: "50%",
            background:
              "radial-gradient(ellipse at 50% 50%, rgba(34, 211, 238, 0.22) 0%, rgba(139, 92, 246, 0.16) 42%, transparent 72%)",
            filter: "blur(42px)",
            opacity:
              interpolate(frame, [10, 32], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }) *
              (0.82 + 0.18 * Math.sin(frame * 0.07)),
            scale: `${1 + 0.045 * Math.sin(frame * 0.055)} ${1 + 0.045 * Math.sin(frame * 0.055)}`,
          }}
        />
      </AbsoluteFill>

      {/* Chat bubble */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 22,
            width: 940,
            padding: "30px 34px",
            borderRadius: 30,
            backgroundColor: "rgba(18, 18, 28, 0.92)",
            border: `1px solid ${COLORS.border}`,
            boxShadow: `0 30px 80px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.02) inset`,
            opacity: interpolate(bubbleIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
            scale: `${interpolate(move, [0, 1], [1, 0.7])}`,
            translate: `${interpolate(move, [0, 1], [0, -348])}px ${interpolate(move, [0, 1], [0, -252])}px`,
          }}
        >
          <ChatIcon />
          <div
            style={{
              fontFamily: FONTS.chinese,
              fontSize: 40,
              fontWeight: 500,
              color: COLORS.textPrimary,
              whiteSpace: "pre",
              letterSpacing: 1,
              minHeight: 52,
              display: "flex",
              alignItems: "center",
            }}
          >
            {typedText}
            <span
              style={{
                display: "inline-block",
                width: 3,
                height: 46,
                marginLeft: 4,
                backgroundColor: COLORS.cyan,
                opacity: cursorOn || !typingDone ? 1 : 0.2,
                boxShadow: `0 0 12px ${COLORS.cyan}`,
              }}
            />
          </div>
          {/* Send button */}
          <div
            style={{
              marginLeft: "auto",
              width: 64,
              height: 64,
              borderRadius: "50%",
              background: GRADIENT,
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              scale: pulse,
              boxShadow: `0 0 ${interpolate(sendGlow, [0, 1], [10, 46])}px rgba(139, 92, 246, ${interpolate(sendGlow, [0, 1], [0.15, 0.7])})`,
            }}
          >
            <SendIcon />
          </div>
        </div>
      </AbsoluteFill>

      {/* ZCODE wordmark */}
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
        <div style={{ position: "relative", opacity: frame >= WORDMARK_START ? 1 : 0 }}>
          <div style={{ display: "flex", gap: 8 }}>
            {WORDMARK_LETTERS.map((letter, i) => {
              const enter = spring({
                frame: frame - (WORDMARK_START + i * LETTER_STAGGER),
                fps,
                config: { damping: 12 },
              });
              return (
                <div
                  key={i}
                  style={{
                    fontFamily: FONTS.display,
                    fontWeight: 700,
                    fontSize: 150,
                    lineHeight: 1,
                    color: COLORS.textPrimary,
                    opacity: interpolate(enter, [0, 1], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                    translate: interpolate(enter, [0, 1], ["0px 44px", "0px 0px"]),
                    scale: interpolate(enter, [0, 1], [0.55, 1]),
                  }}
                >
                  {letter}
                </div>
              );
            })}
          </div>
          {/* Gradient shimmer sweep across the wordmark */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              gap: 8,
              backgroundImage: GRADIENT,
              backgroundSize: "220% 100%",
              backgroundPosition: `${interpolate(frame, [SHIMMER_START, SHIMMER_START + 24], [140, 0], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}% 0%`,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              opacity: interpolate(frame, [SHIMMER_START - 4, SHIMMER_START + 4], [0, 1], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              }),
              filter: `drop-shadow(0 0 26px rgba(139, 92, 246, ${interpolate(frame, [SHIMMER_START, SHIMMER_START + 12, SHIMMER_START + 24], [0, 0.55, 0.3], {
                extrapolateLeft: "clamp",
                extrapolateRight: "clamp",
              })}))`,
            }}
          >
            {WORDMARK_LETTERS.map((letter, i) => (
              <div
                key={i}
                style={{
                  fontFamily: FONTS.display,
                  fontWeight: 700,
                  fontSize: 150,
                  lineHeight: 1,
                }}
              >
                {letter}
              </div>
            ))}
          </div>
        </div>
        <div
          style={{
            marginTop: 26,
            fontFamily: FONTS.mono,
            fontSize: 25,
            fontWeight: 500,
            letterSpacing: 10,
            color: COLORS.textSecondary,
            opacity: interpolate(frame, [SHIMMER_START + 6, SHIMMER_START + 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            translate: interpolate(frame, [SHIMMER_START + 6, SHIMMER_START + 18], ["0px 14px", "0px 0px"], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          REMOTION PLUGIN
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
