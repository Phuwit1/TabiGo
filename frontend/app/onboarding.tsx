import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity,
  Animated, Dimensions, ScrollView, StatusBar, Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W } = Dimensions.get('window');

// ─── Palette ──────────────────────────────────────────────────────────────────
const BENI         = '#C0392B';
const KINCHA       = '#B8963E';
const KINCHA_LIGHT = '#D4AF55';
const SUMI         = '#1C1410';
const SUMI_2       = '#251810';
const WASHI        = '#FAF5EC';
const WASHI_DARK   = '#EDE5D8';
const WHITE        = '#FFFFFF';
const INK_50       = 'rgba(28,20,16,0.5)';
const INK_20       = 'rgba(28,20,16,0.2)';
const INK_10       = 'rgba(28,20,16,0.10)';

// ─── Data ─────────────────────────────────────────────────────────────────────
type StepType = 'welcome' | 'single' | 'multi' | 'done';
interface Option { label: string; icon: string; value: string }
interface Step   { id: string; type: StepType; title: string; subtitle: string; options?: Option[] }

const STEPS: Step[] = [
  {
    id: 'welcome', type: 'welcome',
    title: 'TabiGo',
    subtitle: 'Plan your perfect Japan journey\nwith the power of AI',
  },
  {
    id: 'travel_style', type: 'single',
    title: "What's your travel style?",
    subtitle: "We'll tailor your itinerary to match",
    options: [
      { label: 'Relax & Slow',    icon: 'leaf-outline',          value: 'relax'      },
      { label: 'Culture & Art',   icon: 'color-palette-outline', value: 'culture'    },
      { label: 'Food Explorer',   icon: 'restaurant-outline',    value: 'food'       },
      { label: 'Adventure',       icon: 'bicycle-outline',       value: 'adventure'  },
      { label: 'City Hopping',    icon: 'train-outline',         value: 'city'       },
      { label: 'Nature & Hiking', icon: 'partly-sunny-outline',  value: 'nature'     },
    ],
  },
  {
    id: 'interests', type: 'multi',
    title: 'What are you interested in?',
    subtitle: 'Pick all that apply',
    options: [
      { label: 'Temples & Shrines', icon: 'business-outline',        value: 'temples'     },
      { label: 'Anime & Manga',     icon: 'game-controller-outline', value: 'anime'       },
      { label: 'Street Food',       icon: 'fast-food-outline',       value: 'street_food' },
      { label: 'Shopping',          icon: 'bag-handle-outline',      value: 'shopping'    },
      { label: 'Hot Springs',       icon: 'water-outline',           value: 'onsen'       },
      { label: 'Cherry Blossoms',   icon: 'flower-outline',          value: 'sakura'      },
      { label: 'Night Life',        icon: 'moon-outline',            value: 'night'       },
      { label: 'Photography',       icon: 'camera-outline',          value: 'photo'       },
    ],
  },
  {
    id: 'trip_length', type: 'single',
    title: 'How long do you usually travel?',
    subtitle: 'This helps us build the right pace',
    options: [
      { label: '1–3 Days',  icon: 'flash-outline',    value: 'short'   },
      { label: '4–7 Days',  icon: 'calendar-outline', value: 'week'    },
      { label: '1–2 Weeks', icon: 'airplane-outline', value: 'twoweek' },
      { label: '1 Month+',  icon: 'globe-outline',    value: 'long'    },
    ],
  },
  {
    id: 'travel_with', type: 'single',
    title: 'Who do you travel with?',
    subtitle: "We'll suggest the best experiences",
    options: [
      { label: 'Solo',    icon: 'person-outline', value: 'solo'    },
      { label: 'Partner', icon: 'heart-outline',  value: 'couple'  },
      { label: 'Friends', icon: 'people-outline', value: 'friends' },
      { label: 'Family',  icon: 'home-outline',   value: 'family'  },
    ],
  },
  {
    id: 'done', type: 'done',
    title: "You're all set!",
    subtitle: 'Your perfect Japan journey awaits',
  },
];

