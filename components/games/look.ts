// The games' frame look, as plain CSS: the kit (components/games/kit.tsx) puts it on every game page and the games hub
// (app/games/page.tsx) uses it too, so the launcher and the games share one set of panels, buttons, badges and HUD chips.
// Kept out of the kit so a server component can import it. It follows whatyouate.app and the app itself: the site's Geist,
// flat white cards with a hairline pale blue edge and a wide soft shadow, one accent (sky blue #6FA8FF, pressed #4F88E8),
// soft blue tints (#EAF2FF) for tags and steps, near-black #101B2E for the strongest call (the site's Download pill),
// muted #5A6B85 text, small spaced capitals for labels. No gloss, no hard lips, no outlines.
import { FRAME_FONT } from "./gameFont";

export const KIT_CSS = `@layer components {
.wk-f { font-family: ${FRAME_FONT}; font-weight: 700; letter-spacing: -0.02em; }
.wk-backdrop { background: rgba(16,27,46,0.32); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.wk-backdrop-soft { background: rgba(16,27,46,0.14); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); }
.wk-panel { position: relative; color: #101B2E; border-radius: 28px; background: #fff;
  box-shadow: 0 0 0 1px rgba(111,168,255,0.18), 0 30px 70px -28px rgba(31,70,140,0.45); }
.wk-plate { font-family: ${FRAME_FONT}; font-weight: 700; letter-spacing: -0.02em; color: #101B2E; background: transparent;
  box-shadow: inset 0 -1px 0 #EEF3FB; }
.wk-pop { animation: wk-pop 260ms cubic-bezier(.2,.9,.3,1.15) both; }
@keyframes wk-pop { 0% { opacity: 0; transform: scale(0.94) translateY(8px) } 100% { opacity: 1; transform: none } }
.wk-btn { font-family: ${FRAME_FONT}; font-weight: 600; letter-spacing: -0.01em; position: relative; display: flex; align-items: center;
  justify-content: center; gap: 8px; border-radius: 999px; line-height: 1.1; -webkit-tap-highlight-color: transparent;
  transition: transform 90ms ease-out, background-color 120ms, box-shadow 120ms, opacity 120ms; }
.wk-btn:active { transform: scale(0.97); }
.wk-blue, .wk-go { color: #fff; background: #6FA8FF; box-shadow: 0 12px 26px -12px rgba(79,136,232,0.85); }
.wk-blue:active, .wk-go:active { background: #5E9BF7; }
.wk-yellow, .wk-navy { color: #fff; background: #101B2E; box-shadow: 0 12px 26px -12px rgba(16,27,46,0.6); }
.wk-light { color: #4F88E8; background: #fff; box-shadow: 0 0 0 1px #DCE8FA, 0 8px 18px -12px rgba(31,70,140,0.3); }
.wk-light:active { background: #F4F8FF; }
.wk-btn:disabled { opacity: 0.5; transform: none; }
.wk-link { font-family: ${FRAME_FONT}; font-weight: 600; letter-spacing: -0.01em; color: #5a6b85; }
.wk-round { display: flex; align-items: center; justify-content: center; border-radius: 999px; color: #4F88E8; -webkit-tap-highlight-color: transparent;
  background: #fff; box-shadow: 0 0 0 1px #E3EDFB, 0 8px 18px -12px rgba(31,70,140,0.35); transition: transform 90ms ease-out, opacity 150ms; }
.wk-round:active { transform: scale(0.94); }
.wk-seg { display: flex; padding: 3px; border-radius: 999px; background: #fff; box-shadow: 0 0 0 1px #E3EDFB, 0 6px 16px -12px rgba(31,70,140,0.3); }
.wk-seg > button { font-family: ${FRAME_FONT}; font-weight: 600; letter-spacing: -0.01em; flex: 1 1 auto; border-radius: 999px; color: #6B7D99;
  white-space: nowrap; -webkit-tap-highlight-color: transparent; transition: color 120ms, background-color 120ms; }
.wk-seg > button[aria-pressed="true"] { color: #fff; background: #6FA8FF; box-shadow: 0 6px 14px -8px rgba(79,136,232,0.9); }
.wk-hud { color: #101B2E; border-radius: 14px; background: #fff; box-shadow: 0 0 0 1px #E3EDFB, 0 8px 20px -14px rgba(31,70,140,0.35); }
.wk-hud.wk-hud-blue { color: #fff; background: #6FA8FF; box-shadow: 0 10px 22px -14px rgba(79,136,232,0.9); }
.wk-hud.wk-hud-red { color: #fff; background: #FF7A93; box-shadow: 0 10px 22px -14px rgba(255,90,120,0.8); }
.wk-hud-label { font: 600 9px/1 ${FRAME_FONT}; letter-spacing: 0.12em; text-transform: uppercase; color: #8A9AB5; }
.wk-hud-blue .wk-hud-label, .wk-hud-red .wk-hud-label { color: rgba(255,255,255,0.85); }
.wk-tag { font-family: ${FRAME_FONT}; font-weight: 600; letter-spacing: -0.005em; color: #fff; border-radius: 999px; white-space: nowrap; }
.wk-tag.wk-tag-light { color: #4F88E8; background: #EAF2FF; }
.wk-input { border: 1px solid #DCE8FA; background: #fff; border-radius: 14px; color: #101B2E; }
.wk-input:focus { border-color: #6FA8FF; box-shadow: 0 0 0 3px rgba(111,168,255,0.2); outline: none; }
.wk-step { font-family: ${FRAME_FONT}; font-weight: 700; color: #4F88E8; border-radius: 999px; background: #EAF2FF; }
.wk-card { background: #fff; border-radius: 22px; box-shadow: 0 0 0 1px rgba(111,168,255,0.18), 0 18px 40px -22px rgba(31,70,140,0.4); }
.wk-pulse { animation: wk-pulse 2.2s ease-in-out infinite; } .wk-pulse:active { animation: none; }
@keyframes wk-pulse { 0%, 100% { scale: 1 } 50% { scale: 1.02 } }
.wk-rays { background: repeating-conic-gradient(from 0deg, rgba(111,168,255,0.28) 0deg 9deg, rgba(111,168,255,0) 9deg 22.5deg);
  -webkit-mask: radial-gradient(circle, #000 18%, transparent 68%); mask: radial-gradient(circle, #000 18%, transparent 68%); animation: wk-spin 18s linear infinite; }
@keyframes wk-spin { to { transform: rotate(360deg) } }
.wk-best { font-family: ${FRAME_FONT}; font-weight: 700; letter-spacing: -0.01em; color: #4F88E8; background: #EAF2FF; border-radius: 999px; }
/* a popup's card sits a little above the middle (40% of the free space above it, 60% below), where a centred card looks
   centred to the eye; when the card fills the space the spacers shrink to nothing */
.wk-raise { flex-direction: column; } .wk-raise::before { content: ""; flex: 2 1 0; min-height: 0; } .wk-raise::after { content: ""; flex: 3 1 0; min-height: 0; }
.wk-dot { animation: wk-dot 1s ease-in-out infinite; } @keyframes wk-dot { 0%, 100% { opacity: 0.25 } 50% { opacity: 1 } }
}`;
