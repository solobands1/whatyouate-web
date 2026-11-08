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
];
