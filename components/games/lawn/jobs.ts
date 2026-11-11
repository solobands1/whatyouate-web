// Pat's Big Weekend: the story jobs, the tractor upgrades and the saved progress (this browser only).

export type Light = "day" | "morning" | "dusk" | "storm" | "golden";
export type Twist = "bonfire" | "storm" | "guests" | "apples" | "stripes" | "cat" | "finale" | "trailer" | "away" | "unload" | "free" | "sticks" | "leaves" | "tire" | "ride"
  | "plow" | "wood" | "xmas" | "tidy"   // Chapter 4: Pat's Winter
  | "paint" | "games" | "nets" | "party";   // Chapter 6: The Annual Party (./summer)
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
  map?: "home" | "community";   // where the job is (home unless it says)
  chapter?: string;         // a heading in the job list above this job
  star2?: string;           // the second star, when it isn't "finish under par" (then it's "no big bumps")
  stripeZones?: string[];   // the stripe score only counts grass in these zones
  stripeGoal?: number;      // the stripe score for the third star
  fall?: number;            // how far the leaves have turned (0 summer .. 1 full fall colour)
  endTitle?: string;        // the end card's heading when this job closes a chapter
  endLine?: (stars: number, of: number) => string;   // and its line about the chapter's stars
  chapterFrom?: number;     // the first job of this chapter (for the end card's star count)
  summer?: boolean;         // Chapter 6: high summer (deep green lawn, small green apples on the trees)
};
/** Jobs with no mowing: drive the tractor somewhere and park it. */
export const isPark = (j: Job) => j.twist === "trailer" || j.twist === "unload";
/** Jobs where the deck isn't cutting: parking, picking up sticks, the drive to town, Linda's ride. */
export const noMowing = (j: Job) => isPark(j) || j.twist === "sticks" || j.twist === "tire" || j.twist === "ride"
  || j.twist === "plow" || j.twist === "wood" || j.twist === "xmas" || j.twist === "tidy"   // (Chapter 4: winter, no mowing)
  || j.twist === "paint" || j.twist === "games" || j.twist === "nets" || j.twist === "party";   // Chapter 6

