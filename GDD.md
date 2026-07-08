# HEARTHFALL — Gameplay Design Document (v2)

**Status: hypothesis, once-survived.** v1 of this document was attacked by four
independent adversarial reviews (systems/incentives, player experience, genre
scholarship with sources, solo-dev feasibility against the codebase). v2 is
the design that survived. The review log — what each attack killed, what it
changed, what was rejected — is Appendix A. Gameplay only: no art, audio,
lore, UI chrome, or technology. Every pillar still ends with a **falsifier**.

---

## 1. The intersection, honestly

Colony sim × roguelite × wave defense is **not** unclaimed. The Last Spell
(day-economy × night-waves × named permadeath heroes) ships the structure;
Rise to Ruins, Age of Darkness, Diplomacy is Not an Option, Cataclismo hold
the economy×defense corner; Cult of the Lamb holds base×roguelite. Two
documented failure modes killed or capped every attempt:

1. **Attachment does not emerge from structure.** The Last Spell has small
   named permadeath casts and its entire reception discourse is about build
   depth — nobody mourns anybody. Battle Brothers players remember "the axe
   guy," not a person. Named + mortal + few is *necessary but not sufficient*.
2. **Depth-budget cannibalization.** Cult of the Lamb's "two shallow halves"
   problem: a hybrid that splits its depth budget ships two mini-games.

The claim this design makes is therefore narrower and sharper than v1's:

> **What's unclaimed is an attachment-first treatment of this intersection —
> and the genre record shows attachment lives in what *persists across* the
> loop, never in what the loop consumes.**

Every attachment success story is a persistence story: Darkest Dungeon's
roster outlives its expeditions; State of Decay's community outlives its
missions (and you *embody* its members); Hades' cast is immortal while you
die. v1 of this document reset the cast every run and hoped 45 minutes could
do what those games do in 40 hours. It can't. So:

**The core hypothesis (v2):**

> **The band persists; the settlements are the runs.** You lead one small
> band of named, mortal, *aging* people from settlement to settlement across
> a darkening world. Each run is a place: founded, defended night by night,
> and won (a Beacon lit forever) or lost (survivors walk away; the dead do
> not). Attachment accrues where the genre says it can — across runs — while
> stakes, variety, and pacing live where roguelites put them: inside the run.
> The chronicle of who these people were is the thing you actually build.

