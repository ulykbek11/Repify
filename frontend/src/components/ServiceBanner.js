import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { CloudOff, RefreshCw } from 'lucide-react-native';
import { colors, radius } from '../theme';
import { useLanguage } from '../i18n';

// Shown when the analysis service is not configured or not reachable.
export default function ServiceBanner({ service }) {
  const { t } = useLanguage();
  if (service.state !== 'unavailable') return null;
  return (
    <View style={styles.box} accessibilityRole="alert">
      <CloudOff size={20} color={colors.danger} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title}>{t('service.unavailable')}</Text>
        <Text style={styles.text}>{t(service.reason === 'not_configured' ? 'service.notConfigured' : 'service.offline')}</Text>
        {service.reason === 'offline' ? (
          <TouchableOpacity onPress={service.retry} style={styles.retry} accessibilityRole="button">
            <RefreshCw size={14} color={colors.primary} />
            <Text style={styles.retryText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { flexDirection: 'row', gap: 12, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.danger, padding: 14, marginVertical: 10 },
  title: { color: colors.text, fontSize: 15, fontWeight: '700' },
  text: { color: colors.muted, fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  retryText: { color: colors.primary, fontSize: 13.5, fontWeight: '700' },
});
