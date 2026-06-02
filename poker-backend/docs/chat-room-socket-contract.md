# Chat Room Realtime Contract

This contract aligns the frontend chat room placeholders with the backend Socket.IO implementation. Event names in this document are the canonical names for real Chat Room socket integration and intentionally match the frontend placeholder constants in `js-house-of-poker/src/services/chatRooms/events.ts`.

## Scope and transport

- Transport: Socket.IO on the backend server that also serves the REST API.
- Namespace: default Socket.IO namespace (`/`).
- Chat Room socket channel naming is backend-internal: `chat:room:<chatRoomId>`.
- Public client code should use the event names below, not the internal room channel name.
- Chat Room identifiers accepted by socket payloads are normalized from `chatRoomId`, `sourceRoomId`, `chatRoomRoomId`, or `roomId`. Prefer `chatRoomId` for new frontend code.
- Table identifiers accepted by invite payloads are normalized from `tableId`, `tableCode`, or `createdTableId`. Prefer `tableId` for new frontend code.

## Authentication requirements

### Socket authentication

All server-received Chat Room socket events that read or mutate user state authenticate the socket user. The backend accepts a JWT user token from the first available source:

1. `payload.token`
2. `payload.authToken`
3. `socket.handshake.auth.token`
4. `Authorization: Bearer <token>` socket handshake header

The token must verify with `JWT_SECRET`, contain `type: "user"`, map to an existing non-blocked user, and may be cached on `socket.data.userId` after the first successful authentication.

### REST authentication

The public Chat Room discovery endpoints listed below do not currently require user auth middleware. Admin Chat Room endpoints are out of scope for this frontend Chat Room socket contract.

## REST endpoints

Base path: `/api/chat-rooms`

| Method | Path | Purpose | Query/body | Success response | Error responses |
| --- | --- | --- | --- | --- | --- |
| `GET` | `/api/chat-rooms` | List visible Chat Rooms. | Query: `limit` positive integer, default `50`, max `100`. | `200 { count: number, rooms: ChatRoomListItem[] }` | `500 { message: "Error fetching chat rooms", error: string }` |
| `GET` | `/api/chat-rooms/:roomId` | Fetch detail for one Chat Room/open fallback table. | Path: `roomId`. Query: `messageLimit` positive integer, default `25`, max `100`. | `200 { room: ChatRoomDetail }` | `404 { message: "Chat room not found" }`; `500 { message: "Error fetching chat room", error: string }` |
| `POST` | `/api/chat-rooms/dev/seed-defaults` | Seed default Chat Rooms in non-production environments only. | No required body. | `201 { count, matchedCount, modifiedCount, upsertedCount, rooms }` | `403 { message: "Default chat room seeding is disabled in production." }`; `500 { message: "Error seeding default chat rooms", error: string }` |

### `ChatRoomListItem`

```ts
type ChatRoomListItem = {
  activePlayerCount: number;
  gameType?: string;
  id: string;
  maxPlayers?: number;
  name: string;
  phase?: string;
  recentMessagePreview: null | {
    createdAt: string | number | Date;
    playerName: string;
    text: string;
    tone: 'player' | 'system' | string;
  };
  roomId: string;
  status?: string;
  tableCode?: string | null;
  tableName?: string;
  unreadCount: number;
};
```

### `ChatRoomDetail`

```ts
type ChatRoomDetail = {
  activePlayers: ChatRoomPlayer[];
  metadata: {
    bigBlind?: number;
    buyInAmount?: number;
    createdAt?: string | Date;
    gameSettings?: Record<string, unknown>;
    gameType?: string;
    handCount?: number;
    hostUserId?: string | null;
    id: string;
    lastWinnerSummary?: unknown | null;
    maxPlayers?: number;
    minPlayersToStart?: number;
    name: string;
    phase?: string;
    pot: number;
    roomId: string;
    smallBlind?: number;
    status?: string;
    tableCode?: string | null;
    tableName?: string;
    updatedAt?: string | Date;
  };
  presenceSnapshot: ChatRoomPresenceSnapshot;
  recentMessages: ChatRoomMessage[];
  roomId: string;
  unreadCount: number;
};
```

