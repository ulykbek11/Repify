import React from 'react';
import { View, Text, ScrollView, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Trophy, Medal } from 'lucide-react-native';

export default function LeaderboardScreen() {
  const leaders = [
    { id: 1, name: "Мария С.", score: 980, avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100" },
    { id: 2, name: "Алекс Т.", score: 945, avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100" },
    { id: 3, name: "Джон Д.", score: 910, avatar: "https://images.unsplash.com/photo-1599566150163-29194dcaad36?w=100" },
    { id: 4, name: "Елена В.", score: 880, avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100" },
    { id: 5, name: "Макс П.", score: 850, avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100" },
  ];

  return (
    <SafeAreaView className="flex-1 bg-background">
      <View className="px-6 py-4 flex-row items-center space-x-2">
        <Trophy color="#FF6B00" size={24} />
        <Text className="text-2xl font-bold text-white">Лидеры</Text>
      </View>

      <ScrollView className="flex-1" contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Top 3 Podium */}
        <View className="flex-row justify-center items-end h-64 mb-8 px-6">
          {/* 2nd Place */}
          <View className="items-center -mr-4 z-10">
            <View className="w-16 h-16 rounded-full border-2 border-white mb-2 overflow-hidden">
              <Image source={{ uri: leaders[1].avatar }} className="w-full h-full" />
            </View>
            <Text className="text-white font-bold mb-1">{leaders[1].name}</Text>
            <View className="w-24 h-32 bg-card rounded-t-lg border-t-4 border-secondary items-center justify-center">
              <Text className="text-3xl font-bold text-white">2</Text>
              <Text className="text-secondary text-xs font-bold">{leaders[1].score}</Text>
            </View>
          </View>

          {/* 1st Place */}
          <View className="items-center z-20 mb-4">
            <View className="w-20 h-20 rounded-full border-2 border-primary mb-2 overflow-hidden shadow-[0_0_20px_rgba(255,107,0,0.5)]">
              <Image source={{ uri: leaders[0].avatar }} className="w-full h-full" />
            </View>
            <View className="bg-primary px-2 py-0.5 rounded-full absolute -top-2">
               <Text className="text-white text-[10px] font-bold">CHAMPION</Text>
            </View>
            <Text className="text-white font-bold text-lg mb-1">{leaders[0].name}</Text>
            <View className="w-28 h-40 bg-card rounded-t-lg border-t-4 border-primary items-center justify-center shadow-[0_0_30px_rgba(255,107,0,0.2)]">
              <Trophy color="#FF6B00" size={32} />
              <Text className="text-4xl font-bold text-white mt-2">1</Text>
              <Text className="text-primary text-sm font-bold">{leaders[0].score}</Text>
            </View>
          </View>

          {/* 3rd Place */}
          <View className="items-center -ml-4 z-10">
            <View className="w-16 h-16 rounded-full border-2 border-white mb-2 overflow-hidden">
              <Image source={{ uri: leaders[2].avatar }} className="w-full h-full" />
            </View>
            <Text className="text-white font-bold mb-1">{leaders[2].name}</Text>
            <View className="w-24 h-24 bg-card rounded-t-lg border-t-4 border-muted items-center justify-center">
              <Text className="text-3xl font-bold text-white">3</Text>
              <Text className="text-muted text-xs font-bold">{leaders[2].score}</Text>
            </View>
          </View>
        </View>

        {/* List */}
        <View className="px-6 space-y-3">
          {leaders.slice(3).map((leader, index) => (
            <View key={leader.id} className="bg-card p-4 rounded-2xl border border-white/5 flex-row items-center">
              <Text className="text-muted font-bold text-lg w-8">{index + 4}</Text>
              <Image source={{ uri: leader.avatar }} className="w-10 h-10 rounded-full bg-gray-700 mr-3" />
              <Text className="text-white font-bold flex-1">{leader.name}</Text>
              <Text className="text-primary font-bold">{leader.score}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
