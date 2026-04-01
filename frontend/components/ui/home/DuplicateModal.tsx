import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, Modal, TouchableOpacity,
  Image, ActivityIndicator, Platform, ScrollView,
  KeyboardAvoidingView, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import dayjs from 'dayjs';
import { useRouter } from 'expo-router';
import { API_URL } from '@/api.js';
import { BENI, KINCHA, SUMI, WASHI, WASHI_DARK, INK_60 } from '@/constants/theme';
import { PastTrip } from './PastTripCard';

const CLOUD_NAME    = 'dqghrasqe';
const UPLOAD_PRESET = 'TabiGo';
const WHITE = '#FFFAF5';
const INK_12 = 'rgba(28,20,16,0.12)';

interface Props {
  visible: boolean;
  trip: PastTrip;
  onClose: () => void;
  onSuccess: (newPlanId: number) => void;
}

export default function DuplicateModal({ visible, trip, onClose, onSuccess }: Props) {
  const router = useRouter();

  const [name, setName]               = useState('');
  const [imageUri, setImageUri]       = useState<string | null>(null);
  const [imageUrl, setImageUrl]       = useState<string | null>(null);
  const [startDate, setStartDate]     = useState<Date>(new Date());
  const [showPicker, setShowPicker]   = useState(false);
  const [saving, setSaving]           = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [nameError, setNameError]     = useState('');
  const [dateError, setDateError]     = useState('');

  // Reset state every time the modal opens
  useEffect(() => {
    if (!visible) return;
    setName(trip.name_group);
    setImageUri(null);
    setImageUrl(trip.image ?? null);
    setStartDate(new Date());
    setNameError('');
    setDateError('');
    setSaving(false);
    setUploading(false);
  }, [visible]);

  // Real-time computed end date — no state needed
  const durationDays = Math.max(0, trip.day_of_trip - 1);
  const computedEnd  = dayjs(startDate).add(durationDays, 'day').format('DD MMM YYYY');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.7,
    });
    if (!result.canceled) {
      setImageUri(result.assets[0].uri);
      setImageUrl(null);
    }
  };

  const uploadToCloudinary = async (uri: string): Promise<string> => {
    const data = new FormData();
    const filename = uri.split('/').pop() ?? 'cover.jpg';
    const match = /\.(\w+)$/.exec(filename);
    const type = match ? `image/${match[1]}` : 'image/jpeg';
    // @ts-ignore
    data.append('file', { uri, name: filename, type });
    data.append('upload_preset', UPLOAD_PRESET);
    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
      { method: 'POST', body: data, headers: { 'content-type': 'multipart/form-data' } },
    );
    const json = await res.json();
    if (json.error) throw new Error(json.error.message);
    return json.secure_url as string;
  };

  const validate = (): boolean => {
    let valid = true;
    if (!name.trim()) {
      setNameError('Please enter a trip name');
      valid = false;
    } else {
      setNameError('');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (startDate < today) {
      setDateError('Start date cannot be in the past');
      valid = false;
    } else {
      setDateError('');
    }
    return valid;
  };

  const handleSave = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem('access_token');

      let finalImageUrl: string | null = imageUrl;
      if (imageUri) {
        setUploading(true);
        try {
          finalImageUrl = await uploadToCloudinary(imageUri);
        } catch {
          finalImageUrl = trip.image ?? null;
        } finally {
          setUploading(false);
        }
      }

      const res = await axios.post(
        `${API_URL}/trip_plan/${trip.plan_id}/duplicate`,
        {
          name_group: name.trim(),
          start_plan_date: dayjs(startDate).format('YYYY-MM-DD'),
          image: finalImageUrl,
        },
        { headers: { Authorization: `Bearer ${token}` } },
      );

      onSuccess(res.data.plan_id);
    } catch {
      setNameError('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const previewSrc = imageUri
    ? { uri: imageUri }
    : imageUrl
      ? { uri: imageUrl }
      : { uri: `https://picsum.photos/seed/${trip.plan_id}/400/300` };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={d.root}>
        {/* KINCHA top bar */}
        <View style={d.topBar} />

        {/* Header */}
        <View style={d.header}>
          <Text style={d.headerTitle}>Duplicate Trip</Text>
          <TouchableOpacity style={d.closeBtn} onPress={onClose} activeOpacity={0.75}>
            <Ionicons name="close" size={18} color={SUMI} />
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView
          style={d.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            style={d.scroll}
            contentContainerStyle={d.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* Trip Name */}
            <View style={d.fieldGroup}>
              <Text style={d.label}>Trip Name</Text>
              <TextInput
                style={[d.input, !!nameError && d.inputError]}
                value={name}
                onChangeText={t => { setName(t); if (t.trim()) setNameError(''); }}
                placeholder="Enter new trip name"
                placeholderTextColor={INK_60}
              />
              {!!nameError && <Text style={d.errorText}>{nameError}</Text>}
            </View>

            {/* Cover Image */}
            <View style={d.fieldGroup}>
              <Text style={d.label}>Cover Image</Text>
              <Image source={previewSrc} style={d.imagePreview} resizeMode="cover" />
              <TouchableOpacity style={d.changeImgBtn} onPress={pickImage} activeOpacity={0.75}>
                <Ionicons name="camera-outline" size={14} color={KINCHA} />
                <Text style={d.changeImgText}>Change Photo</Text>
              </TouchableOpacity>
            </View>

            {/* Start Date */}
            <View style={d.fieldGroup}>
              <Text style={d.label}>Start Date</Text>
              <TouchableOpacity
                style={[d.dateRow, !!dateError && d.inputError]}
                onPress={() => setShowPicker(true)}
                activeOpacity={0.75}
              >
                <Text style={d.dateText}>{dayjs(startDate).format('DD MMM YYYY')}</Text>
                <Ionicons name="calendar-outline" size={16} color={KINCHA} />
              </TouchableOpacity>
              {!!dateError && <Text style={d.errorText}>{dateError}</Text>}
              {showPicker && (
                <DateTimePicker
                  value={startDate}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  minimumDate={new Date()}
                  onChange={(_, d) => {
                    setShowPicker(false);
                    if (d) { setStartDate(d); setDateError(''); }
                  }}
                />
              )}
            </View>

            {/* End Date — READ-ONLY */}
            <View style={d.fieldGroup}>
              <Text style={d.label}>End Date (Auto-calculated)</Text>
              <View style={[d.dateRow, d.dateRowReadOnly]}>
                <Text style={[d.dateText, d.dateTextReadOnly]}>{computedEnd}</Text>
                <Ionicons name="lock-closed-outline" size={14} color={INK_60} />
              </View>
            </View>
          </ScrollView>

          {/* Save button */}
          <View style={d.footer}>
            <TouchableOpacity
              style={d.saveBtn}
              onPress={handleSave}
              activeOpacity={0.85}
              disabled={saving || uploading}
            >
              {(saving || uploading) ? (
                <ActivityIndicator size="small" color={WHITE} />
              ) : (
                <>
                  <Ionicons name="copy-outline" size={17} color={WHITE} />
                  <Text style={d.saveBtnText}>Save</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const d = StyleSheet.create({
  root:  { flex: 1, backgroundColor: WASHI },
  flex:  { flex: 1 },
  topBar: { height: 3, backgroundColor: KINCHA },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: INK_12,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    color: SUMI,
    letterSpacing: 0.2,
  },
  closeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: WASHI_DARK,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Scroll
  scroll:        { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingVertical: 20, gap: 20 },

  // Fields
  fieldGroup: { gap: 6 },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: INK_60,
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  input: {
    backgroundColor: WASHI_DARK,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: SUMI,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  inputError: { borderColor: BENI },
  errorText:  { fontSize: 11, color: BENI, marginTop: 2 },

  // Image
  imagePreview: {
    width: '100%',
    height: 130,
    borderRadius: 10,
    backgroundColor: WASHI_DARK,
  },
  changeImgBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: KINCHA,
    marginTop: 2,
  },
  changeImgText: { fontSize: 12, fontWeight: '600', color: KINCHA },

  // Date rows
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: WASHI_DARK,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  dateRowReadOnly: { opacity: 0.6 },
  dateText:        { fontSize: 14, color: SUMI, fontWeight: '600' },
  dateTextReadOnly:{ color: INK_60 },

  // Footer
  footer: { paddingHorizontal: 16, paddingVertical: 16, borderTopWidth: 0.5, borderTopColor: INK_12 },
  saveBtn: {
    backgroundColor: BENI,
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveBtnText: { fontSize: 15, fontWeight: '700', color: WHITE, letterSpacing: 0.3 },
});
