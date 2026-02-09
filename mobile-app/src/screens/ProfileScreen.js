import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, RefreshControl, Switch, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Settings, LogOut, ChevronRight, Calendar, TrendingUp, BookOpen, User as UserIcon, Bell, Crown, HelpCircle, X, Check } from 'lucide-react-native';
import { supabase } from '../lib/supabase';

export default function ProfileScreen() {
  const navigation = useNavigation();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // States for features
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [proModalVisible, setProModalVisible] = useState(false);
  const [helpModalVisible, setHelpModalVisible] = useState(false);

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
  const avatarUrl = user?.user_metadata?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=500&q=80';

  return (
    <SafeAreaView className="flex-1 bg-background">
      {/* Pro Subscription Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={proModalVisible}
        onRequestClose={() => setProModalVisible(false)}
      >
        <View className="flex-1 justify-end bg-black/50">
          <View className="bg-[#1A1F2E] rounded-t-3xl p-6 h-[70%] border-t border-white/10">
            <View className="flex-row justify-between items-center mb-6">
                <Text className="text-2xl font-bold text-white">Repify Pro</Text>
                <TouchableOpacity onPress={() => setProModalVisible(false)} className="p-2">
                    <X color="white" size={24} />
                </TouchableOpacity>
            </View>
            
            <ScrollView showsVerticalScrollIndicator={false}>
                <View className="items-center mb-8">
                    <View className="w-20 h-20 bg-primary/20 rounded-full items-center justify-center mb-4">
                        <Crown color="#FF6B00" size={40} />
                    </View>
                    <Text className="text-white text-center text-lg mb-2">Открой полный потенциал</Text>
                    <Text className="text-muted text-center">Персональные планы, детальная аналитика и отсутствие ограничений.</Text>
                </View>

                <View className="space-y-4 mb-8">
                    {['Безлимитный анализ техники', 'Генерация сложных программ', 'Статистика за все время', 'Приоритетная поддержка'].map((feature, i) => (
                        <View key={i} className="flex-row items-center space-x-3">
                            <View className="bg-green-500/20 p-1 rounded-full">
                                <Check color="#22C55E" size={16} />
                            </View>
                            <Text className="text-white text-base">{feature}</Text>
                        </View>
                    ))}
                </View>

                <TouchableOpacity className="bg-primary w-full py-4 rounded-xl items-center mb-4">
                    <Text className="text-white font-bold text-lg">Оформить за 299₽ / мес</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setProModalVisible(false)}>
                    <Text className="text-muted text-center">Восстановить покупки</Text>
                </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Help Modal */}
      <Modal
        animationType="fade"
        transparent={true}
        visible={helpModalVisible}
        onRequestClose={() => setHelpModalVisible(false)}
      >
        <View className="flex-1 justify-center items-center bg-black/80 px-6">
          <View className="bg-[#1A1F2E] w-full rounded-3xl p-6 border border-white/10">
            <View className="flex-row justify-between items-center mb-6">
                <Text className="text-xl font-bold text-white">Помощь и поддержка</Text>
                <TouchableOpacity onPress={() => setHelpModalVisible(false)} className="p-2">
                    <X color="white" size={24} />
                </TouchableOpacity>
            </View>
            
            <Text className="text-white mb-4">Свяжитесь с нами, если у вас возникли вопросы или предложения:</Text>
            
            <View className="bg-surface p-4 rounded-xl mb-4">
                <Text className="text-muted text-xs uppercase mb-1">Email поддержки</Text>
                <Text className="text-primary text-lg font-bold">support@repify.app</Text>
            </View>

            <View className="bg-surface p-4 rounded-xl mb-6">
                <Text className="text-muted text-xs uppercase mb-1">Telegram основателя</Text>
                <Text className="text-blue-400 text-lg font-bold">@bekmy_dev</Text>
            </View>

            <TouchableOpacity 
                onPress={() => setHelpModalVisible(false)}
                className="bg-white/10 w-full py-3 rounded-xl items-center"
            >
                <Text className="text-white font-bold">Закрыть</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView 
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
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
               source={{ uri: avatarUrl }} 
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
          
          {/* My Data */}
          <TouchableOpacity 
            onPress={() => navigation.navigate('EditProfile')}
            className="bg-card p-4 rounded-2xl border border-white/5 flex-row items-center justify-between"
          >
            <View className="flex-row items-center space-x-3">
                <View className="bg-blue-500/10 p-2 rounded-full">
                    <UserIcon color="#3B82F6" size={20} />
                </View>
                <Text className="text-white font-medium">Мои данные</Text>
            </View>
            <ChevronRight color="#8B8E98" size={20} />
          </TouchableOpacity>

          {/* Notifications */}
          <View className="bg-card p-4 rounded-2xl border border-white/5 flex-row items-center justify-between">
            <View className="flex-row items-center space-x-3">
                <View className="bg-yellow-500/10 p-2 rounded-full">
                    <Bell color="#EAB308" size={20} />
                </View>
                <Text className="text-white font-medium">Уведомления</Text>
            </View>
            <Switch 
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#3f3f46', true: '#FF6B00' }}
                thumbColor={notificationsEnabled ? '#fff' : '#f4f3f4'}
            />
          </View>

          {/* Pro Subscription */}
          <TouchableOpacity 
            onPress={() => setProModalVisible(true)}
            className="bg-card p-4 rounded-2xl border border-white/5 flex-row items-center justify-between"
          >
            <View className="flex-row items-center space-x-3">
                <View className="bg-purple-500/10 p-2 rounded-full">
                    <Crown color="#A855F7" size={20} />
                </View>
                <Text className="text-white font-medium">Подписка Pro</Text>
            </View>
            <View className="flex-row items-center">
                <Text className="text-primary text-xs mr-2 font-bold">UPGRADE</Text>
                <ChevronRight color="#8B8E98" size={20} />
            </View>
          </TouchableOpacity>

          {/* Help */}
          <TouchableOpacity 
            onPress={() => setHelpModalVisible(true)}
            className="bg-card p-4 rounded-2xl border border-white/5 flex-row items-center justify-between"
          >
            <View className="flex-row items-center space-x-3">
                <View className="bg-green-500/10 p-2 rounded-full">
                    <HelpCircle color="#22C55E" size={20} />
                </View>
                <Text className="text-white font-medium">Помощь</Text>
            </View>
            <ChevronRight color="#8B8E98" size={20} />
          </TouchableOpacity>

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
