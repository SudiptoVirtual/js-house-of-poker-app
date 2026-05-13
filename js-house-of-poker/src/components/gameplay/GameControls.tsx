import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import type { PokerAction, PokerControls, PokerPlayerState } from '../../types/poker';

type ControlMode = '357' | 'standard';
type ControlLayout = 'default' | 'leftPanel';

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
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function ControlButton({
  compact,
  disabled,
  label,
  loading,
  onPress,
  subtitle,
  tone,
}: {
  compact?: boolean;
  disabled?: boolean;
  label: string;
  loading?: boolean;
  onPress: () => void;
  subtitle?: string;
  tone: 'blue' | 'gold' | 'green' | 'pink' | 'purple' | 'red';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.buttonPressable,
        compact ? styles.buttonPressableCompact : null,
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
          styles[`${tone}Button`],
        ]}
      >
        <Text
          adjustsFontSizeToFit
          minimumFontScale={0.72}
          numberOfLines={1}
          style={[
            styles.buttonLabel,
            compact ? styles.buttonLabelCompact : null,
            styles[`${tone}Text`],
          ]}
        >
          {loading ? '...' : label}
        </Text>
        {subtitle ? (
          <Text
            numberOfLines={1}
            style={[styles.buttonSubtitle, compact ? styles.buttonSubtitleCompact : null]}
          >
            {subtitle}
          </Text>
        ) : null}
      </LinearGradient>
    </Pressable>
  );
}

