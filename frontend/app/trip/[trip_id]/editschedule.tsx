import React, { useState, useCallback } from 'react';
import {
  View, Text, TextInput, ScrollView, TouchableOpacity,
  Alert, ActivityIndicator, StyleSheet,
  Modal, SafeAreaView, Platform,
} from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { API_URL } from '@/api.js';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DraggableFlatList, { ScaleDecorator, RenderItemParams } from 'react-native-draggable-flatlist';
import dayjs from 'dayjs';
import LottieView from 'lottie-react-native';

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY || 'AIzaSyA73tpAfskui7aqX9GXabfGLU0OZ5HLC-U';

// ─── Palette ──────────────────────────────────────────────────────────────────
const BENI         = '#C0392B';
const BENI_LIGHT   = 'rgba(192,57,43,0.08)';
const KINCHA       = '#B8963E';
const KINCHA_LIGHT = '#D4AF55';
const SUMI         = '#1C1410';
const WASHI        = '#FAF5EC';
const WASHI_DARK   = '#EDE5D8';
const WHITE        = '#FFFFFF';
const INK_60       = 'rgba(28,20,16,0.6)';
const INK_30       = 'rgba(28,20,16,0.3)';
const INK_12       = 'rgba(28,20,16,0.12)';

export default function EditSchedule() {
  const { trip_id, dayIndex } = useLocalSearchParams();
  const router = useRouter();
  const planId = trip_id;

  const [loading, setLoading]                   = useState(true);
  const [selectedDayIndex, setSelectedDayIndex] = useState(dayIndex ? parseInt(dayIndex as string) : 0);
  const [schedule, setSchedule]                 = useState<any>(null);
  const [editedSchedule, setEditedSchedule]     = useState<any>(null);
  const [saving, setSaving]                     = useState(false);
  const [isSearchVisible, setIsSearchVisible]   = useState(false);
  const [showTimePicker, setShowTimePicker]     = useState(false);
  const [tempTimeIndex, setTempTimeIndex]       = useState<number | null>(null);
  const [tempDate, setTempDate]                 = useState(new Date());
  const [focusedField, setFocusedField]         = useState<string | null>(null);

  // ── Add activity sheet ─────────────────────────────────────────────────────
  // mode: null = closed | 'choose' = pick type | 'manual' = manual input | 'place' = Google search
  const [addMode, setAddMode]                   = useState<null | 'choose' | 'manual' | 'place'>(null);
  const [addActivityName, setAddActivityName]   = useState('');
  const [addTime, setAddTime]                   = useState('09:00');
  const [showAddTimePicker, setShowAddTimePicker] = useState(false);

  const showCustomAlert = (title: string, message: string, isSuccess = false, onConfirm = () => {}) => {
    Alert.alert(title, message, [{ text: 'OK', onPress: onConfirm }]);
  };

  // ── Fetch ──────────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      const fetchData = async () => {
        try {
          setLoading(true);
          const token = await AsyncStorage.getItem('access_token');
          const headers: any = { 'Content-Type': 'application/json' };
          if (token) headers.Authorization = `Bearer ${token}`;
          const res = await axios.get(`${API_URL}/trip_schedule/${planId}`, { headers });
          const payload = res.data?.payload;
          setSchedule(payload);
          setEditedSchedule(JSON.parse(JSON.stringify(payload)));
        } catch {
          showCustomAlert('Error', 'Failed to load schedule', false);
        } finally {
          setLoading(false);
        }
      };
      if (planId) fetchData();
    }, [planId])
  );

  // ── Edit helpers ───────────────────────────────────────────────────────────
  const updateActivity = (dayIdx: number, actIdx: number, field: string, value: string) => {
    setEditedSchedule((prev: any) => {
      const updatedItinerary = [...prev.itinerary];
      const updatedSchedule  = [...updatedItinerary[dayIdx].schedule];
      updatedSchedule[actIdx] = { ...updatedSchedule[actIdx], [field]: value };
      if (field === 'time') {
        updatedSchedule.sort((a, b) => {
          if (!a.time) return 1;
          if (!b.time) return -1;
          return a.time.localeCompare(b.time);
        });
      }
      updatedItinerary[dayIdx] = { ...updatedItinerary[dayIdx], schedule: updatedSchedule };
      return { ...prev, itinerary: updatedItinerary };
    });
  };

  const handleDragEnd = ({ data }: { data: any[] }) => {
    setEditedSchedule((prev: any) => {
      const copy = { ...prev };
      const originalTimes = copy.itinerary[selectedDayIndex].schedule.map((item: any) => item.time);
      copy.itinerary[selectedDayIndex].schedule = data.map((item, index) => ({ ...item, time: originalTimes[index] }));
      return copy;
    });
  };

  const handleDeleteActivity = (actIdx: number) => {
    Alert.alert('Delete Activity', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => setEditedSchedule((prev: any) => {
          const copy = { ...prev };
          copy.itinerary[selectedDayIndex].schedule.splice(actIdx, 1);
          return copy;
        }),
      },
    ]);
  };

  const handleAddDay = () => {
    setEditedSchedule((prev: any) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const itinerary = copy.itinerary;
      if (!itinerary || itinerary.length === 0) return copy;
      const lastDay    = itinerary[itinerary.length - 1];
      const lastDayNum = parseInt(String(lastDay.day).replace(/\D/g, ''), 10) || itinerary.length;
      copy.itinerary.push({
        day: `Day ${lastDayNum + 1}`,
        date: dayjs(lastDay.date).add(1, 'day').format('YYYY-MM-DD'),
        schedule: [],
      });
      return copy;
    });
    setSelectedDayIndex(editedSchedule.itinerary.length);
  };

  const handleDeleteDay = (dayIndexToDelete: number) => {
    if (editedSchedule.itinerary.length <= 1) {
      showCustomAlert('Action Denied', 'Your trip must have at least one day.', false);
      return;
    }
    Alert.alert('Delete Day', `Delete ${editedSchedule.itinerary[dayIndexToDelete].day}? All activities will be lost.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => {
          setEditedSchedule((prev: any) => {
            const copy = JSON.parse(JSON.stringify(prev));
            copy.itinerary.splice(dayIndexToDelete, 1);
            const baseDate = dayjs(copy.itinerary[0].date);
            copy.itinerary = copy.itinerary.map((d: any, idx: number) => ({
              ...d,
              day: `Day ${idx + 1}`,
              date: baseDate.add(idx, 'day').format('YYYY-MM-DD'),
            }));
            return copy;
          });
          setSelectedDayIndex(prev =>
            dayIndexToDelete === prev ? Math.max(0, prev - 1) :
            dayIndexToDelete < prev ? prev - 1 : prev
          );
        },
      },
    ]);
  };

  // ── Time picker ────────────────────────────────────────────────────────────
  const openTimePicker = (timeStr: string, index: number) => {
    setTempTimeIndex(index);
    const now = new Date();
    const [hh, mm] = timeStr.split(':').map(Number);
    if (!isNaN(hh) && !isNaN(mm)) { now.setHours(hh); now.setMinutes(mm); }
    setTempDate(now);
    setShowTimePicker(true);
  };

  const onTimeChange = (event: any, selectedDate?: Date) => {
    setShowTimePicker(Platform.OS === 'ios');
    if (selectedDate && tempTimeIndex !== null) {
      const hh = selectedDate.getHours().toString().padStart(2, '0');
      const mm = selectedDate.getMinutes().toString().padStart(2, '0');
      updateActivity(selectedDayIndex, tempTimeIndex, 'time', `${hh}:${mm}`);
      if (Platform.OS === 'android') setTempTimeIndex(null);
    } else {
      setTempTimeIndex(null);
    }
  };

  // ── Add place ──────────────────────────────────────────────────────────────
  // คำนวณเวลาถัดไปที่ไม่ซ้ำ
  const getNextAvailableTime = (): string => {
    const schedule = editedSchedule?.itinerary[selectedDayIndex]?.schedule ?? [];
    const usedTimes = new Set(schedule.map((s: any) => s.time));
    let hh = 9, mm = 0;
    if (schedule.length > 0) {
      const lastTime = schedule[schedule.length - 1].time;
      if (lastTime?.includes(':')) {
        [hh, mm] = lastTime.split(':').map(Number);
        hh = (hh + 1) % 24;
      }
    }
    // วนหาเวลาที่ไม่ซ้ำ
    let attempts = 0;
    while (usedTimes.has(`${hh.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}`) && attempts < 24) {
      hh = (hh + 1) % 24;
      attempts++;
    }
    return `${hh.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}`;
  };

  const openAddSheet = () => {
    setAddTime(getNextAvailableTime());
    setAddActivityName('');
    setAddMode('choose');
  };

  const handleAddTimePicked = (event: any, selectedDate?: Date) => {
    setShowAddTimePicker(Platform.OS === 'ios');
    if (!selectedDate) return;
    const hh = selectedDate.getHours().toString().padStart(2, '0');
    const mm = selectedDate.getMinutes().toString().padStart(2, '0');
    const picked = `${hh}:${mm}`;
    // เช็คว่าซ้ำกับเวลาที่มีอยู่ไหม
    const usedTimes = new Set(
      (editedSchedule?.itinerary[selectedDayIndex]?.schedule ?? []).map((s: any) => s.time)
    );
    if (usedTimes.has(picked)) {
      Alert.alert('Time Conflict', `${picked} is already used. Please choose another time.`);
      return;
    }
    setAddTime(picked);
  };

  const commitManualAdd = () => {
    if (!addActivityName.trim()) {
      Alert.alert('Required', 'Please enter an activity name.');
      return;
    }
    setEditedSchedule((prev: any) => {
      const copy = { ...prev };
      copy.itinerary[selectedDayIndex].schedule.push({
        time: addTime,
        activity: addActivityName.trim(),
        need_location: false,
        specific_location_name: '',
        lat: null, lng: null,
      });
      // sort by time
      copy.itinerary[selectedDayIndex].schedule.sort((a: any, b: any) =>
        (a.time || '').localeCompare(b.time || '')
      );
      return copy;
    });
    setAddMode(null);
    setAddActivityName('');
  };

  const onPlaceSelected = (data: any, details: any = null) => {
    const name     = data.description || data.name;
    const location = details?.geometry?.location;
    // เช็คซ้ำเวลา
    const usedTimes = new Set(
      (editedSchedule?.itinerary[selectedDayIndex]?.schedule ?? []).map((s: any) => s.time)
    );
    let time = addTime;
    if (usedTimes.has(time)) {
      // หาเวลาถัดไปอัตโนมัติ
      let hh = parseInt(time.split(':')[0]), mm = parseInt(time.split(':')[1]);
      let attempts = 0;
      do { hh = (hh + 1) % 24; attempts++; }
      while (usedTimes.has(`${hh.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}`) && attempts < 24);
      time = `${hh.toString().padStart(2,'0')}:${mm.toString().padStart(2,'0')}`;
    }
    setEditedSchedule((prev: any) => {
      const copy = { ...prev };
      copy.itinerary[selectedDayIndex].schedule.push({
        time, activity: name, need_location: true,
        specific_location_name: name,
        lat: location?.lat || null, lng: location?.lng || null,
      });
      copy.itinerary[selectedDayIndex].schedule.sort((a: any, b: any) =>
        (a.time || '').localeCompare(b.time || '')
      );
      return copy;
    });
    setAddMode(null);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const confirmPlan = async () => {
    try {
      setSaving(true);
      const token = await AsyncStorage.getItem('access_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;
      await axios.put(`${API_URL}/trip_schedule/${planId}`, { plan_id: planId, payload: editedSchedule }, { headers });
      const itinerary = editedSchedule.itinerary;
      if (itinerary?.length > 0) {
        const newEndDate = itinerary[itinerary.length - 1].date;
        await axios.put(`${API_URL}/trip_plan/${planId}`, {
          end_plan_date: dayjs(newEndDate).format('YYYY-MM-DD'),
          day_of_trip: dayjs(newEndDate).diff(dayjs(schedule.start_plan_date), 'day') + 1,
        }, { headers });
      }
      showCustomAlert('Saved!', 'Your schedule has been updated.', true, () => router.back());
    } catch {
      showCustomAlert('Error', 'Failed to save changes', false);
    } finally {
      setSaving(false);
    }
  };

  // ── Loading screen ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingScreen}>
        <LottieView
          source={require('@/assets/images/Loading.json')}
          autoPlay loop
          style={{ width: 160, height: 160 }}
        />
        <Text style={s.loadingScreenText}>Preparing your schedule...</Text>
      </View>
    );
  }

  if (!editedSchedule) return (
    <View style={s.loadingScreen}><Text style={s.loadingScreenText}>Data not found</Text></View>
  );

  const currentDay = editedSchedule.itinerary[selectedDayIndex];

  // ── Draggable item ─────────────────────────────────────────────────────────
  const renderDraggableItem = ({ item, getIndex, drag, isActive }: RenderItemParams<any>) => {
    const i = getIndex() ?? 0;
    return (
      <ScaleDecorator>
        <TouchableOpacity
          activeOpacity={1}
          onLongPress={drag}
          delayLongPress={200}
          disabled={isActive}
          style={[s.cardWrap, isActive && s.cardWrapActive]}
        >
          {/* Left time column */}
          <View style={s.cardTimeCol}>
            <TouchableOpacity style={s.timeBubble} onPress={() => openTimePicker(item.time, i)} activeOpacity={0.8}>
              <Ionicons name="time-outline" size={11} color={WASHI} style={{ marginBottom: 2 }} />
              <Text style={s.timeBubbleText}>{item.time}</Text>
            </TouchableOpacity>
            <View style={s.timeConnector} />
          </View>

          {/* Card body */}
          <View style={[s.card, isActive && s.cardActive]}>
            {/* Drag handle */}
            <View style={s.dragHandle}>
              <Ionicons name="reorder-two" size={18} color={INK_30} />
            </View>

            {/* Activity input */}
            <View style={s.cardInner}>
              <Text style={s.cardLabel}>Activity</Text>
              <TextInput
                style={[s.cardInput, focusedField === `act-${i}` && s.inputFocused]}
                multiline
                value={item.activity}
                onChangeText={val => updateActivity(selectedDayIndex, i, 'activity', val)}
                onFocus={() => setFocusedField(`act-${i}`)}
                onBlur={() => setFocusedField(null)}
                placeholderTextColor={INK_30}
              />
            </View>

            {/* Delete button */}
            <TouchableOpacity style={s.deleteBtn} onPress={() => handleDeleteActivity(i)} activeOpacity={0.8}>
              <Ionicons name="trash-outline" size={15} color={BENI} />
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </ScaleDecorator>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={s.screen}>

        {/* ── Day selector header ── */}
        <View style={s.header}>
          <View style={s.headerTopBar} />
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={s.dayStrip}
          >
            {editedSchedule.itinerary.map((item: any, index: number) => {
              const isSelected = selectedDayIndex === index;
              return (
                <View key={index} style={s.dayChipWrap}>
                  <TouchableOpacity
                    style={[s.dayChip, isSelected && s.dayChipActive]}
                    onPress={() => setSelectedDayIndex(index)}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.dayChipDay, isSelected && s.dayChipDayActive]}>{item.day}</Text>
                    <Text style={[s.dayChipDate, isSelected && s.dayChipDateActive]}>
                      {dayjs(item.date).format('D MMM')}
                    </Text>
                    {isSelected && <View style={s.dayChipDot} />}
                  </TouchableOpacity>

                  {/* Delete day badge */}
                  <TouchableOpacity
                    style={s.deleteDayBadge}
                    onPress={() => handleDeleteDay(index)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="close" size={8} color={WHITE} />
                  </TouchableOpacity>
                </View>
              );
            })}

            {/* Add day button */}
            <TouchableOpacity style={s.addDayBtn} onPress={handleAddDay} activeOpacity={0.8}>
              <Ionicons name="add" size={14} color={KINCHA_LIGHT} />
              <Text style={s.addDayText}>Add Day</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* ── Day title + Add activity ── */}
        <View style={s.dayTitleRow}>
          <View style={s.dayTitleLeft}>
            <View style={s.dayTitleBar} />
            <Text style={s.dayTitle}>{currentDay.day}</Text>
            <Text style={s.dayDate}>{dayjs(currentDay.date).format('D MMM YYYY')}</Text>
          </View>

          <TouchableOpacity style={s.addActivityBtn} onPress={openAddSheet} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={14} color={WASHI} />
            <Text style={s.addActivityText}>Add</Text>
          </TouchableOpacity>
        </View>

        {/* Kincha divider */}
        <View style={s.divRow}>
          <View style={s.divLine} />
          <Text style={s.divDot}>✦</Text>
          <View style={s.divLine} />
        </View>

        {/* ── Draggable list ── */}
        <View style={s.listWrap}>
          <DraggableFlatList
            data={currentDay.schedule}
            onDragEnd={handleDragEnd}
            keyExtractor={(item, index) => `item-${index}`}
            renderItem={renderDraggableItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingTop: 8, paddingBottom: 100 }}
            ListEmptyComponent={
              <View style={s.emptyWrap}>
                <Ionicons name="calendar-outline" size={32} color={INK_30} />
                <Text style={s.emptyText}>No activities yet</Text>
                <Text style={s.emptySubText}>Tap "Add" to add a place</Text>
              </View>
            }
          />

          {showTimePicker && (
            <DateTimePicker
              value={tempDate}
              mode="time"
              is24Hour
              display="default"
              onChange={onTimeChange}
            />
          )}
        </View>

        {/* ── Save footer ── */}
        <View style={s.footer}>
          <TouchableOpacity style={s.saveBtn} onPress={confirmPlan} disabled={saving} activeOpacity={0.85}>
            <Ionicons name="checkmark-circle-outline" size={16} color={WASHI} />
            <Text style={s.saveBtnText}>Save Changes</Text>
          </TouchableOpacity>
        </View>

        {/* ── Add Activity Sheet ── */}
        {addMode !== null && (
          <View style={s.searchOverlay}>
            <SafeAreaView style={{ flex: 1 }}>
              <View style={s.searchTopBar} />

              {/* Header */}
              <View style={s.searchHeaderRow}>
                <View style={s.searchHeaderLeft}>
                  {addMode !== 'choose' && (
                    <TouchableOpacity onPress={() => setAddMode('choose')} style={{ marginRight: 8 }}>
                      <Ionicons name="arrow-back" size={18} color={WASHI} />
                    </TouchableOpacity>
                  )}
                  <View style={s.searchHeaderAccent} />
                  <Text style={s.searchHeaderTitle}>
                    {addMode === 'choose' ? 'Add Activity' : addMode === 'manual' ? 'Manual Entry' : 'Search Place'}
                  </Text>
                </View>
                <TouchableOpacity style={s.searchCloseBtn} onPress={() => setAddMode(null)}>
                  <Ionicons name="close" size={16} color={WASHI} />
                </TouchableOpacity>
              </View>

              {/* ── Time picker row (shared) ── */}
              <View style={s.addTimeRow}>
                <Ionicons name="time-outline" size={14} color={BENI} />
                <Text style={s.addTimeLabel}>Time</Text>
                <TouchableOpacity
                  style={s.addTimePill}
                  onPress={() => setShowAddTimePicker(true)}
                  activeOpacity={0.8}
                >
                  <Text style={s.addTimePillText}>{addTime}</Text>
                  <Ionicons name="chevron-down" size={12} color={KINCHA_LIGHT} />
                </TouchableOpacity>
              </View>
              {showAddTimePicker && (
                <DateTimePicker
                  value={(() => { const d = new Date(); const [hh, mm] = addTime.split(':').map(Number); d.setHours(hh); d.setMinutes(mm); return d; })()}
                  mode="time" is24Hour display="default"
                  onChange={handleAddTimePicked}
                />
              )}

              <View style={s.divRow} />

              {/* ── Mode: Choose ── */}
              {addMode === 'choose' && (
                <View style={s.chooseWrap}>
                  <TouchableOpacity style={s.chooseCard} onPress={() => setAddMode('manual')} activeOpacity={0.85}>
                    <View style={s.chooseIcon}>
                      <Ionicons name="create-outline" size={22} color={BENI} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.chooseTitle}>Manual Entry</Text>
                      <Text style={s.chooseSub}>Type activity name yourself</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={INK_30} />
                  </TouchableOpacity>

                  <TouchableOpacity style={s.chooseCard} onPress={() => setAddMode('place')} activeOpacity={0.85}>
                    <View style={[s.chooseIcon, { backgroundColor: 'rgba(184,150,62,0.08)' }]}>
                      <Ionicons name="location-outline" size={22} color={KINCHA} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.chooseTitle}>Search Place</Text>
                      <Text style={s.chooseSub}>Find via Google Places</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color={INK_30} />
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Mode: Manual ── */}
              {addMode === 'manual' && (
                <View style={s.manualWrap}>
                  <Text style={s.manualLabel}>Activity Name</Text>
                  <TextInput
                    style={s.manualInput}
                    placeholder="e.g. Lunch at Tsukiji Market"
                    placeholderTextColor={INK_30}
                    value={addActivityName}
                    onChangeText={setAddActivityName}
                    autoFocus
                    selectionColor={BENI}
                    multiline
                    textAlignVertical="top"
                  />
                  <TouchableOpacity
                    style={[s.manualAddBtn, !addActivityName.trim() && s.manualAddBtnDisabled]}
                    onPress={commitManualAdd}
                    disabled={!addActivityName.trim()}
                    activeOpacity={0.85}
                  >
                    <Ionicons name="add-circle-outline" size={15} color={WASHI} />
                    <Text style={s.manualAddBtnText}>Add Activity</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* ── Mode: Place search ── */}
              {addMode === 'place' && (
                <View style={s.searchBody}>
                  <GooglePlacesAutocomplete
                    placeholder="Search place name..."
                    onPress={onPlaceSelected}
                    query={{ key: GOOGLE_API_KEY, language: 'en', components: 'country:jp' }}
                    fetchDetails debounce={400} minLength={2}
                    nearbyPlacesAPI="GooglePlacesSearch"
                    styles={{
                      textInputContainer: { marginBottom: 8 },
                      textInput: { backgroundColor: WASHI_DARK, borderRadius: 99, paddingHorizontal: 16, height: 44, fontSize: 14, fontFamily: 'NotoSansJP_400Regular', color: SUMI, borderWidth: 0 },
                      listView: { backgroundColor: WHITE, borderRadius: 12, borderWidth: 1, borderColor: INK_12, overflow: 'hidden' },
                      row: { padding: 14, borderBottomWidth: 0.5, borderBottomColor: INK_12 },
                      description: { fontSize: 13, fontFamily: 'NotoSansJP_400Regular', color: SUMI },
                    }}
                    enablePoweredByContainer={false}
                    onFail={() => showCustomAlert('Error', 'No results found. Please try again', false)}
                  />
                </View>
              )}
            </SafeAreaView>
          </View>
        )}
      </SafeAreaView>

      {/* ── Saving modal ── */}
      <Modal transparent animationType="fade" visible={saving}>
        <View style={m.overlay}>
          <View style={m.card}>
            <View style={m.topBar} />
            <LottieView
              source={require('@/assets/images/Loading.json')}
              autoPlay loop
              style={{ width: 130, height: 130 }}
            />
            <Text style={m.title}>Saving...</Text>
          </View>
        </View>
      </Modal>

    </GestureHandlerRootView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: WASHI },

  // Loading
  loadingScreen: { flex: 1, backgroundColor: WASHI, alignItems: 'center', justifyContent: 'center', gap: 8 },
  loadingScreenText: { fontSize: 15, fontFamily: 'ShipporiMincho_700Bold', color: SUMI },

  // Header
  header: { backgroundColor: SUMI },
  headerTopBar: { height: 3, backgroundColor: BENI },
  dayStrip: { paddingHorizontal: 16, paddingVertical: 12, gap: 8, alignItems: 'center' },

  // Day chip
  dayChipWrap: { position: 'relative' },
  dayChip: {
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 14, backgroundColor: 'rgba(250,245,236,0.1)',
    minWidth: 64, borderWidth: 1, borderColor: 'rgba(250,245,236,0.15)',
  },
  dayChipActive: {
    backgroundColor: WASHI, borderColor: WASHI,
    shadowColor: WASHI, shadowOpacity: 0.2, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  dayChipDay: { fontSize: 12, fontFamily: 'NotoSansJP_700Bold', color: 'rgba(250,245,236,0.6)' },
  dayChipDayActive: { color: SUMI },
  dayChipDate: { fontSize: 10, fontFamily: 'NotoSansJP_400Regular', color: 'rgba(250,245,236,0.4)', marginTop: 1 },
  dayChipDateActive: { color: INK_60 },
  dayChipDot: {
    position: 'absolute', bottom: -1, left: '50%',
    width: 4, height: 4, borderRadius: 2, backgroundColor: BENI,
    transform: [{ translateX: -2 }],
  },
  deleteDayBadge: {
    position: 'absolute', top: 0, right: -3,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: BENI, alignItems: 'center', justifyContent: 'center',
    zIndex: 10,
  },
  addDayBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 14,
    borderWidth: 1, borderColor: KINCHA, backgroundColor: 'rgba(184,150,62,0.1)',
  },
  addDayText: { fontSize: 11, fontFamily: 'NotoSansJP_700Bold', color: KINCHA_LIGHT },

  // Day title row
  dayTitleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8,
  },
  dayTitleLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayTitleBar: { width: 3, height: 18, backgroundColor: BENI, borderRadius: 99 },
  dayTitle: { fontSize: 16, fontFamily: 'ShipporiMincho_700Bold', color: SUMI },
  dayDate: { fontSize: 11, fontFamily: 'NotoSansJP_400Regular', color: INK_30, marginLeft: 4 },
  addActivityBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: BENI, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 99,
    shadowColor: BENI, shadowOpacity: 0.25, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 3,
  },
  addActivityText: { fontSize: 12, fontFamily: 'NotoSansJP_700Bold', color: WASHI },

  // Divider
  divRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 4 },
  divLine: { flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.3 },
  divDot: { fontSize: 7, color: KINCHA, marginHorizontal: 8, opacity: 0.45 },

  // List
  listWrap: { flex: 1, paddingHorizontal: 16 },

  // Draggable card
  cardWrap: {
    flexDirection: 'row', alignItems: 'flex-start',
    marginBottom: 4, gap: 10,
  },
  cardWrapActive: { opacity: 0.85 },

  // Time column
  cardTimeCol: { alignItems: 'center', paddingTop: 6, width: 46 },
  timeBubble: {
    width: 44, paddingVertical: 5,
    backgroundColor: SUMI, borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  timeBubbleText: { fontSize: 11, fontFamily: 'NotoSansJP_700Bold', color: WASHI, letterSpacing: 0.2 },
  timeConnector: { width: 1.5, flex: 1, minHeight: 20, backgroundColor: INK_12, marginTop: 3 },

  // Card
  card: {
    flex: 1, backgroundColor: WHITE,
    borderRadius: 14, borderWidth: 1, borderColor: INK_12,
    padding: 12, marginBottom: 8,
    shadowColor: SUMI, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
    flexDirection: 'row', alignItems: 'center', gap: 8,
  },
  cardActive: { borderColor: KINCHA, borderWidth: 1.5, shadowColor: KINCHA, shadowOpacity: 0.15, elevation: 3 },
  dragHandle: { paddingRight: 4 },
  cardInner: { flex: 1 },
  cardLabel: { fontSize: 9, fontFamily: 'NotoSansJP_700Bold', color: INK_30, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 5 },
  cardInput: {
    fontSize: 13, fontFamily: 'NotoSansJP_400Regular', color: SUMI,
    backgroundColor: WASHI_DARK, borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 8,
    borderWidth: 1, borderColor: INK_12,
    minHeight: 40,
  },
  inputFocused: { borderColor: BENI, borderWidth: 1.5 },
  deleteBtn: {
    width: 28, height: 28, borderRadius: 99,
    backgroundColor: 'rgba(192,57,43,0.07)',
    borderWidth: 1, borderColor: 'rgba(192,57,43,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 14, fontFamily: 'NotoSansJP_500Medium', color: INK_30 },
  emptySubText: { fontSize: 12, fontFamily: 'NotoSansJP_400Regular', color: INK_30 },

  // Footer
  footer: {
    paddingHorizontal: 16, paddingTop: 12, paddingBottom: 20,
    backgroundColor: WASHI,
    borderTopWidth: 1, borderTopColor: INK_12,
  },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: BENI, paddingVertical: 14, borderRadius: 99,
    shadowColor: BENI, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  saveBtnText: { fontSize: 15, fontFamily: 'NotoSansJP_700Bold', color: WASHI, letterSpacing: 0.3 },

  // Search overlay
  searchOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: WASHI, zIndex: 9999, elevation: 9999,
  },
  searchTopBar: { height: 3, backgroundColor: BENI },
  searchHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14,
    backgroundColor: SUMI,
  },
  searchHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  searchHeaderAccent: { width: 3, height: 16, backgroundColor: BENI, borderRadius: 99 },
  searchHeaderTitle: { fontSize: 16, fontFamily: 'ShipporiMincho_700Bold', color: WASHI },
  searchCloseBtn: {
    width: 28, height: 28, borderRadius: 99,
    backgroundColor: 'rgba(250,245,236,0.15)', alignItems: 'center', justifyContent: 'center',
  },
  searchBody: { flex: 1, padding: 16 },

  // Add time row
  addTimeRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 12,
    backgroundColor: WASHI,
  },
  addTimeLabel: { fontSize: 13, fontFamily: 'NotoSansJP_500Medium', color: INK_60, flex: 1 },
  addTimePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: SUMI, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 99,
  },
  addTimePillText: { fontSize: 14, fontFamily: 'NotoSansJP_700Bold', color: WASHI, letterSpacing: 0.5 },

  // Choose mode
  chooseWrap: { flex: 1, padding: 16, gap: 12 },
  chooseCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: WHITE, borderRadius: 16,
    padding: 16, borderWidth: 1, borderColor: INK_12,
    shadowColor: SUMI, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  chooseIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: BENI_LIGHT, alignItems: 'center', justifyContent: 'center',
  },
  chooseTitle: { fontSize: 14, fontFamily: 'NotoSansJP_700Bold', color: SUMI },
  chooseSub: { fontSize: 11, fontFamily: 'NotoSansJP_400Regular', color: INK_30, marginTop: 2 },

  // Manual mode
  manualWrap: { flex: 1, padding: 16 },
  manualLabel: { fontSize: 10, fontFamily: 'NotoSansJP_700Bold', color: INK_30, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  manualInput: {
    backgroundColor: WHITE, borderRadius: 14, borderWidth: 1.2, borderColor: INK_12,
    paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: 'NotoSansJP_400Regular', color: SUMI,
    minHeight: 90, marginBottom: 16,
  },
  manualAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: BENI, paddingVertical: 14, borderRadius: 99,
    shadowColor: BENI, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  manualAddBtnDisabled: { backgroundColor: WASHI_DARK, shadowOpacity: 0, elevation: 0 },
  manualAddBtnText: { fontSize: 14, fontFamily: 'NotoSansJP_700Bold', color: WASHI },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28,20,16,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  card: {
    width: '85%', maxWidth: 300,
    backgroundColor: WASHI, borderRadius: 24, overflow: 'hidden',
    alignItems: 'center', paddingHorizontal: 24, paddingBottom: 24,
    shadowColor: SUMI, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  topBar: { height: 3, backgroundColor: BENI, width: '100%', marginBottom: 8 },
  title: { fontSize: 15, fontFamily: 'ShipporiMincho_700Bold', color: SUMI, marginTop: 4, textAlign: 'center' },
});