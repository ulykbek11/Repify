import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { StatusBar } from 'expo-status-bar';
import { Home, User, Trophy, PlayCircle } from 'lucide-react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import HomeScreen from './src/screens/HomeScreen';
import ExerciseScreen from './src/screens/ExerciseScreen';
import AnalysisResultScreen from './src/screens/AnalysisResultScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import LeaderboardScreen from './src/screens/LeaderboardScreen';
import PlanGenerationLoadingScreen from './src/screens/PlanGenerationLoadingScreen';
import PlanSuccessScreen from './src/screens/PlanSuccessScreen';
import FullPlanScreen from './src/screens/FullPlanScreen';
import WorkoutDayScreen from './src/screens/WorkoutDayScreen';
import PlanSettingsScreen from './src/screens/PlanSettingsScreen';
import linking from './src/navigation/linking';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#0A0E1A',
          borderTopColor: '#1A1F2E',
          height: 60,
          paddingBottom: 8,
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
        name="LeaderboardTab"
        component={LeaderboardScreen}
        options={{
          tabBarLabel: 'Лидеры',
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
          <Stack.Screen name="PlanGenerationLoading" component={PlanGenerationLoadingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PlanSuccess" component={PlanSuccessScreen} options={{ headerShown: false }} />
          <Stack.Screen name="FullPlan" component={FullPlanScreen} options={{ headerShown: false }} />
          <Stack.Screen name="WorkoutDay" component={WorkoutDayScreen} options={{ headerShown: false }} />
          <Stack.Screen name="PlanSettings" component={PlanSettingsScreen} options={{ headerShown: false }} />
          <Stack.Screen name="Main" component={TabNavigator} />
          <Stack.Screen name="Exercise" component={ExerciseScreen} />
          <Stack.Screen name="AnalysisResult" component={AnalysisResultScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
