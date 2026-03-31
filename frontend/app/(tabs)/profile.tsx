import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView,
  TouchableOpacity, Alert, Platform, Animated, Modal
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { StyleSheet } from 'react-native';
import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
import LogoutButton from '@/components/ui/Logoutbutton';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { API_URL } from '@/api.js';
import FinishedTripCard from '@/components/ui/profile/FinishedTripCard';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import Avatar from '@/components/ui/profile/Avatar';
import * as ImagePicker from 'expo-image-picker';
import ProfileSkeleton from '@/components/ui/profile/ProfileSkeleton';
import { LinearGradient } from 'expo-linear-gradient';

import { BENI, BENI_LIGHT, KINCHA, KINCHA_LIGHT, SUMI, SAKURA, WASHI, WASHI_DARK, INK_60, INK_20, WHITE } from '@/constants/theme';
import WashiDivider from '@/components/ui/WashiDivider';
import PreferenceModal from '@/components/ui/profile/PreferenceModal';
import { STYLE_OPTIONS, INTEREST_OPTIONS } from '@/constants/preferenceOptions';

const CLOUD_NAME   = "dqghrasqe";
const UPLOAD_PRESET = "TabiGo";


// ─── Section header pill ─────────────────────────────────────────────────────
const SectionHeader = ({ title, kanji }: { title: string; kanji: string }) => (
  <View style={s.sectionHeaderRow}>
    <View style={s.sectionBar} />
    <Text style={s.sectionTitle}>{title}</Text>
    <Text style={s.sectionKanji}>{kanji}</Text>
  </View>
);

// ─── Info row (view mode) ─────────────────────────────────────────────────────
const InfoRow = ({ icon, label, value }: { icon: string; label: string; value: string }) => (
  <View style={s.infoRow}>
    <View style={s.infoIconWrap}>
      <Ionicons name={icon as any} size={16} color={BENI} />
    </View>
    <View style={s.infoContent}>
      <Text style={s.infoLabel}>{label}</Text>
      <Text style={s.infoValue}>{value || '—'}</Text>
    </View>
  </View>
);