export const JOBS: Job[] = [
  { id: 0, title: "Before The Bonfire", intro: ["Friends are coming over for a fire tonight.", "Get the yard round the house mowed before the sun goes down."],
    goal: "Mow round the house and the fire pit", zones: ["frontHouse"], pace: 7.5, limit: 230, par: 170, light: "dusk", twist: "bonfire", star3: "No Big Bumps", cash: 40, tip: "A big bump is hitting a fence, wall or tree at speed. Ease off near them." },
  { id: 1, title: "Storm's Rolling In", intro: ["Dark clouds over the field. Rain's on the way.", "Puddles from last night will slow you down."],
    goal: "Mow the top of the big field before the rain", zones: ["northField"], pace: 8.5, limit: 230, par: 175, light: "storm", twist: "storm", star3: "Stay Out Of The Puddles", cash: 50, tip: "Puddles slow you down. Steer round them: the grass under the water doesn't count. Under 4 seconds in puddles earns the star." },
  { id: 2, title: "Horseshoe Tournament", intro: ["The neighbours are coming for horseshoes.", "Mow the pits and the walk to the barn first, before the guests arrive."],
    goal: "Mow from the horseshoe pits to the barn", zones: ["barnSide"], pace: 7.5, limit: 240, par: 180, light: "day", twist: "guests", star3: "Pits And Path Done In Time", cash: 60, tip: "The yellow patches are the pits and the path. Mow them first: the guests arrive just past halfway." },
  { id: 3, title: "Apple Season", intro: ["The apple trees are dropping fruit.", "Ease off over the apples and the deck scoops them up. Rush over them and they squish!"],
    goal: "Mow the orchard and pick up apples", zones: ["orchard"], pace: 6.5, limit: 160, par: 125, light: "day", twist: "apples", star3: "Pick Up 10 Apples", cash: 60, tip: "Drive slowly over an apple (push the stick halfway) to pick it up." },
  { id: 4, title: "Sunday Stripes", intro: ["Sunday morning. Time to show off.", "Long, straight, side-by-side stripes score best."],
    goal: "Mow neat stripes in the field", zones: ["stripes"], pace: 6.5, limit: 95, par: 66, light: "morning", twist: "stripes", star3: "Stripe Score 75%", cash: 70, tip: "Stripe Score is the grass you cut driving straight. Turning and going back over cut grass bring it down. Mow a lap round the edge first, then turn on the cut border." },
  { id: 5, title: "The Cat's Day Out", intro: ["The cat wants to be outside all day.", "She'll keep wandering into the yard. Steer round her!"],
    goal: "Mow the east lawn", zones: ["eastLawn"], pace: 8, limit: 330, par: 250, light: "day", twist: "cat", star3: "No Cat Stops", cash: 70, tip: "Pat stops if the cat is close in front of him. Give her room and steer wide." },
  { id: 6, title: "The Whole Property", intro: ["The big one. Every blade on the property.", "The boys trimmed round the trees and fences this morning, and Pat borrowed the wide deck. Then the whole gang meets at the fire pit."],
    goal: "Mow the whole lawn", zones: null, pace: 9.5, limit: 450, par: 360, light: "golden", twist: "finale", star3: "No Cat Stops", cash: 120, deckBonus: 0.8, trim: 1.5, tip: "The borrowed deck cuts a wider strip. Long runs end to end are quickest." },
  { id: 7, chapter: "Chapter 2: The Away Game", title: "Load The Trailer", intro: ["The community centre needs its ball diamonds mowed before tonight's game.", "Pat's truck and trailer are in the driveway. Drive up the ramps and park in the box."],
    goal: "Park the tractor on the trailer", zones: null, pace: 1, limit: 60, par: 25, light: "morning", twist: "trailer", star3: "No Bumps", cash: 50, tip: "The deck folds up for the trip. Line up straight behind the ramps, creep up and stop inside the yellow box. Touching the ramp sides or the truck costs the star." },
  { id: 8, map: "community", title: "Malahide Community Place", intro: ["The ball game starts this evening, and the ball club has trimmed along the fences.", "Mow both outfields and the grass round the hall and the playground. The dirt, the paths and the parking don't need it."],
    goal: "Mow the outfields and round the hall", zones: ["outfieldE", "outfieldW", "hallLawn"], pace: 8, limit: 330, par: 290, light: "day", twist: "away", star2: "No Big Bumps", star3: "Outfield Stripes 60%", stripeZones: ["outfieldW", "outfieldE"], stripeGoal: 0.6, trim: 1.3, cash: 130, tip: "Go in through the gates in the fences. Two kids are playing catch: Pat waits if they're close. Long straight runs in the outfields make the best stripes." },
  { id: 9, title: "Back Home", intro: ["Home again, just as the sun goes down.", "The tractor's off the trailer. Drive it down to the barn and park it inside for the night."],
    goal: "Park the tractor in the barn", zones: null, pace: 1, limit: 75, par: 40, light: "golden", twist: "unload", star3: "No Bumps", cash: 60, tip: "The barn doors face the house, by the little concrete pad. Ease in through the doors and stop inside the yellow box.",
    endTitle: "Weekend Done!", chapterFrom: 0, endLine: (n, of) => `You finished Pat's Big Weekend with ${n} of ${of} stars!` },
  { id: 10, chapter: "Chapter 3: Pat's Fall Chores", title: "After The Wind", intro: ["It blew hard all night. There are sticks all over the yard.", "Pull up beside each one and tap it. Pat hops off, grabs it and tosses it in the cart."],
    goal: "Pick up every stick", zones: null, pace: 1, limit: 200, par: 150, light: "morning", twist: "sticks", star3: "No Cat Stops", cash: 70, fall: 0.55,
    tip: "Stop close to a stick, then tap it. If it's too far for Pat to walk, pull in closer. The little map shows where they all are." },
  { id: 11, title: "Leaves Everywhere", intro: ["The maples let go all at once. Leaves everywhere round the house.", "Drive over them with the deck down and the tractor sucks them right up."],
    goal: "Pick up the leaves round the house", zones: ["frontHouse"], pace: 7.5, limit: 235, par: 180, light: "day", twist: "leaves", star3: "No Big Bumps", cash: 80, fall: 1,
    tip: "Long straight runs pick up the most. A big bump is hitting a fence, wall or tree at speed." },
  { id: 12, title: "The Flat Tire", intro: ["The tractor's got a flat, and the Rona in Springfield has the right tire.", "Take Pat's blue '67 into town, park in the Rona lot, then bring it home and park by the barn."],
    goal: "Get the tire and come home", zones: null, pace: 1, limit: 325, par: 250, light: "day", twist: "tire", star3: "No Bumps", cash: 90, fall: 0.85,
    tip: "Stay on the road. Going off it slows the '67 right down and counts as a bump. Point back the way you came to turn round." },
  { id: 13, title: "Linda's Ride", intro: ["Linda wants to go for a ride round the property before supper.", "She's in the little trailer behind the tractor. Two laps round the edge, and go easy on her."],
    goal: "Two laps round the property", zones: null, pace: 1, limit: 170, par: 125, light: "golden", twist: "ride", star3: "Linda Stays Happy", cash: 100, fall: 0.85,
    tip: "Drive through the flags in order. Cutting across the field doesn't count. Bumping into anything upsets Linda.",
    endTitle: "Chores Done!", chapterFrom: 10, endLine: (n, of) => `You finished Pat's Fall Chores with ${n} of ${of} stars! Linda says it was the best ride of the fall.` },
  // ── Chapter 4: Pat's Winter (./winter) ──
  { id: 14, chapter: "Chapter 4: Pat's Winter", title: "Plow The Driveway", intro: ["It snowed all night. The lane, the parking spot and the driveway are buried.", "Pat's put the plow blade on the tractor. Plow from the barn up to the road, then hop off and shovel the walk and round Linda's car."],
    goal: "Plow the driveway, then shovel", zones: null, pace: 1, limit: 85, par: 65, light: "morning", twist: "plow", star3: "No Big Bumps", cash: 110,
    tip: "The blade clears the gravel. Stop and tap Pat to hop off with the shovel, and tap the tractor to climb back on. A big bump is hitting the car or a tree at speed." },
  { id: 15, title: "Firewood", intro: ["It's going to be a cold one tonight, and the wood stove needs plenty.", "Split logs at the chopping block by the woodshed, then haul them up to the back door in the cart. Three loads fills the woodbox."],
    goal: "Split and stack three loads", zones: null, pace: 1, limit: 145, par: 110, light: "day", twist: "wood", star3: "Two Misses Or Fewer", cash: 110,
    tip: "Stop beside the chopping block and tap it. Tap the map when the marker is in the green to split a log. Then drive to the back steps and tap them to unload." },
  { id: 16, title: "Christmas Lights", intro: ["Linda found the Christmas lights in the shop.", "Hang a strand on the house, the spruce, the fence, both apple trees and the barn before it gets dark."],
    goal: "Hang all six strands", zones: null, pace: 1, limit: 85, par: 65, light: "golden", twist: "xmas", star3: "No Big Bumps", cash: 120,
    tip: "Stop near a glowing spot and tap it. Pat hops off and hangs the strand, then climbs back on. When they're all up, wait for dark." },
  { id: 17, title: "Clean Up The Shop", intro: ["After all that, the shop's a mess. Tools all over the floor.", "Pick each one up and put it back where it goes: the pegboard, the rack, the shelf and the hook by the door."],
    goal: "Put every tool away", zones: null, pace: 1, limit: 75, par: 60, light: "day", twist: "tidy", star3: "Give The Cat A Pat", cash: 120,
    tip: "Walk up to a tool and tap it to pick it up. Its spot lights up: walk over and Pat puts it away. The cat's in the shop too. Tap her when you're next to her.",
    endTitle: "Winter Done!", chapterFrom: 14, endLine: (n, of) => `You finished Pat's Winter with ${n} of ${of} stars! The shop's tidy and the stove's going.` },
  // PLACEHOLDER for Chapter 5 (replaced at merge)
  ...[18, 19, 20, 21, 22].map((id): Job => ({ id, chapter: id === 18 ? "Chapter 5 (Placeholder)" : undefined, title: `Placeholder ${id + 1}`, intro: ["Stands in for a Chapter 4 or 5 job until the merge."],
    goal: "Mow the orchard", zones: ["orchard"], pace: 6.5, limit: 160, par: 125, light: "day", twist: "free", star3: "No Cat Stops", cash: 10 })),
  // Chapter 6: The Annual Party. Summer on the farm: paint the barn, set out the games and the nets, then party day (./summer)
  { id: 23, chapter: "Chapter 6: The Annual Party", title: "A Fresh Coat", intro: ["The annual party is next weekend, and the old barn is looking tired.", "Pat rigged a paint sprayer on the tractor. Drive along the walls and they turn red. The white trim he does by hand."],
    goal: "Paint the barn, then the trim", zones: null, pace: 1, limit: 90, par: 70, light: "morning", twist: "paint", star3: "Don't Bump The Wet Paint", cash: 110, summer: true,
    tip: "Drive beside a wall to paint it. Slower gives a fuller coat. Once a side is red, stop by its white marker and tap it for the trim." },
  { id: 24, title: "Lawn Games", intro: ["The lawn games are stacked in the barn: cornhole, ladder ball and bocce.", "Load them in the cart, then set each one up on its spot in the field."],
    goal: "Set up the three lawn games", zones: null, pace: 1, limit: 65, par: 50, light: "day", twist: "games", star3: "No Cat Stops", cash: 110, summer: true,
    tip: "Stop by the barn door and tap it to load up. Then pull up beside each outlined spot and tap it. Pat hops off and sets the game up." },
  { id: 25, title: "Nets And The Slip And Slide", intro: ["Up go the badminton net and the soccer net, then the slip and slide.", "Unroll the slide by driving along the dashed line, then hook up the hose."],
    goal: "Put up both nets and the slide", zones: null, pace: 1, limit: 85, par: 65, light: "day", twist: "nets", star3: "Slide Laid Straight", cash: 120, summer: true,
    tip: "Tap the start of the line to drop the roll, then drive along the line without wandering off it. Tap the hose at the end to turn the water on." },
  { id: 26, title: "Party Day", intro: ["It's party day! The whole family is here, and the kids want hay rides.", "Pick them up by the tent, drive through the flags, and bring them back. Three rides before supper."],
    goal: "Give the kids three hay rides", zones: null, pace: 1, limit: 150, par: 110, light: "golden", twist: "party", star3: "Kids Stay Happy", cash: 150, summer: true,
    tip: "Stop in the box by the tent and the kids climb on. Drive through the flags in order, then stop in the box again. Bumping into anything scares the kids.",
    endTitle: "What A Party!", chapterFrom: 0, endLine: (n, of) => `You finished every chapter of Pat's Lawnmower with ${n} of ${of} stars! Thanks for helping Pat and Linda all year.` },
];
export const FREE_JOB: Job = { id: -1, title: "Free Mow", intro: ["The whole lawn, no clock."], goal: "Mow the whole lawn", zones: null, pace: 9.5, light: "day", twist: "free", star3: "", cash: 25 };

