import React, { useEffect, useState } from 'react';
import { View, Text } from 'react-native';
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
    <SafeAreaView className="flex-1 bg-background items-center justify-center">
      <View className="items-center w-full px-8">
        {/* Вместо Lottie пока используем иконку с пульсацией или просто статичную */}
        <View className="mb-8 w-32 h-32 items-center justify-center bg-primary/10 rounded-full border border-primary/20">
            <Activity size={64} color="#FF6B00" />
        </View>

        <Text className="text-white text-2xl font-bold mb-2 text-center">Создаём твою программу...</Text>
        <Text className="text-muted text-base mb-12 text-center">{loadingText}</Text>

        {/* Custom Progress Bar */}
        <View className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
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
