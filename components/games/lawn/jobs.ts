// Pat's Big Weekend: the story jobs, the tractor upgrades and the saved progress (this browser only).

export type Light = "day" | "morning" | "dusk" | "storm" | "golden";
export type Twist = "bonfire" | "storm" | "guests" | "apples" | "stripes" | "cat" | "finale" | "free";
export type Job = {
  id: number;
  title: string;
  intro: string[];          // one or two friendly lines on the intro card
  goal: string;             // what to do, in a few words
  zones: string[] | null;   // which zones of the yard count (null = the whole lawn)
  pace: number;             // time limit = the area at base equipment / this many square metres a second, plus 20 s
  limit?: number;           // or a set time limit in seconds (tuned by driving each job with the autopilot)
  par?: number;             // finish within this for the second star
  light: Light;
  twist: Twist;
  star3: string;            // the third star's goal
  tip?: string;             // how the twist works, shown on the intro card
  cash: number;             // pay for finishing (stars add more)
  deckBonus?: number;       // extra half-width on this job's cut (a borrowed deck), metres
  trim?: number;            // grass this close to a fence, wall or trunk (metres) is already trimmed by the boys
};

export const JOBS: Job[] = [
  { id: 0, title: "Before The Bonfire", intro: ["Friends are coming over for a fire tonight.", "Get the yard round the house mowed before the sun goes down."],
    goal: "Mow round the house and the fire pit", zones: ["frontHouse"], pace: 7.5, limit: 190, par: 140, light: "dusk", twist: "bonfire", star3: "No Big Bumps", cash: 40, tip: "A big bump is hitting a fence, wall or tree at speed. Ease off near them." },
  { id: 1, title: "Storm's Rolling In", intro: ["Dark clouds over the field. Rain's on the way.", "Puddles from last night will slow you down."],
    goal: "Mow the top of the big field before the rain", zones: ["northField"], pace: 8.5, limit: 200, par: 145, light: "storm", twist: "storm", star3: "Stay Out Of The Puddles", cash: 50, tip: "Puddles slow you down. Steer round them: the grass under the water doesn't count. Under 4 seconds in puddles earns the star." },
  { id: 2, title: "Horseshoe Tournament", intro: ["The neighbours are coming for horseshoes.", "Mow the pits and the walk to the barn first, before the guests arrive."],
    goal: "Mow from the horseshoe pits to the barn", zones: ["barnSide"], pace: 7.5, limit: 160, par: 118, light: "day", twist: "guests", star3: "Pits And Path Done In Time", cash: 60, tip: "The yellow patches are the pits and the path. Mow them first: the guests arrive just past halfway." },
  { id: 3, title: "Apple Season", intro: ["The apple trees are dropping fruit.", "Ease off over the apples and the deck scoops them up. Rush over them and they squish!"],
    goal: "Mow the orchard and pick up apples", zones: ["orchard"], pace: 6.5, limit: 130, par: 95, light: "day", twist: "apples", star3: "Pick Up 10 Apples", cash: 60, tip: "Drive slowly over an apple (push the stick halfway) to pick it up." },
  { id: 4, title: "Sunday Stripes", intro: ["Sunday morning. Time to show off.", "Long, straight, side-by-side stripes score best."],
    goal: "Mow neat stripes in the field", zones: ["stripes"], pace: 6.5, limit: 95, par: 66, light: "morning", twist: "stripes", star3: "Stripe Score 75%", cash: 70, tip: "Stripe Score is the grass you cut driving straight. Turning and going back over cut grass bring it down. Mow a lap round the edge first, then turn on the cut border." },
  { id: 5, title: "The Cat's Day Out", intro: ["The cat wants to be outside all day.", "She'll keep wandering into the yard. Steer round her!"],
    goal: "Mow the east lawn", zones: ["eastLawn"], pace: 8, limit: 240, par: 180, light: "day", twist: "cat", star3: "No Cat Stops", cash: 70, tip: "Pat stops if the cat is close in front of him. Give her room and steer wide." },
  { id: 6, title: "The Whole Property", intro: ["The big one. Every blade on the property.", "The boys trimmed round the trees and fences this morning, and Pat borrowed the wide deck. Then the whole gang meets at the fire pit."],
    goal: "Mow the whole lawn", zones: null, pace: 9.5, limit: 450, par: 360, light: "golden", twist: "finale", star3: "No Cat Stops", cash: 120, deckBonus: 0.5, trim: 1.5, tip: "The borrowed deck cuts a 5 m strip. Long runs end to end are quickest." },
];
export const FREE_JOB: Job = { id: -1, title: "Free Mow", intro: ["The whole lawn, no clock."], goal: "Mow the whole lawn", zones: null, pace: 9.5, light: "day", twist: "free", star3: "", cash: 25 };

