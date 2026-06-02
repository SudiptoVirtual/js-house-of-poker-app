# Jshouseofpoker App — Client Weekend Requirements Summary

## Purpose

- Summarize the client’s weekend requirement messages into a clear developer handoff.
- Capture the current product direction: Jshouseofpoker App is expanding from a poker-only application into a social gaming platform.
- Provide an implementation-oriented overview that can be shared with product, design, backend, frontend, QA, and admin stakeholders.

## Product Direction

- Jshouseofpoker App should feel like a complete social poker community, not just a table lobby.
  - Players should have reasons to stay active even when they are not currently playing a hand.
  - The platform should combine a social network, chat community, game platform, player discovery system, content feed, poker lobby, and live table experience.
- The main user loop should connect the social and game areas together.
  - Feed Post → Profile → Chat Room → Table.
  - Example flow:
    - A player creates a post.
    - Another player comments or supports it.
    - The players become friends.
    - They join a chat room.
    - Someone creates a 357 table.
    - The chat room members move directly into the game.
- The lobby should preserve the current “house of poker” feeling.
  - The client likes the lobby atmosphere and wants future social additions to complement that identity.

## Primary App Areas

- Player Feed.
  - Facebook-style feed experience branded for Jshouseofpoker App.
  - Familiar post cards, reactions, comments, sharing, and table invites.
- Chat Rooms.
  - Main social hub where players gather first.
  - Players should talk, meet people, hang out, discuss games, and organize tables naturally.
- Friends System.
  - Online friends shown automatically.
  - Search by name or username for offline friends and other players.
  - Quick invites to chat rooms and tables.
- Player Profiles.
  - Profile posts, stats, chip or clip count, badges, cover photos, and social discovery.
- Live Tables / The Floor.
  - Live table area with real-player availability protected from bot overfill.
  - AI should monitor open seats, bot-filled tables, suspicious play, chat issues, and tables needing real players.
- Backend / Admin Controls.
  - Admin broadcast messaging into table chat bars.
  - Audit logs, permissions, rate limits, safety filters, and future scheduling.
- A.I. Prime.
  - Platform-wide assistant available inside chat, table, profile, feed, recommendations, translation, moderation, and support workflows.

## 1. Chat Rooms and Chat Room to Table Flow

- Chat rooms are the main priority.
  - Players should enter chat rooms first to talk, meet others, build interest, and organize games.
  - Creating a table should feel like a natural option after conversation, not the primary screen.
- Required flow.
  - Enter Chat Room.
  - Pick Game.
  - Set Table Tier / Rules.
  - Invite Room Players.
  - Launch Table.
- Chat room interface requirements.
  - Create Table button.
  - Invite to Table button.
  - Game selection.
  - Table tier selection.
  - Private or public table option.
  - Player list.
  - Message notification support.
  - Direct move from chat room into the live table UI.
- Expected user experience.
  - A player joins a room to socialize.
  - Room members discuss what to play.
  - A player creates or configures a table from inside the room.
  - Room members receive invites.
  - Players move directly into the live table.

## 2. Facebook-Style Player Feed

- The feed should feel familiar, similar to Facebook, while being branded for Jshouseofpoker App.
- Required feed structure.
  - Post box at the top.
  - Scrolling post cards.
  - Player avatar.
  - Player name.
  - Player status.
  - Likes, reactions, or Supporters.
  - Comments.
  - Share / promote options.
  - Invite to Table option.
- Feed card actions.
  - Support.
  - Comment.
  - Share.
  - Gift Clips.
  - Promote for Creator.
  - Invite to Table when relevant.
- Feed should support social discovery.
  - Posts should lead users to profiles.
  - Profiles should lead to friend requests, chat rooms, and tables.
  - Posts can help fill tables through shares, invites, and promotions.

## 3. Friends Area and Player Search

- Online friends should be shown by default.
  - The default Friends area should not show offline friends or random players.
  - Online friends should have fast action buttons.
