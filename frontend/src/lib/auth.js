import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';

const DEMO_KEY = 'repify.demo.user';

export const isCloudAuth = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let supabase = null;
if (isCloudAuth) {
  // Loaded lazily so demo mode does not need the client at all.
  const { createClient } = require('@supabase/supabase-js');
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { storage: AsyncStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
  });
}

const toUser = (u) =>
  u ? { id: u.id, email: u.email, name: u.user_metadata?.full_name || u.email?.split('@')[0] || '' } : null;

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let sub;
    (async () => {
      if (supabase) {
        const { data } = await supabase.auth.getSession();
        setUser(toUser(data.session?.user));
        sub = supabase.auth.onAuthStateChange((_event, session) => setUser(toUser(session?.user)));
      } else {
        const saved = await AsyncStorage.getItem(DEMO_KEY);
        setUser(saved ? JSON.parse(saved) : null);
      }
      setReady(true);
    })();
    return () => sub?.data?.subscription?.unsubscribe();
  }, []);

  const startDemoSession = useCallback(async (email, name) => {
    const clean = (email || 'guest@repify.local').trim().toLowerCase();
    const demo = { id: `demo-${clean}`, email: clean, name: name || clean.split('@')[0] };
    await AsyncStorage.setItem(DEMO_KEY, JSON.stringify(demo));
    setUser(demo);
  }, []);

  const signIn = useCallback(
    async (email, password) => {
      if (!supabase) return startDemoSession(email);
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(error.message);
    },
    [startDemoSession]
  );

  // Resolves to 'signed-in' or 'confirm-email'.
  const signUp = useCallback(
    async (email, password, name) => {
      if (!supabase) {
        await startDemoSession(email, name);
        return 'signed-in';
      }
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: name } },
      });
      if (error) throw new Error(error.message);
      return data.session ? 'signed-in' : 'confirm-email';
    },
    [startDemoSession]
  );

  const signOut = useCallback(async () => {
    if (supabase) await supabase.auth.signOut();
    else await AsyncStorage.removeItem(DEMO_KEY);
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, ready, signIn, signUp, signOut, guest: () => startDemoSession('guest@repify.local', 'Guest') }),
    [user, ready, signIn, signUp, signOut, startDemoSession]
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
