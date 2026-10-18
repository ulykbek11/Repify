import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { Camera, ChevronRight, ScanLine, Sparkles } from 'lucide-react-native';
import { colors } from '../theme';
import { useLanguage } from '../i18n';
import { useProfile } from '../lib/profile';
import { useService } from '../lib/service';
import { EXERCISE_GROUPS, EXERCISE_ICONS } from '../data/exercises';
import { Card, LanguageSwitch, SectionTitle } from '../components/ui';
import ServiceBanner from '../components/ServiceBanner';

export default function HomeScreen() {
  const { t } = useLanguage();
  const { profile } = useProfile();
  const navigation = useNavigation();
  const service = useService();

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
            <Text style={styles.greeting}>{profile.name ? t('home.greeting', { name: profile.name }) : t('home.greetingAnon')}</Text>
            <Text style={styles.subtitle}>{t('home.subtitle')}</Text>
          </View>
          <LanguageSwitch />
        </View>

        {service.state === 'ready' ? (
          <Text style={styles.status}>{t(`home.engine.${service.engine === 'gemini' ? 'gemini' : 'local'}`)}</Text>
        ) : service.state === 'checking' ? (
          <Text style={styles.status}>{t('service.checking')}</Text>
        ) : (
          <ServiceBanner service={service} />
        )}

        <SectionTitle>{t('home.choose')}</SectionTitle>
        {EXERCISE_GROUPS.map((group) => (
          <View key={group.id} style={styles.group}>
            <Text style={styles.groupTitle}>{t(`home.group.${group.id}`)}</Text>
            {group.exercises.map((id) => {
              const Icon = EXERCISE_ICONS[id];
              return (
                <TouchableOpacity key={id} activeOpacity={0.85} onPress={() => navigation.navigate('Exercise', { exercise: id })} accessibilityRole="button" accessibilityLabel={t(`home.${id}`)}>
                  <Card style={styles.exercise}>
                    <View style={styles.iconBox}><Icon size={22} color={colors.primary} /></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exerciseTitle}>{t(`home.${id}`)}</Text>
                      <Text style={styles.exerciseDesc}>{t(`home.${id}Desc`)}</Text>
                    </View>
                    <ChevronRight size={20} color={colors.muted} />
                  </Card>
                </TouchableOpacity>
              );
            })}
          </View>
        ))}

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
  group: { marginBottom: 10 },
  groupTitle: { color: colors.muted, fontSize: 12.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8, marginTop: 6 },
  exercise: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8, paddingVertical: 12, paddingHorizontal: 14 },
  iconBox: { width: 42, height: 42, borderRadius: 13, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  exerciseTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  exerciseDesc: { color: colors.muted, fontSize: 13.5, marginTop: 2, lineHeight: 19 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  stepIcon: { width: 36, height: 36, borderRadius: 12, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  stepText: { color: colors.text, fontSize: 14.5, flex: 1, lineHeight: 20 },
});
