import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
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

interface SearchCardProps {
  title: string;
  photo_ref: string | null;
  rating?: number | null;
  onPress?: () => void;
  onAddToTrip?: () => void;
  index?: number;
  style?: object;
}

export default function SearchCard({
  title,
  photo_ref,
  rating,
  onPress,
  onAddToTrip,
  index = 0,
  style,
}: SearchCardProps) {

  // ── Resolve image URL ────────────────────────────────────────────────────
  // photo_ref จาก Google Places API มักเป็น string เช่น "places/ChIJ..."
  // ซึ่งไม่ได้ขึ้นต้นด้วย http และไม่ใช่ /static → ต้องใช้ picsum เป็น fallback
  const fallbackUrl = `https://picsum.photos/seed/${encodeURIComponent(title || String(index))}/300/200`;

   let imageUrl: string;
  if (photo_ref?.startsWith('/static')) {
    // Local server image
    imageUrl = `${API_URL}${photo_ref}`;
  } else if (photo_ref?.startsWith('http')) {
    // Already a full URL
    imageUrl = photo_ref;
  } else if (photo_ref && GOOGLE_API_KEY) {
    // Google Places New API format: "places/ChIJ.../photos/AZLas..."
    // Key อาจจะหมดอายุ ต้องไปดูอีกที
    imageUrl = `https://places.googleapis.com/v1/${photo_ref}/media?maxHeightPx=400&maxWidthPx=400&key=${GOOGLE_API_KEY}`;
  } else {
    // imageUrl = `https://places.googleapis.com/v1/${photo_ref}/media?maxHeightPx=400&maxWidthPx=400&key=${GOOGLE_API_KEY}`;
    imageUrl = fallbackUrl;
  }

  const [imgError, setImgError] = useState(false);
  const resolvedUrl = imgError ? fallbackUrl : imageUrl;

  const fadeAnim  = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 380, delay: index * 55, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 320, delay: index * 55, useNativeDriver: true }),
    ]).start();
  }, []);

  const onPressIn  = () => Animated.spring(scaleAnim, { toValue: 0.95, useNativeDriver: true }).start();
  const onPressOut = () => Animated.spring(scaleAnim, { toValue: 1,    useNativeDriver: true }).start();

  const fullStars = rating ? Math.floor(rating) : 0;
  const hasHalf   = rating ? rating % 1 >= 0.5 : false;

  return (
    <Animated.View
      style={[
        s.card,
        style,
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }, { scale: scaleAnim }] },
      ]}
    >
      <TouchableOpacity onPress={onAddToTrip ?? onPress} onPressIn={onPressIn} onPressOut={onPressOut} activeOpacity={1}>

        {/* Image zone */}
        <View style={s.imgWrap}>
          <Image
            source={{ uri: resolvedUrl }}
            style={s.image}
            resizeMode="cover"
            onError={() => setImgError(true)}
          />
          <View style={s.scrim} />

          {rating != null && (
            <View style={s.ratingBadge}>
              <Ionicons name="star" size={9} color={KINCHA_LIGHT} />
              <Text style={s.ratingBadgeText}>{rating.toFixed(1)}</Text>
            </View>
          )}

          <View style={s.indexBadge}>
            <Text style={s.indexText}>{String(index + 1).padStart(2, '0')}</Text>
          </View>
        </View>

        {/* Info zone */}
        <View style={s.info}>
          <View style={s.stripe} />
          <View style={s.infoContent}>
            <Text style={s.title} numberOfLines={2}>{title || 'Unknown Place'}</Text>
            {rating != null ? (
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
            ) : (
              <Text style={s.noRating}>No rating</Text>
            )}
          </View>
        </View>

      </TouchableOpacity>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  card: {
    width: 160,
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
  },
  imgWrap: {
    width: '100%',
    height: 110,
    backgroundColor: WASHI_DARK,
    position: 'relative',
  },
  image: { width: '100%', height: '100%' },
  scrim: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: 36,
    backgroundColor: 'rgba(28,20,16,0.28)',
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
    padding: 9,
  },
  stripe: {
    width: 2,
    backgroundColor: BENI,
    borderRadius: 1,
    marginRight: 7,
    alignSelf: 'stretch',
  },
  infoContent: { flex: 1, gap: 4 },
  title: {
    fontSize: 12,
    fontWeight: '700',
    color: SUMI,
    letterSpacing: 0.1,
    lineHeight: 16,
  },
  starRow: {
    flexDirection: 'row',
    gap: 1,
    alignItems: 'center',
  },
  noRating: {
    fontSize: 10,
    color: INK_60,
    fontStyle: 'italic',
  },
});