import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Pressable,
  ScrollView, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/api.js';
import dayjs from 'dayjs';

const BENI   = '#C0392B';
const SUMI   = '#1C1410';
const WASHI  = '#FAF5EC';
const INK_60 = 'rgba(28,20,16,0.6)';
const WHITE  = '#FFFFFF';

interface Attraction {
  title: string;
  imageRef: string;
  rating?: number;
  description?: string;
  lat?: number | null;
  lng?: number | null;
}

interface Props {
  visible: boolean;
  attraction: Attraction | null;
  onClose: () => void;
}

const getStatus = (start: string, end: string) => {
  const now = new Date();
  if (now < new Date(start)) return 'Upcoming';
  if (now <= new Date(end)) return 'On Trip';
  return 'Trip Ended';
};

const getNextTime = (schedule: any[]): string => {
  if (!schedule || schedule.length === 0) return '09:00';
  const times = schedule.map((a: any) => a.time).filter(Boolean).sort();
  let next = '09:00';
  for (const t of times) {
    if (t >= next) {
      const [h] = t.split(':').map(Number);
      next = `${String(h + 1).padStart(2, '0')}:00`;
    }
  }
  return next;
};

const hasDuplicate = (schedule: any[], name: string): boolean =>
  (schedule || []).some(
    (a: any) => a.specific_location_name === name || a.activity === name
  );

