import type { PokerInviteSource } from './poker';

export type GameInvitePreset = {
  contextLabel?: string;
  recipientHandle?: string;
  requestId?: string;
  source: PokerInviteSource;
};

export type RootStackParamList = {
  Welcome: undefined;
  Login: undefined;
  Registration: undefined;
  Home: undefined;
  Profile: undefined;
  Friends: undefined;
  Feed: undefined;
  PlayerDirectory: undefined;
  Game:
    | {
        gameId?: string;
        invitePreset?: GameInvitePreset;
      }
    | undefined;
};
