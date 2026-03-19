import React, { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Image, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

// ─── Japanese Palette ─────────────────────────────────────────────────────────
const BENI         = '#C0392B';
const KINCHA       = '#B8963E';
const KINCHA_LIGHT = '#D4AF55';
const SUMI         = '#1C1410';
const WASHI        = '#FAF5EC';
const WASHI_DARK   = '#EDE5D8';
const INK_60       = 'rgba(28,20,16,0.6)';
const INK_20       = 'rgba(28,20,16,0.12)';
const WHITE        = '#FFFFFF';

type TripStatus = 'On Trip' | 'Upcoming' | 'Trip Ended';

interface TripCardProps {
  name: string;
  date: string;
  duration: string;
  status: TripStatus;
  people: number;
  image: string;
  isJoined?: boolean;
  memberImages?: string[];
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<TripStatus, { color: string; bg: string; icon: string; }> = {
  'On Trip':    { color: KINCHA_LIGHT, bg: 'rgba(184,150,62,0.12)', icon: 'airplane' },
  'Upcoming':   { color: BENI,         bg: 'rgba(192,57,43,0.08)',  icon: 'time-outline'},
  'Trip Ended': { color: INK_60,       bg: INK_20,                  icon: 'checkmark-circle'  },
};

// ─── Avatar Stack ─────────────────────────────────────────────────────────────
const AVATAR_SIZE   = 22;
const AVATAR_OFFSET = 14;
const AVATAR_COLORS = [BENI, KINCHA, '#2980B9', '#16A085', '#8E44AD'];

const AvatarStack = ({ images, total }: { images: string[]; total: number }) => {
  const shown    = images.slice(0, 4);
  const overflow = total - shown.length;
  const stackWidth = shown.length > 0
    ? AVATAR_SIZE + AVATAR_OFFSET * (shown.length - 1)
    : AVATAR_SIZE;

  return (
    <View style={av.row}>
      {/* Stacked avatar circles */}
      <View style={[av.stack, { width: stackWidth }]}>
        {shown.map((uri, i) => (
          <View
            key={i}
            style={[av.circle, { left: i * AVATAR_OFFSET, zIndex: shown.length - i }]}
          >
            {uri ? (
              <Image source={{ uri }} style={av.img} />
            ) : (
              <View style={[av.img, av.placeholder, { backgroundColor: AVATAR_COLORS[i % AVATAR_COLORS.length] }]}>
                <Text style={av.initial}>{String.fromCharCode(65 + (i % 26))}</Text>
              </View>
            )}
          </View>
        ))}
      </View>

      {/* Overflow "+N" */}
      {overflow > 0 && (
        <Text style={av.overflow}>+{overflow}</Text>
      )}

      {/* Total label (only when no overflow) */}
      {overflow === 0 && (
        <Text style={av.total}>{total} {total === 1 ? 'person' : 'people'}</Text>
      )}
    </View>
  );
};

const av = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stack: {
    position: 'relative',
    height: AVATAR_SIZE,
  },
  circle: {
    position: 'absolute',
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    borderWidth: 1.5,
    borderColor: WASHI,
    overflow: 'hidden',
    backgroundColor: WASHI_DARK,
  },
  img: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initial: {
    fontSize: 9,
    fontWeight: '800',
    color: WHITE,
  },
  overflow: {
    fontSize: 10,
    color: INK_60,
    fontWeight: '700',
    marginLeft: 2,
  },
  total: {
    fontSize: 11,
    color: INK_60,
    fontWeight: '500',
  },
});

