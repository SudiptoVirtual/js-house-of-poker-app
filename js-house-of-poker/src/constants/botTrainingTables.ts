export type BotTrainingDifficulty = 'beginner' | 'intermediate' | 'advanced';
export type BotTrainingGameType = '357' | 'shanghai' | 'in-between-the-sheets' | '7-27' | 'holdem';

export type BotTrainingTableDefinition = {
  description: string;
  difficulty: BotTrainingDifficulty;
  educationalCopy: string;
  game: BotTrainingGameType;
  id: string;
  label: string;
  maxPlayers: number;
  mode: 'BEST_FIVE' | 'HOSTEST';
  seatCount: number;
};

export const BOT_TRAINING_TABLES: BotTrainingTableDefinition[] = [
  {
    description:
      'Play with patient table pacing and straightforward bot actions so you can learn hand flow and turn order.',
    difficulty: 'beginner',
    educationalCopy:
      'Learn the games at your own pace with no risk to your free clips. Training hands do not deduct from your live balance.',
    game: '357',
    id: 'TRN357A',
    label: '357 Bot Training',
    maxPlayers: 4,
    mode: 'HOSTEST',
    seatCount: 4,
  },
];

export const BOT_TRAINING_TABLE_IDS = new Set(BOT_TRAINING_TABLES.map((table) => table.id));
