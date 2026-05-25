export type BotTrainingDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type BotTrainingTableDefinition = {
  description: string;
  difficulty: BotTrainingDifficulty;
  educationalCopy: string;
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
    id: 'training-beginner-hostest',
    label: 'Bot Training Tables',
    maxPlayers: 4,
    mode: 'HOSTEST',
    seatCount: 4,
  },
];
