// components/SmartSuggestions.tsx
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTheme } from '../../context/themecontext';
import { loadSmartSuggestions, SmartSuggestion } from '../../app/services/mealReminders';

const { width, height } = Dimensions.get('window');

// ─── Meal icon + color map ─────────────────────────────────
const MEAL_META: Record<string, { icon: string; gradient: [string, string]; label: string }> = {
  breakfast: { icon: 'sunny-outline',    gradient: ['#F59E0B', '#EF4444'], label: 'Breakfast' },
  lunch:     { icon: 'restaurant-outline', gradient: ['#10B981', '#059669'], label: 'Lunch'     },
  dinner:    { icon: 'moon-outline',     gradient: ['#6366F1', '#8B5CF6'], label: 'Dinner'    },
};

// ─── Single suggestion row in the modal ───────────────────
function SuggestionDetailCard({
  suggestion,
  colors,
  theme,
  onFoodTap,
}: {
  suggestion: SmartSuggestion;
  colors: any;
  theme: string;
  onFoodTap?: (foodName: string, mealType: string) => void;
}) {
  const meta = MEAL_META[suggestion.mealType] ?? MEAL_META.breakfast;

  return (
    <View style={[detailStyles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
      {/* Meal header */}
      <View style={detailStyles.cardHeader}>
        <LinearGradient colors={meta.gradient} style={detailStyles.mealIcon}>
          <Ionicons name={meta.icon as any} size={20} color="#fff" />
        </LinearGradient>
        <View style={detailStyles.cardHeaderText}>
          <Text style={[detailStyles.mealLabel, { color: colors.text }]}>{meta.label}</Text>
          <Text style={[detailStyles.insightText, { color: colors.primary }]}>
            {suggestion.suggestion}
          </Text>
        </View>
      </View>

      {/* Streak bar */}
      <View style={[detailStyles.streakRow, { backgroundColor: `${colors.primary}10` }]}>
        {[...Array(7)].map((_, i) => (
          <View
            key={i}
            style={[
              detailStyles.streakDot,
              {
                backgroundColor:
                  i < suggestion.streakDays ? meta.gradient[0] : `${colors.primary}20`,
              },
            ]}
          />
        ))}
        <Text style={[detailStyles.streakLabel, { color: colors.textSecondary }]}>
          {suggestion.streakDays}/7 this week
        </Text>
      </View>

      {/* Stats row */}
      <View style={detailStyles.statsRow}>
        <View style={[detailStyles.statBox, { backgroundColor: colors.background }]}>
          <Ionicons name="warning-outline" size={16} color="#F59E0B" />
          <Text style={[detailStyles.statValue, { color: colors.text }]}>
            {suggestion.missedCount}
          </Text>
          <Text style={[detailStyles.statLabel, { color: colors.textSecondary }]}>
            missed this month
          </Text>
        </View>
        <View style={[detailStyles.statBox, { backgroundColor: colors.background }]}>
          <Ionicons name="time-outline" size={16} color={colors.primary} />
          <Text style={[detailStyles.statValue, { color: colors.text }]}>
            {suggestion.avgLogHour != null ? `${suggestion.avgLogHour}:00` : '—'}
          </Text>
          <Text style={[detailStyles.statLabel, { color: colors.textSecondary }]}>
            avg log time
          </Text>
        </View>
        <View style={[detailStyles.statBox, { backgroundColor: colors.background }]}>
          <Ionicons name="flame-outline" size={16} color="#EF4444" />
          <Text style={[detailStyles.statValue, { color: colors.text }]}>
            {suggestion.streakDays >= 7 ? '🔥' : `${suggestion.streakDays}d`}
          </Text>
          <Text style={[detailStyles.statLabel, { color: colors.textSecondary }]}>
            streak
          </Text>
        </View>
      </View>

      {/* Top foods */}
      {suggestion.topFoods.length > 0 && (
        <View style={detailStyles.foodsSection}>
          <Text style={[detailStyles.foodsTitle, { color: colors.textSecondary }]}>
            YOUR USUAL PICKS
          </Text>
          {suggestion.topFoods.map((food, idx) => (
            <TouchableOpacity
              key={food.name}
              style={[detailStyles.foodRow, { borderBottomColor: colors.border }]}
              onPress={() => onFoodTap?.(food.name, suggestion.mealType)}
              activeOpacity={0.7}
            >
              <View style={[detailStyles.foodRank, { backgroundColor: `${meta.gradient[0]}20` }]}>
                <Text style={[detailStyles.foodRankText, { color: meta.gradient[0] }]}>
                  #{idx + 1}
                </Text>
              </View>
              <View style={detailStyles.foodInfo}>
                <Text style={[detailStyles.foodName, { color: colors.text }]}>{food.name}</Text>
                <Text style={[detailStyles.foodMeta, { color: colors.textMuted }]}>
                  ~{food.avgQuantity}g · logged {food.frequency}×
                </Text>
              </View>
              <View style={detailStyles.foodCalRight}>
                <Text style={[detailStyles.foodCals, { color: colors.text }]}>
                  {food.avgCalories}
                </Text>
                <Text style={[detailStyles.foodCalsLabel, { color: colors.textMuted }]}>kcal</Text>
              </View>
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Main component ────────────────────────────────────────
interface SmartSuggestionsProps {
  onFoodTap?: (foodName: string, mealType: string) => void;
}

export default function SmartSuggestions({ onFoodTap }: SmartSuggestionsProps) {
  const { colors, theme } = useTheme();
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);

  // Card animation
  const cardScale = useRef(new Animated.Value(0.97)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  // Modal slide-up
  const modalY = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    loadSmartSuggestions().then(data => {
      setSuggestions(data);
      setLoading(false);
      // Entrance animation
      Animated.parallel([
        Animated.spring(cardScale, { toValue: 1, useNativeDriver: true, tension: 60, friction: 8 }),
        Animated.timing(cardOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      ]).start();
    });
  }, []);

  const openModal = () => {
    setModalVisible(true);
    Animated.spring(modalY, {
      toValue: 0,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const closeModal = () => {
    Animated.timing(modalY, {
      toValue: height,
      duration: 280,
      useNativeDriver: true,
    }).start(() => setModalVisible(false));
  };

  if (loading || suggestions.length === 0) return null;

  // Pick the most urgent suggestion for the preview card
  // Priority: highest missedCount → lowest streakDays
  const primary = [...suggestions].sort((a, b) =>
    b.missedCount !== a.missedCount
      ? b.missedCount - a.missedCount
      : a.streakDays - b.streakDays
  )[0];

  const meta = MEAL_META[primary.mealType] ?? MEAL_META.breakfast;
  const totalMissed = suggestions.reduce((s, x) => s + x.missedCount, 0);
  const avgStreak = Math.round(suggestions.reduce((s, x) => s + x.streakDays, 0) / suggestions.length);

  return (
    <>
      {/* ── Preview card on home screen ── */}
      <Animated.View style={{ opacity: cardOpacity, transform: [{ scale: cardScale }] }}>
        <TouchableOpacity
          activeOpacity={0.88}
          onPress={openModal}
          style={styles.cardWrapper}
        >
          <LinearGradient
            colors={[`${meta.gradient[0]}18`, `${meta.gradient[1]}08`]}
            style={[styles.card, { borderColor: `${meta.gradient[0]}30`, backgroundColor: colors.card }]}
          >
            {/* Left accent stripe */}
            <LinearGradient
              colors={meta.gradient}
              style={styles.accentStripe}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
            />

            <View style={styles.cardBody}>
              {/* Header row */}
              <View style={styles.cardHeader}>
                <LinearGradient colors={meta.gradient} style={styles.cardIconBg}>
                  <Ionicons name="bulb-outline" size={18} color="#fff" />
                </LinearGradient>
                <Text style={[styles.cardTitle, { color: colors.text }]}>Smart Suggestions</Text>
                <View style={[styles.countBadge, { backgroundColor: `${meta.gradient[0]}20` }]}>
                  <Text style={[styles.countBadgeText, { color: meta.gradient[0] }]}>
                    {suggestions.length}
                  </Text>
                </View>
              </View>

              {/* Primary insight */}
              <Text style={[styles.insightPreview, { color: colors.text }]} numberOfLines={2}>
                {primary.suggestion}
              </Text>

              {/* Mini stats */}
              <View style={styles.miniStats}>
                <View style={styles.miniStat}>
                  <Ionicons name="flame" size={14} color={avgStreak >= 5 ? '#F59E0B' : colors.textMuted} />
                  <Text style={[styles.miniStatText, { color: colors.textSecondary }]}>
                    {avgStreak}/7 avg streak
                  </Text>
                </View>
                {totalMissed > 0 && (
                  <View style={styles.miniStat}>
                    <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                    <Text style={[styles.miniStatText, { color: colors.textSecondary }]}>
                      {totalMissed} missed this month
                    </Text>
                  </View>
                )}
              </View>

              {/* Tap to see more */}
              <View style={styles.cardFooter}>
                <Text style={[styles.tapMore, { color: meta.gradient[0] }]}>
                  Tap to see all insights
                </Text>
                <Ionicons name="chevron-forward" size={16} color={meta.gradient[0]} />
              </View>
            </View>
          </LinearGradient>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Full suggestions modal ── */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="none"
        onRequestClose={closeModal}
        statusBarTranslucent
      >
        <View style={styles.modalOverlay}>
          {/* Tap backdrop to close */}
          <TouchableOpacity
            style={StyleSheet.absoluteFill}
            activeOpacity={1}
            onPress={closeModal}
          />

          <Animated.View
            style={[
              styles.modalSheet,
              { backgroundColor: colors.background },
              { transform: [{ translateY: modalY }] },
            ]}
          >
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: colors.border }]} />

            {/* Modal header */}
            <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.modalTitle, { color: colors.text }]}>Smart Suggestions</Text>
                <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                  Based on your last 30 days
                </Text>
              </View>
              <TouchableOpacity
                onPress={closeModal}
                style={[styles.closeBtn, { backgroundColor: colors.card }]}
              >
                <Ionicons name="close" size={22} color={colors.text} />
              </TouchableOpacity>
            </View>

            {/* Summary row */}
            <View style={[styles.summaryRow, { backgroundColor: colors.card }]}>
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: colors.primary }]}>{avgStreak}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>avg streak</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#EF4444' }]}>{totalMissed}</Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>missed meals</Text>
              </View>
              <View style={[styles.summaryDivider, { backgroundColor: colors.border }]} />
              <View style={styles.summaryItem}>
                <Text style={[styles.summaryValue, { color: '#10B981' }]}>
                  {suggestions.reduce((s, x) => s + x.topFoods.length, 0)}
                </Text>
                <Text style={[styles.summaryLabel, { color: colors.textSecondary }]}>fav foods</Text>
              </View>
            </View>

            {/* Suggestion cards */}
            <ScrollView
              contentContainerStyle={styles.modalScroll}
              showsVerticalScrollIndicator={false}
            >
              {suggestions.map(s => (
                <SuggestionDetailCard
                  key={s.mealType}
                  suggestion={s}
                  colors={colors}
                  theme={theme}
                  onFoodTap={(foodName, mealType) => {
                    closeModal();
                    onFoodTap?.(foodName, mealType);
                  }}
                />
              ))}
              <View style={{ height: 40 }} />
            </ScrollView>
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────
const styles = StyleSheet.create({
  cardWrapper: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 22,
    shadowColor: '#6366F1',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  card: {
    borderRadius: 22,
    borderWidth: 1.5,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  accentStripe: {
    width: 5,
  },
  cardBody: {
    flex: 1,
    padding: 16,
    gap: 10,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  cardIconBg: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    flex: 1,
  },
  countBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  countBadgeText: {
    fontSize: 13,
    fontWeight: '800',
  },
  insightPreview: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  miniStats: {
    flexDirection: 'row',
    gap: 16,
  },
  miniStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  miniStatText: {
    fontSize: 12,
    fontWeight: '500',
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tapMore: {
    fontSize: 13,
    fontWeight: '700',
  },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    maxHeight: height * 0.90,
    paddingTop: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 12,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  modalSubtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: 2,
  },
  closeBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summaryRow: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginVertical: 16,
    borderRadius: 16,
    padding: 16,
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
    gap: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: '900',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  summaryDivider: {
    width: 1,
    height: '100%',
  },
  modalScroll: {
    paddingHorizontal: 20,
    gap: 16,
    paddingTop: 4,
  },
});

const detailStyles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: 18,
    borderWidth: 1,
    gap: 14,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  mealIcon: {
    width: 42,
    height: 42,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardHeaderText: {
    flex: 1,
    gap: 3,
  },
  mealLabel: {
    fontSize: 17,
    fontWeight: '800',
  },
  insightText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },

  // Streak dots
  streakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  streakDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  streakLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 6,
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  statBox: {
    flex: 1,
    borderRadius: 14,
    padding: 12,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '800',
  },
  statLabel: {
    fontSize: 11,
    fontWeight: '500',
    textAlign: 'center',
  },

  // Foods
  foodsSection: {
    gap: 2,
  },
  foodsTitle: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  foodRank: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  foodRankText: {
    fontSize: 12,
    fontWeight: '800',
  },
  foodInfo: {
    flex: 1,
    gap: 2,
  },
  foodName: {
    fontSize: 14,
    fontWeight: '700',
  },
  foodMeta: {
    fontSize: 12,
  },
  foodCalRight: {
    alignItems: 'flex-end',
  },
  foodCals: {
    fontSize: 16,
    fontWeight: '800',
  },
  foodCalsLabel: {
    fontSize: 11,
  },
});