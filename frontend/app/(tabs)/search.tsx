import React, { useEffect, useState, useRef } from 'react';
import {
  View, Text, ScrollView, TextInput, StyleSheet,
  SafeAreaView, TouchableOpacity, Image, Animated,
  Platform, StatusBar,
} from 'react-native';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import SearchCard from '../../components/ui/search/searchCard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/api.js';

// ─── Japanese Palette ─────────────────────────────────────────────────────────
const BENI         = '#C0392B';
const BENI_LIGHT   = '#E74C3C';
const KINCHA       = '#B8963E';
const KINCHA_LIGHT = '#D4AF55';
const SUMI         = '#1C1410';
const SAKURA       = '#F2C9D0';
const WASHI        = '#FAF5EC';
const WASHI_DARK   = '#EDE5D8';
const INK_60       = 'rgba(28,20,16,0.6)';
const INK_20       = 'rgba(28,20,16,0.12)';
const WHITE        = '#FFFFFF';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Attraction {
  attraction_id: number;
  name: string;
  photo_ref: string | null;
  rating: number | null;
  description: string | null;
  local_image_path?: string | null;
}

interface City {
  city_id: number;
  name: string;
  attractions: Attraction[];
}

// ─── Kanji mapping for well-known Japanese cities ─────────────────────────────
const CITY_KANJI: Record<string, string> = {
  'Tokyo':    '東京', 'Kyoto':    '京都', 'Osaka':  '大阪',
  'Sapporo':  '札幌', 'Fukuoka':  '福岡', 'Nara':   '奈良',
  'Hiroshima':'広島', 'Yokohama': '横浜', 'Nagoya': '名古屋',
  'Okinawa':  '沖縄',
};

// ─── Gold divider (shared pattern) ───────────────────────────────────────────
const WashiDivider = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 8 }}>
    <View style={{ flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.35 }} />
    <Text style={{ fontSize: 8, color: KINCHA, marginHorizontal: 7, opacity: 0.5 }}>✦</Text>
    <View style={{ flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.35 }} />
  </View>
);

// ─── City section ─────────────────────────────────────────────────────────────
const CitySection = ({ city, sectionIndex }: { city: City; sectionIndex: number }) => {
  const kanji   = CITY_KANJI[city.name] ?? '';
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1, duration: 500, delay: sectionIndex * 100, useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[sec.container, { opacity: fadeAnim }]}>
      {/* Section header */}
      <View style={sec.headerRow}>
        <View style={sec.headerLeft}>
          <View style={sec.bar} />
          <Text style={sec.cityName}>{city.name}</Text>
          {kanji ? <Text style={sec.kanji}>{kanji}</Text> : null}
        </View>
        <View style={sec.countBadge}>
          <Text style={sec.countText}>{city.attractions.length}</Text>
        </View>
      </View>

      {/* Horizontal scroll */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 6 }}
      >
        {city.attractions.map((attr, i) => (
          <SearchCard
            key={attr.attraction_id}
            title={attr.name}
            photo_ref={attr.photo_ref}
            rating={attr.rating}
            index={i}
            onPress={() => console.log('Tapped: \n Photo_ref:', attr.photo_ref, '\n Name:', attr.name)}
            style={{ marginRight: 12 }}
          />
        ))}
      </ScrollView>

      <WashiDivider />
    </Animated.View>
  );
};