// ─── TripCard ─────────────────────────────────────────────────────────────────
const TripCard: React.FC<TripCardProps> = ({
  name,
  date,
  duration,
  status,
  people,
  image,
  isJoined = false,
  memberImages = [],
}) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }),
    ]).start();
  }, []);

  const cfg = STATUS_CONFIG[status];
  const stripeColor = isJoined || status === 'On Trip' ? KINCHA : BENI;

  return (
    <Animated.View style={[s.card, isJoined && s.cardJoined, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>

      {/* Left accent stripe */}
      <View style={[s.stripe, { backgroundColor: stripeColor }]} />

      <View style={s.inner}>

        {/* ── Header ── */}
        <View style={s.headerRow}>
          <Text style={s.tripName} numberOfLines={1}>{name}</Text>
          <View style={[s.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.color + '55' }]}>
            <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
            <Text style={[s.statusText, { color: cfg.color }]}>{status}</Text>
          </View>
        </View>

        {/* ── Image + details ── */}
        <View style={s.bodyRow}>

          {/* Image with pill overlay */}
          <View style={s.imageWrap}>
            <Image
              source={{ uri: image || 'https://picsum.photos/300/200' }}
              style={s.image}
            />
            {isJoined && (
              <View style={s.joinedPillWrap}>
                <View style={s.joinedPill}>
                  <Ionicons name="people" size={10} color={KINCHA_LIGHT} />
                  <Text style={s.joinedPillText}>Joined</Text>
                  <Text style={s.joinedPillKanji}>参加</Text>
                </View>
              </View>
            )}
          </View>

          {/* Detail rows */}
          <View style={s.details}>
            <View style={s.detailRow}>
              <View style={s.detailIcon}>
                <Ionicons name="calendar-outline" size={13} color={BENI} />
              </View>
              <Text style={s.detailText}>{date}</Text>
            </View>

            <View style={s.divider} />

            <View style={s.detailRow}>
              <View style={s.detailIcon}>
                <Ionicons name="time-outline" size={13} color={BENI} />
              </View>
              <Text style={s.detailText}>{duration} Days</Text>
            </View>

            <View style={s.divider} />

            <View style={s.detailRow}>
              <View style={s.detailIcon}>
                <Ionicons name="people-outline" size={13} color={BENI} />
              </View>
              <AvatarStack images={memberImages} total={people} />
            </View>
          </View>
        </View>

        {/* ── Kincha bottom rule ── */}
        <View style={s.bottomRule}>
          <View style={s.ruleLeft} />
          <Text style={s.ruleDot}>✦</Text>
          <View style={s.ruleRight} />
        </View>

      </View>
    </Animated.View>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
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
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  cardJoined: {
    borderColor: KINCHA,
    borderWidth: 1.2,
  },
  stripe: {
    width: 3,
    alignSelf: 'stretch',
  },
  inner: {
    flex: 1,
    padding: 13,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  tripName: {
    flex: 1,
    fontSize: 15,
    fontWeight: '800',
    color: SUMI,
    letterSpacing: 0.2,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 0.8,
    flexShrink: 0,
  },
  statusText: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  statusKanji: {
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.5,
    opacity: 0.7,
  },

  // ── Body ──
  bodyRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 10,
  },
  imageWrap: {
    position: 'relative',
    width: 110,
  },
  image: {
    width: 110,
    height: 82,
    borderRadius: 5,
    backgroundColor: WASHI_DARK,
  },

  // Duration pill (bottom-left)
  durationPill: {
    position: 'absolute',
    bottom: 5,
    left: 5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(28,20,16,0.72)',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 3,
  },
  durationText: {
    fontSize: 9,
    color: KINCHA_LIGHT,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // Joined pill wrapper — absolute fill, centers the pill
  joinedPillWrap: {
    position: 'absolute',
    bottom: 5,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  joinedPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(28,20,16,0.82)',
    borderWidth: 0.8,
    borderColor: KINCHA,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 3,
  },
  joinedPillText: {
    fontSize: 9,
    color: KINCHA_LIGHT,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  joinedPillKanji: {
    fontSize: 8,
    color: KINCHA,
    fontWeight: '900',
    letterSpacing: 0.5,
    opacity: 0.75,
  },

  // ── Detail rows ──
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
  detailIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(192,57,43,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    fontSize: 12,
    color: INK_60,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  divider: {
    height: 0.5,
    backgroundColor: INK_20,
    marginLeft: 32,
  },

  // ── Bottom rule ──
  bottomRule: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ruleLeft:  { flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.3 },
  ruleDot:   { fontSize: 7, color: KINCHA, marginHorizontal: 6, opacity: 0.45 },
  ruleRight: { flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.3 },
});

export default TripCard;