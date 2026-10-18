// On-device profile: optional name and height, stored locally. There are no accounts: history and
// profile never leave the device.
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'repify.profile';
const EMPTY = { name: '', heightCm: null };

const ProfileContext = createContext({ profile: EMPTY, ready: false, save: async () => {} });

export function ProfileProvider({ children }) {
  const [profile, setProfile] = useState(EMPTY);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => { if (raw) setProfile({ ...EMPTY, ...JSON.parse(raw) }); })
      .catch(() => {})
      .finally(() => setReady(true));
  }, []);

  const save = useCallback(async (next) => {
    const clean = {
      name: (next.name || '').trim().slice(0, 40),
      heightCm: next.heightCm && next.heightCm >= 80 && next.heightCm <= 250 ? Math.round(next.heightCm) : null,
    };
    setProfile(clean);
    await AsyncStorage.setItem(KEY, JSON.stringify(clean));
  }, []);

  const value = useMemo(() => ({ profile, ready, save }), [profile, ready, save]);
  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export const useProfile = () => useContext(ProfileContext);
