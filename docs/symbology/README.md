# Military Symbology Reference — Theater Picture

Working reference for rendering doctrinally correct military symbols in the product,
distilled from the primary standard. Spec requirements GEO-3/GEO-4 (affiliation encoded
by frame form; "2525-informed framing" until true SIDC icons render) anchor here.

## Files in this folder

| File | What it is |
|---|---|
| `MIL-STD-2525E-CHG1.pdf` | **The authority.** MIL-STD-2525E w/Change 1, 2 March 2025, DoD Interface Standard "Joint Military Symbology". 749 pp. Distribution A (approved for public release, distribution unlimited). Downloaded from the official DLA ASSIST portal (assist.dla.mil) 2026-09-15 — watermarked on every page. |
| `2525e-milstandard/` | Machine-readable 2525E / APP-6(E) content: TSV tables of every symbol set's entities, types, subtypes, codes, and sector modifiers (2,510 rows). Vendored from [spatialillusions/milstandard-e](https://github.com/spatialillusions/milstandard-e) (MIT). This is the implementation source of truth for icon codes. |

Related standards: NATO **APP-06(E)** is the harmonized NATO twin (2525E §6.3 implements
STANAG 2019). **FM 1-02.2** (Army) is the readable companion volume. Approved Symbology
Change Proposals (SCPs) may be implemented before formal releases (§4.7).

## SIDC structure (2525E — 30 positions, three sets of ten)

2525E extends the 20-digit 2525D code with an optional third set (Appendix A, fig. A-1).
The first 20 positions keep the 2525D layout, which is why 2525D-era renderers still work.

**Set A (positions 1–10):**

| Pos | Element | Values we care about |
|---|---|---|
| 1–2 | Version | `13` = 2525E, `15` = 2525E Chg 1 (Table A-I) |
| 3 | Context | `0` reality, `1` exercise, `2` simulation |
| 4 | Standard identity | `0` Pending, `1` Unknown, `2` Assumed Friend, `3` Friend, `4` Neutral, `5` Suspect/Joker, `6` Hostile/Faker (Table A-II) |
| 5–6 | Symbol set | see table below (Table A-IV) |
| 7 | Status | `0` present, `1` planned/anticipated/suspect, `2` fully capable, `3` damaged, `4` destroyed, `5` full to capacity (Table A-VI) |
| 8 | HQ / Task Force / Dummy | `0` unknown … `2` HQ … `4` Task Force (Table A-VII) |
| 9–10 | Amplifying descriptor | echelon / mobility / towed array / leadership |

**Set B (positions 11–20):** 11–12 entity · 13–14 entity type · 15–16 entity subtype ·
17–18 sector 1 modifier · 19–20 sector 2 modifier. These are the codes in the TSV tables.

**Set C (positions 21–30, new in E):** common-modifier indicators, frame shape,
nationality (GENC numeric, e.g. `840` = US). Optional; safe to omit for rendering.

Worked example from the standard (A.5.4d): `130310021612040100060130000840` =
friend land-unit HQ, battalion echelon, armored antitank unit, wheeled, US.

## Standard identity → frame and color

Identity groups (Table A-III): **Unknown** (pending+unknown), **Friend** (friend+assumed),
**Neutral**, **Hostile** (hostile/faker + suspect/joker).

Frame shapes by group — this is spec GEO-3's "hostile diamond, friendly rectangle,
unknown quatrefoil" (Table I): friend = rectangle (land unit) / circle (sea surface);
hostile = diamond; neutral = square; unknown = quatrefoil (clover). Frame form also
encodes dimension: closed frame = land & sea surface; open bottom = air/space; open
top = sea subsurface (§5.3.2.1). Line style: **solid** = certain identity; **black/white
dotted** = assumed friend / suspect / pending; **dashed** = planned/anticipated/suspected
status (§5.3.2.3) — dashed-vs-solid is exactly our DATA-4/DATA-5 contested-attribution
distinction, natively in doctrine.

Fill colors, filled symbols (Table XV — pick ONE luminance set and stay in it):

