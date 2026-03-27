import { View, Text, StyleSheet, Image, Pressable, StatusBar, Alert } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import CurrentCard from '@/components/ui/home/CurrentCard';
import InfoCard from '@/components/ui/home/InfoCard';
import PastTripCard, { PastTrip } from '@/components/ui/home/PastTripCard';
import FlightSearch from '@/components/ui/home/FlightSearch';
import AddToTripModal from '@/components/ui/home/AddToTripModal';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '@/api.js';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';

// ─── Client-side preference → place_type map (mirrors backend) ───────────────
const PREF_TYPE_MAP: Record<string, string[]> = {
  relax:       ['spa', 'lodging', 'park'],
  culture:     ['museum', 'art_gallery', 'tourist_attraction'],
  food:        ['restaurant', 'food', 'bar', 'cafe'],
  adventure:   ['amusement_park', 'stadium', 'gym'],
  city:        ['tourist_attraction', 'shopping_mall', 'night_club'],
  nature:      ['park', 'natural_feature', 'campground'],
  temples:     ['place_of_worship', 'tourist_attraction'],
  street_food: ['restaurant', 'food', 'bakery'],
  shopping:    ['shopping_mall', 'store', 'clothing_store'],
  night:       ['night_club', 'bar', 'casino'],
  onsen:       ['spa', 'natural_feature'],
  anime:       ['museum', 'book_store', 'tourist_attraction'],
  photo:       ['tourist_attraction', 'park', 'natural_feature'],
  sakura:      ['park', 'tourist_attraction'],
};


import { BENI, KINCHA, KINCHA_LIGHT, SUMI, WASHI, WASHI_DARK, INK_60, WHITE } from '@/constants/theme';
import WashiDivider from '@/components/ui/WashiDivider';
import PreferenceModal from '@/components/ui/profile/PreferenceModal';
import { STYLE_OPTIONS, INTEREST_OPTIONS, LENGTH_OPTIONS } from '@/constants/preferenceOptions';

interface AttractionData {
  attraction_id: number;
  name: string;
  place_types: string[];
  photo_ref: string;
  rating: number;
  address: string;
  city_name?: string;
  description: string;
  lat?: number | null;
  lng?: number | null;
}

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader = ({
  title,
  onSeeMore,
  onEdit,
}: {
  title: string;
  onSeeMore?: () => void;
  onEdit?: () => void;
}) => (
  <View style={sh.row}>
    <View style={sh.left}>
      <View style={sh.bar} />
      <Text style={sh.title}>{title}</Text>
    </View>
    <View style={sh.right}>
      {onEdit && (
        <TouchableOpacity style={sh.editBtn} onPress={onEdit}>
          <Ionicons name="pencil" size={11} color={BENI} />
          <Text style={sh.moreText}>Edit</Text>
        </TouchableOpacity>
      )}
      {onSeeMore && (
        <TouchableOpacity style={sh.moreBtn} onPress={onSeeMore}>
          <Text style={sh.moreText}>See all</Text>
          <Ionicons name="chevron-forward" size={11} color={BENI} />
        </TouchableOpacity>
      )}
    </View>
  </View>
);

const sh = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 10,
    marginTop: 22,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bar: {
    width: 3,
    height: 18,
    backgroundColor: BENI,
    borderRadius: 2,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    color: SUMI,
    letterSpacing: 0.3,
  },
  kanji: {
    fontSize: 11,
    color: INK_60,
    letterSpacing: 1.5,
    marginTop: 1,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: BENI,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(192,57,43,0.04)',
  },
  moreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: BENI,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    backgroundColor: 'rgba(192,57,43,0.04)',
  },
  moreText: {
    fontSize: 10,
    color: BENI,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});


// ─── Main ─────────────────────────────────────────────────────────────────────
const TRAVEL_STYLE_LABEL: Record<string, string> = {
  relax: 'Relax & Slow',
  culture: 'Culture & Art',
  food: 'Food Explorer',
  adventure: 'Adventure',
  city: 'City Hopping',
  nature: 'Nature & Hiking',
};

const CACHE_KEY = '@home_cache';

