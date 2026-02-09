import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronDown, ChevronUp, Settings, PlayCircle } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

export default function FullPlanScreen() {
  const navigation = useNavigation();
  const [expandedWeek, setExpandedWeek] = useState(1);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.user_metadata?.workout_plan) {
        setPlan(user.user_metadata.workout_plan);
      }
      setLoading(false);
    }
    fetchPlan();
  }, []);

  const weeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <ActivityIndicator color="#FF6B00" />
      </SafeAreaView>
    );
  }

  const goalLabel = {
    muscle_gain: 'Набор массы',
    weight_loss: 'Похудение',
    maintenance: 'Поддержание'
  };

  const currentGoal = plan?.goal ? goalLabel[plan.goal] : 'Общая подготовка';
  const schedule = plan?.schedule || [];

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Header */}
      <View className="flex-row items-center justify-between px-6 py-4 border-b border-white/5 bg-background z-10">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2">
            <ChevronLeft color="white" size={24} />
        </TouchableOpacity>
        <Text className="text-white text-lg font-bold">Программа тренировок</Text>
        <TouchableOpacity onPress={() => navigation.navigate('PlanSettings')} className="p-2 -mr-2">
            <Settings color="white" size={24} />
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-4 pt-4">
        {/* Summary Card */}
        <LinearGradient
            colors={['#FF6B00', '#FF3B5C']}
            className="p-6 rounded-3xl mb-6"
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <Text className="text-white text-2xl font-bold mb-1">12-недельная программа</Text>
            <Text className="text-white/80 text-base mb-4">{currentGoal}</Text>
            
            <View className="flex-row justify-between items-center mb-2">
                <Text className="text-white text-sm font-semibold">Неделя 1 из 12</Text>
                <Text className="text-white text-sm font-semibold">0%</Text>
            </View>
            <View className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
                <View className="h-full w-[0%] bg-white rounded-full" />
            </View>
        </LinearGradient>

        {/* Weeks Accordion */}
        <View className="pb-10">
            {weeks.map((week) => (
                <View key={week} className="bg-surface rounded-2xl mb-3 overflow-hidden border border-white/5">
                    <TouchableOpacity 
                        className="p-4 flex-row items-center justify-between"
                        onPress={() => setExpandedWeek(expandedWeek === week ? null : week)}
                    >
                        <View>
                            <Text className="text-white text-lg font-bold">Неделя {week}</Text>
                            <Text className="text-muted text-sm">{schedule.length} тренировки</Text>
                        </View>
                        {expandedWeek === week ? (
                            <ChevronUp color="#8B8E98" size={20} />
                        ) : (
                            <ChevronDown color="#8B8E98" size={20} />
                        )}
                    </TouchableOpacity>

                    {expandedWeek === week && (
                        <View className="px-4 pb-4 space-y-3">
                            {schedule.length > 0 ? (
                                schedule.map((day, index) => (
                                    <View key={index} className="bg-[#2A2F3E] rounded-xl p-3">
                                        <View className="flex-row justify-between items-start mb-2">
                                            <View>
                                                <Text className="text-white font-semibold mb-1">{day.day}</Text>
                                                <Text className="text-muted text-xs">{day.exercises.length} упражнений • {day.sets} подхода • {day.reps}</Text>
                                            </View>
                                            <View className={`px-2 py-1 rounded-full bg-white/5`}>
                                                <Text className={`text-[10px] font-bold text-muted`}>
                                                    Не начато
                                                </Text>
                                            </View>
                                        </View>
                                        
                                        <TouchableOpacity 
                                            className="bg-primary h-10 rounded-lg flex-row items-center justify-center space-x-2 mt-2"
                                            onPress={() => navigation.navigate('WorkoutDay', { day })}
                                        >
                                            <PlayCircle color="white" size={16} fill="white" />
                                            <Text className="text-white font-bold text-sm">
                                                Начать
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                ))
                            ) : (
                                <Text className="text-muted text-center py-4">План не найден. Пройдите опрос в настройках.</Text>
                            )}
                        </View>
                    )}
                </View>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
