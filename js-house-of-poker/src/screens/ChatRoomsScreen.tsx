import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { ChatRoomListItem } from '../components/chatRooms';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { chatRooms } from '../constants/chatRooms';
import { routes } from '../constants/routes';
import { usePoker } from '../context/PokerProvider';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRooms'>;

export function ChatRoomsScreen({ navigation }: Props) {
  const { roomState } = usePoker();
  const activeTableCode = roomState?.roomId ?? null;

  return (
    <Screen
      showPlatformNavigation
      eyebrow="Chat rooms"
      title="Platform chat rooms"
      subtitle="Find social rooms for table coordination while gameplay chat remains isolated in the live table experience."
    >
      <SectionCard title="Social chat hub">
        <Text style={styles.helperText}>
          Chat Rooms are first-class platform spaces for planning games, meeting players, and sharing
          invites before a hand begins. They do not replace or reuse live table chat.
        </Text>
        <ActionButton
          fullWidth
          icon={activeTableCode ? 'cards-playing-outline' : 'door-open'}
          label={activeTableCode ? `Open active table ${activeTableCode}` : 'Create or join a table'}
          onPress={() => navigation.navigate(activeTableCode ? routes.Game : routes.Home)}
          tone="primary"
          variant={activeTableCode ? 'primary' : 'secondary'}
        />
      </SectionCard>

      <SectionCard title="Rooms">
        <View style={styles.roomStack}>
          {chatRooms.map((room) => (
            <ChatRoomListItem
              key={room.id}
              onEnter={() => navigation.navigate(routes.ChatRoomDetail, { roomId: room.id })}
              room={room}
            />
          ))}
        </View>
      </SectionCard>

      {/* <ComplianceNotice /> */}
    </Screen>
  );
}

const styles = StyleSheet.create({
  helperText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  roomStack: {
    gap: 12,
  },
});
