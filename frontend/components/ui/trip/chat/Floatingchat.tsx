import React, { useState, useEffect } from 'react';
import { 
  View, Text, StyleSheet, TouchableOpacity, 
  ActivityIndicator, Alert, Dimensions, Platform,
  UIManager, LayoutAnimation, ScrollView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import customParseFormat from 'dayjs/plugin/customParseFormat';

// Setup dayjs
dayjs.extend(isBetween);
dayjs.extend(customParseFormat);

// เปิดใช้งาน LayoutAnimation สำหรับ Android ให้การขยายการ์ดดูสมูท
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
// Component ย่อย: สำหรับแสดงการ์ดเส้นทางแบบกดขยายได้
// ==========================================
function RouteSuggestion({ options }: { options: RouteOption[] }) {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const toggleExpand = (index: number) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedIndex(expandedIndex === index ? null : index);
  };

  if (!options || options.length === 0) return null;

  return (
    <View style={routeStyles.container}>
      <View style={routeStyles.headerRow}>
        <View style={routeStyles.headerAccent} />
        <Text style={routeStyles.headerTitle}>เส้นทางที่แนะนำ</Text>
      </View>

      {options.map((option, index) => {
        const isExpanded = expandedIndex === index;
        return (
          <View key={index} style={[routeStyles.card, isExpanded && routeStyles.cardExpanded]}>
            <TouchableOpacity
              style={routeStyles.cardHeader}
              onPress={() => toggleExpand(index)}
              activeOpacity={0.7}
            >
              {isExpanded && <View style={routeStyles.cardActiveBar} />}
              <View style={{ flex: 1 }}>
                <Text style={[routeStyles.optionTitle, isExpanded && routeStyles.optionTitleActive]}>
                  {option.title}
                </Text>
                <View style={routeStyles.infoRow}>
                  <Text style={routeStyles.infoText}>{option.fare}</Text>
                  <Text style={routeStyles.infoDot}> · </Text>
                  <Text style={routeStyles.infoText}>{option.distance}</Text>
                </View>
              </View>
              <Text style={[routeStyles.chevron, isExpanded && routeStyles.chevronActive]}>
                {isExpanded ? '▲' : '▼'}
              </Text>
            </TouchableOpacity>

            {isExpanded && (
              <View style={routeStyles.cardBody}>
                <View style={routeStyles.timelineLine} />
                {option.detail.map((step, stepIdx) => (
                  <View key={stepIdx} style={routeStyles.stepContainer}>
                    <View style={routeStyles.stepDot} />
                    <Text style={routeStyles.stepText}>{step}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}


// ==========================================
// Main Component: FloatingChat
// ==========================================
export default function FloatingChat({ planId, apiBaseUrl }: FloatingChatProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [routeInfo, setRouteInfo] = useState<any>(null);
  const [nextActivity, setNextActivity] = useState<ScheduleItem | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // testLocation(); // เรียกฟังก์ชันทดสอบพิกัดเมื่อคอมโพเนนต์โหลด (สามารถเอาออกได้หลังจากทดสอบเสร็จ)

  // ฟังก์ชันหลักเมื่อกดปุ่ม
  const handlePress = async () => {
    if (isOpen) {
      setIsOpen(false);
      setRouteInfo(null);
      setErrorMsg(null);
      return;
    }
    setIsOpen(true);
    await calculateRoute();
  };

    const findNextLocation = (itinerary: ItineraryDay[]): ScheduleItem | null => {
    const now = dayjs(); 
    let allActivities: (ScheduleItem & { fullDateTime: dayjs.Dayjs })[] = [];
    


    itinerary.forEach(day => {
      day.schedule.forEach(item => {
        const itemDateTime = dayjs(`${day.date} ${item.time}`, "YYYY-MM-DD HH:mm");
        if (itemDateTime.isValid()) {
          allActivities.push({ ...item, fullDateTime: itemDateTime });
        }
      });
    });

    allActivities.sort((a, b) => a.fullDateTime.diff(b.fullDateTime));

    console.log("All activities with datetime:", allActivities.map(a => ({
      activity: a.activity,
      time: a.fullDateTime.format('YYYY-MM-DD HH:mm'),
    })));

    for (const item of allActivities) {
      console.log(`Checking activity: ${item.activity} at ${item.fullDateTime.format('YYYY-MM-DD HH:mm')}`);
      if (item.fullDateTime.isAfter(now.subtract(10, 'minute')) && item.need_location && item.lat && item.lng) {

        return item;
      }
    }
    return null;
  };

  const calculateRoute = async () => {
    setLoading(true);
    setErrorMsg(null);
    setRouteInfo(null);

    try {
    

      // 1. ขอ Permission และหาตำแหน่งปัจจุบัน
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        throw new Error('Permission to access location was denied');
      }
      console.log("1");

      const currentLocation = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      console.log("2");

      const origin = `${currentLocation.coords.latitude},${currentLocation.coords.longitude}`;
      // 2. ดึงข้อมูล Itinerary (Plan)
      const token = await AsyncStorage.getItem('access_token');
      const res = await axios.get(`${apiBaseUrl}/trip_schedule/${planId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const itineraryData = res.data?.payload?.itinerary;
      if (!itineraryData || !Array.isArray(itineraryData)) {
        throw new Error('ไม่พบข้อมูลตารางการเดินทาง');
      }

      // 3. หา Destination (กิจกรรมถัดไปที่มี Location)
      const target = findNextLocation(itineraryData);
      
      if (!target) {
        throw new Error('ไม่พบกิจกรรมถัดไปที่มีสถานที่ระบุไว้');
      }

      setNextActivity(target);

      // 4. เรียก API Route Summarize
      const destination = `${target.lat},${target.lng}`;
      console.log(`Routing: ${origin} -> ${destination} (${target.activity})`);

      const route = {
        start : origin,
        goal : destination,
        start_time : dayjs().format('YYYY-MM-DDTHH:mm:ss') 
      }

     const routeRawRes = await axios.post(`${apiBaseUrl}/route`,
      route,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
      
      if (!routeRawRes.data || routeRawRes.data.error) {
          throw new Error('ไม่พบเส้นทาง หรือ API มีปัญหา');
      }
      
      // 3. ✅ ส่งผลลัพธ์ที่ได้ไปให้ AI สรุป (POST /route/summarize)
      const summarizeRes = await axios.post(`${apiBaseUrl}/route/summarize`, 
        { route: routeRawRes.data },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setRouteInfo(summarizeRes.data);

    } catch (err: any) {
      console.log("มัน eror ละเด้อ");
      console.error("รายละเอียด Error:", err.response?.data || err.message || err);
      // console.error("Route Error:", err);
      const location = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced, // ลดความแม่นยำลงมาที่ระดับกลาง (สำคัญมากสำหรับ Emulator)
        });
      console.log("พิกัดที่ได้:", location.coords);
      
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการคำนวณเส้นทาง");
    } finally {
      setLoading(false);
    }
  };



  return (
    <View style={styles.container}>
      {isOpen && (
        <View style={styles.bubbleCard}>
          {/* Top accent bar */}
          <View style={styles.topBar} />

          {/* Header */}
          <View style={styles.bubbleHeader}>
            <View style={styles.headerLeft}>
              <View style={styles.headerBar} />
              <Text style={styles.bubbleTitle}>เส้นทางถัดไป</Text>
            </View>
            <TouchableOpacity style={styles.closeBtn} onPress={() => setIsOpen(false)} activeOpacity={0.7}>
              <Ionicons name="close" size={16} color="#FAF5EC" />
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={styles.dividerRow}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerDot}>✦</Text>
            <View style={styles.dividerLine} />
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#C0392B" />
              <Text style={styles.loadingText}>กำลังคำนวณเส้นทาง...</Text>
            </View>
          ) : errorMsg ? (
            <View style={styles.errorContainer}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : routeInfo && nextActivity ? (
            <View style={styles.infoContainer}>
              <View style={styles.destinationBox}>
                <Text style={styles.targetLabel}>ปลายทาง</Text>
                <Text style={styles.targetName} numberOfLines={2}>
                  {nextActivity.specific_location_name || nextActivity.activity}
                </Text>
                <Text style={styles.targetTime}>{nextActivity.time}</Text>
              </View>

              {Array.isArray(routeInfo) && routeInfo.length > 0 ? (
                <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
                  <RouteSuggestion options={routeInfo} />
                </ScrollView>
              ) : (
                <Text style={styles.infoText}>ไม่พบข้อมูลเส้นทาง</Text>
              )}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Text style={styles.infoText}>ไม่พบกิจกรรมถัดไปที่ต้องเดินทาง</Text>
            </View>
          )}
        </View>
      )}

      {/* FAB */}
      <TouchableOpacity
        style={[styles.fab, isOpen && styles.fabActive]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <Ionicons name={isOpen ? 'map' : 'navigate'} size={24} color="#FAF5EC" />
      </TouchableOpacity>
    </View>
  );
}

// ── Palette ───────────────────────────────────────────────────────────────────
const BENI        = '#C0392B';
const KINCHA      = '#B8963E';
const SUMI        = '#1C1410';

const WASHI       = '#FAF5EC';
const WASHI_DARK  = '#EDE5D8';
const INK_40      = 'rgba(28,20,16,0.4)';

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

  // ── FAB ────────────────────────────────
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
  fabActive: {
    backgroundColor: SUMI,
    borderColor: KINCHA,
    shadowColor: SUMI,
  },

  // ── Card ───────────────────────────────
  bubbleCard: {
    backgroundColor: WASHI,
    borderRadius: 10,
    marginBottom: 12,
    width: 300,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: WASHI_DARK,
    shadowColor: SUMI,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.18,
    shadowRadius: 14,
    elevation: 8,
  },
  topBar: {
    height: 3,
    backgroundColor: BENI,
  },
  bubbleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerBar: {
    width: 3,
    height: 16,
    backgroundColor: BENI,
    borderRadius: 2,
  },
  bubbleTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: SUMI,
    letterSpacing: 0.3,
  },
  closeBtn: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: SUMI,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Divider ────────────────────────────
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: KINCHA,
    opacity: 0.35,
  },
  dividerDot: {
    fontSize: 7,
    color: KINCHA,
    marginHorizontal: 6,
    opacity: 0.5,
  },

  // ── Content ────────────────────────────
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
  infoContainer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 6,
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
  divider: {
    height: 0.5,
    backgroundColor: KINCHA,
    opacity: 0.3,
    marginVertical: 6,
  },
});

const routeStyles = StyleSheet.create({
  container: {
    width: '100%',
    paddingTop: 2,
  },
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

  // ── Route card ─────────────────────────
  card: {
    backgroundColor: WASHI,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: WASHI_DARK,
    overflow: 'hidden',
  },
  cardExpanded: {
    borderColor: BENI,
    shadowColor: BENI,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: WASHI_DARK,
    position: 'relative',
  },
  cardActiveBar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
    backgroundColor: BENI,
  },
  optionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: SUMI,
    marginBottom: 3,
  },
  optionTitleActive: {
    color: BENI,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    fontSize: 11,
    color: INK_40,
  },
  infoDot: {
    fontSize: 11,
    color: KINCHA,
    opacity: 0.5,
  },
  chevron: {
    fontSize: 10,
    color: INK_40,
    marginLeft: 6,
  },
  chevronActive: {
    color: BENI,
  },

  // ── Card body / timeline ───────────────
  cardBody: {
    padding: 12,
    paddingLeft: 22,
    backgroundColor: WASHI,
    position: 'relative',
  },
  timelineLine: {
    position: 'absolute',
    left: 26,
    top: 16,
    bottom: 16,
    width: 1.5,
    backgroundColor: WASHI_DARK,
  },
  stepContainer: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'flex-start',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: BENI,
    marginTop: 5,
    marginRight: 10,
    zIndex: 1,
  },
  stepText: {
    flex: 1,
    fontSize: 12,
    color: SUMI,
    lineHeight: 18,
    opacity: 0.85,
  },
});
