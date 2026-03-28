// app/trip/after-create.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform,
  Image, FlatList, Modal, Pressable, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import DateTimePicker from '@react-native-community/datetimepicker';
import { API_URL, GOOGLE_API_KEY } from '@/api.js';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import ApproveAnimation from '@/components/ui/Alert/ApproveAnimation';
import WrongAnimation from '@/components/ui/Alert/WrongAnimation';

import { SUMI, BENI, WASHI, WASHI_DARK, KINCHA, WHITE, INK_60, INK_30, INK_12 } from '@/constants/theme';

// ─── Types ────────────────────────────────────────────────────────────────────
type City = { id: number; name: string };

interface AttractionItem {
  attraction_id: number;
  name: string;
  photo_ref: string;
  rating: number;
  city_name?: string;
}

// ─── PlaceChip ───────────────────────────────────────────────────────────────
const CHIP_W = 100;
const CHIP_H = 120;

function PlaceChip({ item, selected, onPress }: {
  item: AttractionItem;
  selected: boolean;
  onPress: () => void;
}) {
  const fallback = `https://picsum.photos/seed/${item.attraction_id}/200/200`;
  let imgUri = fallback;
  if (item.photo_ref?.startsWith('/static')) {
    imgUri = `${API_URL}${item.photo_ref}`;
  } else if (item.photo_ref?.startsWith('http')) {
    imgUri = item.photo_ref;
  } else if (item.photo_ref && GOOGLE_API_KEY) {
    imgUri = `https://places.googleapis.com/v1/${item.photo_ref}/media?maxHeightPx=200&maxWidthPx=200&key=${GOOGLE_API_KEY}`;
  }

  const [imgError, setImgError] = React.useState(false);
  const resolvedUri = imgError ? fallback : imgUri;

  return (
    <TouchableOpacity style={[pc.chip, selected && pc.chipSelected]} onPress={onPress} activeOpacity={0.8}>
      <Image source={{ uri: resolvedUri }} style={pc.img} resizeMode="cover" onError={() => setImgError(true)} />
      <View style={pc.scrim} />
      {item.rating != null && (
        <View style={pc.ratingBadge}>
          <Ionicons name="star" size={8} color="#D4AF55" />
          <Text style={pc.ratingText}>{item.rating.toFixed(1)}</Text>
        </View>
      )}
      {selected && (
        <View style={pc.overlay}>
          <Ionicons name="checkmark-circle" size={26} color={WHITE} />
        </View>
      )}
      <View style={pc.nameWrap}>
        <Text style={pc.nameText} numberOfLines={2}>{item.name}</Text>
      </View>
    </TouchableOpacity>
  );
}

const pc = StyleSheet.create({
  chip: {
    width: CHIP_W, height: CHIP_H,
    borderRadius: 10, overflow: 'hidden',
    marginRight: 10,
    borderWidth: 2, borderColor: 'transparent',
    backgroundColor: WASHI_DARK,
  },
  chipSelected: { borderColor: BENI },
  img:   { width: '100%', height: '100%', position: 'absolute' },
  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,20,16,0.30)' },
  ratingBadge: {
    position: 'absolute', top: 5, right: 5,
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: 'rgba(28,20,16,0.72)',
    paddingHorizontal: 4, paddingVertical: 2, borderRadius: 3,
  },
  ratingText: { fontSize: 8, color: '#D4AF55', fontWeight: '800' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(192,57,43,0.45)',
    justifyContent: 'center', alignItems: 'center',
  },
  nameWrap: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: 'rgba(28,20,16,0.60)',
    paddingHorizontal: 6, paddingVertical: 5,
  },
  nameText: { fontSize: 9, color: WHITE, fontWeight: '700', lineHeight: 13 },
});

const CLOUD_NAME    = 'dqghrasqe';
const UPLOAD_PRESET = 'TabiGo';

