import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ArrowLeft, User, Lock, Save, Camera, CreditCard, Loader2 } from 'lucide-react-native';
import { CustomAlert } from '../components/CustomAlert';

export default function EditProfileScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [password, setPassword] = useState('');
  
  // Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', onConfirm: () => {} });

  const showAlert = (title, message, type = 'info', onConfirm = null) => {
    setAlertConfig({ 
        title, 
        message, 
        type, 
        onConfirm: onConfirm || (() => setAlertVisible(false)) 
    });
    setAlertVisible(true);
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  async function fetchUserData() {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setFullName(user.user_metadata?.full_name || '');
        setAvatarUrl(user.user_metadata?.avatar_url || '');
      }
    } catch (error) {
      console.error('Error fetching user:', error);
    }
  }

  async function handleUpdateProfile() {
    setLoading(true);
    try {
      const updates = {
        data: {
            full_name: fullName,
            avatar_url: avatarUrl,
        }
      };

      if (password && password.length > 0) {
        updates.password = password;
      }

      const { error } = await supabase.auth.updateUser(updates);

      if (error) throw error;

      showAlert('Успех', 'Профиль успешно обновлен', 'success', () => {
        setAlertVisible(false);
        navigation.goBack();
      });
    } catch (error) {
      showAlert('Ошибка', error.message, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background">
      <CustomAlert 
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={alertConfig.onConfirm}
      />
      
      <View className="px-6 py-4 flex-row items-center space-x-4 border-b border-white/5">
        <TouchableOpacity onPress={() => navigation.goBack()} className="w-10 h-10 bg-surface rounded-full items-center justify-center">
          <ArrowLeft color="white" size={24} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-white">Редактировать профиль</Text>
      </View>

      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        className="flex-1"
      >
        <ScrollView className="flex-1 px-6 pt-6">
          
          {/* Avatar Section */}
          <View className="items-center mb-8">
            <View className="w-28 h-28 bg-surface rounded-full border-2 border-primary items-center justify-center overflow-hidden mb-4 relative">
               {avatarUrl ? (
                 <Image source={{ uri: avatarUrl }} className="w-full h-full" />
               ) : (
                 <User color="#8B8E98" size={48} />
               )}
            </View>
            <View className="w-full">
                <Text className="text-white mb-2 ml-1">Ссылка на аватар</Text>
                <View className="bg-surface rounded-xl flex-row items-center px-4 py-3 border border-white/5">
                    <Camera color="#8B8E98" size={20} />
                    <TextInput 
                        className="flex-1 ml-3 text-white text-base"
                        placeholder="https://example.com/avatar.jpg"
                        placeholderTextColor="#52525B"
                        value={avatarUrl}
                        onChangeText={setAvatarUrl}
                        autoCapitalize="none"
                    />
                </View>
            </View>
          </View>

          {/* Name Field */}
          <View className="mb-6">
            <Text className="text-white mb-2 ml-1">Имя пользователя</Text>
            <View className="bg-surface rounded-xl flex-row items-center px-4 py-3 border border-white/5">
                <User color="#8B8E98" size={20} />
                <TextInput 
                    className="flex-1 ml-3 text-white text-base"
                    placeholder="Ваше имя"
                    placeholderTextColor="#52525B"
                    value={fullName}
                    onChangeText={setFullName}
                />
            </View>
          </View>

          {/* Password Field */}
          <View className="mb-6">
            <Text className="text-white mb-2 ml-1">Новый пароль</Text>
            <View className="bg-surface rounded-xl flex-row items-center px-4 py-3 border border-white/5">
                <Lock color="#8B8E98" size={20} />
                <TextInput 
                    className="flex-1 ml-3 text-white text-base"
                    placeholder="Оставьте пустым, если не меняете"
                    placeholderTextColor="#52525B"
                    value={password}
                    onChangeText={setPassword}
                    secureTextEntry
                />
            </View>
          </View>

          {/* Payment Methods (Future) */}
          <View className="mb-8 opacity-50">
            <Text className="text-white mb-2 ml-1">Способы оплаты (Скоро)</Text>
            <View className="bg-surface rounded-xl flex-row items-center px-4 py-3 border border-dashed border-white/20">
                <CreditCard color="#8B8E98" size={20} />
                <Text className="ml-3 text-muted text-base">Привязка карты недоступна</Text>
            </View>
          </View>

        </ScrollView>

        {/* Save Button */}
        <View className="p-6 border-t border-white/5 bg-background">
          <TouchableOpacity 
            onPress={handleUpdateProfile}
            disabled={loading}
            className="w-full bg-primary h-14 rounded-2xl items-center justify-center shadow-lg shadow-primary/30 flex-row space-x-2"
          >
            {loading ? (
                <Loader2 size={24} color="white" className="animate-spin" />
            ) : (
                <>
                    <Save color="white" size={20} />
                    <Text className="text-white font-bold text-lg">Сохранить</Text>
                </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}