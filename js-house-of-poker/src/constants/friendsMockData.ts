import type { FriendsPlayer } from '../types/friends';

// TODO(friends:getOnlineFriends): Replace isolated mock records with a backend-backed online friends query.
// TODO(friends:searchPlayers): Replace local filtering with server player search once the friends API is available.
// TODO(friends:getRelationshipStatus): Hydrate relationship status from the social graph API.
// TODO(presence:friendOnline): Subscribe to friend-online presence events from realtime infrastructure.
// TODO(presence:friendOffline): Subscribe to friend-offline presence events from realtime infrastructure.
// TODO(presence:activityChanged): Subscribe to activity/status change events from realtime infrastructure.
export const friendsMockPlayers: FriendsPlayer[] = [
  {
    activityStatus: 'online',
    displayName: 'Maya River',
    id: 'friend-online-maya',
    isOnline: true,
    relationshipStatus: 'friend',
    username: 'mayaRiver',
  },
  {
    activityStatus: 'in_lobby',
    displayName: 'Deacon Wild',
    id: 'friend-online-deacon',
    isOnline: true,
    relationshipStatus: 'friend',
    username: 'deaconWild',
  },
  {
    activityStatus: 'in_chat_room',
    displayName: 'Nina Flux',
    id: 'friend-online-nina',
    isOnline: true,
    relationshipStatus: 'friend',
    username: 'ninaFlux',
  },
  {
    activityStatus: 'at_table',
    displayName: 'Theo Banks',
    id: 'friend-online-theo',
    isOnline: true,
    relationshipStatus: 'friend',
    username: 'theoBanks',
  },
  {
    activityStatus: 'offline',
    displayName: 'Ari Vale',
    id: 'friend-offline-ari',
    isOnline: false,
    relationshipStatus: 'friend',
    username: 'ariVale',
  },
  {
    activityStatus: 'offline',
    displayName: 'Jonah Byte',
    id: 'friend-offline-jonah',
    isOnline: false,
    relationshipStatus: 'friend',
    username: 'jonahByte',
  },
  {
    activityStatus: 'playing_357',
    displayName: 'Cass Nova',
    id: 'player-cass-nova',
    isOnline: true,
    relationshipStatus: 'not_friends',
    username: 'cass357',
  },
  {
    activityStatus: 'online',
    displayName: 'Rook Atlas',
    id: 'player-rook-atlas',
    isOnline: true,
    relationshipStatus: 'request_sent',
    username: 'rookAtlas',
  },
  {
    activityStatus: 'in_lobby',
    displayName: 'Sol Kim',
    id: 'player-sol-kim',
    isOnline: true,
    relationshipStatus: 'request_received',
    username: 'solStack',
  },
  {
    activityStatus: 'offline',
    displayName: 'Piper Stone',
    id: 'player-piper-stone',
    isOnline: false,
    relationshipStatus: 'not_friends',
    username: 'piperStone',
  },
];
