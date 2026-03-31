import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, FlatList, StyleSheet,
  TouchableOpacity, Animated, RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import TripCard from '@/components/ui/trip/cardtrip';
import TopBar from '@/components/TopBar';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '@/api.js';
import { Ionicons } from '@expo/vector-icons';
import { useSQLiteContext } from 'expo-sqlite';
import { LinearGradient } from 'expo-linear-gradient';
import TripListSkeleton from '@/components/ui/trip/TripListSkeleton';
import { Alert } from 'react-native';
import SakuraBackground from '@/components/ui/sakurabackground';

import { BENI, BENI_LIGHT, KINCHA, KINCHA_LIGHT, SUMI, SAKURA, WASHI, WASHI_DARK, INK_60, INK_20, WHITE } from '@/constants/theme';
import WashiDivider from '@/components/ui/WashiDivider';

// ─── Types ────────────────────────────────────────────────────────────────────
type Trip = {
  plan_id: number;
  name_group: string;
  creator_id: number;
  start_plan_date: string;
  end_plan_date: string;
  createdAt?: string;
  tripGroup?: { members: any[] } | null;
  image?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getStatus = (start: string, end: string): 'Upcoming' | 'On Trip' | 'Trip Ended' => {
  const now       = new Date();
  const startDate = new Date(start);
  const endDate   = new Date(end);
  if (now < startDate) return 'Upcoming';
  if (now >= startDate && now <= endDate) return 'On Trip';
  return 'Trip Ended';
};

const formatTripDateRange = (startStr: string, endStr: string): string => {
  dayjs.locale('en');
  const start     = dayjs(startStr);
  const end       = dayjs(endStr);
  const startDate = start.date();
  const endDate   = end.date();
  const monthName = end.format('MMM');
  const year      = (start.year() + 543) % 100;
  return `${startDate}–${endDate} ${monthName} '${year}`;
};


// ─── Empty state ──────────────────────────────────────────────────────────────
const EmptyTripState = ({ router }: { router: any }) => {
  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.9)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[s.emptyWrap, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      {/* Kanji watermark */}

      {/* Icon ring */}
      <View style={s.emptyIconRing}>
        <View style={s.emptyIconInner}>
          <Ionicons name="airplane" size={40} color={BENI} />
        </View>
      </View>

      <Text style={s.emptyTitle}>No Trips Yet</Text>
      <Text style={s.emptySub}>
        Start planning your next adventure.{'\n'}Every great journey begins here.
      </Text>

      <WashiDivider />

      {/* CTA buttons */}
      <View style={s.emptyBtnRow}>
        <TouchableOpacity
          onPress={() => router.push('/home')}
          activeOpacity={0.85}
          style={s.emptyBtnPrimaryWrap}
        >
          <LinearGradient
            colors={[BENI_LIGHT, BENI]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.emptyBtnPrimary}
          >
            <Ionicons name="add-circle-outline" size={18} color={WHITE} />
            <Text style={s.emptyBtnPrimaryText}>Create Trip</Text>
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push('/join')}
          activeOpacity={0.85}
          style={s.emptyBtnSecondary}
        >
          <Ionicons name="enter-outline" size={18} color={BENI} />
          <Text style={s.emptyBtnSecondaryText}>Join Trip</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

// ─── Guest screen ──────────────────────────────────────────────────────────────
const GuestScreen = ({ router }: { router: any }) => (
  <View style={s.guestContainer}>
    {/* Decorative circles */}
    <View style={s.guestCircle1} />
    <View style={s.guestCircle2} />
    <View style={s.guestCircle3} />
    {/* Kanji watermark */}

    {/* Icon */}
    <View style={s.guestIconRing}>
      <View style={s.guestIconInner}>
        <Ionicons name="map" size={48} color={BENI} />
      </View>
    </View>

    <Text style={s.guestTitle}>Unlock Your Trips</Text>
    <Text style={s.guestSubtitle}>
      Log in or sign up to create, save,{'\n'}and manage your travel plans.
    </Text>

    <TouchableOpacity
      onPress={() => router.push('/Login')}
      activeOpacity={0.85}
      style={s.guestBtnWrap}
    >
      <LinearGradient
        colors={[BENI_LIGHT, BENI]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={s.guestBtn}
      >
        <Ionicons name="log-in-outline" size={20} color={WHITE} />
        <Text style={s.guestBtnText}>Log In / Sign Up</Text>
      </LinearGradient>
    </TouchableOpacity>
  </View>
);

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function TripListScreen() {
  const db           = useSQLiteContext();
  const [search, setSearch]               = useState('');
  const [trips, setTrips]                 = useState<Trip[]>([]);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState('');
  const [currentUser, setCurrentUser]     = useState<any>(null);
  const [isDeleteMode, setIsDeleteMode]   = useState(false);
  const [isGuest, setIsGuest]             = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [refreshing, setRefreshing]       = useState(false);
  const router = useRouter();

  const searchAnim = useRef(new Animated.Value(0)).current;

  const toggleSearch = () => {
    const toVal = searchVisible ? 0 : 1;
    setSearchVisible(!searchVisible);
    Animated.timing(searchAnim, { toValue: toVal, duration: 220, useNativeDriver: false }).start();
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTrips = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) { setIsGuest(true); setLoading(false); return; }
      setIsGuest(false);
      const [userRes, tripsRes] = await Promise.allSettled([
        axios.get(`${API_URL}/user`,      { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/trip_plan`, { headers: { Authorization: `Bearer ${token}` }, timeout: 10000 }),
      ]);
      if (userRes.status === 'fulfilled') setCurrentUser(userRes.value.data);
      if (tripsRes.status === 'rejected') throw tripsRes.reason;
      setTrips(Array.isArray(tripsRes.value.data) ? tripsRes.value.data : []);
    } catch (err: any) {
      try {
        const offlineTrips = await db.getAllAsync('SELECT * FROM TripPlan');
        if (Array.isArray(offlineTrips) && offlineTrips.length > 0) {
          setTrips(offlineTrips as Trip[]);
          setError('');
        } else {
          setError('Unable to load trips. No offline data available.');
        }
      } catch {
        setError('An error occurred while loading trips.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      fetchTrips();
      return () => setIsDeleteMode(false);
    }, [fetchTrips])
  );

  // ── Delete ─────────────────────────────────────────────────────────────────
  const handleDelete = async (planId: number) => {
    Alert.alert(
      'Delete Trip',
      'Are you sure you want to delete this trip?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem('access_token');
              await axios.delete(`${API_URL}/trip_plan/${planId}`, {
                headers: { Authorization: `Bearer ${token}` },
                timeout: 10000,
              });
            } catch (error: any) {
              if (error.response) {
                Alert.alert('Cannot Delete', `Server rejected (Code: ${error.response.status})`);
                return;
              }
              try {
                await db.runAsync('DELETE FROM TripPlan WHERE plan_id = ?', [planId]);
              } catch {
                Alert.alert('Error', 'Failed to delete trip');
              }
            } finally {
              setTrips(prev => prev.filter(t => t.plan_id !== planId));
            }
          },
        },
      ]
    );
  };

  if (isGuest) return <GuestScreen router={router} />;

  const filteredTrips = Array.isArray(trips)
    ? trips
        .filter(t => t.name_group?.toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => {
          const statusOrder = { 'On Trip': 0, 'Upcoming': 1, 'Trip Ended': 2 };
          const statusA = statusOrder[getStatus(a.start_plan_date, a.end_plan_date)];
          const statusB = statusOrder[getStatus(b.start_plan_date, b.end_plan_date)];
          if (statusA !== statusB) return statusA - statusB;
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : a.plan_id;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : b.plan_id;
          return dateB - dateA;
        })
    : [];

  const renderItem = ({ item }: { item: Trip }) => {
    const durationDays = Math.ceil(
      (new Date(item.end_plan_date).getTime() - new Date(item.start_plan_date).getTime()) /
      (1000 * 60 * 60 * 24)
    ) + 1;

    const formattedDate = formatTripDateRange(item.start_plan_date, item.end_plan_date);
    const myId          = currentUser?.customer_id || currentUser?.id;
    const isOwner       = myId === item.creator_id;
    const isJoined      = !isOwner && myId;

    // ── Build member list ───────────────────────────────────────────────────
    // Always start with current user's avatar as the first entry (creator)
    const creatorAvatar = currentUser?.image || '';

    const groupMembers: string[] = item.tripGroup?.members
      ?.map((m: any) => m.image || m.avatar || '')
      ?? [];

    // If solo trip (no tripGroup) → just show creator avatar, count = 1
    // If has group → API already includes creator in members list
    const memberImages: string[] = groupMembers.length > 0
      ? groupMembers
      : [creatorAvatar];

    const memberCount = memberImages.length;

    return (
      <View style={s.cardWrap}>
        <TouchableOpacity
          onPress={() => router.push(`/trip/${item.plan_id}`)}
          disabled={isDeleteMode}
          activeOpacity={isDeleteMode ? 1 : 0.78}
        >
          <TripCard
            name={item.name_group}
            date={formattedDate}
            duration={`${durationDays}`}
            status={getStatus(item.start_plan_date, item.end_plan_date)}
            people={memberCount}
            image={item.image || 'https://picsum.photos/seed/' + item.plan_id + '/300/200'}
            isJoined={!!isJoined}
            memberImages={memberImages}
          />
        </TouchableOpacity>

        {/* Delete button */}
        {isDeleteMode && isOwner && (
          <TouchableOpacity style={s.deleteBadge} onPress={() => handleDelete(item.plan_id)}>
            <View style={s.deleteIcon}>
              <Ionicons name="close" size={14} color={WHITE} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <>
      <TopBar />
      
      <View style={s.container}>
        <SakuraBackground/>

        {/* ── Page header ── */}
        <View style={s.pageHeader}>
          {/* Left: title + kanji */}
          <View style={s.pageHeaderLeft}>
            <View style={s.pageHeaderBar} />
            <Text style={s.pageHeaderTitle}>My Trips</Text>
          </View>

          {/* Right: action buttons */}
          <View style={s.pageHeaderActions}>
            {/* Search toggle */}
            <TouchableOpacity
              style={[s.headerBtn, searchVisible && s.headerBtnActive]}
              onPress={toggleSearch}
              activeOpacity={0.8}
            >
              <Ionicons name="search" size={17} color={searchVisible ? WHITE : BENI} />
            </TouchableOpacity>

            {/* Delete mode toggle */}
            <TouchableOpacity
              style={[s.headerBtn, isDeleteMode && s.headerBtnDanger]}
              onPress={() => setIsDeleteMode(!isDeleteMode)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={isDeleteMode ? 'close' : 'trash-outline'}
                size={17}
                color={isDeleteMode ? WHITE : BENI}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Search bar (animated reveal) ── */}
        <Animated.View style={[
          s.searchWrap,
          {
            maxHeight: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 52] }),
            opacity: searchAnim,
            marginBottom: searchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 10] }),
          }
        ]}>
          <View style={s.searchBar}>
            <Ionicons name="search-outline" size={16} color={INK_60} />
            <TextInput
              style={s.searchInput}
              placeholder="Search trips..."
              placeholderTextColor={INK_60}
              value={search}
              onChangeText={setSearch}
              selectionColor={BENI}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')}>
                <Ionicons name="close-circle" size={16} color={INK_60} />
              </TouchableOpacity>
            )}
          </View>
        </Animated.View>

        {/* ── Delete mode banner ── */}
        {isDeleteMode && (
          <View style={s.deleteBanner}>
            <Ionicons name="information-circle-outline" size={14} color={BENI} />
            <Text style={s.deleteBannerText}>Tap <Text style={{ fontWeight: '800' }}>✕</Text> on your own trips to remove them</Text>
          </View>
        )}

        {/* ── Trip count ── */}
        {!loading && !error && filteredTrips.length > 0 && (
          <View style={s.countRow}>
            <Text style={s.countText}>
              {filteredTrips.length} {filteredTrips.length === 1 ? 'trip' : 'trips'}
            </Text>
            <View style={s.countLine} />
          </View>
        )}

        {/* ── List ── */}
        {loading ? (
          <TripListSkeleton />
        ) : error ? (
          <View style={s.errorWrap}>
            <Ionicons name="cloud-offline-outline" size={40} color={INK_60} />
            <Text style={s.errorText}>{error}</Text>
          </View>
        ) : (
          <FlatList
            data={filteredTrips}
            keyExtractor={item => item.plan_id.toString()}
            renderItem={renderItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 100 }}
            ListEmptyComponent={<EmptyTripState router={router} />}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={() => fetchTrips(true)}
                colors={[BENI]}
                tintColor={BENI}
              />
            }
          />
        )}
      </View>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WASHI_DARK,
    paddingHorizontal: 16,
    paddingTop: 14,
  },

  // ── Page header ──
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  pageHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageHeaderBar: {
    width: 3,
    height: 18,
    backgroundColor: BENI,
    borderRadius: 2,
  },
  pageHeaderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: SUMI,
    letterSpacing: 0.3,
  },
  pageHeaderKanji: {
    fontSize: 10,
    color: INK_60,
    letterSpacing: 1.5,
    marginTop: 1,
  },
  pageHeaderActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 4,
    backgroundColor: 'rgba(192,57,43,0.08)',
    borderWidth: 0.8,
    borderColor: 'rgba(192,57,43,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerBtnActive: {
    backgroundColor: BENI,
    borderColor: BENI,
  },
  headerBtnDanger: {
    backgroundColor: BENI,
    borderColor: BENI,
  },

  // ── Search ──
  searchWrap: {
    overflow: 'hidden',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WASHI,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: WASHI_DARK,
    paddingHorizontal: 12,
    paddingVertical: 9,
    gap: 8,
    shadowColor: SUMI,
    shadowOpacity: 0.05,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: SUMI,
    padding: 0,
  },

  // ── Delete banner ──
  deleteBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(192,57,43,0.07)',
    borderWidth: 0.8,
    borderColor: 'rgba(192,57,43,0.2)',
    borderRadius: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginBottom: 10,
  },
  deleteBannerText: {
    fontSize: 11,
    color: BENI,
    letterSpacing: 0.2,
  },

  // ── Count row ──
  countRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
    color: INK_60,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  countLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: KINCHA,
    opacity: 0.3,
  },

  // ── Card container ──
  cardWrap: {
    position: 'relative',
    marginBottom: 2,
    paddingTop: 8,      // room for delete badge to sit above card
    paddingRight: 8,    // room for delete badge on the right
  },
  // ── Joined trip overlay ──
  joinedOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    borderRadius: 8,
    overflow: 'hidden',
    justifyContent: 'space-between',
    flexDirection: 'column',
    pointerEvents: 'none',
  },
  joinedScrim: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    // Subtle Kincha tint so it reads as "different" but still shows card content
    backgroundColor: 'rgba(184,150,62,0.06)',
    borderWidth: 1.5,
    borderColor: KINCHA,
    borderRadius: 8,
  },
  joinedBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(28,20,16,0.82)',
    borderWidth: 0.8,
    borderColor: KINCHA,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 4,
  },
  joinedBadgeTitle: {
    color: KINCHA_LIGHT,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  joinedBadgeKanji: {
    color: KINCHA,
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 0.8,
    opacity: 0.8,
  },
  joinedOwnerNote: {
    position: 'absolute',
    bottom: 9,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(28,20,16,0.65)',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 3,
  },
  joinedOwnerNoteText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  deleteBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    zIndex: 10,
  },
  deleteIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: BENI,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: WASHI,
    shadowColor: BENI,
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },

  // ── Error ──
  errorWrap: {
    alignItems: 'center',
    paddingVertical: 60,
    gap: 10,
  },
  errorText: {
    fontSize: 13,
    color: INK_60,
    textAlign: 'center',
  },

  // ── Empty state ──
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 52,
    paddingHorizontal: 24,
  },
  emptyKanji: {
    position: 'absolute',
    top: 20,
    fontSize: 90,
    color: INK_20,
    fontWeight: '900',
    lineHeight: 100,
  },
  emptyIconRing: {
    borderWidth: 2,
    borderColor: BENI,
    borderRadius: 60,
    padding: 5,
    marginBottom: 22,
    shadowColor: BENI,
    shadowOpacity: 0.2,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  emptyIconInner: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: 'rgba(192,57,43,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 21,
    fontWeight: '800',
    color: SUMI,
    marginBottom: 8,
    letterSpacing: 0.3,
  },
  emptySub: {
    fontSize: 13,
    color: INK_60,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  emptyBtnPrimaryWrap: {
    borderRadius: 5,
    shadowColor: BENI,
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  emptyBtnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 5,
  },
  emptyBtnPrimaryText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  emptyBtnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 5,
    borderWidth: 1.5,
    borderColor: BENI,
    backgroundColor: 'rgba(192,57,43,0.05)',
  },
  emptyBtnSecondaryText: {
    color: BENI,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.3,
  },

  // ── Guest screen ──
  guestContainer: {
    flex: 1,
    backgroundColor: WASHI,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  guestCircle1: {
    position: 'absolute',
    top: -50, right: -40,
    width: 200, height: 200,
    borderRadius: 100,
    backgroundColor: SAKURA,
    opacity: 0.3,
  },
  guestCircle2: {
    position: 'absolute',
    bottom: 50, left: -60,
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: WASHI_DARK,
    opacity: 0.8,
  },
  guestCircle3: {
    position: 'absolute',
    bottom: -20, right: 30,
    width: 80, height: 80,
    borderRadius: 40,
    backgroundColor: SAKURA,
    opacity: 0.18,
  },
  guestKanji: {
    position: 'absolute',
    top: 50, left: 20,
    fontSize: 90,
    color: INK_20,
    fontWeight: '900',
    lineHeight: 100,
  },
  guestIconRing: {
    borderWidth: 2,
    borderColor: BENI,
    borderRadius: 70,
    padding: 5,
    marginBottom: 26,
    shadowColor: BENI,
    shadowOpacity: 0.22,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  guestIconInner: {
    width: 108, height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(192,57,43,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: SUMI,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  guestSubtitle: {
    fontSize: 14,
    color: INK_60,
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 22,
  },
  guestBtnWrap: {
    borderRadius: 6,
    shadowColor: BENI,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  guestBtn: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  guestBtnText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});