## Socket events received by server

These are the event names the frontend emits to the server. Every server-received event supports a Socket.IO acknowledgement callback. Successful acknowledgements include `ok: true`; most also include `success: true`. Failed acknowledgements are documented in [Error payloads](#error-payloads).

| Event | Purpose | Payload | Success acknowledgement |
| --- | --- | --- | --- |
| `chat:joinRoom` | Join the authenticated user to a Chat Room channel, track presence, mark notifications read, and hydrate recent messages. | `JoinRoomPayload` | `JoinRoomAck` |
| `chat:leaveRoom` | Leave a Chat Room channel and remove this socket from presence. | `LeaveRoomPayload` | `LeaveRoomAck` |
| `chat:sendMessage` | Send a player chat message to the room. | `SendMessagePayload` | `SendMessageAck` |
| `chat:typing` | Broadcast typing state to other room members. | `TypingPayload` | `TypingAck` |
| `table:createFromChatRoom` | Launch a poker table from a Chat Room. | `CreateTableFromChatRoomPayload` | `CreateTableFromChatRoomAck` |
| `table:inviteRoomPlayers` | Invite selected Chat Room players to an existing launched table. | `InviteRoomPlayersPayload` | `InviteRoomPlayersAck` |

### Server-received payload schemas

```ts
type AuthFields = {
  token?: string;
  authToken?: string;
};

type RoomIdentifierFields = {
  chatRoomId?: string;
  sourceRoomId?: string;
  chatRoomRoomId?: string;
  roomId?: string;
};

type JoinRoomPayload = AuthFields & RoomIdentifierFields;

type LeaveRoomPayload = RoomIdentifierFields;

type SendMessagePayload = AuthFields & RoomIdentifierFields & {
  text?: string;
  message?: string;
  body?: string;
};

type TypingPayload = AuthFields & RoomIdentifierFields & {
  isTyping?: boolean; // defaults to true unless explicitly false
};

type CreateTableFromChatRoomPayload = AuthFields & RoomIdentifierFields & {
  gameSettings: ChatRoomGameSettings;
  invitedPlayerIds?: string[]; // valid user ObjectIds only
  name?: string;
  rules?: Record<string, unknown> | null;
  seatIndex?: number;
  tableName?: string;
  tableTier?: string | number;
  tableTierId?: string | number;
  visibility?: 'room' | 'private' | 'public' | string;
};

type InviteRoomPlayersPayload = AuthFields & RoomIdentifierFields & {
  tableId?: string;
  tableCode?: string;
  createdTableId?: string;
  playerIds?: string[];
  invitedPlayerIds?: string[];
  alreadyInvitedPlayerIds?: string[];
  message?: string; // trimmed, compacted, max 120 chars after normalization
};
```

### `ChatRoomGameSettings`

The backend validates `payload.gameSettings` when launching a table from Chat Room. Frontend should send the game selection exactly as the poker transport already prepares it.

```ts
type ChatRoomGameSettings = {
  game: string; // e.g. '357' for 3-5-7
  mode?: string;
  [key: string]: unknown;
};
```

## Socket events emitted by server

These are the event names the frontend listens for from the server.

| Event | Emitted to | Purpose | Payload |
| --- | --- | --- | --- |
| `chat:joinedRoom` | Joining socket | Confirms room join and hydrates room state. | `JoinRoomAck` |
| `chat:leftRoom` | Leaving socket | Confirms room leave and returns updated presence. | `LeaveRoomAck` |
| `chat:activePlayers` | Room channel | Presence snapshot update after join/leave/disconnect. | `ChatRoomPresenceSnapshot` |
| `chat:presence` | Room channel | Same presence snapshot as `chat:activePlayers`; kept for clients that prefer presence naming. | `ChatRoomPresenceSnapshot` |
| `chat:notificationsRead` | Joining socket | Confirms unread message notifications were marked read on join. | `NotificationsReadPayload` |
| `chat:newMessage` | Room channel | New player message or system launch message. | `NewMessagePayload` |
| `chat:messageNotification` | Recipient sockets | Notification for unread chat messages, table invites, or table launches. | `MessageNotificationPayload` |
| `chat:typing` | Other sockets in room channel | Typing state from a peer. | `TypingPayloadEmitted` |
| `table:launchFromChatRoom` | Launcher socket, room peers, online invited sockets | Table launch announcement and navigation target. | `LaunchFromChatRoomPayload` |
| `table:playerInvited` | Invited recipient sockets and inviting socket | Table invite notification/result. | `PlayerInvitedPayload` or `InviteRoomPlayersEventPayload` |
| `chat:error` | Originating socket | Chat Room operation error. | `RealtimeErrorPayload` |
| `room:error` | Originating socket | Room-level operation error alias. | `RealtimeErrorPayload` |
| `table:error` | Originating socket | Table operation error alias. | `RealtimeErrorPayload` |

## Shared payload schemas

```ts
type ChatRoomMessage = {
  authorId: string | null;
  authorName: string;
  body: string;
  createdAt: string;
  id: string;
  moderation: {
    flags: string[];
    reason: string | null;
    reviewedAt: string | null;
    status: 'accepted' | 'pending-review' | 'blocked' | string;
  };
  playerId: string | null;
  playerName: string;
  roomId: string;
  text: string;
  tone: 'player' | 'system' | string;
  launchContext?: LaunchFromChatRoomPayload;
};

type ChatRoomPlayer = {
  avatarInitials?: string;
  chipStackLabel?: string;
  displayName: string;
  handle?: string;
  id: string;
  isConnected: boolean;
  joinedAt?: string;
  socketCount?: number;
  status?: string;
  userId: string;
};

type ChatRoomPresenceSnapshot = {
  activePlayerCount: number;
  inviteEligibility?: {
    eligiblePlayerIds: string[];
    ineligiblePlayerIds: string[];
    invitedPlayerIds: string[];
    reasonByPlayerId: Record<string, string>;
  };
  maxPlayers?: number;
  players: ChatRoomPlayer[];
  roomId?: string;
  totalPlayerCount?: number;
  updatedAt?: string | Date;
};
```

## Acknowledgement and emitted payload schemas

```ts
type JoinRoomAck = {
  activePlayers: ChatRoomPlayer[];
  messages: ChatRoomMessage[];
  ok: true;
  playerId: string;
  players: ChatRoomPlayer[];
  presenceSnapshot: ChatRoomPresenceSnapshot;
  readAt: Date | string | null;
  roomId: string;
  success: true;
  unreadCount: 0;
};

type LeaveRoomAck = {
  activePlayers: ChatRoomPlayer[];
  ok: true;
  players: ChatRoomPlayer[];
  presenceSnapshot: ChatRoomPresenceSnapshot;
  roomId: string;
  success: true;
};

type SendMessageAck = {
  ok: true;
  success: true;
  message: ChatRoomMessage;
  roomId: string;
};

type NewMessagePayload = {
  message: ChatRoomMessage;
  roomId: string;
};

type TypingPayloadEmitted = {
  isTyping: boolean;
  playerId: string;
  playerName: string;
  roomId: string;
  userId: string;
};

type TypingAck = {
  ok: true;
  success: true;
} & TypingPayloadEmitted;

type NotificationsReadPayload = {
  modifiedCount: number;
  readAt: Date | string | null;
  roomId: string;
  unreadCount: 0;
};

type LaunchFromChatRoomPayload = {
  chatRoomId: string;
  createdAt: string;
  createdByPlayerId: string;
  deliveredPlayerIds?: string[];
  gameSettings: ChatRoomGameSettings;
  invitedPlayerIds: string[];
  launchedAt: string;
  launchedByUserId: string;
  recipient?: true;
  roomId: string; // poker table code used for realtime join/navigation
  sender?: true;
  success: true;
  tableCode: string;
  tableDbId: string;
  tableId: string; // same realtime table id/code as roomId
  tableName: string;
  tableTier: string | number | null;
  visibility: string;
};

type CreateTableFromChatRoomAck = {
  ok: true;
} & LaunchFromChatRoomPayload;

type InviteRecord = {
  createdAt: string | number | Date;
  giftBuyInChips: number;
  giftBuyInClips: number;
  id: string;
  message: string | null;
  recipientAccountId: string;
  recipientHandle?: string;
  recipientLabel?: string;
  senderPlayerId: string;
  senderPlayerName: string;
  source: 'chat-room' | 'friend-list' | string;
  status: 'pending' | string;
};

type InviteResult = {
  inviteId?: string;
  ok: boolean;
  playerId: string;
  reason?:
    | 'invalid-player-id'
    | 'cannot-invite-self'
    | 'not-chat-room-member'
    | 'not-eligible'
    | 'player-not-found'
    | 'invite-not-created'
    | string;
  status: 'pending' | 'invited' | 'failed' | string;
  success: boolean;
};

type InviteRoomPlayersEventPayload = {
  chatRoomId: string;
  deliveredPlayerIds: string[];
  inviteEligibility: NonNullable<ChatRoomPresenceSnapshot['inviteEligibility']>;
  invitedPlayerIds: string[];
  invites: InviteRecord[];
  playerIds: string[];
  results: InviteResult[];
  sender?: true;
  senderPlayerId: string;
  senderPlayerName: string;
  tableCode: string | null;
  tableDbId: string | null;
  tableId: string | null;
  tableName: string | null;
};

type InviteRoomPlayersAck = {
  ok: boolean; // true only when at least one invite succeeds
  success: boolean;
} & InviteRoomPlayersEventPayload;

type PlayerInvitedPayload = {
  chatRoomId: string;
  invite: InviteRecord;
  inviteId: string;
  invitedPlayerId: string;
  message: string | null;
  playerId: string;
  recipient?: true;
  senderPlayerId: string;
  senderPlayerName: string;
  tableCode: string | null;
  tableDbId: string | null;
  tableId: string | null;
  tableName: string | null;
};

type MessageNotificationPayload = {
  message: ChatRoomMessage | string | null;
  notification?: {
    id: string;
    type: 'chat_message' | 'table_invite' | 'table_launch' | string;
    userId: string;
    chatRoomId: string | null;
    title: string;
    body: string;
    readAt: string | Date | null;
    createdAt: string | Date;
    metadata?: Record<string, unknown>;
  };
  preview: string;
  roomId: string;
  type?: 'chat_message' | 'table_invite' | 'table_launch' | string;
  unreadCount: number;
};
```

## Error payloads

All Chat Room socket handlers are wrapped in an error boundary. On failure, the backend emits the same `RealtimeErrorPayload` to all three aliases:

- `table:error`
- `room:error`
- `chat:error`

The acknowledgement callback also receives `{ ok: false, error: RealtimeErrorPayload }`.

```ts
type RealtimeErrorPayload =
  | {
      code: 'AUTH_REQUIRED';
      message: 'Please sign in again to join or create a realtime table.';
    }
  | {
      code: 'AUTH_EXPIRED';
      message: 'Your session has expired. Please sign in again.';
    }
  | {
      code: 'AUTH_INVALID';
      message: 'Your session is no longer valid. Please sign in again.';
    }
  | {
      code: 'REALTIME_ERROR';
      message: string;
    };

type ErrorAck = {
  ok: false;
  error: RealtimeErrorPayload;
};
```

Common `REALTIME_ERROR` messages include:

- `Chat room id is required.`
- `Chat room not found.`
- `Chat room is disabled.`
- `Chat message cannot be empty.`
- `You are sending chat room messages too quickly. Please wait <n> second(s) before sending another message.`
- `This chat room is receiving too many messages. Please wait <n> second(s) and try again.`
- `Poker realtime service is required to launch a table from a chat room.`
- `Invited player ids must be valid user ids.`
- `Table id is required.`
- `At least one player id is required.`

## Table launch sequence from Chat Room

1. Frontend loads available rooms with `GET /api/chat-rooms` and selects a room with a stable `roomId`.
2. Frontend connects Socket.IO with auth using `handshake.auth.token`, an `Authorization` header, or includes `token`/`authToken` in each emitted payload.
3. Frontend emits `chat:joinRoom` with `{ chatRoomId }` and waits for `JoinRoomAck` or `chat:joinedRoom`.
4. User configures the poker table from the Chat Room UI.
5. Frontend emits `table:createFromChatRoom` with `{ chatRoomId, gameSettings, invitedPlayerIds, tableName?, tableTierId?, visibility?, token? }`.
6. Backend validates auth, room access, launch game settings, invited user ids, and delegates to the poker realtime service to create the table.
7. Backend emits `table:launchFromChatRoom`:
   - to the launcher with `sender: true`,
   - to other sockets in the Chat Room,
   - to online invited users with `recipient: true`.
8. Backend emits `chat:newMessage` to the Chat Room with a system message whose `launchContext` contains the table launch payload.
9. Backend creates and emits `chat:messageNotification` records for launch recipients.
10. Frontend navigates to the launched table using `tableCode`, `tableId`, or `roomId` from `LaunchFromChatRoomPayload`.

## Invite sequence from Chat Room

1. Frontend must have already joined the room with `chat:joinRoom` so it has current `presenceSnapshot.inviteEligibility` and `players`.
2. Frontend filters selectable users locally using `inviteEligibility.eligiblePlayerIds`, excludes the current user, and excludes already invited players.
3. After a table has been launched or otherwise selected, frontend emits `table:inviteRoomPlayers` with `{ chatRoomId, tableId, playerIds, alreadyInvitedPlayerIds?, message?, token? }`.
4. Backend authenticates the sender, verifies the room and table id, validates each requested player id, confirms each player is a Chat Room member, and confirms each player is currently invite-eligible.
5. Backend persists table invite records through the poker realtime service for eligible players.
6. Backend emits `table:playerInvited`:
   - to each online invited recipient with the individual `PlayerInvitedPayload`,
   - to the sender with aggregate `InviteRoomPlayersEventPayload` and `sender: true`.
7. Backend emits `chat:messageNotification` records for table invite recipients.
8. Frontend reconciles optimistic/local UI state from `InviteRoomPlayersAck.results` and/or the sender `table:playerInvited` aggregate payload. A player is considered invited only when the result has `ok: true` and `status: 'invited'`.

## Frontend placeholder alignment checklist

The documented event names intentionally match the frontend placeholder constants:

```ts
{
  joinRoom: 'chat:joinRoom',
  leaveRoom: 'chat:leaveRoom',
  sendMessage: 'chat:sendMessage',
  newMessage: 'chat:newMessage',
  typing: 'chat:typing',
  messageNotification: 'chat:messageNotification',
  createTableFromChatRoom: 'table:createFromChatRoom',
  inviteRoomPlayers: 'table:inviteRoomPlayers',
  playerInvited: 'table:playerInvited',
  launchFromChatRoom: 'table:launchFromChatRoom',
}
```

## Acceptance criteria

- Frontend can implement real socket integration using only this contract, plus the existing REST room discovery endpoints.
- Backend implementation registers these server-received events: `chat:joinRoom`, `chat:leaveRoom`, `chat:sendMessage`, `chat:typing`, `table:createFromChatRoom`, and `table:inviteRoomPlayers`.
- Backend implementation emits these frontend-consumed events: `chat:joinedRoom`, `chat:leftRoom`, `chat:activePlayers`, `chat:presence`, `chat:notificationsRead`, `chat:newMessage`, `chat:messageNotification`, `chat:typing`, `table:launchFromChatRoom`, `table:playerInvited`, `chat:error`, `room:error`, and `table:error`.
- Documented event names match the frontend placeholder constants in `js-house-of-poker/src/services/chatRooms/events.ts`.
- `table:inviteRoomPlayers` and `table:playerInvited` are documented explicitly so `ChatRoomDetailScreen` can replace the local mock invite update with real socket integration.
- `table:createFromChatRoom` and `table:launchFromChatRoom` are documented explicitly so Chat Room launch and post-launch navigation can use the backend response without guessing field names.
