import React from 'react';
import {
  View, Text, StyleSheet, ImageBackground, TouchableOpacity,
  FlatList, TextInput, Modal, Animated, ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect } from 'react';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/api.js';

// ─── Japanese Palette ─────────────────────────────────────────────────────────
const SUMI         = '#1C1410';   // sumi ink
const BENI         = '#C0392B';   // beni vermillion
const BENI_LIGHT   = '#E74C3C';
const SAKURA       = '#F2C9D0';   // sakura blush
const WASHI        = '#FAF5EC';   // washi paper cream
const WASHI_DARK   = '#EDE5D8';
const KINCHA       = '#B8963E';   // kincha gold
const KINCHA_LIGHT = '#D4AF55';
const INK_60       = 'rgba(28,20,16,0.6)';
const INK_20       = 'rgba(28,20,16,0.12)';
const WHITE        = '#FFFFFF';
const ERROR        = '#C0392B';

// ─── Sakura petal decoration ──────────────────────────────────────────────────
const SakuraPetal = ({ style }: { style?: any }) => (
  <Text style={[{ fontSize: 16, opacity: 0.18 }, style]}>🌸</Text>
);

// ─── Gold divider ─────────────────────────────────────────────────────────────
const WashiDivider = () => (
  <View style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 10 }}>
    <View style={{ flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.4 }} />
    <Text style={{ fontSize: 9, color: KINCHA, marginHorizontal: 8, opacity: 0.55 }}>✦</Text>
    <View style={{ flex: 1, height: 0.5, backgroundColor: KINCHA, opacity: 0.4 }} />
  </View>
);

type CategoryType = 'expense' | 'income';

interface Category {
  name: string;
  icon: string;         // Ionicons name
  iconLib: 'ion' | 'mci'; // which icon library
  color: string;        // badge accent color
  type: CategoryType;
}

const EXPENSE_CATEGORIES: Category[] = [
  { name: 'Food',        icon: 'restaurant',          iconLib: 'ion', color: '#E67E22', type: 'expense' },
  { name: 'Transport',   icon: 'airplane',             iconLib: 'ion', color: '#2980B9', type: 'expense' },
  { name: 'Lodging',     icon: 'bed',                  iconLib: 'ion', color: '#8E44AD', type: 'expense' },
  { name: 'Shopping',    icon: 'bag-handle',           iconLib: 'ion', color: '#C0392B', type: 'expense' },
  { name: 'Activities',  icon: 'ticket',               iconLib: 'ion', color: '#16A085', type: 'expense' },
  { name: 'Tour',        icon: 'map',                  iconLib: 'ion', color: '#27AE60', type: 'expense' },
  { name: 'Cafe',        icon: 'cafe',                 iconLib: 'ion', color: '#A0522D', type: 'expense' },
  { name: 'Health',      icon: 'medkit',               iconLib: 'ion', color: '#E74C3C', type: 'expense' },
  { name: 'SIM / WiFi',  icon: 'wifi',                 iconLib: 'ion', color: '#2ECC71', type: 'expense' },
  { name: 'Visa / Docs', icon: 'document-text',        iconLib: 'ion', color: '#7F8C8D', type: 'expense' },
  { name: 'Insurance',   icon: 'shield-checkmark',     iconLib: 'ion', color: '#1ABC9C', type: 'expense' },
  { name: 'Taxi / Grab', icon: 'car',                  iconLib: 'ion', color: '#F39C12', type: 'expense' },
  { name: 'Baggage',     icon: 'briefcase',            iconLib: 'ion', color: '#6C5CE7', type: 'expense' },
  { name: 'Gifts',       icon: 'gift',                 iconLib: 'ion', color: '#E91E63', type: 'expense' },
  { name: 'Other',       icon: 'ellipsis-horizontal',  iconLib: 'ion', color: '#95A5A6', type: 'expense' },
];

