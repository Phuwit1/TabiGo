import React, { useState } from 'react';
import {
  View, Text, TextInput, StyleSheet, Image, TouchableOpacity,
  Share, Alert, ActivityIndicator, Modal,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Linking from 'expo-linking';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/api.js';
import * as ImagePicker from 'expo-image-picker';

// ─── Palette ──────────────────────────────────────────────────────────────────
const BENI         = '#C0392B';
const KINCHA       = '#B8963E';
const KINCHA_LIGHT = '#D4AF55';
const SUMI         = '#1C1410';
const WASHI        = '#FAF5EC';
const WASHI_DARK   = '#EDE5D8';
const WHITE        = '#FFFFFF';
const INK_60       = 'rgba(28,20,16,0.6)';
const INK_30       = 'rgba(28,20,16,0.3)';
const INK_12       = 'rgba(28,20,16,0.12)';

const CLOUD_NAME    = 'dqghrasqe';
const UPLOAD_PRESET = 'TabiGo';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  'On Trip':    { color: KINCHA_LIGHT, bg: 'rgba(184,150,62,0.12)', icon: 'airplane' as const },
  'Upcoming':   { color: BENI,         bg: 'rgba(192,57,43,0.1)',   icon: 'time-outline' as const },
  'Trip Ended': { color: INK_60,       bg: 'rgba(28,20,16,0.07)',   icon: 'checkmark-done' as const },
};

interface TripCardProps {
  name: string;
  date: string;
  duration: string;
  status: 'On Trip' | 'Upcoming' | 'Trip Ended';
  people: number;
  image: string;
  budget?: number;
  netStatus?: boolean;
  planId?: string;
  tripId?: string;
  groupcode?: string;
  onGroupCreated?: (newGroupData: any) => void;
  onNameUpdate?: (newName: string) => void;
  onImageUpdate?: (newImageUrl: string) => void;
}

