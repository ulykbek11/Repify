import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Activity, Lock, Mail, User as UserIcon, UserRound } from 'lucide-react-native';
import { colors, radius } from '../theme';
import { useLanguage } from '../i18n';
import { useAuth } from '../lib/auth';
import { isCloudAuth } from '../lib/auth';
import { Button, LanguageSwitch } from '../components/ui';

function Field({ icon: Icon, ...props }) {
  return (
    <View style={styles.field}>
      <Icon size={20} color={colors.muted} />
      <TextInput placeholderTextColor={colors.muted} autoCapitalize="none" style={styles.input} {...props} />
    </View>
  );
}

export default function AuthScreen() {
  const { t } = useLanguage();
  const { signIn, signUp, guest } = useAuth();
  const [mode, setMode] = useState('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null); // { type, text }

  const register = mode === 'register';

  async function submit() {
    setMessage(null);
    if (!email.trim() || (isCloudAuth && !password) || (register && !name.trim())) {
      return setMessage({ type: 'error', text: t('auth.errFields') });
    }
    if (isCloudAuth && password.length < 6) {
      return setMessage({ type: 'error', text: t('auth.errPassword') });
    }
    setBusy(true);
    try {
      if (register) {
        const outcome = await signUp(email.trim(), password, name.trim());
        if (outcome === 'confirm-email') {
          setMessage({ type: 'info', text: t('auth.checkEmail') });
          setMode('login');
        }
      } else {
        await signIn(email.trim(), password);
      }
    } catch (error) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.langRow}>
            <LanguageSwitch />
          </View>

          <View style={styles.brand}>
            <View style={styles.logo}>
              <Activity size={36} color="#fff" />
            </View>
            <Text style={styles.title}>{t('app.name')}</Text>
            <Text style={styles.tagline}>{t('auth.tagline')}</Text>
          </View>

          {register ? <Field icon={UserIcon} placeholder={t('auth.name')} value={name} onChangeText={setName} autoCapitalize="words" /> : null}
          <Field icon={Mail} placeholder={t('auth.email')} value={email} onChangeText={setEmail} keyboardType="email-address" />
          {isCloudAuth ? (
            <Field icon={Lock} placeholder={t('auth.password')} value={password} onChangeText={setPassword} secureTextEntry />
          ) : null}

          {message ? (
            <Text style={[styles.message, { color: message.type === 'error' ? colors.danger : colors.success }]}>{message.text}</Text>
          ) : null}

          <Button title={register ? t('auth.register') : t('auth.login')} onPress={submit} loading={busy} style={{ marginTop: 8 }} />

          {!isCloudAuth ? (
            <>
              <Button title={t('auth.guest')} variant="ghost" icon={UserRound} onPress={guest} style={{ marginTop: 12 }} />
              <Text style={styles.note}>{t('auth.demoNote')}</Text>
            </>
          ) : null}

          <View style={styles.footer}>
            <Text style={styles.footerText}>{register ? t('auth.haveAccount') : t('auth.noAccount')} </Text>
            <TouchableOpacity onPress={() => { setMode(register ? 'login' : 'register'); setMessage(null); }}>
              <Text style={styles.footerLink}>{register ? t('auth.login') : t('auth.register')}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center', flexGrow: 1, justifyContent: 'center' },
  langRow: { alignItems: 'flex-end', marginBottom: 12 },
  brand: { alignItems: 'center', marginBottom: 32 },
  logo: { width: 72, height: 72, borderRadius: 22, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { color: colors.text, fontSize: 34, fontWeight: '800' },
  tagline: { color: colors.muted, fontSize: 15, marginTop: 6, textAlign: 'center' },
  field: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
  input: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 15, outlineStyle: 'none' },
  message: { fontSize: 14, marginBottom: 8, textAlign: 'center' },
  note: { color: colors.muted, fontSize: 12.5, textAlign: 'center', marginTop: 14, lineHeight: 18 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 24 },
  footerText: { color: colors.muted, fontSize: 15 },
  footerLink: { color: colors.primary, fontSize: 15, fontWeight: '700' },
});
