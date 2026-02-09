import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Lock, Mail, User, ArrowLeft, Eye, EyeOff, Activity } from 'lucide-react-native';
import { CustomAlert } from '../components/CustomAlert';

export default function RegisterScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);
  
  // Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', onConfirm: () => {} });

  const navigation = useNavigation();

  const showAlert = (title, message, type = 'info', onConfirm = null) => {
    setAlertConfig({ 
        title, 
        message, 
        type, 
        onConfirm: onConfirm || (() => setAlertVisible(false)) 
    });
    setAlertVisible(true);
  };

  async function handleRegister() {
    if (!email || !password || !fullName) {
      showAlert('Ошибка', 'Пожалуйста, заполните все поля', 'error');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          // We'll set these later in Onboarding
          onboarding_completed: false
        },
      },
    });

    setLoading(false);

    if (error) {
      showAlert('Ошибка', error.message, 'error');
    } else {
      // Check if user identity exists (duplicate email check)
      if (data.user && data.user.identities && data.user.identities.length === 0) {
         showAlert('Ошибка', 'Пользователь с таким email уже существует.', 'error');
         return;
      }

      showAlert(
        'Подтверждение почты',
        'На вашу почту отправлено письмо для подтверждения. Пожалуйста, подтвердите почту перед входом.',
        'success',
        () => {
            setAlertVisible(false);
            navigation.navigate('Login');
        }
      );
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background px-8">
      <CustomAlert 
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={alertConfig.onConfirm}
      />
      
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
        </View>

        <TouchableOpacity
          onPress={handleRegister}
          disabled={loading}
          className="w-full bg-primary py-4 rounded-2xl mt-8 flex-row justify-center items-center"
        >
          {loading ? (
            <Activity color="white" size={20} />
          ) : (
            <Text className="text-white font-bold text-lg">Зарегистрироваться</Text>
          )}
        </TouchableOpacity>

        <View className="flex-row justify-center mt-6">
          <Text className="text-muted text-base">Уже есть аккаунт? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text className="text-primary font-bold text-base">Войти</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
