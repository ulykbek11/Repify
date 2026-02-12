
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState } from 'react-native';

// TODO: Replace with your actual Supabase project credentials
const SUPABASE_URL = 'https://uqczsmxijmmyrqbkjigi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVxY3pzbXhpam1teXJxYmtqaWdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3ODM3NjEsImV4cCI6MjA4NTM1OTc2MX0.7S7MpeYy3qvRXZDRQq6Eo6rWEVYy2qlPukkzRGwz4nM';

// 🔥 DEV MODE: Set to true to bypass Supabase authentication for testing
export const DEV_MODE = true;

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: {
    // Add timeout to prevent hanging
    fetch: (url, options = {}) => {
      return Promise.race([
        fetch(url, options),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        )
      ]);
    }
  }
});

// Tells Supabase to auto-refresh the session while the app is in the foreground
AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

// Mock mode flag - set to false when you have real keys
export const MOCK_MODE = false;

export const mockData = {
  exercises: [
    {
      id: 'squat',
      title: 'Приседания',
      subtitle: 'Базовое упражнение для ног',
      tag: 'Ноги',
      type: 'squat'
    },
    {
      id: 'deadlift',
      title: 'Становая тяга',
      subtitle: 'Спина и задняя цепь',
      tag: 'Спина',
      type: 'deadlift'
    }
  ]
};
