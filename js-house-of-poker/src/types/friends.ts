export type PlayerActivityStatus =
  | 'online'
  | 'in_lobby'
  | 'in_chat_room'
  | 'at_table'
  | 'playing_357'
  | 'offline';

export type RelationshipStatus =
  | 'friend'
  | 'request_sent'
  | 'request_received'
  | 'not_friends';

export type FriendsPlayer = {
  id: string;
  displayName: string;
  username: string;
  avatar?: string;
  isOnline: boolean;
  activityStatus: PlayerActivityStatus;
  relationshipStatus: RelationshipStatus;
  recentActivityAt?: string;
  requestId?: string;
};
