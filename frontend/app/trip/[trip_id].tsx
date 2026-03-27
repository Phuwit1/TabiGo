import { View, Text, StyleSheet, Image, TouchableOpacity, ActivityIndicator } from 'react-native';
import TripParallaxScrollView from '@/components/ui/trip/TripParallaxScrollView';
import TripCardID from '@/components/ui/trip/cardtripId';
import DailyPlanTabs from '@/components/ui/trip/Dailytrip';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useCallback, useMemo, useRef, useEffect } from 'react';
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

import { Ionicons } from '@expo/vector-icons';
import { BENI, KINCHA, SUMI, WASHI, INK_60, WHITE } from '@/constants/theme';

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

// ─── Trip skeleton ────────────────────────────────────────────────────────────
const SKELETON_BG  = 'rgba(28,20,16,0.08)';
const SKELETON_MED = 'rgba(28,20,16,0.13)';

function TripSkeleton() {
  return (
    <View style={{ flex: 1, backgroundColor: WASHI }}>
      {/* Header */}
      <View style={{ height: 320, backgroundColor: SUMI, justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={{ backgroundColor: 'rgba(255,255,255,0.10)', borderRadius: 14, height: 240 }} />
      </View>

      {/* Section label */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 20, marginBottom: 14 }}>
        <View style={{ width: 3, height: 16, backgroundColor: BENI, borderRadius: 99 }} />
        <View style={{ width: 70, height: 12, backgroundColor: SKELETON_BG, borderRadius: 4 }} />
      </View>

      {/* Day tabs */}
      <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 16, marginBottom: 18 }}>
        {[64, 56, 56, 56].map((w, i) => (
          <View key={i} style={{ width: w, height: 32, backgroundColor: i === 0 ? SKELETON_MED : SKELETON_BG, borderRadius: 8 }} />
        ))}
      </View>

      {/* Activity items */}
      {[0, 1, 2].map(i => (
        <View key={i} style={{ marginHorizontal: 16, marginBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12,
          backgroundColor: '#FAF5EC', borderRadius: 12, padding: 12,
          shadowColor: '#1C1410', shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
          <View style={{ width: 44, height: 44, borderRadius: 8, backgroundColor: SKELETON_BG }} />
          <View style={{ flex: 1, gap: 8 }}>
            <View style={{ width: '65%', height: 11, backgroundColor: SKELETON_MED, borderRadius: 4 }} />
            <View style={{ width: '40%', height: 9, backgroundColor: SKELETON_BG, borderRadius: 4 }} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ─── Budget Summary ───────────────────────────────────────────────────────────
const CAT_ICONS: Record<string, string> = {
  Food: 'restaurant', Transport: 'airplane', Lodging: 'bed',
  Shopping: 'bag-handle', Activities: 'ticket', Tour: 'map',
  Cafe: 'cafe', Health: 'medkit', 'SIM / WiFi': 'wifi',
  'Visa / Docs': 'document-text', Insurance: 'shield-checkmark',
  'Taxi / Grab': 'car', Baggage: 'briefcase', Gifts: 'gift', Other: 'ellipsis-horizontal',
};
const CAT_COLORS: Record<string, string> = {
  Food: '#E67E22', Transport: '#2980B9', Lodging: '#8E44AD',
  Shopping: '#C0392B', Activities: '#16A085', Tour: '#27AE60',
  Cafe: '#A0522D', Health: '#E74C3C', 'SIM / WiFi': '#2ECC71',
  'Visa / Docs': '#7F8C8D', Insurance: '#1ABC9C', 'Taxi / Grab': '#F39C12',
  Baggage: '#6C5CE7', Gifts: '#E91E63', Other: '#95A5A6',
};

function BudgetSummary({ budget, expenses, loading, planId, canEdit }: { budget: any; expenses: any[]; loading: boolean; planId: any; canEdit: boolean }) {
  const router = useRouter();
  
  if (loading) {
    return (
      <View style={{ alignItems: 'center', paddingTop: 48 }}>
        <ActivityIndicator size="large" color={BENI} />
      </View>
    );
  }

  // กรณีที่ยังไม่ได้ตั้งค่า Budget เลย
  if (!budget) {
    return (
      <View style={bs.empty}>
        <Ionicons name="wallet-outline" size={40} color={INK_60} />
        <Text style={bs.emptyTitle}>No budget set</Text>
        <Text style={bs.emptySub}>Set a budget from the Budget page</Text>
        {canEdit && (
          <TouchableOpacity 
            style={bs.addBtn} 
            onPress={() => router.push(`/trip/${planId}/budget` as any)}
            activeOpacity={0.8}
          >
            <Ionicons name="add" size={16} color={WHITE} />
            <Text style={bs.addBtnText}>Set Budget</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  const totalSpent   = expenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const remaining    = budget.total_budget - totalSpent;
  const progress     = Math.min(totalSpent / budget.total_budget, 1);
  const progressColor = progress > 0.85 ? BENI : progress > 0.6 ? '#C8860A' : KINCHA;
  const fmt = (n: number) => `¥${Math.round(n).toLocaleString()}`;

  return (
    <View style={bs.wrap}>
      {/* Summary cards */}
      <View style={bs.summaryRow}>
        <View style={[bs.card, { borderTopColor: KINCHA }]}>
          <Text style={bs.cardLabel}>Total Budget</Text>
          <Text style={[bs.cardValue, { color: KINCHA }]}>{fmt(budget.total_budget)}</Text>
        </View>
        <View style={[bs.card, { borderTopColor: BENI }]}>
          <Text style={bs.cardLabel}>Total Spent</Text>
          <Text style={[bs.cardValue, { color: BENI }]}>{fmt(totalSpent)}</Text>
        </View>
        <View style={[bs.card, { borderTopColor: remaining < 0 ? BENI : '#27AE60' }]}>
          <Text style={bs.cardLabel}>Remaining</Text>
          <Text style={[bs.cardValue, { color: remaining < 0 ? BENI : '#27AE60' }]}>{fmt(remaining)}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={bs.progressWrap}>
        <View style={bs.progressTrack}>
          <View style={[bs.progressFill, { width: `${progress * 100}%` as any, backgroundColor: progressColor }]} />
        </View>
        <Text style={bs.progressLabel}>{Math.round(progress * 100)}% used</Text>
      </View>

      {/* Expense list */}
      {expenses.length === 0 ? (
        // กรณีตั้ง Budget แล้ว แต่ยังไม่มีค่าใช้จ่าย (Expenses)
        <View style={bs.emptyExpWrap}>
          <Text style={bs.noExp}>No expenses recorded yet</Text>
          {canEdit && (
            <TouchableOpacity 
              style={bs.addBtn} 
              onPress={() => router.push(`/trip/${planId}/budget` as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="add-circle-outline" size={18} color={WHITE} />
              <Text style={bs.addBtnText}>Add Expense</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : (
        <View style={bs.expList}>
          <View style={bs.expListHeader}>
            <View style={bs.expListBar} />
            <Text style={bs.expListTitle}>Expenses</Text>
            {canEdit && (
              <TouchableOpacity style={bs.editLink} onPress={() => router.push(`/trip/${planId}/budget` as any)}>
                <Ionicons name="pencil" size={13} color={BENI} />
                <Text style={bs.editLinkTxt}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>
          {expenses.map((e: any) => {
            const color = CAT_COLORS[e.category] ?? '#95A5A6';
            const icon  = CAT_ICONS[e.category]  ?? 'ellipsis-horizontal';
            return (
              <TouchableOpacity
                key={e.expense_id}
                style={bs.expRow}
                onPress={() => router.push(`/trip/${planId}/budget` as any)}
                activeOpacity={0.75}
              >
                <View style={[bs.expIcon, { backgroundColor: color + '18' }]}>
                  <Ionicons name={icon as any} size={16} color={color} />
                </View>
                <View style={bs.expText}>
                  <Text style={bs.expCat}>{e.category}</Text>
                  {e.description ? <Text style={bs.expDesc}>{e.description}</Text> : null}
                </View>
                <Text style={bs.expAmt}>{fmt(e.amount)}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

const bs = StyleSheet.create({
  wrap:          { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32 },
  empty:         { alignItems: 'center', paddingTop: 56, gap: 8 },
  emptyTitle:    { fontSize: 15, fontWeight: '700', color: SUMI },
  emptySub:      { fontSize: 13, color: INK_60 },
  emptyExpWrap:  { alignItems: 'center', paddingTop: 24, gap: 12 },
  addBtn:        {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: BENI,
    paddingVertical: 10, paddingHorizontal: 20,
    borderRadius: 24,
    marginTop: 8,
    shadowColor: SUMI, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2,
  },
  addBtnText:    { color: WHITE, fontSize: 13, fontWeight: '700' },
  summaryRow:    { flexDirection: 'row', gap: 8, marginBottom: 16 },
  card:          {
    flex: 1, backgroundColor: WHITE, borderRadius: 10,
    padding: 12, borderTopWidth: 3,
    shadowColor: SUMI, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2,
  },
  cardLabel:     { fontSize: 10, color: INK_60, marginBottom: 4 },
  cardValue:     { fontSize: 14, fontWeight: '800' },
  progressWrap:  { marginBottom: 20 },
  progressTrack: { height: 6, backgroundColor: '#EDE8E0', borderRadius: 3, overflow: 'hidden', marginBottom: 4 },
  progressFill:  { height: '100%', borderRadius: 3 },
  progressLabel: { fontSize: 11, color: INK_60, textAlign: 'right' },
  noExp:         { textAlign: 'center', color: INK_60, fontSize: 13, paddingTop: 20 },
  expList:       { gap: 8 },
  expListHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  expListBar:    { width: 3, height: 14, backgroundColor: BENI, borderRadius: 2 },
  expListTitle:  { fontSize: 13, fontWeight: '700', color: SUMI },
  expRow:        {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: WHITE, borderRadius: 10, padding: 10,
    shadowColor: SUMI, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1,
  },
  expIcon:       { width: 34, height: 34, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  expText:       { flex: 1 },
  expCat:        { fontSize: 13, fontWeight: '700', color: SUMI },
  expDesc:       { fontSize: 11, color: INK_60 },
  expAmt:        { fontSize: 13, fontWeight: '800', color: BENI },
  editLink:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto' },
  editLinkTxt:   { fontSize: 12, fontWeight: '600', color: BENI },
});

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function Hometrip() {
  const db = useSQLiteContext();
  const { trip_id } = useLocalSearchParams();

  const [trip, setTrip]               = useState<any>(null);
  const [loading, setLoading]         = useState(true);
  const [netStatus, setNetStatus]     = useState(true);
  const [refreshKey, setRefreshKey]   = useState(Date.now());
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [canEdit, setCanEdit]             = useState(true);

  const [activeTab, setActiveTab]         = useState<'itinerary' | 'budget'>('itinerary');
  const [budgetData, setBudgetData]       = useState<any>(null);
  const [expenses, setExpenses]           = useState<any[]>([]);
  const [budgetLoading, setBudgetLoading] = useState(false);

  const fetchBudget = useCallback(async () => {
    if (budgetData !== null) return;
    setBudgetLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const res = await axios.get(`${API_URL}/budget/plan/${trip_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setBudgetData(res.data);
      setExpenses(res.data?.expenses || []);
    } catch { /* ignore */ }
    finally { setBudgetLoading(false); }
  }, [trip_id, budgetData]);

  useEffect(() => {
    if (activeTab === 'budget') fetchBudget();
  }, [activeTab]);

  const dailyRef = useRef<DailyPlanTabsHandle>(null);
  const API_BASE = useMemo(() => `${API_URL}`, []);

  useFocusEffect(
    useCallback(() => {
      const fetchTrip = async () => {
        try {
          const token = await AsyncStorage.getItem('access_token');
          if (!token) return;
          const [tripRes, userRes] = await Promise.all([
            axios.get(`${API_URL}/trip_plan/${trip_id}`, {
              headers: { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache' },
              timeout: 10000,
              params: { t: Date.now() },
            }),
            axios.get(`${API_URL}/user`, { headers: { Authorization: `Bearer ${token}` } }),
          ]);
          setTrip(tripRes.data);
          const uid = userRes.data.customer_id ?? null;
          setCurrentUserId(uid);
          setRefreshKey(Date.now());
          const isCreator = uid !== null && tripRes.data?.creator_id === uid;
          if (isCreator) {
            setCanEdit(true);
          } else if (tripRes.data?.trip_id) {
            try {
              const roleRes = await axios.get(`${API_URL}/trip_group/${tripRes.data.trip_id}/my-role`, {
                headers: { Authorization: `Bearer ${token}` },
              });
              setCanEdit(roleRes.data.role === 'editor');
            } catch { setCanEdit(false); }
          } else {
            setCanEdit(false);
          }
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
  if (loading) return <TripSkeleton />;

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
        {/* ── Tab switcher ── */}
        <View style={s.tabBar}>
          {(['itinerary', 'budget'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[s.tabBtn, activeTab === tab && s.tabBtnActive]}
              onPress={() => setActiveTab(tab)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={tab === 'itinerary' ? 'map-outline' : 'wallet-outline'}
                size={14}
                color={activeTab === tab ? WHITE : INK_60}
              />
              <Text style={[s.tabBtnText, activeTab === tab && s.tabBtnTextActive]}>
                {tab === 'itinerary' ? 'Itinerary' : 'Budget'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Content ── */}
        {activeTab === 'itinerary' ? (
          <DailyPlanTabs
            key={refreshKey}
            startDate={trip.start_plan_date}
            endDate={trip.end_plan_date}
            planId={trip.plan_id}
            canEdit={canEdit}
            ref={dailyRef}
          />
        ) : (
          <BudgetSummary
            budget={budgetData}
            expenses={expenses}
            loading={budgetLoading}
            planId={trip.plan_id}
            canEdit={canEdit}
          />
        )}
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

  // Tab bar
  tabBar: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#EDE8E0',
  },
  tabBtnActive: {
    backgroundColor: BENI,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: INK_60,
  },
  tabBtnTextActive: {
    color: WHITE,
  },
});