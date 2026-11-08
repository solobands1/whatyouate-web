// Sugar Showdown's foods, and the rules for pairing them into questions.
//
// Sources and approach: grams of total sugar per serving, from USDA FoodData Central (SR Legacy / Foundation
// entries) for whole foods, multiplied out to the stated serving and rounded to the nearest gram; for packaged
// foods, typical North American nutrition labels for that kind of product (no brands named). Where products vary a
// lot (muffins, smoothies, BBQ sauce, lattes) the value is a middle-of-the-road one at the stated serving, and foods
// that vary too much to give one honest number (pasta sauce, baked beans, pizza, cake) were left out.
// "Sugar" is total sugar on the label: natural plus added. The serving is always shown next to the food.
//
// A question is only ever two foods that differ clearly: the higher one has at least 40% more sugar AND at least
// 3 g more (see clearlyDifferent). So small brand-to-brand differences can't flip an answer.
//
// Nothing here touches React or the DOM, so the headless check script can run this file as is.

export type SugarFood = { name: string; serving: string; sugar: number; code: string };

export const SUGAR_FOODS: SugarFood[] = [
  // ── drinks ──
  { name: "Cola", serving: "1 can (355 ml)", sugar: 39, code: "1f964" },
  { name: "Lemon-lime soda", serving: "1 can (355 ml)", sugar: 38, code: "1f964" },
  { name: "Orange soda", serving: "1 can (355 ml)", sugar: 44, code: "1f964" },
  { name: "Diet cola", serving: "1 can (355 ml)", sugar: 0, code: "1f964" },
  { name: "Orange juice", serving: "1 cup (240 ml)", sugar: 21, code: "1f9c3" },
  { name: "Apple juice", serving: "1 cup (240 ml)", sugar: 24, code: "1f9c3" },
  { name: "Grape juice", serving: "1 cup (240 ml)", sugar: 36, code: "1f9c3" },
  { name: "Cranberry juice drink", serving: "1 cup (240 ml)", sugar: 28, code: "1f9c3" },
  { name: "Lemonade", serving: "1 cup (240 ml)", sugar: 25, code: "1f34b" },
  { name: "Sports drink", serving: "1 bottle (591 ml)", sugar: 34, code: "1f964" },
  { name: "Energy drink", serving: "1 can (250 ml)", sugar: 27, code: "26a1" },
  { name: "Chocolate milk", serving: "1 cup (240 ml)", sugar: 24, code: "1f95b" },
  { name: "Milk (2%)", serving: "1 cup (240 ml)", sugar: 12, code: "1f95b" },
  { name: "Coconut water", serving: "1 cup (240 ml)", sugar: 6, code: "1f965" },
  { name: "Black coffee", serving: "1 cup (240 ml)", sugar: 0, code: "2615" },
  { name: "Fruit smoothie", serving: "1 cup (240 ml)", sugar: 26, code: "1f964" },
  { name: "Vanilla latte", serving: "1 medium (16 oz)", sugar: 33, code: "2615" },
  // ── breakfast ──
  { name: "Fruit yogurt", serving: "1 tub (170 g)", sugar: 18, code: "1f944" },
  { name: "Plain Greek yogurt", serving: "1 tub (170 g)", sugar: 5, code: "1f944" },
  { name: "Chewy granola bar", serving: "1 bar (24 g)", sugar: 7, code: "1f33e" },
  { name: "Corn flakes", serving: "1 cup (28 g)", sugar: 3, code: "1f963" },
  { name: "Frosted flakes", serving: "¾ cup (30 g)", sugar: 11, code: "1f963" },
  { name: "Raisin bran", serving: "1 cup (59 g)", sugar: 18, code: "1f963" },
  { name: "Maple instant oatmeal", serving: "1 packet (43 g)", sugar: 12, code: "1f963" },
  { name: "Plain oatmeal", serving: "1 cup cooked", sugar: 1, code: "1f963" },
  { name: "Maple syrup", serving: "2 tbsp", sugar: 24, code: "1f95e" },
  { name: "Honey", serving: "1 tbsp", sugar: 17, code: "1f36f" },
  { name: "Jam", serving: "1 tbsp", sugar: 10, code: "1fad9" },
  { name: "Peanut butter", serving: "2 tbsp", sugar: 3, code: "1f95c" },
  { name: "Chocolate hazelnut spread", serving: "2 tbsp (37 g)", sugar: 21, code: "1f330" },
  { name: "White bread", serving: "1 slice", sugar: 2, code: "1f35e" },
  { name: "Plain bagel", serving: "1 medium", sugar: 5, code: "1f96f" },
  { name: "Croissant", serving: "1 medium", sugar: 6, code: "1f950" },
  { name: "Blueberry muffin", serving: "1 medium (113 g)", sugar: 25, code: "1f9c1" },
  { name: "Glazed donut", serving: "1 medium", sugar: 11, code: "1f369" },
  { name: "Frosted toaster pastry", serving: "1 pastry", sugar: 16, code: "1f9c7" },
  { name: "Egg", serving: "1 large", sugar: 0, code: "1f95a" },
  // ── fruit (USDA, fresh unless it says so) ──
  { name: "Banana", serving: "1 medium", sugar: 14, code: "1f34c" },
  { name: "Apple", serving: "1 medium", sugar: 19, code: "1f34e" },
  { name: "Orange", serving: "1 medium", sugar: 12, code: "1f34a" },
  { name: "Grapes", serving: "1 cup", sugar: 23, code: "1f347" },
  { name: "Strawberries", serving: "1 cup", sugar: 7, code: "1f353" },
  { name: "Blueberries", serving: "1 cup", sugar: 15, code: "1fad0" },
  { name: "Watermelon", serving: "1 cup, diced", sugar: 9, code: "1f349" },
  { name: "Pineapple", serving: "1 cup, chunks", sugar: 16, code: "1f34d" },
  { name: "Mango", serving: "1 cup, pieces", sugar: 23, code: "1f96d" },
  { name: "Pear", serving: "1 medium", sugar: 17, code: "1f350" },
  { name: "Cherries", serving: "1 cup", sugar: 18, code: "1f352" },
  { name: "Kiwi", serving: "1 medium", sugar: 6, code: "1f95d" },
  { name: "Peach", serving: "1 medium", sugar: 13, code: "1f351" },
  { name: "Raisins", serving: "1 small box (43 g)", sugar: 25, code: "1f347" },
  { name: "Dates", serving: "2 large (48 g)", sugar: 32, code: "1f334" },
  { name: "Dried cranberries", serving: "¼ cup (40 g)", sugar: 29, code: "1f352" },
  { name: "Grapefruit", serving: "½ medium", sugar: 8, code: "1f34a" },
  { name: "Cantaloupe", serving: "1 cup, cubes", sugar: 13, code: "1f348" },
  { name: "Clementine", serving: "1 fruit", sugar: 7, code: "1f34a" },
  { name: "Unsweetened applesauce", serving: "½ cup", sugar: 11, code: "1f34e" },
  { name: "Avocado", serving: "½ fruit", sugar: 1, code: "1f951" },
  // ── vegetables and meals ──
  { name: "Carrot", serving: "1 medium", sugar: 3, code: "1f955" },
  { name: "Broccoli", serving: "1 cup, chopped", sugar: 2, code: "1f966" },
  { name: "Sweet potato", serving: "1 medium, baked", sugar: 7, code: "1f360" },
  { name: "Corn on the cob", serving: "1 medium ear", sugar: 5, code: "1f33d" },
  { name: "Tomato", serving: "1 medium", sugar: 3, code: "1f345" },
  { name: "Red pepper", serving: "1 medium", sugar: 5, code: "1fad1" },
  { name: "Cucumber", serving: "1 cup, sliced", sugar: 2, code: "1f952" },
  { name: "Baked potato", serving: "1 medium", sugar: 2, code: "1f954" },
  { name: "Onion", serving: "1 medium", sugar: 5, code: "1f9c5" },
  { name: "Spinach", serving: "1 cup, raw", sugar: 0, code: "1f96c" },
  { name: "Lentils", serving: "1 cup cooked", sugar: 4, code: "1fad8" },
  { name: "Pasta", serving: "1 cup cooked", sugar: 1, code: "1f35d" },
  { name: "White rice", serving: "1 cup cooked", sugar: 0, code: "1f35a" },
  { name: "Tomato soup", serving: "1 cup (canned)", sugar: 11, code: "1f96b" },
  { name: "Roast chicken", serving: "1 piece", sugar: 0, code: "1f357" },
  // ── snacks and sweets ──
  { name: "Milk chocolate bar", serving: "1 bar (43 g)", sugar: 22, code: "1f36b" },
  { name: "Dark chocolate (70%+)", serving: "1 oz (28 g)", sugar: 7, code: "1f36b" },
  { name: "Peanut caramel candy bar", serving: "1 bar (53 g)", sugar: 27, code: "1f36b" },
  { name: "Gummy bears", serving: "1 small bag (50 g)", sugar: 23, code: "1f36c" },
  { name: "Fruit snacks", serving: "1 pouch (25 g)", sugar: 11, code: "1f36c" },
  { name: "Chocolate chip cookies", serving: "3 small (33 g)", sugar: 11, code: "1f36a" },
  { name: "Sandwich cookies", serving: "3 cookies (34 g)", sugar: 14, code: "1f36a" },
  { name: "Vanilla ice cream", serving: "½ cup", sugar: 14, code: "1f368" },
  { name: "Chocolate syrup", serving: "2 tbsp", sugar: 20, code: "1f36b" },
  { name: "Potato chips", serving: "1 small bag (28 g)", sugar: 0, code: "1f954" },
  { name: "Pretzels", serving: "1 oz (28 g)", sugar: 1, code: "1f968" },
  { name: "Plain popcorn", serving: "3 cups", sugar: 0, code: "1f37f" },
  { name: "Peanuts", serving: "1 oz (28 g)", sugar: 1, code: "1f95c" },
  { name: "Cheddar cheese", serving: "1 oz (28 g)", sugar: 0, code: "1f9c0" },
  // ── sauces ──
  { name: "Ketchup", serving: "1 tbsp", sugar: 4, code: "1f345" },
  { name: "BBQ sauce", serving: "2 tbsp", sugar: 13, code: "1f356" },
  { name: "White sugar", serving: "1 tsp", sugar: 4, code: "1f944" },
];