export default function ProfileScreen() {
  const [isEditing, setIsEditing]     = useState(false);
  const [showTrips, setShowTrips]     = useState(false);
  const [user, setUser]               = useState<any>(null);
  const [tempInfo, setTempInfo]       = useState<any>(null);
  const navigation                    = useNavigation<any>();
  const router                        = useRouter();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [uploading, setUploading]     = useState(false);
  const [isLoading, setIsLoading]     = useState(true);

  // ── Change password state ─────────────────────────────────────────────────
  const [showPwModal, setShowPwModal]   = useState(false);
  const [pwForm, setPwForm]             = useState({ current: '', next: '', confirm: '' });
  const [pwLoading, setPwLoading]       = useState(false);

  const handleChangePassword = async () => {
    if (!pwForm.current || !pwForm.next || !pwForm.confirm) {
      Alert.alert('Error', 'Please fill in all fields'); return;
    }
    if (pwForm.next.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters'); return;
    }
    if (pwForm.next !== pwForm.confirm) {
      Alert.alert('Error', 'New passwords do not match'); return;
    }
    try {
      setPwLoading(true);
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(`${API_URL}/change-password`,
        { current_password: pwForm.current, new_password: pwForm.next },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      Alert.alert('Success', 'Password changed successfully');
      setShowPwModal(false);
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (err: any) {
      const detail = err?.response?.data?.detail;
      Alert.alert('Failed', detail || 'Unable to change password');
    } finally {
      setPwLoading(false);
    }
  };

  // ── Preference state ─────────────────────────────────────────────────────
  const [showPrefModal, setShowPrefModal] = useState(false);
  const [prefStyle, setPrefStyle]     = useState<string>('');
  const [prefInterests, setPrefInterests] = useState<string[]>([]);
  const [prefLength, setPrefLength]   = useState<string>('');
  const [savingPref, setSavingPref]   = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchProfile = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      setIsLoading(true);
      const headers = { Authorization: `Bearer ${token}`, 'Cache-Control': 'no-cache', Pragma: 'no-cache' };

      const [userRes, tripsRes, prefRes] = await Promise.allSettled([
        axios.get(`${API_URL}/user`,             { headers }),
        axios.get(`${API_URL}/trip_plan`,         { headers }),
        axios.get(`${API_URL}/user/preferences`,  { headers }),
      ]);

      if (userRes.status === 'fulfilled' && tripsRes.status === 'fulfilled') {
        const fullUserData = { ...userRes.value.data, ownedTrips: tripsRes.value.data };
        setUser(fullUserData);
        setTempInfo(fullUserData);
      } else if (userRes.status === 'rejected' && userRes.reason?.response?.status === 401) {
        await AsyncStorage.removeItem('access_token');
      }

      if (prefRes.status === 'fulfilled') {
        const p = prefRes.value.data;
        setPrefStyle(p.travel_style ?? '');
        setPrefInterests(p.interests ?? []);
        setPrefLength(p.trip_length ?? '');
        await AsyncStorage.setItem('onboarding_answers', JSON.stringify({
          travel_style: p.travel_style,
          interests: p.interests,
          trip_length: p.trip_length,
        }));
      }
    } finally {
      setIsLoading(false);
    }
  };

  useFocusEffect(React.useCallback(() => { fetchProfile(); }, []));

  const handleLogoutSuccess = () => router.push('/Login');

  // ── Save preferences ────────────────────────────────────────────────────────
  const handleSavePref = async () => {
    try {
      setSavingPref(true);
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/user/preferences`,
        { travel_style: prefStyle, interests: prefInterests, trip_length: prefLength },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await AsyncStorage.setItem('onboarding_answers', JSON.stringify({
        travel_style: prefStyle, interests: prefInterests, trip_length: prefLength,
      }));
      setShowPrefModal(false);
    } catch {
      Alert.alert('Error', 'Failed to save preferences');
    } finally {
      setSavingPref(false);
    }
  };

  // ── Cloudinary upload ────────────────────────────────────────────────────────
  const uploadToCloudinary = async (uri: string) => {
    const data = new FormData();
    const filename = uri.split('/').pop();
    const match    = /\.(\w+)$/.exec(filename || '');
    const type     = match ? `image/${match[1]}` : `image`;
    // @ts-ignore
    data.append('file', { uri, name: filename, type });
    data.append('upload_preset', UPLOAD_PRESET);
    const res  = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST', body: data,
      headers: { 'content-type': 'multipart/form-data' },
    });
    const json = await res.json();
    return json.secure_url;
  };

  const handleEditImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Allow media library access'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [1, 1], quality: 0.6,
    });
    if (result.canceled) return;
    try {
      setUploading(true);
      const newImageUrl = await uploadToCloudinary(result.assets[0].uri);
      const token = await AsyncStorage.getItem('access_token');
      await axios.patch(`${API_URL}/customer/${user.customer_id}`,
        { image: newImageUrl },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setUser((prev: any) => ({ ...prev, image: newImageUrl }));
      Alert.alert('Success', 'Profile picture updated!');
    } catch {
      Alert.alert('Error', 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token)            { Alert.alert('Error', 'Please login again'); return; }
      if (!user?.customer_id){ Alert.alert('Error', 'User ID not found'); return; }
      const payload = {
        first_name:   tempInfo.first_name,
        last_name:    tempInfo.last_name,
        phone_number: tempInfo.phone_number,
        birth_date:   tempInfo.birth_date,
      };
      const res = await axios.put(`${API_URL}/customer/${user.customer_id}`, payload, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser((prev: any) => ({ ...prev, ...res.data, ownedTrips: prev.ownedTrips }));
      setTempInfo((prev: any) => ({ ...prev, ...res.data, ownedTrips: prev.ownedTrips }));
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } catch {
      Alert.alert('Error', 'Unable to save profile');
    }
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selectedDate) {
      setTempInfo({ ...tempInfo, birth_date: selectedDate.toISOString() });
      if (Platform.OS === 'android') setShowDatePicker(false);
    } else {
      if (Platform.OS === 'android') setShowDatePicker(false);
    }
  };

  const handleCancel = () => { setTempInfo(user); setIsEditing(false); };

  if (isLoading) return <ProfileSkeleton />;

  // ── Guest screen ─────────────────────────────────────────────────────────────
  if (!user) {
    return (
      <View style={s.guestContainer}>
        {/* Washi texture circles */}
        <View style={s.guestCircle1} />
        <View style={s.guestCircle2} />
        <View style={s.guestCircle3} />

        {/* Kanji watermark */}

        {/* Icon */}
        <View style={s.guestIconRing}>
          <View style={s.guestIconInner}>
            <Ionicons name="person" size={52} color={BENI} />
          </View>
        </View>

        <Text style={s.guestTitle}>Unlock Your Profile</Text>
        <Text style={s.guestSubtitle}>
          Log in to save travel plans, manage budgets, and track past adventures.
        </Text>

        <TouchableOpacity onPress={() => router.push('/Login')} activeOpacity={0.85} style={s.guestBtnWrap}>
          <LinearGradient
            colors={[BENI_LIGHT, BENI]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={s.guestBtn}
          >
            <Ionicons name="log-in-outline" size={20} color={WHITE} />
            <Text style={s.guestBtnText}>Log In / Sign Up</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
    );
  }

  const currentBirthDate = tempInfo?.birth_date ? new Date(tempInfo.birth_date) : new Date();
  const finishedTrips    = user.ownedTrips?.filter((t: any) => new Date() > new Date(t.end_plan_date)) ?? [];
  const upcomingTrips    = user.ownedTrips?.filter((t: any) => new Date() <= new Date(t.end_plan_date)) ?? [];

  // ── Main profile ─────────────────────────────────────────────────────────────
  return (
    <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

      {/* ── Top banner ── */}
      <LinearGradient colors={[SUMI, '#2E1A14']} style={s.banner}>
        {/* Decorative red bar */}
        <View style={s.bannerTopBar} />
        {/* Sakura petals */}
        <Text style={s.bannerPetal1}>🌸</Text>
        <Text style={s.bannerPetal2}>🌸</Text>
        {/* Kanji watermark */}

        <View style={s.bannerContent}>
          <Text style={s.bannerTagText}>PROFILE ·</Text>

          {/* Avatar */}
          <TouchableOpacity onPress={handleEditImage} style={s.avatarWrap} activeOpacity={0.85}>
            <View style={s.avatarRing}>
              <Avatar uri={user?.image} name={user?.name} size={96} />
            </View>
            {/* Camera badge */}
            <View style={s.cameraBadge}>
              <Ionicons name="camera" size={14} color={WHITE} />
            </View>
            {uploading && (
              <View style={s.uploadOverlay}>
                <Ionicons name="cloud-upload-outline" size={20} color={WHITE} />
              </View>
            )}
          </TouchableOpacity>

          {/* Name */}
          {isEditing ? (
            <View style={s.nameEditRow}>
              <TextInput
                style={s.nameInput}
                placeholder="First Name"
                placeholderTextColor={INK_60}
                value={tempInfo.first_name}
                onChangeText={val => setTempInfo({ ...tempInfo, first_name: val })}
              />
              <TextInput
                style={s.nameInput}
                placeholder="Last Name"
                placeholderTextColor={INK_60}
                value={tempInfo.last_name}
                onChangeText={val => setTempInfo({ ...tempInfo, last_name: val })}
              />
            </View>
          ) : (
            <Text style={s.bannerName}>{user.first_name} {user.last_name}</Text>
          )}

          <Text style={s.bannerJoinDate}>
            <Ionicons name="calendar-outline" size={11} color="rgba(255,255,255,0.5)" />
            {' '}Member since {user.createdAt
              ? format(new Date(user.createdAt), 'd MMM yyyy', { locale: enUS })
              : '—'}
          </Text>

          {/* Stats row */}
          <View style={s.statsRow}>
            <View style={s.statItem}>
              <Text style={s.statNumber}>{user.ownedTrips?.length ?? 0}</Text>
              <Text style={s.statLabel}>Trips</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNumber}>{finishedTrips.length}</Text>
              <Text style={s.statLabel}>Completed</Text>
            </View>
            <View style={s.statDivider} />
            <View style={s.statItem}>
              <Text style={s.statNumber}>{upcomingTrips.length}</Text>
              <Text style={s.statLabel}>Upcoming</Text>
            </View>
          </View>

        </View>

        {/* Edit toggle */}
        <TouchableOpacity
          style={s.editToggleBtn}
          onPress={() => { if (isEditing) handleCancel(); else setIsEditing(true); }}
        >
          <Ionicons name={isEditing ? 'close' : 'pencil'} size={16} color={BENI} />
          <Text style={s.editToggleTxt}>{isEditing ? 'Cancel' : 'Edit'}</Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* ── Profile card ── */}
      <View style={s.card}>
        <SectionHeader title="Contact Information" kanji="" />

        {/* Email */}
        <InfoRow icon="mail-outline" label="Email" value={user.email} />

        <WashiDivider />

        {/* Phone */}
        <View style={s.infoRow}>
          <View style={s.infoIconWrap}>
            <Ionicons name="call-outline" size={16} color={BENI} />
          </View>
          <View style={s.infoContent}>
            <Text style={s.infoLabel}>Phone Number</Text>
            {isEditing ? (
              <TextInput
                style={s.fieldInput}
                value={tempInfo.phone_number || ''}
                onChangeText={val => setTempInfo({ ...tempInfo, phone_number: val.replace(/[^0-9]/g, '') })}
                maxLength={10}
                keyboardType="phone-pad"
                placeholder="Enter phone number"
                placeholderTextColor={INK_60}
                selectionColor={BENI}
              />
            ) : (
              <Text style={s.infoValue}>{user.phone_number || '—'}</Text>
            )}
          </View>
        </View>

        <WashiDivider />

        {/* Birth date */}
        <View style={s.infoRow}>
          <View style={s.infoIconWrap}>
            <Ionicons name="gift-outline" size={16} color={BENI} />
          </View>
          <View style={s.infoContent}>
            <Text style={s.infoLabel}>Birth Date</Text>
            {isEditing ? (
              <>
                <TouchableOpacity onPress={() => setShowDatePicker(true)}>
                  <View style={s.dateTouchable}>
                    <Text style={{ color: tempInfo.birth_date ? SUMI : INK_60, fontSize: 14 }}>
                      {tempInfo.birth_date
                        ? format(new Date(tempInfo.birth_date), 'dd MMMM yyyy', { locale: enUS })
                        : 'Select Birth Date'}
                    </Text>
                    <Ionicons name="chevron-down" size={14} color={INK_60} />
                  </View>
                </TouchableOpacity>
                {showDatePicker && (
                  <DateTimePicker
                    value={currentBirthDate}
                    mode="date"
                    display="default"
                    onChange={onDateChange}
                    maximumDate={new Date()}
                  />
                )}
              </>
            ) : (
              <Text style={s.infoValue}>
                {user.birth_date
                  ? format(new Date(user.birth_date), 'dd MMMM yyyy', { locale: enUS })
                  : '—'}
              </Text>
            )}
          </View>
        </View>

        {/* Save button */}
        {isEditing && (
          <>
            <WashiDivider />
            <TouchableOpacity style={s.saveBtn} onPress={handleSave} activeOpacity={0.85}>
              <Ionicons name="checkmark" size={18} color={WHITE} />
              <Text style={s.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* ── Security card ── */}
      <View style={s.card}>
        <SectionHeader title="Security & Privacy" kanji="" />
        <View style={s.securityRow}>
          {/* Left: icon + label */}
          <View style={s.securityLeft}>
            <View style={s.securityIconWrap}>
              <Ionicons name="lock-closed" size={16} color={BENI} />
            </View>
            <Text style={s.securityLabel}>Account Password</Text>
          </View>
          {/* Right: button */}
          <TouchableOpacity style={s.resetPwBtn} onPress={() => setShowPwModal(true)} activeOpacity={0.8}>
            <Text style={s.resetPwTxt}>Reset Password</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Interests card ── */}
      <View style={s.card}>
        <View style={s.sectionHeaderRow}>
          <View style={s.sectionBar} />
          <Text style={s.sectionTitle}>My Interests</Text>
          <TouchableOpacity
            style={p.editPrefBtn}
            onPress={() => setShowPrefModal(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="pencil" size={13} color={BENI} />
            <Text style={p.editPrefTxt}>Edit</Text>
          </TouchableOpacity>
        </View>

        {prefStyle ? (
          <>
            {/* Travel style pill */}
            <View style={p.styleRow}>
              <Ionicons name="person-circle-outline" size={14} color={KINCHA} />
              <Text style={p.styleLabel}>Style</Text>
              <View style={p.stylePill}>
                <Text style={p.stylePillText}>
                  {STYLE_OPTIONS.find(o => o.value === prefStyle)?.label ?? prefStyle}
                </Text>
              </View>
            </View>

            {/* Interest chips */}
            {prefInterests.length > 0 && (
              <View style={p.chipsWrap}>
                {prefInterests.map(v => (
                  <View key={v} style={p.chip}>
                    <Ionicons
                      name={INTEREST_OPTIONS.find(o => o.value === v)?.icon as any ?? 'star-outline'}
                      size={11} color={BENI}
                    />
                    <Text style={p.chipText}>
                      {INTEREST_OPTIONS.find(o => o.value === v)?.label ?? v}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : (
          <TouchableOpacity style={p.emptyPref} onPress={() => setShowPrefModal(true)} activeOpacity={0.8}>
            <Ionicons name="add-circle-outline" size={22} color={INK_20} />
            <Text style={p.emptyPrefText}>Set your travel interests</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* ── Preference modal ── */}
      <PreferenceModal
        visible={showPrefModal}
        onClose={() => setShowPrefModal(false)}
        prefStyle={prefStyle}
        setPrefStyle={setPrefStyle}
        prefInterests={prefInterests}
        setPrefInterests={setPrefInterests}
        prefLength={prefLength}
        setPrefLength={setPrefLength}
        onSave={handleSavePref}
        saving={savingPref}
      />

      {/* ── Travel History ── */}
      <View style={s.card}>
        <TouchableOpacity
          style={s.tripToggleRow}
          onPress={() => setShowTrips(!showTrips)}
          activeOpacity={0.8}
        >
          <View style={s.tripToggleLeft}>
            <View style={s.sectionBar} />
            <Ionicons name="airplane" size={16} color={BENI} style={{ marginRight: 6 }} />
            <Text style={s.sectionTitle}>Travel History</Text>
          </View>
          <View style={s.tripCountBadge}>
            <Text style={s.tripCountText}>{finishedTrips.length}</Text>
          </View>
          <Ionicons
            name={showTrips ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={INK_60}
            style={{ marginLeft: 6 }}
          />
        </TouchableOpacity>

        {showTrips && (
          <>
            <WashiDivider />
            {finishedTrips.length > 0 ? (
              <View style={{ gap: 10 }}>
                {finishedTrips.map((trip: any) => {
                  const startDate     = new Date(trip.start_plan_date);
                  const endDate       = new Date(trip.end_plan_date);
                  const formattedDate = `${format(startDate, 'd MMM', { locale: enUS })} – ${format(endDate, 'd MMM yyyy', { locale: enUS })}`;
                  return (
                    <TouchableOpacity
                      key={trip.trip_id || trip.plan_id}
                      onPress={() => router.push(`/trip/${trip.plan_id}`)}
                      activeOpacity={0.8}
                    >
                      <FinishedTripCard
                        name={trip.name_group}
                        date={formattedDate}
                        budget={trip.budget?.total_budget || 0}
                        people={trip.members?.length ? trip.members.length + 1 : 1}
                        city={trip.city ?? undefined}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>
            ) : (
              <View style={s.emptyTrips}>
                <Ionicons name="map-outline" size={36} color={INK_20} />
                <Text style={s.emptyTripsText}>No travel history yet</Text>
                <Text style={s.emptyTripsSub}>Start planning your first trip!</Text>
              </View>
            )}
          </>
        )}
      </View>

      {/* ── Logout ── */}
      <View style={s.logoutWrap}>
        <LogoutButton onLogoutSuccess={handleLogoutSuccess} />
      </View>

      <View style={{ height: 40 }} />

      {/* ── Change Password Modal ── */}
      <Modal visible={showPwModal} transparent animationType="slide">
        <View style={s.pwBackdrop}>
          <View style={s.pwCard}>
            {/* Handle */}
            <View style={s.pwHandle} />

            {/* Header */}
            <View style={s.pwHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <View style={s.pwIconWrap}>
                  <Ionicons name="lock-closed" size={16} color={WHITE} />
                </View>
                <Text style={s.pwTitle}>Change Password</Text>
              </View>
              <TouchableOpacity
                style={s.pwCloseBtn}
                onPress={() => { setShowPwModal(false); setPwForm({ current: '', next: '', confirm: '' }); }}
              >
                <Ionicons name="close" size={18} color={INK_60} />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={s.pwDivider} />

            {/* Fields */}
            <View style={{ gap: 12, marginTop: 4 }}>
              <View style={s.pwFieldWrap}>
                <Text style={s.pwFieldLabel}>CURRENT PASSWORD</Text>
                <View style={s.pwInputWrap}>
                  <Ionicons name="lock-open-outline" size={16} color={INK_60} style={{ marginRight: 8 }} />
                  <TextInput
                    style={s.pwInput}
                    placeholder="Enter current password"
                    placeholderTextColor={INK_60}
                    secureTextEntry
                    value={pwForm.current}
                    onChangeText={t => setPwForm(p => ({ ...p, current: t }))}
                  />
                </View>
              </View>

              <View style={s.pwFieldWrap}>
                <Text style={s.pwFieldLabel}>NEW PASSWORD</Text>
                <View style={s.pwInputWrap}>
                  <Ionicons name="lock-closed-outline" size={16} color={INK_60} style={{ marginRight: 8 }} />
                  <TextInput
                    style={s.pwInput}
                    placeholder="At least 6 characters"
                    placeholderTextColor={INK_60}
                    secureTextEntry
                    value={pwForm.next}
                    onChangeText={t => setPwForm(p => ({ ...p, next: t }))}
                  />
                </View>
              </View>

              <View style={s.pwFieldWrap}>
                <Text style={s.pwFieldLabel}>CONFIRM NEW PASSWORD</Text>
                <View style={s.pwInputWrap}>
                  <Ionicons name="checkmark-circle-outline" size={16} color={INK_60} style={{ marginRight: 8 }} />
                  <TextInput
                    style={s.pwInput}
                    placeholder="Re-enter new password"
                    placeholderTextColor={INK_60}
                    secureTextEntry
                    value={pwForm.confirm}
                    onChangeText={t => setPwForm(p => ({ ...p, confirm: t }))}
                  />
                </View>
              </View>
            </View>

            {/* Save button */}
            <TouchableOpacity
              style={[s.pwSaveBtn, pwLoading && { opacity: 0.7 }]}
              onPress={handleChangePassword}
              disabled={pwLoading}
            >
              <Ionicons name="checkmark" size={18} color={WHITE} />
              <Text style={s.pwSaveTxt}>{pwLoading ? 'Saving...' : 'Update Password'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: WASHI_DARK,
  },

  // ── Banner ──
  banner: {
    paddingBottom: 28,
    paddingHorizontal: 20,
    position: 'relative',
    overflow: 'hidden',
  },
  bannerTopBar: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: BENI,
  },
  bannerPetal1: {
    position: 'absolute',
    top: 18, right: 22,
    fontSize: 28,
    opacity: 0.14,
  },
  bannerPetal2: {
    position: 'absolute',
    top: 50, right: 68,
    fontSize: 16,
    opacity: 0.10,
  },
  bannerKanji: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    fontSize: 14,
    color: 'rgba(255,255,255,0.06)',
    fontWeight: '900',
    letterSpacing: 3,
  },
  bannerContent: {
    alignItems: 'center',
    paddingTop: 48,
  },
  bannerTagText: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.45)',
    letterSpacing: 3,
    fontWeight: '700',
    marginBottom: 16,
  },

  // Avatar
  avatarWrap:    { position: 'relative', marginBottom: 14 },
  avatarRing: {
    borderWidth: 3,
    borderColor: BENI,
    borderRadius: 60,
    padding: 3,
    shadowColor: BENI,
    shadowOpacity: 0.45,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  cameraBadge: {
    position: 'absolute',
    bottom: 2, right: 2,
    backgroundColor: BENI,
    width: 28, height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: SUMI,
  },
  uploadOverlay: {
    position: 'absolute',
    inset: 0,
    borderRadius: 55,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Name
  bannerName: {
    fontSize: 22,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 0.4,
    marginBottom: 4,
  },
  bannerJoinDate: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.45)',
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  nameEditRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 4,
    width: '100%',
    paddingHorizontal: 10,
  },
  nameInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomWidth: 1,
    borderBottomColor: BENI,
    color: WHITE,
    fontSize: 15,
    paddingVertical: 6,
    paddingHorizontal: 8,
    textAlign: 'center',
  },

  // Stats
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 24,
    width: '100%',
    gap: 0,
  },
  statItem: { flex: 1, alignItems: 'center' },
  statNumber: {
    fontSize: 20,
    fontWeight: '800',
    color: KINCHA_LIGHT,
    letterSpacing: 0.5,
  },
  statLabel: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.45)',
    marginTop: 2,
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },

  // Edit toggle button (top-right of banner)
  editToggleBtn: {
    position: 'absolute',
    top: 52,
    right: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(192,57,43,0.15)',
    borderWidth: 0.8,
    borderColor: BENI,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 3,
  },
  editToggleTxt: {
    fontSize: 11,
    color: BENI,
    fontWeight: '700',
    letterSpacing: 0.4,
  },

  // ── Card ──
  card: {
    backgroundColor: WASHI,
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 18,
    shadowColor: SUMI,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },

  // ── Section header ──
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  sectionBar: {
    width: 3,
    height: 16,
    backgroundColor: BENI,
    borderRadius: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: SUMI,
    letterSpacing: 0.3,
  },
  sectionKanji: {
    fontSize: 10,
    color: INK_60,
    letterSpacing: 1.5,
  },

  // ── Info rows ──
  infoRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  infoIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(192,57,43,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  infoContent: { flex: 1 },
  infoLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: INK_60,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 3,
  },
  infoValue: {
    fontSize: 15,
    color: SUMI,
    fontWeight: '500',
  },

  // Editable field
  fieldInput: {
    fontSize: 15,
    color: SUMI,
    borderBottomWidth: 1.5,
    borderBottomColor: BENI,
    paddingVertical: 4,
    paddingHorizontal: 0,
  },
  dateTouchable: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1.5,
    borderBottomColor: BENI,
    paddingVertical: 6,
  },

  // ── Save button ──
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: BENI,
    borderRadius: 6,
    paddingVertical: 13,
    shadowColor: BENI,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  saveBtnText: {
    color: WHITE,
    fontSize: 14,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Travel history ──
  tripToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tripToggleLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  },
  tripCountBadge: {
    backgroundColor: BENI,
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  tripCountText: { fontSize: 11, fontWeight: '800', color: WHITE },

  emptyTrips: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  emptyTripsText: {
    fontSize: 14,
    color: INK_60,
    fontWeight: '600',
  },
  emptyTripsSub: {
    fontSize: 11,
    color: INK_60,
    opacity: 0.6,
  },

  // ── Logout ──
  logoutWrap: {
    marginHorizontal: 16,
    marginTop: 14,
  },

  // ── Guest screen ──
  guestContainer: {
    flex: 1,
    backgroundColor: WASHI,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    overflow: 'hidden',
    position: 'relative',
  },
  guestCircle1: {
    position: 'absolute',
    top: -50, right: -40,
    width: 200, height: 200,
    borderRadius: 100,
    backgroundColor: SAKURA,
    opacity: 0.35,
  },
  guestCircle2: {
    position: 'absolute',
    bottom: 50, left: -60,
    width: 160, height: 160,
    borderRadius: 80,
    backgroundColor: WASHI_DARK,
    opacity: 0.7,
  },
  guestCircle3: {
    position: 'absolute',
    bottom: -30, right: 20,
    width: 90, height: 90,
    borderRadius: 45,
    backgroundColor: SAKURA,
    opacity: 0.2,
  },
  guestKanji: {
    position: 'absolute',
    top: 60, left: 24,
    fontSize: 80,
    color: INK_20,
    fontWeight: '900',
  },
  guestIconRing: {
    borderWidth: 2,
    borderColor: BENI,
    borderRadius: 70,
    padding: 6,
    marginBottom: 28,
    shadowColor: BENI,
    shadowOpacity: 0.25,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  guestIconInner: {
    width: 110, height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(192,57,43,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: SUMI,
    marginBottom: 10,
    textAlign: 'center',
    letterSpacing: 0.4,
  },
  guestSubtitle: {
    fontSize: 14,
    color: INK_60,
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 22,
    paddingHorizontal: 10,
  },
  guestBtnWrap: {
    borderRadius: 6,
    shadowColor: BENI,
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  guestBtn: {
    flexDirection: 'row',
    paddingVertical: 14,
    paddingHorizontal: 36,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  guestBtnText: {
    color: WHITE,
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  // ── Change password button ──
  changePwBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, alignSelf: 'center',
    borderWidth: 1, borderColor: BENI,
    paddingHorizontal: 20, paddingVertical: 10,
    borderRadius: 8, marginTop: 8,
    backgroundColor: 'rgba(192,57,43,0.05)',
  },
  securityRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  securityLeft: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  securityIconWrap: {
    width: 34, height: 34, borderRadius: 10,
    backgroundColor: 'rgba(192,57,43,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  securityLabel: {
    fontSize: 14, fontWeight: '600', color: SUMI,
  },
  resetPwBtn: {
    borderWidth: 1, borderColor: BENI,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: 'rgba(192,57,43,0.05)',
  },
  resetPwTxt: {
    fontSize: 13, fontWeight: '700', color: BENI,
  },
  changePwTxt: { fontSize: 14, fontWeight: '700', color: BENI },

  // ── Change password modal ──
  pwBackdrop: { flex: 1, backgroundColor: 'rgba(28,20,16,0.55)', justifyContent: 'flex-end' },
  pwCard: {
    backgroundColor: WASHI, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, paddingBottom: 32,
  },
  pwHandle: {
    width: 36, height: 4, backgroundColor: INK_20, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 12,
  },
  pwHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 20,
  },
  pwTitle: { fontSize: 16, fontWeight: '800', color: SUMI },
  pwInput: {
    flex: 1, paddingVertical: 12,
    fontSize: 15, color: SUMI,
  },
  pwIconWrap: {
    width: 28, height: 28, borderRadius: 6,
    backgroundColor: BENI, alignItems: 'center', justifyContent: 'center',
  },
  pwCloseBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: WASHI_DARK, alignItems: 'center', justifyContent: 'center',
  },
  pwDivider: { height: 0.5, backgroundColor: INK_20, marginVertical: 16 },
  pwFieldWrap: { gap: 6 },
  pwFieldLabel: {
    fontSize: 10, fontWeight: '700', color: INK_60,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  pwInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: INK_20, backgroundColor: WASHI_DARK,
    borderRadius: 10, paddingHorizontal: 12, paddingVertical: 2,
  },
  pwSaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: BENI, borderRadius: 10, paddingVertical: 14,
    marginTop: 20,
    shadowColor: BENI, shadowOpacity: 0.3, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  pwSaveTxt: { color: WHITE, fontSize: 15, fontWeight: '800' },
});

// ─── Preference styles ────────────────────────────────────────────────────────
const p = StyleSheet.create({
  editPrefBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4, marginLeft: 'auto',
    borderWidth: 1, borderColor: BENI, borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 4,
    backgroundColor: 'rgba(192,57,43,0.04)',
  },
  editPrefTxt: { fontSize: 11, color: BENI, fontWeight: '700' },

  styleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  styleLabel: { fontSize: 11, color: INK_60, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  stylePill: {
    backgroundColor: 'rgba(184,150,62,0.12)', borderRadius: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: KINCHA,
  },
  stylePillText: { fontSize: 12, color: KINCHA, fontWeight: '700' },

  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(192,57,43,0.06)', borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(192,57,43,0.2)',
    paddingHorizontal: 8, paddingVertical: 4,
  },
  chipText: { fontSize: 11, color: BENI, fontWeight: '600' },

  emptyPref: { alignItems: 'center', paddingVertical: 18, gap: 6 },
  emptyPrefText: { fontSize: 13, color: INK_60 },

  // Modal
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(28,20,16,0.55)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: WASHI, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, maxHeight: '85%',
  },
  modalHandle: {
    width: 36, height: 4, backgroundColor: INK_20, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  modalHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: INK_20, marginBottom: 4,
  },
  modalTitle: { fontSize: 16, fontWeight: '800', color: SUMI },

  groupLabel: {
    fontSize: 11, fontWeight: '700', color: INK_60,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: 16, marginBottom: 10,
  },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6,
    borderWidth: 1.2, borderColor: INK_20, backgroundColor: WASHI_DARK,
  },
  optionChipActive: { backgroundColor: BENI, borderColor: BENI },
  optionChipText: { fontSize: 12, fontWeight: '600', color: SUMI },
  optionChipTextActive: { color: WHITE },
});