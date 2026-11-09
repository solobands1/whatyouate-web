// The yard for Pat's Lawnmower, as plain data.
//
// Coordinates: x runs right (east), y runs DOWN (south). North is up. Everything is in "units": the layout below was
// traced in the pixels of the summer satellite screenshot (1282 x 958, about 0.108 m per pixel), so one unit is one
// pixel of that image. The yard runs a little past the image (the road above the house, the south fence below it), so
// the map covers x 0..1300 and y -130..1180: `origin` is the top-left corner of the map and `size` its width and height.
// `unit` is metres per unit. True scale is about 0.108; `unit` is a little lower (0.075) so the whole property mows in
// a few minutes with the tractor at life size and a wide wing deck. Lower it for a quicker mow, raise it for more room.
//
// Shapes (all in units):
//   lawn       polygons that need mowing (several allowed). Anything inside them that is also a building, bed, tree trunk,
//              driveway, pad, lane, road, prop, vehicle or no-go area is not counted as lawn.
//   driveway   gravel polygons (the parking / turnaround area): drive on them, nothing to mow.
//   pads       flat polygons you can drive on, nothing to mow: kind "concrete" or "dirt" (bare ground).
//   lanes      tracks as polylines with a width: kind "gravel" (light, with tire tracks) or "dirt".
//   roads      paved roads as polylines with a width, drawn with gravel shoulders and a dashed centre line (drive on).
//   buildings  footprint polygons, height (metres at map scale; only for the look: taller shows more wall), colours.
//              A 4-point rectangle at any angle gets a gable roof along its long side; `wings` (4-point rectangles) give
//              an odd-shaped building one gable per wing; `flat: true` draws a flat roof (porch roofs, decks).
//              kind "deck" draws boards; kind "barn" draws the roof inset so the red walls show all round.
//              `frontGable` [left eave corner, right eave corner, point where it meets the main roof] adds a cross gable
//              (the house's steep front gable). Buildings are drawn in list order (later ones on top).
//   trees      circles: x, y, r = canopy radius. "leafy" and "fruit" trees can be driven under (only the trunk blocks);
//              "spruce" blocks most of its canopy; "well" is a solid round thing (cistern cap, big rock). Fruit trees
//              drop a few apples on the grass.
//   beds       garden bed polygons (block the mower). `veg: true` draws rows instead of flowers.
//   fences     polylines (block the mower). Leave a gap in the line for a gate.
//   props      small things that block the mower: "firepit" (x, y, r), and rectangles (x, y = centre, w, h, heading in
//              degrees) for "horseshoe" pits, lawn "chair"s and a "box" (a little shed or cover).
//   vehicles   parked cars and trucks: centre, length, width, heading (degrees), colour. They block the mower.
//   noGo       polygons the mower can't enter, drawn by kind: a tilled field, a pond, woods (a dense tree row), a road.
//   door       a point just outside the house door: where the cat comes out and goes back in.
//   start      where the mower starts, heading in degrees (0 = up/north, 90 = right/east, 180 = down/south).
//   zones      named areas the story jobs use (which part of the yard a job mows, highlighted priority spots).
// Anything not covered by a shape is rough grass: drivable, nothing to mow. The map's outer rectangle is a wall.

export type Pt = [number, number];
export type Building = { kind: "house" | "barn" | "shed" | "garage" | "deck" | "other"; poly: Pt[]; height: number; wall: string; roof: string; trim?: string; wings?: Pt[][]; flat?: boolean; frontGable?: Pt[] };
export type Tree = { x: number; y: number; r: number; kind?: "leafy" | "spruce" | "fruit" | "well" };
export type Bed = { poly: Pt[]; veg?: boolean };
export type Pad = { poly: Pt[]; kind: "concrete" | "dirt" };
export type Line = { pts: Pt[]; width: number; kind?: "gravel" | "dirt" };
export type Prop = { kind: "firepit" | "horseshoe" | "chair" | "box"; x: number; y: number; r?: number; w?: number; h?: number; heading?: number };
export type Vehicle = { x: number; y: number; len: number; wid: number; heading: number; color: string };
export type NoGo = { kind: "road" | "water" | "field" | "woods"; poly: Pt[] };
export type LawnMap = {
  unit: number;
  origin: Pt;
  size: [number, number];
  lawn: Pt[][];
  driveway: Pt[][];
  pads: Pad[];
  lanes: Line[];
  roads: Line[];
  buildings: Building[];
  trees: Tree[];
  beds: Bed[];
  fences: Pt[][];
  props: Prop[];
  vehicles: Vehicle[];
  noGo: NoGo[];
  door: { x: number; y: number };
  start: { x: number; y: number; heading: number };
  zones: Record<string, Pt[]>;
};

