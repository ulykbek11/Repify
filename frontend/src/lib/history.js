import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'repify.history';
const MAX_ENTRIES = 100;

export async function loadHistory() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export async function addToHistory(exercise, result) {
  const entry = {
    id: `${Date.now()}`,
    date: new Date().toISOString(),
    exercise,
    reps: result.total_reps || 0,
    holdSeconds: result.mode === 'hold' ? result.hold_seconds || 0 : null,
    score: result.score || 0,
    engine: result.engine || 'local',
  };
  const list = [entry, ...(await loadHistory())].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(KEY, JSON.stringify(list));
  return entry;
}

export const clearHistory = () => AsyncStorage.removeItem(KEY);