const sec = StyleSheet.create({
  container: {
    marginBottom: 6,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    marginBottom: 6,
  },
  headerLeft: {
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
  cityName: {
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
  countBadge: {
    backgroundColor: BENI,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  countText: {
    fontSize: 10,
    fontWeight: '800',
    color: WHITE,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function ExploreScreen() {
  const navigation  = useNavigation();
  const [cityData, setCityData]     = useState<City[]>([]);
  const [searchText, setSearchText] = useState('');
  const [loading, setLoading]       = useState(true);

  // Header animations
  const headerFade  = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-10)).current;
  const searchFocus = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
    fetchExploreData();
  }, []);

  const fetchExploreData = async () => {
    try {
      const res = await axios.get(`${API_URL}/explore-cities`);
      setCityData(res.data);
    } catch (err) {
      console.log('Error fetching explore data:', err);
    } finally {
      setLoading(false);
    }
  };

  const onSearchFocus = () =>
    Animated.timing(searchFocus, { toValue: 1, duration: 200, useNativeDriver: false }).start();
  const onSearchBlur  = () =>
    Animated.timing(searchFocus, { toValue: 0, duration: 200, useNativeDriver: false }).start();

  // Filter logic (unchanged)
  const filteredData = cityData.reduce((acc: City[], city) => {
    const lower = searchText.toLowerCase();
    const isCityMatch = city.name.toLowerCase().includes(lower);
    const matchingAttractions = city.attractions.filter(a =>
      a.name.toLowerCase().includes(lower)
    );
    const attractionsToShow = isCityMatch ? city.attractions : matchingAttractions;
    if (attractionsToShow.length > 0) acc.push({ ...city, attractions: attractionsToShow });
    return acc;
  }, []);

  const searchBorderColor = searchFocus.interpolate({
    inputRange: [0, 1],
    outputRange: [WASHI_DARK, BENI],
  });

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar barStyle="light-content" backgroundColor={SUMI} />

      {/* ── Dark header banner ── */}
      <View style={s.header}>
        <View style={s.headerTopBar} />

        <Animated.View style={[s.headerInner, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}>
          {/* Title + kanji */}
          <View style={s.headerTitleRow}>
            <View style={s.headerLeft}>
              <View style={s.headerBar} />
              <Text style={s.headerTitle}>Explore</Text>
              <Text style={s.headerKanji}>探索</Text>
            </View>
            {/* Sakura petal decorations */}
            <Text style={s.petal1}>🌸</Text>
            <Text style={s.petal2}>🌸</Text>
          </View>

          {/* Search bar */}
          <Animated.View style={[s.searchBox, { borderColor: searchBorderColor }]}>
            <Ionicons name="search-outline" size={17} color={INK_60} />
            <TextInput
              placeholder="Search destination or attraction..."
              placeholderTextColor={INK_60}
              style={s.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              selectionColor={BENI}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')}>
                <Ionicons name="close-circle" size={16} color={INK_60} />
              </TouchableOpacity>
            )}
          </Animated.View>

          {/* Active search indicator */}
          {searchText.length > 0 && (
            <View style={s.searchMeta}>
              <Ionicons name="filter-outline" size={11} color={KINCHA} />
              <Text style={s.searchMetaText}>
                {filteredData.reduce((n, c) => n + c.attractions.length, 0)} results for "{searchText}"
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Kincha ✦ divider */}
        <View style={s.headerDivider}>
          <View style={s.dividerLine} />
          <Text style={s.dividerDot}>✦</Text>
          <View style={s.dividerLine} />
        </View>
      </View>

      {/* ── Body ── */}
      <ScrollView
        style={s.body}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: 14, paddingBottom: 100 }}
      >
        {loading ? (
          /* Loading skeleton */
          <View style={s.loadingWrap}>
            {[0, 1, 2].map(i => (
              <View key={i} style={s.skeletonSection}>
                <View style={s.skeletonHeader} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 18, gap: 12 }}>
                  {[0, 1, 2].map(j => (
                    <View key={j} style={s.skeletonCard} />
                  ))}
                </ScrollView>
              </View>
            ))}
          </View>
        ) : filteredData.length > 0 ? (
          filteredData.map((city, i) => (
            <CitySection key={city.city_id} city={city} sectionIndex={i} />
          ))
        ) : (
          /* Empty state */
          <View style={s.emptyWrap}>
            <Text style={s.emptyKanji}>空</Text>
            <View style={s.emptyIconRing}>
              <Ionicons name="search" size={34} color={BENI} />
            </View>
            <Text style={s.emptyTitle}>No Results Found</Text>
            <Text style={s.emptySub}>
              Try a different keyword or explore{'\n'}a nearby city
            </Text>
            <TouchableOpacity style={s.emptyClear} onPress={() => setSearchText('')}>
              <Ionicons name="refresh-outline" size={14} color={BENI} />
              <Text style={s.emptyClearText}>Clear Search</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: SUMI,
  },

  // ── Header ──
  header: {
    backgroundColor: SUMI,
    paddingBottom: 0,
    position: 'relative',
    overflow: 'hidden',
  },
  headerTopBar: {
    height: 3,
    backgroundColor: BENI,
  },
  headerInner: {
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    position: 'relative',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerBar: {
    width: 3,
    height: 20,
    backgroundColor: BENI,
    borderRadius: 2,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 0.5,
  },
  headerKanji: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: 2,
    marginTop: 2,
  },
  petal1: {
    position: 'absolute',
    right: 10,
    top: -4,
    fontSize: 22,
    opacity: 0.18,
  },
  petal2: {
    position: 'absolute',
    right: 36,
    top: 8,
    fontSize: 13,
    opacity: 0.12,
  },

  // Search
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WASHI,
    borderRadius: 6,
    borderWidth: 1.2,
    paddingHorizontal: 13,
    paddingVertical: 10,
    gap: 9,
    shadowColor: SUMI,
    shadowOpacity: 0.1,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: SUMI,
    padding: 0,
  },
  searchMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 8,
  },
  searchMetaText: {
    fontSize: 10,
    color: KINCHA,
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  // Header divider
  headerDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 8,
    paddingTop: 4,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: KINCHA,
    opacity: 0.3,
  },
  dividerDot: {
    fontSize: 7,
    color: KINCHA,
    marginHorizontal: 7,
    opacity: 0.45,
  },

  // ── Body ──
  body: {
    flex: 1,
    backgroundColor: WASHI_DARK,
  },

  // Skeleton loader
  loadingWrap: {
    gap: 24,
    paddingHorizontal: 18,
  },
  skeletonSection: {
    gap: 10,
  },
  skeletonHeader: {
    width: 140,
    height: 18,
    borderRadius: 4,
    backgroundColor: WASHI_DARK,
    marginLeft: 18,
  },
  skeletonCard: {
    width: 160,
    height: 160,
    borderRadius: 8,
    backgroundColor: WASHI_DARK,
  },

  // ── Empty state ──
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 70,
    paddingHorizontal: 32,
    position: 'relative',
  },
  emptyKanji: {
    position: 'absolute',
    top: 20,
    fontSize: 100,
    color: INK_20,
    fontWeight: '900',
    lineHeight: 110,
  },
  emptyIconRing: {
    borderWidth: 2,
    borderColor: BENI,
    borderRadius: 55,
    padding: 5,
    marginBottom: 20,
    shadowColor: BENI,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
    backgroundColor: 'rgba(192,57,43,0.05)',
    width: 80,
    height: 80,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontSize: 18,
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
    marginBottom: 22,
  },
  emptyClear: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: BENI,
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 5,
    backgroundColor: 'rgba(192,57,43,0.05)',
  },
  emptyClearText: {
    fontSize: 13,
    color: BENI,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});