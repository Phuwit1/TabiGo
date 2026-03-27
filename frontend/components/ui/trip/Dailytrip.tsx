import React, {
  useEffect, useMemo, useState, forwardRef, useImperativeHandle,
} from 'react';
import {
  View, Text, TouchableOpacity, ScrollView,
  StyleSheet, ActivityIndicator, Alert,
} from 'react-native';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/api.js';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';

dayjs.locale('en');

// ─── Palette ──────────────────────────────────────────────────────────────────
const BENI         = '#C0392B';
const KINCHA       = '#B8963E';
const KINCHA_LIGHT = '#D4AF55';
const SUMI         = '#1C1410';
const WASHI        = '#FAF5EC';
const WASHI_DARK   = '#EDE5D8';
const WHITE        = '#FFFFFF';
const INK_60       = 'rgba(28,20,16,0.6)';
const INK_30       = 'rgba(28,20,16,0.3)';
const INK_12       = 'rgba(28,20,16,0.12)';

// ─── Types ────────────────────────────────────────────────────────────────────
type DisplayItem = {
  schedule_id: string | number;
  hhmm: string;
  activity: string;
  description: string;
};

type DailyData = {
  day: number;
  dateISO: string;
  items: DisplayItem[];
};

export type DailyPlanTabsHandle = {
  setActiveDay: (index: number) => void;
  reload: () => void;
};

type Props = {
  planId: number;
  startDate: string;
  endDate: string;
  canEdit?: boolean;
};

function buildDayRange(startISO: string, endISO: string): string[] {
  const s = dayjs(startISO);
  const e = dayjs(endISO);
  const total = Math.max(1, e.diff(s, 'day') + 1);
  return Array.from({ length: total }).map((_, i) => s.add(i, 'day').format('YYYY-MM-DD'));
}

