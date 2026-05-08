# 357 Locked Ruleset Prompt Addendum

## Purpose
This file captures what is newly locked in `Instruction 2 on 05-05-2026.txt` compared with the broader `HANDOFF_SUMMARY.md`.

Use this as an addendum, not a replacement:
- `HANDOFF_SUMMARY.md` still covers the wider product roadmap.
- This file tightens the 357 implementation with exact rules, UI behavior, and edge cases.
- Treat the generic `Prompt 4 - Variant Engine Foundation And 357` in `HANDOFF_SUMMARY.md` as superseded by the prompts in this file.

## What Is New In The Morning Note
- 357 is now explicitly a no-board game.
- Each player builds to 7 cards over 3 rounds: `3 -> 5 -> 7`.
- The only action choices are `GO` and `STAY`.
- Decisions stay hidden until reveal. No early indicators should leak who chose what.
- The round flow is now explicit: `Deal (3) -> Decide -> Deal (5) -> Decide -> Deal (7) -> Decide -> Reveal -> Resolve -> Reshuffle -> Ante -> Repeat`.
- `Hostest with the Mostest` is now the default mode with cumulative wilds:
  - round 1: `3s`
  - round 2: `3s + 5s`
  - round 3: `3s + 5s + 7s`
- `Best Five Cards` is now explicitly defined as:
  - non-cumulative wilds `3 -> 5 -> 7`
  - evaluate the best 5-card hand only
- 357 has no normal betting flow:
  - no `raise`
  - no `check/call`
  - no bet slider
  - no betting system beyond ante and the fixed post-showdown penalties
- Solo `GO` is the only way to earn a leg.
- In a multiple-`GO` showdown:
  - the winner gets payouts
  - the winner does not earn a leg
  - each loser pays the winner
  - each loser pays the pot
  - each loser loses all legs
- Ante timing is now explicit: ante is charged on each reshuffle.
- Edge cases are now locked:
  - `0 GO players`
  - `all STAY all 3 rounds`
  - player leaves mid-round
  - tie at showdown
- 357-specific UI requirements are now explicit:
  - show `GO / STAY` controls
  - show hand progression `3 -> 5 -> 7`
  - show pot
  - show current round and active wilds
  - show 4 pink leg slots per player
  - hide community cards, bet controls, hand strength meter, `players going` counters, and early `GO/STAY` indicators
- The table label and penalty copy are now explicitly part of the 357 UI.

## Important Implementation Note
The client note has one internal naming mismatch:
- it says `Unit = table base`
- but the concrete `$1 table` example and the provided constant both use `$2 to winner` and `$2 to pot`

For prompt-writing purposes, use the concrete example as the source of truth unless the client later corrects it:
- `$1 ante per player`
- `$2 to winner per losing player`
- `$2 to pot per losing player`

