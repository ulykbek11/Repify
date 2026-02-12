import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase, DEV_MODE } from '../lib/supabase';
import { Lock, Mail, Target, ArrowRight, Activity, Eye, EyeOff } from 'lucide-react-native';
import { CustomAlert } from '../components/CustomAlert';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true); // Start with loading true to check session
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

  useEffect(() => {
    checkSession();
  }, []);

  async function checkSession() {
    try {
      console.log('Checking session...');

      // 🔥 DEV MODE: Skip Supabase session check, show login screen
      if (DEV_MODE) {
        console.log('⚡ DEV_MODE enabled - showing login screen without session check');
        setLoading(false);
        return;
      }

      // Create a promise that rejects after 5 seconds
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session check timeout')), 5000)
      );

      // Race the session check against the timeout
      const { data: { session } } = await Promise.race([
        supabase.auth.getSession(),
        timeoutPromise
      ]);

      if (session) {
        console.log('Session found, redirecting...');
        handleNavigation(session.user);
      } else {
        console.log('No session found');
        setLoading(false);
      }
    } catch (error) {
      console.error('Session check failed:', error);
      // On error or timeout, allow manual login
      setLoading(false);
      if (error.message === 'Session check timeout') {
        // Optional: Show a toast or small alert about timeout, or just let them log in
        console.log('Session check timed out, falling back to login screen');
      }
    }
  }

  function handleNavigation(user) {
    const metadata = user?.user_metadata || {};

    // Navigation logic:
    // 1. If onboarding completed → Main
    // 2. If calibration completed or skipped (calibrated exists) → Onboarding
    // 3. If new user (no calibration field) → Calibration

    if (metadata.onboarding_completed) {
      navigation.replace('Main');
    } else if ('calibrated' in metadata) {
      navigation.replace('Onboarding');
    } else {
      navigation.replace('Calibration');
    }
  }

  async function signInWithEmail() {
    if (!email || !password) {
      showAlert('Ошибка', 'Пожалуйста, заполните все поля', 'error');
      return;
    }

    setLoading(true);

    // 🔥 DEV MODE: Skip Supabase authentication
    if (DEV_MODE) {
      console.log('⚡ DEV_MODE enabled - bypassing Supabase login');
      setTimeout(() => {
        setLoading(false);
        navigation.replace('Main');
      }, 500);
      return;
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      showAlert('Ошибка', error.message, 'error');
      setLoading(false);
    } else {
      handleNavigation(data.user);
      // Don't set loading false here as we are navigating away
    }
  }

  if (loading && !email && !password) {
    // Initial loading screen
    return (
      <View style={{ flex: 1, backgroundColor: '#0A0E1A', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#FF6B00" />
        <Text style={{ color: '#8B8E98', marginTop: 16, fontSize: 16 }}>Загрузка...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={alertConfig.onConfirm}
      />

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <View style={styles.header}>
          <View style={styles.logoWrapper}>
            <Image
              source={require('../../assets/logo.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>
          <Text style={styles.title}>Repify</Text>
          <Text style={styles.subtitle}>Твой путь к совершенству</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Mail color="#8B8E98" size={20} />
            <TextInput
              style={styles.input}
              placeholder="Email"
              placeholderTextColor="#8B8E98"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
            />
          </View>

          <View style={styles.inputGroup}>
            <Lock color="#8B8E98" size={20} />
            <TextInput
              style={styles.input}
              placeholder="Пароль"
              placeholderTextColor="#8B8E98"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
            />
            <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.iconButton}>
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
            style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <View style={styles.primaryButtonContent}>
                <Text style={styles.primaryButtonText}>Войти</Text>
                <ArrowRight color="white" size={20} />
              </View>
            )}
          </TouchableOpacity>

        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Нет аккаунта? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.footerLink}>Создать</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoWrapper: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  subtitle: {
    fontSize: 18,
    color: '#8B8E98',
    textAlign: 'center',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    backgroundColor: '#252A3B',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  input: {
    flex: 1,
    marginLeft: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  iconButton: {
    paddingLeft: 8,
    paddingVertical: 4,
  },
  primaryButton: {
    backgroundColor: '#FF6B00',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: '#FF6B00',
    shadowOpacity: 0.35,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 32,
  },
  footerText: {
    color: '#8B8E98',
    fontSize: 16,
  },
  footerLink: {
    color: '#FF6B00',
    fontWeight: '700',
    fontSize: 16,
  },
});
