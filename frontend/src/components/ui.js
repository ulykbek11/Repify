import React from 'react';
import { ActivityIndicator, Text, TouchableOpacity, View, StyleSheet } from 'react-native';
import { colors, radius } from '../theme';
import { LANGUAGES, useLanguage } from '../i18n';

export function Button({ title, onPress, icon: Icon, variant = 'primary', loading, disabled, style }) {
  const primary = variant === 'primary';
  return (
    <TouchableOpacity
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[styles.button, primary ? styles.buttonPrimary : styles.buttonGhost, (disabled || loading) && { opacity: 0.6 }, style]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? '#fff' : colors.primary} />
      ) : (
        <>
          {Icon ? <Icon size={20} color={primary ? '#fff' : colors.primary} /> : null}
          <Text style={[styles.buttonText, { color: primary ? '#fff' : colors.primary }]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

export function Card({ children, style }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }) {
  return <Text style={styles.sectionTitle}>{children}</Text>;
}

export function LanguageSwitch() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <View style={styles.switch} accessibilityRole="radiogroup">
      {LANGUAGES.map((code) => (
        <TouchableOpacity
          key={code}
          accessibilityRole="radio"
          accessibilityState={{ selected: language === code }}
          onPress={() => setLanguage(code)}
          style={[styles.switchItem, language === code && styles.switchItemActive]}
        >
          <Text style={[styles.switchText, language === code && { color: '#fff' }]}>{t(`lang.${code}`)}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 15, paddingHorizontal: 20, borderRadius: radius.md,
  },
  buttonPrimary: { backgroundColor: colors.primary },
  buttonGhost: { borderWidth: 1.5, borderColor: colors.primary, backgroundColor: 'transparent' },
  buttonText: { fontSize: 16, fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: radius.lg, padding: 18, borderWidth: 1, borderColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 12 },
  switch: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 999, padding: 3 },
  switchItem: { paddingVertical: 6, paddingHorizontal: 14, borderRadius: 999 },
  switchItemActive: { backgroundColor: colors.primary },
  switchText: { color: colors.muted, fontWeight: '700', fontSize: 13 },
});
