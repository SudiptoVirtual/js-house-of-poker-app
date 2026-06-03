import type { FeedPost, FeedPlayer } from '../components/feed/types';

// TODO(feed:getPosts): Replace this isolated mock data with the real feed API response.
export const currentFeedPlayer: FeedPlayer = {
  avatarInitials: 'AQ',
  handle: '@house-host',
  id: 'current-player',
  name: 'Avery Quinn',
  status: 'In Lobby',
};

export const mockFeedPosts: FeedPost[] = [
  {
    commentCount: 18,
    content:
      'Settling in for a mellow free-play night. Who else is around and ready to talk through hands after the river?',
    id: 'feed-normal-river-check',
    player: {
      avatarInitials: 'RR',
      handle: '@river-regular',
      id: 'river-regular',
      name: 'River Regular',
      status: 'Online',
    },
    shareCount: 7,
    supportersCount: 250,
    timestampLabel: '12m',
  },
  {
    commentCount: 6,
    content:
      'Just finished reviewing a tricky 357 showdown spot. The middle card pressure changes everything when the table gets short-handed.',
    id: 'feed-normal-357-note',
    player: {
      avatarInitials: 'SS',
      handle: '@stack-sprinter',
      id: 'stack-sprinter',
      name: 'Stack Sprinter',
      status: 'Playing 357',
    },
    shareCount: 4,
    supportedByCurrentPlayer: true,
    supportersCount: 91,
    timestampLabel: '28m',
  },
  {
    commentCount: 11,
    content:
      'Chat room is open for hand recaps and lineup planning. Drop in if you want a friendly table without chasing codes.',
    id: 'feed-normal-chat-room',
    player: {
      avatarInitials: 'PP',
      handle: '@pocket-poet',
      id: 'pocket-poet',
      name: 'Pocket Poet',
      status: 'In Chat Room',
    },
    shareCount: 9,
    supportersCount: 134,
    timestampLabel: '43m',
  },
  {
    commentCount: 24,
    content:
      'Two seats open at Night Shift. Friendly pace, free-play chips, and table talk welcome. Bring a clean invite request.',
    id: 'feed-table-night-shift',
    isTableRelated: true,
    player: {
      avatarInitials: 'LH',
      handle: '@late-host',
      id: 'late-host',
      name: 'Late Host',
      status: 'At Table',
    },
    shareCount: 15,
    supportersCount: 312,
    tableContext: {
      gameLabel: "Texas Hold'em",
      seatsOpen: 2,
      tableCode: 'NIGHT7',
      tableName: 'Night Shift',
    },
    timestampLabel: '1h',
  },
  {
    commentCount: 37,
    content:
      'Creator spotlight: hosting beginner-friendly table walkthroughs this week. Sponsor the post to help more new players find the room.',
    id: 'feed-promoted-creator-spotlight',
    isPromoted: true,
    player: {
      avatarInitials: 'CK',
      handle: '@chip-kind',
      id: 'chip-kind',
      name: 'Chip Kind',
      status: 'In Lobby',
    },
    promotedCount: 8,
    shareCount: 22,
    supportersCount: 476,
    timestampLabel: '2h',
  },
  {
    commentCount: 14,
    content:
      'Thanks for the clip gifts after the last table stream. I am using them to keep the weekly free-play recap running.',
    giftClipsCount: 12,
    giftClipsTotal: 18500,
    id: 'feed-gift-clips-recap',
    player: {
      avatarInitials: 'MG',
      handle: '@muck-guide',
      id: 'muck-guide',
      name: 'Muck Guide',
      status: 'Away',
    },
    shareCount: 5,
    supportersCount: 205,
    timestampLabel: '3h',
  },
];
