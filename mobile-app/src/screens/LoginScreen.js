import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { Lock, Mail, Target, ArrowRight, Activity, Eye, EyeOff } from 'lucide-react-native';
import { CustomAlert } from '../components/CustomAlert';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigation = useNavigation();

  // Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', onConfirm: () => { } });

  const showAlert = (title, message, type = 'info', onConfirm = null) => {
    setAlertConfig({
      title,
      message,
      type,
      onConfirm: onConfirm || (() => setAlertVisible(false))
    });
    setAlertVisible(true);
  };

  async function signInWithEmail() {
    if (!email || !password) {
      showAlert('Ошибка', 'Пожалуйста, заполните все поля', 'error');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showAlert('Ошибка', error.message, 'error');
      setLoading(false);
    } else {
      const metadata = data.user?.user_metadata || {};

      // Navigation logic:
      // 1. If onboarding completed → Main
      // 2. If calibration completed or skipped (calibrated exists) → Onboarding
      // 3. If new user (no calibration field) → Calibration

      if (metadata.onboarding_completed) {
        // User finished everything
        navigation.replace('Main');
      } else if ('calibrated' in metadata) {
        // User has calibration status (true or false), go to Onboarding
        navigation.replace('Onboarding');
      } else {
        // New user, no calibration yet
        navigation.replace('Calibration');
      }

      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-background justify-center px-8">
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={alertConfig.onConfirm}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View className="items-center mb-12">
          <View className="w-24 h-24 items-center justify-center mb-6">
            <Image
              source={require('../../assets/logo.png')}
              className="w-full h-full"
              resizeMode="contain"
            />
          </View>
          <Text className="text-4xl font-bold text-white mb-2 tracking-tight">Repify</Text>
          <Text className="text-muted text-center text-lg">Твой путь к совершенству</Text>
        </View>

        <View className="space-y-4">
          <View className="bg-surface rounded-2xl flex-row items-center px-4 py-4 border border-white/5 focus:border-primary">
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
            onPress={signInWithEmail}
            disabled={loading}
            className="bg-primary h-14 rounded-2xl items-center justify-center shadow-lg shadow-primary/30 mt-4 flex-row space-x-2"
          >
            {loading ? (
              <Activity size={24} color="white" className="animate-spin" />
            ) : (
              <>
                <Text className="text-white font-bold text-lg">Войти</Text>
                <ArrowRight color="white" size={20} />
              </>
            )}
          </TouchableOpacity>
        </View>

        <View className="flex-row justify-center mt-8">
          <Text className="text-muted text-base">Нет аккаунта? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text className="text-primary font-bold text-base">Создать</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
