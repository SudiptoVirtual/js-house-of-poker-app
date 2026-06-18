import { memo, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { PokerAction, PokerControls, PokerPlayerState } from '../../types/poker';

import { colors } from '../../theme/colors';
type ControlMode = '357' | 'standard';
type ButtonVariant = 'destructive' | 'primary' | 'secondary' | 'gold';
type ControlLayout = 'default' | 'leftPanel' | 'rightPanel' | 'column';

type Props = {
  controls: PokerControls;
  currentBet?: number;
  mode: ControlMode;
  layout?: ControlLayout;
  onAction: (action: PokerAction) => void;
  onRaiseChange?: (value: string) => void;
  onRaiseSubmit?: () => void;
  onRebuy: () => void;
  onStartHand: () => void;
  pendingAction?: string | null;
  player: PokerPlayerState | null;
  raiseTo?: string;
  statusMessage: string;
  showActionButtons?: boolean;
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ControlButton({
  compact,
  disabled,
  label,
  large,
  loading,
  onPress,
  subtitle,
  tone,
}: {
  compact?: boolean;
  disabled?: boolean;
  label: string;
  large?: boolean;
  loading?: boolean;
  onPress: () => void;
  subtitle?: string;
  tone: ButtonVariant;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonPressable,
        compact ? styles.buttonPressableCompact : null,
        large ? styles.buttonPressableLarge : null,
        pressed && !disabled ? styles.buttonPressed : null,
        disabled ? styles.buttonDisabled : null,
      ]}
    >
      <LinearGradient
        colors={buttonColors[tone]}
        end={{ x: 1, y: 1 }}
        start={{ x: 0, y: 0 }}
        style={[
          styles.controlButton,
          compact ? styles.controlButtonCompact : null,
          large ? styles.controlButtonLarge : null,
          buttonVariantStyles[tone],
        ]}
      >
        {loading ? (
          <ActivityIndicator color={colors.white} size="small" />
        ) : (
          <Text
            adjustsFontSizeToFit
            minimumFontScale={0.72}
            numberOfLines={1}
            style={[
              styles.buttonLabel,
              compact ? styles.buttonLabelCompact : null,
              large ? styles.buttonLabelLarge : null,
              buttonTextVariantStyles[tone],
            ]}
          >
            {label}
          </Text>
        )}
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[
              styles.buttonSubtitle,
              compact ? styles.buttonSubtitleCompact : null,
              large ? styles.buttonSubtitleLarge : null,
            ]}
          >
            {subtitle}
          </Text>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const buttonColors = {
  destructive: colors.gradients.actionDestructive,
  gold: colors.gradients.actionGold,
  primary: colors.gradients.actionPrimary,
  secondary: colors.gradients.actionSecondary,
} as const;

const buttonVariantStyles = {
  destructive: { borderColor: colors.danger, shadowColor: colors.danger },
  gold: { borderColor: colors.gold, shadowColor: colors.gold },
  primary: { borderColor: colors.action, shadowColor: colors.action },
  secondary: { borderColor: colors.primary, shadowColor: colors.primary },
} as const;

const buttonTextVariantStyles = {
  destructive: { color: colors.danger },
  gold: { color: colors.gold },
  primary: { color: colors.action },
  secondary: { color: colors.text },
} as const;

export const GameControls = memo(function GameControls({
  controls,
  currentBet = 0,
  mode,
  layout = 'default',
  onAction,
  onRaiseChange,
  onRaiseSubmit,
  onRebuy,
  onStartHand,
  pendingAction = null,
  player,
  raiseTo = '',
  statusMessage,
  showActionButtons = true,
}: Props) {
  const [raiseOpen, setRaiseOpen] = useState(false);
  const isLeftPanel = layout === 'leftPanel';
  const isRightPanel = layout === 'rightPanel';
  const isColumn = layout === 'column';
  const isSidePanel = isLeftPanel || isRightPanel;
  const availableActions = controls.availableActions;
  const canRaise =
    mode === 'standard' &&
    controls.canAct &&
    (availableActions.includes('bet') || availableActions.includes('raise'));
  const canAllIn = mode === 'standard' && availableActions.includes('all-in');
  const canCheck = mode === 'standard' && availableActions.includes('check');
  const canCall = mode === 'standard' && availableActions.includes('call');
  const minRaise = Math.max(controls.minRaiseTo, 1);
  const maxRaise = Math.max(minRaise, controls.maxRaiseTo || minRaise);
  const fallbackRaiseValue = Math.max(minRaise, currentBet || minRaise);
  const raiseValue = clamp(Number(raiseTo) || fallbackRaiseValue, minRaise, maxRaise);
  const step = Math.max(1, Math.floor(Math.max(10, maxRaise - minRaise) / 8));
  const raiseVerb = currentBet === 0 ? 'BET' : 'RAISE';
  const infoText = useMemo(() => {
    if (player) {
      return `${player.name} | ${player.chips.toLocaleString('en-US')}`;
    }

    return 'Table controls';
  }, [player]);

  useEffect(() => {
    if (!controls.canAct || mode !== 'standard') {
      setRaiseOpen(false);
    }
  }, [controls.canAct, mode]);

  function updateRaise(value: number) {
    onRaiseChange?.(String(clamp(value, minRaise, maxRaise)));
  }

  function submitRaise() {
    if (!canRaise || !onRaiseSubmit) {
      return;
    }

    if (!raiseOpen) {
      setRaiseOpen(true);
      return;
    }

    onRaiseSubmit();
  }

  const hasPrimaryControl =
    controls.canAct || controls.canStartHand || controls.canRebuy || canAllIn;

  return (
    <View
      style={[
        styles.root,
        isSidePanel ? styles.rootSidePanel : null,
        isRightPanel ? styles.rootRightPanel : null,
      ]}
    >
      {!isRightPanel ? (
        <View style={[styles.metaRow, isLeftPanel ? styles.metaRowLeftPanel : null]}>
          <Text
            numberOfLines={1}
            style={[styles.playerText, isLeftPanel ? styles.playerTextLeftPanel : null]}
          >
            {infoText}
          </Text>
          {!isLeftPanel ? (
            <Text numberOfLines={1} style={styles.statusText}>
              {pendingAction ? 'Waiting for server...' : statusMessage}
            </Text>
          ) : (
            <Text numberOfLines={2} style={styles.statusTextLeftPanel}>
              {pendingAction ? 'Waiting for server...' : statusMessage}
            </Text>
          )}
        </View>
      ) : null}

      {mode === '357' && controls.canAct && showActionButtons ? (
        <View
          style={[
            styles.buttonRow,
            isSidePanel ? styles.buttonRowSidePanel : null,
            isRightPanel ? styles.buttonRowRightPanel : null,
          ]}
        >
          <ControlButton
            compact={isSidePanel}
            disabled={!availableActions.includes('go')}
            label="GO"
            large={isRightPanel}
            loading={pendingAction === 'go'}
            onPress={() => onAction('go')}
            subtitle="ENTER"
            tone="primary"
          />
          <ControlButton
            compact={isSidePanel}
            disabled={!availableActions.includes('stay')}
            label="STAY"
            large={isRightPanel}
            loading={pendingAction === 'stay'}
            onPress={() => onAction('stay')}
            subtitle="SIT OUT"
            tone="destructive"
          />
        </View>
      ) : null}

      {mode === 'standard' && controls.canAct ? (
        <>
          <View style={[styles.buttonRow, isColumn ? styles.buttonRowColumn : null]}>
            <ControlButton
              compact={isColumn}
              disabled={!availableActions.includes('fold')}
              label="FOLD"
              loading={pendingAction === 'fold'}
              onPress={() => onAction('fold')}
              tone="primary"
            />
            <ControlButton
              compact={isColumn}
              disabled={!canCheck && !canCall}
              label={canCheck ? 'CHECK' : `CALL ${controls.callAmount}`}
              loading={pendingAction === 'check' || pendingAction === 'call'}
              onPress={() => onAction(canCheck ? 'check' : 'call')}
              tone="secondary"
            />
            <ControlButton
              compact={isColumn}
              disabled={!canRaise && !canAllIn}
              label={canRaise ? raiseVerb : 'ALL-IN'}
              loading={
                pendingAction === 'raise' ||
                pendingAction === 'bet' ||
                pendingAction === 'all-in'
              }
              onPress={canRaise ? submitRaise : () => onAction('all-in')}
              tone="gold"
            />
          </View>

          {raiseOpen && canRaise ? (
            <View style={styles.raisePanel}>
              <View style={styles.raiseHeader}>
                <Text style={styles.raiseLabel}>{raiseVerb} TO</Text>
                <Text style={styles.raiseAmount}>{raiseValue.toLocaleString('en-US')}</Text>
              </View>
              <View style={styles.raiseControls}>
                <Pressable
                  accessibilityRole="button"
                  onPress={() => updateRaise(raiseValue - step)}
                  style={styles.stepper}
                >
                  <Text style={styles.stepperText}>-</Text>
                </Pressable>
                <TextInput
                  keyboardType="numeric"
                  onChangeText={onRaiseChange}
                  placeholder={`${minRaise}`}
                  placeholderTextColor={colors.mutedText}
                  style={styles.raiseInput}
                  value={raiseTo}
                />
                <Pressable
                  accessibilityRole="button"
                  onPress={() => updateRaise(raiseValue + step)}
                  style={styles.stepper}
                >
                  <Text style={styles.stepperText}>+</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  onPress={onRaiseSubmit}
                  style={styles.submitRaise}
                >
                  <Text style={styles.submitRaiseText}>SEND</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </>
      ) : null}

      {!hasPrimaryControl ? (
        <View style={styles.waitingPanel}>
          <Text numberOfLines={2} style={styles.waitingText}>
            {statusMessage}
          </Text>
        </View>
      ) : null}

      {!controls.canAct && (controls.canStartHand || controls.canRebuy) ? (
        <View style={[styles.utilityRow, isRightPanel ? styles.utilityRowRightPanel : null]}>
          {controls.canStartHand ? (
            <ControlButton
              compact={isRightPanel}
              label={mode === '357' ? 'START' : 'DEAL'}
              large={isRightPanel}
              loading={pendingAction === 'start'}
              onPress={onStartHand}
              tone="primary"
            />
          ) : null}
          {controls.canRebuy ? (
            <ControlButton
              compact={isRightPanel}
              label="REBUY"
              large={isRightPanel}
              loading={pendingAction === 'rebuy'}
              onPress={onRebuy}
              tone="gold"
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  buttonDisabled: {
    opacity: 0.42,
  },
  buttonLabel: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  buttonLabelCompact: {
    fontSize: 18,
    letterSpacing: 0.2,
  },
  buttonLabelLarge: {
    fontSize: 22,
  },
  buttonPressable: {
    flex: 1,
    minWidth: 0,
  },
  buttonPressableCompact: {
    alignSelf: 'stretch',
    flex: 0,
    width: '100%',
  },
  buttonPressableLarge: {
    minWidth: 0,
  },
  buttonPressed: {
    transform: [{ scale: 0.98 }],
  },
  buttonRow: {
    alignItems: 'stretch',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'center',
    width: '80%',
  },
  buttonRowColumn: {
    flexDirection: 'column',
    gap: 10,
    width: '80%',
  },
  buttonRowSidePanel: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    gap: 9,
    justifyContent: 'flex-start',
    maxWidth: 236,
    width: '100%',
  },
  buttonRowRightPanel: {
    gap: 11,
    maxWidth: 236 * 1.2,
  },
  buttonSubtitle: {
    color: colors.white,
    fontSize: 11,
    fontWeight: '800',
    marginTop: 2,
    opacity: 0.86,
    textAlign: 'center',
  },
  buttonSubtitleCompact: {
    fontSize: 8,
    marginTop: 1,
  },
  buttonSubtitleLarge: {
    fontSize: 10,
    marginTop: 1,
  },
  controlButton: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    justifyContent: 'center',
    minHeight: 50,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 7,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.78,
    shadowRadius: 12,
  },
  controlButtonCompact: {
    borderRadius: 9,
    minHeight: 46,
    paddingHorizontal: 7,
    paddingVertical: 6,
    width: '100%',
  },
  controlButtonLarge: {
    borderRadius: 11,
    minHeight: 55,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  goldText: {
    color: colors.gold,
  },
  metaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 2,
  },
  metaRowLeftPanel: {
    alignItems: 'flex-start',
    flexDirection: 'column',
    maxWidth: 236,
    width: '100%',
  },
  playerText: {
    color: colors.white,
    flexShrink: 0,
    fontSize: 12,
    fontWeight: '900',
    maxWidth: '42%',
  },
  playerTextLeftPanel: {
    color: '#F4ECFF',
    fontSize: 14,
    maxWidth: '100%',
  },
  raiseAmount: {
    color: colors.white,
    fontSize: 13,
    fontWeight: '900',
  },
  raiseControls: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  raiseHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  raiseInput: {
    backgroundColor: colors.surfaces.inputField,
    borderColor: colors.glowGold,
    borderRadius: 8,
    borderWidth: 1,
    color: colors.white,
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    minHeight: 38,
    minWidth: 80,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  raiseLabel: {
    color: colors.gold,
    fontSize: 11,
    fontWeight: '900',
  },
  raisePanel: {
    alignSelf: 'center',
    backgroundColor: colors.background,
    borderColor: colors.glowGold,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: -4,
    maxWidth: 520,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '74%',
  },
  root: {
    alignSelf: 'center',
    gap: 8,
    maxWidth: 680,
    paddingHorizontal: 6,
    width: '100%',
  },
  rootSidePanel: {
    alignSelf: 'stretch',
    gap: 10,
    maxWidth: 236,
    paddingHorizontal: 0,
  },
  rootRightPanel: {
    transform: [{ translateX: '-30%' }],
  },
  statusText: {
    color: colors.mutedText,
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  statusTextLeftPanel: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 14,
  },
  stepper: {
    alignItems: 'center',
    borderColor: colors.glowGold,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  stepperText: {
    color: colors.white,
    fontSize: 22,
    fontWeight: '900',
    marginTop: -2,
  },
  submitRaise: {
    alignItems: 'center',
    backgroundColor: colors.surfaces.goldTint,
    borderColor: colors.gold,
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  submitRaiseText: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: '900',
  },
  utilityRow: {
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    maxWidth: 520,
    width: '51.2%',
  },
  utilityRowRightPanel: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    gap: 11,
    width: '100%',
  },
  waitingPanel: {
    alignSelf: 'center',
    backgroundColor: colors.surfaces.glowPanel,
    borderColor: colors.glowCyan,
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 16,
    width: '70%',
  },
  waitingText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
