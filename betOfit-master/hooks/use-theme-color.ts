import { useTheme } from '../context/themecontext';

type ThemeColorName = 'background' | 'text';

export function useThemeColor(
  overrides: { light?: string; dark?: string },
  colorName: ThemeColorName
) {
  const { colors, theme } = useTheme();
  return overrides[theme] ?? colors[colorName];
}
