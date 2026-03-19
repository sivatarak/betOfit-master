import React from "react";
import { View, Text } from "react-native";
import { BarChart } from "react-native-gifted-charts";

export default function WorkoutWeeklyGraph({ data }: any) {
  const chartData = data.labels.map((l: string, i: number) => ({
    label: l,
    value: data.minutes[i],
  }));

  return (
    <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 16 }}>
      <Text style={{ fontWeight: "800", marginBottom: 10 }}>
        Weekly Workout
      </Text>

      <BarChart
        data={chartData}
        barWidth={24}
        spacing={24}
        hideRules
        xAxisThickness={0}
        yAxisThickness={0}
      />
    </View>
  );
}
