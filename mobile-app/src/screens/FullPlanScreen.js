import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronLeft, ChevronDown, ChevronUp, Settings, PlayCircle } from 'lucide-react-native';

export default function FullPlanScreen() {
  const navigation = useNavigation();
  const [expandedWeek, setExpandedWeek] = useState(1);

  const weeks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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
            <Text className="text-white/80 text-base mb-4">Набор мышечной массы</Text>
            
            <View className="flex-row justify-between items-center mb-2">
                <Text className="text-white text-sm font-semibold">Неделя 1 из 12</Text>
                <Text className="text-white text-sm font-semibold">8%</Text>
            </View>
            <View className="w-full h-2 bg-black/20 rounded-full overflow-hidden">
                <View className="h-full w-[8%] bg-white rounded-full" />
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
                            <Text className="text-white text-lg font-bold">Неделя {week}: {week === 1 ? 'Адаптация' : 'Прогрессия'}</Text>
                            <Text className="text-muted text-sm">3 тренировки</Text>
                        </View>
                        {expandedWeek === week ? (
                            <ChevronUp color="#8B8E98" size={20} />
                        ) : (
                            <ChevronDown color="#8B8E98" size={20} />
                        )}
                    </TouchableOpacity>

                    {expandedWeek === week && (
                        <View className="px-4 pb-4 space-y-3">
                            {[1, 2, 3].map((day) => (
                                <View key={day} className="bg-[#2A2F3E] rounded-xl p-3">
                                    <View className="flex-row justify-between items-start mb-2">
                                        <View>
                                            <Text className="text-white font-semibold mb-1">День {day}: {day === 1 ? 'Грудь + Трицепс' : day === 2 ? 'Спина + Бицепс' : 'Ноги + Плечи'}</Text>
                                            <Text className="text-muted text-xs">6 упражнений • 45 мин</Text>
                                        </View>
                                        <View className={`px-2 py-1 rounded-full ${day === 1 ? 'bg-primary/20' : 'bg-white/5'}`}>
                                            <Text className={`text-[10px] font-bold ${day === 1 ? 'text-primary' : 'text-muted'}`}>
                                                {day === 1 ? 'В процессе' : 'Не начато'}
                                            </Text>
                                        </View>
                                    </View>
                                    
                                    <TouchableOpacity 
                                        className="bg-primary h-10 rounded-lg flex-row items-center justify-center space-x-2 mt-2"
                                        onPress={() => navigation.navigate('WorkoutDay')}
                                    >
                                        <PlayCircle color="white" size={16} fill="white" />
                                        <Text className="text-white font-bold text-sm">
                                            {day === 1 ? 'Продолжить' : 'Начать'}
                                        </Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>
                    )}
                </View>
            ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
