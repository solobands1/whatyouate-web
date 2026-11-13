// Berry Pong's DOM animations (the turn pop, floating words, the waiting dots, the Same Phone turn-around). The panels
// and buttons come from the shared kit (KIT_CSS in ../look, put on the page by GameScreen).
import { GAME_FONT_CSS } from "../gameFont";

export const BP_CSS = `${GAME_FONT_CSS}
.bp-turnpop { display: inline-block; animation: bp-turnpop 1.15s cubic-bezier(.2,.9,.3,1) forwards; }
@keyframes bp-turnpop { 0% { transform: scale(0.4) rotate(-4deg); opacity: 0 } 18% { transform: scale(1.12) rotate(-3deg); opacity: 1 } 28% { transform: scale(1) rotate(-3deg) } 78% { transform: scale(1) rotate(-3deg); opacity: 1 } 100% { transform: scale(1.06) rotate(-3deg); opacity: 0 } }
.bp-float { animation: bp-float 1.2s ease-out forwards; }
@keyframes bp-float { 0% { opacity: 0; transform: translate(-50%, 6px) scale(0.7) } 18% { opacity: 1; transform: translate(-50%, 0) scale(1.06) } 28% { transform: translate(-50%, 0) scale(1) } 75% { opacity: 1 } 100% { opacity: 0; transform: translate(-50%, -24px) } }
.bp-big { animation: bp-big 1.35s cubic-bezier(.2,.9,.3,1) forwards; }
@keyframes bp-big { 0% { opacity: 0; transform: scale(0.5) } 16% { opacity: 1; transform: scale(1.1) } 26% { transform: scale(1) } 80% { opacity: 1; transform: scale(1) } 100% { opacity: 0; transform: scale(1.04) translateY(-10px) } }
.bp-dot { animation: bp-dot 1s ease-in-out infinite; }
@keyframes bp-dot { 0%, 100% { opacity: 0.25 } 50% { opacity: 1 } }
.bp-flip { animation: bp-flip 560ms ease-in-out forwards; }
@keyframes bp-flip { 0% { opacity: 0 } 45% { opacity: 1 } 100% { opacity: 0 } }
.bp-chip { animation: bp-chip 260ms cubic-bezier(.2,.9,.3,1.2) both; }
@keyframes bp-chip { 0% { opacity: 0; transform: translate(-50%, -6px) scale(0.9) } 100% { opacity: 1; transform: translate(-50%, 0) } }
.bp-flame { animation: bp-flame 0.5s ease-in-out infinite alternate; transform-origin: 50% 90%; }
@keyframes bp-flame { 0% { transform: scale(1, 1) rotate(-3deg) } 100% { transform: scale(0.94, 1.08) rotate(3deg) } }
.bp-pip { transition: opacity 200ms, transform 200ms; }
`;