- Required quick actions for online friends.
  - Chat Invite.
  - Table Invite.
- Search by Name / Username is required.
  - Players can search for offline friends and other players.
  - Search results should support:
    - Viewing profiles.
    - Sending friend requests.
    - Inviting players to chat rooms.
    - Inviting players to tables.
- Expected behavior.
  - Default view = online friends only.
  - Search view = offline friends and wider player discovery.

## 4. Player Profiles

- Profiles should support social identity and discovery.
- Required profile elements.
  - Profile posts.
  - Player stats.
  - Chip or clip count.
  - Status badges.
  - Cover photos.
  - Social visibility.
- Community metrics to consider.
  - Total Supporters.
  - Monthly Supporters.
  - Top Supported Posts.
  - Top Supporters.
  - Clips Received From Supporters.
- Profiles should connect into the wider loop.
  - From a profile, players should be able to send friend requests, invite to chat rooms, invite to tables, view posts, and discover status or performance.

## 5. Admin Chat Broadcast Feature

- Add a backend Admin section that lets the site owner send messages directly into table chat bars.
- Admin broadcast modes.
  - Global Message:
    - Sends one admin message to all active table chat bars at once.
  - Table-Specific Message:
    - Selects one table and sends the message only to that table’s chat bar.
- Message display requirement.
  - Messages should be clearly marked as `ADMIN MESSAGE`.
- Backend requirements.
  - Admin-only permission checks.
  - Select all tables or one table.
  - Message text box.
  - Send now button.
  - Optional schedule later feature.
  - Socket.IO event to push messages live.
  - Audit log showing who sent the message, when it was sent, and where it was sent.
  - Rate limits to prevent spam.
  - Moderation and safety filter before sending.
- Business use cases.
  - Site announcements.
  - Ads and promotions.
  - Updates.
  - Tournament-style alerts.
  - Support messages.
  - Sponsor posts inside table chat.

## 6. Social Table Promotion System

- When a player creates a table, they can optionally purchase a Table Promotion Campaign.
  - Example fixed fee: $2.
  - Higher tiers may include $5 Featured Promotion and $10 Top Feed Placement.
- Promotion placements.
  - Facebook-style player feed.
  - Chat rooms.
  - Player directory highlights.
  - Selected table lobbies.
- Targeting options.
  - All players.
  - Players with a minimum clip balance.
  - Players within a clip range, such as 100–1,000 clips or 1,000–10,000 clips.
  - High Roller players.
  - Shark players.
  - Up & Coming players.
  - Friends only.
  - Specific game players, such as 357, Shanghai, 7/27, or In-Between the Sheets.
  - Multiple targets combined.
- Automatic shutoff requirement.
  - Promotion status = Active while the table has open seats.
  - Promotion status = Complete once the table fills up.
  - The ad should automatically stop when the final seat is taken.
  - This prevents players from paying for impressions after the table is full.
- Gift Clip promotion incentives.
  - Hosts can attach incentives to promoted tables.
  - Examples:
    - “Join this table and receive 50 clips.”
    - “First 3 players receive 100 clips.”
    - “High Roller table — 500 clip welcome gift.”
  - Promotions should only display to qualified players based on targeting rules.
- Revenue opportunities.
  - Standard table promotion.
  - Featured promotion.
  - Top feed placement.
  - Sponsored chat room placement.
  - Priority directory placement.

## 7. The Floor, Bots, and Real Player Seat Protection

- The Floor means the live table area.
- Before bots fill a table, the system should keep an open seat available for real players.
  - Bots should support action without blocking human users from joining.
- AI monitoring should watch The Floor for:
  - Open seats.
  - Bot-filled tables.
  - Player traffic.
  - Suspicious play.
  - Chat problems.
  - Tables needing real players.
  - When to add bots.
  - When to remove bots.
- Product intent.
  - Bots are used to keep games moving.
  - Real players should always have access to available action where possible.

## 8. Enhanced Support System and Community Supporters

