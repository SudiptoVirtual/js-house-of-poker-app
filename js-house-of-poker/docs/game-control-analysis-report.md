# Game Control Analysis Report: GO/STAY vs Fold/Check/Raise

Date: 2026-05-12  
Scope: analysis only; no application code was changed.

## Executive Summary

The current codebase does not simply replace GO and STAY with Fold, Check, and Raise everywhere. It has two separate action-control modes:

1. **357 mode** shows **GO**, **STAY**, and **FOLD** during decision rounds.
2. **Standard poker mode** shows **FOLD**, **CHECK/CALL**, and **BET/RAISE/ALL-IN** during betting rounds.

The most important finding is that **FOLD in 357 mode is not a traditional fold**. The 357 engine accepts a `fold` action, but immediately normalizes it to **STAY** before saving the decision. In other words, pressing FOLD in 357 should lock the player out of GO for that 3/5/7 decision round, but it does **not** set the hand player's `folded` flag and does **not** remove the player from the 357 cycle.

## What the Buttons Mean Today

### 357 Mode Buttons

When the table is in 357 mode and the player can act, the `GameControls` component renders three buttons:

- **GO** — sends `go`; the player enters the current 357 round and may compete for the pot.
- **STAY** — sends `stay`; the player sits out the current 357 showdown decision.
- **FOLD** — sends `fold`, but the engine treats it as `STAY` for 357.

This rendering is controlled by the `mode === '357'` branch of `GameControls`.

### Standard Poker Buttons

When the table is in standard mode and the player can act, the `GameControls` component renders:

- **FOLD** — sends `fold`; the engine marks the player as folded.
- **CHECK** or **CALL amount** — shows CHECK if there is nothing to call, otherwise CALL.
- **BET** or **RAISE** or **ALL-IN** — opens the raise panel or sends all-in depending on the available actions.

This rendering is controlled by the `mode === 'standard'` branch of `GameControls`.

## Why GO/STAY and Fold/Check/Raise Appear to Be Replaced

The behavior is mode-driven:

- A 357 table intentionally disables traditional betting. The shared 357 config sets `allowCall`, `allowRaise`, and `allowTraditionalBetting` to `false`.
- A standard Hold'em table uses traditional poker betting controls.
- The screen chooses which control panel to render from `gameSettings.game`:
  - `gameSettings.game === '357'` renders the 357 action panel.
  - Any non-357 live hand renders the standard hero action section.

Therefore, if you see **GO/STAY/FOLD**, you are in a 357 table/decision round. If you see **FOLD/CHECK/RAISE**, you are in a standard poker table/betting round.

## Important Finding: 357 FOLD Behavior

In the 357 branch of `performAction`, the engine does this:

1. Normalizes `go`, `stay`, and `fold` into 357 decisions.
2. Converts `FOLD` to `STAY` using `const nextDecision = decision === 'FOLD' ? 'STAY' : decision`.
3. Saves that `nextDecision` into the 357 decision history.

That means 357 FOLD is currently an alias for STAY. It can look like it works because the turn advances, but it will later reveal as STAY, not FOLD. This is probably the source of confusion.

## Standard Poker Fold/Check/Raise Behavior

For standard poker hands, the engine uses true betting logic:

- **Fold** sets `handPlayer.folded = true` and logs that the player folded.
- **Check** is only allowed when `toCall === 0`; otherwise it throws `Cannot check when facing a bet.`
- **Bet** is used to open betting when the current bet is zero.
- **Raise** is used after betting has already started and must beat the current bet and minimum raise.
- **All-in** commits the player's remaining chips.

Available standard actions are built per player:

- `fold` is always available to the current active player.
- `check` is available when there is nothing to call.
- `call` is available when facing a bet.
- `bet` or `raise` plus `all-in` are available when the player still has chips and can increase the wager.

## Gameplay Rules Observed in the Code

### 357 Rules

- New 357 cycles deal decision rounds at 3 cards, then 5 cards, then 7 cards.
- Each player secretly chooses GO or STAY for each decision round.
- The current code also accepts FOLD, but records it as STAY.
- If no players GO, there is no payout and the pot carries forward.
- If exactly one player GOes, that player wins the pot and earns one leg.
- If multiple players GO, the best hand wins; losing GO players pay penalty chips to the winner side and the pot.
- First to 4 legs is displayed as the 357 win target in the UI copy.
- The 357 table config has ante = 1 clip, go-loser penalty to pot = 2 clips, and go-loser penalty to winner = 2 clips.

