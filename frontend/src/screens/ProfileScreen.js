import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Info, LogOut } from 'lucide-react-native';
import { colors } from '../theme';
import { useLanguage } from '../i18n';
import { isCloudAuth, useAuth } from '../lib/auth';
import { Button, Card, LanguageSwitch } from '../components/ui';

export default function ProfileScreen() {
  const { t } = useLanguage();
  const { user, signOut } = useAuth();
  const name = user?.name || t('profile.user');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('profile.title')}</Text>

        <View style={styles.identity}>
          <View style={styles.avatar}><Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text></View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        <Card style={styles.row}>
          <Text style={styles.label}>{t('profile.language')}</Text>
          <LanguageSwitch />
        </Card>

        <Card style={[styles.row, { marginTop: 12 }]}>
          <Text style={styles.label}>{t('profile.mode')}</Text>
          <Text style={styles.value}>{isCloudAuth ? t('profile.modeCloud') : t('profile.modeDemo')}</Text>
        </Card>

        <Card style={{ marginTop: 12 }}>
          <View style={styles.aboutHeader}>
            <Info size={18} color={colors.primary} />
            <Text style={styles.label}>{t('profile.about')}</Text>
          </View>
          <Text style={styles.about}>{t('profile.aboutText')}</Text>
        </Card>

        <Button title={t('profile.signOut')} icon={LogOut} variant="ghost" onPress={signOut} style={{ marginTop: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 20 },
  identity: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontSize: 36, fontWeight: '800' },
  name: { color: colors.text, fontSize: 20, fontWeight: '700', marginTop: 12 },
  email: { color: colors.muted, fontSize: 14, marginTop: 2 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: colors.text, fontSize: 15, fontWeight: '600' },
  value: { color: colors.muted, fontSize: 14 },
  aboutHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 },
  about: { color: colors.muted, fontSize: 14, lineHeight: 21 },
});
