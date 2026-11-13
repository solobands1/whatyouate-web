// Blenders & Bacon: the rules, pure (no React, no DOM), so the game, the computer, live play and the headless balance
// check (sim.ts) all run the same code. A match is a list of actions applied in order; the same actions always give the
// same match, which is what keeps two phones in step in a live game.
//
// The board: 96 squares on 12 shelves of 8. Shelf 1 runs left to right, shelf 2 right to left, and so on up, so 96 is
// top left. Both players start just off the bottom shelf (square 0).
//  - Blenders: land on a blender's base and it whirls you up its tube to a higher square.
//  - Bacon: land on the top end of a strip and you slide down to its bottom end.
//  - Pantry Card squares: land on one and you get a card, if you hold fewer than 2.
//      Double Roll: roll twice this turn.   Swap Places: swap squares with the other player.
//      Oven Mitt: plays itself the next time you'd slide down bacon, and you stay put.
//    Before rolling you may play one card (Double Roll or Swap Places).
//  - First to reach or pass 96 wins. No exact roll needed.
// The layout below was checked with sim.ts (1000 games): see the numbers at the top of that file. No bacon near the top
// sends you far: the last strip (94) drops you 11 squares, to 83. Blender tubes and bacon run up and down the
// shelves, never across each other. A match runs about 4 to 5 minutes.

export const LAST = 96;
export const COLS = 8;
export const ROWS = 12;
export type Side = 0 | 1;
export type Card = "double" | "swap" | "mitt";

/** Blenders: [base, top]. */
export const BLENDERS: [number, number][] = [[3, 18], [13, 29], [39, 54], [46, 63], [71, 87]];
/** Bacon strips: [top end, bottom end]. */
export const BACON: [number, number][] = [[26, 10], [32, 16], [37, 22], [50, 33], [60, 45], [68, 52], [79, 62], [86, 70], [92, 76], [94, 83]];
/** Pantry Card squares. */
export const CARD_SQUARES = [9, 21, 25, 35, 44, 57, 65, 77, 82];

// how often each card comes up (a draw is a number in [0, 1))
const DECK: [Card, number][] = [["double", 0.4], ["swap", 0.3], ["mitt", 0.3]];
export function cardFor(pick: number): Card {
  let acc = 0;
  for (const [c, w] of DECK) { acc += w; if (pick < acc) return c; }
  return DECK[DECK.length - 1][0];
}
export const HAND_MAX = 2;

export const blenderAt = (sq: number) => BLENDERS.findIndex(b => b[0] === sq);
export const baconAt = (sq: number) => BACON.findIndex(b => b[0] === sq);
export const isCardSquare = (sq: number) => CARD_SQUARES.includes(sq);

/** Where square n sits: shelf row (0 = bottom) and column (0 = left). Square 0 is the start, off the bottom shelf. */
export function cellOf(n: number) {
  const k = Math.max(1, Math.min(LAST, n)) - 1, row = Math.floor(k / COLS), i = k % COLS;
  return { row, col: row % 2 === 0 ? i : COLS - 1 - i };
}

export type State = {
  pos: [number, number];
  hand: [Card[], Card[]];
  turn: Side;
  turnNo: number;          // turns played so far, both sides
  sub: 0 | 1;              // which roll of the turn this is (a Double Roll gives a second)
  double: boolean;         // Double Roll played this turn
  played: boolean;         // a card has been played this turn
  turns: [number, number]; // turns each side has finished (the winning turn counts)
  winner: Side | null;
  seq: number;             // actions applied, for live play's "who's newer"
};
export const newState = (first: Side = 0): State => ({
  pos: [0, 0], hand: [[], []], turn: first, turnNo: 0, sub: 0, double: false, played: false, turns: [0, 0], winner: null, seq: 0,
});
export const cloneState = (s: State): State => ({ ...s, pos: [...s.pos] as [number, number], hand: [[...s.hand[0]], [...s.hand[1]]], turns: [...s.turns] as [number, number] });

