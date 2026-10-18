import React, { useEffect, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, CheckCircle2, ScanLine, Upload, Video } from 'lucide-react-native';
import { colors } from '../theme';
import { useLanguage } from '../i18n';
import { ApiError, analyze, extractPoses, getExercises } from '../lib/api';
import { useService } from '../lib/service';
import { useProfile } from '../lib/profile';
import { EXERCISE_ICONS, isHold } from '../data/exercises';
import { Button, Card, SectionTitle } from '../components/ui';
import ServiceBanner from '../components/ServiceBanner';
import LiveCamera, { liveCameraSupported } from '../components/LiveCamera';

export default function ExerciseScreen() {
  const { t, language } = useLanguage();
  const navigation = useNavigation();
  const { exercise } = useRoute().params;
  const { profile } = useProfile();
  const service = useService();
  const [stage, setStage] = useState(null); // null | 'extracting' | 'analyzing'
  const [progress, setProgress] = useState(null); // { fraction, phase }
  const [error, setError] = useState(null);
  const [spec, setSpec] = useState(null);

  // Counting thresholds for the live rep counter come from the backend registry.
  useEffect(() => {
    if (service.state !== 'ready') return;
    getExercises().then((list) => setSpec(list.find((e) => e.id === exercise) || null)).catch(() => setSpec(null));
  }, [service.state, exercise]);

  function fail(e) {
    if (e instanceof ApiError && (e.kind === 'network' || e.kind === 'config')) setError(t('exercise.errNetwork'));
    else if (e instanceof ApiError && e.status === 422) setError(t('exercise.errNoPerson'));
    else setError(t('exercise.errFailed', { message: e.message }));
  }

  async function analyzeLandmarks(poseSequence) {
    setError(null);
    setStage('analyzing');
    try {
      const result = await analyze({ poseSequence, exercise, language, heightCm: profile.heightCm });
      navigation.navigate('Result', { result, exercise });
    } catch (e) {
      fail(e);
    } finally {
      setStage(null);
    }
  }

  async function process(asset) {
    setError(null);
    try {
      setStage('extracting');
      setProgress({ fraction: 0, phase: 'model' });
      const poseSequence = await extractPoses(asset, (fraction, phase) => setProgress({ fraction, phase }));
      setProgress(null);
      await analyzeLandmarks(poseSequence);
    } catch (e) {
      fail(e);
      setStage(null);
    } finally {
      setProgress(null);
    }
  }

  async function pick(useCamera) {
    const options = { mediaTypes: ['videos'], quality: 1, videoMaxDuration: 60 };
    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return setError(t('live.err.denied'));
    }
    const picked = useCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!picked.canceled && picked.assets?.[0]) process(picked.assets[0]);
  }

  const busy = stage !== null;
  const unavailable = service.state !== 'ready';
  const extractLabel = progress
    ? t(progress.phase === 'model' ? 'live.loadingModel' : 'exercise.extractingPct', { pct: Math.round(progress.fraction * 100) })
    : t('exercise.extracting');
  const tips = ['exercise.tip1', 'exercise.tip2', isHold(exercise) ? 'exercise.tipHold' : 'exercise.tip3', 'exercise.tip4'];
  const Icon = EXERCISE_ICONS[exercise];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t(`home.${exercise}`)}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ServiceBanner service={service} />


        {liveCameraSupported ? (
          <Card style={{ marginTop: 14 }}>
            <View style={styles.cardHead}>
              <View style={styles.iconBox}><Camera size={22} color={colors.primary} /></View>
              <Text style={styles.cardTitle}>{t('live.title')}</Text>
            </View>
            <Text style={[styles.tipText, { marginBottom: 12 }]}>{t('live.desc')}</Text>
            <LiveCamera exercise={exercise} spec={spec} hold={isHold(exercise)} disabled={unavailable || busy} onSession={analyzeLandmarks} />
          </Card>
        ) : null}

        {stage === 'analyzing' ? <Text style={styles.note}>{t('exercise.analyzing')}</Text> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Card style={{ marginTop: 14 }}>
          <View style={styles.cardHead}>
            <View style={styles.iconBox}><Upload size={22} color={colors.primary} /></View>
            <Text style={styles.cardTitle}>{t('exercise.uploadTitle')}</Text>
          </View>
          <Text style={[styles.tipText, { marginBottom: 12 }]}>{t(Platform.OS === 'web' ? 'exercise.uploadHintWeb' : 'exercise.uploadHintNative')}</Text>
          <View style={{ gap: 12 }}>
            <Button
              title={stage === 'extracting' ? extractLabel : stage === 'analyzing' ? t('exercise.analyzing') : t('exercise.upload')}
              icon={Upload}
              variant={liveCameraSupported ? 'ghost' : 'primary'}
              onPress={() => pick(false)}
              loading={busy}
              disabled={busy || unavailable}
            />
            {Platform.OS !== 'web' ? (
              <Button title={t('exercise.record')} icon={Camera} onPress={() => pick(true)} disabled={busy || unavailable} />
            ) : null}
          </View>
        </Card>

        <Card style={{ marginTop: 14 }}>
          <View style={styles.cardHead}>
            <View style={styles.iconBox}>{Icon ? <Icon size={22} color={colors.primary} /> : null}</View>
            <Text style={styles.cardTitle}>{t('exercise.cameraTitle')}</Text>
          </View>
          <View style={styles.tip}>
            <Video size={18} color={colors.primary} />
            <Text style={styles.tipText}>{t(`exercise.camera.${exercise}`)}</Text>
          </View>
        </Card>

        <Card style={{ marginTop: 14 }}>
          <View style={styles.cardHead}>
            <View style={styles.iconBox}><ScanLine size={22} color={colors.primary} /></View>
            <Text style={styles.cardTitle}>{t('exercise.checksTitle')}</Text>
          </View>
          <Text style={styles.tipText}>{t(`exercise.checks.${exercise}`)}</Text>
        </Card>

        <Card style={{ marginTop: 14 }}>
          <SectionTitle>{t('exercise.tipsTitle')}</SectionTitle>
          {tips.map((key) => (
            <View key={key} style={styles.tip}>
              <CheckCircle2 size={18} color={colors.success} />
              <Text style={styles.tipText}>{t(key)}</Text>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  scroll: { padding: 20, maxWidth: 640, width: '100%', alignSelf: 'center' },
  tip: { flexDirection: 'row', gap: 10, marginBottom: 10, alignItems: 'flex-start' },
  tipText: { color: colors.text, fontSize: 14.5, flex: 1, lineHeight: 20 },
  error: { color: colors.danger, marginTop: 16, fontSize: 14, lineHeight: 20 },
  note: { color: colors.muted, marginTop: 16, fontSize: 13.5, lineHeight: 20 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  cardTitle: { color: colors.text, fontSize: 17, fontWeight: '700' },
  iconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
