import React, { useEffect } from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Home, User, Trophy, PlayCircle } from 'lucide-react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { verifyInstallation } from 'nativewind';

import './src/global.css';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ExerciseScreen from './src/screens/ExerciseScreen';
import AnalysisResultScreen from './src/screens/AnalysisResultScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import EditProfileScreen from './src/screens/EditProfileScreen';
import ProgressScreen from './src/screens/ProgressScreen';
import PlanGenerationLoadingScreen from './src/screens/PlanGenerationLoadingScreen';
import PlanSuccessScreen from './src/screens/PlanSuccessScreen';
import FullPlanScreen from './src/screens/FullPlanScreen';
import WorkoutDayScreen from './src/screens/WorkoutDayScreen';
import PlanSettingsScreen from './src/screens/PlanSettingsScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CalibrationScreen from './src/screens/CalibrationScreen';
import linking from './src/navigation/linking';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0E1A',
          borderTopColor: '#1A1F2E',
          height: Platform.OS === 'android' ? 60 + insets.bottom + 10 : 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : (Platform.OS === 'android' ? 12 : 8),
          paddingTop: 8,
        },
        tabBarActiveTintColor: '#FF6B00',
        tabBarInactiveTintColor: '#8B8E98',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        }
      }}
    >
      <Tab.Screen
        name="HomeTab"
        component={HomeScreen}
        options={{
          tabBarLabel: 'Тренировка',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="ProgressTab"
        component={ProgressScreen}
        options={{
          tabBarLabel: 'Прогресс',
          tabBarIcon: ({ color, size }) => <Trophy color={color} size={size} />
        }}
      />
      <Tab.Screen
        name="ProfileTab"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Профиль',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />
        }}
      />
    </Tab.Navigator>
  );
}

export default function App() {
  useEffect(() => {
    if (__DEV__) {
      try {
        verifyInstallation();
      } catch (error) {
        console.error(error);
      }
    }
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerShown: false,
            cardStyle: { backgroundColor: '#0A0E1A' }
          }}
        >
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="Calibration" component={CalibrationScreen} />
          <Stack.Screen name="Onboarding" component={OnboardingScreen} />
          <Stack.Screen name="PlanGenerationLoading" component={PlanGenerationLoadingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PlanSuccess" component={PlanSuccessScreen} options={{ headerShown: false }} />
          <Stack.Screen name="FullPlan" component={FullPlanScreen} options={{ headerShown: false }} />
          <Stack.Screen name="WorkoutDay" component={WorkoutDayScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PlanSettings" component={PlanSettingsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="EditProfile" component={EditProfileScreen} />
          <Stack.Screen name="Exercise" component={ExerciseScreen} />
          <Stack.Screen name="AnalysisResult" component={AnalysisResultScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
