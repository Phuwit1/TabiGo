import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ScrollView } from 'react-native';
import { WASHI, WASHI_DARK, KINCHA, BENI, SUMI } from '@/constants/theme';

export default function TripListSkeleton() {
  const fadeAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 1,   duration: 750, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0.5, duration: 750, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const Block = ({ width, height, radius = 4, style }: { width: number | string; height: number; radius?: number; style?: any }) => (
    <Animated.View style={[{ width, height, borderRadius: radius, backgroundColor: WASHI_DARK, opacity: fadeAnim }, style]} />
  );

  const SkeletonCard = () => (
    <View style={s.card}>
      {/* Left accent stripe */}
      <Animated.View style={[s.stripe, { opacity: fadeAnim }]} />

      <View style={s.inner}>
        {/* Header row: name + status badge */}
        <View style={s.headerRow}>
          <Block width="55%" height={15} radius={5} />
          <Block width={72} height={20} radius={3} />
        </View>

        {/* Body: image + detail rows */}
        <View style={s.bodyRow}>
          {/* Image placeholder */}
          <Block width={110} height={82} radius={5} />

          {/* Detail rows */}
          <View style={s.details}>
            <View style={s.detailRow}>
              <Block width={24} height={24} radius={12} />
              <Block width="55%" height={12} radius={4} />
            </View>
            <View style={s.divider} />
            <View style={s.detailRow}>
              <Block width={24} height={24} radius={12} />
              <Block width="40%" height={12} radius={4} />
            </View>
            <View style={s.divider} />
            <View style={s.detailRow}>
              <Block width={24} height={24} radius={12} />
              <Block width="50%" height={12} radius={4} />
            </View>
          </View>
        </View>

        {/* Bottom kincha rule */}
        <View style={s.bottomRule}>
          <Animated.View style={[s.ruleLine, { opacity: fadeAnim }]} />
          <Animated.View style={[s.ruleDot, { opacity: fadeAnim }]} />
          <Animated.View style={[s.ruleLine, { opacity: fadeAnim }]} />
        </View>
      </View>
    </View>
  );

  return (
    <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1, paddingTop: 8 }}>
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <SkeletonCard />
      <View style={{ height: 20 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: WASHI,
    borderRadius: 8,
    marginBottom: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: WASHI_DARK,
    shadowColor: SUMI,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  stripe: {
    width: 3,
    alignSelf: 'stretch',
    backgroundColor: BENI,
    opacity: 0.35,
  },
  inner: {
    flex: 1,
    padding: 13,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  bodyRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  details: {
    flex: 1,
    justifyContent: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 5,
  },
  divider: {
    height: 0.5,
    backgroundColor: WASHI_DARK,
    marginLeft: 32,
  },
  bottomRule: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: KINCHA,
    opacity: 0.3,
  },
  ruleDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: KINCHA,
    marginHorizontal: 6,
    opacity: 0.4,
  },
});
