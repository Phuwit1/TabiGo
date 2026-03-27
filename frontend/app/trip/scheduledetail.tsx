import React, { useEffect, useState, useMemo } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, StyleSheet,
  Modal, SafeAreaView, FlatList,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/api.js';
import dayjs from 'dayjs';
import 'dayjs/locale/en';
import LottieView from 'lottie-react-native';
import ApproveAnimation from '@/components/ui/Alert/ApproveAnimation';
import WrongAnimation from '@/components/ui/Alert/WrongAnimation';

dayjs.locale('en');

import { BENI, KINCHA, KINCHA_LIGHT, SUMI, WASHI, WASHI_DARK, WHITE, INK_60, INK_30, INK_12 } from '@/constants/theme';

type City = { id: number; name: string };

export default function TripDetail() {
  const { planId, cities: citiesParam } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading]               = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState(0);
  const [schedule, setSchedule]             = useState<any>(null);
  const [saving, setSaving]                 = useState(false);
  const [editedSchedule, setEditedSchedule] = useState<any>(null);
  const [allCities, setAllCities]           = useState<City[]>([]);
  const [currentSelectedCities, setCurrentSelectedCities] = useState<string[]>([]);
  const [citySearch, setCitySearch]         = useState('');
  const [isEditModalVisible, setEditModalVisible]     = useState(false);
  const [isCommentModalVisible, setCommentModalVisible] = useState(false);
  const [newNote, setNewNote]               = useState('');
  const [focusedField, setFocusedField]     = useState<string | null>(null);

  // ── Custom alert ───────────────────────────────────────────────────────────
  const [alertConfig, setAlertConfig] = useState({
    visible: false, title: '', message: '', isSuccess: false, onConfirm: () => {},
  });
  const showCustomAlert = (title: string, message: string, isSuccess = false, onConfirm = () => {}) =>
    setAlertConfig({ visible: true, title, message, isSuccess, onConfirm });
  const closeAlert = () => {
    const cb = alertConfig.onConfirm;
    setAlertConfig(p => ({ ...p, visible: false }));
    cb();
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchPlan = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const [res, citiesRes] = await Promise.all([
          axios.get(`${API_URL}/trip_schedule/${planId}`, { headers }),
          axios.get(`${API_URL}/cities`),
        ]);
        const payload = res.data?.payload;
        setSchedule(payload);
        setEditedSchedule(JSON.parse(JSON.stringify(payload)));

        if (citiesRes.data && Array.isArray(citiesRes.data.items)) {
          setAllCities(citiesRes.data.items);
        }
        if (citiesParam) {
          setCurrentSelectedCities(JSON.parse(citiesParam as string));
        }
      } catch {
        Alert.alert('Error', 'Failed to load trip plan');
      } finally {
        setLoading(false);
      }
    };
    fetchPlan();
  }, [planId]);

  const toggleCity = (name: string) =>
    setCurrentSelectedCities(prev =>
      prev.includes(name) ? prev.filter(c => c !== name) : [...prev, name]
    );

  const filteredCities = useMemo(
    () => allCities.filter(c => c.name.toLowerCase().includes(citySearch.toLowerCase())),
    [allCities, citySearch]
  );

  const updateActivity = (dayIdx: number, actIdx: number, field: string, value: string) => {
    setEditedSchedule((prev: any) => {
      const copy = { ...prev };
      copy.itinerary[dayIdx].schedule[actIdx][field] = value;
      return copy;
    });
  };

  // ── Confirm (save + get locations) ────────────────────────────────────────
  const confirmPlan = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('access_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const changed = JSON.stringify(schedule) !== JSON.stringify(editedSchedule);
      const planToProcess = changed ? editedSchedule : schedule;

      const locationRes = await axios.post(`${API_URL}/get_location/`,
        { itinerary_data: planToProcess }, { headers }
      );
      const updatedPayload = locationRes.data.itinerary_data;

      await axios.put(`${API_URL}/trip_schedule/${planId}`,
        { plan_id: planId, payload: updatedPayload }, { headers }
      );

      showCustomAlert('Saved!', 'Your trip plan has been confirmed.', true, () =>
        router.replace('/(tabs)/mytrip')
      );
    } catch {
      showCustomAlert('Error', 'Failed to save trip plan', false);
    } finally {
      setSaving(false);
    }
  };

  // ── Regenerate plan ────────────────────────────────────────────────────────
  const handleRegenerate = async () => {
    if (currentSelectedCities.length === 0) {
      showCustomAlert('Warning', 'Please select at least one city', false);
      return;
    }
    setEditModalVisible(false);
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      const fmt = (ymd: string) => { const [y, m, d] = ymd.split('-'); return `${d}/${m}/${y}`; };
      const startDate = schedule.itinerary[0]?.date ?? '';
      const endDate   = schedule.itinerary[schedule.itinerary.length - 1]?.date ?? '';

      const res = await axios.post(`${API_URL}/llm/fix/`, {
        start_date: fmt(startDate), end_date: fmt(endDate),
        cities: currentSelectedCities, text: newNote, itinerary_data: editedSchedule,
      }, { headers });

      const locationRes = await axios.post(`${API_URL}/get_location/`,
        { itinerary_data: res.data }, { headers }
      );

      await axios.put(`${API_URL}/trip_schedule/${planId}`,
        { plan_id: planId, payload: locationRes }, { headers }
      );

      setSchedule(res.data);
      setEditedSchedule(res.data);
      setNewNote('');
      showCustomAlert('Updated!', 'Your new travel plan is ready.', true);
    } catch {
      showCustomAlert('Error', 'Failed to regenerate plan', false);
    } finally {
      setSaving(false);
    }
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator color={BENI} size="large" />
        <Text style={s.loadingScreenText}>Loading your plan...</Text>
      </View>
    );
  }

  const currentDay = editedSchedule.itinerary[selectedDayIndex];

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.screen}>

      {/* ── Page header ── */}
      <View style={s.pageHeader}>
        <View style={s.topBar} />

        {/* Row 1: title + action buttons */}
        <View style={s.pageHeaderInner}>
          <View style={s.titleActionRow}>
            {/* Title left */}
            <View style={s.pageTitleRow}>
              <View style={s.pageTitleAccent} />
              <View>
                <Text style={s.pageTitle}>Trip Schedule</Text>
                <Text style={s.pageSub}>Review and confirm</Text>
              </View>
            </View>

            {/* Action buttons right */}
            <View style={s.actionBtnGroup}>
              <TouchableOpacity style={s.actionBtn} onPress={() => setEditModalVisible(true)} activeOpacity={0.8}>
                <Ionicons name="refresh-outline" size={14} color={KINCHA_LIGHT} />
                <Text style={s.actionBtnText}>Re-plan</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[s.actionBtn, s.actionBtnSolid]} onPress={() => setCommentModalVisible(true)} activeOpacity={0.8}>
                <Ionicons name="sparkles-outline" size={14} color={WASHI} />
                <Text style={[s.actionBtnText, { color: WASHI }]}>AI Notes</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>

        {/* Kincha micro divider */}
        <View style={s.microDivRow}>
          <View style={s.microDivLine} />
          <Text style={s.microDivDot}>✦</Text>
          <View style={s.microDivLine} />
        </View>

        {/* Row 2: day chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.dayStrip}
        >
          {editedSchedule.itinerary.map((item: any, index: number) => {
            const isSelected = selectedDayIndex === index;
            return (
              <TouchableOpacity
                key={index}
                style={[s.dayChip, isSelected && s.dayChipActive]}
                onPress={() => setSelectedDayIndex(index)}
                activeOpacity={0.8}
              >
                <Text style={[s.dayChipLabel, isSelected && s.dayChipLabelActive]}>{item.day}</Text>
                <Text style={[s.dayChipDate, isSelected && s.dayChipDateActive]}>
                  {item.date ? dayjs(item.date).format('D MMM') : ''}
                </Text>
                {isSelected && <View style={s.dayChipDot} />}
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* Bottom divider */}
        <View style={s.divRow}>
          <View style={s.divLine} />
          <Text style={s.divDot}>✦</Text>
          <View style={s.divLine} />
        </View>
      </View>

      {/* ── Body: activity list ── */}
      <View style={s.body}>
        <View style={s.dayTitleRow}>
          <View style={s.dayTitleAccent} />
          <Text style={s.dayTitle}>{currentDay.day}</Text>
          <Text style={s.dayDate}>{dayjs(currentDay.date).format('D MMMM YYYY')}</Text>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          {currentDay.schedule.map((item: any, i: number) => (
            <View key={`${selectedDayIndex}-${i}`} style={s.itemRow}>
              {/* Time bubble */}
              <View style={s.timecol}>
                <View style={s.timeBubble}>
                  <Text style={s.timeText}>{item.time}</Text>
                </View>
                {i < currentDay.schedule.length - 1 && <View style={s.connector} />}
              </View>

              {/* Activity card */}
              <View style={s.card}>
                <Text style={s.cardFieldLabel}>ACTIVITY</Text>
                <TextInput
                  style={[s.cardInput, focusedField === `act-${i}` && s.cardInputFocused]}
                  multiline
                  value={item.activity}
                  onChangeText={val => updateActivity(selectedDayIndex, i, 'activity', val)}
                  onFocus={() => setFocusedField(`act-${i}`)}
                  onBlur={() => setFocusedField(null)}
                  placeholderTextColor={INK_30}
                />
                {!!item.specific_location_name && (
                  <View style={s.locationRow}>
                    <Ionicons name="location-outline" size={11} color={KINCHA} />
                    <Text style={s.locationText}>{item.specific_location_name}</Text>
                  </View>
                )}
              </View>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* ── Footer confirm button ── */}
      <View style={s.footer}>
        <TouchableOpacity style={s.confirmBtn} onPress={confirmPlan} disabled={saving} activeOpacity={0.85}>
          <Ionicons name="checkmark-circle-outline" size={16} color={WASHI} />
          <Text style={s.confirmBtnText}>Confirm Trip</Text>
        </TouchableOpacity>
      </View>

      {/* ── Re-plan modal ── */}
      <Modal visible={isEditModalVisible} transparent animationType="fade" onRequestClose={() => setEditModalVisible(false)}>
        <View style={m.overlay}>
          <View style={m.card}>
            <View style={m.topBar} />
            <View style={m.header}>
              <View style={m.headerLeft}>
                <View style={m.headerAccent} />
                <Text style={m.title}>Edit Trip Plan</Text>
              </View>
              <TouchableOpacity style={m.closeBtn} onPress={() => setEditModalVisible(false)}>
                <Ionicons name="close" size={15} color={WASHI} />
              </TouchableOpacity>
            </View>

            <View style={m.body}>
              <Text style={m.fieldLabel}>CITIES</Text>
              <View style={m.searchWrap}>
                <Ionicons name="search-outline" size={13} color={INK_30} />
                <TextInput
                  style={m.searchInput}
                  placeholder="Search city..."
                  placeholderTextColor={INK_30}
                  value={citySearch}
                  onChangeText={setCitySearch}
                />
              </View>

              <View style={m.cityList}>
                <FlatList
                  data={filteredCities}
                  keyExtractor={item => item.id.toString()}
                  keyboardShouldPersistTaps="handled"
                  renderItem={({ item }) => {
                    const checked = currentSelectedCities.includes(item.name);
                    return (
                      <TouchableOpacity style={[m.cityRow, checked && m.cityRowChecked]} onPress={() => toggleCity(item.name)}>
                        <View style={[m.checkbox, checked && m.checkboxChecked]}>
                          {checked && <Ionicons name="checkmark" size={11} color={WASHI} />}
                        </View>
                        <Text style={[m.cityName, checked && m.cityNameChecked]}>{item.name}</Text>
                        {checked && <Ionicons name="location" size={12} color={BENI} style={{ marginLeft: 'auto' }} />}
                      </TouchableOpacity>
                    );
                  }}
                />
              </View>

              <Text style={[m.fieldLabel, { marginTop: 12 }]}>ADDITIONAL PREFERENCES</Text>
              <TextInput
                style={m.noteInput}
                placeholder="e.g. food-focused, temples, relaxed pace..."
                placeholderTextColor={INK_30}
                value={newNote}
                onChangeText={setNewNote}
                multiline
                textAlignVertical="top"
                selectionColor={BENI}
              />

              <View style={m.btnRow}>
                <TouchableOpacity style={m.cancelBtn} onPress={() => setEditModalVisible(false)} activeOpacity={0.8}>
                  <Text style={m.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity style={m.updateBtn} onPress={handleRegenerate} activeOpacity={0.85}>
                  <Ionicons name="refresh" size={14} color={WASHI} />
                  <Text style={m.updateBtnText}>Update Plan</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── AI Notes modal ── */}
      <Modal visible={isCommentModalVisible} transparent animationType="fade" onRequestClose={() => setCommentModalVisible(false)}>
        <View style={m.overlay}>
          <View style={m.card}>
            <View style={m.topBar} />
            <View style={m.header}>
              <View style={m.headerLeft}>
                <View style={m.headerAccent} />
                <Text style={m.title}>AI Recommendations</Text>
              </View>
              <TouchableOpacity style={m.closeBtn} onPress={() => setCommentModalVisible(false)}>
                <Ionicons name="close" size={15} color={WASHI} />
              </TouchableOpacity>
            </View>

            <ScrollView style={m.commentBody} showsVerticalScrollIndicator={false}>
              <Text style={m.commentText}>
                {editedSchedule?.comments || 'No additional recommendations.'}
              </Text>
            </ScrollView>

            <View style={{ flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 18 }}>
              <TouchableOpacity style={m.updateBtn} onPress={() => setCommentModalVisible(false)} activeOpacity={0.85}>
                <Text style={m.updateBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Saving modal ── */}
      <Modal transparent animationType="fade" visible={saving}>
        <View style={lm.overlay}>
          <View style={lm.card}>
            <View style={lm.topBar} />
            <LottieView
              source={require('@/assets/images/CreateTrip/Airplane.json')}
              autoPlay loop
              style={{ width: 140, height: 140 }}
            />
            <Text style={lm.title}>Updating your plan...</Text>
            <Text style={lm.sub}>Please wait while we update locations.</Text>
          </View>
        </View>
      </Modal>

      {/* ── Custom alert modal ── */}
      <Modal visible={alertConfig.visible} transparent animationType="fade">
        <View style={lm.overlay}>
          <View style={alm.card}>
            <View style={alm.topBar} />
            {alertConfig.isSuccess
              ? <ApproveAnimation size={100} loop={false} />
              : <WrongAnimation size={100} loop={false} />
            }
            <Text style={alm.title}>{alertConfig.title}</Text>
            <Text style={alm.message}>{alertConfig.message}</Text>
            <TouchableOpacity
              style={[alm.btn, alertConfig.isSuccess ? alm.btnSuccess : alm.btnError]}
              onPress={closeAlert}
              activeOpacity={0.85}
            >
              <Text style={alm.btnText}>{alertConfig.isSuccess ? 'Great!' : 'OK'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Main styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: WASHI },

  // Loading
  loadingScreen: { flex: 1, backgroundColor: WASHI, alignItems: 'center', justifyContent: 'center', gap: 12 },
  loadingScreenText: { fontSize: 13, fontFamily: 'NotoSansJP_400Regular', color: INK_60 },

  // Page header (dark Sumi)
  pageHeader: { backgroundColor: SUMI },
  topBar: { height: 3, backgroundColor: BENI },
  pageHeaderInner: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },

  // Row 1: title + actions
  titleActionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitleAccent: { width: 3, height: 30, backgroundColor: BENI, borderRadius: 99 },
  pageTitle: { fontSize: 16, fontFamily: 'ShipporiMincho_800ExtraBold', color: WASHI, letterSpacing: 0.3 },
  pageSub: { fontSize: 10, fontFamily: 'NotoSansJP_400Regular', color: 'rgba(250,245,236,0.4)', marginTop: 1 },

  // Action button group (right side of row 1)
  actionBtnGroup: { flexDirection: 'row', gap: 7 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99,
    borderWidth: 1, borderColor: KINCHA,
    backgroundColor: 'rgba(184,150,62,0.1)',
  },
  actionBtnSolid: { backgroundColor: BENI, borderColor: BENI },
  actionBtnText: { fontSize: 11, fontFamily: 'NotoSansJP_700Bold', color: KINCHA_LIGHT },

  // Micro divider between rows
  microDivRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginVertical: 6 },
  microDivLine: { flex: 1, height: 0.5, backgroundColor: 'rgba(184,150,62,0.2)' },
  microDivDot: { fontSize: 6, color: 'rgba(184,150,62,0.4)', marginHorizontal: 7 },

  // Row 2: day chips strip
  dayStrip: { paddingHorizontal: 14, paddingVertical: 8, gap: 7, alignItems: 'center' },

  // Day chip
  dayChip: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 12, backgroundColor: 'rgba(250,245,236,0.1)',
    minWidth: 58, borderWidth: 1, borderColor: 'rgba(250,245,236,0.15)',
    position: 'relative',
  },
  dayChipActive: { backgroundColor: WASHI, borderColor: WASHI },
  dayChipLabel: { fontSize: 11, fontFamily: 'NotoSansJP_700Bold', color: 'rgba(250,245,236,0.55)' },
  dayChipLabelActive: { color: SUMI },
  dayChipDate: { fontSize: 9, fontFamily: 'NotoSansJP_400Regular', color: 'rgba(250,245,236,0.35)', marginTop: 1 },
  dayChipDateActive: { color: INK_60 },
  dayChipDot: {
    position: 'absolute', bottom: -1, left: '50%',
    width: 4, height: 4, borderRadius: 2, backgroundColor: BENI,
    transform: [{ translateX: -2 }],
  },

  // Divider
  divRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  divLine: { flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.25 },
  divDot: { fontSize: 7, color: KINCHA, marginHorizontal: 7, opacity: 0.4 },

  // Body
  body: { flex: 1, paddingHorizontal: 16, paddingTop: 14 },
  dayTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  dayTitleAccent: { width: 3, height: 18, backgroundColor: BENI, borderRadius: 99 },
  dayTitle: { fontSize: 15, fontFamily: 'ShipporiMincho_700Bold', color: SUMI },
  dayDate: { fontSize: 11, fontFamily: 'NotoSansJP_400Regular', color: INK_30, marginLeft: 2 },

  // Timeline item
  itemRow: { flexDirection: 'row', gap: 10, marginBottom: 4 },
  timecol: { alignItems: 'center', width: 46, paddingTop: 4 },
  timeBubble: {
    width: 44, paddingVertical: 5, borderRadius: 10,
    backgroundColor: SUMI, alignItems: 'center',
  },
  timeText: { fontSize: 11, fontFamily: 'NotoSansJP_700Bold', color: WASHI, letterSpacing: 0.3 },
  connector: { width: 1.5, flex: 1, minHeight: 16, backgroundColor: INK_12, marginTop: 3 },

  // Activity card
  card: {
    flex: 1, backgroundColor: WHITE, borderRadius: 14,
    padding: 12, marginBottom: 8,
    borderWidth: 1, borderColor: INK_12,
    shadowColor: SUMI, shadowOpacity: 0.04, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  cardFieldLabel: { fontSize: 9, fontFamily: 'NotoSansJP_700Bold', color: INK_30, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 5 },
  cardInput: {
    fontSize: 13, fontFamily: 'NotoSansJP_400Regular', color: SUMI,
    backgroundColor: WASHI_DARK, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 7,
    borderWidth: 1, borderColor: INK_12, minHeight: 38,
  },
  cardInputFocused: { borderColor: BENI, borderWidth: 1.5 },
  locationRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  locationText: { fontSize: 10, fontFamily: 'NotoSansJP_400Regular', color: INK_30, flex: 1 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24,
    backgroundColor: WASHI, borderTopWidth: 1, borderTopColor: INK_12,
  },
  confirmBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: BENI, paddingVertical: 14, borderRadius: 99,
    shadowColor: BENI, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  confirmBtnText: { fontSize: 15, fontFamily: 'NotoSansJP_700Bold', color: WASHI, letterSpacing: 0.3 },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,20,16,0.55)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    width: '100%', maxWidth: 400,
    backgroundColor: WASHI, borderRadius: 20, overflow: 'hidden',
    shadowColor: SUMI, shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  topBar: { height: 3, backgroundColor: BENI },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAccent: { width: 3, height: 15, backgroundColor: BENI, borderRadius: 99 },
  title: { fontSize: 18, fontFamily: 'ShipporiMincho_700Bold', color: SUMI, letterSpacing: 0.3, textShadowColor: 'rgba(28,20,16,0.25)', textShadowOffset: { width: 0.5, height: 0.5 }, textShadowRadius: 0.5 },
  closeBtn: { width: 26, height: 26, borderRadius: 99, backgroundColor: SUMI, alignItems: 'center', justifyContent: 'center' },

  body: { paddingHorizontal: 16, paddingBottom: 18 },
  fieldLabel: { fontSize: 9, fontFamily: 'NotoSansJP_700Bold', color: INK_30, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 7 },

  // Search
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: WASHI_DARK, borderRadius: 99,
    paddingHorizontal: 12, paddingVertical: 8, marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 12, fontFamily: 'NotoSansJP_400Regular', color: SUMI },

  // City list
  cityList: { height: 180, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: INK_12, marginBottom: 6 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 0.5, borderBottomColor: INK_12 },
  cityRowChecked: { backgroundColor: 'rgba(192,57,43,0.04)' },
  checkbox: { width: 18, height: 18, borderRadius: 99, borderWidth: 1.5, borderColor: INK_30, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE },
  checkboxChecked: { backgroundColor: BENI, borderColor: BENI },
  cityName: { fontSize: 13, fontFamily: 'NotoSansJP_400Regular', color: SUMI },
  cityNameChecked: { fontFamily: 'NotoSansJP_700Bold', color: BENI },

  // Note input
  noteInput: {
    backgroundColor: WASHI_DARK, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10,
    fontSize: 13, fontFamily: 'NotoSansJP_400Regular', color: SUMI,
    minHeight: 80, borderWidth: 1, borderColor: INK_12, marginBottom: 16,
  },

  // Buttons
  btnRow: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1, paddingVertical: 11, borderRadius: 99,
    borderWidth: 1, borderColor: INK_12, backgroundColor: WASHI_DARK,
    alignItems: 'center',
  },
  cancelBtnText: { fontSize: 13, fontFamily: 'NotoSansJP_500Medium', color: INK_60 },
  updateBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 5, borderRadius: 20, backgroundColor: BENI,
    shadowColor: BENI, shadowOpacity: 0.25, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  updateBtnText: { fontSize: 13, fontFamily: 'NotoSansJP_700Bold', color: WASHI },

  // Comment body
  commentBody: { maxHeight: 320, paddingHorizontal: 16, paddingBottom: 8 },
  commentText: { fontSize: 13, fontFamily: 'NotoSansJP_400Regular', color: INK_60, lineHeight: 22 },
});

