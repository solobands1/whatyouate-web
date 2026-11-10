// Malahide Community Place (the community centre in Springfield, Ontario), as plain data in the same format as
// ./lawnMap. Traced from a north-up satellite image 896 px across (about 0.44 m a pixel); one unit is one pixel of it.
// `unit` (metres a unit) is about half true scale, like the home map, so the job mows in a few minutes.
//
// What's here: two ball diamonds (the west one with a grass infield and a dirt arc round home, the east one with a big
// red-dirt infield and a dirt warning track along its foul-line fences), backstops, chain-link fences with gates,
// dugouts, bleachers, light poles and bases; the paved walking path round both diamonds and down to the south; the hall
// with its parking and the entrance road off Whittaker Road; the playground west of the hall; the spruce grove on the
// west edge; the creek and its treeline along the south; houses across the road.
import type { LawnMap, Pt } from "./lawnMap";

const spruces: [number, number, number][] = [
  [196, 284, 9], [212, 296, 10], [186, 304, 10], [204, 318, 11], [218, 330, 9], [190, 334, 11], [208, 350, 10], [180, 360, 10],
  [198, 372, 11], [216, 384, 9], [184, 390, 10], [202, 404, 10], [216, 418, 9], [190, 420, 9], [206, 434, 8], [172, 328, 9], [170, 296, 9],
  [598, 552, 6], [600, 570, 6], [602, 588, 6], [604, 606, 6], [606, 624, 6], [607, 641, 6],
];

