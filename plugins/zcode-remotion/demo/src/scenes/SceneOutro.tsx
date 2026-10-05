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

export const SCENE_OUTRO_DURATION = 135;

const MARK_AT = 6;
const TITLE_AT = 18;
const RULE_AT = 34;
const TAGLINE_AT = 48;
const META_AT = 62;
const FADE_START = 116;

export const SceneOutro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const markIn = spring({ frame: frame - MARK_AT, fps, config: { damping: 12 } });
  const titleIn = spring({ frame: frame - TITLE_AT, fps, config: { damping: 14 } });
  const ruleW = interpolate(frame, [RULE_AT, RULE_AT + 18], [0, 560], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const taglineIn = spring({ frame: frame - TAGLINE_AT, fps, config: { damping: 14 } });
  const metaIn = spring({ frame: frame - META_AT, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDeep }}>
      <Background starDrift={0.08} />

      <AbsoluteFill
        style={{
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: 100,
            height: 100,
            borderRadius: 26,
            background: GRADIENT,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            opacity: interpolate(markIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
            scale: interpolate(markIn, [0, 1], [0.5, 1]),
            rotate: interpolate(markIn, [0, 1], ["-12deg", "0deg"]),
            boxShadow: `0 0 ${interpolate(markIn, [0, 1], [0, 54])}px rgba(139, 92, 246, 0.55), 0 20px 60px rgba(0, 0, 0, 0.5)`,
          }}
        >
          <div
            style={{
              fontFamily: FONTS.display,
              fontSize: 58,
              fontWeight: 700,
              color: "#07070C",
              lineHeight: 1,
              marginTop: -4,
            }}
          >
            Z
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            marginTop: 40,
            fontFamily: FONTS.display,
            fontSize: 64,
            fontWeight: 500,
            letterSpacing: 0,
            color: COLORS.textPrimary,
            opacity: interpolate(titleIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
            translate: interpolate(titleIn, [0, 1], ["0px 26px", "0px 0px"]),
          }}
        >
          <span
            style={{
              backgroundImage: GRADIENT,
              backgroundClip: "text",
              WebkitBackgroundClip: "text",
              color: "transparent",
              fontWeight: 700,
            }}
          >
            ZCode
          </span>{" "}
          Remotion Plugin
        </div>

        {/* Gradient rule */}
        <div
          style={{
            marginTop: 30,
            height: 3,
            width: ruleW,
            borderRadius: 2,
            background: GRADIENT,
            boxShadow: "0 0 20px rgba(139, 92, 246, 0.5)",
          }}
        />

        {/* Tagline */}
        <div
          style={{
            marginTop: 38,
            display: "flex",
            alignItems: "baseline",
            gap: 18,
            opacity: interpolate(taglineIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
            translate: interpolate(taglineIn, [0, 1], ["0px 18px", "0px 0px"]),
          }}
        >
          <span
            style={{
              fontFamily: FONTS.chinese,
              fontSize: 42,
              fontWeight: 500,
              letterSpacing: 4,
              color: COLORS.textPrimary,
            }}
          >
            一句话，一部片
          </span>
          <span style={{ color: COLORS.textDim, fontSize: 30 }}>·</span>
          <span
            style={{
              fontFamily: FONTS.mono,
              fontSize: 30,
              color: COLORS.textSecondary,
              letterSpacing: 1,
            }}
          >
            prompt → video
          </span>
        </div>

        {/* Meta line */}
        <div
          style={{
            marginTop: 44,
            display: "flex",
            alignItems: "baseline",
            gap: 12,
            fontFamily: FONTS.chinese,
            fontSize: 23,
            color: "#B9C0CC",
            letterSpacing: 1,
            opacity: interpolate(metaIn, [0, 1], [0, 0.9], { extrapolateLeft: "clamp" }),
            translate: interpolate(metaIn, [0, 1], ["0px 14px", "0px 0px"]),
          }}
        >
          <span>Remotion 官方 Agent Skills</span>
          <span style={{ color: COLORS.textDim }}>·</span>
          <span style={{ fontFamily: FONTS.mono }}>MIT</span>
          <span style={{ color: COLORS.textDim }}>·</span>
          <span
            style={{
              fontFamily: FONTS.mono,
              color: COLORS.cyan,
              padding: "4px 12px",
              borderRadius: 8,
              backgroundColor: "rgba(34, 211, 238, 0.08)",
              border: "1px solid rgba(34, 211, 238, 0.28)",
            }}
          >
            /remotion-setup
          </span>
        </div>
      </AbsoluteFill>

      {/* Fade to black */}
      <AbsoluteFill
        style={{
          backgroundColor: "#000000",
          opacity: interpolate(frame, [FADE_START, SCENE_OUTRO_DURATION - 1], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
    </AbsoluteFill>
  );
};