The anti-cannibalization rule (answer to failure mode 2): **the people ARE the
shared depth core.** Every system on both sides of the heartbeat — economy by
day, defense by dusk — must run *through* named people (who farms, who carries
the torch, who breaks). Any proposed system that deepens only one half without
touching the cast is rejected by default (see §12 and the automation entry in
§13's cut list).

---

## 2. The eight pillars (revised)

**P1 — A band, not a colony.** The cast is capped at **12**, sweet spot 6–9 —
not because "attachment is inversely proportional to headcount" (v1's claim;
the evidence doesn't support a headcount law) but because the mechanisms that
*do* produce attachment demand it: **irreplaceability** (a dead person's
competence and relationships leave a permanent hole in a small band),
**cost of loss** (permadeath across the whole campaign, not the run), and
**control intimacy** (you will have personally been this person — see P2).
Small headcount is the legibility precondition (P7), not the cause.
*Falsifier*: after ~5 settlements, players still refer to band members by role
("a farmer died"), unprompted.

**P2 — The heartbeat, and you are in it.** Days alternate strictly: daylight =
agency (orders, builds, assignments — indirect control, pausable), dusk =
consequence, dawn = reckoning (a structured report: who was hurt, who broke,
what changed — not a log scroll). **Dusk is played, not watched**: each dawn
you choose who **carries the torch tonight**, and at dusk you control that one
mortal band member directly — rally, sortie at the breach, hold the door, drag
the downed out. Everyone else fights or flees by their own lights. The
torchbearer is the State of Decay move (embodiment of the fragile, not a hero
class — Kingdom's immortal monarch is explicitly rejected): control intimacy
is the documented mechanism that makes losing *this* person different from
losing a unit. During raids, pause allows looking, but commands flow only
through the torchbearer's live verbs — daylight omniscience does not extend
into the night (this resolves v1's hard-pause-vs-consequence contradiction).
*Falsifiers*: players report dusk as a cutscene; or torch duty is always given
to the same "best" member (the choice failed to become a dilemma).

**P3 — Pressure is legible and tracks capacity.** Two visible terms, always
on screen with their cause lists:
- **Menace** — the world's attention: rises with days, firelight claimed
  (§7.1), noise made (expeditions, constructions, Beacon), camps left
  standing; falls only through action (camps burned, warlords slain). Menace
  sets the **ceiling** on what can come.
- **The scouting report** — what they actually send: raiders probe your
  *visible strength* (standing walls, armed defenders, lit ground) and bring
  what they judge sufficient, under Menace's ceiling. Strong communes are
  worth raiding in force; a commune reeling from losses draws smaller,
  meaner-natured raids (scavengers, thieves) rather than armies.
This keeps v1's anti-turtle intent *and* fixes its two documented failures:
"time is not a choice" (v1's H3 contradicted itself; the days term now lives
honestly in Menace as the world's clock, worded as *visible*, not *chosen*)
and the death-spiral trap RimWorld's wealth-independent mode shipped (pure
time-ramps punish the crippled; capacity-tracking is what wealth-scaling was
crudely doing, and it must survive here — done in the open, via the scouting
fiction, so it reads as sense, not rubber-banding).
*Tuning invariant (binding)*: at every Trial, worst-case player defense growth
per day < Menace ceiling growth per day — the no-equilibrium guarantee is a
published inequality over the balance table, not a hope.
*Falsifier*: a stable "stay small forever" line exists; or post-loss raids
still snowball losses (spiral).

**P4 — The exam is scheduled by the player and priced honestly.** One way to
win a settlement: raise and light the **Beacon**, hold its 3 escalating
nights. v1 called self-scheduled exams rare; they aren't (Valheim's altars,
Terraria's summons, AtS's Seal), and their documented failure is
overpreparation until the exam is trivial, making "when" arithmetic. The USP
is therefore not the scheduling but the **pricing of delay as a contested,
legible wager**: Menace never plateaus (§7.4), seasons cycle threats, people
age (§4), and the campaign map darkens (§4) — waiting costs on four visible
clocks at once, and the clocks disagree about the best moment. Exam-night
composition invariants: each night is previewed at dawn; a fixed **minimum
share of each night's budget is concealed** (large enough that readiness can't
be pre-solved — binding number in the balance table); on a band's *first-ever*
Beacon attempt, concealed elements are variations of vectors that run already
taught, never novel modalities (first-attempt fairness — cruelty is what
Trials are for).
*Falsifier*: telemetry shows one optimal lighting day; or first-Beacon losses
are dominated by never-seen mechanics.

**P5 — Continuity carries history, never stats.** What crosses between runs:
people (name, trait, wants, **scars, bonds, grudges, memories** — all
zero-modifier by hard invariant), keepsakes (story hooks and unlock tokens,
never modifiers), the Chronicle, the campaign map, and unlocked *options*
(structures, creeds, arrival archetypes, sites, event packs). What can never
cross or be bought: any number that makes the next fight easier. The
**governor is age**: band members age between settlements and eventually
retire into the Chronicle or die grey — veterancy accumulates story and
grief-risk, not power, and the roster churns generationally (heirs join;
"legacy" becomes literal). v1's "zero flat stats *ever*" survives for
*purchases and carryover* — but v1 ignored why Hades ships a stat mirror:
guaranteed progression is grief management. That valve exists here as visible
campaign progress that no single loss can take away (lit Beacons stay lit,
the map holds your ground, unlocks are permanent) plus an honest, opt-in
**assist mode** (flat, labeled, off the record) — never as creeping power.
*Falsifiers*: veterans measurably outperform recruits with identical
trait/equipment (history leaked power); or churn telemetry shows players quit
at losses despite the campaign valve (the valve is too weak — revisit, per
Appendix A, before ever revisiting the stat ban).

**P6 — Death is permanent, and paid in memorial, not compensation.** A death
costs the campaign a person forever — their wants unmet, their bond partner
alone, their torch nights over. What the player receives is *memorial*: the
grave travels to the Chronicle, the settlement remembers, a future run may
find their name carved somewhere. The v1 error (killed by two attackers
independently): paying *compensation* for death — legacy bonuses, freed
equipment, thread slots — until dying was profitable and grief was priced
away. **Binding invariant: the mechanical value of any death is strictly less
than the value of that person alive**, and endings triggered by deliberate
self-harm forfeit feat payouts (§12). Consolation must honor the loss, never
offset it.
*Falsifier*: the sting test inverts — players engineer deaths, or losses
produce shrugs because the payout covered them.

**P7 — Legible depth: small numbers, few states, directed attention.** Small
integers, chains ≤2 steps, visible causes — plus the two corrections the
attacks forced: (a) **counts drown players as surely as complexity** — one
person's card is legible, twelve are a board — so the game practices
**notification-driven attention**: full detail surfaces only for people
currently *in a decision* (the torch choice, a flipped want, a fraying
resolve); everyone else compresses to portrait + condition band. (b) Resolve
and all person-states are **named bands** (Steady / Fraying / Breaking), not
0–100 scalars; the wiki rule is restated honestly as *no load-bearing number
may be undiscoverable in play* (a counterplay matrix players learn by fighting
is fine; one they must alt-tab to learn is not).
*Falsifier*: playtesters can't answer "why did that happen?" in one sentence;
or eye-tracking-by-proxy (playtest interviews) shows the sidebar is ignored
because it's noise.

**P8 — Endings are choices, at the player's pace.** When a settlement begins
to die, the game *widens* agency instead of hard-forcing a finale: the **Last
Stand** (call everything down tonight; die famous; feats are honored) and the
**Torch** (leave now; choose who walks out — they, and only they, continue the
campaign) become *standing offers* from the moment collapse threatens, and
remain available through however long the player wants to fight the decline.
v1 hard-coded fast collapse; the genre evidence (DF's beloved long doomed-fort
sagas) says the *narratable arc* is the treasure and its duration belongs to
the player. What the design guarantees is not speed but **agency density
during decline** — rescues, triage, evacuation decisions — so a 40-minute
doomed rescue is a story, not a bleed-out.
*Falsifier*: players alt-F4 at collapse instead of taking an ending; or
declines are experienced as unwinnable chore-time (agency density failed).

---

## 3. The campaign (the outer game)

- **The band**: starts as ~5 named people (first campaign: a curated, gentle
  founding — no draft screen full of unlearned words; the attackers killed
  v1's run-1 spreadsheet draft). Grows by arrivals, rescues, and births/heirs
  between settlements. Cap 12 *fielded* per settlement; reserves rest at the
  wagon camp.
- **Aging & generations**: members age per settlement survived. Life stages
  (Green → Prime → Grey) shift wants and torch-risk, never raw stats (P5).
  The Grey retire into the Chronicle; heirs arrive carrying a parent's
  memory-thread. A full campaign spans generations by design.
- **The world map**: a region of candidate sites, slowly darkening (the
  campaign-scale Dark). Each settlement run happens at a chosen site, whose
  terrain/season/quirk is visible before founding (this choice replaces v1's
  cast-draft as the run-variety authorship moment). **Lit Beacons are
  permanent light** on the map — Kingdom's light-as-territory at campaign
  scale — and the campaign is won by lighting a constellation (target: 4–6
  Beacons) before the dark closes over the region. Fallen settlements leave
  **your ruins**: revisitable sites carrying graves, salvage, and one memory
  event.
- **Between settlements — the wagon camp**: the meta layer, made diegetic and
  kept short (minutes): tend the wounded, hear wants, spend legacy on
  *options* (P5), pick the next site, choose a creed. No shop screens; the
  band is the menu.
- **Campaign end**: the constellation lit (won — the Chronicle closes as a
  finished book) or the band extinguished / the dark complete (lost — the
  Chronicle closes anyway; a new band may later find *this* campaign's ruins;
  the AtS Blightstorm lesson: cycles reset the map, never your unlocks).

## 4. Shape of a settlement run (45–75 min)

- **Founding (minutes)**: pick the site (visible terrain/season/quirk), pick
  who comes (the *real* draft — "which of MY people do I risk" — meaningful
  precisely because they're yours), pick a creed if unlocked. Land, light the
  hearth.
- **Act I — Roots (days 1–4)**: bootstrap food/roofs/palisade against small,
  fully-previewed, single-vector raids. Arrivals begin (see §5 — they are
  campaign decisions now, which is what makes them warm).
- **Act II — The weight**: tiers unlock by hearth development (never
  headcount — P1's cap must not be a progression brake). Menace compounds;
  the scouting report sharpens; seasons flip verbs (§8); ambitions arrive;
  hordes drum. The standing question: light it this year, or winter first —
  argued against four visible clocks (P4).
- **Act III — The Wager**: the Beacon's three previewed, escalating nights.
  Hold: **Ascension** — permanent light on the map, the band walks out
  carrying the story (and typically its scars). Fall: P8's endings.
- **Decision cadence**: one meaningful choice every 2–3 minutes, now with a
  **guaranteed deck-proc floor** (at least one event/arrival/ambition beat per
  game-day — v1 hoped RNG would fill quiet days; the attack showed it won't).

## 5. The cast (people system)

- **Roles** (four): Worker, Farmer, Guard, **Medic** (stabilize, treat,
  brew). Role changes cost a day of reduced output.
- **Traits** (one, permanent): must bend a *decision about that person*
  (who mans the post, who travels, who gets the last meal) or it's cut.
- **Wants** (one, visible): satisfiable preferences with resolve teeth.
  Denied-for-days drains; satisfied regenerates.
- **Resolve**: per-person, displayed as three bands (Steady / Fraying /
  Breaking — P7); driven at v1-scope by food, sleep, and deaths witnessed
  (wants/bonds as inputs arrive vLater — feasibility descope, Appendix A).
  Breaking risks **breaks**: refusals, desertions — dramatic, legible, and in
  v1 never mid-raid (the untested-state bomb the feasibility attack defused;
  mid-raid breaks return only after the interaction is test-covered).
- **Bonds & grudges** (max one of each per person): at v1 scope they are
  **story-and-resolve only** — formed by shared events, shown on the card,
  resolve damage when a bond partner dies. No adjacency buffs, no cooperation
  refusal (the O(n²) branch bomb; teeth return vLater only if playtests show
  attachment needs mechanical reinforcement).
- **Scars**: permanent, cosmetic-narrative, cross-campaign (P5). The
  attachment ledger and the cheapest system in the game.
- **Equipment**: one assignable weapon slot per person at v1 (armor/tools/
  durability vLater). Equipping is choosing; the dead's weapon can be
  recovered — by someone willing to go get it.
- **Arrivals**: strangers at the gate, shown as people (trait, want, age).
  Accepting is a *campaign* decision (they join the band, not the run) —
  which is why it isn't larder arithmetic — and **declining has a visible
  cost** (they camp nearby; Menace ticks; or a want-of-yours goes unmet).
  Arrival rate is low and each one is an event, not a spawn.
- **The torch choice** (daily): who carries it tonight (P2). Interacts with
  everything above — the brave want it, the bonded fear it, the Grey earn it.

## 6. The threat

- **Menace + scouting report** per P3, both with on-screen cause ledgers.
  Claims are measured in **firelight**: lit/warmed ground is claimed ground
  (legible, thematic, and it prices interior density too — v1's free-inside-
  the-ring turtle hole is closed: light is light wherever it burns).
- **Archetypes** (7 at target; v1 ships the first anti-turtle one): raider ·
  brute · skirmisher · torch-bearer · **sapper** (breaches doors/walls;
  the sealed-ring answer; v1's anti-turtle archetype) · **slinger** (ranged
  suppression; answers watch-posts; vLater — the feasibility attack showed
  it's a new combat modality, not a table row) · warlord.
- **Counterplay matrix invariant**, now two-axis: every archetype answered by
  ≥2 defenses, no defense answers ≥3 archetypes, **and defenses cost against
  each other** (space, labor, firelight) so owning the full suite is a real
  tradeoff, not a checklist (v1's matrix counted answers but not their
  economy).
- **The Dark (in-run)**: Menace's floor rises on a drum; hordes every ~6 days
  behind named warlords. Killing one buys quiet days; the next is meaner.
- **Labor invariant (binding)**: minimum viable defense at the sweet-spot
  cast (6–9) must be crewable by **≤ half** the band, leaving the rest for
  economy plus one small away-party — checked against the balance table, so
  the "people are economy AND army" spine is arithmetic, not assertion.

## 7. Seasons, economy, world

- **Seasons flip verbs** (unchanged from v1 in intent): spring mud, summer
  fire, autumn gathering-hordes, winter desperation — **winter is the most
  tactically different season** (frozen river becomes a crossing — both
  ways). v1-scope ships winter's flip for real and numeric versions of the
  rest (feasibility split); the frozen-river pathing refactor is planned
  work, not a hand-wave.
- **Economy**: five stockpiles (food · timber · stone · scrap · coin), chains
  ≤2, upkeep only where it decides something (the hearth eats wood nightly).
  **No automation, permanently**: automation removes labor from meaning, and
  labor-by-a-face is the shared depth core (§1). Infrastructure may multiply
  a *person's* work (mill, smokehouse) — the unit of production is always a
  face. No belts, no logistics layer.
- **Trader**: finite stock, prices with **demand-memory** (what you drained
  last visit is scarce and dear next visit), seasonal drift; pricing is
  decoupled from Menace (v1 accidentally gave the low-Menace turtle a
  discount).
- **World layer (in-run)**: a ring of sites generating priced wagers —
  who goes, how many nights away, what dusk coverage it costs (bounded by the
  labor invariant). Rewards lean toward **people and stories** (rescues,
  your own past campaign's ruins). Some opportunities are **time-critical
  against the dusk clock** (a passing caravan, a distress fire — Kingdom's
  lesson: the reason to leave camp must compete with the reason to be home).

## 8. Onboarding & difficulty

- **The Elder onboards; ambitions sustain**: objective chain through the
  first horde; thereafter the Elder offers 1-of-2 ambitions (declining is
  free — pulls, not chores).
- **Targets**: first settlement loss by day 6–10 with a named favorite (P1
  falsifier check); first Ascension within 6–10 settlements; campaign win in
  20–40 hours of play; Trials for the far tail.
- **Trials** (opt-in ladder): at v1, pure scalar pressure over the balance
  table (vector-modifying trials rejected for v1 — tuning-surface control).
  Some *content* unlocks sit on low Trial tiers (the retention attack's
  surviving point: the ladder must pull non-completionists too).
- **First-loss guarantee**: the first settlement loss unlocks a meaty option
  (a creed or arrival archetype) regardless of legacy earned — run 2 must be
  visibly *different*, since it is forbidden from being stronger (P5).
- **Assist mode**: honest, labeled, off-Chronicle (P5).

## 9. Anti-degeneracy invariants (consolidated, binding)

1. No meta purchase or carryover modifies any combat/economy number (P5).
2. Value of any death < value of that person alive (P6); self-induced
   collapse (deliberate starvation/suicide expeditions) forfeits feat
   payouts; Last Stand expected legacy < Beacon-attempt expected legacy from
   the same board state — always.
3. Menace ceiling growth outpaces worst-case defense growth at every Trial
   (no turtle equilibrium), while the scouting report keeps post-loss raids
   sub-snowball (no death spiral).
4. A fixed minimum share of every exam night is concealed (no pre-solved
   Beacon); first-attempt concealment draws only from taught vectors.
5. Counterplay matrix: ≥2 answers per archetype, ≤2 archetypes per defense,
   and defenses priced against each other in space/labor/light.
6. No creed or trial may reward raw headcount or raw passivity (Open-Hearth-
   style volume perks are banned; benefits must be qualitative).
7. Trader carries no infinite conversion at any price stack (demand-memory).
8. Every quantity a player reasons about: small integer or named band.

## 10. Content architecture & the v1 playable

Variety lives in decks and tables: event deck (15–25 v1, with the per-day
proc floor), ambitions (~10), warlord table, creeds (**0–2 at v1**; 4–6
target), trials (scalar, 8), sites (6–8 incl. your-ruins), arrival deck. One
biome, one map size — run variety must come from site × season × menace ×
creed × cast-you-brought, or the design has failed regardless of map count.

**The v1 playable exists to test the core hypothesis and nothing else** —
"does a persistent, mortal, aging band whose settlements die make players
found the next settlement?" It requires: the band with resolve-bands + wants +
scars; the torch choice with embodied dusk control; arrivals as campaign
decisions; Menace + scouting report as visible cause-lists (the number can
stay simple); the sapper; the Beacon with previewed nights; Torch/Last Stand
endings writing real survivors to the campaign; the wagon camp between
settlements; aging in its simplest form. It explicitly stubs: bond teeth,
slinger, equipment depth, most season flips, ruins beyond one canned site,
creeds beyond 2, all vector-modifying trials. (Feasibility split, Appendix A —
including the persistence architecture prerequisites: versioned campaign
store, ending-flow ordering.)

**Permanent cut list**: automation/pipelines (§7 — identity-level rejection);
immortal player avatar (P2 — embodiment yes, hero class never); z-levels,
fluids, body-sim, diplomacy, in-run tech trees, multi-settlement concurrency,
endless mode *inside a settlement* (the campaign map is the nesting surface —
the world persists precisely so that no single place has to).

## 11. Open questions (playtest-decided)

1. Aging rate — settlements-per-life-stage is the campaign's master pacing
   knob and pure playtest territory.
2. Does the dusk torchbearer need a second live verb set (formations? focus
   targets?) or is rally/sortie/rescue enough before it drifts action-RPG?
3. Reserve band members at the wagon camp: pure safety, or do they need a
   role (and does that reintroduce the labor-budget hole)?
4. Heirs: literal children (time skips?) vs. recruited successors carrying a
   memory-thread — tone and clock implications.
5. How much of the campaign map is authored vs. rolled per campaign?
6. Endless-pressure valve: is the campaign map enough for the nesting
   audience, or does a post-win "epilogue settlement" mode earn its keep?

---

## Appendix A — Adversarial review log (v1 → v2)

Four independent attacks; verdicts on the major findings:

**Accepted, design-changing:**
- *Genre (F1/F2/verdict-b) + Experience (attachment-clock FATAL)*: the
  intersection is occupied (The Last Spell et al.) and 45–75 min cannot build
  attachment from strangers; every cited attachment success is
  persistent-roster. → **The campaign flip**: persistent band, disposable
  settlements, aging generations, campaign map. (The genre attack and the
  designer converged on this independently — it is v2's spine.)
- *Experience ("dusk is a cutscene" FATAL) + Genre (F3: SoD's mechanism is
  embodiment)*: → the **torchbearer** (P2) and the raid-time command rule.
- *Systems (Last Stand farm FATAL; death-profitable MAJOR) + Experience
  (H6-consolation MINOR)*: → P6's memorial-not-compensation rule and
  invariants §9.2.
- *Systems (Beacon arithmetic FATAL) + Genre (F5: scheduled exams are common
  and degenerate)*: → P4 restated (USP = pricing of delay), concealed-share
  invariant, first-attempt fairness.
- *Systems (base(days) contradiction) + Genre (F4: RimWorld's
  wealth-independent mode is a documented trap)*: → P3's two-term model
  (Menace ceiling + capacity-tracking scouting report) and invariant §9.3.
- *Systems (labor budget unproven)*: → §6's binding labor invariant.
- *Genre (F6: Hades' Mirror is stats; absolutism is dogma)*: → P5 keeps the
  stat ban for purchases/carryover but names the grief-management valve it
  must replace (campaign permanence + assist mode) and commits to revisiting
  the valve, not the ban, if churn falsifies it.
- *Genre (F7: DF collapses are beloved slow arcs)*: → P8 rewritten: endings
  as standing offers, decline duration player-owned, agency density the
  guarantee.
- *Experience (cognitive-load FATAL; resolve-scalar MINOR)*: → P7's
  notification-driven attention + named bands.
- *Experience (run-2 churn FATAL)*: largely dissolved by the campaign flip
  (continuity is the pull); residually → first-loss unlock guarantee +
  content on low Trial tiers (§8).
- *Feasibility (bonds = O(n²) branch bomb; mid-raid breaks = bug epicenter;
  ruins/threads = unplanned persistence architecture; META unversioned;
  slinger = new modality; tuning surface ≈1,300 cells)*: → §5's v1 scopes,
  §10's v1/vLater split, creeds 0–2, scalar trials, sapper-first. The
  campaign store must be versioned from day one.
- *Genre (F8: endless-mode collision + two-shallow-halves) *: → §1's shared
  depth core rule; §10's cut-list stance (the campaign map is the nesting
  surface); open question 6 keeps the epilogue-mode door ajar.
- *User direction*: Kingdom's light-as-claims and time-critical away-ops
  (§6, §7); automation rejected at identity level (§7); no immortal avatar.

**Rejected, with reasons:**
- *Genre (implied): drop the Beacon as USP* — rejected; restated honestly
  (P4). The self-scheduled exam plus four disagreeing delay-clocks plus
  campaign stakes is not Valheim's altar; the falsifier stays live to check.
- *Experience: cap the Chronicle's role* — partially rejected; the Chronicle
  is no longer a retention mechanism (the campaign is), so its
  designer-romance risk is priced at zero: it's a memorial, and skippable.
- *Systems: resolve bands hide information* (implicit tension with P7's
  visible-causes) — rejected as stated; bands + cause-on-inspect satisfies
  both.
- *Feasibility: defer the Medic role* — rejected; the medic is load-bearing
  for P6 (fighting for the wounded is where memorial-not-compensation gets
  played, not displayed), and it's a small role by v1 scope.

## Appendix B — Distance from the current build (corrected per feasibility audit)

Genuinely load-bearing skeletons in the build: the Beacon loop (build/light/
hold-3-days/ascend), downed-not-dead, dusk raids with dawn warnings, traits
that gate behavior, sites-with-people, the Elder's tutorial chain. Previously
overstated, now stated plainly: **continuity has zero code** (META is scalar,
unversioned; saves are deleted at run end — the campaign store is new
architecture); **seasons currently embody the anti-pattern** (numbers-only,
and winter is the *safest* season); dawn is a log, not a reckoning; ambitions
don't exist; morale is one global scalar; weapons are a pooled index; there
is no draft, no arrivals-as-choices, no endings, no embodied control.

*Since the feasibility audit, the enablement work has landed (2026-07-08):
characterization tests over the money/combat/raid paths, CI, and a single
`BALANCE` tuning table — the prerequisites §10's v1 playable assumed. The
roadmap (ROADMAP.md) was revised against this document on the same date; its
**Milestone HP0** is the execution route for §10, item by item. Where the two
documents disagree, **this document is the destination**.*
