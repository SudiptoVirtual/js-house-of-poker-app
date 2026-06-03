import type { FeedPost, FeedPlayer } from '../types/feed';

export const currentFeedPlayer = {
  handle: '@house-host',
  id: 'current-player',
  name: 'Avery Quinn',
  status: 'In Lobby',
  statusTier: 'none',
} satisfies FeedPlayer;

// TODO(feed:getPosts): Replace mockFeedPosts with the real feed:getPosts API response once it is available.
export const mockFeedPosts = [
  {
    commentCount: 18,
    content:
      'Settling in for a mellow free-play night. Who else is around and ready to talk through hands after the river?',
    id: 'feed-normal-river-check',
    player: {
      handle: '@river-regular',
      id: 'river-regular',
      name: 'River Regular',
      status: 'Online',
      statusTier: 'mid_roller',
    },
    shareCount: 7,
    supportersCount: 250,
    gameContext: {
      headline: 'River review queue',
      resultLabel: 'Open discussion',
      stakesLabel: 'Free-play',
    },
    isPromoted: false,
    isTableRelated: false,
    timestamp: '12m',
  },
  {
    commentCount: 6,
    content:
      'Just finished reviewing a tricky 357 showdown spot. The middle card pressure changes everything when the table gets short-handed.',
    id: 'feed-normal-357-note',
    player: {
      handle: '@stack-sprinter',
      id: 'stack-sprinter',
      name: 'Stack Sprinter',
      status: 'Playing 357',
      statusTier: 'shark',
    },
    shareCount: 4,
    supportedByCurrentPlayer: true,
    supportersCount: 91,
    gameContext: {
      headline: '357 showdown note',
      resultLabel: 'Short-handed pressure spot',
      stakesLabel: 'Practice table',
    },
    isPromoted: false,
    isTableRelated: false,
    timestamp: '28m',
  },
  {
    commentCount: 11,
    content:
      'Chat room is open for hand recaps and lineup planning. Drop in if you want a friendly table without chasing codes.',
    id: 'feed-normal-chat-room',
    player: {
      handle: '@pocket-poet',
      id: 'pocket-poet',
      name: 'Pocket Poet',
      status: 'In Chat Room',
      statusTier: 'up_and_coming',
    },
    shareCount: 9,
    supportersCount: 134,
    isPromoted: false,
    isTableRelated: false,
    timestamp: '43m',
  },
  {
    commentCount: 24,
    content:
      'Two seats open at Night Shift. Friendly pace, free-play chips, and table talk welcome. Bring a clean invite request.',
    id: 'feed-table-night-shift',
    isPromoted: false,
    isTableRelated: true,
    player: {
      handle: '@late-host',
      id: 'late-host',
      name: 'Late Host',
      status: 'At Table',
      statusTier: 'high_roller',
    },
    shareCount: 15,
    supportersCount: 312,
    tableContext: {
      gameLabel: "Texas Hold'em",
      seatsOpen: 2,
      tableCode: 'NIGHT7',
      tableName: 'Night Shift',
    },
    timestamp: '1h',
  },
  {
    commentCount: 37,
    content:
      'Creator spotlight: hosting beginner-friendly table walkthroughs this week. Sponsor the post to help more new players find the room.',
    id: 'feed-promoted-creator-spotlight',
    isPromoted: true,
    isTableRelated: false,
    player: {
      handle: '@chip-kind',
      id: 'chip-kind',
      name: 'Chip Kind',
      status: 'In Lobby',
      statusTier: 'up_and_coming',
    },
    promotedCount: 8,
    shareCount: 22,
    supportersCount: 476,
    timestamp: '2h',
  },
  {
    commentCount: 14,
    content:
      'Thanks for the clip gifts after the last table stream. I am using them to keep the weekly free-play recap running.',
    giftClipsCount: 12,
    giftClipsTotal: 18500,
    id: 'feed-gift-clips-recap',
    player: {
      handle: '@muck-guide',
      id: 'muck-guide',
      name: 'Muck Guide',
      status: 'Away',
      statusTier: 'low_roller',
    },
    shareCount: 5,
    supportersCount: 205,
    isPromoted: false,
    isTableRelated: false,
    timestamp: '3h',
  },
] satisfies FeedPost[];