- Replace basic “likes” language with community-focused “Supporters” language.
  - Use “250 Supporters” instead of “250 Supports.”
  - This makes interactions feel more like community backing than a simple like count.
- Support action.
  - Free reaction.
  - Adds the player to the supporter count.
  - Can show activity such as “Ra Frost supported this post.”
- Post statistics can include:
  - Supporters.
  - Comments.
  - Shares.
  - Clips Gifted.
  - Sponsored by number of players.
- Enhanced support actions.
  - Support a post.
  - Gift clips to a post creator.
  - Promote another player’s post.
  - Sponsor a player’s table advertisement.
  - Boost a tournament, game room, or chat room announcement.
  - Help new players gain visibility.
- Safety controls.
  - Daily gifting limits.
  - Anti-spam protections.
  - Fraud detection.
  - Promotion approval rules.
  - Audit logs.
  - Blocked-user restrictions.
  - AI monitoring for suspicious gifting patterns.

## 9. Gift Clips as a Premium Feed Action

- Gift Clips should be a visible premium action on the post card, not hidden in a menu.
- Suggested post card action row.
  - Support.
  - Comment.
  - Share.
  - Gift Clips.
  - Invite to Table when applicable.
- Gift Clips panel requirements.
  - Title: Gift Clips to This Player.
  - Gift amount selector.
  - Preset buttons:
    - 100 clips.
    - 500 clips.
    - 1,000 clips.
    - 5,000 clips.
    - 10,000 clips.
    - Custom amount.
  - Optional message field.
    - Example messages: “Great post!”, “Good luck at the tables!”, “Welcome to Jshouseofpoker!”
  - Send Gift button.
- Feed statistics example.
  - 250 Supporters.
  - 42 Comments.
  - 17 Shares.
  - 35,000 Clips Gifted.
  - Sponsored by 8 Players.
- Leaderboards to consider.
  - Most Supported Posts.
  - Most Shared Posts.
  - Most Gifted Posts.
  - Top Supporters.
  - Top Clip Givers.
  - Top Community Builders.

## 10. Sharing and Advertising Separation

- Keep community, visibility, advertising, and gifting actions separate.
  - Support = community encouragement.
  - Share = visibility.
  - Promote for Creator = paid advertising sponsorship.
  - Gift Clips = direct premium help.
- Share menu options.
  - Copy Link.
  - Share to Facebook.
  - Share to Messenger.
  - Share to Profile.
  - Share to Feed.
  - Share to Chat Room.
  - Share to Table.
  - Promote for Creator.
- Share to Facebook behavior.
  - Generate a shareable link.
  - Open Facebook’s share dialog with that link.
  - Facebook should display the title, image or thumbnail, short description, and link back to Jshouseofpoker App.
- Copy Link importance.
  - Players can paste links into Facebook, Messenger, text messages, Discord, X, Reddit, email, and other platforms.
  - Copy Link and Share to Facebook should be standard free options.
  - Promote for Creator should remain a paid option.
- Marketing benefit.
  - Shared links can bring new players, returning players, table participants, chat room members, profile views, Supporters, and clip purchases.
  - Players effectively become an organic marketing channel when sharing is effortless.

## 11. Promote for Creator

- Promote for Creator should live inside the Share flow, not inside Support.
- Purpose.
  - A player can pay to help another player’s post reach more people.
  - The paying player sponsors the original creator’s visibility rather than promoting themselves.
- Promotion examples.
  - $2 Promotion.
  - $5 Promotion.
  - $10 Promotion.
- Sponsored post statistics can display:
  - Supporters.
  - Comments.
  - Shares.
  - Sponsored by number of players.
  - Clips Gifted.
- Product value.
  - Great posts can receive support, gifts, shares, and sponsored promotion from other players.
  - The original creator can gain reach without personally spending money.

## 12. A.I. Prime Chat Room Integration

- A.I. Prime should be built into every chat and message screen as a visible AI button.
- Placement.
  - Near the message input area.
  - Suggested layout: Message Box | Emoji | A.I. Prime | Send.
  - Also available when a user taps or long-presses a message.
