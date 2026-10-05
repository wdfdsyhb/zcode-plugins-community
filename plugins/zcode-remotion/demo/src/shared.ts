import { loadFont } from "@remotion/google-fonts/SpaceGrotesk";
import { loadFont as loadMonoFont } from "@remotion/google-fonts/JetBrainsMono";
import { loadFont as loadChineseFont } from "@remotion/google-fonts/NotoSansSC";

/**
 * Shared design tokens + fonts for the ZCode Remotion demo.
 * Concept: 一句话，一部片 (one sentence, one film)
 */

const spaceGrotesk = loadFont("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

const jetBrainsMono = loadMonoFont("normal", {
  weights: ["400", "500", "700"],
  subsets: ["latin"],
});

// ALL Chinese text must explicitly use this family (no tofu).
const notoSansSC = loadChineseFont("normal", {
  weights: ["400", "500", "700"],
  subsets: ["chinese-simplified", "latin"],
});

export const FONTS = {
  display: spaceGrotesk.fontFamily,
  mono: jetBrainsMono.fontFamily,
  chinese: notoSansSC.fontFamily,
};

// Mixed stacks: latin glyphs use the first family, CJK falls through to Noto Sans SC.
export const FONT_STACKS = {
  display: `${FONTS.display}, ${FONTS.chinese}`,
  mono: `${FONTS.mono}, ${FONTS.chinese}`,
};

export const COLORS = {
  bgDeep: "#07070C",
  bgEdge: "#0D0D17",
  surface: "#0B0B14",
  surfaceBright: "#12121C",
  border: "rgba(255, 255, 255, 0.08)",
  cyan: "#22D3EE",
  violet: "#8B5CF6",
  magenta: "#E879F9",
  textPrimary: "#F4F4F6",
  textSecondary: "#9CA3AF",
  textDim: "#6B7280",
  // Code syntax
  keyword: "#C4B5FD",
  string: "#67E8F9",
  func: "#F0A6F5",
  punctuation: "#6B7280",
} as const;

export const GRADIENT = `linear-gradient(90deg, ${COLORS.cyan} 0%, ${COLORS.violet} 50%, ${COLORS.magenta} 100%)`;

export const SAFE = 96; // px safe margin on all sides

export const FPS = 30;

/** Duration of each fade transition between scenes. */
export const TRANSITION_DURATION = 12;

/** Exact length of the final composition. */
export const VIDEO_FRAMES = 690;

export const VIDEO_WIDTH = 1920;
export const VIDEO_HEIGHT = 1080;
