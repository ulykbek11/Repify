import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Activity } from 'lucide-react-native';

export default function PlanGenerationLoadingScreen() {
  const navigation = useNavigation();
  const [loadingText, setLoadingText] = useState('Анализируем твои данные...');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Имитация этапов загрузки
    const stages = [
      { text: 'Анализируем твои данные...', time: 0 },
      { text: 'Подбираем упражнения...', time: 1500 },
      { text: 'Рассчитываем нагрузку...', time: 3000 },
      { text: 'Почти готово!', time: 4500 }
    ];

    stages.forEach(({ text, time }) => {
      setTimeout(() => setLoadingText(text), time);
    });

    // Имитация прогресс бара
    const interval = setInterval(() => {
      setProgress(p => {
        if (p >= 100) {
          clearInterval(interval);
          setTimeout(() => navigation.replace('PlanSuccess'), 500);
          return 100;
        }
        return p + 2;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Вместо Lottie пока используем иконку с пульсацией или просто статичную */}
        <View style={styles.iconContainer}>
            <Activity size={64} color="#FF6B00" />
        </View>

        <Text style={styles.title}>Создаём твою программу...</Text>
        <Text style={styles.subtitle}>{loadingText}</Text>

        {/* Custom Progress Bar */}
        <View style={styles.progressContainer}>
            <LinearGradient
                colors={['#FF6B00', '#FF3B5C']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ width: `${progress}%`, height: '100%' }}
            />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 32,
  },
  iconContainer: {
    marginBottom: 32,
    width: 128,
    height: 128,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,107,0,0.1)',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,107,0,0.2)',
  },
  title: {
    color: 'white',
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#8B8E98',
    fontSize: 16,
    marginBottom: 48,
    textAlign: 'center',
  },
  progressContainer: {
    width: '100%',
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 999,
    overflow: 'hidden',
  },
});
