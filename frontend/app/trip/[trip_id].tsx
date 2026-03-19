import { View, Text, StyleSheet, Image, ActivityIndicator } from 'react-native';
import TripParallaxScrollView from '@/components/ui/trip/TripParallaxScrollView';
import TripCardID from '@/components/ui/trip/cardtripId';
import DailyPlanTabs from '@/components/ui/trip/Dailytrip';
import { useLocalSearchParams } from 'expo-router';
import { useState, useCallback, useMemo, useRef } from 'react';
import FloatingChat from '@/components/ui/trip/chat/Floatingchat';
import { DailyPlanTabsHandle } from '@/components/ui/trip/Dailytrip';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '@/api.js';
import DownloadTripButton from '@/components/ui/trip/DownloadTripButton';
import { useSQLiteContext } from 'expo-sqlite';

dayjs.locale('en');

// ─── Palette ──────────────────────────────────────────────────────────────────
const BENI   = '#C0392B';
const KINCHA = '#B8963E';
const SUMI   = '#1C1410';
const WASHI  = '#FAF5EC';
const INK_60 = 'rgba(28,20,16,0.6)';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStatus = (start: string, end: string): 'Upcoming' | 'On Trip' | 'Trip Ended' => {
  const now = new Date();
  const s = new Date(start);
  const e = new Date(end);
  if (now < s) return 'Upcoming';
  if (now >= s && now <= e) return 'On Trip';
  return 'Trip Ended';
};

const getDuration = (start: string, end: string) =>
  dayjs(end).diff(dayjs(start), 'day') + 1;

const formatTripDateRange = (startStr: string, endStr: string) => {
  const start = dayjs(startStr);
  const end   = dayjs(endStr);
  return `${start.date()}-${end.date()} ${end.format('MMM')} ${(start.year() + 543) % 100}`;
};

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function Hometrip() {
  const db = useSQLiteContext();
  const { trip_id } = useLocalSearchParams();

  const [trip, setTrip]           = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [netStatus, setNetStatus] = useState(true);
  const [refreshKey, setRefreshKey] = useState(Date.now());

  const dailyRef = useRef<DailyPlanTabsHandle>(null);
  const API_BASE = useMemo(() => `${API_URL}`, []);

  useFocusEffect(
    useCallback(() => {
      const fetchTrip = async () => {
        try {
          const token = await AsyncStorage.getItem('access_token');
          if (!token) return;
          const res = await axios.get(`${API_URL}/trip_plan/${trip_id}`, {
            headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
            timeout: 10000,
            params: { t: Date.now() },
          });
          setTrip(res.data);
          setRefreshKey(Date.now());
        } catch (err: any) {
          if (err.response) return;
          try {
            const rows = await db.getAllAsync('SELECT * FROM TripPlan WHERE plan_id = ?', [trip_id as any]);
            setTrip(rows[0]);
            setNetStatus(false);
          } catch { /* ignore */ }
        } finally {
          setLoading(false);
        }
      };
      if (trip_id) fetchTrip();
    }, [trip_id])
  );

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator color={BENI} size="large" />
        <Text style={s.loadingText}>Loading trip...</Text>
      </View>
    );
  }

  // ── Error state ───────────────────────────────────────────────────────────
  if (!trip) {
    return (
      <View style={s.loadingScreen}>
        <Text style={s.errorText}>Trip not found</Text>
      </View>
    );
  }

  const handleImageUpdate = (newImageUrl: string) =>
    setTrip((prev: any) => ({ ...prev, image: newImageUrl }));

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={s.screen} pointerEvents="box-none">
      <TripParallaxScrollView
        headerHeight={320}
        headerBackgroundColor={{ light: SUMI, dark: SUMI }}
        headerImage={
          <View style={s.headerWrap}>
            {/* Background image */}
            <Image
              source={
                trip.image
                  ? { uri: trip.image }
                  : require('@/assets/images/home/fuji-view.jpg')
              }
              style={s.headerImg}
            />

            {/* Dark gradient overlay */}
            <View style={s.headerOverlay} />

            {/* Beni top accent bar */}
            <View style={s.topAccentBar} />

            {/* Download button — top right */}
            {netStatus && (
              <View style={s.downloadWrap}>
                <DownloadTripButton tripData={trip} planId={trip.plan_id} />
              </View>
            )}

            {/* TripCard centered */}
            <View style={s.cardWrap}>
              <TripCardID
                name={trip.name_group}
                date={formatTripDateRange(trip.start_plan_date, trip.end_plan_date)}
                duration={String(getDuration(trip.start_plan_date, trip.end_plan_date))}
                status={getStatus(trip.start_plan_date, trip.end_plan_date)}
                people={trip.tripGroup?.members?.length || 1}
                planId={trip.plan_id}
                tripId={trip.trip_id}
                budget={trip.budget?.total_budget}
                netStatus={netStatus}
                image={trip.image || 'https://via.placeholder.com/300x200.png?text=No+Image'}
                onImageUpdate={handleImageUpdate}
              />
            </View>
          </View>
        }
      >
        {/* ── Section label ── */}
        <View style={s.sectionHeader}>
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>Itinerary</Text>
        </View>

        {/* ── Daily plan tabs ── */}
        <DailyPlanTabs
          key={refreshKey}
          startDate={trip.start_plan_date}
          endDate={trip.end_plan_date}
          planId={trip.plan_id}
          ref={dailyRef}
        />
      </TripParallaxScrollView>

      {netStatus && (
        <FloatingChat apiBaseUrl={API_BASE} planId={trip.plan_id} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, position: 'relative', backgroundColor: WASHI },

  // Loading / error
  loadingScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: WASHI, gap: 12 },
  loadingText: { fontSize: 13, fontFamily: 'NotoSansJP_400Regular', color: INK_60 },
  errorText: { fontSize: 15, fontFamily: 'ShipporiMincho_700Bold', color: SUMI },

  // Parallax header
  headerWrap: { width: '100%', height: 320, position: 'relative' },
  headerImg: { width: '100%', height: '100%', resizeMode: 'cover' },
  headerOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(28,20,16,0.55)',
  },
  topAccentBar: {
    position: 'absolute', top: 0, left: 0, right: 0,
    height: 3, backgroundColor: BENI,
  },
  downloadWrap: {
    position: 'absolute', top: 14, right: 16, zIndex: 10,
  },
  cardWrap: {
    position: 'absolute',
    bottom: 16, left: 16, right: 16,
  },

  // Body section header
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 18, paddingBottom: 4,
  },
  sectionBar: { width: 3, height: 16, backgroundColor: BENI, borderRadius: 99 },
  sectionTitle: { fontSize: 15, fontFamily: 'ShipporiMincho_700Bold', color: SUMI },
});