### Standard Poker Rules

- The game defaults to Hold'em in the engine's default settings.
- The hand progresses through normal betting actions: fold, check, call, bet, raise, and all-in.
- Check is valid only when not facing a bet.
- Raise is valid only after betting has started; bet is used to open action.
- The current active player is the only one allowed to act.

## How You Can See Each Button Set

### To see GO/STAY/FOLD

1. Create or enter a table whose `gameSettings.game` is `357`.
2. Start a 357 cycle/hand.
3. Wait until it is your decision turn in a `decide_3`, `decide_5`, or `decide_7` phase.
4. The 357 action panel should show GO, STAY, and FOLD.

Note: the Home screen currently creates a local table with `game: '357'` and `mode: 'HOSTEST'`. In the local transport, that setting is applied and a 357 hand is auto-started.

### To see Fold/Check/Raise

1. Create or enter a standard non-357 table, normally Hold'em.
2. Start a hand.
3. Wait until it is your betting turn.
4. If there is no current bet to call, the middle button should show CHECK.
5. If another player has bet, the middle button should show CALL with the call amount.
6. The right button should show BET before betting starts or RAISE after betting starts. It may show ALL-IN if only all-in is available.

## Socket vs Local Transport Note

There is a behavioral difference worth checking manually:

- Local table creation applies `input.gameSettings` and auto-starts 357 if the input game is 357.
- Socket table creation sends `gameSettings` from the client, but the current server `player:create_room` handler creates a room without applying the payload settings. Since the engine default is Hold'em, socket-created rooms may default to standard controls unless settings are updated separately before the hand starts.

This may explain why different testers see different controls depending on local vs socket transport.

## Test Report

### Automated Checks Run

- `npm run test:357` passed. This validates the current 357 engine flow, including GO/STAY cycles, solo GO, no GO, reshuffle, tie handling, and leave-mid-round behavior.
- `npm run typecheck` passed. This validates the TypeScript project after this report-only change.

### Suggested Manual QA Tests

#### Test 1: 357 STAY

1. Start a local 357 table.
2. On your decision turn, press STAY.
3. Expected result: the turn advances; after reveal, your decision is STAY; you do not compete as a GO player.

#### Test 2: 357 FOLD

1. Start a local 357 table.
2. On your decision turn, press FOLD.
3. Expected current result: the turn advances exactly like STAY; after reveal, your decision should appear as STAY because the engine maps 357 FOLD to STAY.
4. If product expects FOLD to be visually distinct from STAY, this is not currently implemented.

#### Test 3: 357 GO

1. Start a local 357 table.
2. Press GO on one player and STAY/FOLD on all other players.
3. Expected result: solo GO wins the 357 pot and earns one leg.

#### Test 4: Standard CHECK

1. Start a standard Hold'em hand.
2. Reach a betting turn where there is no bet to call.
3. Expected result: the middle button shows CHECK; pressing it logs a check and advances action.

#### Test 5: Standard FOLD

1. Start a standard Hold'em hand.
2. On your betting turn, press FOLD.
3. Expected result: your standard hand player is marked folded; you no longer contest the pot.

#### Test 6: Standard RAISE/BET

1. Start a standard Hold'em hand.
2. If no current bet exists, the right button should show BET.
3. After a bet exists, the right button should show RAISE.
4. Open the raise panel, choose or enter a valid amount, and submit.
5. Expected result: the amount must satisfy current bet/min-raise rules, otherwise the engine rejects it.

## Risks / Open Questions

1. The label **FOLD** in 357 may be misleading because it is implemented as STAY.
2. If the desired design is truly only GO/STAY in 357, the extra FOLD button may need removal or relabeling.
3. If the desired design is true 357 folding, the engine must be changed to record FOLD distinctly and decide how FOLD affects eligibility, penalties, reveal text, and UI display.
4. Socket table creation should be reviewed if users expect the Home screen's 357 settings to apply on socket-created tables.

## Conclusion

Fold/Check/Raise have not replaced GO/STAY globally. The application currently has separate 357 and standard-poker control systems. In 357, GO/STAY are the real game decisions and FOLD is currently treated as STAY. In standard Hold'em-style play, Fold/Check/Raise are real betting actions and are enforced by the engine.
