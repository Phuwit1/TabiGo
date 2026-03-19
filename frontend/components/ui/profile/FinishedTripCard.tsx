import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Japanese Palette (shared with profile.tsx) ───────────────────────────────
const BENI         = '#C0392B';
const KINCHA       = '#B8963E';
const KINCHA_LIGHT = '#D4AF55';
const SUMI         = '#1C1410';
const WASHI        = '#FAF5EC';
const WASHI_DARK   = '#EDE5D8';
const INK_60       = 'rgba(28,20,16,0.6)';
const INK_20       = 'rgba(28,20,16,0.12)';
const WHITE        = '#FFFFFF';

type FinishedTripCardProps = {
  name: string;
  date: string;
  budget: number;
  people: number;
  city?: string;
};

export default function FinishedTripCard({ name, date, budget, people, city }: FinishedTripCardProps) {
  // Subtle entrance fade-in
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 350, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
      {/* Left beni stripe */}
      <View style={s.stripe} />

      <View style={s.inner}>
        {/* ── Header row ── */}
        <View style={s.headerRow}>
          <View style={s.titleWrap}>
            {/* Stamp-style "完" (completed) badge */}
            <View style={s.completedBadge}>
              <Ionicons name="checkmark" size={9} color={WHITE} />
              <Text style={s.completedText}>Done</Text>
            </View>
            <Text style={s.title} numberOfLines={1}>{name}</Text>
          </View>

          {city && (
            <View style={s.cityBadge}>
              <Ionicons name="location-sharp" size={10} color={BENI} />
              <Text style={s.cityText}>{city}</Text>
            </View>
          )}
        </View>

        {/* ── Date row ── */}
        <View style={s.dateRow}>
          <Ionicons name="calendar-outline" size={13} color={KINCHA} />
          <Text style={s.dateText}>{date}</Text>
        </View>

        {/* ── Kincha divider ── */}
        <View style={s.dividerRow}>
          <View style={s.dividerLine} />
          <Text style={s.dividerDot}>✦</Text>
          <View style={s.dividerLine} />
        </View>

        {/* ── Meta row ── */}
        <View style={s.metaRow}>
          {/* Budget */}
          <View style={s.metaItem}>
            <View style={s.metaIconWrap}>
              <Ionicons name="wallet-outline" size={14} color={BENI} />
            </View>
            <View>
              <Text style={s.metaLabel}>Budget</Text>
              <Text style={s.metaValue}>¥{budget.toLocaleString()}</Text>
            </View>
          </View>

          <View style={s.metaDivider} />

          {/* People */}
          <View style={s.metaItem}>
            <View style={s.metaIconWrap}>
              <Ionicons name="people-outline" size={14} color={BENI} />
            </View>
            <View>
              <Text style={s.metaLabel}>Travellers</Text>
              <Text style={s.metaValue}>{people} {people === 1 ? 'person' : 'people'}</Text>
            </View>
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: WASHI,
    borderRadius: 8,
    marginBottom: 10,
    overflow: 'hidden',
    shadowColor: SUMI,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    borderWidth: 1,
    borderColor: WASHI_DARK,
  },

  // Left red stripe (same pattern as expense card in budget.tsx)
  stripe: {
    width: 3,
    backgroundColor: BENI,
    alignSelf: 'stretch',
  },

  inner: {
    flex: 1,
    padding: 14,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
    gap: 8,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  completedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BENI,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 3,
    gap: 3,
    marginBottom: 3,
  },
  completedText: {
    fontSize: 9,
    color: WHITE,
    fontWeight: '800',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
    color: SUMI,
    letterSpacing: 0.2,
  },
  cityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: INK_20,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    gap: 3,
    flexShrink: 0,
  },
  cityText: {
    fontSize: 10,
    color: INK_60,
    fontWeight: '600',
  },

  // ── Date ──
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginBottom: 10,
  },
  dateText: {
    fontSize: 12,
    color: INK_60,
    letterSpacing: 0.2,
  },

  // ── Kincha divider ──
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: KINCHA,
    opacity: 0.35,
  },
  dividerDot: {
    fontSize: 8,
    color: KINCHA,
    marginHorizontal: 6,
    opacity: 0.5,
  },

  // ── Meta ──
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WASHI_DARK,
    borderRadius: 6,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  metaItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metaIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(192,57,43,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  metaLabel: {
    fontSize: 9,
    color: INK_60,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 1,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: '800',
    color: SUMI,
    letterSpacing: 0.3,
  },
  metaDivider: {
    width: 1,
    height: 28,
    backgroundColor: WASHI,
    marginHorizontal: 10,
  },
});