export type Action = { k: "card"; card: "double" | "swap" } | { k: "roll"; v: number; pick: number };
/** What happened, in order, for the animations. */
export type Ev =
  | { e: "play"; side: Side; card: Card }
  | { e: "swap"; a: number; b: number }                          // a: side 0's square before, b: side 1's
  | { e: "die"; side: Side; v: number; sub: 0 | 1 }
  | { e: "hop"; side: Side; from: number; to: number }
  | { e: "blender"; side: Side; i: number; from: number; to: number }
  | { e: "bacon"; side: Side; i: number; from: number; to: number }
  | { e: "mitt"; side: Side; i: number; at: number }
  | { e: "card"; side: Side; card: Card }
  | { e: "full"; side: Side; card: Card }
  | { e: "again"; side: Side }
  | { e: "win"; side: Side }
  | { e: "turn"; side: Side };

export const other = (s: Side): Side => (s === 0 ? 1 : 0);

/** Can this side play this card right now? (Swap Places needs the two of you on different squares.) */
export function canPlay(s: State, side: Side, card: Card) {
  return s.winner === null && s.turn === side && s.sub === 0 && !s.played && card !== "mitt" && s.hand[side].includes(card)
    && !(card === "swap" && s.pos[0] === s.pos[1]);
}

/** Applies one action for the side whose turn it is. Returns null if it isn't allowed. */
export function apply(s0: State, a: Action): { s: State; ev: Ev[] } | null {
  if (s0.winner !== null) return null;
  const s = cloneState(s0), t = s.turn, ev: Ev[] = [];
  if (a.k === "card") {
    if (!canPlay(s0, t, a.card)) return null;
    s.hand[t].splice(s.hand[t].indexOf(a.card), 1); s.played = true;
    ev.push({ e: "play", side: t, card: a.card });
    if (a.card === "double") s.double = true;
    else { ev.push({ e: "swap", a: s.pos[0], b: s.pos[1] }); s.pos = [s.pos[1], s.pos[0]]; }
    s.seq++;
    return { s, ev };
  }
  const v = Math.max(1, Math.min(6, Math.floor(a.v))), from = s.pos[t], to = Math.min(LAST, from + v);
  ev.push({ e: "die", side: t, v, sub: s.sub });
  ev.push({ e: "hop", side: t, from, to });
  s.pos[t] = to;
  if (to >= LAST) {
    s.winner = t; s.turns[t]++; ev.push({ e: "win", side: t }); s.seq++;
    return { s, ev };
  }
  const b = blenderAt(to), c = baconAt(to);
  if (b >= 0) { s.pos[t] = BLENDERS[b][1]; ev.push({ e: "blender", side: t, i: b, from: to, to: BLENDERS[b][1] }); }
  else if (c >= 0) {
    const m = s.hand[t].indexOf("mitt");
    if (m >= 0) { s.hand[t].splice(m, 1); ev.push({ e: "mitt", side: t, i: c, at: to }); }
    else { s.pos[t] = BACON[c][1]; ev.push({ e: "bacon", side: t, i: c, from: to, to: BACON[c][1] }); }
  } else if (isCardSquare(to)) {
    const card = cardFor(a.pick);
    if (s.hand[t].length < HAND_MAX) { s.hand[t].push(card); ev.push({ e: "card", side: t, card }); }
    else ev.push({ e: "full", side: t, card });
  }
  if (s.double && s.sub === 0) { s.sub = 1; ev.push({ e: "again", side: t }); }
  else {
    s.turns[t]++; s.turn = other(t); s.turnNo++; s.sub = 0; s.double = false; s.played = false;
    ev.push({ e: "turn", side: s.turn });
  }
  s.seq++;
  return { s, ev };
}

/** The computer's card choice before it rolls (the sim uses it for both sides). Swap when the other side is well
 *  ahead; a Double Roll whenever it has one. Never peeks at the dice. */
export function cpuCard(s: State, side: Side): "double" | "swap" | null {
  if (s.turn !== side || s.sub !== 0 || s.played || s.winner !== null) return null;
  const me = s.pos[side], them = s.pos[other(side)];
  if (s.hand[side].includes("swap") && them - me >= 8) return "swap";
  if (s.hand[side].includes("double")) return "double";
  return null;
}

/** Score against the computer: fewer turns is better, and winning is worth the most. */
export function scoreFor(won: boolean, turns: number, square: number) {
  return won ? 500 + 40 * Math.max(0, 60 - turns) : 5 * Math.min(LAST, square);
}
