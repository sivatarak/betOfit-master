import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { BarChart } from "react-native-gifted-charts";
import { useThemedColors } from "@/theme";

interface Props {
  labels: string[];
  calories: number[];
  water: number[];
  avgCalories: number;
  avgWater: number;
}

export const OverallWeeklyGraph: React.FC<Props> = ({
  labels,
  calories,
  water,
  avgCalories,
  avgWater,
}) => {
  const colors = useThemedColors();

  const data = labels.map((label, i) => ({
    label,
    value: calories[i] / 100,        // scaled for visibility
    secondaryValue: water[i] / 10,   // scaled for visibility
    frontColor: colors.primary,
    secondaryFrontColor: colors.accent,
  }));

  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Overall Weekly Stats
        </Text>
        <Text style={[styles.sub, { color: colors.textMuted }]}>
          Calories + Water
        </Text>
      </View>

      <BarChart
        data={data}
        barWidth={26}
        spacing={26}
        roundedTop
        hideRules
        xAxisThickness={0}
        yAxisThickness={0}
        isAnimated
        showGradient
        maxValue={
          Math.max(
            ...calories.map(c => c / 100),
            ...water.map(w => w / 10)
          ) + 5
        }
      />

      {/* Averages */}
      <View style={styles.avgRow}>
        <Text style={[styles.avgText, { color: colors.primary }]}>
          Avg Calories: {avgCalories} kcal
        </Text>
        <Text style={[styles.avgText, { color: colors.accent }]}>
          Avg Water: {avgWater} ml
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    padding: 20,
    marginBottom: 24,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: "800",
  },
  sub: {
    fontSize: 12,
    fontWeight: "600",
  },
  avgRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 16,
  },
  avgText: {
    fontSize: 13,
    fontWeight: "700",
  },
});
