import type { PropsWithChildren } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

type KeyboardSafeViewProps = PropsWithChildren<{
  keyboardVerticalOffset?: number;
  style?: StyleProp<ViewStyle>;
}>;

export function KeyboardSafeView({
  children,
  keyboardVerticalOffset = 0,
  style,
}: KeyboardSafeViewProps) {
  return (
    <KeyboardAvoidingView
      behavior={
        Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined
      }
      keyboardVerticalOffset={keyboardVerticalOffset}
      style={[styles.container, style]}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
