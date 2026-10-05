import React from "react";
import { AbsoluteFill } from "remotion";

/** Reusable vignette overlay — darkens the edges for a cinematic look. */
export const Vignette: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        pointerEvents: "none",
        background:
          "radial-gradient(ellipse 130% 110% at 50% 45%, transparent 55%, rgba(0, 0, 0, 0.55) 100%)",
      }}
    />
  );
};
