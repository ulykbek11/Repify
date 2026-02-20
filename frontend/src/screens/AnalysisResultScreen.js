import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, CheckCircle, AlertTriangle, Home, Share2, User } from 'lucide-react-native';

export default function AnalysisResultScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { result } = route.params || {};

  const data = result || {
    reps: 0,
    errors: [],
    status: "unknown",
    biomechanics_context: null,
    backendUnavailable: true,
    poseExtractionMissing: false,
    analysisMode: "real",
    apiError: "No analysis result"
  };

  // Only calculate score if reps were performed
  const hasReps = (data.reps || 0) > 0;
  // Use provided score or calculate
  const score = data.score !== undefined ? data.score : (hasReps && !data.backendUnavailable ? Math.max(0, 100 - ((data.errors?.length || 0) * 15)) : null);
  const isPerfect = score !== null && score >= 90;
  const primaryError = data.errors && data.errors.length > 0 ? data.errors[0].feedback : '';
  const showStatus = data.needsCalibration || data.backendUnavailable || data.poseExtractionMissing;
  const statusTitle = data.needsCalibration
    ? 'Нужна калибровка'
    : data.poseExtractionMissing
      ? 'Не настроен анализ'
      : 'Анализ недоступен';
  const statusText = data.needsCalibration
    ? 'Сначала пройдите калибровку, затем повторите тренировку.'
    : data.poseExtractionMissing
      ? (primaryError || 'Нет извлечения позы из видео.')
      : (primaryError || 'Проверьте подключение к серверу и повторите анализ.');

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Main')}
            style={styles.iconButton}
          >
            <ArrowLeft color="white" size={20} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Результаты</Text>
          <TouchableOpacity style={styles.iconButton}>
            <Share2 color="white" size={20} />
          </TouchableOpacity>
        </View>

        {/* Score Section */}
        <View style={styles.scoreContainer}>
          <View style={styles.scoreCircle}>
            {score !== null && <View style={[StyleSheet.absoluteFill, styles.scoreCircleProgress]} />}
            <Text style={styles.scoreLabel}>Оценка</Text>
            <Text style={styles.scoreValue}>
              {score !== null ? score : 'N/A'}
            </Text>
          </View>
          <Text style={styles.scoreMessage}>
            {score === null ? 'Повторений не обнаружено' : isPerfect ? 'Отличная работа!' : 'Есть над чем работать'}
          </Text>
        </View>

        {data.analysisMode === 'mock' && (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Демо-режим</Text>
            <Text style={styles.statusText}>Используются тестовые данные позы, результаты не отражают реальную технику.</Text>
          </View>
        )}
        {showStatus && (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>{statusTitle}</Text>
            <Text style={styles.statusText}>{statusText}</Text>
          </View>
        )}

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{data.reps || 0}</Text>
            <Text style={styles.statLabel}>Повторений</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValueError}>{data.errors?.length || 0}</Text>
            <Text style={styles.statLabel}>Ошибок</Text>
          </View>
        </View>

        {/* Genetic Context Info */}
        {data.biomechanics_context && (
          <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
             <View style={styles.geneticContainer}>
                <View style={styles.geneticIcon}>
                    <User color="#FF6B00" size={20} />
                </View>
                <View>
                    <Text style={styles.geneticTitle}>Учтена генетика</Text>
                    <Text style={styles.geneticText}>
                        {data.biomechanics_context.body_type === 'ectomorph' ? 'Анализ для длинных конечностей' : 
                         data.biomechanics_context.body_type === 'endomorph' ? 'Анализ для массивного телосложения' :
                         'Стандартный биомеханический профиль'}
                    </Text>
                </View>
             </View>
          </View>
        )}

        {/* Feedback List */}
        <View style={{ paddingHorizontal: 24 }}>
          <Text style={styles.sectionTitle}>Анализ техники</Text>
          {data.errors && data.errors.length > 0 ? (
            data.errors.map((err, index) => (
              <View key={index} style={styles.errorCard}>
                <View style={styles.errorIcon}>
                  <AlertTriangle color="#FF3B5C" size={20} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.errorTitle}>Ошибка #{index + 1}</Text>
                  <Text style={styles.errorText}>{err.feedback}</Text>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.successCard}>
              <View style={styles.successIcon}>
                <CheckCircle color="#00FF87" size={32} />
              </View>
              <Text style={styles.successTitle}>Техника идеальна</Text>
              <Text style={styles.successText}>Вы не совершили ни одной ошибки. Так держать!</Text>
            </View>
          )}
        </View>

        <View style={{ paddingHorizontal: 24, marginTop: 32 }}>
          <TouchableOpacity
            onPress={() => navigation.navigate('Main')}
            style={styles.finishButton}
          >
            <Text style={styles.finishButtonText}>Завершить тренировку</Text>
          </TouchableOpacity>
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
  header: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconButton: {
    width: 40,
    height: 40,
    backgroundColor: '#1A1F2E',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  headerTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  scoreContainer: {
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 32,
  },
  scoreCircle: {
    width: 192,
    height: 192,
    borderRadius: 96,
    borderWidth: 12,
    borderColor: '#1A1F2E',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 50,
    elevation: 10,
  },
  scoreCircleProgress: {
    borderRadius: 96,
    borderWidth: 12,
    borderColor: '#FF6B00',
    borderLeftColor: 'transparent',
    borderBottomColor: 'transparent',
    transform: [{ rotate: '45deg' }],
    opacity: 1,
  },
  scoreLabel: {
    color: '#9CA3AF',
    fontSize: 14,
    textTransform: 'uppercase',
    fontWeight: 'bold',
    letterSpacing: 2,
    marginBottom: 4,
  },
  scoreValue: {
    color: 'white',
    fontSize: 72,
    fontWeight: '800',
    letterSpacing: -2,
  },
  scoreMessage: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginTop: 24,
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    marginBottom: 32,
    gap: 16,
  },
  statusCard: {
    marginHorizontal: 24,
    marginBottom: 24,
    backgroundColor: 'rgba(255, 59, 92, 0.08)',
    borderColor: 'rgba(255, 59, 92, 0.3)',
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
  },
  statusTitle: {
    color: '#FF3B5C',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 6,
  },
  statusText: {
    color: '#9CA3AF',
    fontSize: 13,
    lineHeight: 18,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#1A1F2E',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  statValueError: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#EF4444',
    marginBottom: 4,
  },
  statLabel: {
    color: '#9CA3AF',
    fontSize: 12,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  geneticContainer: {
    backgroundColor: 'rgba(255,107,0,0.1)',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  geneticIcon: {
    backgroundColor: 'rgba(255,107,0,0.2)',
    padding: 8,
    borderRadius: 9999,
    marginRight: 12,
  },
  geneticTitle: {
    color: '#FF6B00',
    fontWeight: 'bold',
    fontSize: 16,
  },
  geneticText: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  errorCard: {
    backgroundColor: '#1A1F2E',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  errorIcon: {
    backgroundColor: 'rgba(239,68,68,0.1)',
    padding: 8,
    borderRadius: 9999,
    marginTop: 4,
  },
  errorTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  errorText: {
    color: '#9CA3AF',
    lineHeight: 20,
  },
  successCard: {
    backgroundColor: '#1A1F2E',
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  successIcon: {
    backgroundColor: 'rgba(0,255,135,0.1)',
    padding: 16,
    borderRadius: 9999,
    marginBottom: 12,
  },
  successTitle: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
    marginBottom: 4,
  },
  successText: {
    color: '#9CA3AF',
    textAlign: 'center',
  },
  finishButton: {
    backgroundColor: '#FF6B00',
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  finishButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
