import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  ActivityIndicator, Alert, SafeAreaView, RefreshControl, Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/api.js';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import MemberLocationMap from '@/components/ui/trip/member/MemberLocation';

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

// ─── Avatar colors (cycle through for each member) ───────────────────────────
const AVATAR_COLORS = [
  '#C0392B', '#B8963E', '#2E86AB', '#A23B72', '#3D9970', '#856084',
];

export default function MemberScreen() {
  const { trip_id } = useLocalSearchParams();
  const router = useRouter();

  const [loading, setLoading]               = useState(true);
  const [members, setMembers]               = useState<any[]>([]);
  const [tripGroup, setTripGroup]           = useState<any>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState('');
  const [user, setUser]                     = useState<any>(null);
  const [refreshing, setRefreshing]         = useState(false);
  const [showMap, setShowMap]               = useState(false);

  useFocusEffect(useCallback(() => { fetchData(); }, [trip_id]));

  const fetchData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      const userRes = await axios.get(`${API_URL}/user`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setCurrentUserEmail(userRes.data.email);
      setUser(userRes.data);

      const planRes = await axios.get(`${API_URL}/trip_plan/${trip_id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const realTripId = planRes.data.trip_id;

      if (realTripId) {
        const groupRes = await axios.get(`${API_URL}/trip_group/${realTripId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTripGroup(groupRes.data);
        setMembers(groupRes.data.members || []);
      }
    } catch {
      Alert.alert('Error', 'Could not load member data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCopyCode = async () => {
    if (tripGroup?.uniqueCode) {
      await Clipboard.setStringAsync(tripGroup.uniqueCode);
      Alert.alert('Copied!', 'Invite code copied to clipboard');
    }
  };

  const handleRemoveMember = (memberId: number, name: string) => {
    Alert.alert('Remove Member', `Remove ${name} from this trip?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('access_token');
            if (!token || !tripGroup?.trip_id) return;
            await axios.delete(`${API_URL}/trip_group/${tripGroup.trip_id}/members/${memberId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            setMembers(prev => prev.filter(m => m.group_member_id !== memberId));
          } catch {
            Alert.alert('Error', 'Could not remove member');
          }
        },
      },
    ]);
  };

  const handleLeaveGroup = () => {
    Alert.alert('Leave Trip', 'Are you sure you want to leave this trip?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive',
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem('access_token');
            if (!token || !tripGroup?.trip_id) return;
            await axios.delete(`${API_URL}/trip_group/${tripGroup.trip_id}/leave`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            router.replace('/(tabs)/mytrip');
          } catch {
            Alert.alert('Error', 'Could not leave group');
          }
        },
      },
    ]);
  };

  const isOwner = tripGroup?.owner?.email === currentUserEmail;

  // ─── Member card ────────────────────────────────────────────────────────────
  const renderItem = ({ item, index }: { item: any; index: number }) => {
    const u            = item.customer;
    const isMe         = u.email === currentUserEmail;
    const isMemberOwner = tripGroup?.owner_id === u.customer_id;
    const avatarColor  = AVATAR_COLORS[index % AVATAR_COLORS.length];
    const initials     = `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase() || '?';

    return (
      <View style={s.memberCard}>
        {/* Left stripe color per member */}
        <View style={[s.memberStripe, { backgroundColor: avatarColor }]} />

        {/* Avatar */}
        <View style={[s.avatar, { backgroundColor: avatarColor + '20', borderColor: avatarColor + '40' }]}>
          <Text style={[s.avatarText, { color: avatarColor }]}>{initials}</Text>
        </View>

        {/* Info */}
        <View style={s.memberInfo}>
          <View style={s.memberNameRow}>
            <Text style={s.memberName} numberOfLines={1}>
              {u.first_name} {u.last_name}
              {isMe && <Text style={s.meLabel}> (You)</Text>}
            </Text>
            {isMemberOwner && (
              <View style={s.ownerBadge}>
                <Ionicons name="star" size={9} color={KINCHA_LIGHT} />
                <Text style={s.ownerText}>Owner</Text>
              </View>
            )}
          </View>
          <Text style={s.memberEmail} numberOfLines={1}>{u.email}</Text>
        </View>

        {/* Remove button */}
        {isOwner && !isMemberOwner && (
          <TouchableOpacity
            style={s.removeBtn}
            onPress={() => handleRemoveMember(item.group_member_id, u.first_name)}
            activeOpacity={0.8}
          >
            <Ionicons name="person-remove-outline" size={14} color={BENI} />
          </TouchableOpacity>
        )}
      </View>
    );
  };

  // ─── Loading ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.loadingScreen}>
        <ActivityIndicator color={BENI} size="large" />
        <Text style={s.loadingText}>Loading members...</Text>
      </View>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={s.screen}>

      {/* ── Page header ── */}
      <View style={s.pageHeader}>
        <View style={s.pageTopBar} />
        <View style={s.pageHeaderInner}>
          <View style={s.pageTitleRow}>
            <View style={s.pageTitleAccent} />
            <View>
              <Text style={s.pageTitle}>Trip Members</Text>
              <Text style={s.pageSub}>{members.length} member{members.length !== 1 ? 's' : ''}</Text>
            </View>
          </View>
        </View>
        {/* Kincha divider */}
        <View style={s.headerDivRow}>
          <View style={s.headerDivLine} />
          <Text style={s.headerDivDot}>✦</Text>
          <View style={s.headerDivLine} />
        </View>
      </View>

      <FlatList
        data={members}
        keyExtractor={item => item.group_member_id.toString()}
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={s.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => { setRefreshing(true); fetchData(true); }}
            colors={[BENI]}
            tintColor={BENI}
          />
        }
        ListHeaderComponent={
          <>
            {/* ── Invite code card ── */}
            {tripGroup && (
              <View style={s.inviteCard}>
                <View style={s.inviteLeft}>
                  <Text style={s.inviteLabel}>INVITE CODE</Text>
                  <Text style={s.inviteCode}>{tripGroup.uniqueCode}</Text>
                </View>
                <TouchableOpacity style={s.copyBtn} onPress={handleCopyCode} activeOpacity={0.85}>
                  <Ionicons name="copy-outline" size={14} color={WASHI} />
                  <Text style={s.copyBtnText}>Copy</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* ── See location button ── */}
            <TouchableOpacity
              style={s.mapBtn}
              onPress={() => {
                if (tripGroup?.uniqueCode) setShowMap(true);
                else Alert.alert('No group code yet');
              }}
              activeOpacity={0.85}
            >
              <Ionicons name="map-outline" size={15} color={WASHI} />
              <Text style={s.mapBtnText}>View Member Locations</Text>
            </TouchableOpacity>

            {/* ── Section label ── */}
            <View style={s.sectionHeader}>
              <View style={s.sectionBar} />
              <Text style={s.sectionLabel}>Members</Text>
            </View>
          </>
        }
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Ionicons name="people-outline" size={32} color={INK_30} />
            <Text style={s.emptyText}>No members yet</Text>
          </View>
        }
      />

      {/* ── Leave group button (non-owner only) ── */}
      {!isOwner && (
        <View style={s.footer}>
          <TouchableOpacity style={s.leaveBtn} onPress={handleLeaveGroup} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={16} color={BENI} />
            <Text style={s.leaveBtnText}>Leave Trip</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Map modal ── */}
      <Modal visible={showMap} animationType="slide" onRequestClose={() => setShowMap(false)}>
        {tripGroup && (
          <MemberLocationMap
            groupCode={tripGroup.uniqueCode}
            userId={user?.customer_id || 0}
            userName={user?.first_name || 'Me'}
            onClose={() => setShowMap(false)}
          />
        )}
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: WASHI },

  // Loading
  loadingScreen: { flex: 1, backgroundColor: WASHI, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontSize: 12, fontFamily: 'NotoSansJP_400Regular', color: INK_60 },

  // Page header
  pageHeader: { backgroundColor: SUMI },
  pageTopBar: { height: 3, backgroundColor: BENI },
  pageHeaderInner: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10 },
  pageTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pageTitleAccent: { width: 3, height: 28, backgroundColor: BENI, borderRadius: 99 },
  pageTitle: { fontSize: 16, fontFamily: 'ShipporiMincho_800ExtraBold', color: WASHI, letterSpacing: 0.3 },
  pageSub: { fontSize: 10, fontFamily: 'NotoSansJP_400Regular', color: 'rgba(250,245,236,0.5)', marginTop: 1 },
  headerDivRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  headerDivLine: { flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.3 },
  headerDivDot: { fontSize: 7, color: KINCHA, marginHorizontal: 7, opacity: 0.4 },

  // List
  listContent: { paddingHorizontal: 16, paddingBottom: 90, paddingTop: 12 },

  // Invite card
  inviteCard: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: WHITE, borderRadius: 12, padding: 12,
    marginBottom: 8, borderWidth: 1, borderColor: INK_12,
    shadowColor: SUMI, shadowOpacity: 0.05, shadowRadius: 4, shadowOffset: { width: 0, height: 1 }, elevation: 2,
  },
  inviteLeft: {},
  inviteLabel: { fontSize: 9, fontFamily: 'NotoSansJP_700Bold', color: INK_30, letterSpacing: 1.1, textTransform: 'uppercase', marginBottom: 3 },
  inviteCode: { fontSize: 18, fontFamily: 'NotoSansJP_700Bold', color: SUMI, letterSpacing: 3 },
  copyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: BENI, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 99,
  },
  copyBtnText: { fontSize: 11, fontFamily: 'NotoSansJP_700Bold', color: WASHI },

  // Map button
  mapBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: SUMI, paddingVertical: 10, borderRadius: 10, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(184,150,62,0.3)',
  },
  mapBtnText: { fontSize: 12, fontFamily: 'NotoSansJP_700Bold', color: WASHI },

  // Section header
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 8 },
  sectionBar: { width: 3, height: 12, backgroundColor: BENI, borderRadius: 99 },
  sectionLabel: { fontSize: 10, fontFamily: 'NotoSansJP_700Bold', color: INK_60, letterSpacing: 1.1, textTransform: 'uppercase' },

  // Member card
  memberCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: WHITE, borderRadius: 12,
    marginBottom: 6, overflow: 'hidden',
    borderWidth: 1, borderColor: INK_12,
    shadowColor: SUMI, shadowOpacity: 0.03, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  memberStripe: { width: 3, alignSelf: 'stretch' },
  avatar: {
    width: 36, height: 36, borderRadius: 18,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    marginHorizontal: 10,
  },
  avatarText: { fontSize: 13, fontFamily: 'ShipporiMincho_700Bold' },
  memberInfo: { flex: 1, paddingVertical: 10, paddingRight: 8 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  memberName: { fontSize: 13, fontFamily: 'NotoSansJP_700Bold', color: SUMI, flexShrink: 1 },
  meLabel: { fontFamily: 'NotoSansJP_400Regular', color: INK_30, fontSize: 11 },
  memberEmail: { fontSize: 10, fontFamily: 'NotoSansJP_400Regular', color: INK_30, marginTop: 1 },
  ownerBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(184,150,62,0.1)', borderWidth: 0.8, borderColor: KINCHA,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
  },
  ownerText: { fontSize: 9, fontFamily: 'NotoSansJP_700Bold', color: KINCHA_LIGHT },
  removeBtn: {
    width: 28, height: 28, borderRadius: 14, marginRight: 10,
    backgroundColor: 'rgba(192,57,43,0.07)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Empty
  emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyText: { fontSize: 12, fontFamily: 'NotoSansJP_400Regular', color: INK_30 },

  // Footer
  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 24,
    backgroundColor: WASHI, borderTopWidth: 1, borderTopColor: INK_12,
  },
  leaveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7,
    paddingVertical: 11, borderRadius: 99,
    borderWidth: 1.5, borderColor: BENI,
    backgroundColor: 'rgba(192,57,43,0.05)',
  },
  leaveBtnText: { fontSize: 13, fontFamily: 'NotoSansJP_700Bold', color: BENI },
});