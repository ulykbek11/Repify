import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Platform, KeyboardAvoidingView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import { supabase } from '../lib/supabase';
import { ArrowLeft, Check, Ruler, Weight, Activity, Target } from 'lucide-react-native';
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
      className={`px-4 py-2 rounded-xl border mr-2 mb-2 ${selected ? 'bg-primary border-primary' : 'bg-surface border-white/5'}`}
    >
      <Text className={`${selected ? 'text-white' : 'text-muted'} font-medium`}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1 bg-background px-8">
      <CustomAlert 
        visible={alertVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        type={alertConfig.type}
        onClose={alertConfig.onConfirm}
      />

       <View className="flex-row items-center px-6 py-4">
        <TouchableOpacity 
          onPress={() => navigation.goBack()}
          className="w-10 h-10 bg-surface rounded-full items-center justify-center border border-white/5 mr-4"
        >
          <ArrowLeft color="white" size={20} />
        </TouchableOpacity>
        <Text className="text-white text-xl font-bold">Настройка профиля</Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} className="flex-1">
      <ScrollView className="flex-1 px-6">
        
        <Text className="text-muted mb-6">Ответьте на несколько вопросов, чтобы мы составили для вас идеальный план.</Text>

        {/* Height & Weight */}
        <View className="flex-row space-x-4 mb-6">
          <View className="flex-1">
            <Text className="text-white font-semibold mb-2 ml-1">Рост (см)</Text>
            <View className="bg-surface rounded-2xl flex-row items-center px-4 py-3 border border-white/5">
              <Ruler color="#8B8E98" size={20} />
              <TextInput
                className="flex-1 ml-3 text-white text-base"
                placeholder="175"
                placeholderTextColor="#555"
                keyboardType="numeric"
                value={height}
                onChangeText={setHeight}
              />
            </View>
          </View>
          <View className="flex-1">
            <Text className="text-white font-semibold mb-2 ml-1">Вес (кг)</Text>
            <View className="bg-surface rounded-2xl flex-row items-center px-4 py-3 border border-white/5">
              <Weight color="#8B8E98" size={20} />
              <TextInput
                className="flex-1 ml-3 text-white text-base"
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
        <View className="mb-6">
          <Text className="text-white font-semibold mb-3 ml-1">Пол</Text>
          <View className="flex-row flex-wrap">
            <SelectOption label="Мужской" selected={gender === 'male'} onPress={() => setGender('male')} />
            <SelectOption label="Женский" selected={gender === 'female'} onPress={() => setGender('female')} />
          </View>
        </View>

        {/* Goal */}
        <View className="mb-6">
          <Text className="text-white font-semibold mb-3 ml-1">Ваша цель</Text>
          <View className="flex-row flex-wrap">
            <SelectOption label="Набор массы" selected={goal === 'muscle_gain'} onPress={() => setGoal('muscle_gain')} />
            <SelectOption label="Похудение" selected={goal === 'weight_loss'} onPress={() => setGoal('weight_loss')} />
            <SelectOption label="Поддержание" selected={goal === 'maintenance'} onPress={() => setGoal('maintenance')} />
          </View>
        </View>

        {/* Level */}
        <View className="mb-8">
          <Text className="text-white font-semibold mb-3 ml-1">Уровень подготовки</Text>
          <View className="flex-row flex-wrap">
            <SelectOption label="Новичок" selected={level === 'beginner'} onPress={() => setLevel('beginner')} />
            <SelectOption label="Средний" selected={level === 'intermediate'} onPress={() => setLevel('intermediate')} />
            <SelectOption label="Продвинутый" selected={level === 'advanced'} onPress={() => setLevel('advanced')} />
          </View>
        </View>

        <TouchableOpacity
          onPress={handleFinish}
          disabled={loading}
          className={`w-full py-4 rounded-2xl flex-row justify-center items-center ${
            loading ? 'bg-primary/50' : 'bg-primary'
          } mb-8`}
        >
          {loading ? (
            <Activity color="white" className="mr-2" />
          ) : (
            <Check color="white" className="mr-2" />
          )}
          <Text className="text-white font-bold text-lg">
            {loading ? 'Создание аккаунта...' : 'Завершить регистрацию'}
          </Text>
        </TouchableOpacity>

      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
