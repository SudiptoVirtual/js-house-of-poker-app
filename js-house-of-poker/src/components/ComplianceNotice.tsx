import { StyleSheet, Text, View } from 'react-native';

import { complianceCopy } from '../constants/compliance';
import { colors } from '../theme/colors';

type ComplianceNoticeProps = {
  title?: string;
};

export function ComplianceNotice({
  title = 'Free-play compliance',
}: ComplianceNoticeProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {complianceCopy.lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'rgba(54, 231, 255, 0.08)',
    borderColor: 'rgba(54, 231, 255, 0.18)',
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  line: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    color: colors.secondary,
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
});