const Q_STEPS = STEPS.filter(s => s.type !== 'welcome' && s.type !== 'done');

// ─── Main component ───────────────────────────────────────────────────────────
export default function OnboardingScreen() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers,   setAnswers]   = useState<Record<string, string | string[]>>({});

  // Single animation refs — no early returns so these always apply to same tree
  const fadeAnim  = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;  // translateX

  const directionRef = useRef<1 | -1>(1); // 1 = forward, -1 = back

  const currentStep = STEPS[stepIndex];
  const isWelcome   = currentStep.type === 'welcome';
  const isDone      = currentStep.type === 'done';
  const isQuestion  = !isWelcome && !isDone;

  // ── Transition ──────────────────────────────────────────────────────────────
  const transition = useCallback((cb: () => void, dir: 1 | -1 = 1) => {
    directionRef.current = dir;
    const OUT = -40 * dir;
    const IN  =  40 * dir;
    Animated.parallel([
      Animated.timing(fadeAnim,  { toValue: 0,   duration: 160, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: OUT,  duration: 160, useNativeDriver: true }),
    ]).start(() => {
      cb();
      slideAnim.setValue(IN);
      Animated.parallel([
        Animated.timing(fadeAnim,  { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start();
    });
  }, [fadeAnim, slideAnim]);

  const goNext = () => { if (stepIndex < STEPS.length - 1) transition(() => setStepIndex(i => i + 1),  1); };
  const goBack = () => { if (stepIndex > 0)                transition(() => setStepIndex(i => i - 1), -1); };

  // ── Select ──────────────────────────────────────────────────────────────────
  const handleSelect = (value: string) => {
    if (currentStep.type === 'multi') {
      setAnswers(prev => {
        const cur = (prev[currentStep.id] as string[]) ?? [];
        return {
          ...prev,
          [currentStep.id]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value],
        };
      });
    } else {
      setAnswers(prev => ({ ...prev, [currentStep.id]: value }));
    }
  };

  const isSelected = (value: string) => {
    const ans = answers[currentStep.id];
    if (!ans) return false;
    return Array.isArray(ans) ? ans.includes(value) : ans === value;
  };

  const canProceed = () => {
    if (!isQuestion) return true;
    const ans = answers[currentStep.id];
    if (!ans) return false;
    return Array.isArray(ans) ? ans.length > 0 : !!ans;
  };

  const handleFinish = async () => {
    await AsyncStorage.setItem('onboarding_done', 'true');
    await AsyncStorage.setItem('onboarding_answers', JSON.stringify(answers));
    router.replace('/(tabs)');
  };

  const qIdx    = isQuestion ? Q_STEPS.findIndex(s => s.id === currentStep.id) : 0;
  const qTotal  = Q_STEPS.length;
  const isMulti = currentStep.type === 'multi';
  const selCount = isMulti ? ((answers[currentStep.id] as string[]) ?? []).length : 0;

  // ─── Single JSX tree — no early returns ────────────────────────────────────
  return (
    <View style={s.root}>
      <StatusBar barStyle="light-content" backgroundColor={SUMI} />

      {/* ── DARK TOP BAND (always visible) ── */}
      <View style={[s.topBand, isWelcome || isDone ? s.topBandFull : s.topBandNav]}>

        {/* BENI stripe */}
        <View style={s.stripe} />

        {isWelcome || isDone ? null : (
          /* Question nav bar */
          <View style={s.navRow}>
            <TouchableOpacity style={s.backBtn} onPress={goBack} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={18} color={WASHI} />
            </TouchableOpacity>

            {/* Segmented progress */}
            <View style={s.segRow}>
              {Q_STEPS.map((_, i) => (
                <View key={i} style={[
                  s.seg,
                  i < qIdx  && s.segDone,
                  i === qIdx && s.segActive,
                ]} />
              ))}
            </View>

            <View style={s.stepLabel}>
              <Text style={s.stepLabelText}>{qIdx + 1}/{qTotal}</Text>
            </View>
          </View>
        )}
      </View>

      {/* ── ANIMATED CONTENT ── */}
      <Animated.View style={[s.content, { opacity: fadeAnim, transform: [{ translateX: slideAnim }] }]}>

        {/* ════ WELCOME ════ */}
        {isWelcome && (
          <View style={s.heroWrap}>
            {/* Logo area */}
            <View style={s.logoArea}>
              <View style={s.logoRingOuter}>
                <View style={s.logoRingInner}>
                  <Image
                    source={require('../assets/images/icon.png')}
                    style={s.logoImg}
                    resizeMode="contain"
                  />
                </View>
              </View>
              {/* Glow lines */}
              <View style={[s.glowLine, { top: '50%', left: -32 }]} />
              <View style={[s.glowLine, { top: '50%', right: -32 }]} />
            </View>

            <Text style={s.heroTitle}>TabiGo</Text>

            <View style={s.rulRow}>
              <View style={s.rulLine} /><Text style={s.rulDot}>✦</Text><View style={s.rulLine} />
            </View>

            <Text style={s.heroSub}>{currentStep.subtitle}</Text>

            {/* City tags */}
            <View style={s.tagRow}>
              {['Tokyo', 'Kyoto', 'Osaka', 'Nara', 'Hakone'].map(c => (
                <View key={c} style={s.tag}>
                  <Text style={s.tagText}>{c}</Text>
                </View>
              ))}
            </View>

            {/* Feature pills */}
            <View style={s.pillRow}>
              {([
                ['sparkles',      'AI Planner'],
                ['map-outline',   'Smart Routes'],
                ['people-outline','Group Trips'],
              ] as const).map(([icon, label]) => (
                <View key={label} style={s.pill}>
                  <Ionicons name={icon as any} size={12} color={KINCHA_LIGHT} />
                  <Text style={s.pillText}>{label}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* ════ QUESTION ════ */}
        {isQuestion && (
          <View style={s.questionWrap}>
            {/* Title card */}
            <View style={s.titleCard}>
              <View style={s.titleAccent} />
              <View style={{ flex: 1 }}>
                <Text style={s.qLabel}>QUESTION {qIdx + 1}</Text>
                <Text style={s.qTitle}>{currentStep.title}</Text>
                <Text style={s.qSub}>{currentStep.subtitle}</Text>
              </View>
              {isMulti && selCount > 0 && (
                <View style={s.badge}>
                  <Text style={s.badgeText}>{selCount}</Text>
                </View>
              )}
            </View>

            {/* Options */}
            <ScrollView
              style={s.optScroll}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={[s.optGrid, isMulti && s.optGridCompact]}
            >
              {currentStep.options?.map(opt => {
                const sel = isSelected(opt.value);
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[
                      s.optCard,
                      isMulti ? s.optChip : s.optFull,
                      sel && s.optSel,
                    ]}
                    onPress={() => handleSelect(opt.value)}
                    activeOpacity={0.72}
                  >
                    {/* Check dot */}
                    {!isMulti && sel && (
                      <View style={s.checkDot}>
                        <Ionicons name="checkmark" size={10} color={WHITE} />
                      </View>
                    )}
                    {/* Icon */}
                    <View style={[s.optIcon, sel && s.optIconSel]}>
                      <Ionicons name={opt.icon as any} size={isMulti ? 16 : 20} color={sel ? WASHI : BENI} />
                    </View>
                    {/* Label */}
                    <Text style={[s.optLabel, isMulti && s.optLabelChip, sel && s.optLabelSel]}>
                      {opt.label}
                    </Text>
                    {/* Multi checkbox */}
                    {isMulti && (
                      <View style={[s.checkbox, sel && s.checkboxSel]}>
                        {sel && <Ionicons name="checkmark" size={9} color={WHITE} />}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* ════ DONE ════ */}
        {isDone && (
          <View style={s.heroWrap}>
            <View style={s.doneRing}>
              <View style={s.doneCenter}>
                <Ionicons name="checkmark" size={40} color={KINCHA_LIGHT} />
              </View>
            </View>
            <Text style={s.heroTitle}>{currentStep.title}</Text>
            <View style={s.rulRow}>
              <View style={s.rulLine} /><Text style={s.rulDot}>✦</Text><View style={s.rulLine} />
            </View>
            <Text style={s.heroSub}>{currentStep.subtitle}</Text>

            <View style={s.summaryCard}>
              <View style={s.summaryHead}>
                <View style={s.summaryAccent} />
                <Text style={s.summaryHeadText}>Your Preferences</Text>
              </View>
              {Object.entries(answers).map(([key, val]) => {
                const step = STEPS.find(st => st.id === key);
                if (!step) return null;
                const values = Array.isArray(val) ? val : [val];
                const labels = values.map(v => step.options?.find(o => o.value === v)?.label ?? v);
                return (
                  <View key={key} style={s.summaryRow}>
                    <View style={s.summaryDot} />
                    <Text style={s.summaryText} numberOfLines={1}>{labels.join(' · ')}</Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </Animated.View>

      {/* ── FOOTER ── */}
      <View style={[s.footer, (isWelcome || isDone) && s.footerDark]}>
        {isWelcome && (
          <>
            <TouchableOpacity style={s.primaryBtn} onPress={goNext} activeOpacity={0.85}>
              <Text style={s.primaryBtnText}>Get Started</Text>
              <View style={s.primaryArrow}>
                <Ionicons name="arrow-forward" size={14} color={SUMI} />
              </View>
            </TouchableOpacity>
            <TouchableOpacity style={s.ghostBtn} onPress={handleFinish} activeOpacity={0.6}>
              <Text style={s.ghostBtnText}>Skip for now</Text>
            </TouchableOpacity>
          </>
        )}
        {isQuestion && (
          <TouchableOpacity
            style={[s.nextBtn, !canProceed() && s.nextBtnOff]}
            onPress={stepIndex === STEPS.length - 2 ? () => transition(handleFinish) : goNext}
            disabled={!canProceed()}
            activeOpacity={0.85}
          >
            <Text style={[s.nextBtnText, !canProceed() && s.nextBtnTextOff]}>
              {stepIndex === STEPS.length - 2 ? 'Finish' : 'Continue'}
            </Text>
            {canProceed() && <Ionicons name="arrow-forward" size={15} color={WASHI} />}
          </TouchableOpacity>
        )}
        {isDone && (
          <TouchableOpacity style={s.primaryBtn} onPress={handleFinish} activeOpacity={0.85}>
            <Text style={s.primaryBtnText}>Start Exploring</Text>
            <View style={s.primaryArrow}>
              <Ionicons name="arrow-forward" size={14} color={SUMI} />
            </View>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: SUMI },

  // ── Top band ──
  stripe: { height: 3, backgroundColor: BENI },
  topBand: { backgroundColor: SUMI },
  topBandFull: {},   // welcome/done: just stripe
  topBandNav:  {},   // question: stripe + nav

  navRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10, gap: 12,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(250,245,236,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  segRow: { flex: 1, flexDirection: 'row', gap: 5 },
  seg: {
    flex: 1, height: 3, borderRadius: 99,
    backgroundColor: 'rgba(250,245,236,0.12)',
  },
  segActive: { backgroundColor: BENI },
  segDone:   { backgroundColor: 'rgba(184,150,62,0.55)' },

  stepLabel: {
    minWidth: 32, alignItems: 'flex-end',
  },
  stepLabelText: {
    fontSize: 11, color: 'rgba(250,245,236,0.4)',
    fontFamily: 'NotoSansJP_500Medium',
  },

  // ── Animated content ──
  content: { flex: 1 },

  // ════ Welcome / Done ════
  heroWrap: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 28,
  },

  logoArea: {
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 28, position: 'relative',
  },
  logoRingOuter: {
    width: 114, height: 114, borderRadius: 57,
    borderWidth: 1, borderColor: 'rgba(184,150,62,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  logoRingInner: {
    width: 86, height: 86, borderRadius: 43,
    borderWidth: 1.5, borderColor: 'rgba(192,57,43,0.45)',
    backgroundColor: 'rgba(192,57,43,0.1)',
    alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  logoImg: { width: 58, height: 58, borderRadius: 8 },
  glowLine: {
    position: 'absolute', width: 28, height: 1,
    backgroundColor: 'rgba(184,150,62,0.3)',
  },

  heroTitle: {
    fontSize: 34, color: WASHI,
    fontFamily: 'ShipporiMincho_800ExtraBold',
    letterSpacing: 2.5,
  },
  rulRow: {
    flexDirection: 'row', alignItems: 'center',
    marginVertical: 12, width: 180,
  },
  rulLine: { flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.35 },
  rulDot:  { fontSize: 8, color: KINCHA_LIGHT, marginHorizontal: 8, opacity: 0.8 },

  heroSub: {
    fontSize: 13, color: 'rgba(250,245,236,0.5)',
    fontFamily: 'NotoSansJP_400Regular',
    textAlign: 'center', lineHeight: 22,
  },

  tagRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: 7,
    marginTop: 22, justifyContent: 'center',
  },
  tag: {
    borderWidth: 1, borderColor: 'rgba(184,150,62,0.28)',
    paddingHorizontal: 11, paddingVertical: 4, borderRadius: 99,
    backgroundColor: 'rgba(184,150,62,0.07)',
  },
  tagText: {
    fontSize: 11, color: 'rgba(250,245,236,0.42)',
    fontFamily: 'NotoSansJP_500Medium', letterSpacing: 0.3,
  },

  pillRow: { flexDirection: 'row', gap: 8, marginTop: 20 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderColor: 'rgba(184,150,62,0.22)',
    paddingHorizontal: 11, paddingVertical: 5, borderRadius: 99,
    backgroundColor: 'rgba(184,150,62,0.08)',
  },
  pillText: {
    fontSize: 10, color: 'rgba(212,175,85,0.75)',
    fontFamily: 'NotoSansJP_500Medium',
  },

  // Done
  doneRing: {
    width: 106, height: 106, borderRadius: 53,
    borderWidth: 1, borderColor: 'rgba(184,150,62,0.25)',
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 24,
  },
  doneCenter: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: 'rgba(184,150,62,0.1)',
    borderWidth: 1.5, borderColor: KINCHA,
    alignItems: 'center', justifyContent: 'center',
  },
  summaryCard: {
    marginTop: 22, width: '100%',
    borderWidth: 1, borderColor: 'rgba(184,150,62,0.18)',
    borderRadius: 12, padding: 16, gap: 10,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  summaryHead: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  summaryAccent: { width: 3, height: 14, backgroundColor: BENI, borderRadius: 99 },
  summaryHeadText: {
    fontSize: 11, color: 'rgba(250,245,236,0.45)',
    fontFamily: 'NotoSansJP_500Medium', letterSpacing: 0.4,
  },
  summaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  summaryDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: KINCHA },
  summaryText: {
    flex: 1, fontSize: 12, color: 'rgba(250,245,236,0.5)',
    fontFamily: 'NotoSansJP_400Regular',
  },

  // ════ Question ════
  questionWrap: { flex: 1, backgroundColor: WASHI },

  titleCard: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 20, paddingVertical: 18,
    borderBottomWidth: 1, borderBottomColor: INK_10,
    gap: 12,
  },
  titleAccent: { width: 3, height: 62, backgroundColor: BENI, borderRadius: 99, marginTop: 2 },
  qLabel: {
    fontSize: 9, color: BENI,
    fontFamily: 'NotoSansJP_500Medium',
    letterSpacing: 1.5, marginBottom: 3,
  },
  qTitle: {
    fontSize: 19, color: SUMI,
    fontFamily: 'ShipporiMincho_700Bold', lineHeight: 27,
  },
  qSub: {
    fontSize: 11, color: INK_50,
    fontFamily: 'NotoSansJP_400Regular', marginTop: 2,
  },
  badge: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: BENI, alignItems: 'center', justifyContent: 'center',
    shadowColor: BENI, shadowOpacity: 0.4, shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 }, elevation: 4,
    marginTop: 4,
  },
  badgeText: {
    fontSize: 13, color: WHITE, fontFamily: 'NotoSansJP_700Bold',
    lineHeight: 28, textAlign: 'center', includeFontPadding: false,
  },

  optScroll: { flex: 1 },
  optGrid: {
    padding: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 10,
  },
  optGridCompact: { gap: 8 },

  optCard: {
    alignItems: 'center', position: 'relative', overflow: 'hidden',
    backgroundColor: WHITE,
    borderRadius: 14, borderWidth: 1.2, borderColor: INK_10,
    shadowColor: SUMI, shadowOpacity: 0.03, shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 }, elevation: 1,
  },
  optFull: {
    width: (W - 42) / 2,
    padding: 18, gap: 10,
  },
  optChip: {
    width: (W - 44) / 2,
    flexDirection: 'row',
    paddingHorizontal: 13, paddingVertical: 11,
    gap: 8, borderRadius: 10,
  },
  optSel: {
    backgroundColor: SUMI_2,
    borderColor: BENI, borderWidth: 1.5,
    shadowColor: BENI, shadowOpacity: 0.15, shadowRadius: 8, elevation: 3,
  },

  checkDot: {
    position: 'absolute', top: 7, left: 7,
    width: 18, height: 18, borderRadius: 9,
    backgroundColor: BENI, alignItems: 'center', justifyContent: 'center',
    zIndex: 2,
  },

  optIcon: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: 'rgba(192,57,43,0.07)',
    borderWidth: 1, borderColor: 'rgba(192,57,43,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  optIconSel: {
    backgroundColor: 'rgba(192,57,43,0.15)', borderColor: BENI,
  },

  optLabel: {
    fontSize: 12, color: SUMI, textAlign: 'center',
    fontFamily: 'NotoSansJP_500Medium',
  },
  optLabelChip: { flex: 1, textAlign: 'left' },
  optLabelSel: { color: WASHI },

  checkbox: {
    width: 18, height: 18, borderRadius: 9,
    borderWidth: 1.5, borderColor: INK_20,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: WHITE,
  },
  checkboxSel: { backgroundColor: BENI, borderColor: BENI },

  // ── Footer ──
  footer: {
    paddingHorizontal: 20, paddingBottom: 32, paddingTop: 12,
    backgroundColor: WASHI,
    borderTopWidth: 1, borderTopColor: INK_10,
    gap: 10,
  },
  footerDark: {
    backgroundColor: SUMI,
    borderTopColor: 'rgba(184,150,62,0.12)',
  },

  // Welcome / Done button
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: WASHI, borderRadius: 99,
    paddingVertical: 15, gap: 10,
    shadowColor: WASHI, shadowOpacity: 0.12, shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  primaryBtnText: {
    fontSize: 15, color: SUMI,
    fontFamily: 'NotoSansJP_700Bold', letterSpacing: 0.4,
  },
  primaryArrow: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: WASHI_DARK,
    alignItems: 'center', justifyContent: 'center',
  },
  ghostBtn: { alignItems: 'center', paddingVertical: 6 },
  ghostBtnText: {
    fontSize: 12, color: 'rgba(250,245,236,0.25)',
    fontFamily: 'NotoSansJP_400Regular',
  },

  // Question next button
  nextBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: BENI, borderRadius: 99,
    paddingVertical: 15, gap: 8,
    shadowColor: BENI, shadowOpacity: 0.3, shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 }, elevation: 5,
  },
  nextBtnOff: { backgroundColor: WASHI_DARK, shadowOpacity: 0, elevation: 0 },
  nextBtnText: {
    fontSize: 15, color: WASHI,
    fontFamily: 'NotoSansJP_700Bold', letterSpacing: 0.3,
  },
  nextBtnTextOff: { color: INK_50 },
});
