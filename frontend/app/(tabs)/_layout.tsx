import { Tabs, useRouter } from 'expo-router';
import React, { useState, useRef } from 'react';
import { Platform, StyleSheet, View, TouchableOpacity, Text, Animated, Image, Alert, TextInput, ActivityIndicator } from 'react-native';
import { HapticTab } from '@/components/HapticTab';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { API_URL } from '@/api.js';

// ─── Japanese Palette ─────────────────────────────────────────────────────────
const BENI         = '#C0392B';
const BENI_LIGHT   = '#E74C3C';
const KINCHA       = '#B8963E';
const KINCHA_LIGHT = '#D4AF55';
const SUMI         = '#1C1410';
const SUMI_90      = 'rgba(28,20,16,0.92)';
const WASHI        = '#FAF5EC';
const WASHI_DARK   = '#EDE5D8';
const WHITE        = '#FFFFFF';
const INK_40       = 'rgba(28,20,16,0.4)';

// ─── Tab icon config ──────────────────────────────────────────────────────────
type TabConfig = {
  icon: string;
  iconActive: string;
  label: string;
};

const TAB_CONFIG: Record<string, TabConfig> = {
  index:   { icon: 'home-outline',   iconActive: 'home',   label: 'Home'    },
  search:  { icon: 'search-outline', iconActive: 'search', label: 'Search'  },
  mytrip:  { icon: 'map-outline',    iconActive: 'map',    label: 'Trips'   },
  profile: { icon: 'person-outline', iconActive: 'person', label: 'Profile' },
};

// ─── Tab icon component ───────────────────────────────────────────────────────
const TabIcon = ({ name, focused }: { name: string; focused: boolean }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const dotAnim   = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: focused ? 1.12 : 1,
        useNativeDriver: true,
        friction: 6,
      }),
      Animated.timing(dotAnim, {
        toValue: focused ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();
  }, [focused]);

  return (
    <Animated.View style={[ti.wrap, { transform: [{ scale: scaleAnim }] }]}>
      {focused && <View style={ti.activePill} />}

      <Ionicons
        name={name as any}
        size={22}
        color={focused ? KINCHA_LIGHT : 'rgba(255,255,255,0.55)'}
      />

      <Animated.View style={[ti.dot, { opacity: dotAnim, transform: [{ scaleX: dotAnim }] }]} />
    </Animated.View>
  );
};

const ti = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 52,
    height: 36,
    position: 'relative',
  },
  activePill: {
    position: 'absolute',
    width: 44,
    height: 32,
    borderRadius: 10,
    backgroundColor: 'rgba(184,150,62,0.12)',
    borderWidth: 0.8,
    borderColor: 'rgba(184,150,62,0.3)',
  },
  dot: {
    position: 'absolute',
    bottom: -2,
    width: 16,
    height: 2,
    borderRadius: 1,
    backgroundColor: KINCHA_LIGHT,
  },
});

// ─── Custom tab bar background ─────────────────────────────────────────────────
const SumiTabBar = () => (
  <View style={tb.bar}>
    {/* Kincha top accent */}
    <View style={tb.topAccent} />
  </View>
);

const tb = StyleSheet.create({
  bar: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    backgroundColor: SUMI_90,
    borderTopWidth: 0,
  },
  topAccent: {
    height: 1,
    backgroundColor: KINCHA,
    opacity: 0.4,
  },
});

// ─── Custom header title ───────────────────────────────────────────────────────
const CustomHeaderTitle = () => (
  <View style={hd.row}>
    <Image
      source={require('../../assets/images/icon.png')}
      style={hd.logo}
      resizeMode="contain"
    />
    <Text style={hd.title}>TabiGo</Text>
  </View>
);

