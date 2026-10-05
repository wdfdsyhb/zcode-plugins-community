import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS, VIDEO_HEIGHT, VIDEO_WIDTH } from "../shared";

/**
 * Subtle grid + starfield background layer.
 * Deterministic: stars are generated from a seeded PRNG (never Math.random),
 * so every render of every frame is identical.
 */

// mulberry32 seeded PRNG -> () => [0, 1)
const mulberry32 = (seed: number) => () => {
  let t = seed | 0;
  t = (t + 0x6d2b79f5) | 0;
  let x = Math.imul(t ^ (t >>> 15), 1 | t);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
};

type Star = {
  x: number;
  y: number;
  size: number;
  opacity: number;
  depth: number; // parallax factor
  twinkle: number; // phase offset
  color: string;
};

const STAR_COUNT = 230;

const STARS: Star[] = (() => {
  const random = mulberry32(42);
  const accents = [COLORS.cyan, COLORS.violet, COLORS.magenta];
  const stars: Star[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const accentRoll = random();
    // Skewed distribution: mostly small points, a few clearly larger stars
    const sizeRoll = random();
    stars.push({
      x: random() * VIDEO_WIDTH,
      y: random() * VIDEO_HEIGHT,
      size: 0.9 + Math.pow(sizeRoll, 2.2) * 3.6,
      opacity: 0.25 + random() * 0.6,
      depth: 0.3 + random() * 1,
      twinkle: random() * Math.PI * 2,
      color:
        accentRoll > 0.92
          ? accents[Math.floor(random() * accents.length)]
          : "#FFFFFF",
    });
  }
  return stars;
})();

export const Background: React.FC<{
  /** Pixels per frame the starfield drifts (0 = static). */
  starDrift?: number;
  /** Frames over which the whole layer fades in (0 = fully visible at frame 0). */
  fadeInFrames?: number;
  /** Multiplier for the grid opacity. */
  gridOpacity?: number;
}> = ({ starDrift = 0, fadeInFrames = 0, gridOpacity = 1 }) => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();

  const layerOpacity = interpolate(frame, [0, Math.max(1, fadeInFrames)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => t * t * (3 - 2 * t), // smoothstep
  });

  return (
    <AbsoluteFill
      style={{
        background: `radial-gradient(1400px 900px at 50% 40%, ${COLORS.bgDeep} 0%, ${COLORS.bgEdge} 100%)`,
        opacity: layerOpacity,
      }}
    >
      {/* Nebula glows */}
      <AbsoluteFill
        style={{
          background: `radial-gradient(900px 600px at 18% 12%, rgba(34, 211, 238, 0.05) 0%, transparent 70%),
             radial-gradient(1000px 700px at 84% 88%, rgba(139, 92, 246, 0.06) 0%, transparent 70%)`,
        }}
      />
      {/* Grid */}
      <AbsoluteFill
        style={{
          opacity: 0.9 * gridOpacity,
          backgroundImage: `linear-gradient(rgba(255, 255, 255, 0.035) 1px, transparent 1px),
             linear-gradient(90deg, rgba(255, 255, 255, 0.035) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
          maskImage:
            "radial-gradient(1200px 800px at 50% 45%, black 30%, transparent 90%)",
          WebkitMaskImage:
            "radial-gradient(1200px 800px at 50% 45%, black 30%, transparent 90%)",
        }}
      />
      {/* Starfield with parallax drift + twinkle */}
      {STARS.map((star, i) => {
        const drift = starDrift * star.depth;
        const x = ((star.x + frame * drift) % (width + 40)) - 20;
        const twinkle =
          0.75 + 0.25 * Math.sin(frame * 0.14 + star.twinkle);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: star.y,
              width: star.size,
              height: star.size,
              borderRadius: "50%",
              backgroundColor: star.color,
              opacity: star.opacity * twinkle,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
