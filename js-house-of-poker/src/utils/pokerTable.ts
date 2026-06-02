import {
  PLAYER_STATUS_ASSETS,
  normalizePlayerStatusTier,
  type PlayerStatusTier,
} from '../constants/playerStatus';
import type {
  PokerPhase,
  PokerPlayerState,
  PokerPlayerStatus,
} from '../types/poker';

export type Point = {
  x: number;
  y: number;
};

export type SeatAlignment = 'left' | 'center' | 'right';

export type SeatDescriptor = {
  align: SeatAlignment;
  betCenter: Point;
  center: Point;
  height: number;
  index: number;
  isBottomSeat: boolean;
  player: PokerPlayerState;
  width: number;
};

const TABLE_EDGE_OVERHANG_X = 42;
const TABLE_EDGE_OVERHANG_Y = 34;
const COMPACT_TABLE_EDGE_OVERHANG_X = 0;
const COMPACT_TABLE_EDGE_OVERHANG_Y = 0;
const SEAT_HEIGHT_SCALE = 0.92;
const HERO_SEAT_HEIGHT_SCALE = 0.78;
const HERO_SEAT_HEIGHT_ADJUSTMENT = -2;
const HERO_SEAT_VERTICAL_ADJUSTMENT = 5;
const HERO_SEAT_WIDTH_SCALE = 0.74;
const HERO_SEAT_WIDTH_ADJUSTMENT = -4;
const BET_TO_BOARD_GAP = 28;
const MAX_SUPPORTED_TABLE_PLAYERS = 7;
const HERO_ANCHOR = {
  x: 0.5,
  y: 1.025,
  zone: 'bottom' as const,
};
const COMPACT_HERO_ANCHOR = {
  x: 0.5,
  y: 0.925,
  zone: 'bottom' as const,
};
const ANCHOR_CHAIR_HERO_ANCHOR = {
  x: 0.5,
  y: 0.94,
  zone: 'bottom' as const,
};
const OPPONENT_ANCHORS: Array<{
  x: number;
  y: number;
  zone: 'bottom' | 'left' | 'right' | 'top';
}> = [
  { x: 0.5, y: -0.058, zone: 'top' },
  { x: 0.078, y: -0.012, zone: 'top' },
  { x: 0.922, y: -0.012, zone: 'top' },
  { x: -0.072, y: 0.466, zone: 'left' },
  { x: 1.072, y: 0.466, zone: 'right' },
  { x: 0.078, y: 0.978, zone: 'bottom' },
  { x: 0.922, y: 0.978, zone: 'bottom' },
];
const COMPACT_OPPONENT_ANCHORS: typeof OPPONENT_ANCHORS = [
  { x: 0.5, y: 0.078, zone: 'top' },
  { x: 0.15, y: 0.108, zone: 'top' },
  { x: 0.85, y: 0.108, zone: 'top' },
  { x: 0.04, y: 0.465, zone: 'left' },
  { x: 0.96, y: 0.465, zone: 'right' },
  { x: 0.17, y: 0.855, zone: 'bottom' },
  { x: 0.83, y: 0.855, zone: 'bottom' },
];
const ANCHOR_CHAIR_OPPONENT_ANCHORS: typeof OPPONENT_ANCHORS = [
  { x: 0.5, y: 0.03, zone: 'top' },
  { x: 0.12, y: 0.03, zone: 'top' },
  { x: 0.88, y: 0.03, zone: 'top' },
  { x: 0.055, y: 0.515, zone: 'left' },
  { x: 0.945, y: 0.515, zone: 'right' },
  { x: 0.18, y: 0.98, zone: 'bottom' },
  { x: 0.82, y: 0.98, zone: 'bottom' },
];
const OPPONENT_LAYOUTS: Record<number, number[]> = {
  1: [0],
  2: [1, 2],
  3: [0, 3, 4],
  4: [1, 2, 3, 4],
  5: [0, 1, 2, 3, 4],
  // Six opponents means seven total players; skip the top-center anchor so the
  // top rail has two separated seats instead of a crowded three-seat cluster.
  6: [1, 2, 3, 4, 5, 6],
};
const TOP_CENTER_CLEAR_OPPONENT_LAYOUTS: Record<number, number[]> = {
  1: [1],
  2: [1, 2],
  3: [1, 3, 4],
  4: [1, 2, 3, 4],
  5: [1, 2, 3, 4, 5],
  6: [1, 2, 3, 4, 5, 6],
};

