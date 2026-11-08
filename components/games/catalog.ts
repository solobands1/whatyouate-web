// Every game on whatyouate.app/games. Add a game here and it gets a card on the "Choose Your Game" page;
// its page lives at app/games/<slug>/page.tsx and its card picture at public/games/cards/<slug>.jpg (480px square,
// drawn to show how the game plays).
export type Game = {
  slug: string;
  name: string;
  tagline: string;
  daily?: boolean;          // has a "Today" challenge that's the same for everyone
};

export const GAMES: Game[] = [
  {
    slug: "snack-merge",
    name: "Snack Merge",
    tagline: "Drop foods into the lunchbox. Match two to grow them. Reach the Power Bowl.",
    daily: true,
  },
  {
    slug: "beat-the-crash",
    name: "Beat The Crash",
    tagline: "Eat your way to 10pm without crashing. Real food keeps you steady. Sugar doesn't. Survive the 3pm slump.",
    daily: true,
  },
  {
    slug: "cart-rush",
    name: "Cart Rush",
    tagline: "Race your cart up the aisle. Grab what's on the recipe card, skip the extras, dodge the spills.",
    daily: true,
  },
  {
    slug: "berry-dash",
    name: "Berry Dash",
    tagline: "Run the kitchen counter. Jump the salt shaker, duck the bees, grab the blueberries. Careful with candy.",
    daily: true,
  },
  {
    slug: "food-fling",
    name: "Food Fling",
    tagline: "Fling fruit at towers of junk food. Knock every snack off its shelf with three throws.",
    daily: true,
  },
];
