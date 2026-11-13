// Kitchen Golf's game panels and buttons (the HTML overlays), in the same studio look as the canvas HUD: the display
// face, white panels with a soft pale blue edge (WhatYouAte colours), and buttons with a darker bottom lip and a soft gloss. `kg-skin`
// wraps the shared kit cards (Get Ready, Paused, the game-over card) so they pick up the same look without changing
// the kit.
import { GAME_FONT, GAME_FONT_CSS } from "../gameFont";

const F = GAME_FONT;
const B = (c: string) => c.replace(/[[\]#/.:]/g, m => `\\${m}`);   // a Tailwind class as a CSS selector
const BLUE_BTN = `button.${B("bg-[#3f7fd6]")}`, LIGHT_BTN = `button.${B("bg-[#e3effe]")}`, PANEL = `.rounded-3xl.bg-white`;

const btn = `
  font-family: ${F}; font-weight: 400; letter-spacing: 0.02em; position: relative; isolation: isolate; border-radius: 999px;
  transition: transform 80ms ease-out, box-shadow 80ms ease-out, filter 120ms;`;
const blue = `color: #fff; background: linear-gradient(180deg, #84B6FF 0%, #5A95F5 100%);
  box-shadow: 0 5px 0 #3F78DB, 0 10px 18px -8px rgba(63,120,219,0.55), inset 0 2px 0 rgba(255,255,255,0.3);
  text-shadow: 0 1px 0 rgba(30,70,150,0.35);`;
const light = `color: #4F88E8; background: #ffffff;
  box-shadow: 0 0 0 1.5px #DDEBFF, 0 4px 0 #D3E2F8, 0 10px 16px -10px rgba(16,27,46,0.25);`;
const gloss = `content: ""; position: absolute; left: 9%; right: 9%; top: 3px; height: 42%; border-radius: 999px;
  background: linear-gradient(180deg, rgba(255,255,255,0.5), rgba(255,255,255,0)); pointer-events: none; z-index: -1;`;
const panel = `background: #ffffff; color: #101B2E; border-radius: 28px;
  box-shadow: 0 0 0 1.5px #DDEBFF, 0 24px 48px -16px rgba(16,27,46,0.38), 0 4px 10px -4px rgba(16,27,46,0.12);`;

export const KG_CSS = `${GAME_FONT_CSS}
.kg-f { font-family: ${F}; font-weight: 400; letter-spacing: 0.02em; }
.kg-panel { ${panel} }
.kg-backdrop { background: radial-gradient(120% 90% at 50% 45%, rgba(16,27,46,0.22) 0%, rgba(16,27,46,0.5) 100%); }
.kg-btn { ${btn} ${blue} }
.kg-btn-2 { ${btn} ${light} }
.kg-btn-y { ${btn} color: #0E1F45; background: linear-gradient(180deg, #FFF07A 0%, #FFE65C 35%, #FFB618 100%);
  box-shadow: 0 5px 0 #D99410, 0 10px 18px -8px rgba(217,148,16,0.5), inset 0 2px 0 rgba(255,255,255,0.55); }
.kg-btn::after, .kg-btn-2::after, .kg-btn-y::after { ${gloss} }
.kg-btn:active, .kg-btn-y:active { transform: translateY(4px); box-shadow: 0 1px 0 #3F78DB, inset 0 2px 0 rgba(255,255,255,0.3); }
.kg-btn-y:active { box-shadow: 0 1px 0 #D99410, inset 0 2px 0 rgba(255,255,255,0.5); }
.kg-btn-2:active { transform: translateY(3px); box-shadow: 0 0 0 1.5px #DDEBFF, 0 1px 0 #D3E2F8; }
.kg-btn:disabled, .kg-btn-2:disabled { filter: saturate(0.6); opacity: 0.75; transform: none; }
.kg-link { font-family: ${F}; font-weight: 400; letter-spacing: 0.02em; color: #5a6b85; }
.kg-input { border: 2px solid #DDEBFF; background: #fff; border-radius: 14px; box-shadow: inset 0 2px 0 rgba(14,31,69,0.06); }
.kg-input:focus { border-color: #6FA8FF; outline: none; }
.kg-ribbon { background: linear-gradient(180deg, #84B6FF 0%, #5A95F5 100%); box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), 0 3px 0 #3F78DB; }
@keyframes kg-pop { 0% { opacity: 0; transform: scale(0.86) translateY(8px) } 60% { opacity: 1; transform: scale(1.03) } 100% { opacity: 1; transform: none } }
.kg-pop { animation: kg-pop 260ms cubic-bezier(.2,.9,.3,1.2) both; }

/* the shared kit cards, inside .kg-skin */
.kg-skin > div:not(.kg-keep) { background: radial-gradient(120% 90% at 50% 45%, rgba(16,27,46,0.22) 0%, rgba(16,27,46,0.5) 100%); }
.kg-skin ${PANEL} { ${panel} }
.kg-skin ${PANEL} .text-xl.font-bold, .kg-skin ${PANEL} .text-4xl, .kg-skin ${PANEL} .text-base.font-bold { font-family: ${F}; font-weight: 400; letter-spacing: 0.02em; }
.kg-skin ${PANEL} .text-xl.font-bold { font-size: 26px; line-height: 1.15; }
.kg-skin ${PANEL} .text-4xl { font-size: 42px; line-height: 1.1; color: #101B2E; }
.kg-skin ${PANEL} .text-base.font-bold { font-size: 18px; line-height: 1.2; }
.kg-skin ${BLUE_BTN} { ${btn} ${blue} font-size: 18px; }
.kg-skin ${LIGHT_BTN} { ${btn} ${light} font-size: 17px; }
.kg-skin ${BLUE_BTN}::after, .kg-skin ${LIGHT_BTN}::after { ${gloss} }
.kg-skin ${BLUE_BTN}:active { transform: translateY(4px); box-shadow: 0 1px 0 #3F78DB, inset 0 2px 0 rgba(255,255,255,0.3); }
.kg-skin ${LIGHT_BTN}:active { transform: translateY(3px); box-shadow: 0 0 0 1.5px #DDEBFF, 0 1px 0 #D3E2F8; }
.kg-skin ${BLUE_BTN}:disabled { ${light} text-shadow: none; transform: none; }
.kg-skin ${LIGHT_BTN}.rounded-2xl { border-radius: 18px; font-size: 15px; }
.kg-skin a.${B("bg-[#101b2e]")} { font-family: ${F}; font-weight: 400; letter-spacing: 0.03em; font-size: 15px;
  background: linear-gradient(180deg, #2A3852 0%, #101B2E 100%); box-shadow: 0 4px 0 #050a14, inset 0 1px 0 rgba(255,255,255,0.12); }
.kg-skin button.wya-pulse { font-family: ${F}; font-weight: 400; letter-spacing: 0.02em; font-size: 18px; }
.kg-skin ${PANEL} > .${B("text-[#5a6b85]")}.font-semibold.text-sm:first-child { font-family: ${F}; font-weight: 400; letter-spacing: 0.04em; color: #4F88E8; }
`;
