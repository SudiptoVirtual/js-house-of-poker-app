import { Image, StyleSheet, Text, View } from 'react-native';

import { colors } from '../../theme/colors';

type FeedAvatarProps = {
  initials: string;
  size?: number;
  uri?: string;
};

export function FeedAvatar({ initials, size = 44, uri }: FeedAvatarProps) {
  const avatarSize = { borderRadius: size / 2, height: size, width: size };

  if (uri) {
    return <Image source={{ uri }} style={[styles.avatar, avatarSize]} />;
  }

  return (
    <View style={[styles.avatar, styles.placeholder, avatarSize]}>
      <Text style={[styles.initials, { fontSize: Math.max(13, size * 0.34) }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
  },
  initials: {
    color: colors.text,
    fontWeight: '900',
  },
  placeholder: {
    alignItems: 'center',
    backgroundColor: colors.surfaceMuted,
    justifyContent: 'center',
  },
});
