import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Lock, Mail, User, ArrowLeft, Eye, EyeOff, Activity } from 'lucide-react-native';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  async function signUpWithEmail() {
    if (!email || !password || !fullName) {
      Alert.alert('Ошибка', 'Пожалуйста, заполните все поля');
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    });

    if (error) {
      Alert.alert('Ошибка', error.message);
      setLoading(false);
    } else {
      Alert.alert(
        'Регистрация успешна',
        'На вашу почту отправлено письмо для подтверждения аккаунта. Пожалуйста, перейдите по ссылке в письме.',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('Login'),
          },
        ]
      );
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background px-8">
      <TouchableOpacity 
        onPress={() => navigation.goBack()}
        className="mt-4 mb-8 w-10 h-10 bg-surface rounded-full items-center justify-center border border-white/5"
      >
        <ArrowLeft color="white" size={20} />
      </TouchableOpacity>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text className="text-3xl font-bold text-white mb-2">Создать аккаунт</Text>
        <Text className="text-muted text-lg mb-8">Начни свой путь к успеху сегодня</Text>

        <View className="space-y-4">
          <View className="bg-surface rounded-2xl flex-row items-center px-4 py-4 border border-white/5">
            <User color="#8B8E98" size={20} />
            <TextInput
              className="flex-1 ml-3 text-white text-base"
              placeholder="Полное имя"
              placeholderTextColor="#8B8E98"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

          <View className="bg-surface rounded-2xl flex-row items-center px-4 py-4 border border-white/5">
            <Mail color="#8B8E98" size={20} />
            <TextInput
              className="flex-1 ml-3 text-white text-base"
              placeholder="Email"
              placeholderTextColor="#8B8E98"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View className="bg-surface rounded-2xl flex-row items-center px-4 py-4 border border-white/5">
            <Lock color="#8B8E98" size={20} />
            <TextInput
              className="flex-1 ml-3 text-white text-base"
              placeholder="Пароль"
              placeholderTextColor="#8B8E98"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
              {showPassword ? (
                <EyeOff color="#8B8E98" size={20} />
              ) : (
                <Eye color="#8B8E98" size={20} />
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity 
            onPress={signUpWithEmail}
            disabled={loading}
            className="bg-primary h-14 rounded-2xl items-center justify-center shadow-lg shadow-primary/30 mt-6"
          >
            {loading ? (
              <Activity size={24} color="white" />
            ) : (
              <Text className="text-white font-bold text-lg">Зарегистрироваться</Text>
            )}
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center mt-8">
          <Text className="text-muted text-base">Уже есть аккаунт? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text className="text-primary font-bold text-base">Войти</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
