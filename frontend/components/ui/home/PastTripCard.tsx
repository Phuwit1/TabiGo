import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Pressable,
  Image, Animated, Modal, ScrollView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '@/api.js';

import {
  BENI, KINCHA, KINCHA_LIGHT, SUMI, WASHI, WASHI_DARK, INK_60, INK_20, WHITE,
} from '@/constants/theme';

// ─── Types ───────────────────────────────────────────────────────────────────
export interface PastTrip {
  plan_id: number;
  name_group: string;
  city?: string;
  start_plan_date: string;
  end_plan_date: string;
  image?: string;
  day_of_trip: number;
}

interface DayItem {
  day: string;
  date: string;
  schedule: { time: string; activity: string; description?: string }[];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
const CARD_W = 170;
const CARD_H = 240;
const IMG_H  = 115;

const formatRange = (s: string, e: string) => {
  const start = new Date(s);
  const end   = new Date(e);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  return `${start.toLocaleDateString('en', opts)} – ${end.toLocaleDateString('en', opts)}`;
};

// ─── Component ───────────────────────────────────────────────────────────────
export default function PastTripCard({ trip, index = 0 }: { trip: PastTrip; index?: number }) {
  const router = useRouter();

  const [showModal, setShowModal]     = useState(false);
  const [itinerary, setItinerary]     = useState<DayItem[]>([]);
  const [loadingSched, setLoadingSched] = useState(false);
  const [activeDay, setActiveDay]     = useState(0);
  const [imgError, setImgError]       = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Entrance animation
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, delay: index * 70, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 340, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, []);

  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start();

