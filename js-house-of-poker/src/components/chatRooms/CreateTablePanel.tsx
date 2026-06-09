import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ActionButton } from '../ActionButton';
import { SectionCard } from '../SectionCard';
import { colors } from '../../theme/colors';
import type { ChatRoomPlayer } from '../../types/chatRooms';
import { defaultGameOptions, GameSelector, type GameSelectorOption } from './GameSelector';
import { InvitePlayerSelector } from './InvitePlayerSelector';
import {
  defaultTableTierOptions,
  TableTierSelector,
  type TableTierOption,
} from './TableTierSelector';

type CreateTablePanelProps = {
  gameOptions?: GameSelectorOption[];
  invitedPlayerIds: string[];
  isLaunching?: boolean;
  isPrivate: boolean;
  onInviteSelectedPlayers: () => void | Promise<void>;
  onLaunchTable: () => void;
  onSelectGame: (gameId: string) => void;
  onSelectTier: (tierId: string) => void;
  onTogglePlayerSelection: (playerId: string) => void;
  onTogglePrivacy: (isPrivate: boolean) => void;
  players: ChatRoomPlayer[];
  selectedPlayerIds: string[];
  rulesSummary: string;
  selectedGameId: string;
  selectedTierId: string;
  tierOptions?: TableTierOption[];
};

export function CreateTablePanel({
  gameOptions = defaultGameOptions,
  invitedPlayerIds,
  isLaunching = false,
  isPrivate,
  onInviteSelectedPlayers,
  onLaunchTable,
  onSelectGame,
  onSelectTier,
  onTogglePlayerSelection,
  onTogglePrivacy,
  players,
  selectedPlayerIds,
  rulesSummary,
  selectedGameId,
  selectedTierId,
  tierOptions = defaultTableTierOptions,
}: CreateTablePanelProps) {
  const [isInvitingSelectedPlayers, setIsInvitingSelectedPlayers] = useState(false);
  const selectedGame = gameOptions.find((option) => option.id === selectedGameId);
  const selectedTier = tierOptions.find((option) => option.id === selectedTierId);

  async function handleInviteSelectedPlayers() {
    if (isInvitingSelectedPlayers) {
      return;
    }

    setIsInvitingSelectedPlayers(true);

    try {
      await onInviteSelectedPlayers();
    } finally {
      setIsInvitingSelectedPlayers(false);
    }
  }

  return (
    <SectionCard title="Create table">
      <Text style={styles.helperText}>
        Configure a room-scoped table before launch. Gameplay chat remains separate once players sit down.
      </Text>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>Game type</Text>
        <GameSelector options={gameOptions} selectedGameId={selectedGameId} onSelectGame={onSelectGame} />
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>Table tier and rules</Text>
        <TableTierSelector options={tierOptions} selectedTierId={selectedTierId} onSelectTier={onSelectTier} />
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>Access</Text>
        <View style={styles.privacyRow}>
          <PrivacyToggle label="Public" selected={!isPrivate} onPress={() => onTogglePrivacy(false)} />
          <PrivacyToggle label="Private" selected={isPrivate} onPress={() => onTogglePrivacy(true)} />
        </View>
      </View>

      <View style={styles.group}>
        <Text style={styles.groupLabel}>Invite room players</Text>
        <InvitePlayerSelector
          invitedPlayerIds={invitedPlayerIds}
          players={players}
          selectedPlayerIds={selectedPlayerIds}
          onTogglePlayer={onTogglePlayerSelection}
        />
        <Text style={styles.inviteHelper}>
          Select available room players, then invite them when the table plan is ready. Away and seated players
          stay unavailable until their presence changes.
        </Text>
        <ActionButton
          compact
          disabled={selectedPlayerIds.length === 0 || isInvitingSelectedPlayers}
          icon="email-fast-outline"
          label={`Queue Invites (${selectedPlayerIds.length})`}
          loading={isInvitingSelectedPlayers}
          onPress={() => { void handleInviteSelectedPlayers().catch(() => undefined); }}
          tone="accent"
          variant="secondary"
        />
      </View>

      <View style={styles.summaryBox}>
        <Text style={styles.summaryLabel}>Launch summary</Text>
        <Text style={styles.summaryText}>{selectedGame?.label ?? 'Game'} • {selectedTier?.stakesLabel ?? 'Tier'}</Text>
        <Text style={styles.summaryMuted}>{rulesSummary}</Text>
        <Text style={styles.summaryMuted}>
          {isPrivate ? 'Private invite table' : 'Public room table'} • {selectedPlayerIds.length} selected •{' '}
          {invitedPlayerIds.length} invited
        </Text>
      </View>

      <ActionButton
        fullWidth
        disabled={isLaunching}
        icon="rocket-launch-outline"
        label={isLaunching ? 'Launching table…' : 'Launch table'}
        loading={isLaunching}
        onPress={onLaunchTable}
        tone="success"
      />
    </SectionCard>
  );
}

function PrivacyToggle({ label, onPress, selected }: { label: string; onPress: () => void; selected: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.privacyToggle, selected ? styles.privacyToggleSelected : null, pressed ? styles.pressed : null]}
    >
      <Text style={[styles.privacyText, selected ? styles.privacyTextSelected : null]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  group: {
    gap: 8,
  },
  groupLabel: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 21,
  },
  inviteHelper: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 17,
  },
  pressed: {
    opacity: 0.78,
  },
  privacyRow: {
    flexDirection: 'row',
    gap: 8,
  },
  privacyText: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: '900',
  },
  privacyTextSelected: {
    color: colors.background,
  },
  privacyToggle: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  privacyToggleSelected: {
    backgroundColor: colors.gold,
    borderColor: colors.gold,
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
});