/** A rectangle as a polygon, optionally turned `deg` degrees clockwise about its centre. */
export function rect(x: number, y: number, w: number, h: number, deg = 0): Pt[] {
  const cx = x + w / 2, cy = y + h / 2, a = (deg * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a);
  return ([[x, y], [x + w, y], [x + w, y + h], [x, y + h]] as Pt[]).map(([px, py]) => [cx + (px - cx) * c - (py - cy) * s, cy + (px - cx) * s + (py - cy) * c] as Pt);
}
/** A w x h rectangle centred on (x, y), turned `deg` degrees clockwise. */
export function centredRect(x: number, y: number, w: number, h: number, deg = 0): Pt[] { return rect(x - w / 2, y - h / 2, w, h, deg); }

// The family yard, traced from the summer satellite screenshot (with the spring imagery for the fence lines).
export const LAWN_MAP: LawnMap = {
  unit: 0.075,
  origin: [0, -130],
  size: [1300, 1310],
  lawn: [
    // the big fenced field west of the house
    [[13, 318], [445, 237], [480, 435], [855, 334], [967, 760], [1003, 955], [23, 1155]],
    // the smaller fenced area at the top, between the tree row and the inner fence
    [[445, 237], [500, 226], [600, 210], [700, 198], [800, 186], [880, 120], [880, 300], [855, 334], [480, 435]],
    // round the house: the front yard, the east side and down to the barn
    [[870, 5], [1232, -80], [1232, 905], [1003, 955], [967, 760], [855, 334], [880, 300], [880, 120]],
  ],
  driveway: [[[1015, 90], [1136, 86], [1140, 154], [1015, 158]]],   // the gravel turnaround beside the house
  pads: [
    { kind: "dirt", poly: [[980, 415], [1036, 418], [1035, 495], [982, 493]] },        // bare ground round the fire pit
    { kind: "concrete", poly: [[1118, 706], [1152, 704], [1154, 734], [1120, 736]] },  // in front of the barn doors
  ],
  lanes: [
    { kind: "gravel", pts: [[1105, -95], [1108, 20], [1104, 96]], width: 46 },   // the driveway in from the road
    { kind: "gravel", pts: [[1100, 140], [1160, 190], [1222, 250], [1250, 330], [1252, 500], [1252, 700], [1247, 902]], width: 38 },   // the lane down the east side
    { kind: "gravel", pts: [[1250, 722], [1190, 723], [1150, 721]], width: 28 },  // the spur to the barn
  ],
  roads: [{ pts: [[-20, 154], [1320, -162]], width: 100 }],
  buildings: [
    // the farmhouse: two storeys, dark brown roof with the steep front gable, a porch along the front, a rear ell and the deck
    { kind: "other", poly: [[922, 117], [1008, 117], [1008, 136], [922, 136]], height: 2.2, wall: "#ece3cc", roof: "#5a4a40", trim: "#ffffff", flat: true },   // the front porch roof
    { kind: "house", poly: [[920, 135], [1010, 135], [1010, 205], [1005, 205], [1005, 250], [940, 250], [940, 205], [920, 205]], height: 5.4, wall: "#ece3cc", roof: "#54433a", trim: "#ffffff",
      wings: [[[940, 205], [1005, 205], [1005, 250], [940, 250]], [[920, 135], [1010, 135], [1010, 205], [920, 205]]],
      frontGable: [[948, 135], [984, 135], [966, 170]] },
    { kind: "deck", poly: [[945, 250], [1030, 250], [1030, 305], [945, 305]], height: 0.6, wall: "#b89a72", roof: "#cdb48e", flat: true },
    // the red barn at the back (grey metal roof), with its dark lean-to, and the little shed set at an angle
    { kind: "barn", poly: [[1045, 752], [1167, 734], [1177, 837], [1060, 847]], height: 6, wall: "#b3302a", roof: "#a5aaaf", trim: "#ffffff" },
    { kind: "other", poly: [[1084, 839], [1120, 836], [1122, 860], [1086, 862]], height: 2.7, wall: "#b3302a", roof: "#6d7075", trim: "#ffffff", flat: true },
    { kind: "shed", poly: centredRect(1203, 706, 22, 30, 65), height: 2.2, wall: "#c9b9a0", roof: "#8c8f93", trim: "#ffffff" },
  ],
  trees: [
    // west of the house
    { x: 866, y: 212, r: 40 }, { x: 886, y: 276, r: 28 },
    // the big old trees east of the house, round the driveway
    { x: 1060, y: 180, r: 56 }, { x: 1150, y: 145, r: 42 }, { x: 1142, y: 235, r: 48 }, { x: 1062, y: 262, r: 34 },
    { x: 1058, y: 42, r: 22 }, { x: 1205, y: 22, r: 26 },
    // along the east edge, beside the lane
    { x: 1214, y: 402, r: 38 }, { x: 1228, y: 622, r: 54 },
    // the cluster in the middle of the east lawn, and shrubs
    { x: 950, y: 565, r: 46 }, { x: 994, y: 612, r: 44 }, { x: 944, y: 632, r: 34 }, { x: 1010, y: 548, r: 28 },
    { x: 1108, y: 408, r: 14, kind: "spruce" }, { x: 1095, y: 490, r: 32 }, { x: 1086, y: 620, r: 18, kind: "spruce" },
    // the two apple trees in front of the barn
    { x: 1006, y: 672, r: 26, kind: "fruit" }, { x: 1078, y: 660, r: 27, kind: "fruit" },
    // small trees along the inner fence
    { x: 682, y: 366, r: 15 }, { x: 760, y: 355, r: 14 }, { x: 850, y: 340, r: 16 }, { x: 905, y: 360, r: 34 },
  ],
  beds: [],
  fences: [
    // the outside: north along the tree row, down the west side, along the south
    [[445, 237], [13, 318], [7, 1160], [1238, 907]],
    // the inner fence: down from the tree row, then east toward the house, with a gate gap near the house end
    [[445, 237], [480, 435], [765, 359]],
    [[835, 339], [855, 334]],
    // the east side of the big field, with a gate gap halfway down, then on to the south fence
    [[855, 334], [887, 455]],
    [[905, 525], [967, 760], [1003, 955]],
  ],
  props: [
    { kind: "firepit", x: 1008, y: 456, r: 14 },
    { kind: "chair", x: 990, y: 430, w: 13, h: 15, heading: 140 }, { kind: "chair", x: 1028, y: 435, w: 13, h: 15, heading: 220 },
    { kind: "horseshoe", x: 1176, y: 470, w: 13, h: 20, heading: 0 }, { kind: "horseshoe", x: 1176, y: 531, w: 13, h: 20, heading: 0 },
    { kind: "box", x: 788, y: 198, w: 26, h: 20, heading: 30 },
  ],
  vehicles: [],
  noGo: [
    // the dense row of trees between the road and the lawn
    { kind: "woods", poly: [[0, 209], [300, 138], [600, 67], [880, 1], [880, 40], [862, 118], [840, 175], [800, 186], [700, 198], [600, 210], [500, 226], [450, 236], [300, 252], [200, 262], [110, 292], [60, 305], [10, 302], [0, 300]] },
    // fields: north of the road, east of the lane, south of the fence
    { kind: "field", poly: [[0, -130], [972, -130], [0, 99]] },
    { kind: "field", poly: [[1278, -130], [1300, -130], [1300, 1180], [1278, 1180]] },
    { kind: "field", poly: [[0, 1168], [1300, 902], [1300, 1180], [0, 1180]] },
  ],
  door: { x: 990, y: 313 },   // the steps off the back deck
  start: { x: 1080, y: 122, heading: 225 },
  zones: {
    // the job areas follow the fences, so each job is one open piece of lawn
    frontHouse: [[870, -95], [1240, -95], [1240, 520], [902, 520], [855, 334], [880, 300], [880, 120]],                  // the front yard, round the house and the fire pit
    northField: [[13, 318], [445, 237], [480, 435], [765, 359], [855, 334], [892, 470], [600, 560], [0, 650]],            // the top of the big field
    barnSide: [[886, 400], [1240, 400], [1240, 960], [1003, 960], [967, 760], [905, 525], [887, 455]],                   // from the horseshoe pits down to the barn
    orchard: [[925, 590], [1240, 590], [1240, 960], [1003, 960], [967, 760], [933, 620]],                                // the apple trees and round the barn
    stripes: [[300, 660], [840, 560], [895, 780], [350, 900]],                                                           // a big open piece of the field for neat stripes
    eastLawn: [[870, -95], [1240, -95], [1240, 960], [1003, 960], [967, 760], [905, 525], [887, 455], [855, 334], [880, 300], [880, 120]],   // everything east of the big field
    priorityPits: [[1265, 500], [1240, 440], [1180, 415], [1120, 440], [1095, 500], [1120, 560], [1180, 585], [1240, 560]],   // round the horseshoe pits
    priorityPath: [[1000, 470], [1060, 450], [1160, 700], [1100, 720]],                                                  // the walk from the fire pit to the barn
  },
};

