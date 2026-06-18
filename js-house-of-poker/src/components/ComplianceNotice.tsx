import { StyleSheet, Text } from 'react-native';

import { complianceCopy } from '../constants/compliance';
import { SectionCard } from './SectionCard';
import { colors, spacing, typography } from '../theme';

type ComplianceNoticeProps = {
  title?: string;
};

export function ComplianceNotice({
  title = 'Free-play compliance',
}: ComplianceNoticeProps) {
  return (
    <SectionCard contentStyle={styles.content} title={title} titleStyle={styles.title} variant="stat">
      {complianceCopy.lines.map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: spacing[8],
  },
  line: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
  },
  title: {
    color: colors.secondary,
    ...typography.chipLabel,
  },
});
