import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HardDrive, Info } from 'lucide-react-native';
import { colors, radius } from '../theme';
import { useLanguage } from '../i18n';
import { useProfile } from '../lib/profile';
import { Button, Card, LanguageSwitch } from '../components/ui';

export default function ProfileScreen() {
  const { t } = useLanguage();
  const { profile, save } = useProfile();
  const [name, setName] = useState(profile.name);
  const [height, setHeight] = useState(profile.heightCm ? String(profile.heightCm) : '');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setHeight(profile.heightCm ? String(profile.heightCm) : '');
  }, [profile]);

  async function submit() {
    await save({ name, heightCm: parseInt(height, 10) || null });
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('profile.title')}</Text>

        <Card style={styles.row}>
          <Text style={styles.label}>{t('profile.language')}</Text>
          <LanguageSwitch />
        </Card>

        <Card style={{ marginTop: 12 }}>
          <Text style={styles.label}>{t('profile.name')}</Text>
          <TextInput value={name} onChangeText={setName} placeholder={t('profile.namePlaceholder')} placeholderTextColor={colors.muted} style={styles.input} maxLength={40} />
          <Text style={[styles.label, { marginTop: 14 }]}>{t('profile.height')}</Text>
          <TextInput value={height} onChangeText={(v) => setHeight(v.replace(/[^0-9]/g, ''))} placeholder="175" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} maxLength={3} />
          <Text style={styles.hint}>{t('profile.heightHint')}</Text>
          <Button title={saved ? t('profile.saved') : t('profile.save')} onPress={submit} style={{ marginTop: 14 }} />
        </Card>

        <Card style={{ marginTop: 12 }}>
          <View style={styles.aboutHeader}>
            <HardDrive size={18} color={colors.primary} />
            <Text style={styles.label}>{t('profile.storageTitle')}</Text>
          </View>
          <Text style={styles.about}>{t('profile.storageText')}</Text>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <View style={styles.aboutHeader}>
            <Info size={18} color={colors.primary} />
            <Text style={styles.label}>{t('profile.about')}</Text>
          </View>
          <Text style={styles.about}>{t('profile.aboutText')}</Text>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 20 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  input: { color: colors.text, fontSize: 16, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 13, marginTop: 8, borderWidth: 1, borderColor: colors.border, outlineStyle: 'none' },
  hint: { color: colors.muted, fontSize: 12.5, marginTop: 6, lineHeight: 18 },
  aboutHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  about: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