const toDDMMYYYY = (d: Date) => {
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}/${mm}/${d.getFullYear()}`;
};
const toYMD = (d: Date) => {
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
};

// ─── Elegant Helpers ─────────────────────────────────────────────────────────
// Modern section header with a smooth Kincha (Gold) pill
const SectionHeader = ({ label }: { label: string }) => (
  <View style={s.sectionHeader}>
    <View style={s.sectionBar} />
    <Text style={s.sectionLabel}>{label}</Text>
  </View>
);

// The elegant gold divider from your original theme
const WashiDivider = () => (
  <View style={s.dividerRow}>
    <View style={s.dividerLine} />
    <Text style={s.dividerDot}>✦</Text>
    <View style={s.dividerLine} />
  </View>
);

// ─── Main component ───────────────────────────────────────────────────────────
export default function AICreateTrip() {
  const router = useRouter();

  const [tripName, setTripName]           = useState('');
  const [cities, setCities]               = useState<City[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [triprequest, setTripRequest]     = useState('');
  const [cityModalVisible, setCityModalVisible] = useState(false);
  const [citySearch, setCitySearch]       = useState('');
  const [loadingCities, setLoadingCities] = useState(false);
  const [imageUri, setImageUri]           = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const [startDate, setStartDate]         = useState<Date>(today);
  const [endDate, setEndDate]             = useState<Date>(today);
  const [picker, setPicker]               = useState<{ show: boolean; mode: 'start' | 'end' }>({ show: false, mode: 'start' });

  const [loading, setLoading]             = useState(false);
  const [alertConfig, setAlertConfig]     = useState({
    visible: false, title: '', message: '', isSuccess: false, onConfirm: () => {},
  });

  const [focusedField, setFocusedField]   = useState<string | null>(null);
  const [isGroupTrip, setIsGroupTrip]     = useState(false);

  // ── Place picker ─────────────────────────────────────────────────────────
  const [allAttractions, setAllAttractions] = useState<AttractionItem[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<number[]>([]);
  const [placeSearch, setPlaceSearch] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/attractions/`)
      .then(res => setAllAttractions(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  const filteredAttractions = useMemo(() => {
    const byCities = allAttractions.filter(a => a.city_name && selectedCities.includes(a.city_name));
    if (!placeSearch.trim()) return byCities;
    const q = placeSearch.trim().toLowerCase();
    return byCities.filter(a => a.name.toLowerCase().includes(q));
  }, [allAttractions, selectedCities, placeSearch]);

  useEffect(() => { setSelectedPlaces([]); setPlaceSearch(''); }, [selectedCities]);

  const togglePlace = (id: number) =>
    setSelectedPlaces(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const showCustomAlert = (title: string, message: string, isSuccess = false, onConfirm = () => {}) =>
    setAlertConfig({ visible: true, title, message, isSuccess, onConfirm });

  const closeAlert = () => {
    const cb = alertConfig.onConfirm;
    setAlertConfig(p => ({ ...p, visible: false }));
    cb();
  };

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingCities(true);
        const token = await AsyncStorage.getItem('access_token');
        const headers: any = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;
        const res = await axios.get(`${API_URL}/cities`, { headers, timeout: 15000 });
        const rows = Array.isArray(res.data) ? res.data : res.data?.items ?? [];
        const normalized: City[] = rows
          .map((c: any) => ({ id: Number(c.id), name: String(c.name) }))
          .filter((x: City) => Number.isFinite(x.id) && x.name);
        if (mounted) setCities(normalized);
      } catch (e) {
        if (mounted) Alert.alert('Connection Error', 'Failed to load cities.');
      } finally {
        if (mounted) setLoadingCities(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const filteredCities = useMemo(() => {
    const q = citySearch.trim().toLowerCase();
    return q ? cities.filter(c => c.name.toLowerCase().includes(q)) : cities;
  }, [cities, citySearch]);

  const toggleCity = (name: string) =>
    setSelectedCities(p => p.includes(name) ? p.filter(n => n !== name) : [...p, name]);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission required', 'Please allow photo access to set a cover.'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.7,
    });
    if (!result.canceled) setImageUri(result.assets[0].uri);
  };

  const uploadToCloudinary = async (uri: string) => {
    const data = new FormData();
    const filename = uri.split('/').pop();
    const match = /\.(\w+)$/.exec(filename || '');
    const type = match ? `image/${match[1]}` : 'image';
    // @ts-ignore
    data.append('file', { uri, name: filename, type });
    data.append('upload_preset', UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST', body: data, headers: { 'content-type': 'multipart/form-data' },
    });
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.secure_url;
  };

  const onChangeDate = (_: any, selected?: Date) => {
    setPicker(p => ({ ...p, show: false }));
    if (!selected) return;
    const picked = new Date(selected); picked.setHours(0, 0, 0, 0);
    if (picked < today) { Alert.alert('Cannot select a past date'); return; }
    if (picker.mode === 'start') {
      setStartDate(picked);
      if (picked > endDate) setEndDate(picked);
    } else {
      if (picked < startDate) { Alert.alert('End date cannot be before start date'); return; }
      setEndDate(picked);
    }
  };

  const onCreateWithAI = async () => {
    if (!tripName.trim()) { showCustomAlert('Missing Details', 'Please enter a name for your trip.', false); return; }
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const headers: any = { 'Content-Type': 'application/json' };
      if (token) headers.Authorization = `Bearer ${token}`;

      let coverImageUrl = null;
      if (imageUri) {
        try {
          setUploadingImage(true);
          coverImageUrl = await uploadToCloudinary(imageUri);
        } catch {
          Alert.alert('Warning', 'Image upload failed. Continuing without cover photo.');
        } finally {
          setUploadingImage(false);
        }
      }

      const createPayload = {
        name_group: tripName.trim(),
        start_plan_date: toYMD(startDate),
        end_plan_date: toYMD(endDate),
        image: coverImageUrl,
        city: selectedCities.length > 0 ? selectedCities.join(', ') : null,
      };
      const placeNames = allAttractions
        .filter(a => selectedPlaces.includes(a.attraction_id))
        .map(a => a.name);
      const llmText = triprequest + (placeNames.length > 0
        ? `\n\nMust include these places: ${placeNames.join(', ')}`
        : '');
      const llmBody = {
        start_date: toDDMMYYYY(startDate),
        end_date: toDDMMYYYY(endDate),
        cities: selectedCities,
        text: llmText,
      };

      const llm = await axios.post(`${API_URL}/llm/`, llmBody, { headers });
      const data: any = typeof llm.data === 'string' ? JSON.parse(llm.data) : llm.data;

      const created = await axios.post(`${API_URL}/trip_plan`, createPayload, { headers });
      const planId: number = Number(created.data?.plan_id);

      if (!Number.isFinite(planId)) {
        Alert.alert('Error', 'Could not create trip. Please try again.');
        setLoading(false);
        return;
      }

      await axios.post(`${API_URL}/trip_schedule`, { plan_id: planId, payload: data }, { headers });

      if (isGroupTrip) {
        try {
          await axios.post(`${API_URL}/trip_group/create_from_plan/${planId}`, {}, { headers });
        } catch {
          // group creation failed silently — trip still created
        }
      }

      showCustomAlert('Journey Created', 'Your customized itinerary is ready.', true, () => {
        router.push({ pathname: '/trip/scheduledetail', params: { planId, cities: JSON.stringify(selectedCities) } });
      });
    } catch (e: any) {
      showCustomAlert('Request Failed', 'Something went wrong while planning.', false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: WASHI }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Minimal Premium Header ── */}
        <View style={s.pageHeader}>
          <View style={s.pageTopBar} />
          <View style={s.pageHeaderInner}>
            <View style={s.pageTitleRow}>
              <View style={s.pageTitleBar} />
              <View>
                <Text style={s.pageTitle}>Create Trip</Text>
                <Text style={s.pageSub}>Plan your next adventure with AI</Text>
              </View>
            </View>
          </View>
          <WashiDivider />
        </View>

        {/* ── Cover photo ── */}
        <View style={s.section}>
          <SectionHeader label="Cover Photo" />
          <TouchableOpacity onPress={pickImage} style={s.imagePicker} activeOpacity={0.85}>
            {imageUri ? (
              <>
                <Image source={{ uri: imageUri }} style={s.imagePreview} />
                <View style={s.imageEditBadge}>
                  <Ionicons name="pencil" size={14} color={SUMI} />
                </View>
                <View style={s.imageOverlay} />
              </>
            ) : (
              <View style={s.imagePlaceholder}>
                <View style={s.cameraRing}>
                  <Ionicons name="camera-outline" size={26} color={KINCHA} />
                </View>
                <Text style={s.imagePlaceholderText}>Upload cover image</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        <WashiDivider />

        {/* ── Trip name ── */}
        <View style={s.section}>
          <SectionHeader label="Trip Name" />
          <TextInput
            value={tripName}
            onChangeText={setTripName}
            placeholder="e.g. Tokyo Autumn Escape"
            placeholderTextColor={INK_30}
            style={[s.input, focusedField === 'name' && s.inputFocused]}
            onFocus={() => setFocusedField('name')}
            onBlur={() => setFocusedField(null)}
            selectionColor={BENI}
          />
        </View>

        {/* ── Cities ── */}
        <View style={s.section}>
          <SectionHeader label="Destinations" />
          <TouchableOpacity
            style={[s.selectBtn, cityModalVisible && s.inputFocused]}
            onPress={() => setCityModalVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="location-outline" size={18} color={selectedCities.length > 0 ? BENI : INK_30} />
            <Text style={[s.selectBtnText, selectedCities.length > 0 && s.selectBtnTextActive]} numberOfLines={1}>
              {selectedCities.length > 0 ? selectedCities.join(', ') : 'Select cities'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={INK_30} />
          </TouchableOpacity>

          {selectedCities.length > 0 && (
            <View style={s.chipsRow}>
              {selectedCities.map(name => (
                <TouchableOpacity key={name} style={s.chip} onPress={() => toggleCity(name)} activeOpacity={0.8}>
                  <Text style={s.chipText}>{name}</Text>
                  <Ionicons name="close-outline" size={16} color={BENI} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* ── Interests ── */}
        <View style={s.section}>
          <SectionHeader label="Interests & Details" />
          <TextInput
            value={triprequest}
            onChangeText={setTripRequest}
            placeholder="e.g. Focus on local food, temples, and relaxing cafes..."
            placeholderTextColor={INK_30}
            style={[s.input, s.inputMulti, focusedField === 'interests' && s.inputFocused]}
            onFocus={() => setFocusedField('interests')}
            onBlur={() => setFocusedField(null)}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
            selectionColor={BENI}
          />
        </View>

        {/* ── Preferred Places ── */}
        {selectedCities.length > 0 && (
          <View style={s.section}>
            <SectionHeader label="Preferred Places" />
            <Text style={s.placeHint}>Select places you'd like to visit (optional)</Text>

            {/* Search bar */}
            <View style={s.placeSearchBar}>
              <Ionicons name="search-outline" size={16} color={INK_60} />
              <TextInput
                style={s.placeSearchInput}
                value={placeSearch}
                onChangeText={setPlaceSearch}
                placeholder="Search attractions..."
                placeholderTextColor={INK_30}
                selectionColor={BENI}
              />
              {placeSearch.length > 0 && (
                <TouchableOpacity onPress={() => setPlaceSearch('')} hitSlop={8}>
                  <Ionicons name="close-circle" size={16} color={INK_60} />
                </TouchableOpacity>
              )}
            </View>

            {filteredAttractions.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 8 }}>
                {filteredAttractions.map(item => (
                  <PlaceChip
                    key={item.attraction_id}
                    item={item}
                    selected={selectedPlaces.includes(item.attraction_id)}
                    onPress={() => togglePlace(item.attraction_id)}
                  />
                ))}
              </ScrollView>
            ) : (
              <View style={s.placeEmpty}>
                <Ionicons name="search-outline" size={22} color={INK_60} />
                <Text style={s.placeEmptyText}>No attractions found</Text>
              </View>
            )}
          </View>
        )}

        <WashiDivider />

        {/* ── Dates ── */}
        <View style={s.section}>
          <SectionHeader label="Travel Dates" />
          <View style={s.dateRow}>
            <TouchableOpacity style={s.dateBtn} onPress={() => setPicker({ show: true, mode: 'start' })} activeOpacity={0.8}>
              <Text style={s.dateBtnLabel}>Start Date</Text>
              <Text style={s.dateBtnValue}>{toDDMMYYYY(startDate)}</Text>
            </TouchableOpacity>

            <View style={s.dateSeparator}>
              <Ionicons name="arrow-forward-outline" size={16} color={KINCHA} />
            </View>

            <TouchableOpacity style={s.dateBtn} onPress={() => setPicker({ show: true, mode: 'end' })} activeOpacity={0.8}>
              <Text style={s.dateBtnLabel}>End Date</Text>
              <Text style={s.dateBtnValue}>{toDDMMYYYY(endDate)}</Text>
            </TouchableOpacity>
          </View>
        </View>

        {picker.show && (
          <DateTimePicker
            value={picker.mode === 'start' ? startDate : endDate}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            onChange={onChangeDate}
            minimumDate={today}
          />
        )}

        <WashiDivider />

        {/* ── Group Trip Toggle ── */}
        <View style={s.section}>
          <SectionHeader label="Trip Type" />
          <TouchableOpacity
            style={s.groupToggleRow}
            onPress={() => setIsGroupTrip(p => !p)}
            activeOpacity={0.85}
          >
            <View style={s.groupToggleLeft}>
              <View style={[s.groupToggleIcon, isGroupTrip && s.groupToggleIconActive]}>
                <Ionicons name="people" size={18} color={isGroupTrip ? WHITE : INK_60} />
              </View>
              <View>
                <Text style={s.groupToggleTitle}>Group Trip</Text>
                <Text style={s.groupToggleSub}>
                  {isGroupTrip ? 'Group will be created automatically' : 'Solo trip — invite friends later'}
                </Text>
              </View>
            </View>
            {/* Toggle pill */}
            <View style={[s.togglePill, isGroupTrip && s.togglePillActive]}>
              <View style={[s.toggleThumb, isGroupTrip && s.toggleThumbActive]} />
            </View>
          </TouchableOpacity>
        </View>

        {/* ── Submit ── */}
        <View style={[s.section, { marginTop: 14, paddingBottom: 50 }]}>
          <TouchableOpacity
            style={[s.createBtn, (!tripName || loading) && s.createBtnDisabled]}
            onPress={onCreateWithAI}
            disabled={loading || !tripName}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color={WHITE} size="small" />
            ) : (
              <>
                <Ionicons name="sparkles-outline" size={18} color={WHITE} />
                <Text style={s.createBtnText}>Plan with AI</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={s.backBtn} onPress={() => router.back()} disabled={loading} activeOpacity={0.8}>
            <Text style={s.backBtnText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* ── City picker modal ── */}
      <Modal visible={cityModalVisible} animationType="slide" transparent>
        <View style={cm.backdrop}>
          <View style={cm.card}>
            <View style={cm.handle} />
            <View style={cm.header}>
              <Text style={cm.title}>Select Destinations</Text>
              <TouchableOpacity style={cm.closeBtn} onPress={() => setCityModalVisible(false)}>
                <Ionicons name="close" size={20} color={SUMI} />
              </TouchableOpacity>
            </View>

            <View style={cm.searchWrap}>
              <Ionicons name="search-outline" size={18} color={INK_30} style={{ marginRight: 8 }} />
              <TextInput
                placeholder="Search city..."
                placeholderTextColor={INK_30}
                value={citySearch}
                onChangeText={setCitySearch}
                style={cm.searchInput}
                selectionColor={BENI}
              />
              {citySearch ? (
                <TouchableOpacity onPress={() => setCitySearch('')}>
                  <Ionicons name="close-circle" size={18} color={INK_30} />
                </TouchableOpacity>
              ) : null}
            </View>

            {loadingCities ? (
              <ActivityIndicator color={BENI} style={{ marginVertical: 40 }} />
            ) : (
              <FlatList
                data={filteredCities}
                keyExtractor={item => String(item.id)}
                keyboardShouldPersistTaps="handled"
                style={{ maxHeight: 380 }}
                ListEmptyComponent={<Text style={cm.empty}>No cities found</Text>}
                renderItem={({ item }) => {
                  const checked = selectedCities.includes(item.name);
                  return (
                    <Pressable onPress={() => toggleCity(item.name)} style={[cm.cityRow, checked && cm.cityRowChecked]}>
                      <View style={[cm.checkbox, checked && cm.checkboxChecked]}>
                        {checked && <Ionicons name="checkmark" size={14} color={WHITE} />}
                      </View>
                      <Text style={[cm.cityName, checked && cm.cityNameChecked]}>{item.name}</Text>
                    </Pressable>
                  );
                }}
              />
            )}

            <View style={cm.footer}>
              {selectedCities.length > 0 && (
                <Text style={cm.selectedCount}>{selectedCities.length} selected</Text>
              )}
              <TouchableOpacity style={cm.confirmBtn} onPress={() => setCityModalVisible(false)} activeOpacity={0.85}>
                <Text style={cm.confirmText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Loading modal ── */}
      <Modal visible={loading} transparent animationType="fade">
        <View style={lm.overlay}>
          <View style={lm.card}>
            <LottieView
              source={require('@/assets/images/CreateTrip/Airplane.json')}
              autoPlay
              loop
              style={{ width: 160, height: 160 }}
            />
            <Text style={lm.title}>Crafting Itinerary</Text>
            <Text style={lm.sub}>Our AI is designing the perfect journey for you.</Text>
          </View>
        </View>
      </Modal>

      {/* ── Alert modal ── */}
      <Modal visible={alertConfig.visible} transparent animationType="fade">
        <View style={alm.overlay}>
          <View style={alm.card}>
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
              <Text style={alm.btnText}>{alertConfig.isSuccess ? 'View Details' : 'Close'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

// ─── Main styles ──────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  scrollContent: { backgroundColor: WASHI, paddingBottom: 20 },

  // Minimal Premium Header
  pageHeader: { backgroundColor: SUMI },
  pageTopBar: { height: 3, backgroundColor: BENI },
  pageHeaderInner: { paddingHorizontal: 22, paddingTop: 20, paddingBottom: 16 },
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pageTitleBar: { width: 3, height: 36, backgroundColor: BENI, borderRadius: 99 },
  pageTitle: { fontSize: 22, fontFamily: 'ShipporiMincho_800ExtraBold', color: WASHI, letterSpacing: 0.3 },
  pageSub: { fontSize: 11, fontFamily: 'NotoSansJP_400Regular', color: 'rgba(250,245,236,0.5)', marginTop: 2, letterSpacing: 0.3 },
 

  // Elegant Divider
  dividerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, paddingHorizontal: 24 },
  dividerLine: { flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.4 },
  dividerDot: { fontSize: 9, color: KINCHA, marginHorizontal: 12, opacity: 0.6 },

  // Sections
  section: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 6 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 },
  sectionBar: { width: 4, height: 16, borderRadius: 2, backgroundColor: KINCHA },
  sectionLabel: { fontSize: 13, fontFamily: 'NotoSansJP_700Bold', color: SUMI, letterSpacing: 0.5, textTransform: 'uppercase' },

  // Minimal Image picker
  imagePicker: {
    width: '100%', height: 170, borderRadius: 20,
    borderWidth: 1.5, borderColor: INK_12, borderStyle: 'dashed',
    overflow: 'hidden', backgroundColor: WHITE,
  },
  imagePreview: { width: '100%', height: '100%', resizeMode: 'cover' },
  imageOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,20,16,0.1)' },
  imageEditBadge: {
    position: 'absolute', bottom: 14, right: 14,
    backgroundColor: 'rgba(255,255,255,0.9)', padding: 8, borderRadius: 20,
    shadowColor: SUMI, shadowOpacity: 0.1, shadowRadius: 4, shadowOffset: { width: 0, height: 2 },
  },
  imagePlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  cameraRing: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: WASHI,
    borderWidth: 1, borderColor: WASHI_DARK,
    alignItems: 'center', justifyContent: 'center',
  },
  imagePlaceholderText: { fontSize: 13, fontFamily: 'NotoSansJP_500Medium', color: INK_60 },

  // Modern Inputs
  input: {
    backgroundColor: WHITE,
    borderWidth: 1.2, borderColor: INK_12, borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 15,
    fontSize: 14, fontFamily: 'NotoSansJP_400Regular', color: SUMI,
    shadowColor: SUMI, shadowOpacity: 0.03, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  inputMulti: { minHeight: 100, paddingTop: 16 },
  inputFocused: { borderColor: KINCHA, borderWidth: 1.5, shadowOpacity: 0.06 },

  // Select button
  selectBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: WHITE, borderWidth: 1.2, borderColor: INK_12,
    borderRadius: 16, paddingHorizontal: 18, paddingVertical: 14,
    shadowColor: SUMI, shadowOpacity: 0.03, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  selectBtnText: { flex: 1, fontSize: 14, fontFamily: 'NotoSansJP_400Regular', color: INK_30 },
  selectBtnTextActive: { color: SUMI, fontFamily: 'NotoSansJP_500Medium' },

  // Refined Chips
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: WHITE,
    borderWidth: 1, borderColor: 'rgba(192,57,43,0.3)',
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
  },
  chipText: { fontSize: 12, fontFamily: 'NotoSansJP_500Medium', color: BENI },

  // Dates
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  dateBtn: {
    flex: 1, backgroundColor: WHITE, 
    borderWidth: 1.2, borderColor: INK_12, borderRadius: 16, 
    paddingVertical: 14, paddingHorizontal: 16,
    shadowColor: SUMI, shadowOpacity: 0.03, shadowRadius: 5, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  dateBtnLabel: { fontSize: 10, fontFamily: 'NotoSansJP_500Medium', color: INK_60, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  dateBtnValue: { fontSize: 14, fontFamily: 'NotoSansJP_700Bold', color: SUMI },
  dateSeparator: { paddingHorizontal: 4 },

  // Buttons
  createBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: BENI, paddingVertical: 16, borderRadius: 24,
    shadowColor: BENI, shadowOpacity: 0.35, shadowRadius: 12, shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  createBtnDisabled: { backgroundColor: WASHI_DARK, shadowOpacity: 0, elevation: 0 },
  createBtnText: { fontSize: 15, fontFamily: 'NotoSansJP_700Bold', color: WHITE, letterSpacing: 0.5 },
  backBtn: {
    alignItems: 'center', justifyContent: 'center',
    paddingVertical: 16, marginTop: 8, borderRadius: 24,
  },
  backBtnText: { fontSize: 13, fontFamily: 'NotoSansJP_500Medium', color: INK_60 },

  // ── Group toggle ──
  groupToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: WASHI_DARK, borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 14,
    borderWidth: 1, borderColor: INK_12,
  },
  groupToggleLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  groupToggleIcon: {
    width: 40, height: 40, borderRadius: 10,
    backgroundColor: INK_12, alignItems: 'center', justifyContent: 'center',
  },
  groupToggleIconActive: { backgroundColor: BENI },
  groupToggleTitle: { fontSize: 14, fontWeight: '700', color: SUMI, marginBottom: 2 },
  groupToggleSub: { fontSize: 12, color: INK_60 },
  togglePill: {
    width: 46, height: 26, borderRadius: 13,
    backgroundColor: INK_12, justifyContent: 'center', paddingHorizontal: 3,
  },
  togglePillActive: { backgroundColor: BENI },
  toggleThumb: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: WHITE,
    shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 2,
    shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  toggleThumbActive: { alignSelf: 'flex-end' },
  placeHint: { fontSize: 12, color: INK_60, marginBottom: 10 },
  placeSearchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: WHITE, borderWidth: 1.2, borderColor: INK_12,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 4,
  },
  placeSearchInput: {
    flex: 1, fontSize: 13, fontFamily: 'NotoSansJP_400Regular',
    color: SUMI, padding: 0,
  },
  placeEmpty: {
    alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: 24,
  },
  placeEmptyText: { fontSize: 12, color: INK_60 },
});

