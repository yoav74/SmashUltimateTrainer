import { characters } from '../src/data/characters.ts';
import { punishOptions } from '../src/lib/punish.ts';
let ok = 0; const bad: string[] = [];
for (const c of characters) {
  if (!c.oos.length) continue;
  const mine = punishOptions(c)[0]?.oosFrame;
  const theirs = Math.min(...c.oos.map(o => o.frame));
  if (mine === theirs) ok++; else bad.push(`${c.name}: mine F${mine} (${punishOptions(c)[0]?.move.name}) vs UFD F${theirs} (${c.oos[0].options})`);
}
console.log(`fastest OoS matches UFD for ${ok} characters; ${bad.length} differ:`); console.log(bad.join('\n'));