  // Lazy-load schedule when modal opens
  const openModal = async () => {
    setShowModal(true);
    setActiveDay(0);
    if (itinerary.length > 0) return;
    setLoadingSched(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const res = await axios.get(`${API_URL}/trip_schedule/${trip.plan_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const payload = res.data?.payload;
      const raw = typeof payload === 'string' ? JSON.parse(payload) : payload;
      setItinerary(raw?.itinerary ?? []);
    } catch {
      setItinerary([]);
    } finally {
      setLoadingSched(false);
    }
  };

  const fallbackImg = `https://picsum.photos/seed/${trip.plan_id}/300/200`;
  const imageUri    = imgError ? fallbackImg : (trip.image || fallbackImg);
  const cityLabel   = trip.city || 'Japan';

  return (
    <Animated.View
      style={[
        c.card,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
      ]}
    >
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={openModal}
        activeOpacity={1}
      >
        {/* ── Image ── */}
        <View style={c.imgWrap}>
          <Image
            source={{ uri: imageUri }}
            style={c.image}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
          <View style={c.scrim} />

          {/* Ended badge */}
          <View style={c.endedBadge}>
            <Ionicons name="checkmark-circle" size={9} color={KINCHA_LIGHT} />
            <Text style={c.endedText}>ENDED</Text>
          </View>

          {/* Days badge */}
          <View style={c.daysBadge}>
            <Text style={c.daysText}>{trip.day_of_trip}D</Text>
          </View>
        </View>

        {/* ── Info ── */}
        <View style={c.info}>
          <View style={c.stripe} />
          <View style={c.infoContent}>
            <Text style={c.title} numberOfLines={1}>{trip.name_group}</Text>

            <View style={c.cityRow}>
              <Ionicons name="location-outline" size={10} color={KINCHA} />
              <Text style={c.cityText} numberOfLines={1}>{cityLabel}</Text>
            </View>

            <Text style={c.dateText}>{formatRange(trip.start_plan_date, trip.end_plan_date)}</Text>

            <Text style={c.viewPlan}>View Plan ›</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Detail Modal ── */}
      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <Pressable style={m.overlay} onPress={() => setShowModal(false)}>
          <Pressable style={m.sheet} onPress={e => e.stopPropagation()}>

            {/* Top accent */}
            <View style={m.topBar} />

            {/* Hero image */}
            <Image
              source={{ uri: imageUri }}
              style={m.thumb}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />

            {/* Header info */}
            <View style={m.header}>
              <Text style={m.tripName} numberOfLines={2}>{trip.name_group}</Text>
              <View style={m.metaRow}>
                <View style={m.metaItem}>
                  <Ionicons name="location-outline" size={12} color={KINCHA} />
                  <Text style={m.metaCity}>{cityLabel}</Text>
                </View>
                <View style={m.metaItem}>
                  <Ionicons name="calendar-outline" size={12} color={INK_60} />
                  <Text style={m.metaDate}>{formatRange(trip.start_plan_date, trip.end_plan_date)}</Text>
                </View>
                <View style={m.metaItem}>
                  <Ionicons name="sunny-outline" size={12} color={INK_60} />
                  <Text style={m.metaDate}>{trip.day_of_trip} days</Text>
                </View>
              </View>
            </View>

            {/* Divider */}
            <View style={m.divRow}>
              <View style={m.divLine} />
              <Text style={m.divDot}>✦</Text>
              <View style={m.divLine} />
            </View>

            {/* Body */}
            <View>
              {loadingSched ? (
                <View style={m.loadingWrap}>
                  <ActivityIndicator size="small" color={BENI} />
                  <Text style={m.loadingText}>Loading itinerary…</Text>
                </View>
              ) : itinerary.length === 0 ? (
                <View style={m.emptyWrap}>
                  <Ionicons name="calendar-outline" size={32} color={INK_20} />
                  <Text style={m.emptyText}>No itinerary saved</Text>
                </View>
              ) : (
                <>
                  {/* Day tabs — horizontal, fixed height */}
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    style={m.dayTabScroll}
                    contentContainerStyle={m.dayTabContent}
                  >
                    {itinerary.map((day, i) => (
                      <TouchableOpacity
                        key={i}
                        style={[m.dayTab, activeDay === i && m.dayTabActive]}
                        onPress={() => setActiveDay(i)}
                        activeOpacity={0.75}
                      >
                        <Text style={[m.dayTabText, activeDay === i && m.dayTabTextActive]}>
                          {day.day}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>

                  {/* Activities — flex:1 fills remaining space, fully scrollable */}
                  <ScrollView
                    style={m.activityScroll}
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={m.activityContent}
                  >
                    {(itinerary[activeDay]?.schedule ?? []).map((act, i) => (
                      <View key={i} style={m.actRow}>
                        <View style={m.actTimeCol}>
                          <Text style={m.actTime}>{act.time || '—'}</Text>
                        </View>
                        <View style={m.actDot} />
                        <View style={m.actBody}>
                          <Text style={m.actActivity}>{act.activity}</Text>
                          {act.description ? (
                            <Text style={m.actDesc}>{act.description}</Text>
                          ) : null}
                        </View>
                      </View>
                    ))}
                  </ScrollView>
                </>
              )}

              {/* Plan Again — pinned at bottom of body */}
              <View style={m.footer}>
                <TouchableOpacity
                  style={m.planBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    setShowModal(false);
                    router.push('/trip/after-create' as any);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={16} color={WHITE} />
                  <Text style={m.planBtnText}>Plan Again</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Close button */}
            <TouchableOpacity style={m.closeBtn} onPress={() => setShowModal(false)} activeOpacity={0.85}>
              <Ionicons name="close" size={14} color={WHITE} />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

// ─── Card styles ─────────────────────────────────────────────────────────────
const c = StyleSheet.create({
  card: {
    width: CARD_W,
    height: CARD_H,
    backgroundColor: WASHI,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: WASHI_DARK,
    shadowColor: SUMI,
    shadowOpacity: 0.09,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
    marginBottom: 4,
  },
  imgWrap: {
    width: '100%',
    height: IMG_H,
    backgroundColor: WASHI_DARK,
    position: 'relative',
  },
  image:  { width: '100%', height: '100%' },
  scrim:  {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 40,
    backgroundColor: 'rgba(28,20,16,0.30)',
  },
  endedBadge: {
    position: 'absolute',
    top: 6, right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(28,20,16,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: KINCHA,
  },
  endedText: {
    fontSize: 8,
    color: KINCHA_LIGHT,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  daysBadge: {
    position: 'absolute',
    bottom: 6, left: 6,
    backgroundColor: BENI,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  daysText: {
    fontSize: 9,
    color: WHITE,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  info: {
    flexDirection: 'row',
    padding: 10,
    height: CARD_H - IMG_H,
    overflow: 'hidden',
  },
  stripe: {
    width: 2,
    backgroundColor: KINCHA,
    borderRadius: 1,
    marginRight: 8,
    alignSelf: 'stretch',
  },
  infoContent: { flex: 1, gap: 3 },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: SUMI,
    letterSpacing: 0.1,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  cityText: {
    fontSize: 10,
    color: KINCHA,
    fontWeight: '600',
    flex: 1,
  },
  dateText: {
    fontSize: 9,
    color: INK_60,
  },
  viewPlan: {
    fontSize: 9,
    color: BENI,
    fontWeight: '700',
    marginTop: 'auto' as any,
    letterSpacing: 0.3,
  },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28,20,16,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  sheet: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: WASHI,
    borderRadius: 16,
    overflow: 'hidden',
    maxHeight: '90%',
    shadowColor: SUMI,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },
  topBar:  { height: 3, backgroundColor: KINCHA },
  thumb:   { width: '100%', height: 130, backgroundColor: WASHI_DARK },

  header:  { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 },
  tripName: {
    fontSize: 17,
    fontWeight: '800',
    color: SUMI,
    letterSpacing: 0.2,
    marginBottom: 8,
  },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  metaItem:{ flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaCity: { fontSize: 12, fontWeight: '700', color: KINCHA },
  metaDate: { fontSize: 11, color: INK_60 },

  divRow:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginBottom: 10 },
  divLine:  { flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.3 },
  divDot:   { fontSize: 7, color: KINCHA, marginHorizontal: 7, opacity: 0.45 },

  loadingWrap: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  loadingText: { fontSize: 12, color: INK_60 },
  emptyWrap:   { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText:   { fontSize: 13, color: INK_60 },

  // Day tabs
  dayTabScroll:   { maxHeight: 40 },
  dayTabContent:  { paddingHorizontal: 16, gap: 6, alignItems: 'center' },
  dayTab: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    backgroundColor: WASHI_DARK,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dayTabActive: {
    backgroundColor: BENI,
    borderColor: BENI,
  },
  dayTabText:       { fontSize: 11, fontWeight: '600', color: INK_60 },
  dayTabTextActive: { color: WHITE, fontWeight: '700' },

  // Activities
  activityScroll: { maxHeight: 320, paddingHorizontal: 16, marginTop: 10 },
  activityContent: { paddingBottom: 16 },
  actRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 8,
  },
  actTimeCol: { width: 42, alignItems: 'flex-end', paddingTop: 1 },
  actTime:    { fontSize: 10, color: INK_60, fontWeight: '600' },
  actDot: {
    width: 7, height: 7,
    borderRadius: 4,
    backgroundColor: KINCHA,
    marginTop: 4,
  },
  actBody:    { flex: 1 },
  actActivity:{ fontSize: 12, fontWeight: '700', color: SUMI, lineHeight: 17 },
  actDesc:    { fontSize: 11, color: INK_60, marginTop: 2, lineHeight: 15 },

  // Footer
  footer: { paddingHorizontal: 16, paddingVertical: 14 },
  planBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: BENI,
    paddingVertical: 11,
    borderRadius: 10,
  },
  planBtnText: { fontSize: 13, fontWeight: '700', color: WHITE, letterSpacing: 0.3 },

  closeBtn: {
    position: 'absolute',
    top: 10, right: 10,
    width: 26, height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(28,20,16,0.60)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
