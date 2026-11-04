import assert from 'node:assert/strict';
import test from 'node:test';
import { generateSmartSuggestion } from '../app/utils/smartsuggestionengine';

test('suggests a workout when over the calorie goal on a workout day', () => {
  const suggestion = generateSmartSuggestion({
    todayName: 'Monday',
    workoutDays: ['Monday', 'Wednesday'],
    todayEaten: 2400,
    adjustedGoal: 2000,
    todayBurned: 0,
  });

  assert.equal(suggestion?.title, 'Burn Extra Calories!');
  assert.equal(suggestion?.actionRoute, '/(tabs)/exercise-library');
});

test('suggests refueling after a workout when far below the calorie goal', () => {
  const suggestion = generateSmartSuggestion({
    todayName: 'Monday',
    workoutDays: ['Monday'],
    todayEaten: 1500,
    adjustedGoal: 2000,
    todayBurned: 300,
  });

  assert.equal(suggestion?.title, 'Great Workout! Refuel!');
  assert.equal(suggestion?.actionRoute, '/(tabs)/calories');
});

test('encourages recovery on a rest day within the calorie goal', () => {
  const suggestion = generateSmartSuggestion({
    todayName: 'Sunday',
    workoutDays: ['Monday', 'Wednesday'],
    todayEaten: 1800,
    adjustedGoal: 2000,
    todayBurned: 0,
  });

  assert.equal(suggestion?.title, 'Perfect Rest Day!');
  assert.equal(suggestion?.action, null);
});