export default function AddToTripModal({ visible, attraction, onClose }: Props) {
  const [trips, setTrips]             = useState<any[]>([]);
  const [loading, setLoading]         = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<any>(null);
  const [schedule, setSchedule]       = useState<any>(null);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [saving, setSaving]           = useState(false);

  // Reset state on open
  useEffect(() => {
    if (visible && attraction) {
      setSelectedTrip(null);
      setSchedule(null);
      setSelectedDay(null);
      fetchTrips();
    }
  }, [visible]);

  const fetchTrips = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;
      const res = await axios.get(`${API_URL}/trip_plan`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const filtered = (res.data || []).filter((t: any) => {
        const status = getStatus(t.start_plan_date, t.end_plan_date);
        return status === 'Upcoming' || status === 'On Trip';
      });
      setTrips(filtered);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  };

  const fetchSchedule = async (planId: number) => {
    setScheduleLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const res = await axios.get(`${API_URL}/trip_schedule/${planId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setSchedule(res.data?.payload || null);
    } catch {
      setSchedule(null);
    }
    finally { setScheduleLoading(false); }
  };

  const handleSelectTrip = (trip: any) => {
    setSelectedTrip(trip);
    setSelectedDay(null);
    fetchSchedule(trip.plan_id);
  };

  const handleAdd = async () => {
    if (!selectedTrip || selectedDay === null || !schedule || !attraction) return;
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      const itinerary = [...schedule.itinerary];
      const day = itinerary[selectedDay];
      const daySchedule = [...(day.schedule || [])];

      const newActivity = {
        time: getNextTime(daySchedule),
        activity: attraction.title,
        need_location: true,
        specific_location_name: attraction.title,
        lat: attraction.lat ?? null,
        lng: attraction.lng ?? null,
      };

      daySchedule.push(newActivity);
      daySchedule.sort((a: any, b: any) => (a.time || '').localeCompare(b.time || ''));
      itinerary[selectedDay] = { ...day, schedule: daySchedule };

      const updatedPayload = { ...schedule, itinerary };

      await axios.put(
        `${API_URL}/trip_schedule/${selectedTrip.plan_id}`,
        { plan_id: selectedTrip.plan_id, payload: updatedPayload },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      Alert.alert('Added!', `${attraction.title} was added to ${day.day}.`);
      onClose();
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'Failed to add activity. Please try again.');
    } finally { setSaving(false); }
  };

  const itinerary = schedule?.itinerary || [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ms.overlay} onPress={onClose}>
        <Pressable style={ms.sheet} onPress={e => e.stopPropagation()}>
          {/* Header */}
          <View style={ms.topBar} />
          <View style={ms.header}>
            <Text style={ms.headerTitle}>Add to Trip</Text>
            <TouchableOpacity onPress={onClose} style={ms.closeBtn}>
              <Ionicons name="close" size={18} color={INK_60} />
            </TouchableOpacity>
          </View>

          {/* Attraction name */}
          {attraction && (
            <View style={ms.attractionRow}>
              <View style={ms.attractionDot} />
              <Text style={ms.attractionName} numberOfLines={1}>{attraction.title}</Text>
            </View>
          )}

          <View style={ms.divider} />

          <ScrollView style={ms.content} showsVerticalScrollIndicator={false}>
            {/* Step 1 — Trip list */}
            {!selectedTrip && (
              <>
                <Text style={ms.stepLabel}>Select a Trip</Text>
                {loading ? (
                  <ActivityIndicator color={BENI} style={{ marginTop: 24 }} />
                ) : trips.length === 0 ? (
                  <View style={ms.emptyWrap}>
                    <Ionicons name="airplane-outline" size={32} color={INK_60} />
                    <Text style={ms.emptyText}>No upcoming or active trips</Text>
                  </View>
                ) : (
                  trips.map((trip) => {
                    const status = getStatus(trip.start_plan_date, trip.end_plan_date);
                    return (
                      <TouchableOpacity
                        key={trip.plan_id}
                        style={ms.tripCard}
                        onPress={() => handleSelectTrip(trip)}
                        activeOpacity={0.8}
                      >
                        <View style={ms.tripCardLeft}>
                          <Text style={ms.tripName} numberOfLines={1}>{trip.name_group}</Text>
                          <Text style={ms.tripDate}>
                            {dayjs(trip.start_plan_date).format('D MMM')} – {dayjs(trip.end_plan_date).format('D MMM')}
                          </Text>
                        </View>
                        <View style={[ms.statusPill, status === 'On Trip' && ms.statusOn]}>
                          <Text style={[ms.statusText, status === 'On Trip' && ms.statusTextOn]}>
                            {status}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                )}
              </>
            )}

            {/* Step 2 — Day selection */}
            {selectedTrip && (
              <>
                {/* Back to trip list */}
                <TouchableOpacity style={ms.backRow} onPress={() => { setSelectedTrip(null); setSchedule(null); setSelectedDay(null); }}>
                  <Ionicons name="chevron-back" size={16} color={BENI} />
                  <Text style={ms.backText}>{selectedTrip.name_group}</Text>
                </TouchableOpacity>

                <Text style={ms.stepLabel}>Select a Day</Text>

                {scheduleLoading ? (
                  <ActivityIndicator color={BENI} style={{ marginTop: 24 }} />
                ) : itinerary.length === 0 ? (
                  <View style={ms.emptyWrap}>
                    <Ionicons name="calendar-outline" size={32} color={INK_60} />
                    <Text style={ms.emptyText}>No schedule found for this trip</Text>
                  </View>
                ) : (
                  <View style={ms.dayGrid}>
                    {itinerary.map((day: any, idx: number) => {
                      const duplicate = hasDuplicate(day.schedule, attraction?.title || '');
                      const selected  = selectedDay === idx;
                      return (
                        <TouchableOpacity
                          key={idx}
                          style={[
                            ms.dayChip,
                            selected && ms.dayChipSelected,
                            duplicate && ms.dayChipDisabled,
                          ]}
                          onPress={() => { if (!duplicate) setSelectedDay(idx); }}
                          activeOpacity={duplicate ? 1 : 0.8}
                          disabled={duplicate}
                        >
                          <Text style={[
                            ms.dayChipText,
                            selected && ms.dayChipTextSelected,
                            duplicate && ms.dayChipTextDisabled,
                          ]}>
                            {day.day}
                          </Text>
                          <Text style={[
                            ms.dayChipDate,
                            selected && { color: 'rgba(255,255,255,0.7)' },
                            duplicate && { color: 'rgba(28,20,16,0.25)' },
                          ]}>
                            {day.date ? dayjs(day.date).format('D MMM') : ''}
                          </Text>
                          {duplicate && (
                            <Text style={ms.dayChipDup}>Already added</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </>
            )}
          </ScrollView>

          {/* Add button */}
          {selectedTrip && selectedDay !== null && (
            <View style={ms.footer}>
              <TouchableOpacity
                style={[ms.addBtn, saving && { opacity: 0.5 }]}
                onPress={handleAdd}
                disabled={saving}
                activeOpacity={0.85}
              >
                <Ionicons name="add-circle-outline" size={18} color={WHITE} />
                <Text style={ms.addBtnText}>{saving ? 'Adding...' : 'Add Activity'}</Text>
              </TouchableOpacity>
            </View>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const ms = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(28,20,16,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: WASHI,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    overflow: 'hidden',
  },
  topBar: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#D5CFC6', alignSelf: 'center', marginTop: 10 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 4,
  },
  headerTitle: { fontSize: 16, fontWeight: '800', color: SUMI },
  closeBtn: { padding: 4 },
  attractionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingBottom: 10,
  },
  attractionDot: { width: 3, height: 14, borderRadius: 2, backgroundColor: BENI },
  attractionName: { fontSize: 13, fontWeight: '600', color: INK_60, flex: 1 },
  divider: { height: 1, backgroundColor: '#E8E2D8', marginHorizontal: 18 },
  content: { paddingHorizontal: 18, paddingTop: 18, paddingBottom: 16 },
  stepLabel: { fontSize: 13, fontWeight: '700', color: SUMI, marginBottom: 16 },
  emptyWrap: { alignItems: 'center', paddingTop: 32, gap: 8, paddingBottom: 16 },
  emptyText: { fontSize: 13, color: INK_60 },

  // Trip cards
  tripCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#E8E2D8',
  },
  tripCardLeft: { flex: 1 },
  tripName: { fontSize: 14, fontWeight: '700', color: SUMI, marginBottom: 2 },
  tripDate: { fontSize: 11, color: INK_60 },
  statusPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#E8E2D8',
  },
  statusOn: { backgroundColor: BENI + '18' },
  statusText: { fontSize: 10, fontWeight: '700', color: INK_60 },
  statusTextOn: { color: BENI },

  // Back row
  backRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 12 },
  backText: { fontSize: 13, fontWeight: '600', color: BENI },

  // Day chips
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: WHITE,
    borderWidth: 1.5,
    borderColor: '#E0D8CF',
    alignItems: 'center',
    minWidth: 80,
  },
  dayChipSelected: { backgroundColor: BENI, borderColor: BENI },
  dayChipDisabled: { backgroundColor: '#F0EBE3', borderColor: '#E8E2D8', opacity: 0.7 },
  dayChipText: { fontSize: 13, fontWeight: '700', color: SUMI },
  dayChipTextSelected: { color: WHITE },
  dayChipTextDisabled: { color: 'rgba(28,20,16,0.3)' },
  dayChipDate: { fontSize: 10, color: INK_60, marginTop: 2 },
  dayChipDup: { fontSize: 8, color: BENI, marginTop: 2, fontWeight: '600' },

  // Footer
  footer: { paddingHorizontal: 18, paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#E8E2D8' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: BENI,
    paddingVertical: 13,
    borderRadius: 12,
  },
  addBtnText: { fontSize: 14, fontWeight: '700', color: WHITE },
});
