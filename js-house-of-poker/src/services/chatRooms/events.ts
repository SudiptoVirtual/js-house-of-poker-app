// TODO(chatRooms:socket): Integration placeholder only. Keep these social chat socket
// event names separate from poker gameplay events until the backend contract is finalized.
export const chatRoomSocketEvents = {
  aiPrimeOpen: 'aiPrime:open',
  aiPrimeSetUpTable: 'aiPrime:setUpTable',
  joinRoom: 'chat:joinRoom',
  leaveRoom: 'chat:leaveRoom',
  sendMessage: 'chat:sendMessage',
  newMessage: 'chat:newMessage',
  typing: 'chat:typing',
  messageNotification: 'chat:messageNotification',
  chatSystemMessage: 'chat:systemMessage',
  createTableFromAiPrime: 'table:createFromAiPrime',
  createTableFromChatRoom: 'table:createFromChatRoom',
  inviteRoomPlayers: 'table:inviteRoomPlayers',
  playerInvited: 'table:playerInvited',
  launchFromChatRoom: 'table:launchFromChatRoom',
  notificationTableInvite: 'notification:tableInvite',
} as const;

export type ChatRoomSocketEventKey = keyof typeof chatRoomSocketEvents;
export type ChatRoomSocketEventName = (typeof chatRoomSocketEvents)[ChatRoomSocketEventKey];
