// The display face for in-game banners, labels and buttons (Lilita One, SIL Open Font License, public/fonts). The same
// face the promo videos use, so the games and their ads look like one studio. DOM: put GAME_FONT_CSS in a <style> and use
// the `game-font` class or GAME_FONT. Canvas: await loadGameFont() before the first draw that uses it.
export const GAME_FONT = '"Lilita One", "Arial Rounded MT Bold", system-ui, sans-serif';
export const GAME_FONT_CSS = `
@font-face { font-family: "Lilita One"; src: url("/fonts/LilitaOne-Regular.ttf") format("truetype"); font-display: swap; }
.game-font { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.02em; }
`;
let loading: Promise<void> | null = null;
export function loadGameFont(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!loading) {
    if (!document.getElementById("game-font-css")) {
      const s = document.createElement("style"); s.id = "game-font-css"; s.textContent = GAME_FONT_CSS; document.head.appendChild(s);
    }
    loading = document.fonts.load('32px "Lilita One"').then(() => undefined, () => undefined);
  }
  return loading;
}
