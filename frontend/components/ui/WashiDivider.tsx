import React from 'react';
import { View, Text, ViewStyle } from 'react-native';
import { KINCHA } from '@/constants/theme';

interface Props {
  style?: ViewStyle;
}

export default function WashiDivider({ style }: Props) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>
      <View style={{ flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.4 }} />
      <Text style={{ fontSize: 9, color: KINCHA, marginHorizontal: 8, opacity: 0.55 }}>✦</Text>
      <View style={{ flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.4 }} />
    </View>
  );
}
