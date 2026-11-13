// The games' frame look, as plain CSS: the kit (components/games/kit.tsx) puts it on every game page and the games hub
// (app/games/page.tsx) uses it too, so the launcher and the games share one set of panels, buttons, badges and HUD chips.
// Kept out of the kit so a server component can import it. Colours follow the WhatYouAte site and app: sky blue
// #6FA8FF (gradient #84B6FF to #5A95F5, lip #3F78DB), soft blue #DDEBFF / ring #BBD4FF, ink #101B2E (the Get App pill),
// muted #5A6B85, white cards with soft shadows. Gold #FFE65C to #FFB618 is kept for trophies, best scores and the
// scoreboard prompt only.
import { GAME_FONT } from "./gameFont";

// In the components layer, so a Tailwind class on the same element still wins (sizes, margins, widths).
export const KIT_CSS = `@layer components {
.wk-f { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.02em; }
.wk-backdrop { background: radial-gradient(120% 90% at 50% 45%, rgba(16,27,46,0.22) 0%, rgba(16,27,46,0.5) 100%); }
.wk-backdrop-soft { background: radial-gradient(120% 90% at 50% 45%, rgba(16,27,46,0.06) 0%, rgba(16,27,46,0.3) 100%); }
.wk-panel { position: relative; color: #101B2E; border-radius: 26px; background: #fff;
  box-shadow: 0 0 0 1.5px #DDEBFF, 0 24px 48px -16px rgba(16,27,46,0.38), 0 4px 10px -4px rgba(16,27,46,0.12); }
.wk-plate { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.03em; color: #fff; text-shadow: 0 1px 0 rgba(30,70,150,0.35);
  background: linear-gradient(180deg, #84B6FF 0%, #5A95F5 100%); box-shadow: inset 0 -3px 0 rgba(30,70,150,0.18), inset 0 1px 0 rgba(255,255,255,0.3); }
.wk-pop { animation: wk-pop 280ms cubic-bezier(.2,.9,.3,1.25) both; }
@keyframes wk-pop { 0% { opacity: 0; transform: scale(0.86) translateY(10px) } 60% { opacity: 1; transform: scale(1.03) } 100% { opacity: 1; transform: none } }
.wk-btn { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.02em; position: relative; isolation: isolate; display: flex; align-items: center;
  justify-content: center; gap: 8px; border-radius: 16px; line-height: 1.1; -webkit-tap-highlight-color: transparent;
  transition: transform 80ms ease-out, box-shadow 80ms ease-out, filter 120ms; }
.wk-btn::after { content: ""; position: absolute; left: 7px; right: 7px; top: 3px; height: 42%; border-radius: 12px 12px 8px 8px;
  background: linear-gradient(180deg, rgba(255,255,255,0.3), rgba(255,255,255,0)); pointer-events: none; z-index: -1; }
.wk-blue, .wk-go { color: #fff; background: linear-gradient(180deg, #84B6FF 0%, #5A95F5 100%); text-shadow: 0 1px 0 rgba(30,70,150,0.35);
  box-shadow: 0 4px 0 #3F78DB, 0 10px 18px -8px rgba(63,120,219,0.55); }
.wk-yellow { color: #101B2E; background: linear-gradient(180deg, #FFE65C 0%, #FFB618 100%); box-shadow: 0 4px 0 #D99410, 0 10px 18px -8px rgba(217,148,16,0.5); }
.wk-light { color: #4F88E8; background: #fff;
  box-shadow: 0 0 0 1.5px #DDEBFF, 0 4px 0 #D3E2F8, 0 10px 16px -10px rgba(16,27,46,0.25); }
.wk-navy { color: #fff; background: linear-gradient(180deg, #2A3852 0%, #101B2E 100%);
  box-shadow: 0 4px 0 #050a14, 0 10px 16px -8px rgba(16,27,46,0.45); }
.wk-light::after { display: none; }
.wk-blue:active, .wk-go:active, .wk-yellow:active, .wk-navy:active { transform: translateY(3px); }
.wk-blue:active, .wk-go:active { box-shadow: 0 1px 0 #3F78DB; } .wk-yellow:active { box-shadow: 0 1px 0 #D99410; } .wk-navy:active { box-shadow: 0 1px 0 #050a14; }
.wk-light:active { transform: translateY(3px); box-shadow: 0 0 0 1.5px #DDEBFF, 0 1px 0 #D3E2F8; }
.wk-btn:disabled { filter: saturate(0.55); opacity: 0.6; transform: none; }
.wk-link { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.03em; color: #5a6b85; }
.wk-round { display: flex; align-items: center; justify-content: center; border-radius: 999px; color: #4F88E8; -webkit-tap-highlight-color: transparent;
  background: #fff; box-shadow: 0 0 0 1.5px #DDEBFF, 0 3px 0 #D3E2F8, 0 8px 14px -8px rgba(16,27,46,0.3);
  transition: transform 80ms ease-out, box-shadow 80ms ease-out, opacity 150ms; }
.wk-round:active { transform: translateY(2px); box-shadow: 0 0 0 1.5px #DDEBFF, 0 1px 0 #D3E2F8; }
.wk-seg { display: flex; padding: 3px; border-radius: 999px; background: #E3EEFF; box-shadow: inset 0 1px 3px rgba(16,27,46,0.12); }
.wk-seg > button { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.03em; flex: 1 1 auto; border-radius: 999px; color: #6b7d99;
  white-space: nowrap; -webkit-tap-highlight-color: transparent; transition: color 120ms; }
.wk-seg > button[aria-pressed="true"] { color: #fff; background: linear-gradient(180deg, #84B6FF 0%, #5A95F5 100%); text-shadow: 0 1px 0 rgba(30,70,150,0.3);
  box-shadow: 0 2px 0 #3F78DB, 0 4px 8px -3px rgba(63,120,219,0.5); }
.wk-hud { color: #fff; border-radius: 14px; background: linear-gradient(180deg, #2A3852 0%, #101B2E 100%);
  box-shadow: 0 3px 0 rgba(16,27,46,0.25), inset 0 1px 0 rgba(255,255,255,0.12); }
.wk-hud.wk-hud-blue { background: linear-gradient(180deg, #84B6FF 0%, #5A95F5 100%); box-shadow: 0 3px 0 #3F78DB, inset 0 1px 0 rgba(255,255,255,0.25); }
.wk-hud.wk-hud-red { background: linear-gradient(180deg, #ff8a9a 0%, #FF5488 100%); box-shadow: 0 3px 0 #d23a6a, inset 0 1px 0 rgba(255,255,255,0.25); }
.wk-hud-label { font: 800 9px/1 var(--font-geist-sans), system-ui, sans-serif; letter-spacing: 0.09em; text-transform: uppercase; color: rgba(214,228,250,0.75); }
.wk-hud-blue .wk-hud-label, .wk-hud-red .wk-hud-label { color: rgba(255,255,255,0.88); }
.wk-tag { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.02em; color: #fff; border-radius: 999px; white-space: nowrap;
  background-image: linear-gradient(180deg, rgba(255,255,255,0.22), rgba(255,255,255,0) 60%); text-shadow: 0 1px 0 rgba(0,0,0,0.18);
  box-shadow: 0 3px 8px -3px rgba(16,27,46,0.35), inset 0 1px 0 rgba(255,255,255,0.3); }
.wk-tag.wk-tag-light { color: #4F88E8; text-shadow: none; background: #fff; box-shadow: 0 0 0 1.5px #DDEBFF, 0 3px 8px -4px rgba(16,27,46,0.25); }
.wk-input { border: 2px solid #DDEBFF; background: #fff; border-radius: 14px; color: #101B2E; box-shadow: inset 0 1px 2px rgba(16,27,46,0.06); }
.wk-input:focus { border-color: #6FA8FF; outline: none; }
.wk-step { font-family: ${GAME_FONT}; font-weight: 400; color: #fff; border-radius: 999px; background: linear-gradient(180deg, #84B6FF, #5A95F5);
  box-shadow: 0 2px 0 #3F78DB; text-shadow: 0 1px 0 rgba(30,70,150,0.3); }
.wk-card { background: #fff; border-radius: 18px; box-shadow: 0 0 0 1.5px #DDEBFF, 0 12px 24px -14px rgba(16,27,46,0.35); }
.wk-pulse { animation: wk-pulse 1.8s ease-in-out infinite; } .wk-pulse:active { animation: none; }
@keyframes wk-pulse { 0%, 100% { scale: 1 } 50% { scale: 1.035 } }
.wk-rays { background: repeating-conic-gradient(from 0deg, rgba(255,205,40,0.5) 0deg 9deg, rgba(255,205,40,0) 9deg 22.5deg);
  -webkit-mask: radial-gradient(circle, #000 18%, transparent 68%); mask: radial-gradient(circle, #000 18%, transparent 68%); animation: wk-spin 16s linear infinite; }
@keyframes wk-spin { to { transform: rotate(360deg) } }
.wk-best { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.03em; color: #101B2E;
  background: linear-gradient(180deg, #FFEF7A 0%, #FFE65C 35%, #FFB618 100%); clip-path: polygon(0 0, 100% 0, calc(100% - 11px) 50%, 100% 100%, 0 100%, 11px 50%); }
.wk-dot { animation: wk-dot 1s ease-in-out infinite; } @keyframes wk-dot { 0%, 100% { opacity: 0.25 } 50% { opacity: 1 } }
}`;
