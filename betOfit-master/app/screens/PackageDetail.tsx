// app/screens/PackageDetail.tsx - WEEKLY SCHEDULE DETAIL
import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  FlatList,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, router } from 'expo-router';

interface DaySchedule {
  day: string;
  workout: string;
  exercises: string[];
  duration: string;
}

export default function PackageDetailScreen() {
  const params = useLocalSearchParams();
  const packageId = params.packageId as string;
  const packageName = params.packageName as string;
  const packageData = JSON.parse(params.packageData as string);
  
  const [weeklySchedule, setWeeklySchedule] = useState<DaySchedule[]>(packageData.weeklySchedule);
  const [selectedDay, setSelectedDay] = useState<DaySchedule | null>(null);
  const [showDayModal, setShowDayModal] = useState(false);
  const [newExercise, setNewExercise] = useState('');

  const handleStartWorkout = (dayIndex: number) => {
    const day = weeklySchedule[dayIndex];
    if (day.workout === 'Rest') {
      Alert.alert('Rest Day', 'Today is a rest day. Take it easy!');
      return;
    }
    
    router.push({
      pathname: '/screens/WorkoutSession',
      params: {
        day: day.day,
        workout: day.workout,
        exercises: JSON.stringify(day.exercises),
        packageId,
        packageName,
      }
    });
  };

  const handleEditDay = (day: DaySchedule) => {
    setSelectedDay(day);
    setShowDayModal(true);
  };

  const handleAddExercise = () => {
    if (!newExercise.trim()) return;
    
    if (selectedDay) {
      const updatedSchedule = weeklySchedule.map(day => 
        day.day === selectedDay.day
          ? { ...day, exercises: [...day.exercises, newExercise] }
          : day
      );
      setWeeklySchedule(updatedSchedule);
      setNewExercise('');
    }
  };

  const handleRemoveExercise = (exerciseIndex: number) => {
    if (selectedDay) {
      const updatedExercises = [...selectedDay.exercises];
      updatedExercises.splice(exerciseIndex, 1);
      
      const updatedSchedule = weeklySchedule.map(day => 
        day.day === selectedDay.day
          ? { ...day, exercises: updatedExercises }
          : day
      );
      setWeeklySchedule(updatedSchedule);
    }
  };

  const renderDayCard = ({ item, index }: { item: DaySchedule, index: number }) => (
    <View style={[
      styles.dayCard,
      item.workout === 'Rest' && styles.restDayCard
    ]}>
      <View style={styles.dayHeader}>
        <View>
          <Text style={styles.dayName}>{item.day}</Text>
          <Text style={[
            styles.workoutName,
            item.workout === 'Rest' && styles.restWorkoutName
          ]}>
            {item.workout}
          </Text>
        </View>
        <Text style={styles.duration}>{item.duration}</Text>
      </View>
      
      {item.workout !== 'Rest' && (
        <>
          <View style={styles.exercisesContainer}>
            {item.exercises.slice(0, 3).map((exercise, idx) => (
              <View key={idx} style={styles.exerciseTag}>
                <Text style={styles.exerciseTagText}>{exercise}</Text>
              </View>
            ))}
            {item.exercises.length > 3 && (
              <View style={styles.moreExercisesTag}>
                <Text style={styles.moreExercisesText}>
                  +{item.exercises.length - 3} more
                </Text>
              </View>
            )}
          </View>
          
          <View style={styles.dayActions}>
            <TouchableOpacity 
              style={styles.editButton}
              onPress={() => handleEditDay(item)}
            >
              <Ionicons name="create-outline" size={18} color="#667eea" />
              <Text style={styles.editButtonText}>Edit</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={[
                styles.startButton,
                { backgroundColor: packageData.color || '#667eea' }
              ]}
              onPress={() => handleStartWorkout(index)}
            >
              <Ionicons name="play" size={18} color="#fff" />
              <Text style={styles.startButtonText}>Start</Text>
            </TouchableOpacity>
          </View>
        </>
      )}
      
      {item.workout === 'Rest' && (
        <View style={styles.restContent}>
          <Ionicons name="bed-outline" size={32} color="#8a8a9e" />
          <Text style={styles.restText}>Recovery Day</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={styles.headerTitle} numberOfLines={1}>{packageName}</Text>
          <Text style={styles.headerSubtitle}>Weekly Schedule</Text>
        </View>
        <TouchableOpacity 
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Text style={styles.headerButtonText}>Change</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Weekly Progress */}
        <View style={styles.weekInfo}>
          <View style={styles.weekStats}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {weeklySchedule.filter(d => d.workout !== 'Rest').length}
              </Text>
              <Text style={styles.statLabel}>Workout Days</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {weeklySchedule.reduce((total, day) => {
                  if (day.duration !== 'Rest') {
                    const mins = parseInt(day.duration);
                    return total + (isNaN(mins) ? 0 : mins);
                  }
                  return total;
                }, 0)}
              </Text>
              <Text style={styles.statLabel}>Total Mins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>
                {weeklySchedule.reduce((total, day) => total + day.exercises.length, 0)}
              </Text>
              <Text style={styles.statLabel}>Exercises</Text>
            </View>
          </View>
          
          <Text style={styles.weekDescription}>
            {packageData.description || 'Complete weekly workout package'}
          </Text>
        </View>

        {/* Weekly Schedule */}
        <FlatList
          data={weeklySchedule}
          renderItem={renderDayCard}
          keyExtractor={(item) => item.day}
          scrollEnabled={false}
          contentContainerStyle={styles.scheduleList}
        />

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="calendar-outline" size={20} color="#667eea" />
            <Text style={styles.actionButtonText}>Add to Calendar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionButton}>
            <Ionicons name="share-outline" size={20} color="#667eea" />
            <Text style={styles.actionButtonText}>Share Plan</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Day Modal */}
      <Modal
        visible={showDayModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowDayModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Edit {selectedDay?.day} - {selectedDay?.workout}
              </Text>
              <TouchableOpacity onPress={() => setShowDayModal(false)}>
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>
            
            {selectedDay && (
              <ScrollView style={styles.modalBody}>
                {/* Exercises List */}
                <Text style={styles.modalSectionTitle}>Exercises</Text>
                {selectedDay.exercises.length > 0 ? (
                  selectedDay.exercises.map((exercise, index) => (
                    <View key={index} style={styles.exerciseItem}>
                      <View style={styles.exerciseNumber}>
                        <Text style={styles.exerciseNumberText}>{index + 1}</Text>
                      </View>
                      <Text style={styles.exerciseText}>{exercise}</Text>
                      <TouchableOpacity 
                        style={styles.removeButton}
                        onPress={() => handleRemoveExercise(index)}
                      >
                        <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                      </TouchableOpacity>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noExercisesText}>No exercises added yet</Text>
                )}
                
                {/* Add Exercise */}
                <View style={styles.addExerciseContainer}>
                  <TextInput
                    style={styles.exerciseInput}
                    placeholder="Add new exercise..."
                    placeholderTextColor="#888"
                    value={newExercise}
                    onChangeText={setNewExercise}
                  />
                  <TouchableOpacity 
                    style={styles.addExerciseButton}
                    onPress={handleAddExercise}
                  >
                    <Ionicons name="add" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.modalSaveButton}
                onPress={() => setShowDayModal(false)}
              >
                <Text style={styles.modalSaveText}>Save Changes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerTitleContainer: { flex: 1, marginHorizontal: 16 },
  headerTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#333',
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 2,
  },
  headerButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#667eea',
  },
  scrollContent: { padding: 20, paddingBottom: 40 },
  weekInfo: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  weekStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '800', color: '#333', marginBottom: 4 },
  statLabel: { fontSize: 12, color: '#666' },
  statDivider: { width: 1, height: 40, backgroundColor: '#f0f0f0' },
  weekDescription: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  scheduleList: { paddingBottom: 16 },
  dayCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  restDayCard: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  dayName: { fontSize: 16, fontWeight: '700', color: '#333' },
  workoutName: { fontSize: 14, color: '#667eea', fontWeight: '600', marginTop: 2 },
  restWorkoutName: { color: '#8a8a9e' },
  duration: {
    fontSize: 13,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  exercisesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  exerciseTag: {
    backgroundColor: '#f0f7ff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  exerciseTagText: { fontSize: 12, color: '#007AFF' },
  moreExercisesTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  moreExercisesText: { fontSize: 12, color: '#666' },
  dayActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    flex: 1,
    marginRight: 12,
    justifyContent: 'center',
  },
  editButtonText: { fontSize: 14, color: '#667eea', fontWeight: '600', marginLeft: 6 },
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    flex: 2,
    justifyContent: 'center',
  },
  startButtonText: { fontSize: 14, color: '#fff', fontWeight: '600', marginLeft: 6 },
  restContent: {
    alignItems: 'center',
    paddingVertical: 20,
  },
  restText: {
    fontSize: 14,
    color: '#8a8a9e',
    marginTop: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  actionButtonText: { fontSize: 14, color: '#667eea', fontWeight: '600', marginLeft: 8 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#333', flex: 1 },
  modalBody: { padding: 20 },
  modalSectionTitle: { fontSize: 16, fontWeight: '600', color: '#333', marginBottom: 16 },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  exerciseNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  exerciseNumberText: { fontSize: 12, fontWeight: '700', color: '#666' },
  exerciseText: { flex: 1, fontSize: 15, color: '#333' },
  removeButton: { padding: 8 },
  noExercisesText: {
    fontSize: 14,
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
    paddingVertical: 20,
  },
  addExerciseContainer: {
    flexDirection: 'row',
    marginTop: 20,
  },
  exerciseInput: {
    flex: 1,
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
    fontSize: 15,
    color: '#333',
    marginRight: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  addExerciseButton: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: '#667eea',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalFooter: { padding: 20 },
  modalSaveButton: {
    backgroundColor: '#667eea',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalSaveText: { fontSize: 16, color: '#fff', fontWeight: '600' },
});