import React, { useEffect } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Circle } from 'react-native-svg';
import { AlertTriangle, ArrowLeft, CheckCircle2, Cpu, Lightbulb, Ruler, Sparkles } from 'lucide-react-native';
import { colors } from '../theme';
import { useLanguage } from '../i18n';
import { addToHistory } from '../lib/history';
import { Button, Card, SectionTitle } from '../components/ui';
import PoseFigure from '../components/PoseFigure';
import ReplayVideo from '../components/ReplayVideo';

function ScoreRing({ score, label }) {
  const size = 128, stroke = 12, r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const color = score >= 80 ? colors.success : score >= 60 ? colors.warning : colors.danger;
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.surface} strokeWidth={stroke} fill="none" />
          <Circle
            cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none" strokeLinecap="round"
            strokeDasharray={`${c * (score / 100)} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        </Svg>
        <View style={styles.ringCenter}>
          <Text style={[styles.ringScore, { color }]}>{Math.round(score)}</Text>
        </View>
      </View>
      <Text style={styles.ringLabel}>{label}</Text>
    </View>
  );
}

export default function ResultScreen() {
  const { t } = useLanguage();
  const navigation = useNavigation();
  const { result, exercise, fromHistory, replay } = useRoute().params;

  useEffect(() => {
    if (!fromHistory) addToHistory(exercise, result);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const preview = result.pose_preview;
  const issues = result.errors || [];
  const strengths = result.strengths || [];
  const reps = result.rep_details || [];
  const hold = result.mode === 'hold';
  const intervals = result.intervals || [];
  const angleKey = result.signal || 'knee_angle';
  const deg = (key) => `${Math.round(preview?.angles?.[key] ?? 0)}°`;
  // Label the joint that drives the repetition count; squat and deadlift keep the knee and hip pair.
  const labels = {};
  if (angleKey === 'elbow_angle') labels.elbow = t('result.elbowAngle', { deg: deg('elbow_angle') });
  else if (angleKey === 'body_line') labels.hip = t('result.bodyLine', { deg: deg('body_line') });
  else {
    labels.knee = t('result.kneeAngle', { deg: deg('knee_angle') });
    labels.hip = t('result.hipAngle', { deg: deg('hip_angle') });
  }
  const engineLabel = result.engine === 'gemini' ? t('result.engineGemini') : t('result.engineLocal');

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>{t('result.title')}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <Card style={styles.summary}>
          <ScoreRing score={result.score || 0} label={t('result.score')} />
          <View style={styles.stats}>
            {hold ? (
              <View style={styles.stat}><Text style={styles.statValue}>{Math.round(result.hold_seconds ?? 0)}</Text><Text style={styles.statLabel}>{t('result.holdTime')}</Text></View>
            ) : (
              <View style={styles.stat}><Text style={styles.statValue}>{result.total_reps ?? 0}</Text><Text style={styles.statLabel}>{t('result.reps')}</Text></View>
            )}
            {result.frames_analyzed ? (
              <View style={styles.stat}><Text style={styles.statValue}>{result.frames_analyzed}</Text><Text style={styles.statLabel}>{t('result.frames')}</Text></View>
            ) : null}
          </View>
        </Card>

        <View style={styles.badges}>
          <View style={styles.badge}>{result.engine === 'gemini' ? <Sparkles size={14} color={colors.primary} /> : <Cpu size={14} color={colors.primary} />}<Text style={styles.badgeText}>{engineLabel}</Text></View>
        </View>

        {replay?.uri && replay.poses?.length ? (
          <Card style={{ marginTop: 16 }}>
            <Text style={styles.cardLabel}>{t('result.replay')}</Text>
            <ReplayVideo
              testID="result-replay"
              uri={replay.uri}
              poses={replay.poses}
              signal={angleKey}
              labels={{ knee: t('result.replayKnee'), hip: t('result.replayHip'), elbow: t('result.replayElbow') }}
            />
          </Card>
        ) : null}

        {!replay && preview?.joints ? (
          <Card style={{ alignItems: 'center', marginTop: 16 }}>
            <Text style={styles.cardLabel}>{t('result.pose')}</Text>
            <PoseFigure
              joints={preview.joints}
              angles={preview.angles}
              labels={labels}
            />
          </Card>
        ) : null}

        <Card style={{ marginTop: 16 }}>
          <SectionTitle>{t('result.issues')}</SectionTitle>
          {issues.length === 0 ? <Text style={styles.text}>{t('result.noIssues')}</Text> : null}
          {issues.map((text, i) => (
            <View key={i} style={styles.row}><AlertTriangle size={18} color={colors.warning} /><Text style={styles.rowText}>{text}</Text></View>
          ))}
        </Card>

        {strengths.length ? (
          <Card style={{ marginTop: 16 }}>
            <SectionTitle>{t('result.strengths')}</SectionTitle>
            {strengths.map((text, i) => (
              <View key={i} style={styles.row}><CheckCircle2 size={18} color={colors.success} /><Text style={styles.rowText}>{text}</Text></View>
            ))}
          </Card>
        ) : null}

        {result.coach_tip ? (
          <Card style={{ marginTop: 16 }}>
            <SectionTitle>{t('result.tip')}</SectionTitle>
            <View style={styles.row}><Lightbulb size={18} color={colors.primary} /><Text style={styles.rowText}>{result.coach_tip}</Text></View>
          </Card>
        ) : null}

        {result.calibration_notes ? (
          <Card style={{ marginTop: 16 }}>
            <SectionTitle>{t('result.body')}</SectionTitle>
            <View style={styles.row}><Ruler size={18} color={colors.muted} /><Text style={styles.rowText}>{result.calibration_notes}</Text></View>
          </Card>
        ) : null}

        {intervals.length ? (
          <Card style={{ marginTop: 16 }}>
            <SectionTitle>{t('result.intervals')}</SectionTitle>
            {intervals.map((item) => (
              <View key={item.index} style={styles.repRow}>
                <Text style={[styles.repLabel, { width: 108 }]}>{t('result.interval', { from: (item.index - 1) * 5, to: item.index * 5 })}</Text>
                <View style={styles.barTrack}><View style={[styles.barFill, { width: `${item.score}%`, backgroundColor: item.score >= 80 ? colors.success : item.score >= 60 ? colors.warning : colors.danger }]} /></View>
                <Text style={styles.repScore}>{item.score}</Text>
              </View>
            ))}
          </Card>
        ) : null}

        {reps.length ? (
          <Card style={{ marginTop: 16 }}>
            <SectionTitle>{t('result.perRep')}</SectionTitle>
            {reps.map((rep) => (
              <View key={rep.index} style={{ marginBottom: 10 }}>
                <View style={[styles.repRow, { marginBottom: 4 }]}>
                  <Text style={styles.repLabel}>{t('result.rep', { n: rep.index })}</Text>
                  <View style={styles.barTrack}><View style={[styles.barFill, { width: `${rep.score}%`, backgroundColor: rep.score >= 80 ? colors.success : rep.score >= 60 ? colors.warning : colors.danger }]} /></View>
                  <Text style={styles.repScore}>{rep.score}</Text>
                </View>
                {(rep.issue_tips || []).map((tip, i) => (
                  <View key={i} style={styles.repIssue}><AlertTriangle size={14} color={colors.warning} /><Text style={styles.repIssueText}>{tip}</Text></View>
                ))}
              </View>
            ))}
          </Card>
        ) : null}

        <Button title={t('common.done')} onPress={() => navigation.goBack()} style={{ marginTop: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 8 },
  back: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.text, fontSize: 18, fontWeight: '700' },
  scroll: { padding: 20, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' },
  summary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  ringCenter: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  ringScore: { fontSize: 38, fontWeight: '800' },
  ringLabel: { color: colors.muted, fontSize: 13, marginTop: 8 },
  stats: { gap: 18 },
  stat: { alignItems: 'center' },
  statValue: { color: colors.text, fontSize: 30, fontWeight: '800' },
  statLabel: { color: colors.muted, fontSize: 13 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12 },
  badgeText: { color: colors.text, fontSize: 12.5, fontWeight: '600' },
  cardLabel: { color: colors.muted, fontSize: 13, marginBottom: 6 },
  text: { color: colors.text, fontSize: 14.5 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'flex-start', marginBottom: 10 },
  rowText: { color: colors.text, fontSize: 14.5, flex: 1, lineHeight: 21 },
  repIssue: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', marginLeft: 76, marginTop: 2 },
  repIssueText: { color: colors.muted, fontSize: 13, lineHeight: 18, flex: 1 },
  repRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 },
  repLabel: { color: colors.muted, fontSize: 13, width: 64 },
  barTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: colors.surface, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  repScore: { color: colors.text, fontWeight: '700', width: 32, textAlign: 'right' },
});
