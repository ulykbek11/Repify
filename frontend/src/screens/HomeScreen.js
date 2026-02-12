import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { PlayCircle, Dumbbell, Target, ChevronRight, Activity, X, AlertCircle } from 'lucide-react-native';
import { supabase, DEV_MODE } from '../lib/supabase';

export default function HomeScreen() {
  const navigation = useNavigation();
  const [showCalibrationBanner, setShowCalibrationBanner] = useState(false);
  const [calibrationData, setCalibrationData] = useState(null);

  useEffect(() => {
    checkCalibrationStatus();

    // Re-check calibration status when user returns to this screen
    const unsubscribe = navigation.addListener('focus', () => {
      checkCalibrationStatus();
    });

    return unsubscribe;
  }, [navigation]);

  const checkCalibrationStatus = async () => {
    try {
      // Skip Supabase calls in DEV_MODE
      if (DEV_MODE) {
        console.log('[HomeScreen] DEV_MODE enabled - skipping calibration check');
        setShowCalibrationBanner(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const metadata = user.user_metadata || {};
        const calibrated = metadata.calibrated;
        const reminderCount = metadata.calibration_reminder_count || 0;

        console.log('[HomeScreen] Calibration check:', {
          calibrated,
          reminderCount,
          hasMetadata: !!metadata,
          metadata
        });

        // IMPORTANT: Show banner ONLY if calibrated === false (user skipped or not completed)
        // If calibrated === true, user completed calibration successfully
        // If calibrated field doesn't exist, it's a new user who hasn't seen calibration screen yet
        if (calibrated === false && reminderCount < 3) {
          console.log('[HomeScreen] Showing calibration banner');
          setShowCalibrationBanner(true);
          setCalibrationData({ reminderCount });
        } else {
          console.log('[HomeScreen] Hiding calibration banner', {
            reason: calibrated === true ? 'completed' : calibrated === undefined ? 'new user' : 'dismissed too many times'
          });
          setShowCalibrationBanner(false);
        }
      }
    } catch (error) {
      console.error('Error checking calibration status:', error);
    }
  };

  const dismissCalibrationBanner = async () => {
    try {
      if (DEV_MODE) {
        setShowCalibrationBanner(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const currentCount = user.user_metadata?.calibration_reminder_count || 0;
        await supabase.auth.updateUser({
          data: {
            calibration_reminder_count: currentCount + 1
          }
        });
      }
      setShowCalibrationBanner(false);
    } catch (error) {
      console.error('Error dismissing banner:', error);
      setShowCalibrationBanner(false);
    }
  };

  const goToCalibration = () => {
    setShowCalibrationBanner(false);
    navigation.navigate('Calibration');
  };

  const exercises = [
    {
      id: 'squat',
      title: 'Приседания',
      description: 'Базовое упражнение для ног и ягодиц',
      level: 'Начинающий',
      image: 'https://images.unsplash.com/photo-1574680096141-1cddd32e24c7?w=500&q=80',
      duration: '10-15 мин'
    },
    {
      id: 'deadlift',
      title: 'Становая тяга',
      description: 'Мощное упражнение для спины и ног',
      level: 'Средний',
      image: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=500&q=80',
      duration: '15-20 мин'
    }
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <View style={styles.logoWrapper}>
              <Image
                source={require('../../assets/logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={styles.brand}>Repify</Text>
          </View>
          <TouchableOpacity style={styles.headerButton}>
            <Activity color="#FF6B00" size={20} />
          </TouchableOpacity>
        </View>

        {/* Hero Section */}
        <View style={styles.heroSection}>
          <View style={styles.heroCard}>
            <View style={styles.heroHighlightTop} />
            <View style={styles.heroHighlightBottom} />

            <Text style={styles.heroEyebrow}>Твой AI Тренер</Text>
            <Text style={styles.heroTitle}>
              Идеальная техника{'\n'}в каждом повторе
            </Text>
            <TouchableOpacity style={styles.heroButton}>
              <Text style={styles.heroButtonText}>Начать тренировку</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Calibration Reminder Banner */}
        {showCalibrationBanner && (
          <View style={styles.bannerSection}>
            <View style={styles.bannerCard}>
              <View style={styles.bannerHeader}>
                <View style={styles.bannerTitleRow}>
                  <AlertCircle color="#FF6B00" size={24} />
                  <Text style={styles.bannerTitle}>Пройдите калибровку</Text>
                </View>
                <TouchableOpacity onPress={dismissCalibrationBanner} style={styles.bannerDismiss}>
                  <X color="#8B8E98" size={20} />
                </TouchableOpacity>
              </View>
              <Text style={styles.bannerText}>
                Калибровка поможет нам точнее оценивать вашу технику, учитывая ваши индивидуальные пропорции.
              </Text>
              <TouchableOpacity
                onPress={goToCalibration}
                style={styles.bannerButton}
              >
                <Text style={styles.bannerButtonText}>Начать калибровку</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Categories Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} contentContainerStyle={styles.chipsContent}>
          {['Все', 'Силовые', 'Кардио', 'Растяжка'].map((cat, i) => {
            const isActive = i === 0;
            return (
              <TouchableOpacity
                key={cat}
                style={[styles.chip, isActive ? styles.chipActive : styles.chipInactive]}
              >
                <Text style={isActive ? styles.chipActiveText : styles.chipText}>{cat}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Exercises List */}
        <View style={styles.exerciseSection}>
          <Text style={styles.sectionTitle}>Популярные упражнения</Text>
          <View style={styles.exerciseList}>
            {exercises.map((exercise) => (
              <TouchableOpacity
                key={exercise.id}
                onPress={() => navigation.navigate('Exercise', { exercise: exercise.id })}
                style={styles.exerciseCard}
              >
                <View style={styles.exerciseMedia}>
                  <Image
                    source={{ uri: exercise.image }}
                    style={styles.exerciseImage}
                    resizeMode="cover"
                  />
                  <View style={styles.exerciseBadge}>
                    <Text style={styles.exerciseBadgeText}>{exercise.level}</Text>
                  </View>
                  <View style={styles.exerciseCta}>
                    <PlayCircle color="white" size={16} fill="white" />
                    <Text style={styles.exerciseCtaText}>Начать</Text>
                  </View>
                </View>

                <View style={styles.exerciseBody}>
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseTitle}>{exercise.title}</Text>
                    <View style={styles.exerciseMeta}>
                      <Activity size={14} color="#8B8E98" />
                      <Text style={styles.exerciseMetaText}>{exercise.duration}</Text>
                    </View>
                  </View>
                  <Text style={styles.exerciseDescription}>{exercise.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoWrapper: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  brand: {
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.6,
  },
  headerButton: {
    width: 40,
    height: 40,
    backgroundColor: '#1A1F2E',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  heroSection: {
    paddingHorizontal: 24,
    marginTop: 16,
    marginBottom: 32,
  },
  heroCard: {
    backgroundColor: '#FF6B00',
    borderRadius: 24,
    padding: 24,
    overflow: 'hidden',
    position: 'relative',
    shadowColor: '#FF6B00',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  heroHighlightTop: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 128,
    height: 128,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    marginRight: -40,
    marginTop: -40,
  },
  heroHighlightBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    width: 96,
    height: 96,
    backgroundColor: 'rgba(0,0,0,0.1)',
    borderRadius: 999,
    marginLeft: -40,
    marginBottom: -40,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 1.6,
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 34,
    marginBottom: 16,
  },
  heroButton: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  heroButtonText: {
    color: '#FF6B00',
    fontWeight: '700',
  },
  bannerSection: {
    paddingHorizontal: 24,
    marginBottom: 24,
  },
  bannerCard: {
    backgroundColor: 'rgba(255,107,0,0.1)',
    borderWidth: 1,
    borderColor: '#FF6B00',
    borderRadius: 16,
    padding: 16,
  },
  bannerHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
    marginLeft: 12,
    flex: 1,
  },
  bannerDismiss: {
    padding: 4,
  },
  bannerText: {
    color: '#8B8E98',
    fontSize: 13,
    marginBottom: 16,
  },
  bannerButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  bannerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  chips: {
    marginBottom: 24,
  },
  chipsContent: {
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  chip: {
    marginRight: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: {
    backgroundColor: '#1A1F2E',
    borderColor: '#FF6B00',
  },
  chipInactive: {
    backgroundColor: 'transparent',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActiveText: {
    color: '#FF6B00',
    fontWeight: '700',
  },
  chipText: {
    color: '#8B8E98',
  },
  exerciseSection: {
    paddingHorizontal: 24,
  },
  sectionTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 16,
  },
  exerciseCard: {
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginBottom: 16,
  },
  exerciseMedia: {
    height: 160,
    width: '100%',
    backgroundColor: '#111827',
  },
  exerciseImage: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  exerciseBadge: {
    position: 'absolute',
    top: 16,
    left: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  exerciseBadgeText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseCta: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#FF6B00',
    shadowOpacity: 0.4,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  exerciseCtaText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 12,
    marginLeft: 6,
  },
  exerciseBody: {
    padding: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 6,
  },
  exerciseTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
    marginRight: 12,
  },
  exerciseMeta: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseMetaText: {
    color: '#8B8E98',
    fontSize: 12,
    marginLeft: 6,
  },
  exerciseDescription: {
    color: '#8B8E98',
    fontSize: 13,
    lineHeight: 18,
  },
});
