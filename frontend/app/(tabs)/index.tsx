import { View, Text, StyleSheet, Image, Pressable, StatusBar } from 'react-native';
import ParallaxScrollView from '@/components/ParallaxScrollView';
import CurrentCard from '@/components/ui/home/CurrentCard';
import InfoCard from '@/components/ui/home/InfoCard';
import FlightSearch from '@/components/ui/home/FlightSearch';
import React, { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { useFocusEffect } from '@react-navigation/native';
import { API_URL } from '@/api.js';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { ScrollView, TouchableOpacity } from 'react-native-gesture-handler';

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

interface AttractionData {
  attraction_id: number;
  name: string;
  place_types: string[];
  photo_ref: string;
  rating: number;
  address: string;
  description: string;
}

// ─── Section header ───────────────────────────────────────────────────────────
const SectionHeader = ({
  title,
  kanji,
  onSeeMore,
}: {
  title: string;
  kanji: string;
  onSeeMore?: () => void;
}) => (
  <View style={sh.row}>
    <View style={sh.left}>
      <View style={sh.bar} />
      <Text style={sh.title}>{title}</Text>
      <Text style={sh.kanji}>{kanji}</Text>
    </View>
    {onSeeMore && (
      <TouchableOpacity style={sh.moreBtn} onPress={onSeeMore}>
        <Text style={sh.moreText}>See all</Text>
        <Ionicons name="chevron-forward" size={11} color={BENI} />
      </TouchableOpacity>
    )}
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

// ─── Kincha divider ───────────────────────────────────────────────────────────
const WashiDivider = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginHorizontal: 18, marginVertical: 4 }}>
    <View style={{ flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.3 }} />
    <Text style={{ fontSize: 7, color: KINCHA, marginHorizontal: 7, opacity: 0.45 }}>✦</Text>
    <View style={{ flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.3 }} />
  </View>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function Home() {
  const [user, setUser]               = useState<any>(null);
  const [attractions, setAttractions] = useState<AttractionData[]>([]);
  const [restaurants, setRestaurants] = useState<AttractionData[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const router = useRouter();

  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;
      const res = await axios.get(`${API_URL}/user`, { headers: { Authorization: `Bearer ${token}` } });
      setUser(res.data);
    } catch (err: any) {
      console.log('Fetch user error:', err.response?.data || err.message);
    }
  };

  const fetchAttractions = async () => {
    try {
      const res = await axios.get<AttractionData[]>(`${API_URL}/attractions/`);
      setAttractions(res.data.filter(i => i.place_types.includes('tourist_attraction')));
      setRestaurants(res.data.filter(i => i.place_types.includes('restaurant')));
    } catch (err: any) {
      console.log('Fetch attractions error:', err.response?.data || err.message);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      fetchProfile();
      fetchAttractions();
    }, [])
  );

  const fullname = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : 'Guest';

  return (
    <>
      <ParallaxScrollView
        headerBackgroundColor={{ light: SUMI, dark: SUMI }}
        headerHeight={300}
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

            <View style={s.overlayContent}>
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
        {/* ── Attraction section ── */}
        <View style={s.body}>
          <SectionHeader
            title="Attractions"
            kanji="観光地"
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
                index={i}
              />
            ))}
            <SeeMoreCard onPress={() => router.push('/search')} />
          </ScrollView>

          <WashiDivider />

          {/* ── Restaurant section ── */}
          <SectionHeader
            title="Restaurants"
            kanji="食事処"
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
                index={i}
              />
            ))}
            <SeeMoreCard onPress={() => router.push('/search')} />
          </ScrollView>

          <WashiDivider />

          {/* ── Guide section placeholder ── */}
          <SectionHeader title="Trip Guides" kanji="ガイド" />
          <View style={{ height: 40 }} />
        </View>

        <FlightSearch visible={modalVisible} onClose={() => setModalVisible(false)} />
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
    height: 300,
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
    paddingTop: 14,
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
  },
  body: {
    backgroundColor: WASHI_DARK,
    paddingBottom: 32,
  },
  hScroll: {
    paddingHorizontal: 18,
    paddingBottom: 8,
    gap: 10,
    alignItems: 'flex-start',
  },
});