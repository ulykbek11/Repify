import React from 'react';
import { View, Text, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, CheckCircle, AlertTriangle, Home, Share2, User } from 'lucide-react-native';

export default function AnalysisResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { result } = route.params || {};

  // Default mock data if no result passed (for testing UI)
  const data = result || {
    reps: 12,
    errors: [
      { feedback: "Держите спину ровнее" },
      { feedback: "Колени не должны выходить за носки" }
    ],
    status: "good",
    biomechanics_context: null
  };

  // Only calculate score if reps were performed
  const hasReps = (data.reps || 0) > 0;
  // Use provided score or calculate
  const score = data.score !== undefined ? data.score : (hasReps ? Math.max(0, 100 - ((data.errors?.length || 0) * 15)) : null);
  const isPerfect = score !== null && score >= 90;

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View className="px-6 py-4 flex-row items-center justify-between">
          <TouchableOpacity
            onPress={() => navigation.navigate('Main')}
            className="w-10 h-10 bg-card rounded-full items-center justify-center border border-white/5"
          >
            <ArrowLeft color="white" size={20} />
          </TouchableOpacity>
          <Text className="text-white font-bold text-lg">Результаты</Text>
          <TouchableOpacity className="w-10 h-10 bg-card rounded-full items-center justify-center border border-white/5">
            <Share2 color="white" size={20} />
          </TouchableOpacity>
        </View>

        {/* Score Section */}
        <View className="items-center mt-4 mb-8">
          <View className="w-48 h-48 rounded-full border-[12px] border-card items-center justify-center relative shadow-[0_0_50px_rgba(255,107,0,0.2)]">
            {score !== null && <View className="absolute inset-0 rounded-full border-[12px] border-primary opacity-100" style={{ borderLeftColor: 'transparent', borderBottomColor: 'transparent', transform: [{ rotate: '45deg' }] }} />}
            <Text className="text-muted text-sm uppercase font-bold tracking-widest mb-1">Оценка</Text>
            <Text className="text-white text-7xl font-extrabold tracking-tighter">
              {score !== null ? score : 'N/A'}
            </Text>
          </View>
          <Text className="text-white text-2xl font-bold mt-6">
            {score === null ? 'Повторений не обнаружено' : isPerfect ? 'Отличная работа!' : 'Есть над чем работать'}
          </Text>
        </View>

        {/* Stats Grid */}
        <View className="flex-row px-6 space-x-4 mb-8">
          <View className="flex-1 bg-card p-4 rounded-2xl border border-white/5 items-center">
            <Text className="text-4xl font-bold text-white mb-1">{data.reps || 0}</Text>
            <Text className="text-muted text-xs uppercase font-bold">Повторений</Text>
          </View>
          <View className="flex-1 bg-card p-4 rounded-2xl border border-white/5 items-center">
            <Text className="text-4xl font-bold text-error mb-1">{data.errors?.length || 0}</Text>
            <Text className="text-muted text-xs uppercase font-bold">Ошибок</Text>
          </View>
        </View>

        {/* Genetic Context Info */}
        {data.biomechanics_context && (
          <View className="px-6 mb-8">
             <View className="bg-primary/10 p-4 rounded-2xl border border-primary/20 flex-row items-center">
                <View className="bg-primary/20 p-2 rounded-full mr-3">
                    <User color="#FF6B00" size={20} />
                </View>
                <View>
                    <Text className="text-primary font-bold text-base">Учтена генетика</Text>
                    <Text className="text-muted text-xs">
                        {data.biomechanics_context.body_type === 'ectomorph' ? 'Анализ для длинных конечностей' : 
                         data.biomechanics_context.body_type === 'endomorph' ? 'Анализ для массивного телосложения' :
                         'Стандартный биомеханический профиль'}
                    </Text>
                </View>
             </View>
          </View>
        )}

        {/* Feedback List */}
        <View className="px-6">
          <Text className="text-white text-lg font-bold mb-4">Анализ техники</Text>
          {data.errors && data.errors.length > 0 ? (
            data.errors.map((err, index) => (
              <View key={index} className="bg-card p-4 rounded-2xl border border-white/5 mb-3 flex-row items-start space-x-3">
                <View className="bg-error/10 p-2 rounded-full mt-1">
                  <AlertTriangle color="#FF3B5C" size={20} />
                </View>
                <View className="flex-1">
                  <Text className="text-white font-bold text-base mb-1">Ошибка #{index + 1}</Text>
                  <Text className="text-muted leading-5">{err.feedback}</Text>
                </View>
              </View>
            ))
          ) : (
            <View className="bg-card p-6 rounded-2xl border border-white/5 items-center">
              <View className="bg-secondary/10 p-4 rounded-full mb-3">
                <CheckCircle color="#00FF87" size={32} />
              </View>
              <Text className="text-white font-bold text-lg mb-1">Техника идеальна</Text>
              <Text className="text-muted text-center">Вы не совершили ни одной ошибки. Так держать!</Text>
            </View>
          )}
        </View>

        <View className="px-6 mt-8">
          <TouchableOpacity
            onPress={() => navigation.navigate('Main')}
            className="bg-primary py-4 rounded-2xl items-center shadow-lg shadow-primary/20"
          >
            <Text className="text-white font-bold text-lg">Завершить тренировку</Text>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
