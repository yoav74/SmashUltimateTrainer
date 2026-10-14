import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type OAuthProvider = 'google' | 'discord';

export interface Profile {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export interface FeedbackRow {
  id: number;
  category: 'bug' | 'idea' | 'data' | 'other';
  message: string;
  page: string | null;
  status: 'new' | 'seen' | 'done' | 'wontfix';
  created_at: string;
}

interface AuthState {
  enabled: boolean;
  loading: boolean;
  session: Session | null;
  profile: Profile | null;
  /** Favorite fighter slugs; the first one is the primary main. */
  favorites: string[];
  signInWithProvider: (provider: OAuthProvider) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, displayName: string) => Promise<'signed-in' | 'check-email'>;
  sendPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<void>;
  setFavorites: (slugs: string[]) => Promise<void>;
  submitFeedback: (f: Pick<FeedbackRow, 'category' | 'message' | 'page'>) => Promise<void>;
  myFeedback: () => Promise<FeedbackRow[]>;
}

const AuthContext = createContext<AuthState | null>(null);

const MAX_FAVORITES = 8;

/** Where OAuth providers and email links send the user back to. */
const redirectTo = (path = '/account') => `${window.location.origin}${path}`;

/** Unwraps a Supabase response: throws its error, otherwise returns its data. */
function must<R extends { data?: unknown; error: { message: string } | null }>(res: R): R['data'] {
  if (res.error) throw new Error(res.error.message);
  return res.data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(!!supabase);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favorites, setFavs] = useState<string[]>([]);

  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);

  const userId = session?.user.id ?? null;

  // Load the profile and favorites whenever the signed-in user changes.
  useEffect(() => {
    if (!supabase || !userId) {
      setProfile(null);
      setFavs([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const [p, f] = await Promise.all([
        supabase.from('profiles').select('id, display_name, avatar_url').eq('id', userId).maybeSingle(),
        supabase.from('favorite_fighters').select('fighter_slug, position').eq('user_id', userId).order('position'),
      ]);
      if (cancelled) return;
      setProfile((p.data as Profile | null) ?? null);
      setFavs(((f.data as { fighter_slug: string }[] | null) ?? []).map((r) => r.fighter_slug));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signInWithProvider = useCallback(async (provider: OAuthProvider) => {
    must(await supabase!.auth.signInWithOAuth({ provider, options: { redirectTo: redirectTo() } }));
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    must(await supabase!.auth.signInWithPassword({ email, password }));
  }, []);

  const signUp = useCallback(async (email: string, password: string, displayName: string) => {
    const data = must(
      await supabase!.auth.signUp({ email, password, options: { data: { display_name: displayName }, emailRedirectTo: redirectTo() } }),
    );
    // With email confirmation on (the default), there's no session until the link is clicked.
    return data.session ? 'signed-in' : 'check-email';
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    must(await supabase!.auth.resetPasswordForEmail(email, { redirectTo: redirectTo('/account?reset=1') }));
  }, []);

  const updatePassword = useCallback(async (password: string) => {
    must(await supabase!.auth.updateUser({ password }));
  }, []);

  const signOut = useCallback(async () => {
    must(await supabase!.auth.signOut());
  }, []);

  const updateDisplayName = useCallback(
    async (name: string) => {
      const clean = name.trim().slice(0, 40);
      if (!clean || !userId) return;
      must(await supabase!.from('profiles').update({ display_name: clean }).eq('id', userId));
      setProfile((p) => (p ? { ...p, display_name: clean } : p));
    },
    [userId],
  );

  const setFavorites = useCallback(
    async (slugs: string[]) => {
      if (!userId) return;
      const next = [...new Set(slugs)].slice(0, MAX_FAVORITES);
      const prev = favorites;
      setFavs(next); // optimistic
      try {
        const removed = prev.filter((s) => !next.includes(s));
        if (removed.length) must(await supabase!.from('favorite_fighters').delete().eq('user_id', userId).in('fighter_slug', removed));
        if (next.length) {
          must(
            await supabase!
              .from('favorite_fighters')
              .upsert(next.map((fighter_slug, position) => ({ user_id: userId, fighter_slug, position }))),
          );
        }
      } catch (e) {
        setFavs(prev);
        throw e;
      }
    },
    [userId, favorites],
  );

  const submitFeedback = useCallback(async (f: Pick<FeedbackRow, 'category' | 'message' | 'page'>) => {
    must(await supabase!.from('feedback').insert({ category: f.category, message: f.message.trim(), page: f.page }));
  }, []);

  const myFeedback = useCallback(async () => {
    const data = must(
      await supabase!.from('feedback').select('id, category, message, page, status, created_at').order('created_at', { ascending: false }).limit(50),
    );
    return (data ?? []) as FeedbackRow[];
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      enabled: !!supabase,
      loading,
      session,
      profile,
      favorites,
      signInWithProvider,
      signInWithPassword,
      signUp,
      sendPasswordReset,
      updatePassword,
      signOut,
      updateDisplayName,
      setFavorites,
      submitFeedback,
      myFeedback,
    }),
    [loading, session, profile, favorites, signInWithProvider, signInWithPassword, signUp, sendPasswordReset, updatePassword, signOut, updateDisplayName, setFavorites, submitFeedback, myFeedback],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

export { MAX_FAVORITES };
