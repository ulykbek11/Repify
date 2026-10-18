import React, { useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, CheckCircle2, Upload } from 'lucide-react-native';
import { colors } from '../theme';
import { useLanguage } from '../i18n';
import { ApiError, analyze, extractPoses } from '../lib/api';
import { Button, Card, SectionTitle } from '../components/ui';

export default function ExerciseScreen() {
  const { t, language } = useLanguage();
  const navigation = useNavigation();
  const { exercise } = useRoute().params;
  const [stage, setStage] = useState(null); // null | 'extracting' | 'analyzing'
  const [error, setError] = useState(null);

  async function process(asset) {
    setError(null);
    try {
      setStage('extracting');
      const poseSequence = await extractPoses(asset);
      setStage('analyzing');
      const result = await analyze({ poseSequence, exercise, language });
      navigation.navigate('Result', { result, exercise });
    } catch (e) {
      if (e instanceof ApiError && e.kind === 'network') setError(t('exercise.errNetwork'));
      else if (e instanceof ApiError && e.status === 422) setError(t('exercise.errNoPerson'));
      else setError(t('exercise.errFailed', { message: e.message }));
    } finally {
      setStage(null);
    }
  }

  async function pick(useCamera) {
    const options = { mediaTypes: ['videos'], quality: 1, videoMaxDuration: 60 };
    if (useCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return;
    }
    const picked = useCamera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (!picked.canceled && picked.assets?.[0]) process(picked.assets[0]);
  }

  const busy = stage !== null;
  const tips = ['exercise.tip1', 'exercise.tip2', 'exercise.tip3', 'exercise.tip4'];

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
        <Card>
          <SectionTitle>{t('exercise.tipsTitle')}</SectionTitle>
          {tips.map((key) => (
            <View key={key} style={styles.tip}>
              <CheckCircle2 size={18} color={colors.success} />
              <Text style={styles.tipText}>{t(key)}</Text>
            </View>
          ))}
        </Card>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={{ gap: 12, marginTop: 20 }}>
          <Button
            title={stage === 'extracting' ? t('exercise.extracting') : stage === 'analyzing' ? t('exercise.analyzing') : t('exercise.upload')}
            icon={Upload}
            onPress={() => pick(false)}
            loading={busy}
          />
          {Platform.OS !== 'web' ? (
            <Button title={t('exercise.record')} icon={Camera} variant="ghost" onPress={() => pick(true)} disabled={busy} />
          ) : null}
        </View>
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
});