export type Upgrades = { deck: number; gear: number; lights: boolean; bagger: boolean; paint: string };
export const DECKS = [2.0, 2.5, 3.0];        // half the cut width, metres
export const GEARS = [6.5, 7.4, 8.3];        // top speed, metres a second
export const PAINTS: Record<string, { name: string; body: string; hood: string; trim: string; cost: number }> = {
  orange: { name: "Classic Orange", body: "#f26b1d", hood: "#f47c20", trim: "#b04e12", cost: 0 },
  red: { name: "Cherry Red", body: "#d8322a", hood: "#e8443a", trim: "#8e1f19", cost: 40 },
  yellow: { name: "Sunshine Yellow", body: "#f2b81d", hood: "#f8c935", trim: "#a87c0c", cost: 40 },
};
export type ShopItem = { id: string; name: string; blurb: string; cost: number; owned: boolean; level?: string };
export function shopItems(s: Save): ShopItem[] {
  const u = s.up, items: ShopItem[] = [];
  items.push(u.deck < 2 ? { id: "deck", name: "Wider Deck", blurb: `Cuts a ${(DECKS[u.deck + 1] * 2).toFixed(1)} m strip instead of ${(DECKS[u.deck] * 2).toFixed(1)} m.`, cost: [80, 150][u.deck], owned: false, level: `Level ${u.deck + 1} Of 2` }
    : { id: "deck", name: "Wider Deck", blurb: "Biggest deck there is.", cost: 0, owned: true, level: "Maxed" });
  items.push(u.gear < 2 ? { id: "gear", name: "Faster Gear", blurb: `Top speed up from ${Math.round(GEARS[u.gear] * 3.6)} to ${Math.round(GEARS[u.gear + 1] * 3.6)} km/h.`, cost: [60, 120][u.gear], owned: false, level: `Level ${u.gear + 1} Of 2` }
    : { id: "gear", name: "Faster Gear", blurb: "Top gear.", cost: 0, owned: true, level: "Maxed" });
  items.push({ id: "lights", name: "Headlights", blurb: "See where you're going when it gets dark.", cost: 50, owned: u.lights });
  items.push({ id: "bagger", name: "Grass Bagger", blurb: "Bags the clippings: 25% more pay on every job.", cost: 90, owned: u.bagger });
  for (const [k, p] of Object.entries(PAINTS)) if (k !== "orange") items.push({ id: `paint-${k}`, name: `${p.name} Paint`, blurb: "A fresh coat for the tractor.", cost: p.cost, owned: s.paints.includes(k) });
  return items;
}

export type Save = { v: 1; cash: number; stars: number[]; best: (number | null)[]; up: Upgrades; paints: string[]; free: { secs: number | null; score: number }; muted: boolean; tutorial: boolean };
const KEY = "pats-lawnmower-save";
export const newSave = (): Save => ({ v: 1, cash: 0, stars: JOBS.map(() => 0), best: JOBS.map(() => null), up: { deck: 0, gear: 0, lights: false, bagger: false, paint: "orange" }, paints: ["orange"], free: { secs: null, score: 0 }, muted: true, tutorial: false });
export function loadSave(): Save {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && v.v === 1) { const d = newSave(); return { ...d, ...v, up: { ...d.up, ...v.up }, free: { ...d.free, ...v.free }, stars: JOBS.map((_, i) => v.stars?.[i] ?? 0), best: JOBS.map((_, i) => v.best?.[i] ?? null) }; }
  } catch {}
  return newSave();
}
export function writeSave(s: Save) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
/** Jobs unlock in order: the next one opens once the one before has at least one star. */
export const unlockedUpTo = (s: Save) => { let n = 0; while (n < JOBS.length - 1 && s.stars[n] > 0) n++; return n; };

export type Outcome = {
  job: number; done: boolean; secs: number; limit: number; par: number; pct: number;
  stars: [boolean, boolean, boolean]; meows: number; bumps: number; apples: number; applesTotal: number; quality: number; wet: number; priorityOk: boolean;
};
/** Pay for a finished job: the base (half on a replay) plus 15 a star for stars not earned before, plus the bagger bonus. */
export function payFor(job: Job, o: Outcome, s: Save) {
  if (!o.done) return { base: 0, starBonus: 0, extra: 0, bagger: 0, total: 0 };
  const had = s.stars[job.id] ?? 0, got = o.stars.filter(Boolean).length;
  const base = had > 0 ? Math.round(job.cash / 2) : job.cash;
  const starBonus = Math.max(0, got - had) * 15;
  const extra = job.twist === "apples" ? o.apples * 2 : 0;
  const sub = base + starBonus + extra, bagger = s.up.bagger ? Math.round(sub * 0.25) : 0;
  return { base, starBonus, extra, bagger, total: sub + bagger };
}
