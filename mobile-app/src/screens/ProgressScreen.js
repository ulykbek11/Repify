import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Activity, Target, TrendingUp, Calendar, Award } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProgressScreen() {
  const [user, setUser] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setMetadata(user?.user_metadata || {});
    setLoading(false);
  }

  useEffect(() => {
    fetchUser();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUser();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 bg-background items-center justify-center">
        <Activity color="#FF6B00" size={40} />
      </SafeAreaView>
    );
  }

  const goalLabel = {
    muscle_gain: 'Набор массы',
    weight_loss: 'Похудение',
    maintenance: 'Поддержание'
  };

  const levelLabel = {
    beginner: 'Новичок',
    intermediate: 'Средний',
    advanced: 'Продвинутый'
  };

  const startWeight = metadata?.weight || 70;
  const targetWeight = metadata?.goal === 'muscle_gain' ? startWeight + 5 : (metadata?.goal === 'weight_loss' ? startWeight - 5 : startWeight);
  const currentWeight = startWeight; // Mock current progress
  
  // Calculate progress percentage (mock)
  const progress = 15; // 15% progress

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView 
        className="flex-1 px-6 pt-4"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B00" />}
      >
        <Text className="text-3xl font-bold text-white mb-6">Мой Прогресс</Text>

        {/* Main Goal Card */}
        <LinearGradient
            colors={['#FF6B00', '#FF3B5C']}
            className="p-6 rounded-3xl mb-8"
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
        >
            <View className="flex-row justify-between items-start mb-4">
                <View>
                    <Text className="text-white/80 text-sm font-semibold mb-1">ГЛАВНАЯ ЦЕЛЬ</Text>
                    <Text className="text-white text-2xl font-bold">{goalLabel[metadata?.goal] || 'Тренировки'}</Text>
                </View>
                <View className="bg-white/20 p-2 rounded-xl">
                    <Target color="white" size={24} />
                </View>
            </View>
            
            <View className="mb-2">
                <View className="flex-row justify-between mb-2">
                    <Text className="text-white font-medium">Прогресс</Text>
                    <Text className="text-white font-bold">{progress}%</Text>
                </View>
                <View className="w-full h-3 bg-black/20 rounded-full overflow-hidden">
                    <View style={{ width: `${progress}%` }} className="h-full bg-white rounded-full" />
                </View>
            </View>

            <Text className="text-white/80 text-xs mt-2">Вы на верном пути! Продолжайте тренироваться.</Text>
        </LinearGradient>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap justify-between mb-8">
            <View className="w-[48%] bg-surface p-4 rounded-2xl mb-4 border border-white/5">
                <View className="bg-primary/10 w-10 h-10 rounded-full items-center justify-center mb-3">
                    <TrendingUp color="#FF6B00" size={20} />
                </View>
                <Text className="text-muted text-xs font-bold uppercase mb-1">Текущий вес</Text>
                <Text className="text-2xl font-bold text-white">{currentWeight} кг</Text>
            </View>

            <View className="w-[48%] bg-surface p-4 rounded-2xl mb-4 border border-white/5">
                <View className="bg-secondary/10 w-10 h-10 rounded-full items-center justify-center mb-3">
                    <Target color="#00FF87" size={20} />
                </View>
                <Text className="text-muted text-xs font-bold uppercase mb-1">Цель</Text>
                <Text className="text-2xl font-bold text-white">{targetWeight} кг</Text>
            </View>

            <View className="w-[48%] bg-surface p-4 rounded-2xl border border-white/5">
                <View className="bg-blue-500/10 w-10 h-10 rounded-full items-center justify-center mb-3">
                    <Activity color="#3B82F6" size={20} />
                </View>
                <Text className="text-muted text-xs font-bold uppercase mb-1">Уровень</Text>
                <Text className="text-lg font-bold text-white">{levelLabel[metadata?.level] || 'Новичок'}</Text>
            </View>

             <View className="w-[48%] bg-surface p-4 rounded-2xl border border-white/5">
                <View className="bg-purple-500/10 w-10 h-10 rounded-full items-center justify-center mb-3">
                    <Award color="#A855F7" size={20} />
                </View>
                <Text className="text-muted text-xs font-bold uppercase mb-1">Посещений</Text>
                <Text className="text-2xl font-bold text-white">0</Text>
            </View>
        </View>

        {/* Recent Activity Mock */}
        <View className="mb-8">
            <Text className="text-white text-xl font-bold mb-4">Активность</Text>
            <View className="bg-surface rounded-2xl p-4 border border-white/5 items-center py-8">
                <Text className="text-muted text-center">Пока нет завершенных тренировок</Text>
            </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}
