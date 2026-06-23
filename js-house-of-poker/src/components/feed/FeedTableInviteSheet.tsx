import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { defaultTableTierOptions, TableTierSelector } from '../chatRooms/TableTierSelector';
import { colors } from '../../theme/colors';
import type { FeedPost, FeedTableContext } from '../../types/feed';

export type FeedInviteFriendOption = {
  helperText?: string;
  id: string;
  label: string;
};

export type FeedInviteTableSelection = 'active' | 'post';

type FeedTableInviteSheetProps = {
  activeTableContext?: FeedTableContext | null;
  friendOptions: FeedInviteFriendOption[];
  gameOption: string;
  loading: boolean;
  message: string;
  onClose: () => void;
  onSelectTable: (table: FeedInviteTableSelection) => void;
  onSetGameOption: (value: string) => void;
  onSetMessage: (value: string) => void;
  onSetStakesOption: (value: string) => void;
  onSubmit: () => void;
  onToggleFriend: (friendId: string) => void;
  post: FeedPost | null;
  selectedFriendIds: string[];
  selectedStakesOption: string;
  selectedTable: FeedInviteTableSelection;
  visible: boolean;
};

function describeTableContext(context?: FeedTableContext | null) {
  if (!context) {
    return 'No table selected';
  }

  const details = [
    context.gameLabel,
    context.tableCode ? `Code ${context.tableCode}` : context.tableId ? `Table ${context.tableId}` : '',
    typeof context.seatsOpen === 'number' ? `${context.seatsOpen} seats open` : '',
  ].filter(Boolean);

  return details.length ? details.join(' • ') : 'Table details available';
}

function findSelectedTierId(gameOption: string, selectedStakesOption: string) {
  const matchingTier = defaultTableTierOptions.find(
    (option) => option.label === gameOption || option.stakesLabel === selectedStakesOption,
  );

  return matchingTier?.id ?? '';
}