export default function Home() {
  const [user, setUser]               = useState<any>(null);
  const [attractions, setAttractions] = useState<AttractionData[]>([]);
  const [restaurants, setRestaurants] = useState<AttractionData[]>([]);
  const [forYou, setForYou]           = useState<AttractionData[]>([]);
  const [travelStyle, setTravelStyle] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [addTarget, setAddTarget]       = useState<{ title: string; imageRef: string; rating?: number; description?: string } | null>(null);
  const [showPrefModal, setShowPrefModal] = useState(false);
  const [prefStyle, setPrefStyle]       = useState<string>('');
  const [prefInterests, setPrefInterests] = useState<string[]>([]);
  const [prefLength, setPrefLength]     = useState<string>('');
  const [savingPref, setSavingPref]     = useState(false);
  const [endedTrips, setEndedTrips]     = useState<PastTrip[]>([]);
  const router = useRouter();
  const { top } = useSafeAreaInsets();

  const fetchAttractions = async (useCache: boolean = true) => {
    // ── Show cached data immediately (stale-while-revalidate) ────────────
    if (useCache) {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (cached) {
        const c = JSON.parse(cached);
        if (c.attractions?.length) setAttractions(c.attractions);
        if (c.restaurants?.length) setRestaurants(c.restaurants);
        if (c.forYou?.length)      setForYou(c.forYou);
        if (c.travelStyle)         setTravelStyle(c.travelStyle);
      }
    } catch { /* ignore cache errors */ }
  }

    // ── Fetch fresh data in background ───────────────────────────────────
    try {
      const token = await AsyncStorage.getItem('access_token');
      const headers = token ? { Authorization: `Bearer ${token}` } : {};

      const [allRes, userRes, prefRes, personalizedRes] = await Promise.allSettled([
        axios.get<AttractionData[]>(`${API_URL}/attractions/`, { headers }),
        token ? axios.get(`${API_URL}/user`, { headers }) : Promise.reject(),
        token ? axios.get(`${API_URL}/user/preferences`, { headers }) : Promise.reject(),
        token ? axios.get<AttractionData[]>(`${API_URL}/attractions/?personalized=true`, { headers }) : Promise.reject(),
      ]);

      const allData: AttractionData[] = allRes.status === 'fulfilled' ? allRes.value.data : [];
      const newAttractions = allData.filter(i => i.place_types.includes('tourist_attraction'));
      const newRestaurants = allData.filter(i => i.place_types.includes('restaurant'));
      setAttractions(newAttractions);
      setRestaurants(newRestaurants);

      if (userRes.status === 'fulfilled') setUser(userRes.value.data);

      let newForYou: AttractionData[] = [];
      let newTravelStyle: string | null = null;

      if (token) {
        if (prefRes.status === 'fulfilled') {
          const p = prefRes.value.data;
          newTravelStyle = p.travel_style ?? null;
          setPrefStyle(p.travel_style ?? '');
          setPrefInterests(p.interests ?? []);
          setPrefLength(p.trip_length ?? '');
          setTravelStyle(newTravelStyle);
          await AsyncStorage.setItem('onboarding_answers', JSON.stringify({
            travel_style: p.travel_style,
            interests: p.interests,
            trip_length: p.trip_length,
          }));
        } else {
          const pref = await AsyncStorage.getItem('onboarding_answers');
          if (pref) {
            const a = JSON.parse(pref);
            newTravelStyle = a.travel_style ?? null;
            setTravelStyle(newTravelStyle);
            setPrefStyle(a.travel_style ?? '');
            setPrefInterests(a.interests ?? []);
            setPrefLength(a.trip_length ?? '');
          }
        }

        if (personalizedRes.status === 'fulfilled') {
          const filtered = (personalizedRes.value.data as AttractionData[]).filter(
            i => !i.place_types.includes('tourist_attraction') &&
                 !i.place_types.includes('restaurant')
          );
          newForYou = filtered.slice(0, 10);
          setForYou(newForYou);
        }
      } else {
        const pref = await AsyncStorage.getItem('onboarding_answers');
        if (pref) {
          const answers = JSON.parse(pref);
          const style: string = answers.travel_style ?? '';
          const interests: string[] = answers.interests ?? [];
          newTravelStyle = style || null;
          setTravelStyle(newTravelStyle);
          setPrefStyle(style);
          setPrefInterests(interests);
          setPrefLength(answers.trip_length ?? '');
          const matchedTypes = new Set<string>();
          for (const key of [style, ...interests]) {
            (PREF_TYPE_MAP[key] ?? []).forEach(t => matchedTypes.add(t));
          }
          if (matchedTypes.size > 0) {
            newForYou = allData
              .filter(i => i.place_types.some(t => matchedTypes.has(t)))
              .filter(i => !i.place_types.includes('tourist_attraction') &&
                           !i.place_types.includes('restaurant'))
              .slice(0, 10);
            setForYou(newForYou);
          }
        }
      }

      // Save fresh data to cache for next launch
      AsyncStorage.setItem(CACHE_KEY, JSON.stringify({
        attractions: newAttractions,
        restaurants: newRestaurants,
        forYou: newForYou,
        travelStyle: newTravelStyle,
      })).catch(() => {});
    } catch (err: any) {
      console.log('Fetch error:', err.response?.data || err.message);
    }
  };

  const handleSavePref = async () => {
    try {
      setSavingPref(true);
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/user/preferences`,
        { travel_style: prefStyle, interests: prefInterests, trip_length: prefLength },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await AsyncStorage.setItem('onboarding_answers', JSON.stringify({
        travel_style: prefStyle, interests: prefInterests, trip_length: prefLength,
      }));
      setTravelStyle(prefStyle);
      setShowPrefModal(false);
      fetchAttractions(false);
    } catch {
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setSavingPref(false);
    }
  };

  const fetchEndedTrips = async () => {
    try {
      const res = await axios.get(`${API_URL}/trip_plan/ended`);
      const data = Array.isArray(res.data) ? res.data : [];
      console.log('[TripGuides] ended trips:', data.length);
      setEndedTrips(data);
    } catch (e: any) {
      console.warn('[TripGuides] fetch failed:', e?.response?.data || e?.message);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchAttractions();
      fetchEndedTrips();
    }, [])
  );

  const fullname = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Guest';

  return (
    <>
      <ParallaxScrollView
        headerBackgroundColor={{ light: SUMI, dark: SUMI }}
        headerHeight={ 340}
        headerImage={
          <View style={s.imageWrapper}>
            <Image
              source={require('@/assets/images/home/fuji-view.jpg')}
              style={s.imageView}
            />
            {/* Dark gradient overlay */}
            <View style={s.imageOverlay} />

            {/* Beni top accent bar */}
            <View style={s.imageBeniBar} />

            <View style={[s.overlayContent, { paddingTop: top + 14 }]}>
              {/* Welcome text */}
              <View style={s.welcomeRow}>
                <View style={s.welcomeBar} />
                <View>
                  <Text style={s.welcomeLabel}>Welcome back</Text>
                  <Text style={s.welcomeName}>{fullname}</Text>
                </View>
              </View>

              {/* Flight button */}
              <Pressable style={s.flightBtn} onPress={() => setModalVisible(true)}>
                <Ionicons name="airplane" size={18} color={KINCHA_LIGHT} />
              </Pressable>

                <CurrentCard />
            </View>
          </View>
        }
      >
        {/* ── Body ── */}
        <View style={s.body}>

          {/* ── For You section (logged-in + has preference) ── */}
          {forYou.length > 0 && (
            <>
              <SectionHeader
                title={travelStyle ? `For You · ${TRAVEL_STYLE_LABEL[travelStyle] ?? travelStyle}` : 'For You'}
                onEdit={() => setShowPrefModal(true)}
                onSeeMore={() => router.push('/search')}
              />
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.hScroll}
              >
                {forYou.map((item, i) => (
                  <InfoCard
                    key={item.attraction_id}
                    title={item.name}
                    imageRef={item.photo_ref}
                    rating={item.rating}
                    description={item.description}
                    address={item.address}
                    city={item.city_name}
                    index={i}
                    lat={item.lat}
                    lng={item.lng}
                    onAddToTrip={setAddTarget}
                  />
                ))}
                <SeeMoreCard onPress={() => router.push('/search')} />
              </ScrollView>
              <WashiDivider />
            </>
          )}

          {/* ── Attraction section ── */}
          <SectionHeader
            title="Attractions"
            onSeeMore={() => router.push('/search')}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.hScroll}
          >
            {attractions.map((item, i) => (
              <InfoCard
                key={item.attraction_id}
                title={item.name}
                imageRef={item.photo_ref}
                rating={item.rating}
                description={item.description}
                address={item.address}
                city={item.city_name}
                index={i}
                onAddToTrip={setAddTarget}
              />
            ))}
            <SeeMoreCard onPress={() => router.push('/search')} />
          </ScrollView>

          <WashiDivider />

          {/* ── Restaurant section ── */}
          <SectionHeader
            title="Restaurants"
            onSeeMore={() => router.push('/search')}
          />

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.hScroll}
          >
            {restaurants.map((item, i) => (
              <InfoCard
                key={item.attraction_id}
                title={item.name}
                imageRef={item.photo_ref}
                rating={item.rating}
                description={item.description}
                address={item.address}
                city={item.city_name}
                index={i}
                onAddToTrip={setAddTarget}
              />
            ))}
            <SeeMoreCard onPress={() => router.push('/search')} />
          </ScrollView>

          <WashiDivider />

          {/* ── Trip Guides ── */}
          <SectionHeader title="Trip Guides" />
          {endedTrips.length === 0 ? (
            <View style={s.guidesEmpty}>
              <Ionicons name="map-outline" size={28} color={INK_60} style={{ opacity: 0.4 }} />
              <Text style={s.guidesEmptyText}>No completed trips yet</Text>
            </View>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.hScroll}
            >
              {endedTrips.map((trip, i) => (
                <PastTripCard key={trip.plan_id} trip={trip} index={i} />
              ))}
            </ScrollView>
          )}
          <View style={{ height: 32 }} />
        </View>

        <FlightSearch visible={modalVisible} onClose={() => setModalVisible(false)} />

        {/* ── Preference edit modal ── */}
        <PreferenceModal
          visible={showPrefModal}
          onClose={() => setShowPrefModal(false)}
          prefStyle={prefStyle}
          setPrefStyle={setPrefStyle}
          prefInterests={prefInterests}
          setPrefInterests={setPrefInterests}
          prefLength={prefLength}
          setPrefLength={setPrefLength}
          onSave={handleSavePref}
          saving={savingPref}
        />

        {/* ── Add to Trip modal ── */}
        <AddToTripModal
          visible={addTarget !== null}
          attraction={addTarget}
          onClose={() => setAddTarget(null)}
        />
      </ParallaxScrollView>
    </>
  );
}

// ─── See More card ────────────────────────────────────────────────────────────
const SeeMoreCard = ({ onPress }: { onPress: () => void }) => (
  <TouchableOpacity style={sm.card} onPress={onPress} activeOpacity={0.78}>
    <View style={sm.iconRing}>
      <Ionicons name="compass-outline" size={26} color={BENI} />
    </View>
    <Text style={sm.text}>See All</Text>
    <Text style={sm.kanji}>もっと</Text>
  </TouchableOpacity>
);

const sm = StyleSheet.create({
  card: {
    width: 100,
    height: 240,
    backgroundColor: WASHI,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: WASHI_DARK,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginRight: 4,
    shadowColor: SUMI,
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
    borderColor: BENI,
    backgroundColor: 'rgba(192,57,43,0.05)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 12,
    fontWeight: '700',
    color: BENI,
    letterSpacing: 0.3,
  },
  kanji: {
    fontSize: 10,
    color: INK_60,
    letterSpacing: 1,
  },
});


// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  imageWrapper: {
    position: 'relative',
    width: '100%',
    height: '100%',
    overflow: 'hidden',
    backgroundColor: SUMI,
  },
  imageView: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  imageOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(28,20,16,0.48)',
  },
  imageBeniBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: BENI,
  },
  overlayContent: {
    position: 'absolute',
    inset: 0,
    paddingHorizontal: 18,
    justifyContent: 'flex-start',
  },
  welcomeRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 6,
  },
  welcomeBar: {
    width: 3,
    height: 36,
    backgroundColor: BENI,
    borderRadius: 2,
    marginTop: 2,
  },
  welcomeLabel: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.55)',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  welcomeName: {
    fontSize: 22,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  flightBtn: {
    position: 'absolute',
    top: 14,
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(28,20,16,0.5)',
    borderWidth: 1,
    borderColor: KINCHA,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  body: {
    backgroundColor: WASHI_DARK,
    paddingBottom: 32,
  },
  guidesEmpty: {
    alignItems: 'center' as const,
    paddingVertical: 24,
    gap: 8,
  },
  guidesEmptyText: {
    fontSize: 13,
    color: INK_60,
    opacity: 0.6,
  },
  hScroll: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 10,
    alignItems: 'flex-start',
  },
});