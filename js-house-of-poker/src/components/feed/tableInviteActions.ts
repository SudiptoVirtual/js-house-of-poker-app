import type { FeedPost } from '../../types/feed';

export type JoinFeedTableInviteInput = {
  joinTable: (input: { name: string; tableId: string }) => void | Promise<void>;
  navigateToGame: (tableCode: string) => void;
  playerName?: string | null;
  post: FeedPost;
};

export async function joinFeedTableInvite({ joinTable, navigateToGame, playerName, post }: JoinFeedTableInviteInput) {
  if (!playerName?.trim()) {
    throw new Error('Sign in before joining a table from the feed.');
  }

  const tableCode = post.tableContext?.tableCode?.trim().toUpperCase();
  if (!tableCode) {
    throw new Error('This table invitation does not include a valid table code.');
  }
  if (post.tableContext?.seatsOpen === 0) {
    throw new Error('This table is full.');
  }

  await joinTable({ name: playerName.trim(), tableId: tableCode });
  navigateToGame(tableCode);
}

export function getJoinTableErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to join this table right now.';
  if (/full|no (open|available) seats/i.test(message)) return 'This table is full.';
  if (/not found|invalid.*code|valid table code/i.test(message)) return 'This table code is invalid.';
  if (/unavailable|closed|paused|offline/i.test(message)) return 'This table is unavailable.';
  return message;
}