// ─── Component ────────────────────────────────────────────────────────────────
const DailyPlanTabs = forwardRef<DailyPlanTabsHandle, Props>(function DailyPlanTabs(
  { planId, startDate, endDate, canEdit = true }, ref,
) {
  const db = useSQLiteContext();
  const router = useRouter();

  const [selectedDay, setSelectedDay] = useState(1);
  const [loading, setLoading]         = useState(false);
  const [days, setDays]               = useState<DailyData[]>([]);
  const [netStatus, setNetStatus]     = useState(true);

  const dayKeys = useMemo(() => buildDayRange(startDate, endDate), [startDate, endDate]);

  const fetchSchedules = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      const res = await axios.get(`${API_URL}/trip_schedule/${planId}`, { headers, timeout: 30000 });
      const payload = res.data?.payload;
      if (!payload?.itinerary) { setDays([]); return; }
      const packed: DailyData[] = payload.itinerary.map((day: any, idx: number) => ({
        day: idx + 1,
        dateISO: day.date,
        items: (day.schedule ?? []).map((s: any, i: number) => ({
          schedule_id: `${idx}-${i}`,
          hhmm: s.time,
          activity: s.activity,
          description: s.specific_location_name ?? '',
        })),
      }));
      setDays(packed);
    } catch (e: any) {
      if (e.response) Alert.alert('Could not load schedule', 'Check your connection');
      try {
        const rows = await db.getAllAsync('SELECT * FROM TripSchedule WHERE plan_id = ?', [planId]);
        setDays(JSON.parse((rows[0] as any).payload));
        setNetStatus(false);
      } catch { /* no offline data */ }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSchedules(); }, [planId, startDate, endDate]);

  useImperativeHandle(ref, () => ({
    setActiveDay: (i) => setSelectedDay(Math.max(1, Math.min(i + 1, dayKeys.length))),
    reload: fetchSchedules,
  }));

  const current = days.find(d => d.day === selectedDay);

  const handleEdit = () => {
    if (planId) {
      router.push({
        pathname: '/trip/[trip_id]/editschedule',
        params: { trip_id: String(planId), dayIndex: String(selectedDay - 1) },
      });
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={s.wrap}>
      {/* ── Day tab strip ── */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={s.tabStrip}
      >
        {dayKeys.map((key, i) => {
          const day = i + 1;
          const active = selectedDay === day;
          return (
            <TouchableOpacity
              key={key}
              style={[s.tab, active && s.tabActive]}
              onPress={() => setSelectedDay(day)}
              activeOpacity={0.75}
            >
              <Text style={[s.tabDay, active && s.tabDayActive]}>{`Day ${day}`}</Text>
              <Text style={[s.tabDate, active && s.tabDateActive]}>
                {dayjs(key).format('D MMM')}
              </Text>
              {active && <View style={s.tabDot} />}
            </TouchableOpacity>
          );
        })}

        {/* Refresh tab */}
        <TouchableOpacity
          style={[s.tab, s.tabRefresh]}
          onPress={fetchSchedules}
          activeOpacity={0.75}
        >
          {loading
            ? <ActivityIndicator size="small" color={BENI} />
            : <><Ionicons name="refresh" size={14} color={KINCHA} /><Text style={s.tabRefreshText}>Refresh</Text></>
          }
        </TouchableOpacity>
      </ScrollView>

      {/* ── Plan card ── */}
      <View style={s.card}>
        <View style={s.topBar} />

        {/* Card header */}
        <View style={s.cardHeader}>
          <View style={s.cardTitleRow}>
            <View style={s.cardAccent} />
            <Text style={s.cardTitle}>
              {dayjs(dayKeys[selectedDay - 1]).format('D MMMM YYYY')}
            </Text>
          </View>

          {netStatus && canEdit && (
            <TouchableOpacity style={s.editBtn} onPress={handleEdit} activeOpacity={0.8}>
              <Ionicons name="create-outline" size={13} color={WASHI} />
              <Text style={s.editBtnText}>Edit</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Kincha divider */}
        <View style={s.divRow}>
          <View style={s.divLine} />
          <Text style={s.divDot}>✦</Text>
          <View style={s.divLine} />
        </View>

        {/* Schedule items */}
        {loading && (!current || current.items.length === 0) ? (
          <ActivityIndicator color={BENI} style={{ marginVertical: 20 }} />
        ) : current && current.items.length > 0 ? (
          <View style={s.timeline}>
            {current.items.map((it, idx) => (
              <View key={it.schedule_id} style={s.timelineItem}>
                {/* Time + connector */}
                <View style={s.timelineLeft}>
                  <View style={s.timeBubble}>
                    <Text style={s.timeText}>{it.hhmm}</Text>
                  </View>
                  {idx < current.items.length - 1 && <View style={s.connector} />}
                </View>

                {/* Content */}
                <View style={s.timelineContent}>
                  <Text style={s.activityText}>{it.activity}</Text>
                  {!!it.description && (
                    <View style={s.descRow}>
                      <Ionicons name="location-outline" size={11} color={KINCHA} />
                      <Text style={s.descText}>{it.description}</Text>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={s.emptyWrap}>
            <Ionicons name="calendar-outline" size={28} color={INK_30} />
            <Text style={s.emptyText}>No activities yet</Text>
          </View>
        )}
      </View>
    </View>
  );
});

export default DailyPlanTabs;

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  wrap: { paddingBottom: 32 },

  // Tab strip
  tabStrip: { paddingHorizontal: 16, paddingVertical: 12, gap: 8 },
  tab: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 8, paddingHorizontal: 14,
    borderRadius: 14, backgroundColor: WASHI_DARK,
    minWidth: 68, position: 'relative',
    borderWidth: 1, borderColor: INK_12,
  },
  tabActive: {
    backgroundColor: SUMI,
    borderColor: SUMI,
    shadowColor: SUMI, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  tabDay: { fontSize: 12, fontFamily: 'NotoSansJP_700Bold', color: INK_60 },
  tabDayActive: { color: WASHI },
  tabDate: { fontSize: 10, fontFamily: 'NotoSansJP_400Regular', color: INK_30, marginTop: 1 },
  tabDateActive: { color: 'rgba(250,245,236,0.55)' },
  tabDot: {
    position: 'absolute', bottom: -1, left: '50%',
    width: 4, height: 4, borderRadius: 2, backgroundColor: BENI,
    transform: [{ translateX: -2 }],
  },
  tabRefresh: { gap: 4, flexDirection: 'row' },
  tabRefreshText: { fontSize: 11, fontFamily: 'NotoSansJP_500Medium', color: KINCHA },

  // Card
  card: {
    marginHorizontal: 16, borderRadius: 16,
    backgroundColor: WASHI,
    borderWidth: 1, borderColor: INK_12,
    overflow: 'hidden',
    marginBottom: 32,
    shadowColor: SUMI, shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  topBar: { height: 2, backgroundColor: BENI },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12 },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardAccent: { width: 3, height: 16, backgroundColor: BENI, borderRadius: 99 },
  cardTitle: { fontSize: 14, fontFamily: 'ShipporiMincho_700Bold', color: SUMI },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: BENI, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 99,
  },
  editBtnText: { fontSize: 11, fontFamily: 'NotoSansJP_700Bold', color: WASHI },

  // Divider
  divRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  divLine: { flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.3 },
  divDot: { fontSize: 7, color: KINCHA, marginHorizontal: 7, opacity: 0.45 },

  // Timeline
  timeline: { paddingHorizontal: 16, paddingBottom: 16 },
  timelineItem: { flexDirection: 'row', gap: 12 },
  timelineLeft: { alignItems: 'center', width: 48 },
  timeBubble: {
    width: 48, paddingVertical: 5,
    backgroundColor: SUMI, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  timeText: { fontSize: 11, fontFamily: 'NotoSansJP_700Bold', color: WASHI, letterSpacing: 0.3 },
  connector: { width: 1.5, flex: 1, backgroundColor: INK_12, marginVertical: 3 },
  timelineContent: {
    flex: 1, paddingTop: 4, paddingBottom: 14,
  },
  activityText: { fontSize: 13, fontFamily: 'NotoSansJP_700Bold', color: SUMI, lineHeight: 18 },
  descRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 3 },
  descText: { fontSize: 11, fontFamily: 'NotoSansJP_400Regular', color: INK_60, flex: 1 },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 28, gap: 8 },
  emptyText: { fontSize: 13, fontFamily: 'NotoSansJP_400Regular', color: INK_30 },
});