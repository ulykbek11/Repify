import AsyncStorage from '@react-native-async-storage/async-storage';

const key = (userId) => `repify.history.${userId}`;
const MAX_ENTRIES = 100;

export async function loadHistory(userId) {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

export async function addToHistory(userId, exercise, result) {
  const entry = {
    id: `${Date.now()}`,
    date: new Date().toISOString(),
    exercise,
    reps: result.total_reps || 0,
    holdSeconds: result.mode === 'hold' ? result.hold_seconds || 0 : null,
    score: result.score || 0,
    engine: result.engine || 'local',
    synthetic: Boolean(result.synthetic),
  };
  const list = [entry, ...(await loadHistory(userId))].slice(0, MAX_ENTRIES);
  await AsyncStorage.setItem(key(userId), JSON.stringify(list));
  return entry;
}

export const clearHistory = (userId) => AsyncStorage.removeItem(key(userId));