// ─── City modal styles (Premium UI) ───────────────────────────────────────────
const cm = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,20,16,0.6)', justifyContent: 'flex-end' },
  card: { backgroundColor: WASHI, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 24 },
  handle: { width: 36, height: 4, backgroundColor: INK_12, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 24, paddingBottom: 16 },
  title: { fontSize: 17, fontFamily: 'ShipporiMincho_700Bold', color: SUMI },
  closeBtn: { padding: 4 },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WHITE, borderRadius: 16, marginHorizontal: 24, marginBottom: 16,
    paddingHorizontal: 16, paddingVertical: 12, borderWidth: 1, borderColor: WASHI_DARK,
  },
  searchInput: { flex: 1, fontSize: 14, fontFamily: 'NotoSansJP_400Regular', color: SUMI },
  empty: { textAlign: 'center', paddingVertical: 40, color: INK_30, fontFamily: 'NotoSansJP_400Regular', fontSize: 14 },
  cityRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 24, borderBottomWidth: 0.5, borderBottomColor: INK_12 },
  cityRowChecked: { backgroundColor: 'rgba(184,150,62,0.06)' }, // Very light gold background when checked
  checkbox: { width: 22, height: 22, borderRadius: 8, borderWidth: 1.5, borderColor: INK_30, alignItems: 'center', justifyContent: 'center', backgroundColor: WHITE },
  checkboxChecked: { backgroundColor: BENI, borderColor: BENI },
  cityName: { fontSize: 15, fontFamily: 'NotoSansJP_400Regular', color: SUMI },
  cityNameChecked: { fontFamily: 'NotoSansJP_700Bold', color: BENI },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 16 },
  selectedCount: { fontSize: 13, fontFamily: 'NotoSansJP_500Medium', color: INK_60 },
  confirmBtn: {
    backgroundColor: SUMI, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 20,
    shadowColor: SUMI, shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 },
  },
  confirmText: { color: WHITE, fontFamily: 'NotoSansJP_700Bold', fontSize: 14, letterSpacing: 0.5 },
});

