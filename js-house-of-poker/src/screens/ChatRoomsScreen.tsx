import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { routes } from '../constants/routes';
import { usePoker } from '../context/PokerProvider';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRooms'>;

const chatRooms = [
  {
    description: 'Coordinate casual free-play tables and find open seats with regulars.',
    title: 'The Rail',
  },
  {
    description: 'Talk through 3-5-7 strategy and training-table etiquette before jumping in.',
    title: '3-5-7 Study Group',
  },
  {
    description: 'Share player introductions and schedule friend-table sessions.',
    title: 'Social Lounge',
  },
];

export function ChatRoomsScreen({ navigation }: Props) {
  const { roomState } = usePoker();
  const activeTableCode = roomState?.roomId ?? null;

  return (
    <Screen
      showPlatformNavigation
      eyebrow="Chat rooms"
      title="Platform chat"
      subtitle="Find social rooms for table coordination while gameplay remains isolated in the landscape table stack."
    >
      <SectionCard title="Active table chat">
        <Text style={styles.helperText}>
          {activeTableCode
            ? `Your active gameplay chat remains attached to table ${activeTableCode}. Open the table to continue live hand discussion.`
            : 'Create or join a table from The Floor before using live table chat.'}
        </Text>
        <ActionButton
          fullWidth
          icon={activeTableCode ? 'cards-playing-outline' : 'door-open'}
          label={activeTableCode ? 'Open active table' : 'Open The Floor'}
          onPress={() => navigation.navigate(activeTableCode ? routes.Game : routes.Home)}
          tone="primary"
          variant={activeTableCode ? 'primary' : 'secondary'}
        />
      </SectionCard>

      <SectionCard title="Rooms">
        <View style={styles.roomStack}>
          {chatRooms.map((room) => (
            <View key={room.title} style={styles.roomCard}>
              <Text style={styles.roomTitle}>{room.title}</Text>
              <Text style={styles.roomDescription}>{room.description}</Text>
            </View>
          ))}
        </View>
      </SectionCard>

      <ComplianceNotice />
    </Screen>
  );
}

const styles = StyleSheet.create({
  helperText: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  roomCard: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  roomDescription: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
  },
  roomStack: {
    gap: 12,
  },
  roomTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
});
