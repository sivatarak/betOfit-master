import { LightTheme } from "./light";
import { DarkTheme } from "./dark";
import { useThemedColors } from "./useTheme";
import type { ThemeColors } from "./types";

// Main theme object
export const Theme = {
  light: LightTheme,
  dark: DarkTheme,
};

// Default export for static screens (optional)
export const Colors = LightTheme;

// Hook export
export { useThemedColors };

// Types
export type { ThemeColors };
