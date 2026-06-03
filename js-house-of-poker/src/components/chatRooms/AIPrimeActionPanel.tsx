import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

export type AIPrimeActionId =
  | 'setUpTable'
  | 'findTable'
  | 'invitePlayers'
  | 'explain357Rules'
  | 'translateChat'
  | 'summarizeChat';

type AIPrimeAction = {
  description: string;
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  id: AIPrimeActionId;
  label: string;
};

type AIPrimeActionPanelProps = {
  onClose: () => void;
  onSelectAction: (actionId: AIPrimeActionId) => void;
  visible: boolean;
};

const aiPrimeActions: AIPrimeAction[] = [
  {
    id: 'setUpTable',
    label: 'Set Up Table',
    description: 'Guided game, tier, rules, visibility, and room invites.',
    icon: 'poker-chip',
  },
  {
    id: 'findTable',
    label: 'Find a Table',
    description: 'Ask AI Prime to locate a matching open table.',
    icon: 'magnify',
  },
  {
    id: 'invitePlayers',
    label: 'Invite Players',
    description: 'Draft a room invite from the current conversation.',
    icon: 'account-multiple-plus',
  },
  {
    id: 'explain357Rules',
    label: 'Explain 357 Rules',
    description: 'Get a quick assistant explanation of the 3-5-7 format.',
    icon: 'cards-outline',
  },
  {
    id: 'translateChat',
    label: 'Translate Chat',
    description: 'Translate recent messages when multilingual chat is enabled.',
    icon: 'translate',
  },
  {
    id: 'summarizeChat',
    label: 'Summarize Chat',
    description: 'Summarize the table plan that players discussed.',
    icon: 'text-box-search-outline',
  },
];

export function AIPrimeActionPanel({ onClose, onSelectAction, visible }: AIPrimeActionPanelProps) {
  return (
    <Modal animationType="fade" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.backdrop}>
        <Pressable accessibilityLabel="Close AI Prime actions" style={styles.backdropPressable} onPress={onClose} />
        <View style={styles.panel}>
          <View style={styles.headerRow}>
            <View style={styles.titleCopy}>
              <Text style={styles.eyebrow}>AI Prime</Text>
              <Text style={styles.title}>Chat room assistant</Text>
              <Text style={styles.subtitle}>Keep the room social, then launch table actions from the conversation.</Text>
            </View>
            <Pressable accessibilityLabel="Close AI Prime actions" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
              <MaterialCommunityIcons color={colors.text} name="close" size={20} />
            </Pressable>
          </View>

          <View style={styles.actionStack}>
            {aiPrimeActions.map((action, index) => {
              const isPrimary = action.id === 'setUpTable';

              return (
                <Pressable
                  accessibilityRole="button"
                  key={action.id}
                  onPress={() => onSelectAction(action.id)}
                  style={({ pressed }) => [
                    styles.actionCard,
                    isPrimary ? styles.primaryActionCard : null,
                    pressed ? styles.pressed : null,
                  ]}
                >
                  <View style={[styles.actionIcon, isPrimary ? styles.primaryActionIcon : null]}>
                    <MaterialCommunityIcons color={isPrimary ? colors.background : colors.secondary} name={action.icon} size={21} />
                  </View>
                  <View style={styles.actionCopy}>
                    <Text style={styles.actionLabel}>{index + 1}. {action.label}</Text>
                    <Text style={styles.actionDescription}>{action.description}</Text>
                  </View>
                  <MaterialCommunityIcons color={isPrimary ? colors.gold : colors.mutedText} name="chevron-right" size={22} />
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actionCard: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  actionCopy: {
    flex: 1,
    gap: 3,
  },
  actionDescription: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
  },
  actionIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  actionLabel: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  actionStack: {
    gap: 9,
  },
  backdrop: {
    backgroundColor: 'rgba(4,2,16,0.72)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropPressable: {
    flex: 1,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  headerRow: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    gap: 16,
    padding: 18,
  },
  pressed: {
    opacity: 0.78,
  },
  primaryActionCard: {
    backgroundColor: 'rgba(255,198,108,0.14)',
    borderColor: colors.gold,
  },
  primaryActionIcon: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  title: {
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
  },
  titleCopy: {
    flex: 1,
    gap: 4,
  },
});