| Identity | Color | Dark RGB | Medium RGB | Light RGB |
|---|---|---|---|---|
| Unknown/Pending | Yellow | 225,220,0 | 255,255,0 | 255,255,128 |
| Friend/Assumed | Blue | 0,107,140 | 0,168,220 | 128,224,255 |
| Neutral | Green | 0,160,0 | 0,226,0 | 170,255,170 |
| Suspect | Orange | 255,188,1 | 255,217,107 | 255,229,153 |
| Hostile | Red | 200,0,0 | 255,48,49 | 255,128,128 |

Unfilled/icon-only defaults (Table XVI): unknown yellow 255,255,0 · friend **cyan
0,255,255** · neutral neon green 0,255,0 · suspect orange 255,188,1 · hostile red
255,0,0. Translucent fills: 35% opacity (§5.5b). Frame/icon strokes black on light
basemaps, white on dark (§5.5b).

## Symbol sets (Table A-IV)

`00` Unknown · `01` Air · `02` Air Missile · `05` Space · `06` Space Missile ·
`10` Land Unit · `11` Land Civilian Org · `15` Land Equipment · `20` Land Installation ·
`25` Control Measures & Planning · `27` Dismounted Individuals · `30` Sea Surface ·
`35` Sea Subsurface · `36` Mine Warfare · **`40` Activities** · `45`–`47` METOC ·
**`50` Signals Intelligence** · `60` Cyberspace.

## The sets that matter for this product

- **Activities (set 40)** — how we plot theater *events* (vs. units/equipment).
  Entity `110000` Incident → `110200` Bomb/Bombing, `110300` IED Event, `110400`
  Shooting, `110600` Explosion, etc. Full list: `2525e-milstandard/tsv-tables/Activities.tsv`.
  A missile strike on a base is an Activities symbol at the event location; the base
  itself is a Land Installation (set 20).
- **Signals Intelligence (set 50)** — the intel-field set: entity `110000` Signal
  Intercept → `110100` Communications, `110200` Jammer, `110300` Radar, etc.
  (`Signals intelligence.tsv`). Relevant when we plot EW/SIGINT-reported activity.
- **Land Unit (set 10) intelligence entities** — for plotting intel units/facilities:
  `150000` Intelligence, `150200` Counterintelligence, `150900` Joint Intelligence
  Center, `151000` Military Intelligence (`Land unit.tsv`).
- **Evaluation Rating amplifier (field J**, Table VI, per ATP 2-33.4) — a two-character
  amplifier: reliability `A`(completely reliable)–`F`(cannot judge) + credibility
  `1`(confirmed)–`6`(cannot judge). Valid on sets 10/15/20/27/40. This is the doctrinal
  hook for displaying per-event source confidence (DATA-1, DATA-5) *on the symbol itself* —
  e.g. an event sourced solely from Iranian state media might carry `F3`.

## Rendering pipeline (Mapbox)

- **[milsymbol](https://github.com/spatialillusions/milsymbol)** (`npm i milsymbol`, MIT)
  generates the SVG per SIDC — frames, fills, icons, amplifiers — targeting
  2525E/APP-6(E)/FM 1-02.2 rendering since v3. No fonts or image assets.
- Integration: `new ms.Symbol(sidc, {size, fill…}).asCanvas()` → `map.addImage(sidc, …)`
  once per distinct SIDC, then a Mapbox GL symbol layer with `icon-image: ['get','sidc']`.
- Per spec UX-5: cluster at low zoom; at high zoom, displace overlapping symbols with a
  hairline tie to true position (the proof build already does this manually in the
  Jordan/Bahrain clusters).
- Per spec GEO-4: until true SIDC icons render, describe output as "2525-informed
  framing" — frame shape + identity color only, never a fake official look.
- The standard's own SVG building blocks are obtainable from DISA
  (disa.meade.EE.mbx.symbology@mail.mil, §4.6) if we ever want the reference art.

## Product mapping (event → SIDC)

| Event field (spec §6) | SIDC element |
|---|---|
| affiliation: hostile action (Iranian/Houthi-attributed) | identity `6` Hostile |
| affiliation: friendly action (US strike) | identity `3` Friend |
| affiliation: unknown/contested (DATA-4: never a guess) | identity `1` Unknown (or `5` Suspect only when doctrine's "potential threat" bar is met) |
| event category | Activities (40) entity/type codes; installations 20; ships 30 |
| `conf_origin`/`conf_actor` (DATA-5) | solid vs dotted frame + Evaluation Rating amplifier |
| revision status | status digit (present vs suspected) |
