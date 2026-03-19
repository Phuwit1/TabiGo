import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, StyleSheet, Image, TouchableOpacity,
  Animated, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/api.js';

dayjs.locale('en');

// ─── Japanese Palette ─────────────────────────────────────────────────────────
const BENI         = '#C0392B';
const BENI_LIGHT   = '#E74C3C';
const KINCHA       = '#B8963E';
const KINCHA_LIGHT = '#D4AF55';
const SUMI         = '#1C1410';
const WASHI        = '#FAF5EC';
const WASHI_DARK   = '#EDE5D8';
const INK_60       = 'rgba(28,20,16,0.6)';
const INK_20       = 'rgba(28,20,16,0.12)';
const WHITE        = '#FFFFFF';

type Trip = {
  plan_id: number;
  name_group: string;
  start_plan_date: string;
  end_plan_date: string;
  tripGroup?: { members: any[] } | null;
  image?: string;
};

type TripStatus = 'On Trip' | 'Upcoming' | 'Ended';

const STATUS_CONFIG: Record<TripStatus, { color: string; bg: string; border: string; icon: string; kanji: string }> = {
  'On Trip':  { color: KINCHA_LIGHT, bg: 'rgba(184,150,62,0.12)', border: KINCHA,     icon: 'airplane',        kanji: '旅中' },
  'Upcoming': { color: BENI,         bg: 'rgba(192,57,43,0.08)',  border: BENI,        icon: 'time-outline',    kanji: '予定' },
  'Ended':    { color: INK_60,       bg: INK_20,                  border: INK_20,      icon: 'checkmark-circle',kanji: '完'   },
};

