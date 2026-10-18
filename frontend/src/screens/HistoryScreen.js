import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { History as HistoryIcon, Trash2 } from 'lucide-react-native';
import { colors } from '../theme';
import { useLanguage } from '../i18n';
import { useAuth } from '../lib/auth';
import { clearHistory, loadHistory } from '../lib/history';
import { Button, Card, SectionTitle } from '../components/ui';

const scoreColor = (s) => (s >= 80 ? colors.success : s >= 60 ? colors.warning : colors.danger);

export default function HistoryScreen() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const [items, setItems] = useState([]);

  useFocusEffect(
    useCallback(() => {
      if (user) loadHistory(user.id).then(setItems);
    }, [user])
  );

  const avg = items.length ? Math.round(items.reduce((a, i) => a + i.score, 0) / items.length) : 0;
  const best = items.length ? Math.max(...items.map((i) => i.score)) : 0;
  const recent = items.slice(0, 10).reverse();
  const locale = language === 'ru' ? 'ru-RU' : 'en-US';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text style={styles.title}>{t('history.title')}</Text>

        {items.length === 0 ? (
          <View style={styles.empty}>
            <HistoryIcon size={44} color={colors.muted} />
            <Text style={styles.emptyText}>{t('history.empty')}</Text>
          </View>
        ) : (
          <>
            <View style={styles.statsRow}>
              {[[t('history.sessions'), items.length], [t('history.average'), avg], [t('history.best'), best]].map(([label, value]) => (
                <Card key={label} style={styles.stat}>
                  <Text style={styles.statValue}>{value}</Text>
                  <Text style={styles.statLabel}>{label}</Text>
                </Card>
              ))}
            </View>

            <Card style={{ marginTop: 16 }}>
              <SectionTitle>{t('history.recent')}</SectionTitle>
              <View style={styles.chart}>
                {recent.map((item) => (
                  <View key={item.id} style={styles.barCol}>
                    <View style={[styles.bar, { height: `${Math.max(item.score, 4)}%`, backgroundColor: scoreColor(item.score) }]} />
                  </View>
                ))}
              </View>
            </Card>

            <View style={{ marginTop: 16, gap: 10 }}>
              {items.map((item) => (
                <Card key={item.id} style={styles.item}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>
                      {t(`home.${item.exercise}`)}
                      {item.synthetic ? `  (${t('history.sample')})` : ''}
                    </Text>
                    <Text style={styles.itemMeta}>
                      {new Date(item.date).toLocaleDateString(locale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      {'  -  '}
                      {item.holdSeconds != null ? t('history.holdSeconds', { n: Math.round(item.holdSeconds) }) : t('history.repsCount', { n: item.reps })}
                    </Text>
                  </View>
                  <Text style={[styles.itemScore, { color: scoreColor(item.score) }]}>{item.score}</Text>
                </Card>
              ))}
            </View>

            <Button
              title={t('history.clear')}
              icon={Trash2}
              variant="ghost"
              style={{ marginTop: 24 }}
              onPress={async () => { await clearHistory(user.id); setItems([]); }}
            />
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { padding: 20, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' },
  title: { color: colors.text, fontSize: 26, fontWeight: '800', marginBottom: 16 },
  empty: { alignItems: 'center', marginTop: 80, gap: 14 },
  emptyText: { color: colors.muted, fontSize: 15, textAlign: 'center', maxWidth: 280, lineHeight: 21 },
  statsRow: { flexDirection: 'row', gap: 10 },
  stat: { flex: 1, alignItems: 'center', padding: 14 },
  statValue: { color: colors.text, fontSize: 26, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 4, textAlign: 'center' },
  chart: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, height: 110 },
  barCol: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: '100%', maxWidth: 28, borderRadius: 6 },
  item: { flexDirection: 'row', alignItems: 'center', padding: 14 },
  itemTitle: { color: colors.text, fontSize: 15.5, fontWeight: '700' },
  itemMeta: { color: colors.muted, fontSize: 13, marginTop: 3 },
  itemScore: { fontSize: 24, fontWeight: '800' },
});
