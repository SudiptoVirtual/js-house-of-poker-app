import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import type { BackendShareDestinationId, FeedPost } from '../../types/feed';

import { colors } from '../../theme/colors';
type BackendShareDestination = {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  id: BackendShareDestinationId;
  label: string;
};

const shareDestinations: BackendShareDestination[] = [
  { icon: 'link-variant', id: 'copy-link', label: 'Copy link' },
  { icon: 'newspaper-variant-outline', id: 'feed', label: 'Share to Feed' },
  { icon: 'forum-outline', id: 'chat-room', label: 'Share to Chat Room' },
  { icon: 'account-multiple-outline', id: 'friends', label: 'Share with friends' },
  { icon: 'facebook', id: 'facebook', label: 'Share to Facebook' },
];

type ShareTargetOption = {
  helperText?: string;
  id: string;
  label: string;
};

export type ShareSelection = {
  destinationId: BackendShareDestinationId;
  roomId?: string;
  tableId?: string;
  targetUserId?: string;
};

type ShareMenuProps = {
  onClose: () => void;
  onPromote: () => void;
  chatRoomOptions: ShareTargetOption[];
  friendOptions: ShareTargetOption[];
  onShare: (selection: ShareSelection) => void | Promise<void>;
  post: FeedPost | null;
  visible: boolean;
};