const hd = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: {
    width: 28, height: 28, borderRadius: 4,
    borderWidth: 1, borderColor: 'rgba(184,150,62,0.45)',
  },
  title: {
    fontSize: 16,
    fontFamily: 'ShipporiMincho_800ExtraBold',
    color: WHITE,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

// ─── FAB Add button ───────────────────────────────────────────────────────────
const FABIcon = ({ open }: { open: boolean }) => {
  const rotateAnim = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.spring(rotateAnim, {
      toValue: open ? 1 : 0,
      useNativeDriver: true,
      friction: 5,
    }).start();
  }, [open]);

  const rotate = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '45deg'],
  });

  return (
    <Animated.View style={[fab.btn, open && fab.btnOpen, { transform: [{ rotate }] }]}>
      <Ionicons name="add" size={26} color={WHITE} />
    </Animated.View>
  );
};

const fab = StyleSheet.create({
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: BENI,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: 'rgba(224,112,96,0.5)',
    shadowColor: BENI,
    shadowOpacity: 0.5,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
    marginBottom: 28,
  },
  btnOpen: {
    backgroundColor: SUMI,
    borderColor: KINCHA,
  },
});

// ─── Action menu (Create / Join) ──────────────────────────────────────────────
const ActionMenu = ({
  onCreate,
  onJoin,
}: {
  onCreate: () => void;
  onJoin: () => void;
}) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(16)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <Animated.View style={[am.wrap, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}>
       <TouchableOpacity style={am.btnPrimary} onPress={onCreate} activeOpacity={0.8}>
        <Ionicons name="add-circle-outline" size={16} color={WHITE} />
        <Text style={am.btnPrimaryText}>Create Trip</Text>
      </TouchableOpacity>

      <TouchableOpacity style={am.btnSecondary} onPress={onJoin} activeOpacity={0.8}>
        <Ionicons name="people-outline" size={16} color={KINCHA_LIGHT} />
        <Text style={am.btnSecondaryText}>Join Trip</Text>
      </TouchableOpacity>

     
    </Animated.View>
  );
};

const am = StyleSheet.create({
  wrap: {
    position: 'absolute',
    bottom: 80,
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 10,
    zIndex: 20,
  },
  btnPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: BENI,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    shadowColor: BENI,
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  btnPrimaryText: {
    color: WHITE,
    fontFamily: 'NotoSansJP_700Bold',
    fontSize: 13,
    letterSpacing: 0.2,
  },
  btnSecondary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: SUMI,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: KINCHA,
    shadowColor: SUMI,
    shadowOpacity: 0.3,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  btnSecondaryText: {
    color: KINCHA_LIGHT,
    fontFamily: 'NotoSansJP_700Bold',
    fontSize: 13,
    letterSpacing: 0.2,
  },
});

