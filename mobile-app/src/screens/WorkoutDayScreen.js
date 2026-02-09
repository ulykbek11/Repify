import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image } from 'react-native';
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
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <LinearGradient
        colors={['#1A1F2E', '#0A0E1A']}
        className="px-6 py-4 border-b border-white/5"
      >
        <View className="flex-row items-center mb-4">
            <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2 mr-2">
                <ChevronLeft color="white" size={24} />
            </TouchableOpacity>
            <View>
                <Text className="text-white text-xl font-bold">{dayTitle}</Text>
                <Text className="text-white/60 text-sm">{exercises.length} упражнений • ~45 минут</Text>
            </View>
        </View>

        <View className="flex-row justify-between mb-2">
            <Text className="text-white/60 text-xs">Прогресс</Text>
            <Text className="text-white/60 text-xs">{completedCount}/{exercises.length} упражнений</Text>
        </View>
        <View className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <View className="h-full bg-primary rounded-full" style={{ width: `${progress}%` }} />
        </View>
      </LinearGradient>

      {/* Exercises List */}
      <ScrollView className="flex-1 px-4 py-4">
        {exercises.map((exercise, index) => (
            <View 
                key={exercise.id} 
                className={`bg-surface rounded-2xl p-4 mb-3 border ${exercise.status === 'in_progress' ? 'border-primary' : 'border-white/5'}`}
            >
                <View className="flex-row justify-between items-start mb-3">
                    <View>
                        <Text className="text-white text-lg font-bold mb-1">{index + 1}. {exercise.title}</Text>
                        <Text className="text-muted text-sm">{exercise.muscle} • {exercise.type}</Text>
                    </View>
                    {exercise.status === 'completed' && (
                        <CheckCircle color="#22C55E" size={20} fill="#22C55E20" />
                    )}
                </View>

                <View className="h-[1px] w-full bg-white/5 mb-3" />

                <View className="flex-row items-center space-x-4 mb-4">
                    <View className="flex-1">
                        <Text className="text-white text-base font-semibold">{exercise.sets} подхода × {exercise.reps}</Text>
                        <Text className="text-muted text-sm">Отдых: {exercise.rest} сек</Text>
                    </View>
                    {/* Placeholder for GIF/Image */}
                    <View className="w-20 h-12 bg-white/5 rounded-lg" />
                </View>

                <View className="flex-row space-x-3">
                    <TouchableOpacity 
                        className={`flex-1 h-12 rounded-xl items-center justify-center flex-row space-x-2 ${exercise.status === 'completed' ? 'bg-white/10' : 'bg-primary'}`}
                        onPress={() => navigation.navigate('Exercise', { exercise: exercise.id })} // Assuming ExerciseScreen handles the actual workout
                    >
                        {exercise.status !== 'completed' && <Play color="white" size={16} fill="white" />}
                        <Text className={`font-bold ${exercise.status === 'completed' ? 'text-muted' : 'text-white'}`}>
                            {exercise.status === 'completed' ? 'Выполнено' : exercise.status === 'in_progress' ? 'Продолжить' : 'Начать'}
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity className="w-12 h-12 rounded-xl bg-white/5 items-center justify-center border border-white/5">
                        <Text className="text-white font-bold">?</Text>
                    </TouchableOpacity>
                </View>
            </View>
        ))}
        <View className="h-24" /> {/* Bottom padding */}
      </ScrollView>

      {/* Fixed Bottom Action */}
      <View className="absolute bottom-0 left-0 right-0 bg-[#1A1F2E] p-4 border-t border-white/5">
        <Text className="text-muted text-center text-sm mb-3">{completedCount} из {exercises.length} завершено</Text>
        <TouchableOpacity 
            className={`w-full h-14 rounded-2xl items-center justify-center ${completedCount === exercises.length ? 'bg-primary' : 'bg-white/10'}`}
            disabled={completedCount !== exercises.length}
            onPress={() => navigation.replace('Main')} // Go to Main after finishing workout
        >
            <Text className={`font-bold text-lg ${completedCount === exercises.length ? 'text-white' : 'text-white/30'}`}>Завершить тренировку</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
