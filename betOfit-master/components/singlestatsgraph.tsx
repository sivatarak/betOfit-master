// components/SingleStatGraph.tsx
import React from "react";
import { View, Text, StyleSheet, Dimensions } from "react-native";
import { BarChart, LineChart } from "react-native-gifted-charts";
import { useThemedColors } from "@/theme";

const { width } = Dimensions.get("window");

interface SingleStatGraphProps {
  data: number[];
  dates: string[];
  goal: number;
  type: "water" | "calories";
  unit: string;
}

const SingleStatGraph: React.FC<SingleStatGraphProps> = ({
  data,
  dates,
  goal,
  type,
  unit,
}) => {
  const colors = useThemedColors();
  const styles = makeStyles(colors);

  const isWater = type === "water";
  const barColor = isWater ? "#38BDF8" : colors.primary;
  const gradientColors = isWater 
    ? ["#38BDF8", "#00B4D8", "#0077B6"] 
    : [colors.primary, colors.primaryLight, colors.accent];

  // Prepare data for the chart
  const chartData = dates.map((date, index) => {
    const value = data[index] || 0;
    const percentage = goal > 0 ? (value / goal) * 100 : 0;
    
    return {
      value,
      label: date,
      frontColor: barColor,
      topLabelComponent: () => (
        <View style={styles.topLabelContainer}>
          <Text style={[styles.topLabel, { color: colors.textMuted }]}>
            {value > 0 ? `${value}${unit}` : ""}
          </Text>
          <Text style={[styles.percentageLabel, { color: colors.textMuted }]}>
            {value > 0 ? `${Math.round(percentage)}%` : ""}
          </Text>
        </View>
      ),
    };
  });

  const maxValue = Math.max(...data, goal) * 1.1; // Add 10% padding

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>
          Last 7 Days - {type === "water" ? "Water Intake" : "Calorie Consumption"}
        </Text>
        <View style={styles.goalBadge}>
          <Text style={[styles.goalText, { color: colors.textMuted }]}>
            Daily Goal: {goal}{unit}
          </Text>
        </View>
      </View>

      <BarChart
        data={chartData}
        barWidth={32}
        spacing={20}
        roundedTop
        roundedBottom
        hideRules
        xAxisThickness={0}
        yAxisThickness={0}
        yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
        noOfSections={4}
        maxValue={maxValue}
        showGradient
        isAnimated
        yAxisLabelWidth={0}
        xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 11 }}
      />

      {/* Goal Line */}
      <View style={styles.goalLineContainer}>
        <View style={[styles.goalLine, { backgroundColor: colors.textMuted + "40" }]} />
        <Text style={[styles.goalLineText, { color: colors.textMuted }]}>
          Goal: {goal}{unit}
        </Text>
      </View>

      {/* Stats Summary */}
      <View style={styles.statsSummary}>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Avg/Day</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {Math.round(data.reduce((a, b) => a + b, 0) / Math.max(data.length, 1))}{unit}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Total</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data.reduce((a, b) => a + b, 0)}{unit}
          </Text>
        </View>
        <View style={styles.statItem}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>Days Met</Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data.filter(d => d >= goal * 0.9).length}/{data.length}
          </Text>
        </View>
      </View>
    </View>
  );
};

const makeStyles = (colors: any) =>
  StyleSheet.create({
    container: {
      borderRadius: 20,
      padding: 20,
      backgroundColor: colors.card,
      marginBottom: 20,
      shadowColor: colors.shadow,
      shadowOffset: { width: 0, height: 6 },
      shadowOpacity: 0.15,
      shadowRadius: 16,
      elevation: 6,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 20,
    },
    title: {
      fontSize: 18,
      fontWeight: "800",
      letterSpacing: -0.5,
      flex: 1,
    },
    goalBadge: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 12,
      backgroundColor: colors.background,
    },
    goalText: {
      fontSize: 12,
      fontWeight: "600",
    },
    topLabelContainer: {
      alignItems: "center",
      marginBottom: 4,
    },
    topLabel: {
      fontSize: 9,
      marginBottom: 1,
    },
    percentageLabel: {
      fontSize: 9,
    },
    goalLineContainer: {
      position: "relative",
      height: 20,
      marginTop: 10,
    },
    goalLine: {
      position: "absolute",
      left: 0,
      right: 0,
      height: 1,
      top: 10,
    },
    goalLineText: {
      position: "absolute",
      right: 0,
      top: 0,
      fontSize: 10,
      fontWeight: "600",
      backgroundColor: colors.card,
      paddingHorizontal: 6,
    },
    statsSummary: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 20,
      paddingTop: 20,
      borderTopWidth: 1,
      borderTopColor: colors.border + "40",
    },
    statItem: {
      alignItems: "center",
      flex: 1,
    },
    statLabel: {
      fontSize: 11,
      fontWeight: "600",
      marginBottom: 4,
    },
    statValue: {
      fontSize: 16,
      fontWeight: "800",
    },
  });

export default SingleStatGraph;