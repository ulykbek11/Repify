import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Check, Ruler, Weight, Activity } from 'lucide-react-native';
import { CustomAlert } from '../components/CustomAlert';

export default function OnboardingScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  // We no longer rely on params for auth; user is already logged in (but not onboarded)
  // const { email, password, fullName } = route.params || {};

  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [gender, setGender] = useState('male');
  const [goal, setGoal] = useState('muscle_gain'); // muscle_gain, weight_loss, maintenance
  const [level, setLevel] = useState('beginner'); // beginner, intermediate, advanced
  const [loading, setLoading] = useState(false);

  // Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState({ title: '', message: '', type: 'info', onConfirm: () => {} });

  const showAlert = (title, message, type = 'info', onConfirm = null) => {
    setAlertConfig({ 
        title, 
        message, 
        type, 
        onConfirm: onConfirm || (() => setAlertVisible(false)) 
    });
    setAlertVisible(true);
  };

  const generatePlan = () => {
    // Simple rule-based plan generation
    const plan = {
      generatedAt: new Date().toISOString(),
      goal,
      level,
      schedule: []
    };

    const exercises = {
      muscle_gain: [
        { day: 'День 1: Грудь и Трицепс', exercises: ['Жим лежа', 'Отжимания на брусьях', 'Разводка гантелей', 'Французский жим'] },
        { day: 'День 2: Спина и Бицепс', exercises: ['Подтягивания', 'Тяга штанги в наклоне', 'Тяга верхнего блока', 'Подъем штанги на бицепс'] },
        { day: 'День 3: Ноги и Плечи', exercises: ['Приседания', 'Жим ногами', 'Армейский жим', 'Махи гантелями'] }
      ],
      weight_loss: [
        { day: 'День 1: Фулбоди', exercises: ['Берпи', 'Приседания с прыжком', 'Отжимания', 'Планка'] },
        { day: 'День 2: Кардио + Пресс', exercises: ['Бег 30 мин', 'Скручивания', 'Велосипед', 'Подъем ног'] },
        { day: 'День 3: ВИИТ', exercises: ['Джампинг джеки', 'Альпинист', 'Выпады', 'Бой с тенью'] }
      ],
      maintenance: [
        { day: 'День 1: Верх тела', exercises: ['Жим лежа', 'Тяга блока', 'Жим гантелей сидя', 'Отжимания'] },
        { day: 'День 2: Низ тела', exercises: ['Приседания', 'Выпады', 'Ягодичный мостик', 'Планка'] }
      ]
    };

    // Adjust intensity based on level (mock adjustment)
    let selectedPlan = exercises[goal] || exercises.muscle_gain;
    
    plan.schedule = selectedPlan.map(day => ({
      ...day,
      sets: level === 'beginner' ? 3 : (level === 'intermediate' ? 4 : 5),
      reps: goal === 'muscle_gain' ? '8-12' : (goal === 'weight_loss' ? '15-20' : '10-15')
    }));

    return plan;
  };

  async function handleFinish() {
    if (!height || !weight) {
      showAlert('Ошибка', 'Пожалуйста, укажите рост и вес', 'error');
      return;
    }

    setLoading(true);

    const workoutPlan = generatePlan();

    // Update existing user metadata instead of signing up
    const { error } = await supabase.auth.updateUser({
      data: {
        height: parseInt(height),
        weight: parseInt(weight),
        gender,
        goal,
        level,
        workout_plan: workoutPlan,
        onboarding_completed: true
      }
    });

    setLoading(false);

    if (error) {
        showAlert('Ошибка', error.message, 'error');
    } else {
      showAlert(
        'Готово!',
        'Ваш персональный план тренировок создан.',
        'success',
        () => {
            setAlertVisible(false);
            navigation.replace('Main');
        }
      );
    }
  }

  const SelectOption = ({ label, selected, onPress }) => (
    <TouchableOpacity 
      onPress={onPress}
      style={[
        styles.optionButton,
        selected ? styles.optionButtonActive : styles.optionButtonInactive
      ]}
    >
      <Text style={[styles.optionText, selected ? styles.textActive : styles.textInactive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <CustomAlert 
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={alertConfig.onConfirm}
      />

       <View style={styles.header}>
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Настройка профиля</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{flex: 1}}>
      <ScrollView style={styles.content} contentContainerStyle={{paddingBottom: 40}}>
        
        <Text style={styles.subtitle}>Ответьте на несколько вопросов, чтобы мы составили для вас идеальный план.</Text>

        {/* Height & Weight */}
        <View style={styles.row}>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Рост (см)</Text>
            <View style={styles.inputContainer}>
              <Ruler color="#8B8E98" size={20} />
              <TextInput
                style={styles.input}
                placeholder="175"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={height}
                onChangeText={setHeight}
              />
            </View>
          </View>
          <View style={styles.halfInput}>
            <Text style={styles.label}>Вес (кг)</Text>
            <View style={styles.inputContainer}>
              <Weight color="#8B8E98" size={20} />
              <TextInput
                style={styles.input}
                placeholder="70"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={weight}
                onChangeText={setWeight}
              />
            </View>
          </View>
        </View>

        {/* Gender */}
        <View style={styles.section}>
          <Text style={styles.label}>Пол</Text>
          <View style={styles.optionsRow}>
            <SelectOption label="Мужской" selected={gender === 'male'} onPress={() => setGender('male')} />
            <SelectOption label="Женский" selected={gender === 'female'} onPress={() => setGender('female')} />
          </View>
        </View>

        {/* Goal */}
        <View style={styles.section}>
          <Text style={styles.label}>Ваша цель</Text>
          <View style={styles.optionsRow}>
            <SelectOption label="Набор массы" selected={goal === 'muscle_gain'} onPress={() => setGoal('muscle_gain')} />
            <SelectOption label="Похудение" selected={goal === 'weight_loss'} onPress={() => setGoal('weight_loss')} />
            <SelectOption label="Поддержание" selected={goal === 'maintenance'} onPress={() => setGoal('maintenance')} />
          </View>
        </View>

        {/* Level */}
        <View style={styles.section}>
          <Text style={styles.label}>Уровень подготовки</Text>
          <View style={styles.optionsRow}>
            <SelectOption label="Новичок" selected={level === 'beginner'} onPress={() => setLevel('beginner')} />
            <SelectOption label="Средний" selected={level === 'intermediate'} onPress={() => setLevel('intermediate')} />
            <SelectOption label="Продвинутый" selected={level === 'advanced'} onPress={() => setLevel('advanced')} />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleFinish}
          disabled={loading}
          style={[styles.finishButton, loading && styles.buttonDisabled]}
        >
          {loading ? (
            <Activity color="white" style={{marginRight: 8}} />
          ) : (
            <Check color="white" style={{marginRight: 8}} />
          )}
          <Text style={styles.finishButtonText}>
            {loading ? 'Создание аккаунта...' : 'Завершить регистрацию'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E1A',
    paddingHorizontal: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: '#1A1F2E',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    marginRight: 16,
  },
  headerTitle: {
    color: 'white',
    fontSize: 20,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  subtitle: {
    color: '#8B8E98',
    marginBottom: 24,
    fontSize: 14,
  },
  row: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  halfInput: {
    flex: 1,
  },
  label: {
    color: 'white',
    fontWeight: '600',
    marginBottom: 8,
    marginLeft: 4,
  },
  inputContainer: {
    backgroundColor: '#1A1F2E',
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
  },
  input: {
    flex: 1,
    marginLeft: 12,
    color: 'white',
    fontSize: 16,
  },
  section: {
    marginBottom: 24,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  optionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  optionButtonActive: {
    backgroundColor: '#FF6B00',
    borderColor: '#FF6B00',
  },
  optionButtonInactive: {
    backgroundColor: '#1A1F2E',
    borderColor: 'rgba(255,255,255,0.05)',
  },
  optionText: {
    fontWeight: '500',
  },
  textActive: {
    color: 'white',
  },
  textInactive: {
    color: '#8B8E98',
  },
  finishButton: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 16,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FF6B00',
    marginBottom: 32,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(255,107,0,0.5)',
  },
  finishButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 18,
  },
});
