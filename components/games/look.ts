// The games' frame look, as plain CSS: the kit (components/games/kit.tsx) puts it on every game page and the games hub
// (app/games/page.tsx) uses it too, so the launcher and the games share one set of panels, buttons, badges and HUD chips.
// Kept out of the kit so a server component can import it. Values match Fridge Raid and Kitchen Golf (golf/skin.ts):
// navy #0E1F45 to #16336C, brand blue #5C9BF2 to #3F7FD6 (lip #2A5BA8), go-green #46D98C to #22A964 (lip #167A45),
// yellow #FFE65C to #FFB618 (lip #B86E00).
import { GAME_FONT } from "./gameFont";

// In the components layer, so a Tailwind class on the same element still wins (sizes, margins, widths).
export const KIT_CSS = `@layer components {
.wk-f { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.02em; }
.wk-backdrop { background: radial-gradient(120% 90% at 50% 45%, rgba(14,31,69,0.36) 0%, rgba(8,18,44,0.68) 100%); }
.wk-backdrop-soft { background: radial-gradient(120% 90% at 50% 45%, rgba(14,31,69,0.12) 0%, rgba(8,18,44,0.42) 100%); }
.wk-panel { position: relative; color: #0E1F45; border-radius: 26px; background: linear-gradient(180deg, #ffffff 0%, #eef4ff 100%);
  box-shadow: 0 0 0 3px #16336C, 0 7px 0 3px #0E1F45, 0 22px 44px -10px rgba(4,10,30,0.6); }
.wk-plate { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.03em; color: #fff; text-shadow: 0 2px 0 rgba(4,10,30,0.45);
  background: linear-gradient(180deg, #2c58ab 0%, #16336C 70%, #12295a 100%); box-shadow: inset 0 -3px 0 rgba(4,10,30,0.28), inset 0 1px 0 rgba(255,255,255,0.18); }
.wk-pop { animation: wk-pop 280ms cubic-bezier(.2,.9,.3,1.25) both; }
@keyframes wk-pop { 0% { opacity: 0; transform: scale(0.86) translateY(10px) } 60% { opacity: 1; transform: scale(1.03) } 100% { opacity: 1; transform: none } }
.wk-btn { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.02em; position: relative; isolation: isolate; display: flex; align-items: center;
  justify-content: center; gap: 8px; border-radius: 16px; line-height: 1.1; -webkit-tap-highlight-color: transparent;
  transition: transform 80ms ease-out, box-shadow 80ms ease-out, filter 120ms; }
.wk-btn::after { content: ""; position: absolute; left: 7px; right: 7px; top: 3px; height: 42%; border-radius: 12px 12px 8px 8px;
  background: linear-gradient(180deg, rgba(255,255,255,0.36), rgba(255,255,255,0)); pointer-events: none; z-index: -1; }
.wk-blue { color: #fff; background: linear-gradient(180deg, #5C9BF2 0%, #3F7FD6 100%); text-shadow: 0 2px 0 rgba(22,60,130,0.45);
  box-shadow: 0 4px 0 #2A5BA8, 0 9px 14px -7px rgba(14,31,69,0.5); }
.wk-go { color: #fff; background: linear-gradient(180deg, #46D98C 0%, #22A964 100%); text-shadow: 0 2px 0 rgba(10,90,50,0.45);
  box-shadow: 0 5px 0 #167A45, 0 10px 16px -7px rgba(14,69,40,0.55); }
.wk-yellow { color: #0E1F45; background: linear-gradient(180deg, #FFE65C 0%, #FFB618 100%); box-shadow: 0 4px 0 #B86E00, 0 9px 14px -7px rgba(14,31,69,0.45); }
.wk-light { color: #2A62C4; background: linear-gradient(180deg, #ffffff 0%, #e4eeff 100%);
  box-shadow: 0 4px 0 #a9c1e8, 0 9px 14px -9px rgba(14,31,69,0.4), inset 0 0 0 1.5px rgba(63,127,214,0.2); }
.wk-navy { color: #fff; background: linear-gradient(180deg, #2c58ab 0%, #0E1F45 100%); text-shadow: 0 2px 0 rgba(4,10,30,0.4);
  box-shadow: 0 4px 0 #050c1f, 0 9px 14px -7px rgba(4,10,30,0.5); }
.wk-light::after { display: none; }
.wk-blue:active, .wk-yellow:active, .wk-navy:active { transform: translateY(3px); }
.wk-blue:active { box-shadow: 0 1px 0 #2A5BA8; } .wk-yellow:active { box-shadow: 0 1px 0 #B86E00; } .wk-navy:active { box-shadow: 0 1px 0 #050c1f; }
.wk-go:active { transform: translateY(4px); box-shadow: 0 1px 0 #167A45; }
.wk-light:active { transform: translateY(3px); box-shadow: 0 1px 0 #a9c1e8, inset 0 0 0 1.5px rgba(63,127,214,0.2); }
.wk-btn:disabled { filter: saturate(0.55); opacity: 0.6; transform: none; }
.wk-link { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.03em; color: #5a6b85; }
.wk-round { display: flex; align-items: center; justify-content: center; border-radius: 999px; color: #16336C; -webkit-tap-highlight-color: transparent;
  background: linear-gradient(180deg, #ffffff 0%, #e3edff 100%); box-shadow: 0 3px 0 #9db6df, 0 7px 10px -6px rgba(14,31,69,0.5), inset 0 0 0 1.5px rgba(22,51,108,0.1);
  transition: transform 80ms ease-out, box-shadow 80ms ease-out, opacity 150ms; }
.wk-round:active { transform: translateY(2px); box-shadow: 0 1px 0 #9db6df, inset 0 0 0 1.5px rgba(22,51,108,0.1); }
.wk-seg { display: flex; padding: 3px; border-radius: 999px; background: #16336C;
  box-shadow: inset 0 2px 4px rgba(4,10,30,0.55), 0 2px 0 rgba(255,255,255,0.7); }
.wk-seg > button { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.03em; flex: 1 1 auto; border-radius: 999px; color: rgba(255,255,255,0.74);
  white-space: nowrap; -webkit-tap-highlight-color: transparent; transition: color 120ms; }
.wk-seg > button[aria-pressed="true"] { color: #0E1F45; background: linear-gradient(180deg, #FFEF7A 0%, #FFE65C 30%, #FFB618 100%);
  box-shadow: 0 2px 0 #B86E00, inset 0 1px 0 rgba(255,255,255,0.65); }
.wk-hud { color: #fff; border-radius: 14px; background: linear-gradient(180deg, #24488f 0%, #16336C 100%);
  box-shadow: 0 3px 0 #0b1a3a, inset 0 1px 0 rgba(255,255,255,0.18); }
.wk-hud.wk-hud-blue { background: linear-gradient(180deg, #5C9BF2 0%, #3F7FD6 100%); box-shadow: 0 3px 0 #2A5BA8, inset 0 1px 0 rgba(255,255,255,0.25); }
.wk-hud.wk-hud-red { background: linear-gradient(180deg, #ff7c84 0%, #e8505b 100%); box-shadow: 0 3px 0 #b33a44, inset 0 1px 0 rgba(255,255,255,0.25); }
.wk-hud-label { font: 800 9px/1 var(--font-geist-sans), system-ui, sans-serif; letter-spacing: 0.09em; text-transform: uppercase; color: rgba(205,224,255,0.8); }
.wk-hud-blue .wk-hud-label, .wk-hud-red .wk-hud-label { color: rgba(255,255,255,0.85); }
.wk-tag { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.02em; color: #fff; border-radius: 999px; white-space: nowrap;
  background-image: linear-gradient(180deg, rgba(255,255,255,0.24), rgba(255,255,255,0) 60%); text-shadow: 0 1px 0 rgba(0,0,0,0.22);
  box-shadow: 0 3px 0 rgba(4,10,30,0.25), inset 0 1px 0 rgba(255,255,255,0.3); }
.wk-tag.wk-tag-light { color: #2A62C4; text-shadow: none; background: linear-gradient(180deg, #ffffff 0%, #e8f0ff 100%); box-shadow: 0 3px 0 #a9c1e8; }
.wk-input { border: 2px solid #c9d8f2; background: #fff; border-radius: 14px; color: #0E1F45; box-shadow: inset 0 2px 0 rgba(14,31,69,0.06); }
.wk-input:focus { border-color: #3F7FD6; outline: none; }
.wk-step { font-family: ${GAME_FONT}; font-weight: 400; color: #fff; border-radius: 999px; background: linear-gradient(180deg, #5C9BF2, #3F7FD6);
  box-shadow: 0 2px 0 #2A5BA8; text-shadow: 0 1px 0 rgba(22,60,130,0.4); }
.wk-card { background: #fff; border-radius: 18px; box-shadow: 0 0 0 2px #16336C, 0 4px 0 2px #0E1F45, 0 12px 22px -12px rgba(4,10,30,0.55); }
.wk-pulse { animation: wk-pulse 1.8s ease-in-out infinite; } .wk-pulse:active { animation: none; }
@keyframes wk-pulse { 0%, 100% { scale: 1 } 50% { scale: 1.035 } }
.wk-rays { background: repeating-conic-gradient(from 0deg, rgba(255,205,40,0.5) 0deg 9deg, rgba(255,205,40,0) 9deg 22.5deg);
  -webkit-mask: radial-gradient(circle, #000 18%, transparent 68%); mask: radial-gradient(circle, #000 18%, transparent 68%); animation: wk-spin 16s linear infinite; }
@keyframes wk-spin { to { transform: rotate(360deg) } }
.wk-best { font-family: ${GAME_FONT}; font-weight: 400; letter-spacing: 0.03em; color: #0E1F45;
  background: linear-gradient(180deg, #FFEF7A 0%, #FFE65C 35%, #FFB618 100%); clip-path: polygon(0 0, 100% 0, calc(100% - 11px) 50%, 100% 100%, 0 100%, 11px 50%); }
.wk-dot { animation: wk-dot 1s ease-in-out infinite; } @keyframes wk-dot { 0%, 100% { opacity: 0.25 } 50% { opacity: 1 } }
}`;
