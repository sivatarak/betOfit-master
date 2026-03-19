// app/scripts/extractCache.tsx

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy'; // ✅ Use legacy import
import * as Sharing from 'expo-sharing';

export const extractCacheToFile = async () => {
  try {
    console.log('🔍 Starting cache extraction...');
    
    const cached = await AsyncStorage.getItem('ALL_EXERCISES_CACHE');
    
    if (!cached) {
      console.log('❌ No cache found!');
      return;
    }
    
    const parsed = JSON.parse(cached);
    const exercises = parsed.exercises || [];
    
    console.log(`✅ Found ${exercises.length} exercises in cache`);
    
    // Group by body part
    const byBodyPart: { [key: string]: any[] } = {};
    exercises.forEach((ex: any) => {
      const bodyPart = ex.bodyPart || ex.muscle || 'unknown';
      if (!byBodyPart[bodyPart]) {
        byBodyPart[bodyPart] = [];
      }
      byBodyPart[bodyPart].push(ex);
    });
    
    console.log('\n📊 CACHE SUMMARY:');
    Object.entries(byBodyPart).forEach(([part, exs]) => {
      console.log(`  ${part}: ${exs.length} exercises`);
    });
    
    // Create JSON data
    const jsonData = {
      totalExercises: exercises.length,
      extractedAt: new Date().toISOString(),
      byBodyPart: byBodyPart,
      allExercises: exercises
    };
    
    // Save to file
    const fileUri = FileSystem.documentDirectory + 'cached_exercises.json';
    await FileSystem.writeAsStringAsync(
      fileUri,
      JSON.stringify(jsonData, null, 2)
    );
    
    console.log('✅ File created:', fileUri);
    console.log('📁 Location:', fileUri);
    
    // Share file
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(fileUri);
      console.log('📤 File shared!');
    }
    
    return jsonData;
    
  } catch (error) {
    console.error('❌ Error extracting cache:', error);
  }
};

export const checkCacheContents = async () => {
  try {
    const cached = await AsyncStorage.getItem('ALL_EXERCISES_CACHE');
    
    if (!cached) {
      console.log('❌ No cache found');
      return null;
    }
    
    const parsed = JSON.parse(cached);
    const exercises = parsed.exercises || [];
    
    console.log('\n📦 CACHE CONTENTS:');
    console.log('Total exercises:', exercises.length);
    console.log('Cache timestamp:', new Date(parsed.timestamp).toLocaleString());
    
    // Show first 10 exercises
    console.log('\n📋 First 10 exercises:');
    exercises.slice(0, 10).forEach((ex: any, i: number) => {
      console.log(`${i + 1}. ${ex.name}`);
      console.log(`   Body: ${ex.bodyPart}, Target: ${ex.target}, Equipment: ${ex.equipment}`);
    });
    
    // Show unique values
    const bodyParts = [...new Set(exercises.map((ex: any) => ex.bodyPart))];
    const equipment = [...new Set(exercises.map((ex: any) => ex.equipment))];
    const targets = [...new Set(exercises.map((ex: any) => ex.target))];
    const difficulties = [...new Set(exercises.map((ex: any) => ex.difficulty))];
    
    console.log('\n🎯 Body Parts:', bodyParts);
    console.log('🏋️ Equipment:', equipment);
    console.log('💪 Targets:', targets);
    console.log('📊 Difficulties:', difficulties);
    
    // Show sample structure
    console.log('\n📄 Sample Exercise Structure:');
    console.log(JSON.stringify(exercises[0], null, 2));
    
    // EXPORT ALL EXERCISES TO CONSOLE (for you to copy)
    console.log('\n========== ALL 300 EXERCISES (COPY THIS) ==========');
    console.log(JSON.stringify(exercises, null, 2));
    console.log('========== END OF DATA ==========');
    
    return {
      count: exercises.length,
      exercises: exercises,
      bodyParts: bodyParts,
      equipment: equipment,
      targets: targets,
      difficulties: difficulties
    };
    
  } catch (error) {
    console.error('Error:', error);
    return null;
  }
};

// New function: Just dump all exercises to console
export const dumpExercisesToConsole = async () => {
  try {
    const cached = await AsyncStorage.getItem('ALL_EXERCISES_CACHE');
    if (!cached) return;
    
    const parsed = JSON.parse(cached);
    const exercises = parsed.exercises || [];
    
    console.log('========== START: ALL EXERCISES ==========');
    console.log(JSON.stringify(exercises, null, 2));
    console.log('========== END: ALL EXERCISES ==========');
    console.log(`\nTotal: ${exercises.length} exercises`);
    console.log('Copy everything between START and END!');
    
  } catch (error) {
    console.error('Error:', error);
  }
};