export function FeedTableInviteSheet({
  activeTableContext,
  friendOptions,
  gameOption,
  loading,
  message,
  onClose,
  onSelectTable,
  onSetGameOption,
  onSetMessage,
  onSetStakesOption,
  onSubmit,
  onToggleFriend,
  post,
  selectedFriendIds,
  selectedStakesOption,
  selectedTable,
  visible,
}: FeedTableInviteSheetProps) {
  const selectedTableContext = selectedTable === 'post' ? post?.tableContext : activeTableContext;
  const canSubmit = selectedFriendIds.length > 0 && Boolean(selectedTableContext?.tableCode || selectedTableContext?.tableId) && !loading;
  const selectedTierId = findSelectedTierId(gameOption, selectedStakesOption);

  function handleSelectTier(tierId: string) {
    const tier = defaultTableTierOptions.find((option) => option.id === tierId);

    if (!tier) {
      return;
    }

    onSetGameOption(tier.label);
    onSetStakesOption(tier.stakesLabel);
  }

  return (
    <Modal animationType="slide" onRequestClose={onClose} transparent visible={visible}>
      <View style={styles.inviteBackdrop}>
        <View style={styles.inviteSheet}>
          <View style={styles.sheetHandle} />
          <Text style={styles.inviteTitle}>Invite friends to table</Text>
          <Text style={styles.inviteSubtitle}>
            Choose recipients, confirm the table, and add game details before sending feed invites.
          </Text>

          <ScrollView contentContainerStyle={styles.inviteScrollContent} showsVerticalScrollIndicator={false}>
            <Text style={styles.inviteSectionLabel}>Friends</Text>
            {friendOptions.length ? (
              <View style={styles.inviteOptionStack}>
                {friendOptions.map((friend) => {
                  const selected = selectedFriendIds.includes(friend.id);

                  return (
                    <Pressable
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: selected, disabled: loading }}
                      disabled={loading}
                      key={friend.id}
                      onPress={() => onToggleFriend(friend.id)}
                      style={[styles.inviteOption, selected ? styles.inviteOptionSelected : null]}
                    >
                      <View style={styles.optionTextStack}>
                        <Text style={styles.inviteOptionText}>{friend.label}</Text>
                        <Text style={styles.inviteOptionHelper}>{friend.helperText ?? 'Friend'}</Text>
                      </View>
                      <Text style={styles.inviteCheckmark}>{selected ? '✓' : '+'}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={styles.inviteEmptyText}>Add friends before sending table invites from the feed.</Text>
            )}

            <Text style={styles.inviteSectionLabel}>Table</Text>
            <View style={styles.inviteSegmentRow}>
              {post?.tableContext ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={() => onSelectTable('post')}
                  style={[styles.inviteSegment, selectedTable === 'post' ? styles.inviteSegmentSelected : null]}
                >
                  <Text style={styles.inviteSegmentText}>Post table</Text>
                </Pressable>
              ) : null}
              {activeTableContext ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={loading}
                  onPress={() => onSelectTable('active')}
                  style={[styles.inviteSegment, selectedTable === 'active' ? styles.inviteSegmentSelected : null]}
                >
                  <Text style={styles.inviteSegmentText}>Current table</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.tableContextCard}>
              <Text style={styles.tableContextName}>{selectedTableContext?.tableName ?? 'Choose a table'}</Text>
              <Text style={styles.tableContextDetails}>{describeTableContext(selectedTableContext)}</Text>
            </View>

            <Text style={styles.inviteSectionLabel}>Game & stakes</Text>
            <TableTierSelector options={defaultTableTierOptions} selectedTierId={selectedTierId} onSelectTier={handleSelectTier} />
            <TextInput
              accessibilityLabel="Invite game option"
              editable={!loading}
              onChangeText={onSetGameOption}
              placeholder="Game, e.g. Texas Hold'em"
              placeholderTextColor={colors.mutedText}
              style={styles.inviteInput}
              value={gameOption}
            />
            <TextInput
              accessibilityLabel="Invite stakes option"
              editable={!loading}
              onChangeText={onSetStakesOption}
              placeholder="Stakes, e.g. 25/50 clips"
              placeholderTextColor={colors.mutedText}
              style={styles.inviteInput}
              value={selectedStakesOption}
            />
            <TextInput
              accessibilityLabel="Invite message"
              editable={!loading}
              multiline
              onChangeText={onSetMessage}
              placeholder="Add a message"
              placeholderTextColor={colors.mutedText}
              style={[styles.inviteInput, styles.inviteMessageInput]}
              value={message}
            />
          </ScrollView>

          <View style={styles.inviteActions}>
            <Pressable accessibilityRole="button" disabled={loading} onPress={onClose} style={[styles.inviteButton, styles.inviteSecondaryButton]}>
              <Text style={styles.inviteSecondaryButtonText}>Cancel</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={!canSubmit}
              onPress={onSubmit}
              style={[styles.inviteButton, styles.invitePrimaryButton, !canSubmit ? styles.inviteButtonDisabled : null]}
            >
              <Text style={styles.invitePrimaryButtonText}>{loading ? 'Sending…' : 'Send invite'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  inviteActions: { flexDirection: 'row', gap: 12, paddingTop: 14 },
  inviteBackdrop: { backgroundColor: 'rgba(0,0,0,0.64)', flex: 1, justifyContent: 'flex-end' },
  inviteButton: { alignItems: 'center', borderRadius: 16, flex: 1, justifyContent: 'center', minHeight: 48, paddingHorizontal: 14 },
  inviteButtonDisabled: { opacity: 0.65 },
  inviteCheckmark: { color: colors.secondary, fontSize: 18, fontWeight: '900' },
  inviteEmptyText: { color: colors.mutedText, fontSize: 13, fontWeight: '700', lineHeight: 19 },
  inviteInput: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: colors.border, borderRadius: 16, borderWidth: 1, color: colors.text, fontSize: 14, fontWeight: '700', paddingHorizontal: 14, paddingVertical: 12 },
  inviteMessageInput: { minHeight: 92, textAlignVertical: 'top' },
  inviteOption: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderColor: colors.border, borderRadius: 16, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 12 },
  inviteOptionHelper: { color: colors.mutedText, fontSize: 12, fontWeight: '700', marginTop: 3 },
  inviteOptionSelected: { backgroundColor: 'rgba(54,231,255,0.12)', borderColor: colors.secondary },
  inviteOptionStack: { gap: 10 },
  inviteOptionText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  invitePrimaryButton: { backgroundColor: colors.primary },
  invitePrimaryButtonText: { color: colors.background, fontSize: 14, fontWeight: '900' },
  inviteScrollContent: { gap: 12, paddingBottom: 8 },
  inviteSecondaryButton: { backgroundColor: 'rgba(255,255,255,0.08)', borderColor: colors.border, borderWidth: 1 },
  inviteSecondaryButtonText: { color: colors.text, fontSize: 14, fontWeight: '900' },
  inviteSectionLabel: { color: colors.secondary, fontSize: 12, fontWeight: '900', letterSpacing: 0.7, textTransform: 'uppercase' },
  inviteSegment: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.06)', borderColor: colors.border, borderRadius: 999, borderWidth: 1, flex: 1, paddingHorizontal: 12, paddingVertical: 10 },
  inviteSegmentRow: { flexDirection: 'row', gap: 10 },
  inviteSegmentSelected: { backgroundColor: 'rgba(179,136,255,0.22)', borderColor: colors.primary },
  inviteSegmentText: { color: colors.text, fontSize: 13, fontWeight: '900' },
  inviteSheet: { backgroundColor: colors.surface, borderColor: colors.border, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, maxHeight: '88%', padding: 20 },
  inviteSubtitle: { color: colors.mutedText, fontSize: 13, fontWeight: '700', lineHeight: 19, marginBottom: 14 },
  inviteTitle: { color: colors.text, fontSize: 22, fontWeight: '900', marginBottom: 6 },
  optionTextStack: { flex: 1, paddingRight: 8 },
  sheetHandle: { alignSelf: 'center', backgroundColor: colors.border, borderRadius: 999, height: 4, marginBottom: 14, width: 48 },
  tableContextCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: colors.border, borderRadius: 16, borderWidth: 1, gap: 4, padding: 12 },
  tableContextDetails: { color: colors.mutedText, fontSize: 12, fontWeight: '700', lineHeight: 18 },
  tableContextName: { color: colors.text, fontSize: 15, fontWeight: '900' },
});
