// Chapter 4: the inside of Pat's shop (the barn), as plain data for "Clean Up The Shop". Units are metres (unit 1).
// The top band (y 0 .. WALL_Y) is the north wall seen from the room, with the pegboard over the workbench; the room's
// floor runs from there down to the big doors on the south wall, which stand open on the snow. Pat's blue '67 and the
// tractor (plow blade still on) are parked inside. Every tool has a spot where it goes and a spot on the floor where it
// was left lying.
import type { LawnMap, Pt } from "../lawnMap";

export const WALL_Y = 2.4;                       // the foot of the north wall
export const ROOM = { x0: 0.4, x1: 12.1, y0: WALL_Y, y1: 14.6, doorX0: 5.2, doorX1: 9.8 };
export const BENCH = { x0: 1.1, x1: 6.3, y0: WALL_Y, y1: 3.3 };
export const PEGBOARD = { x0: 1.3, x1: 6.1, y0: 0.55, y1: 2.15 };
export const STOVE = { x: 10.5, y: 4.0, r: 0.55 };
export const RUG = { x0: 9.1, x1: 11.6, y0: 4.85, y1: 6.25 };
export const SHELF = { x0: 11.2, x1: 12.1, y0: 5.9, y1: 9.3 };
export const RACK = { x0: 0.4, x1: 0.75, y0: 4.8, y1: 9.0 };
export const BIN = { x: 6.9, y: 2.95, r: 0.3 };
export const CAR67 = { x: 3.4, y: 11.4, h: -Math.PI / 2 };   // nose to the north wall
export const TRACTOR = { x: 8.7, y: 11.2, h: Math.PI / 2 };  // facing the doors, blade on
export const PAT_START: Pt = [6.4, 13.8];
/** Where the cat likes to sit: the end of the bench, her bed on the rug, the '67's roof, the shelf. */
export const CAT_SPOTS: [number, number, number][] = [[5.9, 2.95, 1.2], [10.1, 5.6, 0.4], [3.4, 11.6, -1.6], [11.6, 9.0, 3.4]];

export type ToolKind = "wrenchL" | "wrenchS" | "hammer" | "saw" | "screwdriver" | "pliers" | "rake" | "shovel" | "broom" | "gascan" | "cord";
export type ToolDef = { kind: ToolKind; name: string; home: "pegboard" | "rack" | "shelf" | "hook"; spot: [number, number, number]; drop: Pt; floor: [number, number, number] };
/** Each tool: where it hangs or sits (spot: x, y, angle), where Pat stands to put it there, and where it's lying now. */
export const TOOLS: ToolDef[] = [
  { kind: "wrenchL", name: "Big Wrench", home: "pegboard", spot: [1.75, 1.35, -Math.PI / 2], drop: [1.75, 3.8], floor: [5.2, 6.4, 0.4] },
  { kind: "wrenchS", name: "Little Wrench", home: "pegboard", spot: [2.35, 1.3, -Math.PI / 2], drop: [2.35, 3.8], floor: [9.6, 9.0, 2.2] },
  { kind: "hammer", name: "Hammer", home: "pegboard", spot: [3.1, 1.3, -Math.PI / 2], drop: [3.1, 3.8], floor: [2.1, 7.6, -0.6] },
  { kind: "saw", name: "Saw", home: "pegboard", spot: [4.15, 1.35, -Math.PI / 2], drop: [4.15, 3.8], floor: [7.2, 4.6, 0.2] },
  { kind: "screwdriver", name: "Screwdriver", home: "pegboard", spot: [5.05, 1.3, -Math.PI / 2], drop: [5.05, 3.8], floor: [5.35, 12.1, 1.2] },
  { kind: "pliers", name: "Pliers", home: "pegboard", spot: [5.65, 1.3, -Math.PI / 2], drop: [5.65, 3.8], floor: [10.6, 8.2, -1] },
  { kind: "rake", name: "Rake", home: "rack", spot: [0.62, 5.4, Math.PI / 2], drop: [1.35, 5.4], floor: [4.0, 5.3, 0.15] },
  { kind: "shovel", name: "Snow Shovel", home: "rack", spot: [0.62, 6.75, Math.PI / 2], drop: [1.35, 6.75], floor: [10.7, 13.5, 2.8] },
  { kind: "broom", name: "Broom", home: "rack", spot: [0.62, 8.1, Math.PI / 2], drop: [1.35, 8.1], floor: [1.45, 12.6, 1.5] },
  { kind: "gascan", name: "Gas Can", home: "shelf", spot: [11.65, 6.6, Math.PI], drop: [10.7, 6.6], floor: [6.6, 9.4, 0.5] },
  { kind: "cord", name: "Extension Cord", home: "hook", spot: [8.3, 1.25, 0], drop: [8.3, 3.05], floor: [8.1, 6.9, 0] },
];

export const SHOP_MAP: LawnMap = {
  unit: 1,
  origin: [0, 0],
  size: [12.5, 15.5],
  lawn: [], driveway: [], lanes: [], roads: [], trees: [], beds: [], noGo: [], buildings: [],
  pads: [{ kind: "concrete", poly: [[ROOM.x0, ROOM.y0], [ROOM.x1, ROOM.y0], [ROOM.x1, ROOM.y1], [ROOM.x0, ROOM.y1]] }],
  // the walls (the doorway too: Pat stays in till the job's done)
  fences: [[[ROOM.x0, ROOM.y0], [ROOM.x1, ROOM.y0], [ROOM.x1, ROOM.y1], [ROOM.x0, ROOM.y1], [ROOM.x0, ROOM.y0]]],
  props: [
    { kind: "box", x: (BENCH.x0 + BENCH.x1) / 2, y: (BENCH.y0 + BENCH.y1) / 2, w: BENCH.x1 - BENCH.x0, h: BENCH.y1 - BENCH.y0, heading: 0 },
    { kind: "box", x: (SHELF.x0 + SHELF.x1) / 2, y: (SHELF.y0 + SHELF.y1) / 2, w: SHELF.x1 - SHELF.x0, h: SHELF.y1 - SHELF.y0, heading: 0 },
    { kind: "box", x: (RACK.x0 + RACK.x1) / 2, y: (RACK.y0 + RACK.y1) / 2, w: RACK.x1 - RACK.x0, h: RACK.y1 - RACK.y0, heading: 0 },
    { kind: "pole", x: STOVE.x, y: STOVE.y, r: STOVE.r },
    { kind: "pole", x: BIN.x, y: BIN.y, r: BIN.r },
  ],
  vehicles: [{ x: CAR67.x, y: CAR67.y, len: 4.65, wid: 1.82, heading: 0, color: "#2f68b4" }],
  door: { x: 7.5, y: 14.2 },
  start: { x: TRACTOR.x, y: TRACTOR.y, heading: 180 },
  zones: {},
};
/** The tractor and its blade, for Pat to walk round (circles: x, y, r). */
export const TRACTOR_BLOCKS: [number, number, number][] = [[TRACTOR.x, TRACTOR.y - 0.45, 0.75], [TRACTOR.x, TRACTOR.y + 0.45, 0.75], [TRACTOR.x - 0.75, TRACTOR.y + 1.45, 0.42], [TRACTOR.x, TRACTOR.y + 1.45, 0.42], [TRACTOR.x + 0.75, TRACTOR.y + 1.45, 0.42]];
