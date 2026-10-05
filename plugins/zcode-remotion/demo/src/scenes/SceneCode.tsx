import React from "react";
import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Background } from "../components/Background";
import { COLORS, FONTS, FONT_STACKS, GRADIENT, SAFE } from "../shared";

export const SCENE_CODE_DURATION = 150;

/**
 * THE MONEY SHOT: as each line of code finishes typing on the left,
 * the thing it codes ASSEMBLES on the right, in lockstep.
 */

const CODE_LINES = [
  `const opacity = interpolate(frame, [0, 30],`,
  `  [0, 1], {extrapolateRight: "clamp"});`,
  `const scale = spring({frame, config: {damping: 12}});`,
  `const title = spring({frame, config: {damping: 14}});`,
  ``,
  `return (`,
  `  <Sequence from={0} durationInFrames={90}>`,
  `    <Img src={staticFile("logo.png")} />`,
  `    <GradientText>一句话，一部片</GradientText>`,
  `  </Sequence>`,
  `);`,
];

const LINE_TIMING = [
  { start: 6, dur: 16 },
  { start: 24, dur: 10 },
  { start: 36, dur: 12 },
  { start: 50, dur: 12 },
  { start: 64, dur: 2 },
  { start: 68, dur: 4 },
  { start: 74, dur: 16 },
  { start: 92, dur: 12 },
  { start: 106, dur: 12 },
  { start: 120, dur: 5 },
  { start: 127, dur: 3 },
];

const lineDone = (i: number) => LINE_TIMING[i].start + LINE_TIMING[i].dur;

// Cause (code line completes) -> Effect (preview assembles), in lockstep
const VIEWPORT_AT = lineDone(1); //   interpolate(...opacity...)  -> viewport fades in
const UNDERLINE_AT = lineDone(2); // spring({...damping: 12})     -> underline width scales/sweeps
const TITLE_AT = lineDone(3); //     const title = spring(...)    -> title springs in (damping 14)
const BADGE_AT = lineDone(5); //     return (                     -> badge fades up
const CAPTION_AT = lineDone(6); //   <Sequence ...>               -> caption slides + frame draws
const LOGO_AT = lineDone(7); //      <Img src={staticFile(...)} />-> logo chip springs in
const SHIMMER_AT = lineDone(8); //   <GradientText>               -> title turns gradient

const KEYWORDS = new Set(["const", "return", "import", "export", "from", "default"]);
const FUNCS = new Set(["interpolate", "spring", "useCurrentFrame", "staticFile"]);

type Token = { text: string; color: string };

const tokenize = (line: string): Token[] => {
  const tokens: Token[] = [];
  const pattern = /("(?:[^"\\]|\\.)*"|\d+|[A-Za-z_$][A-Za-z0-9_$]*|\s+|[^\sA-Za-z0-9_$])/g;
  let match = pattern.exec(line);
  while (match !== null) {
    const text = match[0];
    let color: string;
    if (text.startsWith('"')) {
      color = COLORS.string;
    } else if (/^\d+$/.test(text)) {
      color = COLORS.string;
    } else if (KEYWORDS.has(text)) {
      color = COLORS.keyword;
    } else if (FUNCS.has(text)) {
      color = COLORS.func;
    } else if (/^[A-Z]/.test(text)) {
      color = COLORS.keyword; // JSX components
    } else if (/^[A-Za-z_$]/.test(text)) {
      color = COLORS.textPrimary;
    } else {
      color = COLORS.punctuation;
    }
    const prev = tokens[tokens.length - 1];
    if (prev && prev.color === color) {
      prev.text += text;
    } else {
      tokens.push({ text, color });
    }
    match = pattern.exec(line);
  }
  return tokens;
};

const visibleChars = (i: number, frame: number) => {
  const { start, dur } = LINE_TIMING[i];
  const len = CODE_LINES[i].length;
  if (frame < start) return 0;
  const progress = (frame - start) / dur;
  return Math.max(0, Math.min(len, Math.floor(progress * len)));
};

