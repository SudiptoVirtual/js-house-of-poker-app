export const pokerClientEvents = {
  createTable: 'table:create',
  gameAction: 'game:action',
  gameSettingsUpdate: 'game:settings:update',
  joinTable: 'table:join',
  leaveTable: 'table:leave',
  rebuy: 'game:rebuy',
  resumeSession: 'session:resume',
  sendTableInvite: 'table:invite:send',
  sendTableChatMessage: 'table:chat:send',
  sitAtSeat: 'table:sit',
  startGame: 'game:start',
} as const;

export const pokerLegacyClientEvents = {
  sendTableInvite: 'player:invite_send',
  sendTableChatMessage: 'player:chat:send',
  createRoom: 'player:create_room',
  gameAction: 'player:action',
  joinRoom: 'player:join_room',
  leaveRoom: 'player:leave_room',
  rebuy: 'player:rebuy',
  startHand: 'player:start_hand',
} as const;

export const pokerServerEvents = {
  cardsDealt: 'game:cards_dealt',
  communityCardsRevealed: 'game:community_cards_revealed',
  gameSettingsUpdated: 'game:settings:updated',
  gameStarted: 'game:started',
  playerActionMade: 'game:player_action_made',
  playerJoined: 'table:player_joined',
  playerStatusUpdated: 'player:statusUpdated',
  playerLeft: 'table:player_left',
  playerTurnChanged: 'game:player_turn_changed',
  potUpdated: 'game:pot_updated',
  reconnectRejected: 'session:resume_failed',
  roomError: 'table:error',
  roundEnded: 'game:round_ended',
  stateSync: 'table:state',
  tableChatMessage: 'table:chat:message',
  tableJoined: 'table:joined',
  tableLeft: 'table:left',
  winnerDeclared: 'game:winner_declared',
} as const;

export const pokerLegacyServerEvents = {
  chatMessage: 'room:chat_message',
  roomError: 'room:error',
  roomLeft: 'room:left',
  roomState: 'room:state',
} as const;