## Prompt 1 - Lock The 357 Engine To The Final Ruleset
```text
Work inside the js-house-of-poker repo.

Goal
Replace the generic 357 implementation path with the locked rules from the morning client note.

Current repo context
- `HANDOFF_SUMMARY.md` previously described 357 only at a high level.
- The new morning note now defines exact round flow, mode behavior, reveal rules, penalties, and edge cases.
- Hold'em must keep working as a separate engine path.

Required 357 rules
- No board.
- 7 cards per player built over 3 rounds.
- Round sizes: `[3, 5, 7]`.
- Only `GO` and `STAY` actions exist in this variant.
- Decisions stay hidden until reveal.
- Use an explicit phase machine such as:
  - `deal_3`
  - `decide_3`
  - `deal_5`
  - `decide_5`
  - `deal_7`
  - `decide_7`
  - `reveal`
  - `resolve`
  - `reshuffle`
- Support both modes:
  - `HOSTEST` default
  - `BEST_FIVE`
- Wild rules for `HOSTEST`:
  - round 1: `3s`
  - round 2: `3s + 5s`
  - round 3: `3s + 5s + 7s`
  - all 7 cards play
- Wild rules for `BEST_FIVE`:
  - round 1: `3s`
  - round 2: `5s`
  - round 3: `7s`
  - evaluate best 5-card hand only
- Solo `GO`:
  - wins the pot
  - earns exactly 1 leg
- Multiple `GO` showdown:
  - showdown only among `GO` players
  - winner gets payouts
  - winner gets no leg
  - each loser pays `$2` to winner on a `$1` table
  - each loser pays `$2` to pot on a `$1` table
  - each loser loses all legs
- Ante:
  - charge on each reshuffle
  - `$1` ante per player on the `$1` table
- Edge cases:
  - `0 GO players`: no payout and no leg
  - all players `STAY` through all 3 rounds: reshuffle, ante, new deck
  - player leaves mid-round: treat as `STAY`
  - tie at showdown: split the winner payout portion, each loser still pays the pot portion, no leg awarded

Required state additions
- Add explicit 357 room-state fields for:
  - active round
  - active wild definition
  - per-player leg count
  - hidden decision state
  - reveal state
  - penalty model
  - ante amount
  - mode
- Centralize the 357 constants instead of scattering magic numbers. A shape like this is acceptable:
  `TABLE = { ante: 1, unitToWinner: 2, unitToPot: 2, legsToWin: 4, rounds: [3, 5, 7], modes: ["HOSTEST", "BEST_FIVE"] }`

Scope
- Engine, state, and resolution logic only.
- Keep the variant boundary clean so Hold'em stays isolated.
- If the current codebase still needs a deterministic way to preserve a player's earlier round commitment, record it explicitly in state rather than flattening everything into one final boolean.

Out of scope
- No broad table redesign
- No chat
- No invite or gift work
- No wallet rewrite beyond the exact 357 ante and penalty handling already described

Acceptance criteria
- 357 runs through an isolated engine path.
- The phase machine matches the locked `3 -> 5 -> 7 -> reveal -> resolve -> reshuffle -> ante` flow.
- The two modes have different wild behavior exactly as specified.
- Solo `GO` is the only leg-earning outcome.
- Multiple-`GO` payouts, loser leg resets, and tie behavior follow the morning note.
- Hold'em remains functional and does not inherit 357-only rules.
```

