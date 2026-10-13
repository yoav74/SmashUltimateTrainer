import { useSyncExternalStore } from 'react';
import type { Character } from '@smash-trainer/core';
import { fighterOrder } from '@smash-trainer/data';

export type FighterSort = 'number' | 'name';

const KEY = 'smash-trainer:fighter-sort';
const listeners = new Set<() => void>();

function read(): FighterSort {
  try {
    return localStorage.getItem(KEY) === 'name' ? 'name' : 'number';
  } catch {
    return 'number';
  }
}

let current: FighterSort = read();

function set(sort: FighterSort) {
  current = sort;
  try {
    localStorage.setItem(KEY, sort);
  } catch {}
  listeners.forEach((l) => l());
}

/** Shared across every fighter list on the page, and remembered in this browser. Defaults to Smash ID order. */
export function useFighterSort(): [FighterSort, (s: FighterSort) => void] {
  const sort = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => current,
  );
  return [sort, set];
}

export function sortFighters(list: Character[], sort: FighterSort): Character[] {
  return [...list].sort(sort === 'name' ? (a, b) => a.name.localeCompare(b.name) : (a, b) => fighterOrder(a.slug) - fighterOrder(b.slug));
}
