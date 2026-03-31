import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Pressable, Image, Animated, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { API_URL, GOOGLE_API_KEY } from '@/api.js';

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

interface InfoCardProps {
  title: string;
  imageRef: string;
  rating?: number;
  description?: string;
  address?: string;
  city?: string;
  index?: number;
  lat?: number | null;
  lng?: number | null;
  onAddToTrip?: (data: { title: string; imageRef: string; rating?: number; description?: string; lat?: number | null; lng?: number | null }) => void;
}

const CARD_W = 170;
const CARD_H = 240;
const IMG_H  = 115;
const INFO_H = CARD_H - IMG_H; // 105

export default function InfoCard({ title, imageRef, rating, description, address, city, index = 0, lat, lng, onAddToTrip }: InfoCardProps) {
  const [imgError,  setImgError]  = useState(false);
  const [showDesc,  setShowDesc]  = useState(false);

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(20)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 400, delay: index * 70, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 340, delay: index * 70, useNativeDriver: true }),
    ]).start();
  }, []);

  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.96, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start();

  // ── Resolve image URL ──────────────────────────────────────────────────────
  const fallbackUrl = `https://picsum.photos/seed/${encodeURIComponent(title || String(index))}/300/200`;
  let imageUrl: string;
  if (imageRef?.startsWith('/static')) {
    imageUrl = `${API_URL}${imageRef}`;
  } else if (imageRef?.startsWith('http')) {
    imageUrl = imageRef;
  } else if (imageRef && GOOGLE_API_KEY) {
    imageUrl = `https://places.googleapis.com/v1/${imageRef}/media?maxHeightPx=400&maxWidthPx=400&key=${GOOGLE_API_KEY}`;
  } else {
    imageUrl = fallbackUrl;
  }

  const safeDesc  = description || 'No description available.';

  const fullStars = rating ? Math.floor(rating) : 0;
  const hasHalf   = rating ? rating % 1 >= 0.5 : false;

  return (
    <Animated.View style={[s.card, { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] }]}>
      <TouchableOpacity
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        onPress={() => setShowDesc(true)}
        activeOpacity={1}
      >
        {/* ── Image ── */}
        <View style={s.imgWrap}>
          <Image
            source={{ uri: imgError ? fallbackUrl : imageUrl }}
            style={s.image}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
          <View style={s.scrim} />

          {/* Rating badge */}
          {rating != null && (
            <View style={s.ratingBadge}>
              <Ionicons name="star" size={9} color={KINCHA_LIGHT} />
              <Text style={s.ratingBadgeText}>{rating.toFixed(1)}</Text>
            </View>
          )}

          {/* Index badge */}
          <View style={s.indexBadge}>
            <Text style={s.indexText}>{String(index + 1).padStart(2, '0')}</Text>
          </View>
        </View>

        {/* ── Info ── */}
        <View style={s.info}>
          <View style={s.stripe} />
          <View style={s.infoContent}>
            <View style={s.topSection}>
              <Text style={s.title} numberOfLines={1}>{title || 'Unknown Place'}</Text>

              {/* Star row */}
              {rating != null && (
                <View style={s.starRow}>
                  {[1, 2, 3, 4, 5].map(n => {
                    const filled = n <= fullStars;
                    const half   = !filled && n === fullStars + 1 && hasHalf;
                    return (
                      <Ionicons
                        key={n}
                        name={filled ? 'star' : half ? 'star-half' : 'star-outline'}
                        size={10}
                        color={filled || half ? KINCHA_LIGHT : INK_20}
                      />
                    );
                  })}
                </View>
              )}

              {/* desc — fixed height, always 2 lines */}
              <Text style={s.desc} numberOfLines={2}>{safeDesc}</Text>
            </View>

            {/* Read more — always at bottom */}
            <TouchableOpacity onPress={() => setShowDesc(true)} hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}>
              <Text style={s.readMore}>Read more ›</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Description modal ── */}
      <Modal visible={showDesc} transparent animationType="fade" onRequestClose={() => setShowDesc(false)}>
        <Pressable style={d.overlay} onPress={() => setShowDesc(false)}>
          <Pressable style={d.card} onPress={e => e.stopPropagation()}>
            <View style={d.topBar} />
            {/* Image thumbnail */}
            <Image
              source={{ uri: imgError ? fallbackUrl : imageUrl }}
              style={d.thumb}
              resizeMode="cover"
              onError={() => setImgError(true)}
            />
            <View style={d.body}>
              {/* Fixed header — title + stars + divider */}
              <Text style={d.title}>{title || 'Unknown Place'}</Text>
              {rating != null && (
                <View style={d.starRow}>
                  {[1,2,3,4,5].map(n => {
                    const filled = n <= fullStars;
                    const half   = !filled && n === fullStars + 1 && hasHalf;
                    return (
                      <Ionicons key={n} name={filled ? 'star' : half ? 'star-half' : 'star-outline'} size={12} color={filled || half ? KINCHA_LIGHT : INK_20} />
                    );
                  })}
                  <Text style={d.ratingVal}>{rating?.toFixed(1)}</Text>
                </View>
              )}
              <View style={d.divRow}>
                <View style={d.divLine} />
                <Text style={d.divDot}>✦</Text>
                <View style={d.divLine} />
              </View>

              {/* Scrollable content — address + description */}
              <ScrollView
                showsVerticalScrollIndicator={false}
                style={d.scrollArea}
                contentContainerStyle={d.scrollContent}
              >
                {(city || address) && (
                  <View style={d.locationWrap}>
                    {city && (
                      <View style={d.locationRow}>
                        <Ionicons name="business-outline" size={12} color={KINCHA} />
                        <Text style={d.locationCity}>{city}</Text>
                      </View>
                    )}
                    {address && (
                      <View style={d.locationRow}>
                        <Ionicons name="location-outline" size={12} color={INK_60} />
                        <Text style={d.locationAddr}>{address}</Text>
                      </View>
                    )}
                  </View>
                )}
                <Text style={d.desc}>{safeDesc}</Text>
              </ScrollView>

              {/* Fixed footer — Add to Trip button */}
              {onAddToTrip && (
                <TouchableOpacity
                  style={d.addBtn}
                  activeOpacity={0.85}
                  onPress={() => {
                    setShowDesc(false);
                    onAddToTrip({ title, imageRef, rating, description, lat, lng });
                  }}
                >
                  <Ionicons name="add-circle-outline" size={16} color={WASHI} />
                  <Text style={d.addBtnTxt}>Add to Trip</Text>
                </TouchableOpacity>
              )}
            </View>
            <TouchableOpacity style={d.closeBtn} onPress={() => setShowDesc(false)} activeOpacity={0.85}>
              <Ionicons name="close" size={14} color={WASHI} />
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </Animated.View>
  );
}

