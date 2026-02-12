import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { supabase, DEV_MODE } from '../lib/supabase';
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
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', onConfirm: () => { } });

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

    // 🔥 DEV MODE: Skip Supabase registration
    if (DEV_MODE) {
      console.log('⚡ DEV_MODE enabled - bypassing Supabase registration');
      setTimeout(() => {
        setLoading(false);
        showAlert(
          'Успех',
          'Аккаунт создан! (DEV MODE)',
          'success',
          () => {
            setAlertVisible(false);
            navigation.replace('Main');
          }
        );
      }, 500);
      return;
    }

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
    <SafeAreaView style={styles.container}>
      <CustomAlert
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={alertConfig.onConfirm}
      />

      <TouchableOpacity
        onPress={() => navigation.goBack()}
        style={styles.backButton}
      >
        <ArrowLeft color="white" size={20} />
      </TouchableOpacity>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Text style={styles.title}>Создать аккаунт</Text>
        <Text style={styles.subtitle}>Начни свой путь к успеху сегодня</Text>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <User color="#8B8E98" size={20} />
            <TextInput
              style={styles.input}
              placeholder="Полное имя"
              placeholderTextColor="#8B8E98"
              value={fullName}
              onChangeText={setFullName}
            />
          </View>

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
        </View>

        <TouchableOpacity
          onPress={handleRegister}
          disabled={loading}
          style={[styles.primaryButton, loading && styles.primaryButtonDisabled]}
        >
          {loading ? (
            <Activity color="white" size={20} />
          ) : (
            <Text style={styles.primaryButtonText}>Зарегистрироваться</Text>
          )}
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>Уже есть аккаунт? </Text>
          <TouchableOpacity onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerLink}>Войти</Text>
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
    paddingHorizontal: 32,
  },
  backButton: {
    marginTop: 16,
    marginBottom: 32,
    width: 40,
    height: 40,
    backgroundColor: '#252A3B',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#8B8E98',
    marginBottom: 32,
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
    width: '100%',
    backgroundColor: '#FF6B00',
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 32,
    alignItems: 'center',
    shadowColor: '#FF6B00',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  primaryButtonDisabled: {
    opacity: 0.7,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 24,
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