## Prompt 2 - Build The 357-Specific Table UI And Secret Decision Flow
```text
Work inside the js-house-of-poker repo.

Goal
When the selected game is `357`, switch the table UI into the final locked 357 presentation and interaction model without breaking other variants.

Current repo context
- The existing app still carries Hold'em-era table assumptions.
- The morning client note now locks the 357 screen behavior and the list of UI elements that must appear or disappear.

Required 357 UI behavior
- Show large `GO` and `STAY` buttons at the bottom center.
- Show player hands progressing from `3 -> 5 -> 7`.
- Show pot value.
- Show current round.
- Show active wilds for the round and mode.
- Show 4 leg slots per player using a pink checker or pink pip treatment.
- Keep status icons visible near the player seat.
- Add a small, clean table label for 357 such as:
  - `$1 Table`
  - `Penalty: $2 to player / $2 to pot`

Secret decision and reveal rules
- Before reveal, do not show who chose `GO` or `STAY`.
- During hidden-decision waiting states, show only neutral UI such as `Waiting for players...` or equivalent.
- After all required decisions are in:
  - `GO` players light up
  - `STAY` players dim
  - then show resolution

Hide or remove for 357
- community cards
- betting controls
- hand strength meter
- `players going` counters
- early `GO/STAY` indicators
- any dealer box treatment

Scope
- UI, presentation, and client state wiring only.
- Preserve the final table shell layout work already described elsewhere.
- Keep Hold'em and other variants free to continue using their own controls and presentation.

Likely files in scope
- `src/screens/GameScreen.tsx`
- `src/components/gameplay/**`
- `src/context/PokerProvider.tsx` or the gameplay transport layer
- `src/types/poker.ts`

Out of scope
- No full engine rewrite in this prompt
- No chat work
- No invite or gift work
- No status-ranking logic rewrite

Acceptance criteria
- 357 no longer renders Hold'em-specific board or betting UI.
- The user sees round, wilds, pot, and pink leg tracking clearly.
- Secret decisions remain secret until reveal.
- The reveal state visually distinguishes `GO` from `STAY` exactly at the proper time.
- Other variants are not forced into the 357-only UI model.
```

## Prompt 3 - Add 357 Rules Coverage For Edge Cases And Locked Outcomes
```text
Work inside the js-house-of-poker repo.

Goal
Add deterministic coverage for the locked 357 rules so future edits do not silently break the client-approved behavior.

Required coverage
- round progression `3 -> 5 -> 7`
- `HOSTEST` cumulative wild progression
- `BEST_FIVE` non-cumulative wild progression
- solo `GO` earns exactly 1 leg
- solo `GO` wins the pot
- multiple `GO` showdown gives payouts but no leg to the winner
- multiple `GO` losers lose all legs
- `0 GO players` gives no payout and no leg
- all players `STAY` all 3 rounds triggers reshuffle and ante
- player leaving mid-round is treated as `STAY`
- tie at showdown splits the winner payout portion and still charges the pot portion
- ante is charged on each reshuffle

Implementation guidance
- If the repo already has a test harness, add targeted tests there.
- If it does not, add a minimal engine-level verification path that can still be run repeatably without UI interaction.
- Keep the checks close to the 357 engine boundary instead of testing only through screen-level behavior.

Out of scope
- No UI redesign
- No chat
- No social features
- No economy expansion beyond the exact 357 rule checks

Acceptance criteria
- There is repeatable coverage for the locked 357 rules.
- The coverage is narrow and engine-focused rather than depending on full manual playthroughs.
- Future refactors can detect regressions in payout, legs, wilds, and edge-case handling.
```

## 357 — `$1 Table` Rule/Economy Handoff Addendum

### Central Table Config
The `$1 table` must be treated as a config-driven 357 table, not as a UI hardcode. The canonical config shape is:

```ts
const TABLE_CONFIGS = {
  ONE_DOLLAR_357: {
    gameType: '357',
    tableStake: 1,
    currencyUnit: 'clips',
    anteClips: 1,
    goLossPenaltyToWinnerClips: 2,
    goLossPenaltyToPotClips: 2,
    allowRaise: false,
    allowCall: false,
    allowTraditionalBetting: false,
    simultaneousAction: true,
  },
};
```

### Ante Rules
- Every active eligible player pays exactly `1` clip before every deal/cycle.
- Ante collection happens before cards are dealt and again when a reshuffle starts the next cycle.
- Ante deductions are server-authoritative and added to the 357 pot.
- The engine must key ante collection by hand/deal/cycle so repeated renders, socket retries, or duplicate client events cannot double-charge the same deal.

### Simultaneous Action Rules
- 357 action is simultaneous intent lock-in, not turn-based betting.
- Valid intents are `GO`, `STAY`, and `FOLD`; `FOLD` is an intent alias for staying out of the confrontation.
- There is no raise, call, blind, minimum bet, maximum bet, or traditional betting round in 357.
- Store one locked action per player per hand/deal/action window. A duplicate matching action is idempotent; a conflicting action after lock-in is rejected.

### Multiple-`GO` Loss Penalties
When multiple players lock `GO` in the same action window:
- resolve one or more winners deterministically server-side from the locked `GO` players only;
- each losing `GO` player pays `2` clips to the winner side;
- each losing `GO` player pays `2` clips to the pot;
- total loss pressure is `4` clips per losing `GO` player;
- winner-side payout is split deterministically if the showdown ties;
- losing `GO` players reset their leg counts.

If a player cannot cover a penalty, the current safe fallback is to cap the debit at their remaining table balance and mark them all-in/out of chips. TODO for the multiplayer ledger: replace that cap with the production all-in/elimination/insufficient-balance policy once persistent server accounts are authoritative.

### Multiplayer Authority/Event Flow
- Clients emit only intent, e.g. `player:action` with `{ tableId, handId, playerId, action: 'GO' | 'STAY' | 'FOLD' }`.
- Server validation owns table membership, active hand/deal/action-window checks, and action lock-in checks.
- Server state owns player balances, pot, ante collection, decisions, winner calculation, loss penalty distribution, reshuffle economy updates, and leg progression.
- Clients must never directly mutate pot, winner balance, loser balance, or clip balance.
- Once all eligible player intents are locked, or when a future action timer expires, the server resolves the window and broadcasts authoritative updated game state with `game:stateUpdated` / current room-state sync.
