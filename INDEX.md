# Saddlebags — file map

Hand-written manifest, not a search tool. Grep this before opening a whole file.
Line numbers are a snapshot at split time (2026-07-04) and will drift as the
files are edited — treat them as "roughly here," and re-grep the symbol name
if a number looks off.

Load order (see `index.html` bottom): **data.js → engine.js → game.js**. Each
later file depends on globals defined by the earlier ones; there's no module
system, everything shares one global scope.

## index.html
The shell only: `<head>` meta/fonts, `<link>` to styles.css, and the static
DOM the game manipulates — `#app`, `#cv` (the canvas), `#topbar`, `#departBtn`,
`#hint`, `#toast`, the `#title`/`#results`/`#shop` screens, and `#card` (the
encounter popup). No logic lives here. Script tags at the bottom load the
three JS files in dependency order.

## styles.css
All CSS, unchanged from the old inline `<style>` block. Organized by the
comment headers already in the file: root vars/reset, top bar, buttons,
screens, encounter card, results tally, shop, toast & hint.

## data.js (~293 lines)
Foundational layer with no dependency on canvas/DOM state. Loaded first.

- **Utils** (`~L6-13`): `$`, `clamp`, `lerp`, `rand`, `randi`, `choice`, `TAU`,
  `shuffled`. Also the `roundRect` canvas polyfill.
