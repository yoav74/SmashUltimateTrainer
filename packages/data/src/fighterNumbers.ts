// Official Smash Ultimate fighter numbers (character select order).
// Echo fighters share their base fighter's number with an "ε" suffix and sort right after it.
const NUMBERS: Record<string, string> = {
  mario: '01', donkey_kong: '02', link: '03', samus: '04', dark_samus: '04ε', yoshi: '05', kirby: '06', fox: '07',
  pikachu: '08', luigi: '09', ness: '10', captain_falcon: '11', jigglypuff: '12', peach: '13', daisy: '13ε',
  bowser: '14', ice_climbers: '15', sheik: '16', zelda: '17', dr_mario: '18', pichu: '19', falco: '20', marth: '21',
  lucina: '21ε', young_link: '22', ganondorf: '23', mewtwo: '24', roy: '25', chrom: '25ε', mr_game_and_watch: '26',
  meta_knight: '27', pit: '28', dark_pit: '28ε', zero_suit_samus: '29', wario: '30', snake: '31', ike: '32',
  pt_squirtle: '33', pt_ivysaur: '34', pt_charizard: '35', diddy_kong: '36', lucas: '37', sonic: '38',
  king_dedede: '39', olimar: '40', lucario: '41', rob: '42', toon_link: '43', wolf: '44', villager: '45',
  mega_man: '46', wii_fit_trainer: '47', rosalina_and_luma: '48', little_mac: '49', greninja: '50',
  mii_brawler: '51', mii_swordfighter: '52', mii_gunner: '53', palutena: '54', pac_man: '55', robin: '56',
  shulk: '57', bowser_jr: '58', duck_hunt: '59', ryu: '60', ken: '60ε', cloud: '61', corrin: '62', bayonetta: '63',
  inkling: '64', ridley: '65', simon: '66', richter: '66ε', king_k_rool: '67', isabelle: '68', incineroar: '69',
  piranha_plant: '70', joker: '71', hero: '72', banjo_and_kazooie: '73', terry: '74', byleth: '75', minmin: '76',
  steve: '77', sephiroth: '78', pyra: '79', mythra: '80', kazuya: '81', sora: '82',
};

/** Display label like "13ε", or null for an unknown slug. */
export const fighterNumber = (slug: string): string | null => NUMBERS[slug] ?? null;

/** Numeric sort key: 13 for Peach, 13.5 for Daisy. Unknown fighters go last. */
export function fighterOrder(slug: string): number {
  const n = NUMBERS[slug];
  if (!n) return Number.MAX_SAFE_INTEGER;
  return parseInt(n, 10) + (n.endsWith('ε') ? 0.5 : 0);
}
