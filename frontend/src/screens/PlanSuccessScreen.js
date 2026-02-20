import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { CheckCircle, Calendar, Clock, TrendingUp } from 'lucide-react-native';

export default function PlanSuccessScreen() {
  const navigation = useNavigation();

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        {/* Hero Section */}
        <LinearGradient
          colors={['#FF6B00', '#FF3B5C']}
          style={styles.heroGradient}
        >
          <View style={styles.heroIconContainer}>
            <CheckCircle color="white" size={32} />
          </View>
          <Text style={styles.heroTitle}>Твой План Готов!</Text>
          <Text style={styles.heroSubtitle}>Программа на 12 недель</Text>
        </LinearGradient>

        {/* Plan Overview Card */}
        <View style={styles.overviewCard}>
          <Text style={styles.cardTitle}>Твоя программа</Text>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
                <Calendar color="#FF6B00" size={24} style={{marginBottom: 8}} />
                <Text style={styles.statLabel}>3 дня/нед</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statItem}>
                <Clock color="#FF6B00" size={24} style={{marginBottom: 8}} />
                <Text style={styles.statLabel}>45-60 мин</Text>
            </View>
            <View style={styles.verticalDivider} />
            <View style={styles.statItem}>
                <TrendingUp color="#FF6B00" size={24} style={{marginBottom: 8}} />
                <Text style={styles.statLabel}>Набор массы</Text>
            </View>
          </View>

          <View style={styles.horizontalDivider} />

          <Text style={styles.nextWorkoutLabel}>Следующая тренировка:</Text>
          <Text style={styles.nextWorkoutTitle}>День 1: Грудь + Трицепс</Text>
          <Text style={styles.nextWorkoutSubtitle}>6 упражнений • 18 подходов</Text>
        </View>

        {/* Exercises Preview */}
        <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Предпросмотр плана</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 24, paddingBottom: 32}}>
                {[1, 2, 3].map((day) => (
                    <View key={day} style={styles.previewCard}>
                        <Text style={styles.previewCardTitle}>День {day}: {day === 1 ? 'Грудь' : day === 2 ? 'Спина' : 'Ноги'}</Text>
                        <View style={styles.exerciseList}>
                            <Text style={styles.exerciseText}>• Жим лёжа 4x10</Text>
                            <Text style={styles.exerciseText}>• Разводка 3x12</Text>
                            <Text style={styles.exerciseText}>• Отжимания 3x15</Text>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </View>
      </ScrollView>

      {/* Footer Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity 
            style={styles.primaryButton}
            onPress={() => navigation.navigate('WorkoutDay')}
        >
            <Text style={styles.primaryButtonText}>Начать первую тренировку</Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('FullPlan')}
        >
            <Text style={styles.secondaryButtonText}>Посмотреть весь план</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  content: {
    flex: 1,
  },
  heroGradient: {
    paddingHorizontal: 32,
    paddingVertical: 48,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    alignItems: 'center',
  },
  heroIconContainer: {
    width: 64,
    height: 64,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  heroTitle: {
    color: 'white',
    fontSize: 24, // 3xl roughly
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 16,
    textAlign: 'center',
  },
  overviewCard: {
    backgroundColor: '#1A1F2E',
    marginHorizontal: 16,
    marginTop: -32,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 10,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  cardTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    color: '#8B8E98',
    fontSize: 12,
    textAlign: 'center',
  },
  verticalDivider: {
    width: 1,
    height: '100%',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  horizontalDivider: {
    height: 1,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 24,
  },
  nextWorkoutLabel: {
    color: '#8B8E98',
    fontSize: 14,
    marginBottom: 8,
  },
  nextWorkoutTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  nextWorkoutSubtitle: {
    color: '#8B8E98',
    fontSize: 14,
  },
  previewSection: {
    marginTop: 32,
  },
  sectionTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    paddingHorizontal: 24,
    marginBottom: 16,
  },
  previewCard: {
    width: 280,
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  previewCardTitle: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  exerciseList: {
    gap: 8,
  },
  exerciseText: {
    color: '#8B8E98',
    fontSize: 14,
  },
  footer: {
    padding: 24,
    backgroundColor: '#0A0E1A',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#FF6B00',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  secondaryButton: {
    width: '100%',
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#8B8E98',
    fontSize: 16,
  },
});
