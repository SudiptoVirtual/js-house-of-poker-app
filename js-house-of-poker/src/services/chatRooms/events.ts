export const chatRoomSocketEvents = {
  aiPrimeOpen: 'aiPrime:open',
  aiPrimeSetUpTable: 'aiPrime:setUpTable',
  activePlayers: 'chat:activePlayers',
  error: 'chat:error',
  giftClipsSend: 'chat:giftClips:send',
  joinedRoom: 'chat:joinedRoom',
  joinRoom: 'chat:joinRoom',
  leaveRoom: 'chat:leaveRoom',
  leftRoom: 'chat:leftRoom',
  messageNotification: 'chat:messageNotification',
  newMessage: 'chat:newMessage',
  notificationsRead: 'chat:notificationsRead',
  presence: 'chat:presence',
  sendGiftClip: 'chat:sendGiftClip',
  sendMessage: 'chat:sendMessage',
  typing: 'chat:typing',
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