const s = StyleSheet.create({
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
  image: { width: '100%', height: '100%' },
  scrim: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 36,
    backgroundColor: 'rgba(28,20,16,0.25)',
  },
  ratingBadge: {
    position: 'absolute',
    top: 6, right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(28,20,16,0.75)',
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 3,
    borderWidth: 0.5,
    borderColor: KINCHA,
  },
  ratingBadgeText: {
    fontSize: 9,
    color: KINCHA_LIGHT,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  indexBadge: {
    position: 'absolute',
    bottom: 6, left: 6,
    backgroundColor: BENI,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 2,
  },
  indexText: {
    fontSize: 9,
    color: WHITE,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  info: {
    flexDirection: 'row',
    padding: 10,
    height: INFO_H,        // ← fixed height ไม่ขยาย
    overflow: 'hidden',    // ← ตัด content ที่ล้น
  },
  stripe: {
    width: 2,
    backgroundColor: BENI,
    borderRadius: 1,
    marginRight: 8,
    alignSelf: 'stretch',
  },
  infoContent: { flex: 1, justifyContent: 'space-between' },
  topSection: { gap: 3 },
  title: {
    fontSize: 12,
    fontFamily: 'NotoSansJP_700Bold',
    color: SUMI,
    letterSpacing: 0.1,
  },
  starRow: {
    flexDirection: 'row',
    gap: 1,
    alignItems: 'center',
  },
  desc: {
    fontSize: 10,
    fontFamily: 'NotoSansJP_400Regular',
    color: INK_60,
    lineHeight: 15,
    height: 30,
    overflow: 'hidden',
  },
  readMore: {
    fontSize: 9,
    color: BENI,
    fontFamily: 'NotoSansJP_700Bold',
    letterSpacing: 0.3,
  },
});

// ─── Description modal styles ─────────────────────────────────────────────────
const d = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28,20,16,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    width: '100%', maxWidth: 340,
    maxHeight: '80%',
    backgroundColor: WASHI,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: SUMI,
    shadowOpacity: 0.2,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  topBar: { height: 3, backgroundColor: BENI },
  thumb: { width: '100%', height: 140, backgroundColor: WASHI_DARK },
  body: { padding: 16 },
  scrollArea: { maxHeight: 200 },
  scrollContent: { paddingBottom: 4 },
  title: {
    fontSize: 15,
    fontFamily: 'ShipporiMincho_700Bold',
    color: SUMI,
    marginBottom: 6,
  },
  starRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginBottom: 10,
  },
  ratingVal: {
    fontSize: 11,
    fontFamily: 'NotoSansJP_700Bold',
    color: KINCHA_LIGHT,
    marginLeft: 4,
  },
  divRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  divLine: { flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.3 },
  divDot: { fontSize: 7, color: KINCHA, marginHorizontal: 7, opacity: 0.45 },
  desc: {
    fontSize: 13,
    fontFamily: 'NotoSansJP_400Regular',
    color: INK_60,
    lineHeight: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 10, right: 10,
    width: 26, height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(28,20,16,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: BENI,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 14,
  },
  addBtnTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: WASHI,
    letterSpacing: 0.3,
  },
  locationWrap: {
    gap: 5,
    marginBottom: 12,
    backgroundColor: WASHI_DARK,
    borderRadius: 8,
    padding: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
  },
  locationCity: {
    fontSize: 12,
    fontWeight: '700',
    color: KINCHA,
    flex: 1,
  },
  locationAddr: {
    fontSize: 11,
    color: INK_60,
    flex: 1,
    lineHeight: 16,
  },
});