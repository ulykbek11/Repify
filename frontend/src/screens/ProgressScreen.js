import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, RefreshControl, Dimensions, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { Activity, Target, TrendingUp, Calendar, Award } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

export default function ProgressScreen() {
  const [user, setUser] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function fetchUser() {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setMetadata(user?.user_metadata || {});
    setLoading(false);
  }

  useEffect(() => {
    fetchUser();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchUser();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <Activity color="#FF6B00" size={40} />
      </SafeAreaView>
    );
  }

  const goalLabel = {
    muscle_gain: 'Набор массы',
    weight_loss: 'Похудение',
    maintenance: 'Поддержание'
  };

  const levelLabel = {
    beginner: 'Новичок',
    intermediate: 'Средний',
    advanced: 'Продвинутый'
  };

  const startWeight = metadata?.weight || 70;
  const targetWeight = metadata?.goal === 'muscle_gain' ? startWeight + 5 : (metadata?.goal === 'weight_loss' ? startWeight - 5 : startWeight);
  const currentWeight = startWeight; // Mock current progress
  
  // Calculate progress percentage (mock)
  const progress = 15; // 15% progress

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B00" />}
      >
        <Text style={styles.title}>Мой Прогресс</Text>

        {/* Main Goal Card */}
        <LinearGradient
          colors={['#FF6B00', '#FF3B5C']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.goalCard}
        >
          <View style={styles.goalHeader}>
            <View>
              <Text style={styles.goalLabel}>ГЛАВНАЯ ЦЕЛЬ</Text>
              <Text style={styles.goalValue}>{goalLabel[metadata?.goal] || 'Тренировки'}</Text>
            </View>
            <View style={styles.goalIcon}>
              <Target color="white" size={24} />
            </View>
          </View>

          <View style={styles.progressBlock}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressLabel}>Прогресс</Text>
              <Text style={styles.progressValue}>{progress}%</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <Text style={styles.progressHint}>Вы на верном пути! Продолжайте тренироваться.</Text>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.statIconPrimary]}>
              <TrendingUp color="#FF6B00" size={20} />
            </View>
            <Text style={styles.statLabel}>Текущий вес</Text>
            <Text style={styles.statValue}>{currentWeight} кг</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.statIconSecondary]}>
              <Target color="#00FF87" size={20} />
            </View>
            <Text style={styles.statLabel}>Цель</Text>
            <Text style={styles.statValue}>{targetWeight} кг</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.statIconBlue]}>
              <Activity color="#3B82F6" size={20} />
            </View>
            <Text style={styles.statLabel}>Уровень</Text>
            <Text style={styles.statValueSmall}>{levelLabel[metadata?.level] || 'Новичок'}</Text>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, styles.statIconPurple]}>
              <Award color="#A855F7" size={20} />
            </View>
            <Text style={styles.statLabel}>Посещений</Text>
            <Text style={styles.statValue}>0</Text>
          </View>
        </View>

        {/* Recent Activity Mock */}
        <View style={styles.activitySection}>
          <Text style={styles.sectionTitle}>Активность</Text>
          <View style={styles.activityCard}>
            <Text style={styles.activityText}>Пока нет завершенных тренировок</Text>
          </View>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 24,
  },
  goalCard: {
    padding: 24,
    borderRadius: 24,
    marginBottom: 32,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  goalLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  goalValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  goalIcon: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 8,
    borderRadius: 12,
  },
  progressBlock: {
    marginBottom: 8,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  progressLabel: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  progressValue: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  progressTrack: {
    width: '100%',
    height: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 999,
  },
  progressHint: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginTop: 8,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 32,
  },
  statCard: {
    width: '48%',
    backgroundColor: '#252A3B',
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statIconPrimary: {
    backgroundColor: 'rgba(255,107,0,0.1)',
  },
  statIconSecondary: {
    backgroundColor: 'rgba(0,255,135,0.1)',
  },
  statIconBlue: {
    backgroundColor: 'rgba(59,130,246,0.1)',
  },
  statIconPurple: {
    backgroundColor: 'rgba(168,85,247,0.1)',
  },
  statLabel: {
    color: '#8B8E98',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  statValue: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
  },
  statValueSmall: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  activitySection: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  activityCard: {
    backgroundColor: '#252A3B',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    paddingVertical: 32,
  },
  activityText: {
    color: '#8B8E98',
    textAlign: 'center',
  },
});