export const MIN_RATIO = 1.4, MIN_GAP = 3;
/** True when one food has clearly more sugar: at least 40% more and at least 3 g more. */
export function clearlyDifferent(a: number, b: number) {
  const hi = Math.max(a, b), lo = Math.min(a, b);
  return hi - lo >= MIN_GAP && hi >= lo * MIN_RATIO;
}

/** A question: two foods (indexes into SUGAR_FOODS) shown in this order. */
export type Question = { a: number; b: number };
/** 0 when the first food has more sugar, 1 when the second does. */
export const answerOf = (q: Question) => (SUGAR_FOODS[q.a].sugar > SUGAR_FOODS[q.b].sugar ? 0 : 1);

// Difficulty by how far apart the two are: easy pairs are 2.5x or more apart (or one has none), hard ones 1.4x to 2.2x.
type Band = "easy" | "medium" | "hard";
const ratioOf = (i: number, j: number) => {
  const x = SUGAR_FOODS[i].sugar, y = SUGAR_FOODS[j].sugar, lo = Math.min(x, y);
  return lo === 0 ? Infinity : Math.max(x, y) / lo;
};
const inBand = (r: number, band: Band | null) => band === null ? true : band === "easy" ? r >= 2.5 : band === "medium" ? r >= 1.6 && r < 3.5 : r < 2.2;
const PARTNERS: number[][] = SUGAR_FOODS.map((f, i) => SUGAR_FOODS.flatMap((g, j) => (j !== i && clearlyDifferent(f.sugar, g.sugar) ? [j] : [])));