export type Upgrades = { deck: number; gear: number; lights: boolean; bagger: boolean; paint: string };
export const DECKS = [1.7, 2.1, 2.5];        // half the cut width, metres (a 3.4 m wing deck to start)
export const GEARS = [6.5, 7.4, 8.3];        // top speed, metres a second
export const DECK_NAMES = ["Standard", "Wide", "Widest"], GEAR_NAMES = ["Standard", "Fast", "Fastest"];
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

/** What's picked for the next job, from what's owned (`up` is what's owned, plus the paint in use). */
export type Loadout = { deck: number; gear: number; lights: boolean; bagger: boolean };
export type Save = { v: 1; cash: number; stars: number[]; best: (number | null)[]; up: Upgrades; sel: Loadout; paints: string[]; free: { secs: number | null; score: number }; muted: boolean; tutorial: boolean; assist: boolean };
const KEY = "pats-lawnmower-save";
export const newSave = (): Save => ({ v: 1, cash: 0, stars: JOBS.map(() => 0), best: JOBS.map(() => null), up: { deck: 0, gear: 0, lights: false, bagger: false, paint: "orange" }, sel: { deck: 0, gear: 0, lights: false, bagger: false }, paints: ["orange"], free: { secs: null, score: 0 }, muted: true, tutorial: false, assist: true });
export function loadSave(): Save {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && v.v === 1) { const d = newSave(), up = { ...d.up, ...v.up }; return { ...d, ...v, up, sel: { deck: up.deck, gear: up.gear, lights: up.lights, bagger: up.bagger, ...v.sel }, free: { ...d.free, ...v.free }, stars: JOBS.map((_, i) => v.stars?.[i] ?? 0), best: JOBS.map((_, i) => v.best?.[i] ?? null) }; }
  } catch {}
  return newSave();
}
export function writeSave(s: Save) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch {} }
/** The loadout a job actually uses: what's picked, never more than what's owned. */
export const loadout = (s: Save): Upgrades => ({ deck: Math.min(s.sel.deck, s.up.deck), gear: Math.min(s.sel.gear, s.up.gear), lights: s.up.lights && s.sel.lights, bagger: s.up.bagger && s.sel.bagger, paint: s.up.paint });
export const loadoutLabel = (u: Upgrades) => `${(DECKS[u.deck] * 2).toFixed(1)} m Deck · ${GEAR_NAMES[u.gear]} Gear${u.bagger ? " · Bagger" : ""}`;
/** Jobs unlock in order: the next one opens once the one before has at least one star. */
export const unlockedUpTo = (s: Save) => { let n = 0; while (n < JOBS.length - 1 && s.stars[n] > 0) n++; return n; };

export type Outcome = {
  job: number; done: boolean; secs: number; limit: number; par: number; pct: number;
  stars: [boolean, boolean, boolean]; meows: number; bumps: number; apples: number; applesTotal: number; quality: number; wet: number; priorityOk: boolean;
  extra?: { label: string; value: string };   // the end card's second box, for jobs that say it their own way
  failLine?: string;                          // what to try next time, when it's out of time
};
/** Pay for a finished job: the base (half on a replay) plus 15 a star for stars not earned before, plus the bagger bonus. */
export function payFor(job: Job, o: Outcome, s: Save) {
  if (!o.done) return { base: 0, starBonus: 0, extra: 0, bagger: 0, total: 0 };
  const had = s.stars[job.id] ?? 0, got = o.stars.filter(Boolean).length;
  const base = had > 0 ? Math.round(job.cash / 2) : job.cash;
  const starBonus = Math.max(0, got - had) * 15;
  const extra = job.twist === "apples" ? o.apples * 2 : 0;
  const sub = base + starBonus + extra, bagger = loadout(s).bagger ? Math.round(sub * 0.25) : 0;
  return { base, starBonus, extra, bagger, total: sub + bagger };
}