export const COMMUNITY_MAP: LawnMap = {
  unit: 0.21,
  fenceStyle: "chain",
  origin: [150, 225],
  size: [650, 495],
  lawn: [
    // round both diamonds: from the grove to the gravel lot, from the field's treeline down to the hall
    [[228, 300], [300, 270], [400, 258], [500, 250], [588, 244], [618, 254], [626, 440], [612, 468], [440, 482], [262, 502], [232, 500], [226, 400]],
    // round the playground and the hall, down to the walking path by the creek
    [[232, 500], [262, 502], [440, 486], [440, 606], [500, 606], [500, 652], [578, 652], [578, 690], [520, 688], [440, 652], [380, 624], [300, 584], [252, 540], [236, 516]],
  ],
  driveway: [
    [[618, 252], [660, 250], [690, 462], [626, 462]],   // the gravel lot east of the east diamond
  ],
  pads: [
    { kind: "dirt", poly: [[360, 488], [358, 452], [366, 420], [381, 399], [400, 387], [414, 385], [424, 420], [438, 466], [432, 488]] },   // west diamond: the dirt arc round home
    { kind: "clay", poly: [[538, 440], [538, 402], [547, 370], [566, 352], [592, 343], [611, 345], [617, 440]] },                         // east diamond: the red-dirt infield
    { kind: "clay", poly: [[456, 448], [612, 430], [614, 443], [458, 461]] },                                                             // warning track along the third-base fence
    { kind: "clay", poly: [[585, 252], [599, 250], [619, 440], [606, 440]] },                                                             // warning track along the first-base fence
    { kind: "sand", poly: [[405, 272], [470, 268], [472, 308], [408, 312]] },                                                             // the sand court between the diamonds
    { kind: "sand", poly: [[330, 500], [372, 500], [372, 530], [330, 530]] },                                                             // the playground
    { kind: "asphalt", poly: [[415, 470], [615, 455], [705, 452], [712, 498], [560, 504], [415, 502]] },                                  // the plaza in front of the hall and the entrance road
    { kind: "asphalt", poly: [[505, 496], [600, 500], [600, 650], [496, 650], [496, 606]] },                                              // the parking lot
  ],
  lanes: [
    { kind: "paved", width: 6, pts: [[452, 490], [330, 497], [262, 502], [240, 480], [234, 420], [236, 350], [248, 306], [270, 285], [320, 272], [400, 263], [460, 258], [520, 250], [570, 243], [600, 241], [615, 250]] },
    { kind: "paved", width: 6, pts: [[252, 500], [256, 530], [282, 560], [330, 590], [380, 620], [440, 650], [500, 678], [545, 690], [585, 690]] },
  ],
  roads: [{ pts: [[646, 170], [745, 600], [792, 770]], width: 22 }],
  buildings: [
    // the hall: a long grey roof with the gym's white roof standing up in the middle
    { kind: "hall", poly: [[433, 498], [505, 498], [505, 602], [433, 602]], height: 6, wall: "#dcd8cf", roof: "#8f959b", trim: "#ffffff" },
    { kind: "hall", poly: [[505, 520], [535, 520], [535, 592], [505, 592]], height: 5, wall: "#dcd8cf", roof: "#8f959b", trim: "#ffffff" },
    { kind: "hall", poly: [[442, 522], [500, 522], [500, 578], [442, 578]], height: 9, wall: "#e8e5de", roof: "#e3e7ea", trim: "#ffffff" },
    // dugouts, the shed by the playground, the storage building by the gravel lot
    { kind: "shed", poly: [[598, 388], [607, 388], [609, 414], [600, 414]], height: 2.2, wall: "#6f7479", roof: "#3f4448", trim: "#ffffff" },
    { kind: "shed", poly: [[566, 416], [590, 414], [591, 423], [567, 425]], height: 2.2, wall: "#6f7479", roof: "#3f4448", trim: "#ffffff" },
    { kind: "shed", poly: [[412, 446], [421, 446], [423, 463], [414, 463]], height: 2.2, wall: "#6f7479", roof: "#3f4448", trim: "#ffffff" },
    { kind: "shed", poly: [[376, 485], [397, 485], [397, 493], [376, 493]], height: 2.2, wall: "#6f7479", roof: "#3f4448", trim: "#ffffff" },
    { kind: "shed", poly: [[362, 497], [381, 497], [381, 517], [362, 517]], height: 2.6, wall: "#4f79a8", roof: "#dfe3e6", trim: "#ffffff" },
    { kind: "shed", poly: [[622, 250], [648, 250], [648, 274], [622, 274]], height: 3.2, wall: "#d9d4c8", roof: "#e6e3dc", trim: "#ffffff" },
    // houses across Whittaker Road and the one beside the hall's lot
    { kind: "house", poly: [[758, 300], [790, 300], [790, 330], [758, 330]], height: 5, wall: "#e4dccb", roof: "#5d5a58", trim: "#ffffff" },
    { kind: "house", poly: [[772, 380], [800, 380], [800, 410], [772, 410]], height: 5, wall: "#d8cdbb", roof: "#6b4f42", trim: "#ffffff" },
    { kind: "house", poly: [[778, 440], [800, 440], [800, 476], [778, 476]], height: 5, wall: "#e6e1d6", roof: "#4f5357", trim: "#ffffff" },
    { kind: "house", poly: [[672, 548], [704, 548], [704, 606], [672, 606]], height: 5, wall: "#ddd2bf", roof: "#6b4f42", trim: "#ffffff" },
  ],
  trees: [
    ...spruces.map(([x, y, r]) => ({ x, y, r, kind: "spruce" as const })),
    // the treeline along the field and a few shade trees
    { x: 262, y: 270, r: 10 }, { x: 352, y: 258, r: 9 }, { x: 448, y: 250, r: 8 }, { x: 540, y: 244, r: 8 },
    { x: 698, y: 300, r: 8 }, { x: 704, y: 340, r: 7 }, { x: 640, y: 520, r: 10 }, { x: 660, y: 640, r: 12 }, { x: 728, y: 660, r: 12 },
    { x: 300, y: 540, r: 9 }, { x: 470, y: 640, r: 9 },
  ],
  beds: [],
  fences: [
    // west diamond: the outfield fence, the first-base fence with a gate, the third-base fence with a gate, the backstop
    [[262, 488], [257, 420], [265, 350], [290, 308], [330, 290], [375, 281], [395, 278]],
    [[395, 278], [404, 352]], [[408, 372], [422, 440]],
    [[262, 488], [324, 489]], [[346, 489], [374, 488]],
    [[420, 489], [437, 495], [446, 483], [446, 463]],
    // east diamond: the outfield fence with a gate at the top, the foul-line fences (a gate on the third-base side), the backstop
    [[456, 452], [459, 400], [467, 342], [490, 302], [530, 273], [560, 260]], [[574, 255], [590, 251]],
    [[599, 250], [619, 440]],
    [[458, 461], [482, 458]], [[504, 455], [614, 443]],
    [[600, 452], [618, 457], [629, 446], [629, 430]],
  ],
  props: [
    // light poles
    { kind: "pole", x: 287, y: 283, r: 1.4 }, { kind: "pole", x: 238, y: 403, r: 1.4 }, { kind: "pole", x: 409, y: 338, r: 1.4 }, { kind: "pole", x: 443, y: 404, r: 1.4 },
    { kind: "pole", x: 488, y: 268, r: 1.4 }, { kind: "pole", x: 452, y: 352, r: 1.4 }, { kind: "pole", x: 612, y: 300, r: 1.4 }, { kind: "pole", x: 622, y: 372, r: 1.4 },
    // bleachers and benches
    { kind: "bleacher", x: 431, y: 474, w: 6, h: 16, heading: 0 }, { kind: "bleacher", x: 624, y: 404, w: 6, h: 18, heading: 0 },
    { kind: "bench", x: 300, y: 498, w: 9, h: 3, heading: -3 }, { kind: "bench", x: 520, y: 470, w: 9, h: 3, heading: -5 },
    // bases: east diamond (home at 612,440), west diamond (home at 428,472)
    { kind: "base", x: 609, y: 398, w: 2.4, h: 2.4, heading: 45 }, { kind: "base", x: 568, y: 402, w: 2.4, h: 2.4, heading: 45 }, { kind: "base", x: 570, y: 444, w: 2.4, h: 2.4, heading: 45 },
    { kind: "base", x: 421, y: 431, w: 2.4, h: 2.4, heading: 45 }, { kind: "base", x: 379, y: 435, w: 2.4, h: 2.4, heading: 45 }, { kind: "base", x: 386, y: 476, w: 2.4, h: 2.4, heading: 45 },
    // the playground: a climbing frame, swings, a slide
    { kind: "play", x: 351, y: 515, w: 30, h: 22, heading: 0 },
  ],
  vehicles: [],
  noGo: [
    // the tilled field to the north, the bare ground to the west, the creek's treeline to the south, the yards across the road
    { kind: "field", poly: [[150, 225], [652, 225], [648, 236], [590, 240], [500, 246], [400, 254], [300, 264], [228, 292], [168, 276], [150, 270]] },
    { kind: "field", poly: [[150, 446], [222, 444], [234, 520], [176, 560], [150, 566]] },
    { kind: "woods", poly: [[150, 600], [236, 600], [320, 640], [420, 676], [500, 706], [610, 708], [660, 720], [150, 720]] },
    { kind: "yard", poly: [[752, 225], [800, 225], [800, 720], [790, 720], [758, 600], [736, 500], [722, 420], [710, 340], [700, 270], [690, 225]] },
    { kind: "yard", poly: [[640, 512], [708, 506], [734, 620], [760, 720], [660, 720], [610, 708], [606, 520]] },
  ],
  door: { x: 520, y: 508 },
  start: { x: 640, y: 470, heading: 270 },
  zones: {
    outfieldW: [[262, 488], [257, 420], [265, 350], [290, 308], [330, 290], [375, 281], [395, 278], [422, 440], [420, 489]],
    outfieldE: [[456, 452], [459, 400], [467, 342], [490, 302], [530, 273], [590, 251], [599, 250], [619, 440], [614, 443]],
    hallLawn: [[236, 500], [440, 486], [440, 606], [500, 606], [500, 628], [452, 628], [380, 604], [300, 566], [252, 532]],   // round the playground and the hall
  },
};

/** Where Pat's truck and trailer stand at the community centre: the front of the truck, and the way it points. */
export const COMMUNITY_RIG: { x: number; y: number; heading: number } = { x: 655, y: 372, heading: 0 };
/** The two home plates (east diamond, west diamond), in units. */
export const COMMUNITY_PLATES: Pt[] = [[612, 440], [428, 472]];
export type { Pt };
