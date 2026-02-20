import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, CheckCircle, Clock, Play } from 'lucide-react-native';

export default function WorkoutDayScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { day } = route.params || {};

  const [exercises, setExercises] = useState([]);

  useEffect(() => {
    if (day && day.exercises) {
        // Map simple string exercises to detailed objects if needed
        const mappedExercises = day.exercises.map((exName, index) => ({
            id: index + 1,
            title: exName,
            muscle: 'Мышцы', // Generic placeholder
            type: 'Упражнение',
            sets: day.sets || 3,
            reps: day.reps || '10',
            rest: 60,
            status: index === 0 ? 'in_progress' : 'pending'
        }));
        setExercises(mappedExercises);
    } else {
        // Fallback default
        setExercises([
            { id: 1, title: 'Жим штанги лёжа', muscle: 'Грудь', type: 'Базовое', sets: 4, reps: 10, rest: 90, status: 'completed' },
            { id: 2, title: 'Жим гантелей на наклонной', muscle: 'Грудь', type: 'Изоляция', sets: 3, reps: 12, rest: 60, status: 'in_progress' },
        ]);
    }
  }, [day]);

  const completedCount = exercises.filter(e => e.status === 'completed').length;
  const progress = exercises.length > 0 ? (completedCount / exercises.length) * 100 : 0;
  const dayTitle = day?.day || 'Тренировка';

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <LinearGradient
        colors={['#1A1F2E', '#0A0E1A']}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
                <ChevronLeft color="white" size={24} />
            </TouchableOpacity>
            <View>
                <Text style={styles.headerTitle}>{dayTitle}</Text>
                <Text style={styles.headerSubtitle}>{exercises.length} упражнений • ~45 минут</Text>
            </View>
        </View>

        <View style={styles.progressInfo}>
            <Text style={styles.progressText}>Прогресс</Text>
            <Text style={styles.progressText}>{completedCount}/{exercises.length} упражнений</Text>
        </View>
        <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
        </View>
      </LinearGradient>

      {/* Exercises List */}
      <ScrollView style={styles.scrollContent}>
        {exercises.map((exercise, index) => (
            <View 
                key={exercise.id} 
                style={[
                    styles.exerciseCard,
                    exercise.status === 'in_progress' ? styles.borderActive : styles.borderInactive
                ]}
            >
                <View style={styles.cardHeader}>
                    <View>
                        <Text style={styles.cardTitle}>{index + 1}. {exercise.title}</Text>
                        <Text style={styles.cardSubtitle}>{exercise.muscle} • {exercise.type}</Text>
                    </View>
                    {exercise.status === 'completed' && (
                        <CheckCircle color="#22C55E" size={20} fill="#22C55E20" />
                    )}
                </View>

                <View style={styles.separator} />

                <View style={styles.cardBody}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.detailsText}>{exercise.sets} подхода × {exercise.reps}</Text>
                        <Text style={styles.cardSubtitle}>Отдых: {exercise.rest} сек</Text>
                    </View>
                    {/* Placeholder for GIF/Image */}
                    <View style={styles.placeholderImage} />
                </View>

                <View style={styles.actionsContainer}>
                    <TouchableOpacity 
                        style={[
                            styles.actionButton,
                            exercise.status === 'completed' ? styles.buttonCompleted : styles.buttonActive
                        ]}
                        onPress={() => navigation.navigate('Exercise', { exercise: exercise.id })} // Assuming ExerciseScreen handles the actual workout
                    >
                        {exercise.status !== 'completed' && <Play color="white" size={16} fill="white" />}
                        <Text style={exercise.status === 'completed' ? styles.buttonTextCompleted : styles.buttonTextActive}>
                            {exercise.status === 'completed' ? 'Выполнено' : exercise.status === 'in_progress' ? 'Продолжить' : 'Начать'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.helpButton}>
                        <Text style={styles.helpButtonText}>?</Text>
                    </TouchableOpacity>
                </View>
            </View>
        ))}
        <View style={styles.bottomPadding} /> {/* Bottom padding */}
      </ScrollView>

      {/* Fixed Bottom Action */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{completedCount} из {exercises.length} завершено</Text>
        <TouchableOpacity 
            style={[
                styles.finishButton,
                completedCount === exercises.length ? styles.buttonActive : styles.buttonCompleted
            ]}
            disabled={completedCount !== exercises.length}
            onPress={() => navigation.replace('Main')} // Go to Main after finishing workout
        >
            <Text style={completedCount === exercises.length ? styles.finishButtonTextActive : styles.finishButtonTextDisabled}>Завершить тренировку</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  headerGradient: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  progressBarBg: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#FF6B00',
    borderRadius: 999,
  },
  scrollContent: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  exerciseCard: {
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  borderActive: {
    borderColor: '#FF6B00',
  },
  borderInactive: {
    borderColor: 'rgba(255,255,255,0.05)',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cardSubtitle: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  separator: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
  },
  cardBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 16,
  },
  detailsText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  placeholderImage: {
    width: 80,
    height: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  buttonCompleted: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  buttonActive: {
    backgroundColor: '#FF6B00',
  },
  buttonTextCompleted: {
    color: '#9CA3AF',
    fontWeight: 'bold',
  },
  buttonTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  helpButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  helpButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  bottomPadding: {
    height: 96,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1A1F2E',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  footerText: {
    color: '#9CA3AF',
    textAlign: 'center',
    fontSize: 14,
    marginBottom: 12,
  },
  finishButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishButtonTextDisabled: {
    color: 'rgba(255,255,255,0.3)',
    fontWeight: 'bold',
    fontSize: 18,
  },
  finishButtonTextActive: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
