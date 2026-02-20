import React from 'react';
import { View, Text, ScrollView, Image, StyleSheet } from 'react-native';
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Trophy color="#FF6B00" size={24} />
        <Text style={styles.headerTitle}>Лидеры</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{ paddingBottom: 100 }}>
        {/* Top 3 Podium */}
        <View style={styles.podiumContainer}>
          {/* 2nd Place */}
          <View style={[styles.podiumItem, styles.podiumItemSide]}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: leaders[1].avatar }} style={styles.avatar} />
            </View>
            <Text style={styles.name}>{leaders[1].name}</Text>
            <View style={[styles.podiumBar, styles.podiumBarSecond]}>
              <Text style={styles.rank}>2</Text>
              <Text style={[styles.score, { color: '#FF3B5C' }]}>{leaders[1].score}</Text>
            </View>
          </View>

          {/* 1st Place */}
          <View style={[styles.podiumItem, styles.podiumItemCenter]}>
            <View style={[styles.avatarContainer, styles.avatarContainerFirst]}>
              <Image source={{ uri: leaders[0].avatar }} style={styles.avatar} />
            </View>
            <View style={styles.badge}>
               <Text style={styles.badgeText}>CHAMPION</Text>
            </View>
            <Text style={[styles.name, styles.nameFirst]}>{leaders[0].name}</Text>
            <View style={[styles.podiumBar, styles.podiumBarFirst]}>
              <Trophy color="#FF6B00" size={32} />
              <Text style={[styles.rank, styles.rankFirst]}>1</Text>
              <Text style={[styles.score, { color: '#FF6B00' }]}>{leaders[0].score}</Text>
            </View>
          </View>

          {/* 3rd Place */}
          <View style={[styles.podiumItem, styles.podiumItemSide]}>
            <View style={styles.avatarContainer}>
              <Image source={{ uri: leaders[2].avatar }} style={styles.avatar} />
            </View>
            <Text style={styles.name}>{leaders[2].name}</Text>
            <View style={[styles.podiumBar, styles.podiumBarThird]}>
              <Text style={styles.rank}>3</Text>
              <Text style={[styles.score, { color: '#8B8E98' }]}>{leaders[2].score}</Text>
            </View>
          </View>
        </View>

        {/* List */}
        <View style={styles.listContainer}>
          {leaders.slice(3).map((leader, index) => (
            <View key={leader.id} style={styles.listItem}>
              <Text style={styles.listRank}>{index + 4}</Text>
              <Image source={{ uri: leader.avatar }} style={styles.listAvatar} />
              <Text style={styles.listName}>{leader.name}</Text>
              <Text style={styles.listScore}>{leader.score}</Text>
            </View>
          ))}
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
    gap: 8,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
  },
  content: {
    flex: 1,
  },
  podiumContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-end',
    height: 256,
    marginBottom: 32,
    paddingHorizontal: 24,
  },
  podiumItem: {
    alignItems: 'center',
    zIndex: 10,
  },
  podiumItemSide: {
    // 2nd and 3rd place logic
  },
  podiumItemCenter: {
    zIndex: 20,
    marginBottom: 16,
    marginHorizontal: -16, // overlap slightly
  },
  avatarContainer: {
    width: 64,
    height: 64,
    borderRadius: 999,
    borderWidth: 2,
    borderColor: 'white',
    marginBottom: 8,
    overflow: 'hidden',
  },
  avatarContainerFirst: {
    width: 80,
    height: 80,
    borderColor: '#FF6B00',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 20,
    elevation: 10,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  badge: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    position: 'absolute',
    top: 70, // Adjust based on avatar size
    zIndex: 30,
  },
  badgeText: {
    color: 'white',
    fontSize: 10,
    fontWeight: 'bold',
  },
  name: {
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  nameFirst: {
    fontSize: 18,
  },
  podiumBar: {
    width: 96,
    backgroundColor: '#1A1F2E',
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    borderTopWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  podiumBarSecond: {
    height: 128,
    borderColor: '#FF3B5C', // Secondary color equivalent
  },
  podiumBarFirst: {
    height: 160,
    width: 112,
    borderColor: '#FF6B00',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.2,
    shadowRadius: 30,
    elevation: 10,
  },
  podiumBarThird: {
    height: 96,
    borderColor: '#8B8E98',
  },
  rank: {
    fontSize: 30,
    fontWeight: 'bold',
    color: 'white',
  },
  rankFirst: {
    fontSize: 36,
    marginTop: 8,
  },
  score: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  listContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  listItem: {
    backgroundColor: '#1A1F2E',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  listRank: {
    color: '#8B8E98',
    fontWeight: 'bold',
    fontSize: 18,
    width: 32,
  },
  listAvatar: {
    width: 40,
    height: 40,
    borderRadius: 999,
    backgroundColor: '#374151',
    marginRight: 12,
  },
  listName: {
    color: 'white',
    fontWeight: 'bold',
    flex: 1,
  },
  listScore: {
    color: '#FF6B00',
    fontWeight: 'bold',
  },
});
