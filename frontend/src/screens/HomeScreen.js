import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Camera, ChevronRight, Dumbbell, FlaskConical, ScanLine, Sparkles, TrendingUp } from 'lucide-react-native';
import { colors } from '../theme';
import { useLanguage } from '../i18n';
import { useAuth } from '../lib/auth';
import { API_URL } from '../config';
import { getHealth, sampleAnalysis } from '../lib/api';
import { Button, Card, LanguageSwitch, SectionTitle } from '../components/ui';

export default function HomeScreen() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const navigation = useNavigation();
  const [health, setHealth] = useState(null); // { engine } | 'offline'
  const [sampleBusy, setSampleBusy] = useState(false);
  const [sampleError, setSampleError] = useState(null);

  useEffect(() => {
    getHealth().then(setHealth).catch(() => setHealth('offline'));
  }, []);

  const runSample = useCallback(async () => {
    setSampleBusy(true);
    setSampleError(null);
    try {
      const result = await sampleAnalysis('squat', language);
      navigation.navigate('Result', { result, exercise: 'squat' });
    } catch (error) {
      setSampleError(t('exercise.errNetwork'));
    } finally {
      setSampleBusy(false);
    }
  }, [language, navigation, t]);

  const exercises = [
    { id: 'squat', title: t('home.squat'), desc: t('home.squatDesc'), icon: Dumbbell },
    { id: 'deadlift', title: t('home.deadlift'), desc: t('home.deadliftDesc'), icon: TrendingUp },
  ];
  const steps = [
    { icon: Camera, text: t('home.step1') },
    { icon: ScanLine, text: t('home.step2') },
    { icon: Sparkles, text: t('home.step3') },
  ];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.greeting}>{t('home.greeting', { name: user?.name || t('profile.user') })}</Text>
            <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
          </View>
          <LanguageSwitch />
        </View>

        {health === 'offline' ? (
          <Text style={[styles.status, { color: colors.danger }]}>{t('home.offline', { url: API_URL })}</Text>
        ) : health ? (
          <Text style={styles.status}>{t(`home.engine.${health.engine === 'gemini' ? 'gemini' : 'local'}`)}</Text>
        ) : null}

        <SectionTitle>{t('home.choose')}</SectionTitle>
        {exercises.map(({ id, title, desc, icon: Icon }) => (
          <TouchableOpacity key={id} activeOpacity={0.85} onPress={() => navigation.navigate('Exercise', { exercise: id })} accessibilityRole="button" accessibilityLabel={title}>
            <Card style={styles.exercise}>
              <View style={styles.iconBox}><Icon size={26} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.exerciseTitle}>{title}</Text>
                <Text style={styles.exerciseDesc}>{desc}</Text>
              </View>
              <ChevronRight size={22} color={colors.muted} />
            </Card>
          </TouchableOpacity>
        ))}

        <Card style={{ marginTop: 8 }}>
          <View style={styles.sampleHeader}>
            <FlaskConical size={22} color={colors.primary} />
            <Text style={styles.exerciseTitle}>{t('home.sample')}</Text>
          </View>
          <Text style={[styles.exerciseDesc, { marginVertical: 10 }]}>{t('home.sampleDesc')}</Text>
          {sampleError ? <Text style={[styles.status, { color: colors.danger }]}>{sampleError}</Text> : null}
          <Button title={sampleBusy ? t('home.sampleRunning') : t('home.sample')} variant="ghost" onPress={runSample} loading={sampleBusy} />
        </Card>

        <View style={{ marginTop: 28 }}>
          <SectionTitle>{t('home.how')}</SectionTitle>
          {steps.map(({ icon: Icon, text }, i) => (
            <View key={i} style={styles.step}>
              <View style={styles.stepIcon}><Icon size={18} color={colors.primary} /></View>
              <Text style={styles.stepText}>{text}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  greeting: { color: colors.text, fontSize: 26, fontWeight: '800' },
  subtitle: { color: colors.muted, fontSize: 15, marginTop: 6, lineHeight: 21 },
  status: { color: colors.muted, fontSize: 12.5, marginVertical: 10 },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 12 },
  iconBox: { width: 52, height: 52, borderRadius: 16, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  exerciseTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  exerciseDesc: { color: colors.muted, fontSize: 14, marginTop: 3, lineHeight: 20 },
  sampleHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  stepIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 14.5, flex: 1, lineHeight: 20 },
});