// ─── Loading modal styles ─────────────────────────────────────────────────────
const lm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,20,16,0.6)', justifyContent: 'center', alignItems: 'center', padding: 32 },
  card: {
    width: '85%', backgroundColor: WASHI, borderRadius: 24, overflow: 'hidden',
    alignItems: 'center', paddingBottom: 24,
    shadowColor: SUMI, shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  topBar: { height: 3, backgroundColor: BENI, width: '100%', marginBottom: 4 },
  title: { fontSize: 15, fontFamily: 'ShipporiMincho_700Bold', color: SUMI, marginTop: 4, textAlign: 'center' },
  sub: { fontSize: 11, fontFamily: 'NotoSansJP_400Regular', color: INK_60, textAlign: 'center', marginTop: 5, paddingHorizontal: 20, lineHeight: 17 },
});

// ─── Alert modal styles ───────────────────────────────────────────────────────
const alm = StyleSheet.create({
  card: {
    width: '88%', backgroundColor: WASHI, borderRadius: 24, overflow: 'hidden',
    alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24,
    shadowColor: SUMI, shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 8 }, elevation: 10,
  },
  topBar: { height: 3, backgroundColor: BENI, width: '100%', marginBottom: 12 },
  title: { fontSize: 17, fontFamily: 'ShipporiMincho_700Bold', color: SUMI, marginTop: 4, marginBottom: 5, textAlign: 'center' },
  message: { fontSize: 13, fontFamily: 'NotoSansJP_400Regular', color: INK_60, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  btn: { width: '100%', paddingVertical: 13, borderRadius: 99, alignItems: 'center' },
  btnSuccess: { backgroundColor: KINCHA },
  btnError: { backgroundColor: BENI },
  btnText: { color: WASHI, fontFamily: 'NotoSansJP_700Bold', fontSize: 14, letterSpacing: 0.3 },
});