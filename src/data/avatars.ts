import { createAvatar } from "@dicebear/core";
import { personas } from "@dicebear/collection";
import type { SeedCreator } from "./india";

const cache = new Map<string, string>();

const SKIN = ["e5a07e", "d78774", "b16a5b", "92594b"] as const;
const HAIR_COLOR = ["362c47", "362c47", "6c4545"] as const;
const WOMEN_HAIR = ["long", "extraLong", "straightBun", "curlyBun", "bobCut", "curly", "bunUndercut"] as const;
const MEN_HAIR = ["shortCombover", "fade", "buzzcut", "shortComboverChops", "curly", "balding", "sideShave"] as const;
const BACKGROUNDS = ["dff6d7", "e9e1ff", "ffeadc", "e0efff", "fdf0c4"] as const;

function hash(s: string) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Illustrated portrait for a demo creator: stable per creator, no real person's photo. */
export function creatorAvatar(c: Pick<SeedCreator, "id" | "gender">): string {
  const hit = cache.get(c.id);
  if (hit) return hit;
  const h = hash(c.id);
  const f = c.gender === "f";
  const uri = createAvatar(personas, {
    seed: c.id,
    skinColor: [SKIN[h % SKIN.length]],
    hairColor: [HAIR_COLOR[(h >> 3) % HAIR_COLOR.length]],
    hair: [f ? WOMEN_HAIR[(h >> 5) % WOMEN_HAIR.length] : MEN_HAIR[(h >> 5) % MEN_HAIR.length]],
    facialHair: f ? [] : ["beardMustache", "goatee", "shadow", "pyramid"].slice((h >> 7) % 4, ((h >> 7) % 4) + 1) as ("beardMustache" | "goatee" | "shadow" | "pyramid")[],
    facialHairProbability: f ? 0 : 55,
    eyes: [(["open", "happy", "glasses", "open"] as const)[(h >> 9) % 4]],
    mouth: [(["smile", "bigSmile", "lips", "smirk"] as const)[(h >> 11) % (f ? 4 : 2)]],
    backgroundColor: [BACKGROUNDS[(h >> 13) % BACKGROUNDS.length]],
  }).toDataUri();
  cache.set(c.id, uri);
  return uri;
}
