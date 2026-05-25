export type BotTrainingDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type BotTrainingGameType = '357' | 'shanghai' | 'in-between-the-sheets' | '7-27' | 'holdem';

export type BotTrainingEconomicMode = 'SAFE_MODE' | 'PROTECTED_MODE';

export type BotTrainingTableDefinition = {
  description: string;
  difficulty: BotTrainingDifficulty;
  educationalCopy: string;
  game: BotTrainingGameType;
  id: string;
  label: string;
  maxPlayers: number;
  economicMode: BotTrainingEconomicMode;
  modeLabel: string;
  modeSummary: string;
  mode: 'BEST_FIVE' | 'HOSTEST';
  seatCount: number;
};

export const BOT_TRAINING_TABLES: BotTrainingTableDefinition[] = [
  {
    description:
      'Play with patient table pacing and straightforward bot actions so you can learn hand flow and turn order.',
    difficulty: 'beginner',
    educationalCopy:
      'Safe Mode: Practice without risking your free clips. Training chips and rewards are simulated and never affect your real clip balance.',
    game: '357',
    economicMode: 'SAFE_MODE',
    id: 'TRN357A',
    label: '357 Bot Training',
    maxPlayers: 4,
    mode: 'HOSTEST',
    modeLabel: 'Safe Mode',
    modeSummary: 'Pure learning environment with zero real clip risk.',
    seatCount: 4,
  },
];

export const BOT_TRAINING_TABLE_IDS = new Set(BOT_TRAINING_TABLES.map((table) => table.id));
