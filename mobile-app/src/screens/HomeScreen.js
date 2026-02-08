import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { PlayCircle, Dumbbell, Target, ChevronRight, Activity } from 'lucide-react-native';

export default function HomeScreen() {
  const navigation = useNavigation();

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
    <SafeAreaView className="flex-1 bg-background">
      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Header */}
        <View className="flex-row items-center justify-between px-6 py-4">
          <View className="flex-row items-center space-x-2">
            <View className="w-10 h-10 items-center justify-center">
              <Image 
                source={require('../../assets/logo.png')} 
                className="w-full h-full rounded-xl"
                resizeMode="contain"
              />
            </View>
            <Text className="text-2xl font-bold text-white tracking-wider">Repify</Text>
          </View>
          <TouchableOpacity className="w-10 h-10 bg-card rounded-full items-center justify-center border border-white/5">
            <Activity color="#FF6B00" size={20} />
          </TouchableOpacity>
        </View>

        {/* Hero Section */}
        <View className="px-6 mt-4 mb-8">
          <View className="bg-primary rounded-3xl p-6 overflow-hidden relative shadow-lg shadow-primary/30">
             <View className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-10 -mt-10" />
             <View className="absolute bottom-0 left-0 w-24 h-24 bg-black/10 rounded-full -ml-10 -mb-10" />
             
             <Text className="text-white/80 font-semibold mb-1 uppercase tracking-widest text-xs">Твой AI Тренер</Text>
             <Text className="text-white text-3xl font-bold leading-8 mb-4">
               Идеальная техника{'\n'}в каждом повторе
             </Text>
             <TouchableOpacity className="bg-white px-5 py-3 rounded-xl self-start">
               <Text className="text-primary font-bold">Начать тренировку</Text>
             </TouchableOpacity>
          </View>
        </View>

        {/* Categories Chips */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="px-6 mb-8 max-h-10">
          {['Все', 'Силовые', 'Кардио', 'Растяжка'].map((cat, i) => (
            <TouchableOpacity 
              key={cat} 
              className={`mr-3 px-5 py-2 rounded-full border ${i === 0 ? 'bg-card border-primary' : 'bg-transparent border-white/10'}`}
            >
              <Text className={`${i === 0 ? 'text-primary font-bold' : 'text-muted'}`}>{cat}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Exercises List */}
        <View className="px-6">
          <Text className="text-white text-xl font-bold mb-4">Популярные упражнения</Text>
          <View className="space-y-4">
            {exercises.map((exercise) => (
              <TouchableOpacity
                key={exercise.id}
                onPress={() => navigation.navigate('Exercise', { exercise: exercise.id })}
                className="bg-card rounded-2xl overflow-hidden border border-white/5 shadow-sm active:scale-95 transition-all"
              >
                <View className="h-40 w-full relative bg-gray-800">
                  <Image 
                    source={{ uri: exercise.image }} 
                    className="w-full h-full opacity-60"
                    resizeMode="cover"
                  />
                  <View className="absolute top-4 left-4 bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">
                    <Text className="text-white text-xs font-bold">{exercise.level}</Text>
                  </View>
                  <View className="absolute bottom-4 right-4 bg-primary px-3 py-2 rounded-full flex-row items-center space-x-1 shadow-lg shadow-primary/40">
                    <PlayCircle color="white" size={16} fill="white" />
                    <Text className="text-white font-bold text-xs">Начать</Text>
                  </View>
                </View>
                
                <View className="p-4">
                  <View className="flex-row justify-between items-start mb-1">
                    <Text className="text-white text-lg font-bold">{exercise.title}</Text>
                    <View className="flex-row items-center space-x-1">
                      <Activity size={14} color="#8B8E98" />
                      <Text className="text-muted text-xs">{exercise.duration}</Text>
                    </View>
                  </View>
                  <Text className="text-muted text-sm leading-5">{exercise.description}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