// ─── Join Trip Modal ──────────────────────────────────────────────────────────
const JoinModal = ({ onClose }: { onClose: () => void }) => {
  const router = useRouter();
  const [code, setCode]               = useState('');
  const [loading, setLoading]         = useState(false);
  const [step, setStep]               = useState<'input' | 'preview'>('input');
  const [tripDetails, setTripDetails] = useState<any>(null);
  const [errorMsg, setErrorMsg]       = useState('');

  const fetchTrip = async () => {
    if (!code || loading) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const token = await AsyncStorage.getItem('access_token');
      const res   = await axios.get(`${API_URL}/trip_group/code/${code}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setTripDetails(res.data);
      setStep('preview');
    } catch {
      setErrorMsg('Trip not found. Check your invite code.');
    } finally {
      setLoading(false);
    }
  };

  const confirmJoin = async () => {
    if (loading) return;
    setLoading(true);
    setErrorMsg('');
    try {
      const token = await AsyncStorage.getItem('access_token');
      await axios.post(
        `${API_URL}/trip_group/join`,
        { unique_code: code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      onClose();
      router.replace('/(tabs)/mytrip');
    } catch {
      setErrorMsg('Could not join trip. Please try again.');
      setLoading(false);
    }
  };

  return (
    <View style={jm.overlay}>
        <View style={jm.card}>
          <View style={jm.topBar} />
          <View style={jm.header}>
            <View style={jm.headerLeft}>
              <View style={jm.headerBar} />
              <Text style={jm.title}>{step === 'input' ? 'Join a Trip' : 'Trip Preview'}</Text>
            </View>
            <TouchableOpacity style={jm.closeBtn} onPress={onClose}>
              <Ionicons name="close" size={18} color={WASHI} />
            </TouchableOpacity>
          </View>

          <View style={jm.divider}>
            <View style={jm.dividerLine} />
            <Text style={jm.dividerDot}>✦</Text>
            <View style={jm.dividerLine} />
          </View>

          {step === 'input' ? (
            <View style={jm.content}>
              <Text style={jm.label}>INVITE CODE</Text>
              <TextInput
                style={jm.input}
                placeholder="e.g. A1B2C3"
                placeholderTextColor={INK_40}
                value={code}
                onChangeText={t => { setCode(t.toUpperCase()); setErrorMsg(''); }}
                autoCapitalize="characters"
                maxLength={8}
                selectionColor={BENI}
              />
              {errorMsg ? <Text style={jm.error}>{errorMsg}</Text> : null}
              <TouchableOpacity
                style={[jm.btn, (!code || loading) && jm.btnDisabled]}
                onPress={fetchTrip}
                disabled={!code || loading}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={WASHI} size="small" />
                  : <><Ionicons name="search-outline" size={15} color={WASHI} /><Text style={jm.btnText}>Search Trip</Text></>
                }
              </TouchableOpacity>
            </View>
          ) : (
            <View style={jm.content}>
              <View style={jm.previewBox}>
                <View style={jm.planeRing}>
                  <Ionicons name="airplane" size={28} color={BENI} />
                </View>
                <Text style={jm.tripName}>{tripDetails?.name_group}</Text>
                <Text style={jm.ownerText}>by {tripDetails?.owner_name}</Text>
                <View style={jm.infoRow}>
                  <View style={jm.infoItem}>
                    <View style={jm.infoIcon}><Ionicons name="people-outline" size={13} color={BENI} /></View>
                    <View>
                      <Text style={jm.infoLabel}>Members</Text>
                      <Text style={jm.infoValue}>{tripDetails?.member_count} people</Text>
                    </View>
                  </View>
                  <View style={jm.infoItem}>
                    <View style={jm.infoIcon}><Ionicons name="calendar-outline" size={13} color={BENI} /></View>
                    <View>
                      <Text style={jm.infoLabel}>Dates</Text>
                      <Text style={jm.infoValue}>
                        {new Date(tripDetails?.start_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                        {' – '}
                        {new Date(tripDetails?.end_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                      </Text>
                    </View>
                  </View>
                </View>
                {tripDetails?.is_member && (
                  <View style={jm.alreadyBadge}>
                    <Ionicons name="checkmark-circle" size={14} color={KINCHA_LIGHT} />
                    <Text style={jm.alreadyText}>Already a member</Text>
                  </View>
                )}
                {new Date(tripDetails?.end_date) < new Date() && (
                  <View style={jm.endedBadge}>
                    <Ionicons name="time-outline" size={14} color={BENI} />
                    <Text style={jm.endedText}>Trip has ended</Text>
                  </View>
                )}
              </View>
              {errorMsg ? <Text style={jm.error}>{errorMsg}</Text> : null}
              <TouchableOpacity
                style={[jm.btn, (loading || tripDetails?.is_member || new Date(tripDetails?.end_date) < new Date()) && jm.btnDisabled]}
                onPress={confirmJoin}
                disabled={loading || tripDetails?.is_member || new Date(tripDetails?.end_date) < new Date()}
                activeOpacity={0.8}
              >
                {loading
                  ? <ActivityIndicator color={WASHI} size="small" />
                  : <><Ionicons name="people" size={15} color={WASHI} /><Text style={jm.btnText}>{tripDetails?.is_member ? 'Already Joined' : new Date(tripDetails?.end_date) < new Date() ? 'Trip Ended' : 'Confirm Join'}</Text></>
                }
              </TouchableOpacity>
              <TouchableOpacity style={jm.backBtn} onPress={() => { setStep('input'); setErrorMsg(''); }}>
                <Text style={jm.backText}>Search another code</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      
    </View>
  );
};

const jm = StyleSheet.create({
  overlay:      { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(28,20,16,0.65)', justifyContent: 'center', alignItems: 'center', padding: 24, zIndex: 999, elevation: 999 },
  card:         { width: '92%', maxWidth: 400, backgroundColor: WASHI, borderRadius: 10, overflow: 'hidden', borderWidth: 1, borderColor: WASHI_DARK, shadowColor: SUMI, shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 10 },
  topBar:       { height: 3, backgroundColor: BENI },
  header:       { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 18, paddingTop: 14, paddingBottom: 10 },
  headerLeft:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerBar:    { width: 3, height: 18, backgroundColor: BENI, borderRadius: 2 },
  title:        { fontSize: 17, fontFamily: 'ShipporiMincho_700Bold', color: SUMI, letterSpacing: 0.3 },
  closeBtn:     { width: 30, height: 30, borderRadius: 15, backgroundColor: SUMI, alignItems: 'center', justifyContent: 'center' },
  divider:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, marginBottom: 4 },
  dividerLine:  { flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.35 },
  dividerDot:   { fontSize: 7, color: KINCHA, marginHorizontal: 6, opacity: 0.5 },
  content:      { padding: 18, paddingTop: 10 },
  label:        { fontSize: 10, fontFamily: 'NotoSansJP_700Bold', color: INK_40, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  input:        { backgroundColor: WASHI_DARK, borderWidth: 1.2, borderColor: WASHI_DARK, borderRadius: 6, paddingHorizontal: 14, paddingVertical: 13, fontSize: 20, fontFamily: 'NotoSansJP_700Bold', textAlign: 'center', color: SUMI, marginBottom: 16, letterSpacing: 3 },
  error:        { fontSize: 12, color: BENI, fontFamily: 'NotoSansJP_400Regular', marginBottom: 12, textAlign: 'center' },
  btn:          { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: BENI, paddingVertical: 13, borderRadius: 24, shadowColor: BENI, shadowOpacity: 0.35, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4 },
  btnDisabled:  { backgroundColor: WASHI_DARK, shadowOpacity: 0, elevation: 0 },
  btnText:      { color: WASHI, fontFamily: 'NotoSansJP_700Bold', fontSize: 14, letterSpacing: 0.3 },
  backBtn:      { marginTop: 12, alignItems: 'center', paddingVertical: 8 },
  backText:     { fontSize: 12, color: INK_40, fontFamily: 'NotoSansJP_400Regular' },
  previewBox:   { backgroundColor: WASHI_DARK, borderRadius: 8, padding: 16, alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: WASHI_DARK },
  planeRing:    { width: 60, height: 60, borderRadius: 30, borderWidth: 1.5, borderColor: BENI, backgroundColor: 'rgba(192,57,43,0.06)', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  tripName:     { fontSize: 18, fontFamily: 'ShipporiMincho_700Bold', color: SUMI, textAlign: 'center', marginBottom: 4 },
  ownerText:    { fontSize: 12, color: INK_40, fontFamily: 'NotoSansJP_400Regular', marginBottom: 14 },
  infoRow:      { flexDirection: 'row', gap: 20, marginTop: 4 },
  infoItem:     { flexDirection: 'row', alignItems: 'center', gap: 8 },
  infoIcon:     { width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(192,57,43,0.07)', alignItems: 'center', justifyContent: 'center' },
  infoLabel:    { fontSize: 10, color: INK_40, fontFamily: 'NotoSansJP_400Regular', letterSpacing: 0.3 },
  infoValue:    { fontSize: 13, color: SUMI, fontFamily: 'NotoSansJP_700Bold' },
  alreadyBadge: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, backgroundColor: 'rgba(184,150,62,0.1)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, borderWidth: 0.8, borderColor: KINCHA },
  alreadyText:  { fontSize: 11, color: KINCHA_LIGHT, fontFamily: 'NotoSansJP_700Bold' },
  endedBadge:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 12, backgroundColor: 'rgba(192,57,43,0.08)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 4, borderWidth: 0.8, borderColor: BENI },
  endedText:    { fontSize: 11, color: BENI, fontFamily: 'NotoSansJP_700Bold' },
});

// ─── Root layout ───────────────────────────────────────────────────────────────
export default function TabLayout() {
  const router = useRouter();
  const [open, setOpen]               = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const requireLogin = async (onSuccess: () => void) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (token) {
        onSuccess();
      } else {
        setOpen(false);
        Alert.alert(
          'Sign In Required',
          'Please log in to use this feature.',
          [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Log In', onPress: () => router.push('/Login') },
          ]
        );
      }
    } catch (e) {
      console.error('Auth check error:', e);
    }
  };

  const cfg = TAB_CONFIG;

  return (
    <>
      <Tabs
          screenOptions={{
            headerShown: false,
            tabBarActiveTintColor: KINCHA_LIGHT,
            tabBarInactiveTintColor: INK_40,
            tabBarButton: HapticTab,
            tabBarBackground: () => <SumiTabBar />,
            tabBarLabelStyle: {
              fontFamily: 'NotoSansJP_500Medium',
              fontSize: 10,
              letterSpacing: 0.3,
            },
            tabBarStyle: Platform.select({
              ios: {
                position: 'absolute',
                height: 80,
                paddingBottom: 22,
                backgroundColor: 'transparent',
                borderTopWidth: 0,
              },
              default: {
                height: 68,
                paddingTop: 6,
                backgroundColor: SUMI,
                borderTopWidth: 0,
                elevation: 12,
              },
            }),
          }}
        >
          {/* Home */}
          <Tabs.Screen
            name="index"
            options={{
              title: cfg.index.label,
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  name={focused ? cfg.index.iconActive : cfg.index.icon}
                  focused={focused}
                  
                />
              ),
            }}
            listeners={{ tabPress: () => setOpen(false) }}
          />

          {/* Search */}
          <Tabs.Screen
            name="search"
            options={{
              title: cfg.search.label,
              headerShown: true,
              headerTitle: () => <CustomHeaderTitle />,
              headerStyle: { backgroundColor: SUMI },
              headerTintColor: WHITE,
              headerShadowVisible: false,
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  name={focused ? cfg.search.iconActive : cfg.search.icon}
                  focused={focused}
                  
                />
              ),
            }}
            listeners={{ tabPress: () => setOpen(false) }}
          />

          {/* FAB — Create (center) */}
          <Tabs.Screen
            name="add_place"
            options={{
              title: '',
              tabBarIcon: () => <FABIcon open={open} />,
              tabBarLabel: () => null,
            }}
            listeners={{
              tabPress: (e) => {
                e.preventDefault();
                setOpen(prev => !prev);
              },
            }}
          />

          {/* My Trips */}
          <Tabs.Screen
            name="mytrip"
            options={{
              title: cfg.mytrip.label,
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  name={focused ? cfg.mytrip.iconActive : cfg.mytrip.icon}
                  focused={focused}
                  
                />
              ),
            }}
            listeners={{ tabPress: () => setOpen(false) }}
          />

          {/* Profile */}
          <Tabs.Screen
            name="profile"
            options={{
              title: cfg.profile.label,
              tabBarIcon: ({ focused }) => (
                <TabIcon
                  name={focused ? cfg.profile.iconActive : cfg.profile.icon}
                  focused={focused}
                  
                />
              ),
            }}
            listeners={{ tabPress: () => setOpen(false) }}
          />

          {/* Hidden test screen */}
          <Tabs.Screen
            name="test"
            options={{ href: null, headerShown: false }}
          />
        </Tabs>

        {/* Action menu overlay */}
        {open && (
          <ActionMenu
            onCreate={() => requireLogin(() => { setOpen(false); router.push('/trip/after-create'); })}
            onJoin={() => requireLogin(() => { setShowJoinModal(true); setTimeout(() => setOpen(false), 50); })}
          />
        )}

        {showJoinModal && (
          <JoinModal onClose={() => setShowJoinModal(false)} />
        )}
    </>
  );
}