/** One question. Always draws exactly 3 numbers from rnd, so a seed gives the same questions everywhere.
 *  Foods in `avoid` are skipped (no repeats in a round); the band loosens if nothing fits. */
export function pickQuestion(rnd: () => number, band: Band, avoid: Set<number>): Question {
  const r1 = rnd(), r2 = rnd(), r3 = rnd();
  for (const [b, skip] of [[band, true], [null, true], [null, false]] as [Band | null, boolean][]) {
    const partners = (i: number) => PARTNERS[i].filter(j => !(skip && avoid.has(j)) && inBand(ratioOf(i, j), b));
    const pool = SUGAR_FOODS.flatMap((_, i) => (!(skip && avoid.has(i)) && partners(i).length ? [i] : []));
    if (!pool.length) continue;
    const a = pool[Math.floor(r1 * pool.length)], ps = partners(a), c = ps[Math.floor(r2 * ps.length)];
    return r3 < 0.5 ? { a, b: c } : { a: c, b: a };
  }
  return { a: 0, b: 3 };   // unreachable with this list
}

/** Question n's difficulty (counting from 0): an easy start, then harder. After 10, mostly hard with some mixed in. */
export function bandFor(n: number, rnd: () => number): Band {
  if (n < 3) return "easy";
  if (n < 7) return "medium";
  if (n < 10) return "hard";
  const r = rnd(); return r < 0.15 ? "easy" : r < 0.5 ? "medium" : "hard";
}

/** A fixed set of questions with no food repeated: Today's 10, and every duel. */
export function buildRound(rnd: () => number, count = ROUND) {
  const out: Question[] = [], used = new Set<number>();
  for (let n = 0; n < count; n++) { const q = pickQuestion(rnd, bandFor(n, rnd), used); used.add(q.a); used.add(q.b); out.push(q); }
  return out;
}

/** Free Play's next question; `recent` holds the last foods shown so they don't come back too soon. */
export function nextFree(rnd: () => number, n: number, recent: number[]) {
  return pickQuestion(rnd, bandFor(n, rnd), new Set(recent));
}

// ── rules shared with the check script ──
export const ROUND = 10;               // questions in Today and in a duel
export const TODAY_MS = 10000;         // time per question in Today
export const DUEL_MS = 8000;           // time per question in a live duel
export const COUCH_MS = 10000;         // same-phone duel: a little longer, half of you are reading upside down
export const freeMs = (n: number) => Math.max(4000, 9000 - 200 * n);   // Free Play: 9s, a little less each question, never under 4s
export const HEARTS = 3;
/** A right answer is 500, plus up to 500 more the faster it was. A wrong one or running out of time is 0. */
export const points = (right: boolean, ms: number, limit: number) => (right ? 500 + Math.round(500 * Math.max(0, 1 - ms / limit)) : 0);
