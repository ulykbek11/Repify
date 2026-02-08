import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, Calendar, Clock, TrendingUp } from 'lucide-react-native';

export default function PlanSuccessScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1">
        {/* Hero Section */}
        <LinearGradient
          colors={['#FF6B00', '#FF3B5C']}
          className="px-8 py-12 rounded-b-[40px] items-center"
        >
          <View className="w-16 h-16 bg-white/20 rounded-full items-center justify-center mb-4 backdrop-blur-md">
            <CheckCircle color="white" size={32} />
          </View>
          <Text className="text-white text-3xl font-bold mb-2 text-center">Твой План Готов!</Text>
          <Text className="text-white/80 text-base text-center">Программа на 12 недель</Text>
        </LinearGradient>

        {/* Plan Overview Card */}
        <View className="bg-surface mx-4 -mt-8 rounded-3xl p-6 shadow-xl border border-white/5">
          <Text className="text-white text-xl font-bold mb-6">Твоя программа</Text>
          
          <View className="flex-row justify-between mb-6">
            <View className="items-center flex-1">
                <Calendar color="#FF6B00" size={24} className="mb-2" />
                <Text className="text-muted text-xs text-center">3 дня/нед</Text>
            </View>
            <View className="w-[1px] h-full bg-white/10" />
            <View className="items-center flex-1">
                <Clock color="#FF6B00" size={24} className="mb-2" />
                <Text className="text-muted text-xs text-center">45-60 мин</Text>
            </View>
            <View className="w-[1px] h-full bg-white/10" />
            <View className="items-center flex-1">
                <TrendingUp color="#FF6B00" size={24} className="mb-2" />
                <Text className="text-muted text-xs text-center">Набор массы</Text>
            </View>
          </View>

          <View className="h-[1px] w-full bg-white/5 mb-6" />

          <Text className="text-muted text-sm mb-2">Следующая тренировка:</Text>
          <Text className="text-white text-lg font-bold mb-1">День 1: Грудь + Трицепс</Text>
          <Text className="text-muted text-sm">6 упражнений • 18 подходов</Text>
        </View>

        {/* Exercises Preview */}
        <View className="mt-8">
            <Text className="text-white text-lg font-bold px-6 mb-4">Предпросмотр плана</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 pb-8">
                {[1, 2, 3].map((day) => (
                    <View key={day} className="w-[280px] bg-surface rounded-2xl p-4 mr-3 border border-white/5">
                        <Text className="text-white text-lg font-bold mb-3">День {day}: {day === 1 ? 'Грудь' : day === 2 ? 'Спина' : 'Ноги'}</Text>
                        <View className="space-y-2">
                            <Text className="text-muted text-sm">• Жим лёжа 4x10</Text>
                            <Text className="text-muted text-sm">• Разводка 3x12</Text>
                            <Text className="text-muted text-sm">• Отжимания 3x15</Text>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
      </ScrollView>

      {/* Footer Buttons */}
      <View className="p-6 bg-background border-t border-white/5">
        <TouchableOpacity 
            className="w-full bg-primary h-14 rounded-2xl items-center justify-center shadow-lg shadow-primary/30 mb-4"
            onPress={() => navigation.navigate('WorkoutDay')}
        >
            <Text className="text-white font-bold text-lg">Начать первую тренировку</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
            className="w-full h-10 items-center justify-center"
            onPress={() => navigation.navigate('FullPlan')}
        >
            <Text className="text-muted text-base">Посмотреть весь план</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