- Core capabilities.
  - Real-time translation.
  - Show Original / Show Translation / Show Both.
  - Message rewriting.
  - Punctuation correction.
  - Summarizing long chats.
  - Explaining game rules.
  - Helping create posts.
  - Helping create table invites.
  - Recommending friends.
  - Recommending tables on The Floor.
  - Helping users understand clip packages, statuses, and platform features.
- Translation controls.
  - Translate This Message.
  - Auto-Translate Chat.
  - Show Original.
  - Show Both.
  - Change Language.
- User language support.
  - Each user should have a preferred language setting.
  - Messages can be translated into each user’s selected language.
- AI actions on selected messages.
  - Translate.
  - Explain.
  - Summarize.
  - Rewrite.
  - Report.
  - Ask A.I. Prime.
- AI moderation scope.
  - Spam.
  - Scams.
  - Harassment.
  - Hate speech.
  - Impersonation.
  - Porn or explicit content.
  - Unsafe advertising.
  - Suspicious behavior.
  - Bot-like abuse.
- Moderation approach.
  - Flagged content should go to admin review.
  - Automatic punishment should be reserved for severe violations.
- Table discovery support.
  - A.I. Prime should help players find tables using preferred games, clip balance, player status, open seats, friend activity, chat room activity, recommended tables, and AI-monitored table health.
  - Example prompt: “Find me a 357 table with open seats.”
  - A.I. Prime should return matching active tables and allow the player to join or invite friends.
- Chat room to table support.
  - A.I. Prime can help users invite players, create tables, share table links, promote tables, gift clips, and set up games.
- Product positioning.
  - A.I. Prime should be a platform-wide assistant, not just a chatbot.
  - It should connect chat rooms, The Floor, player profiles, posts, table invites, translation, moderation, and recommendations.

## 13. Notifications and Messages

- The client specifically requested notifications to messages.
- Expected notification areas.
  - New chat room messages.
  - Chat invites.
  - Table invites.
  - Friend requests.
  - Post comments.
  - Supporter activity.
  - Gift Clip activity.
  - Promotion or sponsored post activity.
  - Admin broadcast messages where appropriate.
- Notifications should help connect the full loop.
  - Feed activity can pull users into profiles.
  - Profile and friend activity can pull users into chat rooms.
  - Chat activity can pull users into tables.

## 14. Implementation Priority Recommendation

- Phase 1: Chat-room-first social hub.
  - Chat room list and room UI.
  - Player list.
  - Message notifications.
  - Create Table and Invite to Table controls inside the chat room.
  - Direct navigation from chat room to live table UI.
- Phase 2: Feed and social actions.
  - Post box.
  - Scrolling post cards.
  - Supporters, comments, shares, Gift Clips, and Invite to Table.
  - Share menu with Copy Link and Share to Facebook.
- Phase 3: Friends search and profiles.
  - Online friends default view.
  - Search by name / username.
  - Profile viewing, friend requests, chat invites, and table invites.
- Phase 4: Admin broadcast system.
  - Admin-only backend UI or endpoint.
  - Global/table-specific chat broadcast.
  - Socket.IO delivery, audit logs, rate limits, and moderation filters.
- Phase 5: Promotions and monetization.
  - Table promotion campaigns.
  - Promote for Creator.
  - Gift Clip promotions and incentives.
  - Automatic campaign shutoff when a table fills.
- Phase 6: A.I. Prime and advanced moderation.
  - Translation.
  - Message assistance.
  - AI table recommendations.
  - Moderation queues.
  - Bot and table-health monitoring.

## 15. Key Takeaway

- The client does not expect everything to be completed overnight.
- The biggest immediate direction is to make Jshouseofpoker App feel like a community-first social poker platform.
- The strongest product loop is:
  - Player Feed → Player Profile → Chat Room → Live Table.
- Chat rooms should be the first major focus because they create the social bridge between casual conversation and live gameplay.
