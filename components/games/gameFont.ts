// The display face for in-game banners, labels and buttons (Lilita One, SIL Open Font License, public/fonts). The same
// face the promo videos use, so the games and their ads look like one studio. DOM: put GAME_FONT_CSS in a <style> and use
// the `game-font` class or GAME_FONT. Canvas: await loadGameFont() before the first draw that uses it.
export const GAME_FONT = '"Lilita One", "Arial Rounded MT Bold", system-ui, sans-serif';
/** The frame's face: the site's Geist (loaded by app/layout.tsx as --font-geist-sans), bold and tight like the homepage. */
/** The same Geist for text a canvas draws that works like part of the screen (score pops, scorebars, countdowns, hint
 *  pills). Canvas can't read CSS variables, so this names Geist's family directly. Use it as `800 18px ${HUD_FONT}`.
 *  Words printed on drawn objects (tile numbers, signs, flags) can keep GAME_FONT as part of the illustration. */
export const HUD_FONT = 'GeistSans, "GeistSans Fallback", -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
export const FRAME_FONT = 'var(--font-geist-sans), -apple-system, BlinkMacSystemFont, system-ui, sans-serif';
export const GAME_FONT_CSS = `
@font-face { font-family: "Lilita One"; src: url("/fonts/LilitaOne-Regular.ttf") format("truetype"); font-display: swap; }
.game-font { font-family: ${FRAME_FONT}; font-weight: 700; letter-spacing: -0.01em; }
`;
let loading: Promise<void> | null = null;
export function loadGameFont(): Promise<void> {
  if (typeof document === "undefined") return Promise.resolve();
  if (!loading) {
    if (!document.getElementById("game-font-css")) {
      const s = document.createElement("style"); s.id = "game-font-css"; s.textContent = GAME_FONT_CSS; document.head.appendChild(s);
    }
    loading = Promise.all([document.fonts.load('32px "Lilita One"'), document.fonts.load("800 32px GeistSans")]).then(() => undefined, () => undefined);
  }
  return loading;
}
