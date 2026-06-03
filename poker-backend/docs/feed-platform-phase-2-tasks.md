# Phase 2 — Backend Feed Platform Tasks

This task backlog tracks the backend work still needed to turn the mocked player feed into a persisted, realtime platform. Each task should ship with API/socket contract tests, auth and authorization checks, and updates to client integration notes before being marked complete.

## Delivery order

1. Build the feed data model foundation.
2. Expose REST endpoints for feed reads and writes.
3. Add Socket.IO events for realtime post, comment, reaction, share, gift, promotion, and invite activity.
4. Persist all social actions and publish notifications.
5. Integrate feed actions with table invites, profiles, friends, chat rooms, and table discovery.

## Task cards

### BE-FEED-201 — Feed database models

- [ ] Create MongoDB/Mongoose models for feed posts, media attachments, post visibility, moderation state, counters, and audit metadata.
- [ ] Add indexes for author, visibility scope, created date, promoted placement, table references, and soft-deleted records.
- [ ] Define reusable serializers so REST and socket payloads return the same post shape expected by the mobile feed.
- [ ] Add seed/factory helpers for normal posts, table posts, promoted creator posts, and gift recap posts.
- [ ] Add model tests covering required fields, enum validation, counter defaults, soft delete behavior, and query indexes.

### BE-FEED-202 — Feed REST endpoints

- [ ] Mount authenticated feed routes under `/api/feed`.
- [ ] Implement endpoints to list the viewer feed, fetch a single post, create a post, edit/delete owned posts, and page by cursor.
- [ ] Support feed filters for global feed, friends, table-linked posts, promoted posts, and profile-specific feeds.
- [ ] Validate request bodies and query params with the existing validation middleware pattern.
- [ ] Add controller tests for auth failures, validation errors, pagination, ownership checks, and serialized response shape.

### BE-FEED-203 — Feed socket events

- [ ] Define Socket.IO event names and payload contracts for feed post creation, edits, deletes, counters, comments, reactions, shares, gifts, promotions, and table invites.
- [ ] Join users to feed rooms for global feed, profile feed, table feed, and post-detail subscriptions.
- [ ] Broadcast feed events only to authorized viewers based on visibility and relationship rules.
- [ ] Reconcile socket broadcasts with REST responses so optimistic client updates can be confirmed or rolled back.
- [ ] Add socket tests for room joins, authorization, event fanout, and disconnect cleanup.

### BE-FEED-204 — Comment persistence

- [ ] Create a feed comment model with parent post, author, body, reply threading hooks, moderation state, and soft deletion.
- [ ] Add REST endpoints and socket events for creating, listing, editing, deleting, and counting comments.
- [ ] Update post comment counters transactionally when comments are created or removed.
- [ ] Notify post owners when a comment is persisted, excluding self-comments.
- [ ] Add tests for comment CRUD, permissions, counter updates, notification creation, and realtime broadcasts.

### BE-FEED-205 — Support/reaction persistence

- [ ] Create a feed reaction model that supports the initial `support` action and can expand to more reaction types later.
- [ ] Add idempotent endpoints/events to add, change, and remove the viewer reaction on a post.
- [ ] Keep aggregate reaction counters consistent under repeated toggles and concurrent requests.
- [ ] Broadcast counter and viewer-state changes to subscribed post/feed rooms.
- [ ] Add tests for duplicate reactions, reaction removal, aggregate counters, authorization, and socket payloads.

### BE-FEED-206 — Share persistence

- [ ] Create a feed share model that records source post, actor, destination type, optional destination id, caption, and audit metadata.
- [ ] Add endpoints/events for share-to-feed, share-to-chat, share-to-table, and external share acknowledgement.
- [ ] Increment share counters only after the selected destination action succeeds.
- [ ] Enforce destination authorization before persisting private chat or table shares.
- [ ] Add tests for every destination type, invalid destinations, counter updates, and share notifications.

### BE-FEED-207 — Gift Clips transaction flow

- [ ] Define the Gift Clips domain model and ledger transaction shape for sender, recipient, clip amount, related feed post, and status.
- [ ] Implement an atomic debit/credit flow that verifies balances, records the transaction, and updates any post gift counters.
- [ ] Add REST and socket handlers for initiating a gift and receiving confirmation/failure payloads.
- [ ] Emit recipient notifications after the transaction commits, and emit sender failure notices when validation or balance checks fail.
- [ ] Add tests for successful gifts, insufficient balance, idempotency keys, transaction rollback, notifications, and realtime events.

### BE-FEED-208 — Promote the Creator payment/sponsorship flow

- [ ] Model creator promotion packages, sponsorship intents, payment provider references, campaign status, placement, budget, and expiry.
- [ ] Add endpoints for reading promotion packages, creating sponsorship intents, confirming payment, and listing creator sponsorship stats.
- [ ] Integrate payment webhooks so feed promotion state changes only after provider confirmation.
- [ ] Surface promoted posts in feed queries according to campaign status, placement rules, and viewer eligibility.
- [ ] Add tests for package validation, payment confirmation, webhook idempotency, campaign activation/expiry, and promoted feed ordering.

### BE-FEED-209 — Feed notifications

- [ ] Extend notification payloads for feed comments, support reactions, shares, Gift Clips, creator promotions, and table invites from feed cards.
- [ ] Create a feed notification service that centralizes actor, recipient, deep link, dedupe, and socket emit behavior.
- [ ] Prevent noisy self-notifications and duplicate notifications from retried requests or socket reconnects.
- [ ] Add notification read-state and deep-link metadata required by mobile screens.
- [ ] Add tests for notification creation, suppression rules, dedupe keys, socket emission, and serialized payload shape.

### BE-FEED-210 — Table invite integration

- [ ] Connect feed `invite to table` actions to the existing table invite and chat-room invite services.
- [ ] Validate invite eligibility from feed context, including active table, target player, chat room membership, and blocked/self-invite rules.
- [ ] Persist a feed-origin audit trail for invites launched from post cards.
- [ ] Broadcast `table:playerInvited` and feed notification events after the invite service accepts the request.
- [ ] Add tests for valid invites, invalid targets, duplicate invites, chat-room handoff, notifications, and socket fanout.

### BE-FEED-211 — Profile-open/friend/chat/table discovery integration

- [ ] Add backend discovery endpoints or payload expansions that let feed cards open player profiles, friend actions, direct chat, chat rooms, and tables.
- [ ] Include viewer-specific relationship state such as friend status, blocked status, active chat availability, and table eligibility in feed post serialization.
- [ ] Ensure discovery links respect privacy, visibility, and moderation rules before returning target metadata.
- [ ] Publish socket updates when relationship or table availability changes affect visible feed action state.
- [ ] Add tests for profile payloads, friend state, chat discovery, table discovery, privacy filtering, and stale target handling.

## Cross-cutting requirements

- [ ] Use authenticated player identity for all feed mutations and avoid trusting actor ids from clients.
- [ ] Add rate limits or abuse guards for high-volume actions such as comments, reactions, shares, gifts, promotions, and invites.
- [ ] Log security-relevant feed mutations to audit/event logs where comparable backend flows already do so.
- [ ] Keep REST and socket payload schemas documented in the same PR that introduces each event or endpoint.
- [ ] Update mobile TODO references when the corresponding backend contract is ready for client wiring.
