import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Switch, StyleSheet } from 'react-native';
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <ChevronLeft color="white" size={24} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Настройки плана</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={{paddingBottom: 24}}>
        {/* Goal Section */}
        <View style={styles.card}>
            <Text style={styles.sectionTitle}>Текущая цель</Text>
            <View style={styles.rowBetween}>
                <Text style={styles.goalText}>Набор массы</Text>
                <TouchableOpacity>
                    <Text style={styles.changeText}>Изменить</Text>
                </TouchableOpacity>
            </View>
        </View>

        {/* Frequency Section */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Тренировок в неделю</Text>
            <View style={styles.sliderCard}>
                <Text style={styles.sliderValue}>{frequency} дня</Text>
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
                <View style={styles.sliderLabels}>
                    <Text style={styles.mutedText}>2</Text>
                    <Text style={styles.mutedText}>6</Text>
                </View>
            </View>
        </View>

        {/* Duration Section */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Длительность тренировки</Text>
            <View style={styles.durationRow}>
                {['30-45', '45-60', '60-90'].map((time) => (
                    <TouchableOpacity
                        key={time}
                        onPress={() => setDuration(time)}
                        style={[
                            styles.durationButton,
                            duration === time ? styles.durationButtonActive : styles.durationButtonInactive
                        ]}
                    >
                        <Text style={[
                            styles.durationText,
                            duration === time ? styles.textActive : styles.textInactive
                        ]}>{time} мин</Text>
                    </TouchableOpacity>
                ))}
            </View>
        </View>

        {/* Equipment Section */}
        <View style={styles.section}>
            <Text style={styles.sectionTitle}>Доступное оборудование</Text>
            <View style={styles.equipmentList}>
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
                        style={[
                            styles.equipmentItem,
                            equipment[item.key] ? styles.equipmentItemActive : styles.equipmentItemInactive
                        ]}
                    >
                        <Text style={[
                            styles.equipmentText,
                            equipment[item.key] ? styles.textActive : styles.textInactive
                        ]}>{item.label}</Text>
                        <View style={[
                            styles.checkbox,
                            equipment[item.key] ? styles.checkboxActive : styles.checkboxInactive
                        ]}>
                            {equipment[item.key] && <View style={styles.checkboxInner} />}
                        </View>
                    </TouchableOpacity>
                ))}
            </View>
        </View>
        <View style={{height: 80}} />
      </ScrollView>

      {/* Bottom Action */}
      <View style={styles.footer}>
        <TouchableOpacity 
            style={styles.refreshButton}
            onPress={() => {
                navigation.replace('PlanGenerationLoading'); // Simulate regeneration
            }}
        >
            <RefreshCw color="white" size={20} style={{marginRight: 8}} />
            <Text style={styles.refreshButtonText}>Пересоздать план</Text>
        </TouchableOpacity>
        <Text style={styles.footerNote}>AI пересоздаст программу за 5 сек</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
    marginRight: 8,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  card: {
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sectionTitle: {
    color: 'white',
    fontWeight: 'bold',
    marginBottom: 8, // mb-2
    fontSize: 16,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalText: {
    color: '#FF6B00',
    fontSize: 20,
    fontWeight: 'bold',
  },
  changeText: {
    color: '#FF6B00',
    fontWeight: '600',
  },
  section: {
    marginBottom: 32,
  },
  sliderCard: {
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  sliderValue: {
    color: 'white',
    textAlign: 'center',
    fontSize: 30,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    marginTop: 8,
  },
  mutedText: {
    color: '#8B8E98',
    fontSize: 12,
  },
  durationRow: {
    flexDirection: 'row',
    gap: 12,
  },
  durationButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  durationButtonActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  durationButtonInactive: {
    backgroundColor: '#1A1F2E',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  durationText: {
    fontWeight: 'bold',
  },
  textActive: {
    color: 'white',
  },
  textInactive: {
    color: '#8B8E98',
  },
  equipmentList: {
    gap: 12,
  },
  equipmentItem: {
    backgroundColor: '#1A1F2E',
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
  },
  equipmentItemActive: {
    borderColor: 'rgba(255,107,0,0.5)',
  },
  equipmentItemInactive: {
    borderColor: 'rgba(255,255,255,0.05)',
  },
  equipmentText: {
    fontSize: 16,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  checkboxInactive: {
    borderColor: 'rgba(255,255,255,0.2)',
  },
  checkboxInner: {
    width: 8,
    height: 8,
    backgroundColor: 'white',
    borderRadius: 2,
  },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#0A0E1A',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.05)',
  },
  refreshButton: {
    width: '100%',
    backgroundColor: '#FF6B00',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    shadowColor: '#FF6B00',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
    marginBottom: 8,
  },
  refreshButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
  footerNote: {
    color: '#8B8E98',
    fontSize: 12,
    textAlign: 'center',
  },
});