export type { PlayerStatusTier };
export const PLAYER_STATUS_BADGE_IMAGES: Partial<Record<PlayerStatusTier, number>> = {
  none: require('../../assets/status-badges/no-status.png'),
  low_roller: require('../../assets/status-badges/low-roller.png'),
  mid_roller: require('../../assets/status-badges/mid-roller.png'),
  up_and_coming: require('../../assets/status-badges/up-and-coming.png'),
  high_roller: require('../../assets/status-badges/high-roller.png'),
  shark: require('../../assets/status-badges/shark.png'),
};

export function getPlayerStatusTier(status: PokerPlayerStatus): PlayerStatusTier {
  return normalizePlayerStatusTier(status);
}

export function getPlayerStatusBadgeImage(status: PokerPlayerStatus) {
  return PLAYER_STATUS_ASSETS[getPlayerStatusTier(status)]?.image ?? null;
}

const AVATAR_PALETTES = [
  { fill: '#11443D', ring: '#32D4A4', text: '#D7FFF4' },
  { fill: '#3E2A5C', ring: '#B58BFF', text: '#F0E3FF' },
  { fill: '#4B2F1A', ring: '#F5B65F', text: '#FFF0D8' },
  { fill: '#173652', ring: '#5FB6FF', text: '#E2F5FF' },
  { fill: '#4C1735', ring: '#FF6EAA', text: '#FFE3F0' },
  { fill: '#273B1F', ring: '#9DE16B', text: '#ECFFD9' },
] as const;

function hashSeed(seed: string) {
  let hash = 0;

  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }

  return hash;
}

export function getAvatarPalette(seed: string) {
  return AVATAR_PALETTES[hashSeed(seed) % AVATAR_PALETTES.length];
}

export function getPlayerInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return 'P';
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export function formatPlayerBadges(player: PokerPlayerState) {
  const badges: string[] = [];

  if (player.isDealer) badges.push('Dealer');
  if (player.isSmallBlind) badges.push('SB');
  if (player.isBigBlind) badges.push('BB');
  if (player.isHost) badges.push('Host');

  return badges.join(' / ');
}

export function getPlayerStatusName(status: PokerPlayerStatus) {
  return PLAYER_STATUS_ASSETS[getPlayerStatusTier(status)].label;
}

export function getPlayerStatusBadge(status: PokerPlayerStatus) {
  switch (status) {
    case 'LOW_ROLLER':
      return {
        backgroundColor: '#503923',
        borderColor: '#D09A54',
        color: '#FFF0D9',
        label: 'LR',
        name: getPlayerStatusName(status),
      };
    case 'MID_ROLLER':
      return {
        backgroundColor: '#173A4F',
        borderColor: '#66C7FF',
        color: '#E8F8FF',
        label: 'MR',
        name: getPlayerStatusName(status),
      };
    case 'UP_AND_COMING':
      return {
        backgroundColor: '#1D4D3B',
        borderColor: '#6DF0AF',
        color: '#E9FFF4',
        label: 'UP',
        name: getPlayerStatusName(status),
      };
    case 'HIGH_ROLLER':
      return {
        backgroundColor: '#6B3118',
        borderColor: '#FFB45D',
        color: '#FFF0DE',
        label: 'HR',
        name: getPlayerStatusName(status),
      };
    case 'SHARK':
      return {
        backgroundColor: '#601B23',
        borderColor: '#FF8593',
        color: '#FFF0F2',
        label: 'SH',
        name: getPlayerStatusName(status),
      };
    case 'NO_STATUS':
    default:
      return null;
  }
}

