import type { CreateFeedPostInput } from '../services/api';
import type { PokerPlayerState } from '../types/poker';

export type CompletedWinShare = {
  gameType: string;
  handId: string;
  handNumber: number;
  potValue: number;
  resultLabel: string;
  tableCode: string;
  tableId: string | null;
  tableName: string;
  winnerIds: string[];
};

export function isAuthenticatedWinner(
  completedWin: CompletedWinShare | null,
  currentPlayer: PokerPlayerState | null,
  authenticatedUserId: string | null,
) {
  return Boolean(
    completedWin && currentPlayer && authenticatedUserId &&
    currentPlayer.userId === authenticatedUserId &&
    completedWin.winnerIds.includes(currentPlayer.id),
  );
}

export function buildShareWinPostInput(completedWin: CompletedWinShare, caption: string): CreateFeedPostInput {
  return {
    content: caption.trim() || completedWin.resultLabel,
    gameContext: {
      gameType: completedWin.gameType,
      handId: completedWin.handId,
      handNumber: completedWin.handNumber,
      headline: 'Shared a table win',
      resultLabel: completedWin.resultLabel,
      stakesLabel: completedWin.potValue > 0 ? `${completedWin.potValue.toLocaleString('en-US')} chip pot` : '',
      tableName: completedWin.tableName,
    },
    postType: 'win_share',
    tableCode: completedWin.tableCode,
    tableContext: {
      gameLabel: completedWin.gameType === '357' ? '3-5-7' : completedWin.gameType,
      tableCode: completedWin.tableCode,
      tableName: completedWin.tableName,
    },
    ...(completedWin.tableId ? { tableId: completedWin.tableId } : {}),
  };
}
