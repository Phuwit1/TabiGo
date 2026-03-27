import React, { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, Pressable,
  ActivityIndicator, Alert, SafeAreaView, RefreshControl, Modal, Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { API_URL } from '@/api.js';
import * as Clipboard from 'expo-clipboard';
import { useFocusEffect } from '@react-navigation/native';
import MemberLocationMap from '@/components/ui/trip/member/MemberLocation';

import { BENI, KINCHA, KINCHA_LIGHT, SUMI, WASHI, WHITE, INK_60, INK_30, INK_12 } from '@/constants/theme';

const WASHI_DARK = '#EDE8DF';

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

  // ── Member role modal ────────────────────────────────────────────────────
  const [selectedMember, setSelectedMember] = useState<any>(null);
  const [pendingRole, setPendingRole]       = useState<'editor' | 'member'>('member');
  const [roleLoading, setRoleLoading]       = useState(false);

  // ── Kick confirm modal ───────────────────────────────────────────────────
  const [kickTarget, setKickTarget]         = useState<{ id: number; name: string } | null>(null);
  const [kickLoading, setKickLoading]       = useState(false);

  useFocusEffect(useCallback(() => { fetchData(); }, [trip_id]));

  const fetchData = async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;

      const [userRes, planRes] = await Promise.all([
        axios.get(`${API_URL}/user`,               { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/trip_plan/${trip_id}`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      setCurrentUserEmail(userRes.data.email);
      setUser(userRes.data);
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
    setKickTarget({ id: memberId, name });
  };

  const confirmKick = async () => {
    if (!kickTarget || !tripGroup?.trip_id) return;
    setKickLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;
      await axios.delete(`${API_URL}/trip_group/${tripGroup.trip_id}/members/${kickTarget.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMembers(prev => prev.filter(m => m.group_member_id !== kickTarget.id));
      setKickTarget(null);
    } catch {
      Alert.alert('Error', 'Could not remove member');
    } finally {
      setKickLoading(false);
    }
  };

  const openMemberModal = (item: any) => {
    setSelectedMember(item);
    setPendingRole(item.role === 'editor' ? 'editor' : 'member');
  };

  const closeMemberModal = () => setSelectedMember(null);

  const handleSaveRole = async () => {
    if (!selectedMember || !tripGroup?.trip_id) return;
    setRoleLoading(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;
      await axios.patch(
        `${API_URL}/trip_group/${tripGroup.trip_id}/members/${selectedMember.group_member_id}/role`,
        { role: pendingRole },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMembers(prev => prev.map(m =>
        m.group_member_id === selectedMember.group_member_id ? { ...m, role: pendingRole } : m
      ));
      closeMemberModal();
    } catch {
      Alert.alert('Error', 'Could not change role');
    } finally {
      setRoleLoading(false);
    }
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
    const u             = item.customer;
    const isMe          = u.email === currentUserEmail;
    const isMemberOwner = tripGroup?.owner_id === u.customer_id;
    const avatarColor   = AVATAR_COLORS[index % AVATAR_COLORS.length];
    const initials      = `${u.first_name?.[0] ?? ''}${u.last_name?.[0] ?? ''}`.toUpperCase() || '?';
    const memberRole    = item.role ?? 'member';
    const isEditor      = !isMemberOwner && memberRole === 'editor';

    return (
      <TouchableOpacity
        style={s.memberCard}
        onPress={() => isOwner && !isMemberOwner ? openMemberModal(item) : undefined}
        activeOpacity={isOwner && !isMemberOwner ? 0.75 : 1}
      >
        {/* Avatar */}
        <View style={[s.avatar, { backgroundColor: avatarColor + '18', borderColor: avatarColor + '50' }]}>
          {u.image ? (
            <Image source={{ uri: u.image }} style={s.avatarImg} />
          ) : (
            <Text style={[s.avatarText, { color: avatarColor }]}>{initials}</Text>
          )}
        </View>

        {/* Info */}
        <View style={s.memberInfo}>
          <View style={s.memberNameRow}>
            <Text style={s.memberName} numberOfLines={1}>
              {u.first_name} {u.last_name}
              {isMe && <Text style={s.meLabel}> (You)</Text>}
            </Text>
            {isMemberOwner ? (
              <View style={s.adminBadge}>
                <Ionicons name="shield-checkmark" size={9} color={KINCHA_LIGHT} />
                <Text style={s.adminText}>Admin</Text>
              </View>
            ) : isEditor ? (
              <View style={s.editorBadge}>
                <Ionicons name="pencil" size={9} color={KINCHA} />
                <Text style={s.editorText}>Editor</Text>
              </View>
            ) : (
              <View style={s.roleBadge}>
                <Text style={s.roleBadgeText}>Member</Text>
              </View>
            )}
          </View>
          <Text style={s.memberEmail} numberOfLines={1}>{u.email}</Text>
        </View>

        {/* Remove (kick) button — admin only, not for owner */}
        {isOwner && !isMemberOwner && (
          <TouchableOpacity
            style={s.kickBtn}
            onPress={() => handleRemoveMember(item.group_member_id, u.first_name)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons name="person-remove-outline" size={15} color={BENI} />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
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

      {/* ── Member role modal ── */}
      <Modal
        visible={!!selectedMember}
        transparent
        animationType="slide"
        onRequestClose={closeMemberModal}
      >
        <Pressable style={s.modalOverlay} onPress={closeMemberModal}>
          <Pressable style={s.modalSheet} onPress={e => e.stopPropagation()}>
            <View style={s.modalHandle} />

            {selectedMember && (() => {
              const mu = selectedMember.customer;
              const avatarColor = AVATAR_COLORS[
                members.findIndex(m => m.group_member_id === selectedMember.group_member_id) % AVATAR_COLORS.length
              ];
              const initials = `${mu.first_name?.[0] ?? ''}${mu.last_name?.[0] ?? ''}`.toUpperCase() || '?';
              return (
                <>
                  {/* Avatar */}
                  <View style={[s.modalAvatar, { backgroundColor: avatarColor + '20', borderColor: avatarColor + '60' }]}>
                    {mu.image
                      ? <Image source={{ uri: mu.image }} style={s.modalAvatarImg} />
                      : <Text style={[s.modalAvatarText, { color: avatarColor }]}>{initials}</Text>
                    }
                  </View>

                  {/* Name + email */}
                  <Text style={s.modalName}>{mu.first_name} {mu.last_name}</Text>
                  <Text style={s.modalEmail}>{mu.email}</Text>

                  {/* Divider */}
                  <View style={s.modalDivider} />

                  {/* Role section */}
                  <View style={s.modalRoleSection}>
                    <Text style={s.modalRoleLabel}>ROLE</Text>
                    <View style={s.modalRoleRow}>
                      {/* Member pill */}
                      <TouchableOpacity
                        style={[s.rolePill, pendingRole === 'member' && s.rolePillActive]}
                        onPress={() => setPendingRole('member')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="person-outline"
                          size={14}
                          color={pendingRole === 'member' ? WHITE : INK_60}
                        />
                        <Text style={[s.rolePillText, pendingRole === 'member' && s.rolePillTextActive]}>
                          Member
                        </Text>
                      </TouchableOpacity>

                      {/* Editor pill */}
                      <TouchableOpacity
                        style={[s.rolePill, s.rolePillEditor, pendingRole === 'editor' && s.rolePillEditorActive]}
                        onPress={() => setPendingRole('editor')}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name="pencil-outline"
                          size={14}
                          color={pendingRole === 'editor' ? WHITE : KINCHA}
                        />
                        <Text style={[s.rolePillText, s.rolePillTextEditor, pendingRole === 'editor' && s.rolePillTextEditorActive]}>
                          Editor
                        </Text>
                      </TouchableOpacity>
                    </View>

                    <Text style={s.roleHint}>
                      {pendingRole === 'editor'
                        ? 'Editor can modify the schedule and budget.'
                        : 'Member can only view the trip.'}
                    </Text>
                  </View>

                  {/* Save button */}
                  <TouchableOpacity
                    style={[s.modalSaveBtn, roleLoading && { opacity: 0.6 }]}
                    onPress={handleSaveRole}
                    disabled={roleLoading}
                    activeOpacity={0.85}
                  >
                    <Text style={s.modalSaveTxt}>{roleLoading ? 'Saving…' : 'Save Role'}</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Kick confirm modal ── */}
      <Modal visible={!!kickTarget} transparent animationType="fade" onRequestClose={() => setKickTarget(null)}>
        <Pressable style={s.kickOverlay} onPress={() => setKickTarget(null)}>
          <Pressable style={s.kickSheet} onPress={e => e.stopPropagation()}>
            {/* Icon */}
            <View style={s.kickIconWrap}>
              <Ionicons name="person-remove" size={28} color={BENI} />
            </View>

            <Text style={s.kickTitle}>Remove Member</Text>
            <Text style={s.kickDesc}>
              Remove <Text style={s.kickName}>{kickTarget?.name}</Text> from this trip?{'\n'}
              They will lose access to the group.
            </Text>

            <View style={s.kickActions}>
              <TouchableOpacity
                style={s.kickCancelBtn}
                onPress={() => setKickTarget(null)}
                activeOpacity={0.8}
              >
                <Text style={s.kickCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.kickConfirmBtn, kickLoading && { opacity: 0.6 }]}
                onPress={confirmKick}
                disabled={kickLoading}
                activeOpacity={0.85}
              >
                <Ionicons name="person-remove-outline" size={15} color={WHITE} />
                <Text style={s.kickConfirmTxt}>{kickLoading ? 'Removing…' : 'Remove'}</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

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
    backgroundColor: WHITE, borderRadius: 14,
    marginBottom: 8, paddingHorizontal: 12, paddingVertical: 10,
    borderWidth: 1, borderColor: INK_12,
    shadowColor: SUMI, shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2,
  },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    borderWidth: 1.5, alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: { fontSize: 14, fontFamily: 'ShipporiMincho_700Bold' },
  avatarImg: { width: 42, height: 42, borderRadius: 21 },
  memberInfo: { flex: 1, paddingRight: 8 },
  memberNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, flexWrap: 'wrap' },
  memberName: { fontSize: 13, fontFamily: 'NotoSansJP_700Bold', color: SUMI, flexShrink: 1 },
  meLabel: { fontFamily: 'NotoSansJP_400Regular', color: INK_30, fontSize: 11 },
  memberEmail: { fontSize: 10, fontFamily: 'NotoSansJP_400Regular', color: INK_30, marginTop: 1 },
  adminBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(184,150,62,0.1)', borderWidth: 0.8, borderColor: KINCHA,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
  },
  adminText: { fontSize: 9, fontFamily: 'NotoSansJP_700Bold', color: KINCHA_LIGHT },
  editorBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(184,150,62,0.07)', borderWidth: 0.8, borderColor: KINCHA,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
  },
  editorText: { fontSize: 9, fontFamily: 'NotoSansJP_700Bold', color: KINCHA },
  roleBadge: {
    backgroundColor: 'rgba(28,20,16,0.05)', borderWidth: 0.8, borderColor: INK_30,
    paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
  },
  roleBadgeText: { fontSize: 9, fontFamily: 'NotoSansJP_400Regular', color: INK_60 },
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

  // Kick button on card
  kickBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: 'rgba(192,57,43,0.07)', borderWidth: 1, borderColor: 'rgba(192,57,43,0.2)',
    alignItems: 'center', justifyContent: 'center', marginLeft: 4,
  },

  // ── Member role modal ────────────────────────────────────────────────────
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(28,20,16,0.5)', justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: WASHI, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 24, paddingBottom: 40, paddingTop: 12,
    alignItems: 'center',
    shadowColor: SUMI, shadowOpacity: 0.15, shadowRadius: 20, shadowOffset: { width: 0, height: -4 }, elevation: 12,
  },
  modalHandle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: INK_12, marginBottom: 24,
  },
  modalAvatar: {
    width: 72, height: 72, borderRadius: 36,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  modalAvatarImg: { width: 72, height: 72, borderRadius: 36 },
  modalAvatarText: { fontSize: 24, fontFamily: 'ShipporiMincho_700Bold' },
  modalName: {
    fontSize: 17, fontFamily: 'ShipporiMincho_700Bold', color: SUMI, marginBottom: 3,
  },
  modalEmail: {
    fontSize: 12, fontFamily: 'NotoSansJP_400Regular', color: INK_60, marginBottom: 20,
  },
  modalDivider: { width: '100%', height: 1, backgroundColor: INK_12, marginBottom: 20 },

  // Role section
  modalRoleSection: { width: '100%', marginBottom: 24 },
  modalRoleLabel: {
    fontSize: 10, fontFamily: 'NotoSansJP_700Bold', color: INK_30,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 12,
  },
  modalRoleRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },

  rolePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 12, borderRadius: 12,
    backgroundColor: WASHI_DARK, borderWidth: 1, borderColor: INK_12,
  },
  rolePillActive: { backgroundColor: SUMI, borderColor: SUMI },
  rolePillEditor: { borderColor: KINCHA },
  rolePillEditorActive: { backgroundColor: KINCHA, borderColor: KINCHA },
  rolePillText: { fontSize: 13, fontFamily: 'NotoSansJP_700Bold', color: INK_60 },
  rolePillTextActive: { color: WHITE },
  rolePillTextEditor: { color: KINCHA },
  rolePillTextEditorActive: { color: WHITE },

  roleHint: {
    fontSize: 11, fontFamily: 'NotoSansJP_400Regular', color: INK_60,
    textAlign: 'center', lineHeight: 17,
  },

  // Save button
  modalSaveBtn: {
    width: '100%', paddingVertical: 14, borderRadius: 99,
    backgroundColor: BENI, alignItems: 'center',
    shadowColor: BENI, shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  modalSaveTxt: { fontSize: 15, fontFamily: 'NotoSansJP_700Bold', color: WHITE, letterSpacing: 0.3 },

  // ── Kick confirm modal ───────────────────────────────────────────────────
  kickOverlay: {
    flex: 1, backgroundColor: 'rgba(28,20,16,0.55)',
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32,
  },
  kickSheet: {
    width: '100%', backgroundColor: WASHI, borderRadius: 20,
    paddingHorizontal: 24, paddingVertical: 28, alignItems: 'center',
    shadowColor: SUMI, shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 8 }, elevation: 16,
  },
  kickIconWrap: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: 'rgba(192,57,43,0.1)', borderWidth: 1.5, borderColor: 'rgba(192,57,43,0.2)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  kickTitle: {
    fontSize: 17, fontFamily: 'ShipporiMincho_700Bold', color: SUMI,
    marginBottom: 8, letterSpacing: 0.2,
  },
  kickDesc: {
    fontSize: 13, fontFamily: 'NotoSansJP_400Regular', color: INK_60,
    textAlign: 'center', lineHeight: 20, marginBottom: 24,
  },
  kickName: { fontFamily: 'NotoSansJP_700Bold', color: SUMI },
  kickActions: { flexDirection: 'row', gap: 10, width: '100%' },
  kickCancelBtn: {
    flex: 1, paddingVertical: 13, borderRadius: 99,
    borderWidth: 1.5, borderColor: INK_12, alignItems: 'center',
    backgroundColor: WASHI_DARK,
  },
  kickCancelTxt: { fontSize: 14, fontFamily: 'NotoSansJP_700Bold', color: INK_60 },
  kickConfirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 13, borderRadius: 99,
    backgroundColor: BENI,
    shadowColor: BENI, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  kickConfirmTxt: { fontSize: 14, fontFamily: 'NotoSansJP_700Bold', color: WHITE },
});