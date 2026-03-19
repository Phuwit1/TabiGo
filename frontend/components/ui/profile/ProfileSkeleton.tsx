import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, ScrollView } from 'react-native';

// ─── Japanese Palette (shared with profile.tsx) ───────────────────────────────
const SUMI       = '#1C1410';
const WASHI      = '#FAF5EC';
const WASHI_DARK = '#EDE5D8';
const BENI       = '#C0392B';

export default function ProfileSkeleton() {
  const fadeAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(fadeAnim, { toValue: 0.85, duration: 900, useNativeDriver: true }),
        Animated.timing(fadeAnim, { toValue: 0.4,  duration: 900, useNativeDriver: true }),
      ])
    ).start();
    return () => fadeAnim.stopAnimation();
  }, []);

  // Skeleton block — uses washi palette instead of generic grey
  const Bone = ({ w, h, r = 4, style }: { w: number | string; h: number; r?: number; style?: any }) => (
    <Animated.View style={[{ width: w as any, height: h, borderRadius: r, backgroundColor: WASHI_DARK, opacity: fadeAnim }, style]} />
  );

  // Full-width bone shorthand
  const BoneFull = ({ h, r = 4, style }: { h: number; r?: number; style?: any }) => (
    <Bone w="100%" h={h} r={r} style={style} />
  );

  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

      {/* ── Banner skeleton (mirrors hero gradient section) ── */}
      <View style={s.banner}>
        {/* Top beni accent bar */}
        <View style={s.bannerBar} />

        <View style={s.bannerInner}>
          {/* Small tag pill */}
          <Bone w={110} h={12} r={2} style={s.center} />

          {/* Avatar circle */}
          <Animated.View style={[s.avatarRing, { opacity: fadeAnim }]}>
            <Animated.View style={[s.avatarCircle, { opacity: fadeAnim }]} />
          </Animated.View>

          {/* Name */}
          <Bone w={160} h={20} r={4} style={[s.center, { marginBottom: 6 }]} />
          {/* Join date */}
          <Bone w={100} h={11} r={3} style={[s.center, { marginBottom: 20 }]} />

          {/* Stats row */}
          <View style={s.statsRow}>
            {[0, 1, 2].map(i => (
              <React.Fragment key={i}>
                <View style={s.statItem}>
                  <Bone w={28} h={20} r={4} style={[s.center, { marginBottom: 4 }]} />
                  <Bone w={48} h={10} r={3} style={s.center} />
                </View>
                {i < 2 && <View style={s.statDivider} />}
              </React.Fragment>
            ))}
          </View>
        </View>
      </View>

      {/* ── Contact card skeleton ── */}
      <View style={s.card}>
        {/* Section header row */}
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionBar} />
          <Bone w={140} h={14} r={3} />
          <Bone w={40}  h={10} r={2} style={{ marginLeft: 6 }} />
        </View>

        {/* Divider */}
        <View style={s.divider} />

        {/* Info row × 3 */}
        {[0, 1, 2].map(i => (
          <React.Fragment key={i}>
            <View style={s.infoRow}>
              {/* Icon badge */}
              <Animated.View style={[s.iconBadge, { opacity: fadeAnim }]} />
              <View style={{ flex: 1, gap: 6 }}>
                <Bone w={60}   h={9}  r={2} />
                <Bone w={i === 0 ? '80%' : i === 1 ? '50%' : '65%'} h={14} r={3} />
              </View>
            </View>
            {i < 2 && <View style={s.divider} />}
          </React.Fragment>
        ))}
      </View>

      {/* ── Travel history card skeleton ── */}
      <View style={s.card}>
        {/* Toggle header */}
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionBar} />
          <Animated.View style={[s.iconBadgeSmall, { opacity: fadeAnim }]} />
          <Bone w={130} h={14} r={3} style={{ marginLeft: 4 }} />
          <View style={{ flex: 1 }} />
          <Animated.View style={[s.countBadge, { opacity: fadeAnim }]} />
          <Bone w={16}  h={16} r={8} style={{ marginLeft: 6 }} />
        </View>

        <View style={s.divider} />

        {/* Trip card skeletons — 2 cards */}
        {[0, 1].map(i => (
          <View key={i} style={s.tripCardSkeleton}>
            {/* Left stripe */}
            <View style={s.tripStripe} />
            <View style={s.tripInner}>
              {/* Badge + title */}
              <Bone w={46}  h={16} r={3} style={{ marginBottom: 6 }} />
              <Bone w={i === 0 ? '70%' : '55%'} h={15} r={3} style={{ marginBottom: 8 }} />
              {/* Date row */}
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 10 }}>
                <Bone w={13} h={13} r={7} />
                <Bone w={120} h={11} r={3} />
              </View>
              {/* Meta box */}
              <View style={s.metaBox}>
                <View style={{ flex: 1, gap: 4 }}>
                  <Bone w={36} h={8} r={2} />
                  <Bone w={70} h={13} r={3} />
                </View>
                <View style={s.metaBoxDivider} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Bone w={52} h={8} r={2} />
                  <Bone w={50} h={13} r={3} />
                </View>
              </View>
            </View>
          </View>
        ))}
      </View>

      {/* ── Logout button skeleton ── */}
      <View style={s.logoutWrap}>
        <BoneFull h={48} r={6} />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WASHI_DARK,
  },

  // ── Banner ──
  banner: {
    backgroundColor: '#2B1810',   // mirrors SUMI/URUSHI gradient
    paddingBottom: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  bannerBar: {
    height: 3,
    backgroundColor: BENI,
    opacity: 0.4,
  },
  bannerInner: {
    alignItems: 'center',
    paddingTop: 36,
    paddingHorizontal: 20,
  },
  avatarRing: {
    borderWidth: 3,
    borderColor: 'rgba(192,57,43,0.3)',
    borderRadius: 60,
    padding: 3,
    marginTop: 12,
    marginBottom: 14,
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(237,229,216,0.15)',  // washi-dark faint on dark bg
  },
  center: { alignSelf: 'center' },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
  },
  statItem: { flex: 1, alignItems: 'center' },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },

  // ── Cards ──
  card: {
    backgroundColor: WASHI,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: SUMI,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // Section header (mirrors profile.tsx SectionHeader)
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 0,
  },
  sectionBar: {
    width: 3,
    height: 16,
    backgroundColor: 'rgba(192,57,43,0.25)',
    borderRadius: 2,
    marginRight: 8,
  },

  // Divider (mirrors WashiDivider)
  divider: {
    height: 0.5,
    backgroundColor: 'rgba(184,150,62,0.3)',
    marginVertical: 12,
  },

  // Info row
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  iconBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: WASHI_DARK,
    marginTop: 2,
  },
  iconBadgeSmall: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: WASHI_DARK,
    marginRight: 4,
  },
  countBadge: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: 'rgba(192,57,43,0.2)',
  },

  // Trip card skeleton (mirrors FinishedTripCard layout)
  tripCardSkeleton: {
    flexDirection: 'row',
    backgroundColor: WASHI,
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: WASHI_DARK,
  },
  tripStripe: {
    width: 3,
    backgroundColor: 'rgba(192,57,43,0.25)',
    alignSelf: 'stretch',
  },
  tripInner: {
    flex: 1,
    padding: 14,
  },
  metaBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WASHI_DARK,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  metaBoxDivider: {
    width: 1,
    height: 24,
    backgroundColor: WASHI,
    marginHorizontal: 10,
  },

  // Logout
  logoutWrap: {
    marginHorizontal: 16,
    marginTop: 14,
  },
});