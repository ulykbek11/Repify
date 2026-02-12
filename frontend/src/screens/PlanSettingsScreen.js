import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { ChevronLeft, RefreshCw } from 'lucide-react-native';
import Slider from '@react-native-community/slider';

export default function PlanSettingsScreen() {
  const navigation = useNavigation();
  
  // Settings State
  const [goal, setGoal] = useState('muscle_gain');
  const [frequency, setFrequency] = useState(3);
  const [duration, setDuration] = useState('45-60');
  const [equipment, setEquipment] = useState({
    barbell: true,
    dumbbell: true,
    machines: true,
    bodyweight: false,
    bands: false
  });

  const toggleEquipment = (key) => {
    setEquipment(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="flex-row items-center px-6 py-4 border-b border-white/5">
        <TouchableOpacity onPress={() => navigation.goBack()} className="p-2 -ml-2 mr-2">
            <ChevronLeft color="white" size={24} />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Настройки плана</Text>
      </View>

      <ScrollView className="flex-1 px-6 py-6">
        {/* Goal Section */}
        <View className="bg-surface rounded-2xl p-4 mb-6 border border-white/5">
            <Text className="text-white font-bold mb-2">Текущая цель</Text>
            <View className="flex-row justify-between items-center">
                <Text className="text-primary text-xl font-bold">Набор массы</Text>
                <TouchableOpacity>
                    <Text className="text-primary font-semibold">Изменить</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* Frequency Section */}
        <View className="mb-8">
            <Text className="text-white font-bold mb-4">Тренировок в неделю</Text>
            <View className="bg-surface rounded-2xl p-6 border border-white/5">
                <Text className="text-white text-center text-3xl font-bold mb-4">{frequency} дня</Text>
                <Slider
                    style={{width: '100%', height: 40}}
                    minimumValue={2}
                    maximumValue={6}
                    step={1}
                    value={frequency}
                    onValueChange={setFrequency}
                    minimumTrackTintColor="#FF6B00"
                    maximumTrackTintColor="#2A2F3E"
                    thumbTintColor="#FF6B00"
                />
                <View className="flex-row justify-between px-2 mt-2">
                    <Text className="text-muted text-xs">2</Text>
                    <Text className="text-muted text-xs">6</Text>
                </View>
            </View>
        </View>

        {/* Duration Section */}
        <View className="mb-8">
            <Text className="text-white font-bold mb-4">Длительность тренировки</Text>
            <View className="flex-row space-x-3">
                {['30-45', '45-60', '60-90'].map((time) => (
                    <TouchableOpacity
                        key={time}
                        onPress={() => setDuration(time)}
                        className={`flex-1 py-3 rounded-xl items-center justify-center border ${duration === time ? 'bg-primary border-primary' : 'bg-surface border-white/5'}`}
                    >
                        <Text className={`font-bold ${duration === time ? 'text-white' : 'text-muted'}`}>{time} мин</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>

        {/* Equipment Section */}
        <View className="mb-8">
            <Text className="text-white font-bold mb-4">Доступное оборудование</Text>
            <View className="space-y-3">
                {[
                    { key: 'barbell', label: 'Штанга' },
                    { key: 'dumbbell', label: 'Гантели' },
                    { key: 'machines', label: 'Тренажёры' },
                    { key: 'bodyweight', label: 'Только своё тело' },
                    { key: 'bands', label: 'Резинки' }
                ].map((item) => (
                    <TouchableOpacity 
                        key={item.key}
                        onPress={() => toggleEquipment(item.key)}
                        className={`bg-surface p-4 rounded-xl flex-row justify-between items-center border ${equipment[item.key] ? 'border-primary/50' : 'border-white/5'}`}
                    >
                        <Text className={`text-base ${equipment[item.key] ? 'text-white font-semibold' : 'text-muted'}`}>{item.label}</Text>
                        <View className={`w-6 h-6 rounded-md border items-center justify-center ${equipment[item.key] ? 'bg-primary border-primary' : 'border-white/20'}`}>
                            {equipment[item.key] && <View className="w-2 h-2 bg-white rounded-sm" />}
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
        <View className="h-20" />
      </ScrollView>

      {/* Bottom Action */}
      <View className="absolute bottom-0 left-0 right-0 bg-background p-4 border-t border-white/5">
        <TouchableOpacity 
            className="w-full bg-primary h-14 rounded-2xl items-center justify-center shadow-lg shadow-primary/30 flex-row space-x-2"
            onPress={() => {
                navigation.replace('PlanGenerationLoading'); // Simulate regeneration
            }}
        >
            <RefreshCw color="white" size={20} />
            <Text className="text-white font-bold text-lg">Пересоздать план</Text>
        </TouchableOpacity>
        <Text className="text-muted text-xs text-center mt-2">AI пересоздаст программу за 5 сек</Text>
      </View>
    </SafeAreaView>
  );
}