const buttonColors = {
  blue: ['rgba(2, 18, 38, 0.98)', 'rgba(0, 39, 81, 0.96)'],
  gold: ['rgba(36, 22, 3, 0.98)', 'rgba(73, 43, 4, 0.96)'],
  green: ['rgba(2, 36, 14, 0.98)', 'rgba(4, 67, 27, 0.96)'],
  pink: ['rgba(41, 2, 27, 0.98)', 'rgba(86, 4, 57, 0.96)'],
  purple: ['rgba(23, 5, 44, 0.98)', 'rgba(50, 9, 88, 0.96)'],
  red: ['rgba(39, 6, 12, 0.98)', 'rgba(76, 9, 20, 0.96)'],
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
}: Props) {
  const [raiseOpen, setRaiseOpen] = useState(false);
  const isLeftPanel = layout === 'leftPanel';
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
    <View style={[styles.root, isLeftPanel ? styles.rootLeftPanel : null]}>
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
        ) : null}
      </View>

      {mode === '357' && controls.canAct ? (
        <View style={[styles.buttonRow, isLeftPanel ? styles.buttonRowLeftPanel : null]}>
          <ControlButton
            compact={isLeftPanel}
            disabled={!availableActions.includes('go')}
            label="GO"
            loading={pendingAction === 'go'}
            onPress={() => onAction('go')}
            subtitle="ENTER"
            tone="blue"
          />
          <ControlButton
            compact={isLeftPanel}
            disabled={!availableActions.includes('stay')}
            label="STAY"
            loading={pendingAction === 'stay'}
            onPress={() => onAction('stay')}
            subtitle="SIT OUT"
            tone="pink"
          />
        </View>
      ) : null}

      {mode === 'standard' && controls.canAct ? (
        <>
          <View style={styles.buttonRow}>
            <ControlButton
              disabled={!availableActions.includes('fold')}
              label="FOLD"
              loading={pendingAction === 'fold'}
              onPress={() => onAction('fold')}
              tone="blue"
            />
            <ControlButton
              disabled={!canCheck && !canCall}
              label={canCheck ? 'CHECK' : `CALL ${controls.callAmount}`}
              loading={pendingAction === 'check' || pendingAction === 'call'}
              onPress={() => onAction(canCheck ? 'check' : 'call')}
              tone="purple"
            />
            <ControlButton
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
                  placeholderTextColor="rgba(255,255,255,0.36)"
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
        <View style={styles.utilityRow}>
          {controls.canStartHand ? (
            <ControlButton
              label={mode === '357' ? 'START' : 'DEAL'}
              loading={pendingAction === 'start'}
              onPress={onStartHand}
              tone="green"
            />
          ) : null}
          {controls.canRebuy ? (
            <ControlButton
              label="REBUY"
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
  blueButton: {
    borderColor: 'rgba(26, 139, 255, 0.95)',
    shadowColor: '#1593FF',
  },
  blueText: {
    color: '#18A4FF',
  },
  buttonDisabled: {
    opacity: 0.42,
  },
  buttonLabel: {
    fontSize: 21,
    fontWeight: '900',
    letterSpacing: 0,
    textAlign: 'center',
  },
  buttonLabelCompact: {
    fontSize: 15,
    letterSpacing: 0.2,
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
  buttonRowLeftPanel: {
    alignSelf: 'stretch',
    flexDirection: 'column',
    gap: 9,
    justifyContent: 'flex-start',
    maxWidth: 236,
    width: '100%',
  },
  buttonSubtitle: {
    color: '#FFFFFF',
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
  goldButton: {
    borderColor: 'rgba(255, 184, 46, 0.95)',
    shadowColor: '#FFB829',
  },
  goldText: {
    color: '#FFBE31',
  },
  greenButton: {
    borderColor: 'rgba(74, 255, 117, 0.82)',
    shadowColor: '#35F066',
  },
  greenText: {
    color: '#4DFF76',
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
  pinkButton: {
    borderColor: 'rgba(255, 54, 167, 0.95)',
    shadowColor: '#FF36A7',
  },
  pinkText: {
    color: '#FF3DAE',
  },
  playerText: {
    color: '#FFFFFF',
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
  purpleButton: {
    borderColor: 'rgba(186, 53, 255, 0.95)',
    shadowColor: '#B934FF',
  },
  purpleText: {
    color: '#C04CFF',
  },
  raiseAmount: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderColor: 'rgba(255,184,46,0.34)',
    borderRadius: 8,
    borderWidth: 1,
    color: '#FFFFFF',
    flex: 1,
    fontSize: 13,
    fontWeight: '800',
    minHeight: 38,
    minWidth: 80,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  raiseLabel: {
    color: '#FFBE31',
    fontSize: 11,
    fontWeight: '900',
  },
  raisePanel: {
    alignSelf: 'center',
    backgroundColor: 'rgba(5, 4, 13, 0.94)',
    borderColor: 'rgba(255,184,46,0.26)',
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    marginTop: -4,
    maxWidth: 520,
    paddingHorizontal: 10,
    paddingVertical: 8,
    width: '74%',
  },
  redButton: {
    borderColor: 'rgba(255, 94, 115, 0.9)',
    shadowColor: '#FF5E73',
  },
  redText: {
    color: '#FF5E73',
  },
  root: {
    alignSelf: 'center',
    gap: 8,
    maxWidth: 680,
    paddingHorizontal: 6,
    width: '100%',
  },
  rootLeftPanel: {
    alignSelf: 'stretch',
    gap: 10,
    maxWidth: 236,
    paddingHorizontal: 0,
  },
  statusText: {
    color: 'rgba(239, 235, 255, 0.66)',
    flex: 1,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'right',
  },
  stepper: {
    alignItems: 'center',
    borderColor: 'rgba(255,184,46,0.34)',
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  stepperText: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '900',
    marginTop: -2,
  },
  submitRaise: {
    alignItems: 'center',
    backgroundColor: 'rgba(73, 43, 4, 0.96)',
    borderColor: 'rgba(255,184,46,0.7)',
    borderRadius: 8,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  submitRaiseText: {
    color: '#FFBE31',
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
  waitingPanel: {
    alignSelf: 'center',
    backgroundColor: 'rgba(5,4,13,0.7)',
    borderColor: 'rgba(180,84,255,0.24)',
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 58,
    justifyContent: 'center',
    paddingHorizontal: 16,
    width: '70%',
  },
  waitingText: {
    color: '#EEE8FF',
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
});
