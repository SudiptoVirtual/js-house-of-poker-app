import { useState } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { ActionButton } from '../components/ActionButton';
import { ComplianceNotice } from '../components/ComplianceNotice';
import { Screen } from '../components/Screen';
import { SectionCard } from '../components/SectionCard';
import { routes } from '../constants/routes';
import { getRandomTip } from '../constants/tips';
import { colors } from '../theme/colors';
import type { RootStackParamList } from '../types/navigation';

const legacySplash = require('../../assets/images/legacy-pocat-splash.png');

type Props = NativeStackScreenProps<RootStackParamList, 'Welcome'>;

export function WelcomeScreen({ navigation }: Props) {
  const [tip] = useState(getRandomTip);

  return (
    <Screen
      eyebrow="Free-play social poker"
      title="House of Poker"
      subtitle="Create private tables, discover players, and keep every invite inside one free-play social poker flow."
    >
      <ComplianceNotice />

      <SectionCard title="What this app is for">
        <Image source={legacySplash} style={styles.logo} resizeMode="contain" />
        <Text style={styles.line}>Host private free-play poker tables for friends and regulars.</Text>
        <Text style={styles.line}>Explore lightweight social surfaces for profiles, posts, and username discovery.</Text>
        <Text style={styles.line}>Route invites back into the active table instead of splitting into a second invite system.</Text>
      </SectionCard>

      <SectionCard title="Table tip">
        <Text style={styles.tip}>{tip}</Text>
      </SectionCard>

      <View style={styles.actions}>
        <ActionButton label="Log in" onPress={() => navigation.navigate(routes.Login)} />
        <ActionButton
          label="Enter lobby"
          onPress={() => navigation.navigate(routes.Home)}
          variant="secondary"
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
  },
  line: {
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
  },
  logo: {
    alignSelf: 'center',
    height: 120,
    width: 120,
  },
  tip: {
    color: colors.secondary,
    fontSize: 18,
    fontStyle: 'italic',
    lineHeight: 26,
  },
});
