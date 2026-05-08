# House of Poker Codex Handoff Summary

## Purpose
This file converts the client notes from May 4-5, 2026 into isolated Codex prompts.

Use it like this:
- Paste one prompt at a time into Codex CLI or Codex Cloud.
- Run the prompts in order.
- Do not combine prompts in one Codex session.
- Use a separate branch or clean checkpoint per prompt.
- If a prompt depends on unfinished work, create the interface or placeholder only. Do not re-implement another prompt inside the current one.

## Current Repo Baseline
- The app is an Expo React Native client in `src/`.
- Gameplay currently runs locally through `src/context/PokerProvider.tsx`.
- A Socket.IO server already exists in `server/index.js` and `server/game.js`.
- The current playable MVP is Texas Hold'em. Do not break it while adding future-facing features.

## Global Product Rules
- Free-play only.
- No real-money gambling.
- No cash value.
- No cashout.
- `1 clip = 40 chips` is a virtual conversion only.
- Core game list: `357`, `Shanghai`, `In-Between the Sheets`.
- Hold'em can remain as the current MVP fallback until the new game engines are ready.
- Final table layout must be:
  - top chat bar
  - center perfect oval table
  - left invite and gift panel
  - right table info and game settings panel
  - bottom action controls
- No dealer box. Dealer indication is only a small dealer button near the player seat.
- Long-term product direction says no blinds globally, with a default minimum bet of 1 chip unless a specific game overrides it.
- AI may moderate chat and detect fraud or collusion, but it must never alter game outcomes.
- Play Store copy must clearly state no real money and no cash value, and the product should be positioned as 18+.

## Guardrails For Every Prompt
- Keep work inside the stated scope.
- Prefer adding focused components and services instead of inflating `GameScreen.tsx`.
- Keep data changes behind service or repository boundaries so later MongoDB work does not collide with UI work.
- Do not rewrite the full app architecture unless the prompt explicitly asks for it.
- Preserve existing navigation and current playable table flow unless the prompt explicitly changes it.

