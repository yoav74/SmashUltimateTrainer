import type { Reach } from './reach';

export type MoveCategory =
  | 'groundattacks'
  | 'aerialattacks'
  | 'specialattacks'
  | 'grabs'
  | 'dodges'
  | string;

export interface ShieldAdvantage {
  value: number;
  hitbox: string | null;
}

export interface Move {
  name: string;
  category: MoveCategory;
  startup: number | null;
  totalFrames: number | null;
  landingLag: number | null;
  endlag: number | null;
  damage: number[];
  shieldAdvantage: ShieldAdvantage[];
  raw: {
    startup: string | null;
    totalFrames: string | null;
    landingLag: string | null;
    activeFrames: string | null;
    damage: string | null;
    shieldStun: string | null;
    advantage: string | null;
  };
  notes: string | null;
  hitboxGifs: string[];
  /** Forward reach from SmashWiki hitbox data, when the move maps to a SmashWiki page with hitboxes. */
  reach?: Reach | null;
}

export interface OosEntry {
  options: string;
  frame: number;
}

export interface Character {
  slug: string;
  name: string;
  moves: Move[];
  oos: OosEntry[];
  stats: Record<string, string>;
  /** Movement numbers the range model needs (traction from SmashWiki, the rest from UFD stats). */
  physics?: Physics;
}

export interface Physics {
  traction: number;
  /** Size proxy: standing grab reach, clamped (see ESTIMATE.sizeClamp). */
  size: number;
  airSpeed: number;
  airAccel: number;
  initialDash: number;
}

export interface FrameData {
  source: string;
  scrapedAt: string;
  characters: Character[];
}
