import React from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { useTheme } from "../context/themecontext";

export function AmbientGlow() {
  const { colors, theme } = useTheme();

  return (
    <View pointerEvents="none" style={styles.wrapper}>
      <Svg width={320} height={320}>
        <Defs>
          <RadialGradient id="sharedAmbientGlow" cx="50%" cy="50%" r="50%">
            <Stop offset="0%" stopColor={colors.primary} stopOpacity={theme === "dark" ? 0.16 : 0.09} />
            <Stop offset="55%" stopColor={colors.primary} stopOpacity={theme === "dark" ? 0.06 : 0.03} />
            <Stop offset="100%" stopColor={colors.primary} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={160} cy={160} r={160} fill="url(#sharedAmbientGlow)" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: "absolute",
    top: -88,
    left: "50%",
    marginLeft: -160,
  },
});
