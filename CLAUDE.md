# Saddlebags

Mobile pack-and-trot roguelite. Vanilla JS, no build step, no framework, no
package.json. Load order: `data.js` → `engine.js` → `game.js` (plain globals,
no module system) — see the script tags at the bottom of `index.html`.

## Before editing

Read [INDEX.md](INDEX.md) first. It's a hand-written manifest of what lives
where (with line-number hints) and a running log of "Known follow-up work"
(lettered Chunks). Grep for the symbol you need instead of reading a whole
file top to bottom — INDEX.md tells you which file and roughly which lines,
so you don't burn tokens re-scanning ~1700 lines of game.js/engine.js/data.js
every time.

## Style

Smallest diff that solves the task — ponytail rules apply. No new
abstractions, config options, or generalized code paths beyond what's asked;
match the existing procedural-canvas style already in the file. A hardcoded
special case beats reworking shared logic if that's all the task needs.

## After finishing a chunk

Update INDEX.md itself: strike through the finished item under "Known
follow-up work" and add a one-line note of what changed and where. That's
the durable record of project status — don't just state it in chat and
move on.

## Communication

Use caveman mode (ultra-compressed, still technically accurate) while doing
this work, unless the user asks otherwise.