const CodeWindow: React.FC<{ frame: number }> = ({ frame }) => {
  const typingIdx = LINE_TIMING.findIndex(
    (t) => frame >= t.start && frame < t.start + t.dur
  );
  let cursorIdx = typingIdx;
  if (cursorIdx === -1) {
    cursorIdx = 0;
    for (let i = 0; i < LINE_TIMING.length; i++) {
      if (visibleChars(i, frame) > 0) cursorIdx = i;
    }
  }
  const cursorOn = Math.floor(frame / 7) % 2 === 0;

  return (
    <div
      style={{
        width: 780,
        borderRadius: 20,
        backgroundColor: "#0A0A13",
        border: `1px solid ${COLORS.border}`,
        boxShadow: "0 40px 100px rgba(0, 0, 0, 0.55)",
        overflow: "hidden",
      }}
    >
      {/* Title bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          padding: "16px 20px",
          borderBottom: `1px solid ${COLORS.border}`,
        }}
      >
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FF5F57" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#FEBC2E" }} />
        <div style={{ width: 12, height: 12, borderRadius: "50%", background: "#28C840" }} />
        <div
          style={{
            marginLeft: 16,
            fontFamily: FONTS.mono,
            fontSize: 16,
            color: COLORS.textSecondary,
          }}
        >
          Video.tsx — zcode
        </div>
      </div>
      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "10px 16px 0 16px",
          gap: 10,
        }}
      >
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 17,
            color: COLORS.textPrimary,
            background: COLORS.surfaceBright,
            borderRadius: "10px 10px 0 0",
            padding: "8px 18px",
            borderBottom: `2px solid ${COLORS.cyan}`,
          }}
        >
          Video.tsx
        </div>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 17,
            color: COLORS.textDim,
            padding: "8px 14px",
          }}
        >
          shared.ts
        </div>
      </div>
      {/* Code body */}
      <div style={{ padding: "16px 0 24px 0" }}>
        {CODE_LINES.map((line, i) => {
          const visible = visibleChars(i, frame);
          const isActive = i === typingIdx;
          const started = frame >= LINE_TIMING[i].start;
          return (
            <div
              key={i}
              style={{
                display: "flex",
                alignItems: "center",
                height: 38,
                backgroundColor: isActive ? "rgba(139, 92, 246, 0.08)" : "transparent",
                borderRadius: 6,
              }}
            >
              <div
                style={{
                  width: 56,
                  paddingRight: 18,
                  textAlign: "right",
                  fontFamily: FONTS.mono,
                  fontSize: 17,
                  color: started ? COLORS.textDim : "#33334A",
                  userSelect: "none",
                }}
              >
                {i + 1}
              </div>
              <div
                style={{
                  fontFamily: FONT_STACKS.mono,
                  fontSize: 20,
                  fontWeight: 400,
                  whiteSpace: "pre",
                  lineHeight: "38px",
                }}
              >
                {tokenize(line.slice(0, visible)).map((token, j) => (
                  <span key={j} style={{ color: token.color }}>
                    {token.text}
                  </span>
                ))}
                {i === cursorIdx && (
                  <span
                    style={{
                      display: "inline-block",
                      width: 2.5,
                      height: 24,
                      marginLeft: 1,
                      verticalAlign: "middle",
                      backgroundColor: COLORS.cyan,
                      opacity: cursorOn ? 1 : 0.25,
                      boxShadow: `0 0 10px ${COLORS.cyan}`,
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export const SceneCode: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const leftIn = spring({ frame, fps, config: { damping: 16 } });
  const rightIn = spring({ frame: frame - 5, fps, config: { damping: 16 } });

  // Right-side effect springs (each triggered by a completed code line)
  const viewportIn = spring({ frame: frame - VIEWPORT_AT, fps, config: { damping: 16 } });
  const titleIn = spring({ frame: frame - TITLE_AT, fps, config: { damping: 14 } });
  const badgeIn = spring({ frame: frame - BADGE_AT, fps, config: { damping: 14 } });
  const captionIn = spring({ frame: frame - CAPTION_AT, fps, config: { damping: 14 } });
  const seqBorderIn = spring({ frame: frame - CAPTION_AT, fps, config: { damping: 16 } });
  const logoIn = spring({ frame: frame - LOGO_AT, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{ backgroundColor: COLORS.bgDeep }}>
      <Background />

      {/* Kicker */}
      <div style={{ position: "absolute", top: SAFE, left: SAFE }}>
        <div
          style={{
            fontFamily: FONTS.mono,
            fontSize: 17,
            letterSpacing: 5,
            color: COLORS.textSecondary,
          }}
        >
          02 / CODE
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
          代码即画面
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          top: SAFE,
          right: SAFE,
          fontFamily: FONTS.mono,
          fontSize: 17,
          color: COLORS.textDim,
        }}
      >
        src/Video.tsx
      </div>

      {/* Split: editor 45 / preview 55 */}
      <AbsoluteFill
        style={{
          flexDirection: "row",
          alignItems: "center",
          padding: `80px ${SAFE}px 60px ${SAFE}px`,
          gap: 48,
        }}
      >
        {/* LEFT: code editor */}
        <div
          style={{
            width: 780,
            flexShrink: 0,
            opacity: interpolate(leftIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
            translate: interpolate(leftIn, [0, 1], ["-32px 0px", "0px 0px"]),
            scale: interpolate(leftIn, [0, 1], [0.97, 1]),
          }}
        >
          <CodeWindow frame={frame} />
        </div>

        {/* RIGHT: live preview assembling in lockstep */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: 18,
            opacity: interpolate(rightIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
            translate: interpolate(rightIn, [0, 1], ["32px 0px", "0px 0px"]),
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "0 6px",
            }}
          >
            <div
              style={{
                fontFamily: FONT_STACKS.display,
                fontSize: 18,
                letterSpacing: 3,
                color: COLORS.textSecondary,
              }}
            >
              预览 · PREVIEW
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                fontFamily: FONTS.mono,
                fontSize: 16,
                color: COLORS.textDim,
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: COLORS.cyan,
                  boxShadow: `0 0 10px ${COLORS.cyan}`,
                }}
              />
              1080p · 30fps
            </div>
          </div>

          {/* Viewport (fades in when the opacity code completes) */}
          <div
            style={{
              position: "relative",
              height: 506,
              borderRadius: 20,
              backgroundColor: "rgba(10, 10, 19, 0.9)",
              border: `1px solid ${COLORS.border}`,
              boxShadow: "0 40px 100px rgba(0, 0, 0, 0.5)",
              overflow: "hidden",
              opacity: interpolate(viewportIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
              scale: interpolate(viewportIn, [0, 1], [0.97, 1]),
            }}
          >
            {/* Sequence dashed frame (drawn when <Sequence> line completes) */}
            <div
              style={{
                position: "absolute",
                inset: 16,
                borderRadius: 14,
                border: `1.5px dashed rgba(34, 211, 238, ${interpolate(seqBorderIn, [0, 1], [0, 0.4])})`,
                opacity: interpolate(seqBorderIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
                scale: interpolate(seqBorderIn, [0, 1], [1.03, 1]),
              }}
            />
            <div
              style={{
                position: "absolute",
                top: 30,
                right: 34,
                fontFamily: FONTS.mono,
                fontSize: 16,
                color: COLORS.cyan,
                padding: "5px 12px",
                borderRadius: 8,
                backgroundColor: "rgba(34, 211, 238, 0.08)",
                border: "1px solid rgba(34, 211, 238, 0.3)",
                opacity: interpolate(frame, [CAPTION_AT + 4, CAPTION_AT + 12], [0, 1], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
                translate: interpolate(frame, [CAPTION_AT + 4, CAPTION_AT + 12], ["0px -8px", "0px 0px"], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                }),
              }}
            >
              Sequence · 0–90f
            </div>

            {/* Logo chip (springs in when the <Img> line completes) */}
            <div
              style={{
                position: "absolute",
                top: 26,
                left: "50%",
                translate: interpolate(logoIn, [0, 1], ["-50% 14px", "-50% 0px"]),
                width: 66,
                height: 66,
                borderRadius: 16,
                background: GRADIENT,
                display: "flex",
                justifyContent: "center",
                alignItems: "center",
                opacity: interpolate(logoIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
                scale: interpolate(logoIn, [0, 1], [0.4, 1]),
                rotate: interpolate(logoIn, [0, 1], ["-14deg", "0deg"]),
                boxShadow: `0 0 ${interpolate(logoIn, [0, 1], [0, 36])}px rgba(139, 92, 246, 0.5)`,
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.display,
                  fontSize: 38,
                  fontWeight: 700,
                  color: "#07070C",
                  lineHeight: 1,
                  marginTop: -3,
                }}
              >
                Z
              </div>
            </div>

            {/* Badge (return ( completes) */}
            <div
              style={{
                position: "absolute",
                top: 30,
                left: 34,
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "9px 18px",
                borderRadius: 999,
                backgroundColor: "rgba(34, 211, 238, 0.1)",
                border: "1px solid rgba(34, 211, 238, 0.35)",
                opacity: interpolate(badgeIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
                translate: interpolate(badgeIn, [0, 1], ["0px 16px", "0px 0px"]),
              }}
            >
              <div
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  backgroundColor: COLORS.cyan,
                  boxShadow: `0 0 10px ${COLORS.cyan}`,
                }}
              />
              <span
                style={{
                  fontFamily: FONTS.chinese,
                  fontSize: 21,
                  color: COLORS.textPrimary,
                }}
              >
                AI 生成 · 10 秒
              </span>
            </div>

            {/* Title (const title = spring(...) completes) + gradient overlay (GradientText completes) */}
            <div
              style={{
                position: "absolute",
                top: 178,
                width: "100%",
                display: "flex",
                justifyContent: "center",
              }}
            >
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    fontFamily: FONTS.chinese,
                    fontWeight: 700,
                    fontSize: 72,
                    letterSpacing: 3,
                    color: COLORS.textPrimary,
                    opacity: interpolate(titleIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
                    translate: interpolate(titleIn, [0, 1], ["0px 40px", "0px 0px"]),
                    scale: interpolate(titleIn, [0, 1], [0.8, 1]),
                  }}
                >
                  一句话，一部片
                </div>
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    fontFamily: FONTS.chinese,
                    fontWeight: 700,
                    fontSize: 72,
                    letterSpacing: 3,
                    backgroundImage: GRADIENT,
                    backgroundSize: "220% 100%",
                    backgroundPosition: `${interpolate(frame, [SHIMMER_AT, SHIMMER_AT + 22], [140, 0], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    })}% 0%`,
                    backgroundClip: "text",
                    WebkitBackgroundClip: "text",
                    color: "transparent",
                    opacity: interpolate(frame, [SHIMMER_AT - 3, SHIMMER_AT + 5], [0, 1], {
                      extrapolateLeft: "clamp",
                      extrapolateRight: "clamp",
                    }),
                    filter: `drop-shadow(0 0 24px rgba(139, 92, 246, ${interpolate(
                      frame,
                      [SHIMMER_AT, SHIMMER_AT + 12, SHIMMER_AT + 24],
                      [0, 0.5, 0.28],
                      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
                    )}))`,
                  }}
                >
                  一句话，一部片
                </div>
              </div>
            </div>

            {/* Gradient underline (spring scale line completes; width "scales" open) */}
            <div
              style={{
                position: "absolute",
                top: 300,
                left: "50%",
                height: 5,
                borderRadius: 3,
                width: interpolate(frame, [UNDERLINE_AT, UNDERLINE_AT + 24], [0, 420], {
                  extrapolateLeft: "clamp",
                  extrapolateRight: "clamp",
                  easing: (t) => 1 - Math.pow(1 - t, 3),
                }),
                translate: "-50% 0%",
                background: GRADIENT,
                boxShadow: "0 0 24px rgba(139, 92, 246, 0.55)",
              }}
            />

            {/* Caption (Sequence line completes) */}
            <div
              style={{
                position: "absolute",
                bottom: 34,
                width: "100%",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
                opacity: interpolate(captionIn, [0, 1], [0, 1], { extrapolateLeft: "clamp" }),
                translate: interpolate(captionIn, [0, 1], ["0px 22px", "0px 0px"]),
              }}
            >
              <div
                style={{
                  fontFamily: FONTS.chinese,
                  fontSize: 25,
                  color: COLORS.textSecondary,
                  letterSpacing: 2,
                }}
              >
                一句提示词 · 4 个场景 · 自动编排
              </div>
              <div
                style={{
                  fontFamily: FONTS.mono,
                  fontSize: 19,
                  color: COLORS.cyan,
                  opacity: 0.85,
                }}
              >
                prompt → video
              </div>
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