export function ShareMenu({
  chatRoomOptions,
  friendOptions,
  onClose,
  onPromote,
  onShare,
  post,
  visible,
}: ShareMenuProps) {
  const [loadingSelectionKey, setLoadingSelectionKey] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) {
      setLoadingSelectionKey(null);
    }
  }, [visible]);

  function getSelectionKey(selection: ShareSelection) {
    return `${selection.destinationId}:${selection.targetUserId ?? selection.roomId ?? selection.tableId ?? ''}`;
  }

  async function handleShare(selection: ShareSelection) {
    if (loadingSelectionKey) {
      return;
    }

    setLoadingSelectionKey(getSelectionKey(selection));

    try {
      await onShare(selection);
    } finally {
      setLoadingSelectionKey(null);
    }
  }

  function handleDestinationPress(destination: BackendShareDestination) {
    if (destination.id === 'chat-room' || destination.id === 'friends') {
      return;
    }

    void handleShare({ destinationId: destination.id });
  }

  function handlePromotePress() {
    onClose();
    onPromote();
  }

  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={() => {
        if (!loadingSelectionKey) {
          onClose();
        }
      }}
    >
      <Pressable
        disabled={Boolean(loadingSelectionKey)}
        style={styles.backdrop}
        onPress={onClose}
      >
        <Pressable style={styles.panel}>
          <View style={styles.headerRow}>
            <View>
              <Text style={styles.eyebrow}>Share this table story</Text>
              <Text style={styles.title}>
                {post ? `From ${post.player.name}` : 'Share post'}
              </Text>
            </View>
            <Pressable
              accessibilityLabel="Close share menu"
              accessibilityRole="button"
              disabled={Boolean(loadingSelectionKey)}
              onPress={onClose}
              style={styles.closeButton}
            >
              <MaterialCommunityIcons
                color={colors.text}
                name="close"
                size={20}
              />
            </Pressable>
          </View>
          <Text style={styles.helperText}>
            Share increases visibility. Promote for Creator is a separate paid
            sponsorship placeholder.
          </Text>
          <View style={styles.destinationStack}>
            {shareDestinations.map((destination) => {
              const isChatRoomDestination = destination.id === 'chat-room';
              const isFriendsDestination = destination.id === 'friends';
              const targetOptions = isChatRoomDestination
                ? chatRoomOptions
                : isFriendsDestination
                  ? friendOptions
                  : [];
              const destinationSelectionKey = getSelectionKey({ destinationId: destination.id });
              const isDestinationLoading = loadingSelectionKey === destinationSelectionKey;

              return (
                <View key={destination.id} style={styles.destinationGroup}>
                  <Pressable
                    accessibilityRole="button"
                    disabled={Boolean(loadingSelectionKey) || isChatRoomDestination || isFriendsDestination}
                    onPress={() => handleDestinationPress(destination)}
                    style={({ pressed }) => [
                      styles.destination,
                      isChatRoomDestination || isFriendsDestination
                        ? styles.destinationHeader
                        : null,
                      pressed ? styles.destinationPressed : null,
                    ]}
                  >
                    {isDestinationLoading ? (
                      <ActivityIndicator color={colors.secondary} size="small" />
                    ) : (
                      <MaterialCommunityIcons
                        color={colors.secondary}
                        name={destination.icon}
                        size={20}
                      />
                    )}
                    <Text style={styles.destinationLabel}>
                      {destination.label}
                    </Text>
                  </Pressable>
                  {isChatRoomDestination || isFriendsDestination ? (
                    targetOptions.length > 0 ? (
                      <View style={styles.targetStack}>
                        {targetOptions.map((option) => {
                          const selection = isChatRoomDestination
                            ? { destinationId: 'chat-room' as const, roomId: option.id }
                            : { destinationId: 'friends' as const, targetUserId: option.id };
                          const isTargetLoading = loadingSelectionKey === getSelectionKey(selection);

                          return <Pressable
                            accessibilityRole="button"
                            disabled={Boolean(loadingSelectionKey)}
                            key={option.id}
                            onPress={() => { void handleShare(selection); }}
                            style={({ pressed }) => [
                              styles.targetOption,
                              pressed ? styles.destinationPressed : null,
                            ]}
                          >
                            <View style={styles.targetTextStack}>
                              <Text style={styles.targetLabel}>
                                {option.label}
                              </Text>
                              {option.helperText ? (
                                <Text style={styles.targetHelper}>
                                  {option.helperText}
                                </Text>
                              ) : null}
                            </View>
                            {isTargetLoading ? (
                              <ActivityIndicator color={colors.mutedText} size="small" />
                            ) : (
                              <MaterialCommunityIcons
                                color={colors.mutedText}
                                name="chevron-right"
                                size={18}
                              />
                            )}
                          </Pressable>
                        })}
                      </View>
                    ) : (
                      <Text style={styles.emptyTargetText}>
                        {isChatRoomDestination
                          ? 'No chat rooms are available to share into right now.'
                          : 'Add friends to share posts directly.'}
                      </Text>
                    )
                  ) : null}
                </View>
              );
            })}
            <Pressable
              accessibilityRole="button"
              disabled={Boolean(loadingSelectionKey)}
              onPress={handlePromotePress}
              style={({ pressed }) => [
                styles.destination,
                pressed ? styles.destinationPressed : null,
              ]}
            >
              <MaterialCommunityIcons
                color={colors.gold}
                name="bullhorn-outline"
                size={20}
              />
              <Text style={styles.destinationLabel}>Promote for Creator</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(3,1,10,0.72)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 999,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  destination: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 13,
    paddingVertical: 12,
  },
  destinationGroup: {
    gap: 6,
  },
  destinationHeader: {
    opacity: 0.95,
  },
  destinationLabel: {
    color: colors.text,
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  destinationPressed: {
    opacity: 0.76,
  },
  destinationStack: {
    gap: 8,
  },
  emptyTargetText: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    paddingHorizontal: 12,
  },
  eyebrow: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.9,
    textTransform: 'uppercase',
  },
  friendButton: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderColor: colors.border,
    borderRadius: 999,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    maxWidth: '48%',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  friendButtonText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    maxWidth: 120,
  },
  friendButtonWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  friendsHeaderRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  friendsSection: {
    gap: 8,
  },
  friendsTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  headerRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  helperText: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
  },
  panel: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  targetHelper: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '700',
  },
  targetLabel: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  targetOption: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  targetStack: {
    gap: 6,
    paddingLeft: 18,
  },
  targetTextStack: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '900',
  },
});