// ─── Loading & Alert Modals ───────────────────────────────────────────────────
const lm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,20,16,0.65)', justifyContent: 'center', alignItems: 'center' },
  card: { 
    width: '80%', backgroundColor: WASHI, borderRadius: 24, 
    alignItems: 'center', paddingVertical: 36, paddingHorizontal: 24,
    shadowColor: SUMI, shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
  },
  title: { fontSize: 18, fontFamily: 'ShipporiMincho_700Bold', color: SUMI, marginTop: 16 },
  sub: { fontSize: 13, fontFamily: 'NotoSansJP_400Regular', color: INK_60, marginTop: 8, textAlign: 'center', lineHeight: 20 },
});

const alm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,20,16,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: {
    width: '85%', backgroundColor: WASHI, borderRadius: 24,
    alignItems: 'center', paddingHorizontal: 28, paddingTop: 32, paddingBottom: 28,
    shadowColor: SUMI, shadowOpacity: 0.2, shadowRadius: 20, shadowOffset: { width: 0, height: 10 },
  },
  title: { fontSize: 18, fontFamily: 'ShipporiMincho_700Bold', color: SUMI, marginTop: 16, marginBottom: 8, textAlign: 'center' },
  message: { fontSize: 14, fontFamily: 'NotoSansJP_400Regular', color: INK_60, textAlign: 'center', lineHeight: 22, marginBottom: 28 },
  btn: { width: '100%', paddingVertical: 15, borderRadius: 20, alignItems: 'center' },
  btnSuccess: { backgroundColor: KINCHA },
  btnError: { backgroundColor: BENI },
  btnText: { color: WHITE, fontFamily: 'NotoSansJP_700Bold', fontSize: 14, letterSpacing: 0.5 },
});