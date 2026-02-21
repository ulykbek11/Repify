import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { ArrowLeft, CheckCircle, AlertTriangle, Home, Share2, User, ArrowDown, MoveHorizontal, ArrowUpCircle, AlignCenter } from 'lucide-react-native';
import Svg, { Circle } from 'react-native-svg';

const processErrors = (errors = []) => {
  const grouped = {};
  errors.forEach(err => {
    let fb = err.feedback || '';

    // Убираем маркер "Ошибка #1 - " и пробелы/дефисы после
    let title = fb.replace(/Ошибка #\d+\s*[-:]?\s*/, '').trim();

    // Отсекаем всё, что идёт после первой скобки или точки (включая саму скобку/точку)
    title = title.split(/[(\.]/)[0].trim();

    if (!grouped[title]) {
      grouped[title] = { count: 0 };
    }
    grouped[title].count += 1;
  });

  return Object.keys(grouped).map(title => ({
    title,
    count: grouped[title].count
  }));
};

const formatCount = (count) => {
  if (count <= 1) return '';
  const last = count % 10;
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return `(${count} раз)`;
  if (last >= 2 && last <= 4) return `(${count} раза)`;
  return `(${count} раз)`;
};

const getHintAndIcon = (title) => {
  const lower = title.toLowerCase();
  if (lower.includes('глубин')) {
    return { icon: <ArrowDown color="#FF3B5C" size={20} />, hint: 'Приседайте ниже — до параллели с полом' };
  }
  if (lower.includes('колен') || lower.includes('вальг') || lower.includes('внутрь')) {
    return { icon: <MoveHorizontal color="#FF3B5C" size={20} />, hint: 'Разводите колени в стороны по линии носков' };
  }
  if (lower.includes('пятк') || lower.includes('отрыв')) {
    return { icon: <ArrowUpCircle color="#FF3B5C" size={20} />, hint: 'Упор на всю стопу, не отрывайте пятки' };
  }
  if (lower.includes('спин') || lower.includes('наклон')) {
    return { icon: <AlignCenter color="#FF3B5C" size={20} />, hint: 'Держите спину прямой' };
  }
  return { icon: <AlertTriangle color="#FF3B5C" size={20} />, hint: 'Обратите внимание на этот элемент техники' };
};

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

  const uniqueErrorsList = processErrors(data.errors || []);
  const errorsCount = uniqueErrorsList.length;

  // Use provided score or calculate
  const score = data.score !== undefined ? data.score : (hasReps && !data.backendUnavailable ? Math.max(0, 100 - (errorsCount * 15)) : null);
  const isPerfect = score !== null && score >= 90;

  let scoreMessage = 'Повторений не обнаружено';
  if (score !== null) {
    if (errorsCount === 0) {
      scoreMessage = 'Отличная работа!';
    } else if (errorsCount <= 2) {
      scoreMessage = 'Есть над чем поработать';
    } else {
      scoreMessage = 'Нужно исправить технику';
    }
  }

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
          <View style={styles.scoreCircleContainer}>
            <Svg width="192" height="192" style={{ position: 'absolute' }}>
              <Circle
                cx="96"
                cy="96"
                r="84"
                stroke="#1A1F2E"
                strokeWidth="12"
                fill="none"
              />
              {score !== null && (
                <Circle
                  cx="96"
                  cy="96"
                  r="84"
                  stroke="#FF6B00"
                  strokeWidth="12"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 84}`}
                  strokeDashoffset={`${(2 * Math.PI * 84) * (1 - score / 100)}`}
                  strokeLinecap="round"
                  transform="rotate(-90 96 96)"
                />
              )}
            </Svg>
            <Text style={styles.scoreLabel}>Оценка</Text>
            <Text style={styles.scoreValue}>
              {score !== null ? Math.round(score) : 'N/A'}
            </Text>
          </View>
          <Text style={styles.scoreMessage}>
            {scoreMessage}
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
        {data.reps > 0 ? (
          <View style={styles.statsContainer}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{data.reps}</Text>
              <Text style={styles.statLabel}>Повторений</Text>
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValueError}>{errorsCount}</Text>
              <Text style={styles.statLabel}>Ошибок</Text>
            </View>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 24, marginBottom: 32 }}>
            <View style={styles.infoBox}>
              <Text style={styles.infoBoxText}>Продолжайте — повторения засчитываются автоматически при полном цикле движения.</Text>
            </View>
          </View>
        )}

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
          {uniqueErrorsList.length > 0 ? (
            uniqueErrorsList.map((err, index) => {
              const { icon, hint } = getHintAndIcon(err.title);
              return (
                <View key={index} style={styles.errorCard}>
                  <View style={styles.errorIcon}>
                    {icon}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.errorTitle}>
                      {err.title} {formatCount(err.count)}
                    </Text>
                    <Text style={styles.errorHint}>{hint}</Text>
                  </View>
                </View>
              );
            })
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
  scoreCircleContainer: {
    width: 192,
    height: 192,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 50,
    elevation: 10,
  },
  infoBox: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  infoBoxText: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
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
  errorHint: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 20,
    marginBottom: 4,
  },
  errorText: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 18,
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
