import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  ActivityIndicator, Dimensions, Platform,
  ScrollView, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { WebView } from 'react-native-webview';
import { BENI, KINCHA, SUMI, WASHI, WASHI_DARK, INK_60 } from '@/constants/theme';
import { GOOGLE_API_KEY } from '@/api.js';

// Setup dayjs
dayjs.extend(isBetween);
dayjs.extend(customParseFormat);


const INK_40 = 'rgba(28,20,16,0.4)';
const { height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FloatingChatProps {
  planId: number;
  apiBaseUrl: string; // http://192.168.1.45:8000
}

type ScheduleItem = {
  time: string;
  activity: string;
  need_location: boolean;
  specific_location_name: string | null;
  lat: number | null;
  lng: number | null;
};

type ItineraryDay = {
  day: string;
  date: string;
  schedule: ScheduleItem[];
};

export interface RouteOption {
  title: string;
  detail: string[];
  fare: string;
  distance: string;
}

// ==========================================
// Component ย่อย: แสดงเส้นทางแบบ Tab + Detail Panel
// ==========================================
function RouteSuggestion({ options }: { options: RouteOption[] }) {
  const [selectedOption, setSelectedOption] = useState(0);

  if (!options || options.length === 0) return null;

  const selected = options[selectedOption];

  return (
    <View style={routeStyles.container}>
      {/* Header */}
      <View style={routeStyles.headerRow}>
        <View style={routeStyles.headerAccent} />
        <Text style={routeStyles.headerTitle}>Suggested Routes</Text>
      </View>

      {/* Tab strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={routeStyles.tabStrip}
      >
        {options.map((_, index) => {
          const active = selectedOption === index;
          return (
            <TouchableOpacity
              key={index}
              style={[routeStyles.tab, active && routeStyles.tabActive]}
              onPress={() => setSelectedOption(index)}
              activeOpacity={0.75}
            >
              <Text style={[routeStyles.tabLabel, active && routeStyles.tabLabelActive]}>
                {`Option ${index + 1}`}
              </Text>
              {active && <View style={routeStyles.tabDot} />}
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Detail card */}
      <View style={routeStyles.detailCard}>
        <View style={routeStyles.topBar} />

        {/* Fare + Distance summary */}
        <View style={routeStyles.summaryRow}>
          <View style={routeStyles.summaryItem}>
            <Ionicons name="card-outline" size={13} color={KINCHA} />
            <Text style={routeStyles.summaryText}>{selected.fare}</Text>
          </View>
          <View style={routeStyles.summaryItem}>
            <Ionicons name="map-outline" size={13} color={KINCHA} />
            <Text style={routeStyles.summaryText}>{selected.distance}</Text>
          </View>
        </View>

        {/* Kincha divider */}
        <View style={routeStyles.divRow}>
          <View style={routeStyles.divLine} />
          <Text style={routeStyles.divDot}>✦</Text>
          <View style={routeStyles.divLine} />
        </View>

        {/* Steps timeline */}
        <View style={routeStyles.timeline}>
          {selected.detail.map((step, idx) => (
            <View key={idx} style={routeStyles.timelineItem}>
              <View style={routeStyles.timelineLeft}>
                <View style={routeStyles.dot} />
                {idx < selected.detail.length - 1 && <View style={routeStyles.connector} />}
              </View>
              <Text style={routeStyles.stepText}>{step}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}


// ==========================================
// Main Component: FloatingChat
// ==========================================
const buildMapHTML = (apiKey: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 100%; height: 100%; }
    #map { width: 100%; height: 100%; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    let map;
    let userMarker = null;
    let destMarker = null;

    function initMap() {
      map = new google.maps.Map(document.getElementById('map'), {
        center: { lat: 35.6762, lng: 139.6503 },
        zoom: 14,
        disableDefaultUI: true,
        zoomControl: true,
      });
    }

    function setUserMarker(lat, lng) {
      const pos = { lat: lat, lng: lng };
      if (!userMarker) {
        userMarker = new google.maps.Marker({
          position: pos,
          map: map,
          title: 'Your Location',
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: '#007AFF',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2.5,
          },
          zIndex: 10,
        });
        const iw = new google.maps.InfoWindow({ content: '<b>You</b>' });
        userMarker.addListener('click', function() { iw.open(map, userMarker); });
      } else {
        userMarker.setPosition(pos);
      }
    }

    function setDestMarker(lat, lng, name) {
      const pos = { lat: lat, lng: lng };
      if (!destMarker) {
        destMarker = new google.maps.Marker({
          position: pos,
          map: map,
          title: name,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 11,
            fillColor: '#C0392B',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 2.5,
          },
        });
        const iw = new google.maps.InfoWindow({ content: '<b>' + name + '</b>' });
        destMarker.addListener('click', function() { iw.open(map, destMarker); });
      } else {
        destMarker.setPosition(pos);
      }
    }

    function fitBoth(uLat, uLng, dLat, dLng) {
      const bounds = new google.maps.LatLngBounds();
      bounds.extend({ lat: uLat, lng: uLng });
      bounds.extend({ lat: dLat, lng: dLng });
      map.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 });
    }
  </script>
  <script src="https://maps.googleapis.com/maps/api/js?key=${apiKey}&callback=initMap" async defer></script>
</body>
</html>
`;

export default function FloatingChat({ planId, apiBaseUrl }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [nextActivity, setNextActivity] = useState<ScheduleItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const webViewRef = useRef<WebView>(null);

  // Inject markers whenever data + map are ready
  useEffect(() => {
    if (!mapReady) return;
    if (userCoords) {
      webViewRef.current?.injectJavaScript(
        `setUserMarker(${userCoords.latitude}, ${userCoords.longitude}); true;`
      );
    }
    if (nextActivity?.lat != null && nextActivity?.lng != null) {
      const name = JSON.stringify(nextActivity.specific_location_name || nextActivity.activity);
      webViewRef.current?.injectJavaScript(
        `setDestMarker(${nextActivity.lat}, ${nextActivity.lng}, ${name}); true;`
      );
    }
    if (userCoords && nextActivity?.lat != null && nextActivity?.lng != null) {
      webViewRef.current?.injectJavaScript(
        `fitBoth(${userCoords.latitude}, ${userCoords.longitude}, ${nextActivity.lat}, ${nextActivity.lng}); true;`
      );
    }
  }, [mapReady, userCoords, nextActivity]);

  const handleClose = () => {
    setIsOpen(false);
    setRouteInfo(null);
    setErrorMsg(null);
    setUserCoords(null);
    setNextActivity(null);
  };

  const handlePress = async () => {
    if (isOpen) {
      handleClose();
      return;
    }
    setIsOpen(true);
    await calculateRoute();
  };

  const findNextLocation = (itinerary: ItineraryDay[]): ScheduleItem | null => {
    const now = dayjs();
    const todayStr = now.format('YYYY-MM-DD');

    // Sort days chronologically
    const sortedDays = [...itinerary].sort((a, b) => dayjs(a.date).diff(dayjs(b.date)));
    if (sortedDays.length === 0) return null;

    const firstTripDateStr = sortedDays[0].date;
    const lastTripDateStr = sortedDays[sortedDays.length - 1].date;

    // After trip has ended → nothing to route
    if (dayjs(todayStr).isAfter(dayjs(lastTripDateStr))) return null;

    // Determine starting day index
    const beforeTrip = dayjs(todayStr).isBefore(dayjs(firstTripDateStr));
    let startIdx: number;

    if (beforeTrip) {
      // Before trip starts → begin from first trip day
      startIdx = 0;
    } else {
      // During/after trip → find the first trip day that is today or later
      startIdx = sortedDays.findIndex(d => !dayjs(d.date).isBefore(dayjs(todayStr)));
      if (startIdx === -1) return null; // All trip days are in the past
    }

    for (let i = startIdx; i < sortedDays.length; i++) {
      const day = sortedDays[i];

      // Routeable = has lat+lng, sorted by time ascending
      const routeable = day.schedule
        .filter(item => item.lat !== null && item.lng !== null && item.need_location)
        .sort((a, b) => a.time.localeCompare(b.time));

      let candidates: ScheduleItem[];

      if (day.date === todayStr) {
        // Today's trip day → only future items (with 10-min grace window)
        candidates = routeable.filter(item => {
          const dt = dayjs(`${day.date} ${item.time}`, 'YYYY-MM-DD HH:mm');
          return dt.isAfter(now.subtract(10, 'minute'));
        });
      } else {
        // Future day (or before-trip first day) → all routeable items
        candidates = routeable;
      }

      if (candidates.length === 0) continue; // No candidates this day → try next day

      console.log(`Day ${day.date}: next location → ${candidates[0].activity} at ${candidates[0].time}`);
      return candidates[0];
    }

    return null;
  };

  const calculateRoute = async () => {
    setLoading(true);
    setErrorMsg(null);
    setRouteInfo(null);

    try {
      // 1. ขอ Permission และหาตำแหน่งปัจจุบัน
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        throw new Error('Please enable Location Services on your device.');
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Location permission denied. Please allow access in Settings.');
      }

      let currentLocation;
      try {
        currentLocation = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
      } catch {
        // fallback: ใช้ตำแหน่งล่าสุดที่รู้จัก
        const lastKnown = await Location.getLastKnownPositionAsync();
        if (lastKnown) {
          currentLocation = lastKnown;
        } else {
          throw new Error('Unable to determine location. Please enable GPS and try again.');
        }
      }

      const origin = `${currentLocation.coords.latitude},${currentLocation.coords.longitude}`;
      console.log('[MAP] Got location:', origin);
      setUserCoords({
        latitude: currentLocation.coords.latitude,
        longitude: currentLocation.coords.longitude,
      });

      // 2. ดึงข้อมูล Itinerary (Plan)
      const token = await AsyncStorage.getItem('access_token');
      const res = await axios.get(`${apiBaseUrl}/trip_schedule/${planId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const itineraryData = res.data?.payload?.itinerary;
      if (!itineraryData || !Array.isArray(itineraryData)) {
        throw new Error('No itinerary data found.');
      }

      // 3. หา Destination (กิจกรรมถัดไปที่มี Location)
      const target = findNextLocation(itineraryData);

      if (!target) {
        throw new Error('No upcoming activity with a location found.');
      }

      console.log('[MAP] target found:', target.activity, target.lat, target.lng);
      setNextActivity(target);

      // 4. เรียก API Route Summarize
      const destination = `${target.lat},${target.lng}`;
      console.log(`Routing: ${origin} -> ${destination} (${target.activity})`);

      const route = {
        start: origin,
        goal: destination,
        start_time: dayjs().format('YYYY-MM-DDTHH:mm:ss')
      };

      const routeRawRes = await axios.post(`${apiBaseUrl}/route`,
        route,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (!routeRawRes.data || routeRawRes.data.error) {
        throw new Error('Route not found or API error.');
      }

      // 5. ส่งผลลัพธ์ที่ได้ไปให้ AI สรุป (POST /route/summarize)
      const summarizeRes = await axios.post(`${apiBaseUrl}/route/summarize`,
        { route: routeRawRes.data },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRouteInfo(summarizeRes.data);

    } catch (err: any) {
      console.error("Route Error:", err.response?.data || err.message || err);
      setErrorMsg(err.message || 'An error occurred while calculating the route.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Modal visible={isOpen} animationType="slide" transparent={false}>
        <View style={styles.modalRoot}>
          {/* === TOP 50%: MAP === */}
          <View style={styles.mapContainer}>
            <WebView
              ref={webViewRef}
              style={styles.map}
              originWhitelist={['*']}
              source={{ html: buildMapHTML(GOOGLE_API_KEY) }}
              javaScriptEnabled
              domStorageEnabled
              onLoadEnd={() => setMapReady(true)}
              mixedContentMode="always"
            />

            {!userCoords && (
              <View style={[styles.mapPlaceholder, StyleSheet.absoluteFillObject]}>
                <ActivityIndicator size="large" color={BENI} />
                <Text style={styles.mapPlaceholderText}>Loading map...</Text>
              </View>
            )}

            <TouchableOpacity style={styles.modalCloseBtn} onPress={handleClose} activeOpacity={0.7}>
              <Ionicons name="close" size={22} color={WASHI} />
            </TouchableOpacity>
          </View>

          {/* === BOTTOM 50%: SHEET === */}
          <View style={styles.bottomSheet}>
            {/* Drag handle pill */}
            <View style={styles.dragHandleRow}>
              <View style={styles.dragHandle} />
            </View>

            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={BENI} />
                <Text style={styles.loadingText}>Finding location and calculating route...</Text>
              </View>
            ) : errorMsg ? (
              <View style={styles.errorContainer}>
                <Text style={styles.errorText}>{errorMsg}</Text>
              </View>
            ) : routeInfo && nextActivity ? (
              <ScrollView style={styles.sheetScroll} showsVerticalScrollIndicator={false}>
                <View style={styles.destinationBox}>
                  <Text style={styles.targetLabel}>Destination</Text>
                  <Text style={styles.targetName} numberOfLines={2}>
                    {nextActivity.specific_location_name || nextActivity.activity}
                  </Text>
                  <Text style={styles.targetTime}>{nextActivity.time}</Text>
                </View>

                {Array.isArray(routeInfo) && routeInfo.length > 0 ? (
                  <RouteSuggestion options={routeInfo} />
                ) : (
                  <Text style={styles.infoText}>No route information available.</Text>
                )}
              </ScrollView>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.infoText}>No upcoming activity that requires travel.</Text>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <Ionicons name="map" size={24} color={WASHI} />
      </TouchableOpacity>
    </View>
  );
}

// ==========================================
// Styles
// ==========================================
const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    alignItems: 'flex-end',
    zIndex: 9999,
  },

  // ── FAB ────────────────────────────
  fab: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: BENI,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(192,57,43,0.4)',
    shadowColor: BENI,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 8,
    elevation: 8,
  },

  // ── Modal ───────────────────────────
  modalRoot: {
    flex: 1,
    backgroundColor: SUMI,
  },
  mapContainer: {
    height: SCREEN_HEIGHT * 0.5,
    position: 'relative',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: SUMI,
    gap: 12,
  },
  mapPlaceholderText: {
    color: WASHI,
    fontSize: 13,
  },
  modalCloseBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 54 : 16,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: INK_60,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },

  // ── Bottom Sheet ────────────────────
  bottomSheet: {
    flex: 1,
    backgroundColor: WASHI,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  dragHandleRow: {
    alignItems: 'center',
    marginBottom: 12,
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: INK_40,
  },
  sheetScroll: {
    flex: 1,
  },

  // ── Content ────────────────────────
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 14,
    gap: 10,
  },
  loadingText: {
    fontSize: 12,
    color: INK_40,
    letterSpacing: 0.2,
  },
  destinationBox: {
    backgroundColor: WASHI_DARK,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: BENI,
  },
  targetLabel: {
    fontSize: 10,
    color: INK_40,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  targetName: {
    fontSize: 14,
    fontWeight: '700',
    color: SUMI,
    lineHeight: 20,
    marginBottom: 4,
  },
  targetTime: {
    fontSize: 12,
    color: BENI,
    fontWeight: '600',
  },
  errorContainer: {
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  errorText: {
    color: BENI,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
  emptyContainer: {
    paddingHorizontal: 14,
    paddingVertical: 20,
    alignItems: 'center',
  },
  infoText: {
    color: INK_40,
    fontSize: 12,
    textAlign: 'center',
    lineHeight: 18,
  },
});

const INK_12 = 'rgba(28,20,16,0.12)';

const routeStyles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 2,
  },

  // ── Header ─────────────────────────────
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  headerAccent: {
    width: 2,
    height: 13,
    backgroundColor: KINCHA,
    borderRadius: 1,
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: INK_40,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  // ── Tab strip ──────────────────────────
  tabStrip: {
    gap: 8,
    paddingBottom: 10,
  },
  tab: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: WASHI_DARK,
    borderWidth: 1,
    borderColor: INK_12,
    position: 'relative',
  },
  tabActive: {
    backgroundColor: SUMI,
    borderColor: SUMI,
    shadowColor: SUMI,
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: INK_40,
  },
  tabLabelActive: {
    color: WASHI,
  },
  tabDot: {
    position: 'absolute',
    bottom: -1,
    left: '50%',
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: BENI,
    transform: [{ translateX: -2 }],
  },

  // ── Detail card ────────────────────────
  detailCard: {
    borderRadius: 12,
    backgroundColor: WASHI,
    borderWidth: 1,
    borderColor: INK_12,
    overflow: 'hidden',
    shadowColor: SUMI,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  topBar: {
    height: 2,
    backgroundColor: BENI,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  summaryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    flex: 1,
  },
  summaryText: {
    fontSize: 12,
    color: SUMI,
    fontWeight: '600',
    flex: 1,
  },

  // ── Kincha divider ─────────────────────
  divRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  divLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: KINCHA,
    opacity: 0.3,
  },
  divDot: {
    fontSize: 7,
    color: KINCHA,
    marginHorizontal: 7,
    opacity: 0.45,
  },

  // ── Timeline ───────────────────────────
  timeline: {
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: 10,
  },
  timelineLeft: {
    alignItems: 'center',
    width: 16,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BENI,
    marginTop: 5,
  },
  connector: {
    width: 1.5,
    flex: 1,
    backgroundColor: INK_12,
    marginVertical: 3,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: SUMI,
    lineHeight: 18,
    opacity: 0.85,
    paddingBottom: 12,
  },
});