/** The map in metres with its origin at (0, 0) (unit becomes 1). */
export function toMetres(m: LawnMap): LawnMap {
  const k = m.unit, [ox, oy] = m.origin, P = (p: Pt): Pt => [(p[0] - ox) * k, (p[1] - oy) * k], L = (ps: Pt[]) => ps.map(P);
  const pt = (x: number, y: number) => { const [a, b] = P([x, y]); return { x: a, y: b }; };
  return {
    unit: 1, origin: [0, 0], size: [m.size[0] * k, m.size[1] * k], lawn: m.lawn.map(L), driveway: m.driveway.map(L),
    pads: m.pads.map(p => ({ ...p, poly: L(p.poly) })),
    lanes: m.lanes.map(l => ({ ...l, pts: L(l.pts), width: l.width * k })), roads: m.roads.map(l => ({ ...l, pts: L(l.pts), width: l.width * k })),
    buildings: m.buildings.map(b => ({ ...b, poly: L(b.poly), wings: b.wings?.map(L), frontGable: b.frontGable && L(b.frontGable) })),
    trees: m.trees.map(t => ({ ...t, ...pt(t.x, t.y), r: t.r * k })),
    beds: m.beds.map(b => ({ ...b, poly: L(b.poly) })), fences: m.fences.map(L),
    props: m.props.map(p => ({ ...p, ...pt(p.x, p.y), r: p.r !== undefined ? p.r * k : undefined, w: p.w !== undefined ? p.w * k : undefined, h: p.h !== undefined ? p.h * k : undefined })),
    vehicles: m.vehicles.map(v => ({ ...v, ...pt(v.x, v.y), len: v.len * k, wid: v.wid * k })),
    noGo: m.noGo.map(n => ({ ...n, poly: L(n.poly) })),
    door: pt(m.door.x, m.door.y), start: { ...m.start, ...pt(m.start.x, m.start.y) },
    zones: Object.fromEntries(Object.entries(m.zones).map(([k, z]) => [k, L(z)])),
  };
}

/** A parked vehicle's outline (for bumping into it). */
export function vehiclePoly(v: Vehicle): Pt[] {
  const a = ((v.heading - 90) * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), hl = v.len / 2, hw = v.wid / 2;
  return ([[hl, -hw], [hl, hw], [-hl, hw], [-hl, -hw]] as Pt[]).map(([lx, ly]) => [v.x + lx * c - ly * s, v.y + lx * s + ly * c] as Pt);
}
/** A rectangular prop's outline. */
export function propPoly(p: Prop): Pt[] { return centredRect(p.x, p.y, p.w ?? 1, p.h ?? 1, p.heading ?? 0); }