const TripCardID: React.FC<TripCardProps> = ({
  name, date, duration, status, people, image,
  budget = 0, netStatus, planId, tripId,
  onGroupCreated, onNameUpdate, onImageUpdate,
}) => {
  const router = useRouter();

  const [uploading, setUploading]           = useState(false);
  const [loading, setLoading]               = useState(false);
  const [groupCode, setGroupCode]           = useState<string | null>(null);
  const [isEditingName, setIsEditingName]   = useState(false);
  const [tripName, setTripName]             = useState(name);
  const [tempName, setTempName]             = useState(name);
  const [savingName, setSavingName]         = useState(false);
  const [isShareModalVisible, setShareModalVisible] = useState(false);

  const hasGroup = !!tripId || !!groupCode;
  const st = STATUS_CONFIG[status] ?? STATUS_CONFIG['Upcoming'];

  // ── Navigation ─────────────────────────────────────────────────────────────
  const goToBudget = () => router.push(`/trip/${planId}/budget`);
  const goToMember = () => router.push(`/trip/${planId}/member`);

  // ── Cloudinary upload ──────────────────────────────────────────────────────
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
    return json.secure_url;
  };

  // ── Change cover image ─────────────────────────────────────────────────────
  const handleChangeImage = async () => {
    const { status: perm } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (perm !== 'granted') { Alert.alert('Permission needed'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images', allowsEditing: true, aspect: [16, 9], quality: 0.7,
    });
    if (result.canceled) return;
    try {
      setUploading(true);
      const newUrl = await uploadToCloudinary(result.assets[0].uri);
      const token = await AsyncStorage.getItem('access_token');
      await axios.put(`${API_URL}/trip_plan/${planId}`, { image: newUrl }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      onImageUpdate?.(newUrl);
    } catch {
      Alert.alert('Error', 'Image upload failed');
    } finally {
      setUploading(false);
    }
  };

  // ── Edit name ──────────────────────────────────────────────────────────────
  const handleEditname = async () => {
    if (!tempName.trim()) { Alert.alert('Error', 'Trip name cannot be empty'); return; }
    if (tempName === tripName) { setIsEditingName(false); return; }
    try {
      setSavingName(true);
      const token = await AsyncStorage.getItem('access_token');
      await axios.put(`${API_URL}/trip_plan/${planId}`, { name_group: tempName }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTripName(tempName);
      setIsEditingName(false);
      onNameUpdate?.(tempName);
    } catch {
      Alert.alert('Error', 'Could not update trip name');
      setTempName(tripName);
    } finally {
      setSavingName(false);
    }
  };

  // ── Group / share ──────────────────────────────────────────────────────────
  const handleCreateGroup = async () => {
    setLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      const res = await axios.post(`${API_URL}/trip_group/create_from_plan/${planId}`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setGroupCode(res.data.uniqueCode);
      onGroupCreated?.(res.data);
    } catch {
      Alert.alert('Error', 'Failed to create group');
    } finally {
      setLoading(false);
    }
  };

  const onSharePress = async () => {
    if (groupCode) { setShareModalVisible(true); return; }
    if (tripId) {
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('access_token');
        const res = await axios.get(`${API_URL}/trip_group/${tripId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setGroupCode(res.data.uniqueCode);
        setShareModalVisible(true);
      } catch { Alert.alert('Error', 'Could not fetch group info'); }
      finally { setLoading(false); }
    }
  };

  const handleCopyCode = async () => {
    if (groupCode) { await Clipboard.setStringAsync(groupCode); Alert.alert('Copied!', 'Invite code copied'); }
  };
  const handleCopyLink = async () => {
    if (groupCode) {
      const url = Linking.createURL('join-trip', { queryParams: { code: groupCode } });
      await Clipboard.setStringAsync(url);
      Alert.alert('Copied!', 'Link copied');
    }
  };
  const handleShareSystem = async () => {
    if (!groupCode) return;
    const url = Linking.createURL('join-trip', { queryParams: { code: groupCode } });
    await Share.share({ message: `Join my trip "${tripName}" on TabiGo!\nCode: ${groupCode}\nLink: ${url}` });
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <View style={c.card}>
      {/* Beni left stripe */}
      <View style={c.leftStripe} />

      <View style={c.inner}>
        {/* ── Header row ── */}
        <View style={c.headerRow}>
          <View style={c.titleWrap}>
            {isEditingName ? (
              <View style={c.editRow}>
                <TextInput
                  style={c.nameInput}
                  value={tempName}
                  onChangeText={setTempName}
                  autoFocus
                  selectionColor={BENI}
                  placeholderTextColor={INK_30}
                />
                {savingName ? (
                  <ActivityIndicator size="small" color={BENI} />
                ) : (
                  <View style={c.editActions}>
                    <TouchableOpacity onPress={handleEditname}>
                      <Ionicons name="checkmark-circle" size={22} color={KINCHA} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => { setTempName(tripName); setIsEditingName(false); }}>
                      <Ionicons name="close-circle" size={22} color={BENI} />
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            ) : (
              <View style={c.nameRow}>
                <Text style={c.tripName} numberOfLines={1}>{tripName}</Text>
                {netStatus && (
                  <TouchableOpacity onPress={() => setIsEditingName(true)} style={c.pencilBtn}>
                    <Ionicons name="pencil" size={13} color={INK_60} />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>

          {/* Status + action row */}
          <View style={c.badgeRow}>
            <View style={[c.statusBadge, { backgroundColor: st.bg }]}>
              <Ionicons name={st.icon} size={11} color={st.color} />
              <Text style={[c.statusText, { color: st.color }]}>{status}</Text>
            </View>
            {netStatus && (
              !hasGroup ? (
                <TouchableOpacity style={c.createGroupBtn} onPress={handleCreateGroup} disabled={loading} activeOpacity={0.85}>
                  {loading
                    ? <ActivityIndicator size="small" color={KINCHA_LIGHT} />
                    : <><Ionicons name="people-outline" size={11} color={KINCHA_LIGHT} /><Text style={c.createGroupText}>Group</Text></>
                  }
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={c.shareBtn} onPress={onSharePress} disabled={loading} activeOpacity={0.85}>
                  {loading
                    ? <ActivityIndicator size="small" color={WASHI} />
                    : <><Ionicons name="share-social-outline" size={11} color={WASHI} /><Text style={c.shareBtnText}>Share</Text></>
                  }
                </TouchableOpacity>
              )
            )}
          </View>
        </View>

        {/* ── Content row: image + info ── */}
        <View style={c.contentRow}>
          {/* Cover image */}
          <TouchableOpacity onPress={handleChangeImage} disabled={uploading} style={c.imgWrap} activeOpacity={0.85}>
            {uploading ? (
              <View style={c.imgLoading}><ActivityIndicator color={BENI} /></View>
            ) : (
              <>
                <Image source={{ uri: image }} style={c.img} />
                <View style={c.imgOverlay} />
                <View style={c.camBadge}><Ionicons name="camera" size={11} color={WHITE} /></View>
              </>
            )}
          </TouchableOpacity>

          {/* Info rows */}
          <View style={c.infoCol}>
            <InfoRow icon="calendar-outline" value={date} />
            <InfoRow icon="airplane-outline" value={`${duration} Days`} />
            <InfoRow icon="cash-outline" value={`฿ ${budget?.toLocaleString()}`}>
              {netStatus && (
                <TouchableOpacity style={c.miniBtn} onPress={goToBudget} activeOpacity={0.8}>
                  <Ionicons name="pencil-outline" size={11} color={BENI} />
                </TouchableOpacity>
              )}
            </InfoRow>
            <InfoRow icon="people-outline" value={`${people} people`}>
              {netStatus && (
                <TouchableOpacity style={c.miniBtn} onPress={goToMember} activeOpacity={0.8}>
                  <Ionicons name="pencil-outline" size={11} color={BENI} />
                </TouchableOpacity>
              )}
            </InfoRow>
          </View>
        </View>


      </View>

      {/* ── Share modal ── */}
      <Modal visible={isShareModalVisible} transparent animationType="fade" onRequestClose={() => setShareModalVisible(false)}>
        <View style={m.overlay}>
          <View style={m.card}>
            <View style={m.topBar} />
            <View style={m.header}>
              <View style={m.headerLeft}>
                <View style={m.headerAccent} />
                <Text style={m.title}>Invite Friends</Text>
              </View>
              <TouchableOpacity style={m.closeBtn} onPress={() => setShareModalVisible(false)}>
                <Ionicons name="close" size={16} color={WASHI} />
              </TouchableOpacity>
            </View>

            <View style={m.body}>
              <Text style={m.label}>INVITE CODE</Text>
              <TouchableOpacity style={m.copyBox} onPress={handleCopyCode} activeOpacity={0.8}>
                <Text style={m.codeText}>{loading ? '...' : (groupCode ?? '—')}</Text>
                <View style={m.copyIcon}><Ionicons name="copy-outline" size={15} color={BENI} /></View>
              </TouchableOpacity>

              <Text style={[m.label, { marginTop: 14 }]}>INVITE LINK</Text>
              <TouchableOpacity style={m.copyBox} onPress={handleCopyLink} activeOpacity={0.8}>
                <Text style={m.linkText} numberOfLines={1}>tabigo://join-trip?code={groupCode}</Text>
                <View style={m.copyIcon}><Ionicons name="link-outline" size={15} color={BENI} /></View>
              </TouchableOpacity>

              <TouchableOpacity style={m.shareBtn} onPress={handleShareSystem} activeOpacity={0.85}>
                <Ionicons name="share-outline" size={16} color={WASHI} />
                <Text style={m.shareBtnText}>Share via other apps</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

// ─── InfoRow helper ───────────────────────────────────────────────────────────
const InfoRow = ({
  icon, value, children,
}: { icon: any; value: string; children?: React.ReactNode }) => (
  <View style={c.infoRow}>
    <View style={c.infoIcon}><Ionicons name={icon} size={12} color={BENI} /></View>
    <Text style={c.infoText}>{value}</Text>
    {children}
  </View>
);

// ─── Card styles ──────────────────────────────────────────────────────────────
const c = StyleSheet.create({
  card: {
    backgroundColor: WASHI,
    borderRadius: 16,
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: INK_12,
    shadowColor: SUMI,
    shadowOpacity: 0.14,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  leftStripe: { width: 3, backgroundColor: BENI },
  inner: { flex: 1, padding: 14 },

  // Header
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10, gap: 8 },
  titleWrap: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tripName: { fontSize: 16, fontFamily: 'ShipporiMincho_700Bold', color: SUMI, flexShrink: 1 },
  pencilBtn: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: WASHI_DARK,
    alignItems: 'center', justifyContent: 'center',
  },
  editRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
  nameInput: {
    flex: 1, borderBottomWidth: 1.5, borderBottomColor: BENI,
    fontSize: 15, fontFamily: 'ShipporiMincho_700Bold', color: SUMI, paddingVertical: 2,
  },
  editActions: { flexDirection: 'row', gap: 6 },

  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 0 },
  // Status badge
  statusBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 4, borderRadius: 99 },
  statusText: { fontSize: 10, fontFamily: 'NotoSansJP_700Bold', letterSpacing: 0.3 },

  // Content
  contentRow: { flexDirection: 'row', gap: 12 },

  // Image
  imgWrap: { width: 110, height: 90, borderRadius: 10, overflow: 'hidden', backgroundColor: WASHI_DARK },
  img: { width: '100%', height: '100%', resizeMode: 'cover' },
  imgOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,20,16,0.1)' },
  imgLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: WASHI_DARK },
  camBadge: {
    position: 'absolute', bottom: 5, right: 5,
    backgroundColor: 'rgba(28,20,16,0.6)', padding: 4, borderRadius: 99,
  },

  // Info
  infoCol: { flex: 1, justifyContent: 'space-between' },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  infoIcon: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(192,57,43,0.07)',
    alignItems: 'center', justifyContent: 'center',
  },
  infoText: { fontSize: 12, fontFamily: 'NotoSansJP_400Regular', color: INK_60, flex: 1 },
  miniBtn: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 1, borderColor: 'rgba(192,57,43,0.25)',
    backgroundColor: 'rgba(192,57,43,0.06)', alignItems: 'center', justifyContent: 'center',
  },

  createGroupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    borderWidth: 1, borderColor: KINCHA,
    backgroundColor: 'rgba(184,150,62,0.07)',
    paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
  },
  createGroupText: { fontSize: 10, fontFamily: 'NotoSansJP_700Bold', color: KINCHA_LIGHT },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: BENI, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 99,
    shadowColor: BENI, shadowOpacity: 0.25, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  shareBtnText: { fontSize: 10, fontFamily: 'NotoSansJP_700Bold', color: WASHI },
});

// ─── Modal styles ─────────────────────────────────────────────────────────────
const m = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(28,20,16,0.55)', justifyContent: 'center', alignItems: 'center', padding: 28 },
  card: {
    width: '100%', maxWidth: 380,
    backgroundColor: WASHI, borderRadius: 20, overflow: 'hidden',
    shadowColor: SUMI, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10,
  },
  topBar: { height: 3, backgroundColor: BENI },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 14 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerAccent: { width: 3, height: 16, backgroundColor: BENI, borderRadius: 99 },
  title: { fontSize: 16, fontFamily: 'ShipporiMincho_700Bold', color: SUMI },
  closeBtn: { width: 28, height: 28, borderRadius: 99, backgroundColor: SUMI, alignItems: 'center', justifyContent: 'center' },
  body: { paddingHorizontal: 18, paddingBottom: 22 },
  label: { fontSize: 10, fontFamily: 'NotoSansJP_700Bold', color: INK_30, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 7 },
  copyBox: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: WASHI_DARK, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    borderWidth: 1, borderColor: INK_12,
  },
  codeText: { fontSize: 20, fontFamily: 'NotoSansJP_700Bold', letterSpacing: 4, color: SUMI },
  linkText: { fontSize: 12, fontFamily: 'NotoSansJP_400Regular', color: BENI, flex: 1, marginRight: 8 },
  copyIcon: {
    width: 28, height: 28, borderRadius: 99,
    backgroundColor: 'rgba(192,57,43,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  shareBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    backgroundColor: BENI, paddingVertical: 13, borderRadius: 99, marginTop: 20,
    shadowColor: BENI, shadowOpacity: 0.3, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  shareBtnText: { color: WASHI, fontFamily: 'NotoSansJP_700Bold', fontSize: 14 },
});

export default TripCardID;