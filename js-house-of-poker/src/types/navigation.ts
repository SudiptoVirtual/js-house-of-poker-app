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
  ChatRooms: undefined;
  ChatRoomDetail: { roomId: string };
  Profile: undefined;
  UserProfile: { userId: string };
  Friends: undefined;
  Feed:
    | {
        notificationId?: string;
        postId?: string;
      }
    | undefined;
  MyFeed: undefined;
  PlayerDirectory: undefined;
  Game:
    | {
        gameId?: string;
        invitePreset?: GameInvitePreset;
        tableCode?: string;
      }
    | undefined;
};
