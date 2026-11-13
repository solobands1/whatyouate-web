// Blenders & Bacon's animations (tokens, the die, cards, the turn pop). The panels and buttons come from the shared kit
// (KIT_CSS in ../look, put on the page by GameScreen), so the game's cards match every other game's.
import { GAME_FONT_CSS } from "../gameFont";

export const BB_CSS = `${GAME_FONT_CSS}
/* the board's moving parts */
.bb-tok { will-change: transform; transition: transform 260ms cubic-bezier(.3,1.3,.5,1); }
.bb-tok-in { will-change: transform; }
.bb-ring { animation: bb-ring 1.3s ease-out infinite; }
@keyframes bb-ring { 0% { transform: scale(0.8); opacity: 0.85 } 100% { transform: scale(1.55); opacity: 0 } }
.bb-bob { animation: bb-bob 1.1s ease-in-out infinite; }
@keyframes bb-bob { 0%, 100% { transform: translateY(0) } 50% { transform: translateY(-7%) } }
.bb-arrow { animation: bb-arrow 0.9s ease-in-out infinite; }
@keyframes bb-arrow { 0%, 100% { transform: translate(-50%, 0) } 50% { transform: translate(-50%, -22%) } }
.bb-vortex { animation: bb-spin 0.32s linear infinite; }
@keyframes bb-spin { to { transform: rotate(360deg) } }
.bb-shake { animation: bb-shake 0.11s linear infinite; }
@keyframes bb-shake { 0% { transform: translate(0, 0) } 25% { transform: translate(-1.6px, 0.6px) } 50% { transform: translate(1.4px, -0.6px) } 75% { transform: translate(-0.8px, -0.8px) } 100% { transform: translate(0, 0) } }
.bb-glow { animation: bb-glow 0.9s ease-in-out forwards; }
@keyframes bb-glow { 0% { opacity: 0 } 25% { opacity: 1 } 100% { opacity: 0 } }
.bb-dash { animation: bb-dash 0.9s linear infinite; }
@keyframes bb-dash { to { stroke-dashoffset: -64 } }
.bb-sheen { animation: bb-sheen var(--d, 0.9s) cubic-bezier(.5,0,.6,1) forwards; }
@keyframes bb-sheen { from { stroke-dashoffset: 0 } to { stroke-dashoffset: var(--len) } }
.bb-turnpop { display: inline-block; animation: bb-turnpop 1.15s cubic-bezier(.2,.9,.3,1) forwards; }
@keyframes bb-turnpop { 0% { transform: scale(0.4) rotate(-4deg); opacity: 0 } 18% { transform: scale(1.12) rotate(-3deg); opacity: 1 } 28% { transform: scale(1) rotate(-3deg) } 78% { transform: scale(1) rotate(-3deg); opacity: 1 } 100% { transform: scale(1.06) rotate(-3deg); opacity: 0 } }
.bb-cardfx { animation: bb-cardfx var(--d, 1.25s) cubic-bezier(.2,.9,.3,1) forwards; }
@keyframes bb-cardfx { 0% { transform: translate(var(--fx, 0px), var(--fy, 0px)) scale(0.3) rotate(-14deg); opacity: 0 } 22% { transform: translate(0, 0) scale(1.08) rotate(3deg); opacity: 1 }
  32% { transform: translate(0, 0) scale(1) rotate(0deg) } 76% { transform: translate(0, 0) scale(1) rotate(0deg); opacity: 1 } 100% { transform: translate(var(--tx, 0px), var(--ty, 140px)) scale(0.35) rotate(8deg); opacity: 0 } }
.bb-cardlabel { animation: bb-cardlabel var(--d, 1.25s) ease-out forwards; }
@keyframes bb-cardlabel { 0%, 18% { opacity: 0; transform: translateY(8px) } 30% { opacity: 1; transform: translateY(0) } 74% { opacity: 1 } 90%, 100% { opacity: 0 } }
.bb-slotpop { animation: bb-slotpop 0.45s cubic-bezier(.3,1.6,.5,1); }
@keyframes bb-slotpop { 0% { transform: scale(0.4); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
.bb-lift { transform: translateY(-7px) rotate(-2deg); }
.bb-dieout { animation: bb-dieout 0.22s ease-in forwards; }
@keyframes bb-dieout { to { opacity: 0; transform: scale(0.6) } }
.bb-diein { animation: bb-diein 0.18s ease-out; }
@keyframes bb-diein { from { opacity: 0 } }
.bb-dot { animation: bb-dot 1s ease-in-out infinite; }
@keyframes bb-dot { 0%, 100% { opacity: 0.25 } 50% { opacity: 1 } }
.bb-float { animation: bb-float 1.1s ease-out forwards; }
@keyframes bb-float { 0% { opacity: 0; transform: translate(-50%, 6px) scale(0.7) } 20% { opacity: 1; transform: translate(-50%, 0) scale(1.05) } 30% { transform: translate(-50%, 0) scale(1) } 75% { opacity: 1 } 100% { opacity: 0; transform: translate(-50%, -26px) } }
.bb-pulse { animation: bb-pulse 1.6s ease-in-out infinite; }
@keyframes bb-pulse { 0%, 100% { transform: scale(1) } 50% { transform: scale(1.035) } }
.bb-pop { animation: bb-pop 260ms cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes bb-pop { 0% { opacity: 0; transform: scale(0.86) translateY(8px) } 60% { opacity: 1; transform: scale(1.03) } 100% { opacity: 1; transform: none } }
`;
