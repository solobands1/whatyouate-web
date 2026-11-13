// Kitchen Golf's game panels and buttons (the HTML overlays), in the WhatYouAte look (the site's Geist,
// flat white panels with a hairline pale blue edge, and buttons with a darker bottom lip and a soft gloss. `kg-skin`
// wraps the shared kit cards (Get Ready, Paused, the game-over card) so they pick up the same look without changing
// the kit.
import { FRAME_FONT, GAME_FONT_CSS } from "../gameFont";

const F = FRAME_FONT;
const B = (c: string) => c.replace(/[[\]#/.:]/g, m => `\\${m}`);   // a Tailwind class as a CSS selector
const BLUE_BTN = `button.${B("bg-[#3f7fd6]")}`, LIGHT_BTN = `button.${B("bg-[#e3effe]")}`, PANEL = `.rounded-3xl.bg-white`;

const btn = `
  font-family: ${F}; font-weight: 600; letter-spacing: -0.01em; position: relative; border-radius: 999px;
  transition: transform 90ms ease-out, background-color 120ms, box-shadow 120ms, opacity 120ms;`;
const blue = `color: #fff; background: #6FA8FF; box-shadow: 0 12px 26px -12px rgba(79,136,232,0.85); text-shadow: none;`;
const light = `color: #4F88E8; background: #ffffff; box-shadow: 0 0 0 1px #DCE8FA, 0 8px 18px -12px rgba(31,70,140,0.3);`;
const gloss = `display: none;`;
const panel = `background: #ffffff; color: #101B2E; border-radius: 28px;
  box-shadow: 0 0 0 1px rgba(111,168,255,0.18), 0 30px 70px -28px rgba(31,70,140,0.45);`;

export const KG_CSS = `${GAME_FONT_CSS}
.kg-f { font-family: ${F}; font-weight: 700; letter-spacing: -0.02em; }
.kg-panel { ${panel} }
.kg-backdrop { background: rgba(16,27,46,0.32); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.kg-btn { ${btn} ${blue} }
.kg-btn-2 { ${btn} ${light} }
.kg-btn-y { ${btn} color: #fff; background: #101B2E; box-shadow: 0 12px 26px -12px rgba(16,27,46,0.6); }
.kg-btn::after, .kg-btn-2::after, .kg-btn-y::after { ${gloss} }
.kg-btn:active, .kg-btn-y:active, .kg-btn:active { background: #5E9BF7; } .kg-btn-2:active { background: #F4F8FF; }
.kg-btn:active { background: #5E9BF7; } .kg-btn-2:active { background: #F4F8FF; }
.kg-btn:disabled, .kg-btn-2:disabled { opacity: 0.5; transform: none; }
.kg-link { font-family: ${F}; font-weight: 600; letter-spacing: -0.01em; color: #5a6b85; }
.kg-input { border: 1px solid #DCE8FA; background: #fff; border-radius: 14px; }
.kg-input:focus { border-color: #6FA8FF; box-shadow: 0 0 0 3px rgba(111,168,255,0.2); outline: none; }
.kg-ribbon { background: #6FA8FF; box-shadow: 0 8px 18px -10px rgba(79,136,232,0.9); }
@keyframes kg-pop { 0% { opacity: 0; transform: scale(0.86) translateY(8px) } 60% { opacity: 1; transform: scale(1.03) } 100% { opacity: 1; transform: none } }
.kg-pop { animation: kg-pop 260ms cubic-bezier(.2,.9,.3,1.2) both; }

/* the shared kit cards, inside .kg-skin */
.kg-skin > div:not(.kg-keep) { background: rgba(16,27,46,0.32); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); }
.kg-skin ${PANEL} { ${panel} }
.kg-skin ${PANEL} .text-xl.font-bold, .kg-skin ${PANEL} .text-4xl, .kg-skin ${PANEL} .text-base.font-bold { font-family: ${F}; font-weight: 700; letter-spacing: -0.02em; }
.kg-skin ${PANEL} .text-xl.font-bold { font-size: 26px; line-height: 1.15; }
.kg-skin ${PANEL} .text-4xl { font-size: 42px; line-height: 1.1; color: #101B2E; }
.kg-skin ${PANEL} .text-base.font-bold { font-size: 18px; line-height: 1.2; }
.kg-skin ${BLUE_BTN} { ${btn} ${blue} font-size: 18px; }
.kg-skin ${LIGHT_BTN} { ${btn} ${light} font-size: 17px; }
.kg-skin ${BLUE_BTN}::after, .kg-skin ${LIGHT_BTN}::after { ${gloss} }
.kg-skin ${BLUE_BTN}:active { transform: scale(0.97); background: #5E9BF7; }
.kg-skin ${LIGHT_BTN}:active { transform: scale(0.97); background: #F4F8FF; }
.kg-skin ${BLUE_BTN}:disabled { ${light} text-shadow: none; transform: none; }
.kg-skin ${LIGHT_BTN}.rounded-2xl { border-radius: 18px; font-size: 15px; }
.kg-skin a.${B("bg-[#101b2e]")} { font-family: ${F}; font-weight: 700; letter-spacing: -0.01em; font-size: 15px;
  background: #101B2E; box-shadow: 0 12px 26px -12px rgba(16,27,46,0.6); }
.kg-skin button.wya-pulse { font-family: ${F}; font-weight: 700; letter-spacing: -0.02em; font-size: 18px; }
.kg-skin ${PANEL} > .${B("text-[#5a6b85]")}.font-semibold.text-sm:first-child { font-family: ${F}; font-weight: 700; letter-spacing: 0.1em; color: #6F86A8; text-transform: uppercase; font-size: 12px; }
`;
