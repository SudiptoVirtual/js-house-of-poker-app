import type { GameInvitePreset } from '../types/navigation';

export type SocialPlayer = {
  bio: string;
  favoriteSeat: string;
  handle: string;
  id: string;
  mutualTables: string;
  name: string;
  statusLabel: string;
};

export type SocialFeedPost = {
  authorHandle: string;
  authorName: string;
  body: string;
  id: string;
  mood: string;
  title: string;
};

export const currentPlayerProfile = {
  favoriteGame: "No-limit Texas Hold'em",
  handle: '@house-host',
  name: 'Avery Quinn',
  socialLine: 'Hosts private free-play tables and keeps the guest list moving.',
  stats: [
    { label: 'Friends', value: '24' },
    { label: 'Posts', value: '9' },
    { label: 'Home table', value: 'Night Shift' },
  ],
} as const;

export const socialPlayers: SocialPlayer[] = [
  {
    bio: "Always ready for a quick free-play hold'em run after work.",
    favoriteSeat: 'Loves button starts and fast six-max tables.',
    handle: '@river-regular',
    id: 'river-regular',
    mutualTables: '12 shared tables',
    name: 'River Regular',
    statusLabel: 'Online now',
  },
  {
    bio: 'Late-night grinder who prefers clean invites and private codes.',
    favoriteSeat: 'Usually joins from the second orbit.',
    handle: '@late-reg',
    id: 'late-reg',
    mutualTables: '7 shared tables',
    name: 'Late Reg',
    statusLabel: 'Last seen 18m ago',
  },
  {
    bio: 'Short-handed specialist who likes sprint sessions and rematches.',
    favoriteSeat: 'Calls the cutoff seat home.',
    handle: '@stack-sprinter',
    id: 'stack-sprinter',
    mutualTables: '5 shared tables',
    name: 'Stack Sprinter',
    statusLabel: 'Looking for a table',
  },
  {
    bio: 'Posts table recaps, hand notes, and mellow free-play invites.',
    favoriteSeat: 'Prefers deep stacks and patient tables.',
    handle: '@pocket-poet',
    id: 'pocket-poet',
    mutualTables: '9 shared tables',
    name: 'Pocket Poet',
    statusLabel: 'Posted 5m ago',
  },
];

export const socialFeedPosts: SocialFeedPost[] = [
  {
    authorHandle: '@river-regular',
    authorName: 'River Regular',
    body: 'Putting together a quick free-play table after dinner. Six seats, calm pace, no cash games.',
    id: 'feed-1',
    mood: "Tonight's table check",
    title: 'Who wants a clean six-max session?',
  },
  {
    authorHandle: '@pocket-poet',
    authorName: 'Pocket Poet',
    body: 'Dropping a short recap from last night and scouting players for another invite-only free-play room.',
    id: 'feed-2',
    mood: 'Post-session note',
    title: 'Good tempo, better river stories',
  },
  {
    authorHandle: '@stack-sprinter',
    authorName: 'Stack Sprinter',
    body: 'Ready for a faster lobby if someone has open seats and wants to invite by username instead of chasing codes.',
    id: 'feed-3',
    mood: 'Open invite request',
    title: 'Username invites are the move',
  },
];

export function buildSocialInvitePreset(
  recipientHandle: string,
  contextLabel: string,
): GameInvitePreset {
  return {
    contextLabel,
    recipientHandle,
    requestId: `${recipientHandle}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    source: 'friend-list',
  };
}