## Prompt 1 - Realtime Foundation
```text
Work inside the js-house-of-poker repo.

Goal
Create a transport boundary so the app can evolve from local gameplay state to Socket.IO-backed realtime state without forcing every screen to be rewritten.

Current repo facts
- `src/context/PokerProvider.tsx` currently runs gameplay fully on-device.
- `server/index.js` and `server/game.js` already contain a room and action Socket.IO server.
- `src/screens/HomeScreen.tsx` still describes the current app as a local MVP.

Scope
- Introduce a reusable gameplay transport or realtime service layer.
- Route `PokerProvider` through that layer.
- Keep `PokerRoomState` stable for existing screens where possible.
- Preserve the current table flow: create room, join room, start hand, action, rebuy, leave room.
- If server parity is not complete yet, keep a local adapter as a fallback instead of breaking the app.

Likely files in scope
- `src/context/PokerProvider.tsx`
- `src/types/poker.ts`
- `src/services/**`
- `server/index.js`
- `server/game.js`
- `src/screens/HomeScreen.tsx` only if room entry copy or UX must change

Out of scope
- No chat
- No invite or gift logic
- No game settings UI
- No clip wallet or ledger work
- No status system

Acceptance criteria
- Gameplay state comes through a clear abstraction rather than being hardcoded only in `PokerProvider`.
- The existing playable table still works.
- Later realtime features can attach to the same service layer without reworking the table screens again.
- The result reduces future overlap instead of creating a one-off path.
```

## Prompt 2 - Final Table Shell Layout
```text
Work inside the js-house-of-poker repo.

Goal
Reshape the gameplay screen into the final table shell:
- top chat bar
- center perfect oval table
- left invite and gift panel
- right table info and game settings panel
- bottom action controls

Scope
- This is a layout and presentation task only.
- Build reusable UI slots and components for the top, left, right, and bottom regions.
- Keep the current playable table and action controls working.
- Use placeholder props or mock data where later prompts will inject real feature state.
- Preserve the dealer button near the seat and remove any design that reads like a dealer box.

Likely files in scope
- `src/screens/GameScreen.tsx`
- `src/components/gameplay/GameplayLayout.tsx`
- `src/components/gameplay/TableSurface.tsx`
- new components under `src/components/gameplay/**`
- `src/components/GameScoreboard.tsx` if the right-side info panel is split out

Out of scope
- No socket event work
- No chat transport
- No invite business logic
- No wallet logic
- No game settings state
- No status evaluation work

Acceptance criteria
- Portrait and landscape layouts both work cleanly.
- The table remains the visual center and stays an oval with no dealer seat box.
- The left, right, and top regions exist as reusable shells ready for later prompts.
- Existing gameplay controls still work after the layout change.
```

## Prompt 3 - Game Settings And Stipulations Panel
```text
Work inside the js-house-of-poker repo.

Goal
Implement the right-side `GAME SETTINGS` panel and the room-state contract behind it.

Required controls
- game selector: `357`, `Shanghai`, `In-Between the Sheets`, `7/27`, `Hold'em`
- mode selector: `High Only`, `High/Low`, `Low Only`
- stipulation toggles:
  - `Hostest with the Mostest`
  - `Best Five Cards`
  - `Wild Cards`
  - `Suited Beats Unsuited`
- low rule selector: `8 or Better`, `Wheel`, `Any Low`
- wild card picker

Control rules
- Only the host can edit settings.
- Settings lock when a hand or game starts.
- Locked settings stay visible as read-only.
- Use Socket.IO event names `game:settings:update` and `game:settings:updated` if realtime transport is available.

Scope
- Add `gameSettings` to room state and server or provider logic.
- Build the right-side UI panel.
- Keep unsupported game variants from breaking the current Hold'em MVP.
- If a non-Hold'em engine is not implemented yet, show the setting safely and clearly instead of faking gameplay support.

Likely files in scope
- `src/types/poker.ts`
- `src/context/PokerProvider.tsx` or the realtime service introduced earlier
- `server/index.js`
- `server/game.js`
- new `src/components/gameplay/GameSettingsPanel.tsx`
- `src/screens/GameScreen.tsx`

Out of scope
- No full 357 engine in this prompt
- No chat
- No invite or gift work
- No wallet or ledger work
- No status system

Acceptance criteria
- The host can change settings before play starts.
- Other players see live updates as read-only.
- Settings lock once gameplay begins.
- The room state carries a clean shape such as:
  `gameSettings: { game, mode, stips, lowRule, wildCards, locked }`
- The current Hold'em flow does not break even if other game options are visible first.
```

## Prompt 4 - Variant Engine Foundation And 357
```text
Work inside the js-house-of-poker repo.

Goal
Create a variant-friendly game engine boundary and add the first non-Hold'em implementation for `357`.

357 product rules to support
- solo win earns 1 leg
- first to 4 legs wins the pot
- ante happens every deal cycle
- multiple-player end states should follow the documented 357 rules without inventing unsupported house rules

Scope
- Separate game-variant logic from the current Hold'em path.
- Keep Hold'em working as its own engine path.
- Add room-state fields needed for 357 progress, including leg tracking and status text.
- If one 357 payout detail is still ambiguous in the repo notes, keep that rule configurable and document the assumption instead of silently inventing behavior.

Likely files in scope
- `server/game.js`
- `src/game/**`
- `src/types/poker.ts`
- `src/context/PokerProvider.tsx` or the realtime service layer
- any new variant modules under `src/game/` or `server/`

Out of scope
- No table shell redesign
- No chat
- No invite or gift work
- No wallet or ledger work
- No status system

Acceptance criteria
- Hold'em still works.
- 357 has an isolated rules path rather than being mixed into Hold'em conditionals everywhere.
- Room state exposes enough information for the UI to show legs, ante progression, and game phase.
- The code is structured so `Shanghai` and `In-Between the Sheets` can be added later without another rewrite.
```

## Prompt 5 - Top Bar Chat
```text
Work inside the js-house-of-poker repo.

Goal
Implement the top chat bar as a realtime table chat with emoji support and a scrollable feed.

Scope
- Build the chat UI in the top bar shell from the layout prompt.
- Add transport and room-state support for table chat messages.
- Keep the chat scoped to the active table or room.
- Use event names that are clear and consistent with the existing realtime contract.
- If moderation is not ready yet, leave clean extension points but do not build AI in this prompt.

Likely files in scope
- `src/screens/GameScreen.tsx`
- new `src/components/gameplay/TableChatBar.tsx`
- `src/types/poker.ts`
- the realtime service or `PokerProvider`
- `server/index.js`
- maybe a new server-side chat helper

Out of scope
- No invite-from-chat yet
- No AI moderation yet
- No wallet or gift logic
- No status logic
- No social feed work

Acceptance criteria
- Players can send and receive messages in the active table.
- Emoji input or emoji insertion works.
- The feed scrolls correctly and does not break the table layout.
- Chat remains isolated from invite, gift, and gameplay engine work.
```

## Prompt 6 - Clip Economy, Ledger, And Anti-Abuse Rules
```text
Work inside the js-house-of-poker repo.

Goal
Add the core virtual economy domain for clips and chips.

Required business rules
- `1 clip = 40 chips`
- clips are virtual only
- no cash value
- no cashout
- ledger must record:
  - purchase
  - gift
  - gift buy-in
  - weekly reload
  - table buy-in
  - admin grant
- anti-abuse rules:
  - max 500 clips gifted per day
  - max 10 gifts per day
  - gift cooldown
  - gifting limited to friends, invited players, or same-table players
- weekly reload: 100 clips on Friday at 12:01 AM

Scope
- Implement the economy domain and validation layer first.
- Add repository or service boundaries so persistence can be swapped later.
- If MongoDB is not already wired in this repo, provide a clean in-memory adapter plus Mongo-ready interfaces instead of coupling UI directly to storage.
- Expose only the minimal client-facing state needed for later prompts.

Likely files in scope
- `server/**`
- `src/types/**`
- `src/services/**`
- new economy or ledger modules

Out of scope
- No left-panel invite UI yet
- No social directory
- No full store or billing flow
- No status badges
- No AI

Acceptance criteria
- Balance mutations flow through one economy path.
- Every mutation creates a ledger entry.
- Gift limits and cooldowns are enforced in one place.
- The design is ready for later UI integration without duplicating business rules.
```

## Prompt 7 - Left Panel Invite And Gift Flow
```text
Work inside the js-house-of-poker repo.

Goal
Implement the on-table left panel for invite and optional gift buy-in.

Scope
- Use the left-side shell from the layout prompt.
- Build invite UI plus optional clip gift amount selection.
- Connect the flow to the economy rules from the clip and ledger prompt.
- Show explicit compliance copy such as `Clips are virtual only and have no cash value.`
- Keep the recipient-selection layer abstract if the full social graph is not ready yet.

Likely files in scope
- `src/screens/GameScreen.tsx`
- new `src/components/gameplay/InviteGiftPanel.tsx`
- `src/types/**`
- the realtime service or `PokerProvider`
- `server/**` for invite or gift event handling

Out of scope
- No global player directory in this prompt
- No social feed
- No status system
- No AI moderation
- No duplicate wallet logic outside the economy service

Acceptance criteria
- A player can open the left panel and prepare an invite with or without a gift buy-in.
- Gift validation uses the central economy rules.
- The UI clearly shows virtual-only language.
- This prompt does not re-implement wallet rules or social graph logic.
```

## Prompt 8 - Status System With Low Roller And Mid Roller
```text
Work inside the js-house-of-poker repo.

Goal
Implement the player status system and add the missing grind tiers `Low Roller` and `Mid Roller`.

Required statuses
- `NO_STATUS`
- `LOW_ROLLER`
- `MID_ROLLER`
- `UP_AND_COMING`
- `HIGH_ROLLER`
- `SHARK`

Required product rules
- status is earned, not universal
- show it as a small bubble near the avatar, not a separate big panel
- status can influence reputation, invite priority, and later leaderboards
- beating stronger tables, especially Sharks, should matter
- promotion and demotion should be based on a configurable recent-performance window

Scope
- Add status types and evaluation logic.
- Expose status through room or player state.
- Render the badge or bubble near the seat avatar.
- Keep thresholds configurable instead of hardcoding magic numbers everywhere.

Likely files in scope
- `src/types/poker.ts`
- `src/components/ClassicPlayerSeat.tsx`
- `src/components/PlayerAvatar.tsx`
- `src/utils/pokerTable.ts`
- `server/**` or service modules for evaluation

Out of scope
- No full leaderboard screen
- No social feed
- No invite flow rewrite
- No AI ranking insights yet

Acceptance criteria
- The new low and mid tiers exist end-to-end.
- Status is visible as a compact avatar-adjacent bubble.
- Evaluation logic lives in one place and is configurable.
- The current seat UI stays readable and does not become overcrowded.
```

## Prompt 9 - Social Surface And Compliance Sweep
```text
Work inside the js-house-of-poker repo.

Goal
Add the first social product surfaces and align app copy with Play Store-safe language.

Social scope
- player profile shell
- friends shell
- posts or feed shell
- player directory shell
- entry points for invite-from-posts and invite-by-username without duplicating the table invite logic

Compliance scope
- make sure key screens clearly state:
  - no real-money gambling
  - no cash value
  - free-play positioning
  - 18+ positioning where appropriate

Likely files in scope
- `src/screens/HomeScreen.tsx`
- `src/screens/WelcomeScreen.tsx`
- `src/screens/LoginScreen.tsx`
- `src/screens/RegistrationScreen.tsx`
- navigation files
- new social screens or components

Out of scope
- No table chat rewrite
- No gameplay engine changes
- No wallet business-rule rewrite
- No AI moderation in this prompt

Acceptance criteria
- The app has clear social entry points without tangling them into table gameplay code.
- Compliance copy is visible and consistent.
- Invite hooks point to the shared invite flow instead of creating a second invite system.
```

## Phase 2 Prompts - Keep Separate From Phase 1
- AI moderation for table chat
- fraud and collusion detection
- ranking insights such as hot player, rising player, and dangerous player
- production MongoDB persistence if Phase 1 used in-memory or interface-backed adapters first
- additional game engines for `Shanghai` and `In-Between the Sheets`

## Final Product Reminders
- The core growth loop is still:
  `Invite -> Gift -> Play -> Win -> Status -> More Invites`
- The final product is not just a poker table. It is a social free-play poker ecosystem.
- Do not let one prompt quietly absorb another prompt's work. That is how merge conflicts and broken scope happen.