- **Save system** (`~L15-38`): `Store` (localStorage wrapper that falls back
  to an in-memory object on Safari file:// errors), `defaultSave()`, the
  `SV` save-state object, `save()`.
- **Sound** (`~L41-77`): tiny WebAudio synth object. Methods are named per
  sound effect (`click`, `pop`, `stow`, `coin`, `munch`, `whoosh`, `err`,
  `sad`, `heart`, `clip`, `fanfare`, `spark`) rather than by waveform — look
  here first when a sound cue needs tweaking.
- **DATA tables** (`~L78-293`): this is the bulk of the file and the part
  most likely to be hand-edited for balance/content:
  - `ITEMS` — every packable item: emoji, name, footprint (`w`/`fw`/`fh`),
    `food` value (if it feeds Biscuit), `sell` price.
  - `RARE_WEIGHTS` — spawn-rarity multipliers for the belt (lower = rarer).
  - `EVENTS` — every road encounter: icon/title/desc + `opts` array (each
    option is either `item`-gated, `risky` with `good`/`bad` outcomes, or
    `skip`). `special:'trade'` / `special:'chest'` events are hardcoded
    elsewhere (see `showEventCard` in game.js).
  - `REGIONS` — the 5 delivery destinations: event `pool`, possible `orders`,
    sky/ground colors, `prop` (which mid-layer scenery set `drawMid` uses).
  - Cosmetics: `COATS`, `MANES`, `RAINBOW`, `BEAKS`, `HATS`, `BLANKETS`,
    `TRAILS` — all shop-purchasable horse/toucan cosmetics, keyed by id with
    a `price`.
  - `GEAR` — the 6 gameplay-affecting upgrades (bags, saddle, shoe, spy,
    pouch, charm), each with a `ds(level)` describer function used in the
    shop UI.
  - `MOODS` — the 5 mood emoji, indexed `mood+2` (mood ranges -2..2).

## engine.js (~725 lines)
Canvas setup, the live game-state object, all drawing, and the render loop.
No game-rule logic (event resolution, coin math, etc.) — that's game.js.

- **Canvas/layout** (`~L5-36`): `cv`/`ctx`, `resize()`, the `L` layout object
  (recomputed every resize by `computeLayout()` — this is where every
  screen-space position/size constant lives: belt Y, bag panel rects, horse
  position per scene, etc).
- **`G`** (`~L37-52`): the single mutable game-state object — `state`
  (title/pack/journey/results/shop), day/region/tier, order, bags
  (`bagL`/`bagR`), mood/hearts, patience (`pat`), belt contents, the toucan
  (`tou`) FSM fields, journey fields (`wx`, `nodes`, `jstate`), particles,
  `viewBags` (Chunk F's journey bag-viewer toggle).
- **Particles** (`~L53-84`): `pText/pCoin/pPoof/pHeart/pSpark/pConfetti/pDust`
  spawn into `G.parts`; `updateParts`/`drawParts` simulate & render them.
- **Character art** (`~L86-312`): `drawHat` (per-hat-id canvas paths),
  `drawHorse` (Biscuit — body/legs/mane/tail/head/saddle, all procedural
  canvas paths, no images), `drawToucan` (Pip, same approach — `rot`/`face`
  params let callers spin/mirror it, used by Chunk G's improvise stunt).
- **Scene helpers** (`~L313-660`): `skyGrad`, `drawCloud`, `hash` (seeded
  pseudo-random for parallax placement), `drawBunting`, `drawPackScene` +
  `drawBeltItem` (conveyor belt + crates), bag-grid logic (`bagDims`, `bagW`,
  `bagGridOcc`, `fitInto` — the packing-grid fit algorithm, already generic
  over any w×h footprint, not just 1×1/2×1/2×2 — lives here; `bagLayout`
  factors out the shared cell/gx/gy math, `bagItemAt` hit-tests a stowed
  item for Chunk F's rearrange, `drawBagPanel`), `drawJourneyScene` (also
  draws the 🎒 bag-viewer overlay — Chunk F — when `G.viewBags` is set),
  `drawWeather`, `spawnTrail` (Pip's particle trail — anchored via
  `pipJourneyPos`, Chunk G), `startPipStunt`/`pipStuntOffset`/`pipJourneyPos`
  (Pip's loop-or-dance flourish when a risky choice is taken, and the single
  source of truth for Pip's on-road position), `drawFar`/`drawMid` (parallax
  scenery per region `prop`), `drawLandmark` (event icons on the road — now
  vector badges, Chunk H), `drawMeadowIdle` (title-screen scene).
- **Render dispatch + loop** (`~L662-725`): `render()` switches on `G.state`
  to draw the right scene; `frame(ts)` is the `requestAnimationFrame` loop
  that drives `updatePack`/`updateJourney`/`updateTou`/`updateParts` (those
  update fns are defined in game.js/engine.js respectively) then calls
  `render()`.

## game.js (~679 lines)
The state machine: HUD, packing interactions, journey/encounter resolution,
shop, and boot. This is where gameplay rules and balancing math live
(payouts, risk %, day scaling) — Chunks B-F mostly land here.

- **HUD** (`~L15-160`): inventory helpers (`countItem`, `removeItem`,
  `heaviestItem`, `eachPacked`), `riskP()` (risky-event success chance),
  `updateTopbar` (renders the pill bar differently per `G.state`; adds a
  🎒 `bagBtn` during `journey` — Chunk F's bag viewer), `toggleBagView`
  (flips `G.viewBags`), `updateDepartBtn` (lopsided-bag warning).
- **Day setup** (`~L35-97`): `buildDay()` — picks region/tier, order size
  (Chunk C's "3 apples" change lands in the `oSize` line here), builds the
  route's event nodes and fork options, resets day state. `buildBeltPool()`/
  `pickBeltItem()` — weighted belt spawn pool, boosted toward
  order/route-relevant items.
- **Tutorial** (`~L171-191`): `showTutStep`, `tutAdvance` — the 4-step
  first-day-only hint sequence.
- **Pack-phase loop** (`~L192-222`): `updatePack(dt)` — belt spawn/scroll,
  want/useful badge flags, patience countdown.
- **Toucan FSM** (`~L223-287`): `touGoto` (tweened move-to with callback),
  `updateTou`, `grabItem`, `stowTo` (bag-fit check + placement), `pickupFromBag`
  (Chunk F: lifts an already-stowed item back into `G.held` so it can be
  re-stowed elsewhere, mirroring `grabItem`'s flow), `feedHorse`, `tossHeld`.
- **Input routing** (`~L288-329`): `handleTap(x,y)` — hit-tests belt items,
  bag panels, the toss-X, and the horse's mouth, depending on toucan mode.
- **Depart/journey** (`~L330-396`): `depart()`, `updateJourney(dt)` (trot
  speed/burst, spill-on-lopsided-bags check, node arrival), `openNode`,
  `resumeTrot`.
- **Route plan card** (`~L397-420`): `showRouteCard` — the pack-phase
  "scouting report" popup.
- **Encounter resolution** (`~L421-518`): `showEventCard` (builds the option
  buttons incl. `special:'trade'`/`'chest'` one-offs; the `o.item` branch has
  an 82% success roll — Chunk E — falling back to a 0-coin/-1-heart line from
  `ITEM_FAILS` on a miss; the risky branch also calls `startPipStunt()` so
  Pip loops/dances while the card resolves), `addToBags`, `applyOutcome`
  (coin/heart math + particles — morale swings render as green/red ▲▼, not
  hearts), `outcome` (renders the result text then auto-resumes),
  `showForkCard`/`FORK_FLAVORS` (now 4 options, from `G.forkOpts` — built in
  `buildDay`), `pickFork`.
- **Results** (`~L519-587`): `arrive()`, `showResults()` — the full day-end
  tally (delivery payout, full-order bonus, odd-melon gamble, leftover
  sell-off, event coins). No morale cash-out row anymore (Chunk D removed
  it); Chunk B's rebalance also lands here.
- **Shop** (`~L588-656`): `TABS`, `openShop`/`closeShop`, `renderShopTabs`,
  `shopSets()` (maps tab id → data.js table), `renderShop` (cosmetics grid +
  gear rows, purchase logic).
- **Boot** (`~L657-679`): `hideAll`, `updateTitleUI`, the title-screen button
  wiring, `window.__sb` debug hook, and the initial `resize()` /
  `requestAnimationFrame(frame)` kickoff that starts everything.

## Known follow-up work (from planning notes)
- ~~Chunk B: belt items need real coin costs; currently free to grab/stow.~~
  Done — `ITEMS[id].cost` in `data.js`, charged against a running
  `G.daySpent` tab in `grabItem` (game.js), settled against `SV.coins` as a
  "Spent on stock" row in `showResults`.
- ~~Chunk C: `buildDay()`'s `oSize` line needs Day 1 = 3 apples, not 1.~~ Done
  — Day 1 now hardcodes `G.order=['apple','apple','apple']`; other days keep
  the old random-`oSize`-from-`opool` path in `buildDay()` (game.js).
- ~~Chunk D: merge `G.mood`/`G.hearts` into one morale stat; remove the
  hearts/mood cash-out bonus in `showResults`; keep `G.pat` (patience/Biscuit
  feeding) separate.~~ Done — `G.mood` is gone; `G.hearts` (0-3) is now the
  sole morale stat, feeding `riskP()` directly (plus a flat `SV.gear.charm`
  bonus, since charm no longer has a starting-mood value to boost) and the
  ❤️/🖤 topbar pips. The mood-face pill, `moodShift()`, and `MOODS` (data.js)
  are deleted; `showResults` no longer has a morale bonus row at all.
- ~~Chunk E: `applyOutcome`'s item-gated branch in `showEventCard` currently
  guarantees success — needs a small fail chance.~~ Done — item-gated
  options now succeed 82% of the time (flat check in `showEventCard`,
  game.js); the item is still consumed on a miss, but it pays 0 coins and
  -1 heart, with a line picked from a new `ITEM_FAILS` array. The button
  subtext says "usually works" instead of implying a sure thing.
- ~~Chunk F: `fitInto`/`stowTo`/`drawBagPanel` need in-bag rearrange, new
  footprint shapes beyond 1×1/2×1/2×2, and a journey-time bag viewer.~~
  Done — tapping an already-stowed item in the pack phase now picks it back
  up (`bagItemAt`/`pickupFromBag`), reusing the existing carry/stow flow to
  move it elsewhere; added `parcel` (📦 Big Parcel, `fw:3`) to `ITEMS`
  (data.js) as a new footprint shape — `fitInto` was already generic over
  any w×h, so no engine change was needed there; a 🎒 topbar button during
  `journey` toggles `G.viewBags`, which draws both bag panels as a dimmed
  overlay in `render()` (tapping the canvas while it's open closes it
  instead of boosting).
- ~~Chunk G: `drawHorse` redraw + `spawnTrail` needs to anchor to Pip's real
  position, not the horse.~~ Done — added `pipJourneyPos()` (engine.js) as the
  single source of truth for Pip's on-road position (base hover formula plus
  an optional stunt offset); both `render()`'s toucan draw and
  `updateJourney`'s `spawnTrail` call now read from it, so the trail spawns
  exactly where Pip is drawn. Also added `startPipStunt`/`pipStuntOffset`
  (`G.stunt`): picking the risky "Pip improvises" option now makes Pip loop
  or dance for ~1s while the card resolves, instead of holding still.
- ~~Chunk H: `drawLandmark`'s event-icon rendering (currently flat emoji) needs
  vector badge art.~~ Done — grounded events now stand on a wooden post +
  round plaque badge (matching the fork/arrive signpost style); weather
  events float on a soft glowing sky badge instead of a bare emoji.
- Morale display: the ❤️/🖤 topbar pips and event +❤️/-❤️ swings are now green/
  grey ▲ (topbar) and green/red ▲/▼ (`.outcome .big` already color-codes by
  `.bad`, so no new CSS needed) — `pMorale` (engine.js) replaces `pHeart` for
  this case only; `pHeart`/`💗` still used for Biscuit's food reaction
  (`feedHorse`) and the Hearts trail cosmetic, which are unrelated concepts.
- Sound: `Sound.coin()` (data.js) reworked from a flat two-tone square-wave
  blip into a brighter ascending triangle "cha-ching" with a short noise
  transient, since it read as an 8-bit arcade blip on every transaction;
  `Sound.click()` switched from square to triangle for the same reason.
  `Sound.clip()` (hoofbeats) was left untouched by request.
- Crossroads: `buildDay()` now sets `G.forkOpts` to 4 unused event ids
  (was 2, `G.forkA`/`G.forkB`); `showForkCard` renders one option per id via
  `FORK_FLAVORS` (icon+label per slot), making a packed 🗺️ Map reveal 4 paths
  instead of 2.
- Pack-phase mobile sizing: belt/crate/text bumped up (`L.beltH` 78→92,
  belt crates 52→60px with larger emoji/price-tag/badge fonts, bag-panel
  cell cap 34→38, bag header/count font +1px, topbar `.pill` font 13.5→14.5px)
  since the conveyor belt read too small on phone screens.