const INCOME_CATEGORIES: Category[] = [
  { name: 'Allowance',   icon: 'cash',                 iconLib: 'ion', color: '#27AE60', type: 'income' },
  { name: 'Transfer',    icon: 'swap-horizontal',      iconLib: 'ion', color: '#2980B9', type: 'income' },
  { name: 'Refund',      icon: 'return-down-back',     iconLib: 'ion', color: '#16A085', type: 'income' },
  { name: 'Income',      icon: 'wallet',               iconLib: 'ion', color: '#B8963E', type: 'income' },
];

const ALL_CATEGORIES = [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES];

interface Expense {
  expense_id: number;
  category: string;
  description: string;
  amount: number;
}

interface FormErrors {
  amount?: string;
  category?: string;
  budgetAmount?: string;
}

export default function TripBudgetScreen() {
  const { trip_id } = useLocalSearchParams();

  const [isModalVisible, setModalVisible] = useState(false);
  const translateY  = useRef(new Animated.Value(0)).current;
  const fabScale    = useRef(new Animated.Value(1)).current;
  const headerFade  = useRef(new Animated.Value(0)).current;
  const headerSlide = useRef(new Animated.Value(-20)).current;

  const [amount, setAmount]                     = useState('');
  const [description, setDescription]           = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [formErrors, setFormErrors]             = useState<FormErrors>({});

  const [editBudgetAmount, setEditBudgetAmount]               = useState('');
  const [isEditBudgetModalVisible, setEditBudgetModalVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(300)).current;

  const [trip, setTrip]       = useState<any>(null);
  const [budget, setBudget]   = useState<any>(null);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const totalSpent = expenses.reduce((sum, i) => sum + (i.amount || 0), 0);

  const [isEditing, setIsEditing]               = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [loading, setLoading]                   = useState(true);

  const cardAnims = useRef<Animated.Value[]>([]).current;

  const [categoryTab, setCategoryTab] = useState<CategoryType>('expense');

  // ── Entrance animation ──────────────────────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.timing(headerFade,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(headerSlide, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  // ── Card stagger ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (expenses.length === 0) return;
    while (cardAnims.length < expenses.length) cardAnims.push(new Animated.Value(0));
    Animated.stagger(65,
      expenses.map((_, i) =>
        Animated.timing(cardAnims[i], { toValue: 1, duration: 360, delay: 0, useNativeDriver: true })
      )
    ).start();
  }, [expenses.length]);

  // ── Validation ──────────────────────────────────────────────────────────────
  const isNumericOnly = (v: string) => /^\d+$/.test(v);

  const handleAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setAmount(cleaned);
    setFormErrors(prev => ({
      ...prev,
      amount: cleaned === '' ? 'Amount is required' : undefined,
    }));
  };

  const handleBudgetAmountChange = (text: string) => {
    const cleaned = text.replace(/[^0-9]/g, '');
    setEditBudgetAmount(cleaned);
    setFormErrors(prev => ({
      ...prev,
      budgetAmount: cleaned === '' ? 'Amount is required' : undefined,
    }));
  };

  const validateExpenseForm = (): boolean => {
    const errors: FormErrors = {};
    if (!amount || !isNumericOnly(amount))
      errors.amount = amount ? 'Numbers only, please' : 'Amount is required';
    if (!selectedCategory)
      errors.category = 'Please select a category';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validateBudgetForm = (): boolean => {
    const errors: FormErrors = {};
    if (!editBudgetAmount || !isNumericOnly(editBudgetAmount))
      errors.budgetAmount = editBudgetAmount ? 'Numbers only, please' : 'Amount is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ── Data fetch ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const fetchTrip = async () => {
      if (!trip_id) return;
      setLoading(true);
      try {
        const token = await AsyncStorage.getItem('access_token');
        if (!token) return;
        const [tripRes, budgetRes] = await Promise.all([
          axios.get(`${API_URL}/trip_plan/${trip_id}`,   { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/budget/plan/${trip_id}`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setTrip(tripRes.data);
        setBudget(budgetRes.data);
        setExpenses(budgetRes.data?.expenses || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchTrip();
  }, [trip_id]);

  // ── Modal controls ──────────────────────────────────────────────────────────
  const openEditBudgetModal = () => {
    setEditBudgetAmount(String(budget?.total_budget ?? ''));
    setFormErrors({});
    setEditBudgetModalVisible(true);
    Animated.timing(slideAnim, { toValue: 0, duration: 320, useNativeDriver: true }).start();
  };

  const closeEditBudgetModal = () => {
    Animated.timing(slideAnim, { toValue: 300, duration: 240, useNativeDriver: true }).start(() =>
      setEditBudgetModalVisible(false)
    );
  };

  const openEditExpenseModal = (expense: Expense) => {
    setIsEditing(true);
    setEditingExpenseId(expense.expense_id);
    setAmount(expense.amount.toString());
    setDescription(expense.description);
    setSelectedCategory(expense.category);
    setFormErrors({});
    setModalVisible(true);
    translateY.setValue(0);
  };

  const openModal = () => {
    setIsEditing(false);
    setEditingExpenseId(null);
    setAmount('');
    setDescription('');
    setSelectedCategory(null);
    setFormErrors({});
    setModalVisible(true);
    translateY.setValue(0);
    Animated.sequence([
      Animated.timing(fabScale, { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(fabScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const closeModal = () => {
    Animated.timing(translateY, { toValue: 300, duration: 260, useNativeDriver: true }).start(() => {
      setModalVisible(false);
      translateY.setValue(0);
    });
  };

  const onGestureEvent = Animated.event(
    [{ nativeEvent: { translationY: translateY } }],
    { useNativeDriver: true }
  );

  const onHandlerStateChange = (event: any) => {
    const { translationY, velocityY, state } = event.nativeEvent;
    if (state === State.END) {
      if (translationY > 100 || velocityY > 500) closeModal();
      else Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
    }
  };

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!validateExpenseForm()) return;
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token || !trip?.budget?.budget_id) return;
      const data = {
        budget_id: trip.budget.budget_id,
        category: selectedCategory,
        description,
        amount: parseInt(amount, 10),
      };
      if (isEditing && editingExpenseId) {
        await axios.put(`${API_URL}/expense/${editingExpenseId}`, data, { headers: { Authorization: `Bearer ${token}` } });
        setExpenses(prev =>
          prev.map(e =>
            e.expense_id === editingExpenseId
              ? { ...e, ...data, amount: parseInt(amount, 10), category: (data.category ?? e.category) as string }
              : e
          )
        );
      } else {
        const res = await axios.post(`${API_URL}/expense`, data, { headers: { Authorization: `Bearer ${token}` } });
        setExpenses(prev => [...prev, res.data]);
      }
      setModalVisible(false);
      setAmount(''); setDescription(''); setSelectedCategory(null);
      setEditingExpenseId(null); setIsEditing(false);
      closeModal();
    } catch (e) { console.error(e); }
  };

  const handleSaveBudget = async () => {
    if (!validateBudgetForm()) return;
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;
      await axios.put(
        `${API_URL}/budget/${budget?.budget_id}`,
        { total_budget: parseInt(editBudgetAmount, 10), plan_id: trip_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBudget((prev: any) => ({ ...prev, total_budget: Number(editBudgetAmount) }));
      closeEditBudgetModal();
    } catch (e) { console.error(e); }
  };

  const getCategoryMeta = (name: string): Category =>
    ALL_CATEGORIES.find(c => c.name === name) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

  const renderCatIcon = (cat: Category, size = 18, color?: string) =>
    <Ionicons name={cat.icon as any} size={size} color={color ?? cat.color} />;

  const remaining       = budget ? budget.total_budget - totalSpent : 0;
  const progressPercent = budget ? Math.min(totalSpent / budget.total_budget, 1) : 0;
  const progressColor   = progressPercent > 0.85 ? BENI : progressPercent > 0.6 ? '#C8860A' : KINCHA;

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <View style={s.container}>

      {/* ══ Hero Header ══════════════════════════════════════════════════════ */}
      <ImageBackground source={{ uri: 'https://picsum.photos/800/600' }} style={s.heroImg}>
        <View style={s.heroOverlay1} />
        <View style={s.heroOverlay2} />

        {/* Decorative top accent bar */}
        <View style={s.redTopBar} />

        {/* Scattered sakura petals */}
        <SakuraPetal style={{ position: 'absolute', top: 30, right: 30, fontSize: 30 }} />
        <SakuraPetal style={{ position: 'absolute', top: 64, right: 82, fontSize: 16 }} />
        <SakuraPetal style={{ position: 'absolute', top: 48, left: 24, fontSize: 20 }} />
        <SakuraPetal style={{ position: 'absolute', bottom: 95, right: 20, fontSize: 13 }} />

        {/* Vertical kanji watermark */}
        <View style={s.kanjiWatermark}>
          <Text style={s.kanjiWatermarkText}>予</Text>
          <Text style={s.kanjiWatermarkText}>算</Text>
          <Text style={s.kanjiWatermarkText}>旅</Text>
        </View>

        <Animated.View
          style={[s.heroContent, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}
        >
          {/* Tag pill */}
          <View style={s.tagPill}>
            <Text style={s.tagText}>· TRIP BUDGET</Text>
          </View>

          <Text style={s.heroTripName}>{trip ? trip.name_group : '— — —'}</Text>

          {/* Budget card */}
          <View style={s.budgetCard}>
            <View>
              <Text style={s.budgetSubLabel}>· Total Budget</Text>
              <Text style={s.budgetAmount}>
                ¥ {budget ? Number(budget.total_budget).toLocaleString() : '——'}
              </Text>
            </View>
            <TouchableOpacity onPress={openEditBudgetModal} style={s.editBtn}>
              <Ionicons name="pencil" size={13} color={WASHI} />
              <Text style={s.editBtnText}>Edit</Text>
            </TouchableOpacity>
          </View>

          {/* Progress bar */}
          {budget && (
            <View style={s.progressWrap}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progressPercent * 100}%` as any, backgroundColor: progressColor }]} />
                <View style={[s.progressDot, { left: `${Math.min(progressPercent * 100 - 1.5, 97)}%` as any, backgroundColor: progressColor }]} />
              </View>
              <View style={s.progressMeta}>
                <Text style={s.progressUsed}>Spent ¥{totalSpent.toLocaleString()}</Text>
                <Text style={[s.progressLeft, { color: remaining < 0 ? SAKURA : KINCHA_LIGHT }]}>
                  {remaining < 0 ? '⚠ ' : ''}Remaining ¥{remaining.toLocaleString()}
                </Text>
              </View>
            </View>
          )}
        </Animated.View>
      </ImageBackground>

      {/* ══ Body ════════════════════════════════════════════════════════════ */}
      <View style={s.body}>
        {/* Section header */}
        <View style={s.sectionRow}>
          <View style={s.sectionLeft}>
            <View style={s.sectionBar} />
            <Text style={s.sectionTitle}>Expenses</Text>
            <Text style={s.sectionKanji}></Text>
          </View>
          <View style={s.countBadge}>
            <Text style={s.countText}>{expenses.length}</Text>
          </View>
        </View>

        <WashiDivider />

        <FlatList
          data={expenses}
          keyExtractor={item => item.expense_id.toString()}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => {
            while (cardAnims.length <= index) cardAnims.push(new Animated.Value(1));
            const anim = cardAnims[index] ?? new Animated.Value(1);
            return (
              <Animated.View style={{
                opacity: anim,
                transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
              }}>
                <TouchableOpacity onPress={() => openEditExpenseModal(item)} activeOpacity={0.8}>
                  <View style={s.expCard}>
                    <View style={[s.expStripe, { backgroundColor: getCategoryMeta(item.category).color }]} />
                    <View style={[s.expIconBadge, { backgroundColor: getCategoryMeta(item.category).color + '18' }]}>
                      {renderCatIcon(getCategoryMeta(item.category), 22)}
                    </View>
                    <View style={s.expBody}>
                      <Text style={s.expCategory}>{item.category}</Text>
                      <Text style={s.expDesc}>{item.description || 'No description'}</Text>
                    </View>
                    <View style={s.expRight}>
                      <Text style={[s.expAmount, { color: getCategoryMeta(item.category).type === 'income' ? '#27AE60' : BENI }]}>
                        {getCategoryMeta(item.category).type === 'income' ? '+' : ''}¥{Number(item.amount).toLocaleString()}
                      </Text>
                      <Ionicons name="chevron-forward" size={11} color={INK_60} />
                    </View>
                  </View>
                </TouchableOpacity>
              </Animated.View>
            );
          }}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyKanji}></Text>
              <Text style={s.emptyTitle}>No expenses yet</Text>
              <Text style={s.emptySub}>Tap + to log your first expense</Text>
            </View>
          }
        />
      </View>

      {/* ══ FAB ═════════════════════════════════════════════════════════════ */}
      <Animated.View style={[s.fabWrap, { transform: [{ scale: fabScale }] }]}>
        <View style={s.fabRing} />
        <TouchableOpacity style={s.fab} onPress={openModal} activeOpacity={0.88}>
          <Ionicons name="add" size={27} color={WASHI} />
        </TouchableOpacity>
      </Animated.View>

      {/* ══ Edit Budget Modal ════════════════════════════════════════════════ */}
      <Modal visible={isEditBudgetModalVisible} transparent animationType="none" onRequestClose={closeEditBudgetModal}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={closeEditBudgetModal}>
          <Animated.View style={[s.sheet, { transform: [{ translateY: slideAnim }] }]}>
            <TouchableOpacity activeOpacity={1}>
              <View style={s.handle} />
              <View style={s.sheetAccentBar} />
              <View style={s.sheetHeadRow}>
                <Text style={s.sheetTitle}>Edit Budget</Text>
              </View>
              <WashiDivider />
              <Text style={s.fieldLabel}>Amount <Text style={s.req}>*</Text></Text>
              <View style={[s.fieldWrap, formErrors.budgetAmount ? s.fieldError : null]}>
                <Text style={s.fieldPrefix}>¥</Text>
                <TextInput
                  keyboardType="numeric"
                  style={s.fieldInput}
                  value={editBudgetAmount}
                  onChangeText={handleBudgetAmountChange}
                  placeholder="e.g. 50000"
                  placeholderTextColor={INK_60}
                  selectionColor={BENI}
                />
              </View>
              {formErrors.budgetAmount
                ? <View style={s.errRow}><Ionicons name="alert-circle" size={13} color={ERROR} /><Text style={s.errTxt}>{formErrors.budgetAmount}</Text></View>
                : <View style={{ height: 14 }} />
              }
              <View style={s.btnRow}>
                <TouchableOpacity onPress={closeEditBudgetModal} style={s.cancelBtn}>
                  <Text style={s.cancelTxt}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={handleSaveBudget} style={s.saveBtn}>
                  <Text style={s.saveTxt}>Save</Text>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          </Animated.View>
        </TouchableOpacity>
      </Modal>

      {/* ══ Add / Edit Expense Modal ═════════════════════════════════════════ */}
      <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={s.overlay}>
          <PanGestureHandler onGestureEvent={onGestureEvent} onHandlerStateChange={onHandlerStateChange}>
            <Animated.View style={[s.expSheet, { transform: [{ translateY: translateY }] }]}>
              <View style={s.handle} />
              <View style={s.sheetAccentBar} />

              <View style={s.sheetHeadRow}>
                <Text style={[s.sheetTitle, { flex: 1 }]}>{isEditing ? 'Edit Expense' : 'Add Expense'}</Text>
                <TouchableOpacity onPress={closeModal} style={{ padding: 4 }}>
                  <Ionicons name="close" size={18} color={INK_60} />
                </TouchableOpacity>
              </View>

              <WashiDivider />

              <ScrollView showsVerticalScrollIndicator={false}>
                {/* Amount */}
                <Text style={s.fieldLabel}>Amount <Text style={s.req}>*</Text></Text>
                <View style={[s.fieldWrap, formErrors.amount ? s.fieldError : null]}>
                  <Text style={s.fieldPrefix}>¥</Text>
                  <TextInput
                    placeholder="e.g. 1200"
                    keyboardType="numeric"
                    value={amount}
                    onChangeText={handleAmountChange}
                    style={s.fieldInput}
                    placeholderTextColor={INK_60}
                    selectionColor={BENI}
                  />
                </View>
                {formErrors.amount
                  ? <View style={s.errRow}><Ionicons name="alert-circle" size={13} color={ERROR} /><Text style={s.errTxt}>{formErrors.amount}</Text></View>
                  : <View style={{ height: 10 }} />
                }

                {/* Description */}
                <Text style={s.fieldLabel}>Note</Text>
                <View style={s.fieldWrap}>
                  <TextInput
                    placeholder="e.g. Ramen, Train fare..."
                    value={description}
                    onChangeText={setDescription}
                    style={[s.fieldInput, { flex: 1 }]}
                    placeholderTextColor={INK_60}
                    selectionColor={BENI}
                  />
                </View>

                <View style={{ height: 14 }} />

                {/* Category */}
                <Text style={s.fieldLabel}>Category <Text style={s.req}>*</Text></Text>

                {/* Expense / Income tab */}
                <View style={s.catTabRow}>
                  <TouchableOpacity
                    style={[s.catTab, categoryTab === 'expense' && s.catTabActive]}
                    onPress={() => setCategoryTab('expense')}
                  >
                    <Ionicons name="remove-circle-outline" size={14} color={categoryTab === 'expense' ? BENI : INK_60} />
                    <Text style={[s.catTabTxt, categoryTab === 'expense' && s.catTabTxtActive]}>Expense</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.catTab, categoryTab === 'income' && s.catTabActiveIncome]}
                    onPress={() => setCategoryTab('income')}
                  >
                    <Ionicons name="add-circle-outline" size={14} color={categoryTab === 'income' ? '#27AE60' : INK_60} />
                    <Text style={[s.catTabTxt, categoryTab === 'income' && s.catTabTxtIncome]}>Income</Text>
                  </TouchableOpacity>
                </View>

                <View style={s.catGrid}>
                  {(categoryTab === 'expense' ? EXPENSE_CATEGORIES : INCOME_CATEGORIES).map((cat, i) => {
                    const active = selectedCategory === cat.name;
                    return (
                      <TouchableOpacity
                        key={i}
                        style={[s.catCell, active && { backgroundColor: cat.color, borderColor: cat.color }]}
                        onPress={() => {
                          setSelectedCategory(cat.name);
                          setFormErrors(prev => ({ ...prev, category: undefined }));
                        }}
                        activeOpacity={0.78}
                      >
                        {active && <View style={s.catDot} />}
                        <View style={[s.catIconWrap, active && { backgroundColor: 'rgba(255,255,255,0.2)' }, !active && { backgroundColor: cat.color + '18' }]}>
                          <Ionicons name={cat.icon as any} size={20} color={active ? WHITE : cat.color} />
                        </View>
                        <Text style={[s.catName, active && s.catNameActive]}>{cat.name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {formErrors.category
                  ? <View style={s.errRow}><Ionicons name="alert-circle" size={13} color={ERROR} /><Text style={s.errTxt}>{formErrors.category}</Text></View>
                  : <View style={{ height: 8 }} />
                }

                <WashiDivider />

                <View style={s.btnRow}>
                  <TouchableOpacity style={s.cancelBtn} onPress={closeModal}>
                    <Text style={s.cancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.saveBtn} onPress={handleSave}>
                    <Text style={s.saveTxt}>Save</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ height: 24 }} />
              </ScrollView>
            </Animated.View>
          </PanGestureHandler>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: WASHI },

  // ── Hero ──
  heroImg:     { height: 310, justifyContent: 'flex-end' },
  heroOverlay1:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,20,16,0.52)' },
  heroOverlay2:{ ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(192,57,43,0.07)' },
  redTopBar:   { position: 'absolute', top: 0, left: 0, right: 0, height: 3, backgroundColor: BENI },

  kanjiWatermark: { position: 'absolute', right: 16, top: 50, alignItems: 'center' },
  kanjiWatermarkText: {
    fontSize: 20,
    color: 'rgba(255,255,255,0.10)',
    fontWeight: '900',
    letterSpacing: 1,
    lineHeight: 26,
  },

  heroContent: { paddingHorizontal: 22, paddingBottom: 26 },

  tagPill: {
    alignSelf: 'flex-start',
    borderWidth: 0.8,
    borderColor: 'rgba(255,255,255,0.32)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 2,
    marginBottom: 10,
  },
  tagText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.65)',
    letterSpacing: 2.8,
    fontWeight: '700',
  },

  heroTripName: {
    fontSize: 27,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 0.5,
    marginBottom: 16,
  },

  budgetCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(250,245,236,0.09)',
    borderLeftWidth: 3,
    borderLeftColor: BENI,
    borderRadius: 3,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  budgetSubLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.48)',
    letterSpacing: 2,
    marginBottom: 3,
  },
  budgetAmount: {
    fontSize: 30,
    fontWeight: '900',
    color: WHITE,
    letterSpacing: 1,
  },
  editBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(192,57,43,0.14)',
    borderWidth: 0.8,
    borderColor: WASHI,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 3,
  },
  editBtnText: { fontSize: 11, color: WASHI, fontWeight: '700', letterSpacing: 0.4 },

  progressWrap:  {},
  progressTrack: {
    height: 5,
    backgroundColor: 'rgba(255,255,255,0.13)',
    borderRadius: 3,
    overflow: 'visible',
    position: 'relative',
  },
  progressFill:  { height: '100%', borderRadius: 3 },
  progressDot:   {
    position: 'absolute',
    top: -3,
    width: 11,
    height: 11,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: WHITE,
  },
  progressMeta:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  progressUsed:  { fontSize: 10, color: 'rgba(255,255,255,0.52)', letterSpacing: 0.4 },
  progressLeft:  { fontSize: 11, fontWeight: '700', letterSpacing: 0.4 },

  // ── Body ──
  body: { flex: 1, paddingHorizontal: 20, paddingTop: 22, backgroundColor: WASHI },

  sectionRow:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionBar:  { width: 3, height: 17, backgroundColor: BENI, borderRadius: 2 },
  sectionTitle:{ fontSize: 15, fontWeight: '800', color: SUMI, letterSpacing: 0.3 },
  sectionKanji:{ fontSize: 11, color: INK_60, letterSpacing: 1.5 },
  countBadge:  {
    backgroundColor: BENI,
    minWidth: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  countText: { fontSize: 11, fontWeight: '800', color: WHITE },

  // ── Expense card ──
  expCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 5,
    marginBottom: 9,
    overflow: 'hidden',
    shadowColor: SUMI,
    shadowOpacity: 0.07,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  expStripe:     { width: 3, alignSelf: 'stretch', backgroundColor: BENI },
  expIconBadge: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  expBody:      { flex: 1, paddingHorizontal: 12, paddingVertical: 13 },
  expCategory:  { fontSize: 13, fontWeight: '700', color: SUMI, marginBottom: 2 },
  expDesc:      { fontSize: 11, color: INK_60 },
  expRight:     { flexDirection: 'row', alignItems: 'center', paddingRight: 12, gap: 2 },
  expAmount:    { fontSize: 14, fontWeight: '800', color: BENI },

  // ── Empty ──
  emptyWrap:  { alignItems: 'center', paddingVertical: 58 },
  emptyKanji: { fontSize: 60, color: INK_20, fontWeight: '900', lineHeight: 72 },
  emptyTitle: { fontSize: 14, color: INK_60, fontWeight: '600', marginTop: 6 },
  emptySub:   { fontSize: 11, color: INK_60, marginTop: 3, opacity: 0.55 },

  // ── FAB ──
  fabWrap: { position: 'absolute', bottom: 36, right: 22 },
  fabRing: {
    position: 'absolute',
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 1,
    borderColor: 'rgba(192,57,43,0.22)',
    top: -5,
    left: -5,
  },
  fab: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: BENI,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BENI,
    shadowOpacity: 0.48,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 5 },
    elevation: 10,
  },

  // ── Overlay ──
  overlay: { flex: 1, backgroundColor: 'rgba(28,20,16,0.60)', justifyContent: 'flex-end' },

  // ── Sheets ──
  sheet: {
    backgroundColor: WASHI,
    paddingHorizontal: 22,
    paddingBottom: 38,
    paddingTop: 10,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  expSheet: {
    backgroundColor: WASHI,
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
  },
  handle:       { width: 32, height: 3, backgroundColor: INK_20, borderRadius: 2, alignSelf: 'center', marginBottom: 14 },
  sheetAccentBar:{ height: 1.5, backgroundColor: BENI, borderRadius: 1, marginBottom: 18, opacity: 0.55, marginHorizontal: -22 },
  sheetHeadRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9 },
  sheetKanji:   { fontSize: 22, fontWeight: '900', color: BENI, opacity: 0.3, letterSpacing: 1 },
  sheetTitle:   { fontSize: 16, fontWeight: '800', color: SUMI, letterSpacing: 0.2 },

  // ── Form ──
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: INK_60,
    letterSpacing: 1.4,
    textTransform: 'uppercase',
    marginBottom: 7,
    marginTop: 14,
  },
  req: { color: BENI },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: WHITE,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: WASHI_DARK,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  fieldError: { borderColor: ERROR, borderWidth: 1.5, backgroundColor: 'rgba(192,57,43,0.03)' },
  fieldPrefix: { fontSize: 16, fontWeight: '700', color: BENI, marginRight: 8 },
  fieldInput:  { flex: 1, fontSize: 16, color: SUMI, padding: 0 },
  errRow:      { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 5, marginBottom: 2 },
  errTxt:      { fontSize: 11, color: ERROR, fontWeight: '600' },

  catGrid: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  catCell: {
    width: '22%',
    aspectRatio: 0.85,
    backgroundColor: WHITE,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: WASHI_DARK,
    position: 'relative',
    gap: 2,
    paddingVertical: 6,
  },
  catCellActive: {},  // color applied dynamically per category
  catDot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: SAKURA,
  },
  catIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  catEmoji:      { fontSize: 24 },

  // ── Category tabs ──
  catTabRow: {
    flexDirection: 'row',
    backgroundColor: WASHI_DARK,
    borderRadius: 8,
    padding: 3,
    marginBottom: 12,
    gap: 3,
  },
  catTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: 7,
    borderRadius: 6,
  },
  catTabActive: {
    backgroundColor: WHITE,
    shadowColor: BENI,
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  catTabActiveIncome: {
    backgroundColor: WHITE,
    shadowColor: '#27AE60',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  catTabTxt:       { fontSize: 12, fontWeight: '700', color: INK_60 },
  catTabTxtActive: { color: BENI },
  catTabTxtIncome: { color: '#27AE60' },
  catName:       { fontSize: 10, color: INK_60, fontWeight: '600' },
  catNameActive: { color: 'rgba(255,255,255,0.88)' },

  // ── Buttons ──
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 10 },
  cancelBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 5,
    alignItems: 'center',
    backgroundColor: WASHI_DARK,
    borderWidth: 0.5,
    borderColor: INK_20,
  },
  cancelTxt: { color: INK_60, fontSize: 14, fontWeight: '700' },
  saveBtn: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 5,
    alignItems: 'center',
    backgroundColor: BENI,
    shadowColor: BENI,
    shadowOpacity: 0.38,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  saveTxt: { color: WHITE, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});