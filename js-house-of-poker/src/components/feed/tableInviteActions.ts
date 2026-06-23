import type { FeedPost } from '../../types/feed';

export const FEED_TABLE_INVITES_REQUIRE_SOCKET_MESSAGE =
  'Feed table invites require the live poker connection. Set EXPO_PUBLIC_POKER_TRANSPORT=socket and restart Expo.';

export type JoinFeedTableInviteInput = {
  joinTable: (input: { name: string; tableId: string }) => void | Promise<void>;
  playerName?: string | null;
  post: FeedPost;
};

export type JoinFeedTableInviteResult = {
  tableCode: string | null;
  tableId: string | null;
  tableIdentifier: string;
};

export async function joinFeedTableInvite({ joinTable, playerName, post }: JoinFeedTableInviteInput): Promise<JoinFeedTableInviteResult> {
  if (!playerName?.trim()) {
    throw new Error('Sign in before joining a table from the feed.');
  }

  const tableCode = post.tableContext?.tableCode?.trim().toUpperCase();
  const tableId = post.tableContext?.tableId?.trim();
  const tableIdentifier = tableCode || tableId;
  if (!tableIdentifier) {
    throw new Error('This table invitation does not include a valid table reference.');
  }
  if (post.tableContext?.seatsOpen === 0) {
    throw new Error('This table is full.');
  }

  await joinTable({ name: playerName.trim(), tableId: tableIdentifier });
  return { tableCode: tableCode || null, tableId: tableId || null, tableIdentifier };
}

export function getJoinTableErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to join this table right now.';
  if (/full|no (open|available) seats/i.test(message)) return 'This table is full.';
  if (/not found|invalid.*code|valid table (code|reference)/i.test(message)) return 'This table invitation is invalid.';
  if (/unavailable|closed|paused|offline/i.test(message)) return 'This table is unavailable.';
  return message;
}