export default function CurrentCard() {
  const router = useRouter();
  const [currentTrip, setCurrentTrip] = useState<Trip | null>(null);
  const [loading, setLoading]         = useState(true);
  const [user, setUser]               = useState<any>(null);

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useFocusEffect(
    useCallback(() => {
      fetchCurrentTrip();
    }, [])
  );

  const fetchCurrentTrip = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) { setLoading(false); return; }

      const [tripRes, userRes] = await Promise.all([
        axios.get(`${API_URL}/trip_plan`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/user`,      { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setUser(userRes.data);

      if (Array.isArray(tripRes.data) && tripRes.data.length > 0) {
        const trips = tripRes.data;
        const now   = dayjs();

        const onTrip = trips.find((t: Trip) => {
          const s = dayjs(t.start_plan_date), e = dayjs(t.end_plan_date);
          return (now.isSame(s, 'day') || now.isAfter(s, 'day')) &&
                 (now.isSame(e, 'day') || now.isBefore(e, 'day'));
        });

        if (onTrip) {
          setCurrentTrip(onTrip);
        } else {
          const upcoming = trips
            .filter((t: Trip) => dayjs(t.start_plan_date).isAfter(now, 'day'))
            .sort((a: Trip, b: Trip) => dayjs(a.start_plan_date).diff(dayjs(b.start_plan_date)));
          if (upcoming.length > 0) {
            setCurrentTrip(upcoming[0]);
          } else {
            const ended = trips
              .filter((t: Trip) => dayjs(t.end_plan_date).isBefore(now, 'day'))
              .sort((a: Trip, b: Trip) => dayjs(b.end_plan_date).diff(dayjs(a.end_plan_date)));
            setCurrentTrip(ended.length > 0 ? ended[0] : null);
          }
        }
      } else {
        setCurrentTrip(null);
      }
    } catch (e) {
      console.log('Error fetching trips:', e);
    } finally {
      setLoading(false);
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
    }
  };

  const getStatus = (): TripStatus => {
    if (!currentTrip) return 'Upcoming';
    const now = dayjs(), s = dayjs(currentTrip.start_plan_date), e = dayjs(currentTrip.end_plan_date);
    if (now.isBefore(s, 'day')) return 'Upcoming';
    if (now.isAfter(e,  'day')) return 'Ended';
    return 'On Trip';
  };

  const formatDate = (start: string, end: string) =>
    `${dayjs(start).format('D MMM')} – ${dayjs(end).format('D MMM YYYY')}`;

  const memberCount = currentTrip?.tripGroup?.members?.length ?? 1;

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[s.card, s.centerCard]}>
        <ActivityIndicator color={BENI} size="small" />
      </View>
    );
  }

  // ── Not logged in ──────────────────────────────────────────────────────────
  if (!user) {
    return (
      <Animated.View style={[s.card, s.emptyCard, { opacity: fadeAnim }]}>
        <View style={s.emptyIconRing}>
          <Ionicons name="person-outline" size={28} color={BENI} />
        </View>
        <Text style={s.emptyTitle}>Sign in to continue</Text>
        <Text style={s.emptySub}>Log in to view your trips</Text>
        <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/(modals)/Login')}>
          <Ionicons name="log-in-outline" size={16} color={WHITE} />
          <Text style={s.primaryBtnText}>Log In</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  }

  // ── No trip ────────────────────────────────────────────────────────────────
  if (!currentTrip) {
    return (
      <Animated.View style={[s.card, s.emptyCard, { opacity: fadeAnim }]}>
        <Text style={s.emptyKanji}>旅</Text>
        <View style={s.emptyIconRing}>
          <Ionicons name="map-outline" size={28} color={BENI} />
        </View>
        <Text style={s.emptyTitle}>No upcoming trips</Text>
        <Text style={s.emptySub}>Create a trip or join with friends</Text>
        <View style={s.btnRow}>
          <TouchableOpacity style={s.primaryBtn} onPress={() => router.push('/trip/after-create')}>
            <Ionicons name="add-circle-outline" size={15} color={WHITE} />
            <Text style={s.primaryBtnText}>Create</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.outlineBtn} onPress={() => router.push('/(modals)/join-trip')}>
            <Ionicons name="people-outline" size={15} color={BENI} />
            <Text style={s.outlineBtnText}>Join</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    );
  }

  // ── Has trip ───────────────────────────────────────────────────────────────
  const status = getStatus();
  const cfg    = STATUS_CONFIG[status];
  const isEnded = status === 'Ended';

  return (
    <Animated.View style={[s.card, { opacity: fadeAnim }]}>
      {/* Beni top bar */}
      <View style={s.topBar} />

      <View style={s.inner}>
        {/* Header row */}
        <View style={s.headerRow}>
          <View style={s.headerLeft}>
            <View style={s.headerBar} />
            <Text style={s.headerTitle}>Current Trip</Text>
          </View>

          <View style={s.headerRight}>
            {/* Status badge */}
            <View style={[s.statusBadge, { backgroundColor: cfg.bg, borderColor: cfg.border + '55' }]}>
              <Ionicons name={cfg.icon as any} size={10} color={cfg.color} />
              <Text style={[s.statusText, { color: cfg.color }]}>{status}</Text>
              <Text style={[s.statusKanji, { color: cfg.color }]}>{cfg.kanji}</Text>
            </View>

            {/* New trip button when ended */}
            {isEnded && (
              <TouchableOpacity style={s.newTripBtn} onPress={() => router.push('/trip/after-create')}>
                <Ionicons name="add" size={11} color={BENI} />
                <Text style={s.newTripText}>New Trip</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Kincha divider */}
        <View style={s.divider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerDot}>✦</Text>
          <View style={s.dividerLine} />
        </View>

        {/* Trip info */}
        <TouchableOpacity
          style={s.tripRow}
          onPress={() => router.push(`/trip/${currentTrip.plan_id}`)}
          activeOpacity={0.78}
        >
          <Image
            source={{ uri: currentTrip.image || `https://picsum.photos/seed/${currentTrip.plan_id}/300/200` }}
            style={s.tripImg}
          />

          <View style={s.tripDetails}>
            <Text style={s.tripName} numberOfLines={1}>{currentTrip.name_group}</Text>

            <View style={s.detailRow}>
              <View style={s.detailIcon}>
                <Ionicons name="calendar-outline" size={12} color={BENI} />
              </View>
              <Text style={s.detailText}>
                {formatDate(currentTrip.start_plan_date, currentTrip.end_plan_date)}
              </Text>
            </View>

            <View style={s.detailRow}>
              <View style={s.detailIcon}>
                <Ionicons name="people-outline" size={12} color={BENI} />
              </View>
              <Text style={s.detailText}>{memberCount} {memberCount === 1 ? 'person' : 'people'}</Text>
            </View>

            <View style={s.detailRow}>
              <View style={s.detailIcon}>
                <Ionicons name="chevron-forward" size={12} color={KINCHA} />
              </View>
              <Text style={[s.detailText, { color: KINCHA }]}>View trip</Text>
            </View>
          </View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    width: '92%',
    alignSelf: 'center',
    backgroundColor: WASHI,
    borderRadius: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: WASHI_DARK,
    shadowColor: SUMI,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
    marginBottom: 18,
    marginTop: 12,
  },
  topBar: {
    height: 3,
    backgroundColor: BENI,
  },
  inner: {
    padding: 14,
  },

  // ── Header ──
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  headerBar: {
    width: 3,
    height: 16,
    backgroundColor: BENI,
    borderRadius: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: SUMI,
    letterSpacing: 0.3,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
    borderWidth: 0.8,
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
  newTripBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderWidth: 1,
    borderColor: BENI,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
    backgroundColor: 'rgba(192,57,43,0.05)',
  },
  newTripText: {
    fontSize: 9,
    color: BENI,
    fontWeight: '700',
    letterSpacing: 0.3,
  },

  // ── Divider ──
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.3 },
  dividerDot:  { fontSize: 7, color: KINCHA, marginHorizontal: 6, opacity: 0.45 },

  // ── Trip row ──
  tripRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  tripImg: {
    width: 120,
    height: 90,
    borderRadius: 6,
    backgroundColor: WASHI_DARK,
  },
  tripDetails: {
    flex: 1,
    gap: 6,
    justifyContent: 'center',
  },
  tripName: {
    fontSize: 15,
    fontWeight: '800',
    color: SUMI,
    letterSpacing: 0.2,
    marginBottom: 2,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  detailIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(192,57,43,0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  detailText: {
    fontSize: 12,
    color: INK_60,
    fontWeight: '500',
  },

  // ── Empty / Guest states ──
  centerCard: {
    justifyContent: 'center',
    alignItems: 'center',
    height: 120,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  emptyKanji: {
    position: 'absolute',
    fontSize: 90,
    color: INK_20,
    fontWeight: '900',
    top: 10,
  },
  emptyIconRing: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    borderColor: BENI,
    backgroundColor: 'rgba(192,57,43,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    shadowColor: BENI,
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: SUMI,
    marginBottom: 5,
    letterSpacing: 0.2,
  },
  emptySub: {
    fontSize: 12,
    color: INK_60,
    marginBottom: 18,
    textAlign: 'center',
    lineHeight: 18,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: BENI,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 5,
    shadowColor: BENI,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  primaryBtnText: {
    color: WHITE,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  outlineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1.2,
    borderColor: BENI,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(192,57,43,0.04)',
  },
  outlineBtnText: {
    color: BENI,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});