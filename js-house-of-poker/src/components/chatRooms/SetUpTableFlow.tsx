import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../ActionButton';
import { colors } from '../../theme/colors';
import type { ChatRoomPlayer } from '../../types/chatRooms';
import { defaultGameOptions, GameSelector, type GameSelectorOption } from './GameSelector';
import { PublicPrivateToggle } from './PublicPrivateToggle';
import { RoomPlayerInviteSelector } from './RoomPlayerInviteSelector';
import {
  defaultTableRulesOptions,
  TableRulesSelector,
  type TableRulesOption,
} from './TableRulesSelector';
import {
  defaultTableTierOptions,
  TableTierSelector,
  type TableTierOption,
} from './TableTierSelector';

type SetUpTableFlowProps = {
  gameOptions?: GameSelectorOption[];
  invitedPlayerIds: string[];
  isLaunching?: boolean;
  isPrivate: boolean;
  onClose: () => void;
  onConfirmSetup: () => void;
  onSelectGame: (gameId: string) => void;
  onSelectRules: (rules: TableRulesOption['value']) => void;
  onSelectTier: (tierId: string) => void;
  onTogglePlayerSelection: (playerId: string) => void;
  onTogglePrivacy: (isPrivate: boolean) => void;
  players: ChatRoomPlayer[];
  rulesOptions?: TableRulesOption[];
  rulesSummary: string;
  selectedGameId: string;
  selectedPlayerIds: string[];
  selectedRuleId: string;
  selectedTierId: string;
  tierOptions?: TableTierOption[];
  visible: boolean;
};

export function SetUpTableFlow({
  gameOptions = defaultGameOptions,
  invitedPlayerIds,
  isLaunching = false,
  isPrivate,
  onClose,
  onConfirmSetup,
  onSelectGame,
  onSelectRules,
  onSelectTier,
  onTogglePlayerSelection,
  onTogglePrivacy,
  players,
  rulesOptions = defaultTableRulesOptions,
  rulesSummary,
  selectedGameId,
  selectedPlayerIds,
  selectedRuleId,
  selectedTierId,
  tierOptions = defaultTableTierOptions,
  visible,
}: SetUpTableFlowProps) {
  const selectedGame = gameOptions.find((option) => option.id === selectedGameId);
  const selectedTier = tierOptions.find((option) => option.id === selectedTierId);

  return (
    <Modal animationType="slide" onRequestClose={onClose} visible={visible}>
      <View style={styles.container}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>AI Prime → Set Up Table</Text>
            <Text style={styles.title}>Guided table setup</Text>
            <Text style={styles.subtitle}>
              Pick Game → Set Tier / Rules → Choose Public or Private → Invite Room Players → Launch Table.
            </Text>
          </View>
          <Pressable accessibilityLabel="Close table setup" accessibilityRole="button" onPress={onClose} style={styles.closeButton}>
            <MaterialCommunityIcons color={colors.text} name="close" size={20} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <View style={styles.stepCard}>
            <StepHeader index={1} title="Pick Game" />
            <GameSelector options={gameOptions} selectedGameId={selectedGameId} onSelectGame={onSelectGame} />
          </View>

          <View style={styles.stepCard}>
            <StepHeader index={2} title="Set Table Tier" />
            <TableTierSelector options={tierOptions} selectedTierId={selectedTierId} onSelectTier={onSelectTier} />
          </View>

          <View style={styles.stepCard}>
            <StepHeader index={3} title="Choose Rules" />
            <TableRulesSelector options={rulesOptions} selectedRuleId={selectedRuleId} onSelectRules={onSelectRules} />
          </View>

          <View style={styles.stepCard}>
            <StepHeader index={4} title="Public or Private" />
            <PublicPrivateToggle isPrivate={isPrivate} onTogglePrivacy={onTogglePrivacy} />
          </View>

          <View style={styles.stepCard}>
            <StepHeader index={5} title="Invite Room Players" />
            <RoomPlayerInviteSelector
              invitedPlayerIds={invitedPlayerIds}
              players={players}
              selectedPlayerIds={selectedPlayerIds}
              onTogglePlayer={onTogglePlayerSelection}
            />
          </View>

          <View style={styles.summaryBox}>
            <Text style={styles.summaryLabel}>AI Prime launch plan</Text>
            <Text style={styles.summaryText}>{selectedGame?.label ?? 'Game'} • {selectedTier?.stakesLabel ?? 'Tier'}</Text>
            <Text style={styles.summaryMuted}>{rulesSummary}</Text>
            <Text style={styles.summaryMuted}>
              {isPrivate ? 'Private invite table' : 'Public room table'} • {selectedPlayerIds.length} room invite
              {selectedPlayerIds.length === 1 ? '' : 's'} queued • {invitedPlayerIds.length} already invited
            </Text>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <ActionButton
            fullWidth
            disabled={isLaunching}
            icon="rocket-launch-outline"
            label={isLaunching ? 'Launching table…' : 'Launch Table'}
            loading={isLaunching}
            onPress={onConfirmSetup}
            tone="success"
          />
          <Text style={styles.footerNote}>
            AI Prime prepares the table from chat and moves the creator directly into live gameplay.
          </Text>
        </View>
      </View>
    </Modal>
  );
}

function StepHeader({ index, title }: { index: number; title: string }) {
  return (
    <View style={styles.stepHeader}>
      <View style={styles.stepBadge}>
        <Text style={styles.stepBadgeText}>{index}</Text>
      </View>
      <Text style={styles.stepTitle}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
  container: {
    backgroundColor: colors.background,
    flex: 1,
    paddingTop: 22,
  },
  content: {
    gap: 12,
    padding: 16,
    paddingBottom: 22,
  },
  eyebrow: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  footer: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopWidth: 1,
    gap: 8,
    padding: 16,
  },
  footerNote: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  headerCopy: {
    flex: 1,
    gap: 4,
  },
  headerRow: {
    alignItems: 'flex-start',
    backgroundColor: colors.surface,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: colors.gold,
    borderRadius: 999,
    height: 25,
    justifyContent: 'center',
    width: 25,
  },
  stepBadgeText: {
    color: colors.background,
    fontSize: 12,
    fontWeight: '900',
  },
  stepCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  stepHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  stepTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '900',
  },
  subtitle: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryBox: {
    backgroundColor: 'rgba(139,92,255,0.16)',
    borderColor: colors.primary,
    borderRadius: 18,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  summaryLabel: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  summaryMuted: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
  },
  title: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
});
