import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Settings, LogOut, ChevronRight, Calendar, TrendingUp, BookOpen } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
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

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigation.replace('Login');
  }

  const fullName = user?.user_metadata?.full_name || 'Пользователь';
  const email = user?.email || '';

  return (
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView 
        className="flex-1"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B00" />}
      >
        {/* Header */}
        <View className="px-6 py-4 flex-row items-center justify-between">
          <Text className="text-2xl font-bold text-white">Профиль</Text>
          <TouchableOpacity className="w-10 h-10 bg-card rounded-full items-center justify-center border border-white/5">
            <Settings color="white" size={20} />
          </TouchableOpacity>
        </View>

        {/* User Info */}
        <View className="px-6 items-center mb-8">
          <View className="w-24 h-24 bg-card rounded-full items-center justify-center border-2 border-primary mb-4 overflow-hidden">
             <Image 
               source={{ uri: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80' }} 
               className="w-full h-full"
             />
          </View>
          <Text className="text-white text-xl font-bold mb-1">{fullName}</Text>
          <Text className="text-muted">{email}</Text>
        </View>

        {/* Stats Overview */}
        <View className="px-6 flex-row space-x-3 mb-8">
          <View className="flex-1 bg-card p-4 rounded-2xl border border-white/5">
             <View className="bg-primary/10 w-10 h-10 rounded-full items-center justify-center mb-3">
               <TrendingUp color="#FF6B00" size={20} />
             </View>
             <Text className="text-3xl font-bold text-white">0</Text>
             <Text className="text-muted text-xs font-bold uppercase">Тренировок</Text>
          </View>
          <View className="flex-1 bg-card p-4 rounded-2xl border border-white/5">
             <View className="bg-secondary/10 w-10 h-10 rounded-full items-center justify-center mb-3">
               <Calendar color="#00FF87" size={20} />
             </View>
             <Text className="text-3xl font-bold text-white">0</Text>
             <Text className="text-muted text-xs font-bold uppercase">Часов</Text>
          </View>
        </View>

        {/* Menu Items */}
        <View className="px-6 space-y-3">
          <Text className="text-white text-lg font-bold mb-2">Настройки</Text>

          {/* Plan Link */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('FullPlan')}
            className="bg-card p-4 rounded-2xl border border-white/5 flex-row items-center justify-between"
          >
            <View className="flex-row items-center space-x-3">
                <View className="bg-primary/10 p-2 rounded-full">
                    <BookOpen color="#FF6B00" size={20} />
                </View>
                <Text className="text-white font-medium">Моя Программа</Text>
            </View>
            <ChevronRight color="#8B8E98" size={20} />
          </TouchableOpacity>
          
          {['Мои данные', 'Уведомления', 'Подписка Pro', 'Помощь'].map((item) => (
            <TouchableOpacity key={item} className="bg-card p-4 rounded-2xl border border-white/5 flex-row items-center justify-between">
              <Text className="text-white font-medium">{item}</Text>
              <ChevronRight color="#8B8E98" size={20} />
            </TouchableOpacity>
          ))}

          <TouchableOpacity 
            onPress={handleSignOut}
            className="bg-error/10 p-4 rounded-2xl border border-error/20 flex-row items-center justify-center mt-4 space-x-2"
          >
            <LogOut color="#FF3B5C" size={20} />
            <Text className="text-error font-bold">Выйти</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