export function getPhaseTitle(phase: PokerPhase) {
  switch (phase) {
    case 'waiting':
      return 'Waiting For Players';
    case 'deal_3':
      return 'Deal 3';
    case 'decide_3':
      return 'Round 3';
    case 'deal_5':
      return 'Deal 5';
    case 'decide_5':
      return 'Round 5';
    case 'deal_7':
      return 'Deal 7';
    case 'decide_7':
      return 'Round 7';
    case 'reveal':
      return 'Reveal Decisions';
    case 'resolve':
      return 'Resolve Table';
    case 'reshuffle':
      return 'Reshuffle';
    case 'preflop':
      return 'Pre-Flop';
    case 'flop':
      return 'Flop';
    case 'turn':
      return 'Turn';
    case 'river':
      return 'River';
    case 'showdown':
      return 'Showdown';
    case 'completed':
      return 'Hand Complete';
    default:
      return phase;
  }
}

export function getPlayerStatusLabel(
  player: PokerPlayerState,
  phase: PokerPhase,
  isWinner: boolean,
) {
  if (isWinner) {
    return 'Winner';
  }

  if (!player.isConnected) {
    return 'Away';
  }

  if (player.hasFolded) {
    return 'Folded';
  }

  if (player.isAllIn) {
    return 'All-in';
  }

  if (player.isTurn) {
    return 'Acting';
  }

  if (player.chips <= 0 && phase !== 'completed') {
    return 'Out';
  }

  if (phase === 'waiting') {
    return 'Waiting';
  }

  if (player.betThisRound > 0) {
    return 'In Pot';
  }

  return 'Ready';
}

export function isLiveHand(phase: PokerPhase) {
  return phase !== 'waiting';
}

export function orderPlayersForTable(
  players: PokerPlayerState[],
  selfId: string | null,
) {
  if (!selfId) {
    return players;
  }

  const selfIndex = players.findIndex((player) => player.id === selfId);
  if (selfIndex <= 0) {
    return players;
  }

  return [...players.slice(selfIndex), ...players.slice(0, selfIndex)];
}

type BuildSeatDescriptorOptions = {
  avoidTopCenter?: boolean;
  availableStageHeight?: number;
  compactTable?: boolean;
};

