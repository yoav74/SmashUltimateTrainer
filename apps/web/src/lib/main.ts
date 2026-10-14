import { useEffect, useState } from 'react';
import { characterBySlug } from '@smash-trainer/data';
import { useAuth } from './auth';

// "Your main": the signed-in user's primary favorite, or (signed out) a choice saved in this browser.
const MAIN_KEY = 'smash-trainer:main';

export function readLocalMain(): string | null {
  try {
    const s = localStorage.getItem(MAIN_KEY);
    return s && characterBySlug.has(s) ? s : null;
  } catch {
    return null;
  }
}

function writeLocalMain(slug: string | null) {
  try {
    if (slug) localStorage.setItem(MAIN_KEY, slug);
    else localStorage.removeItem(MAIN_KEY);
  } catch {}
}

/** [primary main, choose a primary main, all mains]. */
export function useMain(): [string | null, (slug: string) => Promise<void>, string[]] {
  const auth = useAuth();
  const [local, setLocal] = useState<string | null>(readLocalMain);
  const signedIn = !!auth.session && !!auth.profile;

  // First sign-in: carry over a main picked before signing in.
  useEffect(() => {
    if (signedIn && auth.favorites.length === 0 && local) auth.setFavorites([local]).catch(() => {});
    // Only on the sign-in transition, not on every favorites change.
  }, [signedIn]);

  if (signedIn) {
    const choose = (slug: string) => auth.setFavorites([slug, ...auth.favorites.filter((s) => s !== slug)]);
    return [auth.favorites[0] ?? null, choose, auth.favorites];
  }
  const choose = async (slug: string) => {
    setLocal(slug);
    writeLocalMain(slug);
  };
  return [local, choose, local ? [local] : []];
}
