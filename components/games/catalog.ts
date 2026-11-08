// Every game on whatyouate.app/games. Add a game here and it gets a card on the "Choose Your Game" page;
// its page lives at app/games/<slug>/page.tsx.
export type Game = {
  slug: string;
  name: string;
  tagline: string;
  foods: string[];          // noto emoji codes from /games/foods, shown on the card
  tint: string;             // card background
  daily?: boolean;          // has a "Today" challenge that's the same for everyone
};

export const GAMES: Game[] = [
  {
    slug: "snack-merge",
    name: "Snack Merge",
    tagline: "Drop foods into the lunchbox. Match two to grow them. Reach the Power Bowl.",
    foods: ["1fad0", "1f353", "1f951", "1f957"],
    tint: "#e3effe",
    daily: true,
  },
  {
    slug: "beat-the-crash",
    name: "Beat The Crash",
    tagline: "Eat your way to 10pm without crashing. Real food keeps you steady. Sugar doesn't. Survive the 3pm slump.",
    foods: ["1f963", "1f60a", "1f369", "1f634"],
    tint: "#fff1dc",
    daily: true,
  },
  {
    slug: "cart-rush",
    name: "Cart Rush",
    tagline: "Race your cart up the aisle. Grab what's on the recipe card, skip the extras, dodge the spills.",
    foods: ["1f6d2", "1f951", "1f9c0", "1f4e6"],
    tint: "#fdf3e4",
    daily: true,
  },
  {
    slug: "berry-dash",
    name: "Berry Dash",
    tagline: "Run the kitchen counter. Jump the salt shaker, duck the bees, grab the blueberries. Careful with candy.",
    foods: ["1f353", "1fad0", "1f41d", "1f36c"],
    tint: "#ffe9e4",
    daily: true,
  },
  {
    slug: "food-fling",
    name: "Food Fling",
    tagline: "Fling fruit at towers of junk food. Knock every snack off its shelf with three throws.",
    foods: ["1f34e", "1f349", "1f964", "1f369"],
    tint: "#eaf6e4",
    daily: true,
  },
];