export function buildSeatDescriptors(
  players: PokerPlayerState[],
  tableWidth: number,
  tableHeight: number,
  options: BuildSeatDescriptorOptions = {},
): SeatDescriptor[] {
  if (tableWidth <= 0 || tableHeight <= 0) {
    return [];
  }

  const compactTable = options.compactTable ?? false;
  const anchorChairTable = options.avoidTopCenter ?? false;
  const availableStageHeight = Math.max(
    tableHeight,
    options.availableStageHeight ?? tableHeight,
  );
  const center = { x: tableWidth / 2, y: tableHeight / 2 };
  const anchorChairHeroSeatHeight = Math.min(
    compactTable ? 90 : 98,
    Math.max(compactTable ? 80 : 84, tableHeight * 0.118),
  );
  const seatWidth =
    anchorChairTable
      ? Math.min(
          compactTable ? 104 : 108,
          Math.max(compactTable ? 90 : 94, tableWidth * 0.118),
        )
      : Math.min(
          compactTable ? 138 : 162,
          Math.max(compactTable ? 112 : 118, tableWidth * 0.148),
        ) * (compactTable ? 0.9 : 1);
  const seatHeight =
    anchorChairTable
      ? Math.min(
          compactTable ? 76 : 78,
          Math.max(compactTable ? 74 : 76, tableHeight * 0.1),
        )
      : Math.min(
          compactTable ? 148 : 118,
          Math.max(compactTable ? 132 : 88, tableHeight * 0.132),
        ) * SEAT_HEIGHT_SCALE;
  const heroSeatWidth =
    anchorChairTable
      ? Math.max(seatWidth, Math.min(124, Math.max(108, tableWidth * 0.18)))
      : (Math.min(
          compactTable ? 230 : 340,
          Math.max(compactTable ? 154 : 280, tableWidth * 0.285),
        ) +
          HERO_SEAT_WIDTH_ADJUSTMENT) *
        (compactTable ? 0.86 : HERO_SEAT_WIDTH_SCALE);
  const heroSeatHeight =
    anchorChairTable
      ? anchorChairHeroSeatHeight
      : (compactTable
          ? Math.min(154, Math.max(128, tableHeight * 0.22))
          : Math.min(86, Math.max(66, tableHeight * 0.095))) *
          (compactTable ? 0.92 : HERO_SEAT_HEIGHT_SCALE) +
        HERO_SEAT_HEIGHT_ADJUSTMENT;
  const horizontalSeatInset = anchorChairTable
    ? Math.max(28, tableWidth * 0.09)
    : compactTable
      ? Math.max(COMPACT_TABLE_EDGE_OVERHANG_X, tableWidth * 0.032)
      : Math.max(TABLE_EDGE_OVERHANG_X, tableWidth * 0.058);
  const opponentHorizontalSeatInset = anchorChairTable
    ? Math.max(34, tableWidth * 0.1)
    : horizontalSeatInset;
  const requestedVerticalSeatInset = anchorChairTable
    ? Math.max(20, tableHeight * 0.075)
    : compactTable
      ? Math.max(COMPACT_TABLE_EDGE_OVERHANG_Y, tableHeight * 0.035)
      : Math.max(TABLE_EDGE_OVERHANG_Y, tableHeight * 0.11);
  const verticalSeatInset = Math.min(
    requestedVerticalSeatInset,
    Math.max(0, (availableStageHeight - tableHeight) / 2),
  );
  const cappedPlayers = players.slice(0, MAX_SUPPORTED_TABLE_PLAYERS);
  const boardSafeHalfWidth = tableWidth * 0.38;
  const boardSafeHalfHeight = tableHeight * 0.27;
  const anchorChairBoardClearHalfWidth =
    Math.min(178, Math.max(116, tableWidth * 0.17));
  const anchorChairBoardClearHalfHeight =
    Math.min(118, Math.max(84, tableHeight * 0.24));
  const secondaryBetSafeRx = boardSafeHalfWidth + BET_TO_BOARD_GAP;
  const secondaryBetSafeRy = boardSafeHalfHeight + BET_TO_BOARD_GAP * 0.72;
  const opponentCount = Math.max(0, cappedPlayers.length - 1);
  const layoutMap = options.avoidTopCenter
    ? TOP_CENTER_CLEAR_OPPONENT_LAYOUTS
    : OPPONENT_LAYOUTS;
  const opponentLayout =
    layoutMap[opponentCount] ??
    layoutMap[Math.max(...Object.keys(layoutMap).map(Number))];

  type SeatZone = 'top' | 'left' | 'right' | 'bottom';
  const seatPositions = cappedPlayers.map((player, index) => {
    const activeHeroAnchor = anchorChairTable
      ? ANCHOR_CHAIR_HERO_ANCHOR
      : compactTable
        ? COMPACT_HERO_ANCHOR
        : HERO_ANCHOR;
    const activeOpponentAnchors = anchorChairTable
      ? ANCHOR_CHAIR_OPPONENT_ANCHORS
      : compactTable
      ? COMPACT_OPPONENT_ANCHORS
      : OPPONENT_ANCHORS;
    const point =
      index === 0
        ? activeHeroAnchor
        : activeOpponentAnchors[
            opponentLayout[Math.min(index - 1, opponentLayout.length - 1)] ??
              opponentLayout[opponentLayout.length - 1]
          ] ??
          activeOpponentAnchors[activeOpponentAnchors.length - 1];
    const rawCenterX = point.x * tableWidth;
    const isHeroSeat = index === 0;
    const rawCenterY =
      point.y * tableHeight +
      (isHeroSeat && !compactTable ? HERO_SEAT_VERTICAL_ADJUSTMENT : 0);
    const resolvedSeatWidth = isHeroSeat ? heroSeatWidth : seatWidth;
    const resolvedSeatHeight = isHeroSeat ? heroSeatHeight : seatHeight;
    const activeHorizontalSeatInset =
      anchorChairTable && !isHeroSeat
        ? opponentHorizontalSeatInset
        : horizontalSeatInset;
    const activeVerticalSeatInset =
      anchorChairTable && !isHeroSeat
        ? requestedVerticalSeatInset
        : verticalSeatInset;
    const minX = -activeHorizontalSeatInset + resolvedSeatWidth / 2;
    const maxX =
      tableWidth + activeHorizontalSeatInset - resolvedSeatWidth / 2;
    const minY = -activeVerticalSeatInset + resolvedSeatHeight / 2;
    const maxY =
      tableHeight + activeVerticalSeatInset - resolvedSeatHeight / 2;
    const zone: SeatZone = point.zone;
    let centerX = Math.max(minX, Math.min(maxX, rawCenterX));
    let centerY = Math.max(minY, Math.min(maxY, rawCenterY));

    if (anchorChairTable) {
      const clearGap = 6;
      const overlapsBoardX =
        centerX - resolvedSeatWidth / 2 <
          center.x + anchorChairBoardClearHalfWidth &&
        centerX + resolvedSeatWidth / 2 >
          center.x - anchorChairBoardClearHalfWidth;
      const overlapsBoardY =
        centerY - resolvedSeatHeight / 2 <
          center.y + anchorChairBoardClearHalfHeight &&
        centerY + resolvedSeatHeight / 2 >
          center.y - anchorChairBoardClearHalfHeight;

      if (overlapsBoardX && overlapsBoardY) {
        if (zone === 'left') {
          centerX =
            center.x -
            anchorChairBoardClearHalfWidth -
            resolvedSeatWidth / 2 -
            clearGap;
        } else if (zone === 'right') {
          centerX =
            center.x +
            anchorChairBoardClearHalfWidth +
            resolvedSeatWidth / 2 +
            clearGap;
        } else if (zone === 'top') {
          centerY =
            center.y -
            anchorChairBoardClearHalfHeight -
            resolvedSeatHeight / 2 -
            clearGap;
        } else {
          centerY =
            center.y +
            anchorChairBoardClearHalfHeight +
            resolvedSeatHeight / 2 +
            clearGap;
        }

        centerX = Math.max(minX, Math.min(maxX, centerX));
        centerY = Math.max(minY, Math.min(maxY, centerY));
      }
    }

    return {
      centerX,
      centerY,
      height: resolvedSeatHeight,
      index,
      isBottomSeat: zone === 'bottom',
      player,
      width: resolvedSeatWidth,
      zone,
    };
  });

  return seatPositions.map(({ centerX, centerY, height, index, isBottomSeat, player, width, zone }) => {
    const dx = centerX - center.x;
    const dy = centerY - center.y;
    const betPull = 0.56;
    let betX = center.x + dx * betPull;
    let betY = center.y + dy * betPull;
    const ellipseMetric =
      (betX - center.x) ** 2 / secondaryBetSafeRx ** 2 +
      (betY - center.y) ** 2 / secondaryBetSafeRy ** 2;
    if (ellipseMetric < 1) {
      const safeDx = dx === 0 && dy === 0 ? 0 : dx;
      const safeDy = dx === 0 && dy === 0 ? 1 : dy;
      const seatMetric = safeDx ** 2 / secondaryBetSafeRx ** 2 + safeDy ** 2 / secondaryBetSafeRy ** 2;
      const boundaryScale = seatMetric > 0 ? 1 / Math.sqrt(seatMetric) : 1;
      betX = center.x + safeDx * boundaryScale;
      betY = center.y + safeDy * boundaryScale;
    }

    const align: SeatAlignment = zone === 'left' ? 'left' : zone === 'right' ? 'right' : 'center';
    return {
      align,
      betCenter: { x: betX, y: betY },
      center: { x: centerX, y: centerY },
      height,
      index,
      isBottomSeat,
      player,
      width,
    };
  });
}
