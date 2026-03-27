import React from 'react';
import {
  View, Text, StyleSheet, ImageBackground, TouchableOpacity,
  FlatList, TextInput, Modal, Animated, ScrollView,
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '@/api.js';

import { SUMI, BENI, SAKURA, WASHI, WASHI_DARK, KINCHA, KINCHA_LIGHT, INK_60, INK_20, WHITE } from '@/constants/theme';
import WashiDivider from '@/components/ui/WashiDivider';
const ERROR = BENI;

// ─── Sakura petal decoration ──────────────────────────────────────────────────
const SakuraPetal = ({ style }: { style?: any }) => (
  <Text style={[{ fontSize: 16, opacity: 0.18 }, style]}>🌸</Text>
);


interface Category {
  name: string;
  icon: string;
  iconLib: 'ion' | 'mci';
  color: string;
}

const EXPENSE_CATEGORIES: Category[] = [
  { name: 'Food',        icon: 'restaurant',          iconLib: 'ion', color: '#E67E22' },
  { name: 'Transport',   icon: 'airplane',             iconLib: 'ion', color: '#2980B9' },
  { name: 'Lodging',     icon: 'bed',                  iconLib: 'ion', color: '#8E44AD' },
  { name: 'Shopping',    icon: 'bag-handle',           iconLib: 'ion', color: '#C0392B' },
  { name: 'Activities',  icon: 'ticket',               iconLib: 'ion', color: '#16A085' },
  { name: 'Tour',        icon: 'map',                  iconLib: 'ion', color: '#27AE60' },
  { name: 'Cafe',        icon: 'cafe',                 iconLib: 'ion', color: '#A0522D' },
  { name: 'Health',      icon: 'medkit',               iconLib: 'ion', color: '#E74C3C' },
  { name: 'SIM / WiFi',  icon: 'wifi',                 iconLib: 'ion', color: '#2ECC71' },
  { name: 'Visa / Docs', icon: 'document-text',        iconLib: 'ion', color: '#7F8C8D' },
  { name: 'Insurance',   icon: 'shield-checkmark',     iconLib: 'ion', color: '#1ABC9C' },
  { name: 'Taxi / Grab', icon: 'car',                  iconLib: 'ion', color: '#F39C12' },
  { name: 'Baggage',     icon: 'briefcase',            iconLib: 'ion', color: '#6C5CE7' },
  { name: 'Gifts',       icon: 'gift',                 iconLib: 'ion', color: '#E91E63' },
  { name: 'Other',       icon: 'ellipsis-horizontal',  iconLib: 'ion', color: '#95A5A6' },
];

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

  // ── Currency conversion ────────────────────────────────────────────────────
  const [currency, setCurrency] = useState<'JPY' | 'USD' | 'THB'>('JPY');
  const [rates, setRates] = useState({ USD: 0.0067, THB: 0.245 });
  const CURRENCY_META = {
    JPY: { symbol: '¥',  decimals: 0 },
    USD: { symbol: '$',  decimals: 2 },
    THB: { symbol: '฿', decimals: 0 },
  } as const;

  useEffect(() => {
    fetch('https://open.er-api.com/v6/latest/JPY')
      .then(r => r.json())
      .then(data => {
        if (data?.rates) {
          setRates({ USD: data.rates.USD ?? 0.0067, THB: data.rates.THB ?? 0.245 });
        }
      })
      .catch(() => {}); // fallback to default rates on error
  }, []);

  const fmt = (jpyAmount: number) => {
    const meta = CURRENCY_META[currency];
    const rate = currency === 'JPY' ? 1 : rates[currency];
    const converted = jpyAmount * rate;
    return `${meta.symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: meta.decimals, maximumFractionDigits: meta.decimals })}`;
  };

  // Convert display-currency amount → JPY integer for storage
  const toJPY = (displayAmount: number): number => {
    if (currency === 'JPY') return Math.round(displayAmount);
    return Math.round(displayAmount / rates[currency]);
  };

  // Convert JPY → display-currency string for input field
  const jpyToDisplay = (jpy: number): string => {
    if (currency === 'JPY') return String(jpy);
    const converted = jpy * rates[currency];
    return converted.toFixed(CURRENCY_META[currency].decimals);
  };

  const [isEditing, setIsEditing]               = useState(false);
  const [editingExpenseId, setEditingExpenseId] = useState<number | null>(null);
  const [loading, setLoading]                   = useState(true);
  const [isDeleteMode, setIsDeleteMode]         = useState(false);
  const [isSaving, setIsSaving]                 = useState(false);
  const [deleteTargetId, setDeleteTargetId]     = useState<number | null>(null);
  const [canEdit, setCanEdit]                   = useState(true);

  const cardAnims = useRef<Animated.Value[]>([]).current;


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
    // Allow decimals for non-JPY currencies
    const cleaned = currency === 'JPY'
      ? text.replace(/[^0-9]/g, '')
      : text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
    setAmount(cleaned);
    setFormErrors(prev => ({
      ...prev,
      amount: cleaned === '' ? 'Amount is required' : undefined,
    }));
  };

  const handleBudgetAmountChange = (text: string) => {
    const cleaned = currency === 'JPY'
      ? text.replace(/[^0-9]/g, '')
      : text.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
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
    if (!editBudgetAmount || !/^\d+(\.\d+)?$/.test(editBudgetAmount))
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
        const [tripRes, budgetRes, userRes] = await Promise.all([
          axios.get(`${API_URL}/trip_plan/${trip_id}`,   { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/budget/plan/${trip_id}`, { headers: { Authorization: `Bearer ${token}` } }),
          axios.get(`${API_URL}/user`,                   { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        setTrip(tripRes.data);
        setBudget(budgetRes.data);
        setExpenses(budgetRes.data?.expenses || []);
        const isCreator = tripRes.data?.creator_id === userRes.data?.customer_id;
        if (isCreator) {
          setCanEdit(true);
        } else if (tripRes.data?.trip_id) {
          try {
            const roleRes = await axios.get(`${API_URL}/trip_group/${tripRes.data.trip_id}/my-role`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            setCanEdit(roleRes.data.role === 'editor');
          } catch { setCanEdit(false); }
        } else {
          setCanEdit(false);
        }
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    fetchTrip();
  }, [trip_id]);

  // ── Modal controls ──────────────────────────────────────────────────────────
  const openEditBudgetModal = () => {
    setEditBudgetAmount(jpyToDisplay(budget?.total_budget ?? 0));
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
    setAmount(jpyToDisplay(expense.amount));
    setDescription(expense.description);
    setSelectedCategory(expense.category);
    setFormErrors({});
    setModalVisible(true);
  };

  const openModal = () => {
    setIsEditing(false);
    setEditingExpenseId(null);
    setAmount('');
    setDescription('');
    setSelectedCategory(null);
    setFormErrors({});
    setModalVisible(true);
    Animated.sequence([
      Animated.timing(fabScale, { toValue: 0.82, duration: 80, useNativeDriver: true }),
      Animated.spring(fabScale, { toValue: 1, useNativeDriver: true }),
    ]).start();
  };

  const closeModal = () => setModalVisible(false);

  // ── Save ────────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (isSaving) return;
    if (!validateExpenseForm()) return;
    setIsSaving(true);
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token || !trip?.budget?.budget_id) return;
      const jpyAmount = toJPY(parseFloat(amount));
      const data = {
        budget_id: trip.budget.budget_id,
        category: selectedCategory,
        description,
        amount: jpyAmount,
      };
      if (isEditing && editingExpenseId) {
        await axios.put(`${API_URL}/expense/${editingExpenseId}`, data, { headers: { Authorization: `Bearer ${token}` } });
        setExpenses(prev =>
          prev.map(e =>
            e.expense_id === editingExpenseId
              ? { ...e, ...data, amount: jpyAmount, category: (data.category ?? e.category) as string }
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
    finally { setIsSaving(false); }
  };

  const handleSaveBudget = async () => {
    if (!validateBudgetForm()) return;
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;
      await axios.put(
        `${API_URL}/budget/${budget?.budget_id}`,
        { total_budget: toJPY(parseFloat(editBudgetAmount)), plan_id: trip_id },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setBudget((prev: any) => ({ ...prev, total_budget: Number(editBudgetAmount) }));
      closeEditBudgetModal();
    } catch (e) { console.error(e); }
  };

  const handleDeleteExpense = async (expense_id: number) => {
    try {
      const token = await AsyncStorage.getItem('access_token');
      if (!token) return;
      await axios.delete(`${API_URL}/expense/${expense_id}`, { headers: { Authorization: `Bearer ${token}` } });
      setExpenses(prev => prev.filter(e => e.expense_id !== expense_id));
    } catch (e) { console.error(e); }
  };

  const getCategoryMeta = (name: string): Category =>
    EXPENSE_CATEGORIES.find(c => c.name === name) ?? EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1];

  const renderCatIcon = (cat: Category, size = 18, color?: string) =>
    <Ionicons name={cat.icon as any} size={size} color={color ?? cat.color} />;

  const remaining       = budget ? budget.total_budget - totalSpent : 0;
  const progressPercent = budget ? Math.min(totalSpent / budget.total_budget, 1) : 0;
  const progressColor   = progressPercent > 0.85 ? BENI : progressPercent > 0.6 ? '#C8860A' : KINCHA;

  const renderExpenseItem = useCallback(({ item, index }: { item: Expense; index: number }) => {
    const anim = cardAnims[index] ?? new Animated.Value(1);
    const meta = getCategoryMeta(item.category);
    return (
      <Animated.View style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
      }}>
        <View style={s.expCardWrap}>
          <View style={s.expCard}>
            <TouchableOpacity
              style={s.expCardMain}
              onPress={() => { if (!isDeleteMode) openEditExpenseModal(item); }}
              activeOpacity={0.8}
            >
              <View style={[s.expStripe, { backgroundColor: meta.color }]} />
              <View style={[s.expIconBadge, { backgroundColor: meta.color + '18' }]}>
                {renderCatIcon(meta, 22)}
              </View>
              <View style={s.expBody}>
                <Text style={s.expCategory}>{item.category}</Text>
                <Text style={s.expDesc}>{item.description || 'No description'}</Text>
              </View>
              <Text style={[s.expAmount, { paddingRight: isDeleteMode ? 0 : 14 }]}>{fmt(item.amount)}</Text>
            </TouchableOpacity>
            {isDeleteMode && (
              <TouchableOpacity
                style={s.expTrashBtn}
                onPress={() => setDeleteTargetId(item.expense_id)}
                activeOpacity={0.7}
              >
                <Ionicons name="trash-outline" size={18} color={BENI} />
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Animated.View>
    );
  }, [cardAnims, currency, rates, expenses, isDeleteMode]);

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

    

        <Animated.View
          style={[s.heroContent, { opacity: headerFade, transform: [{ translateY: headerSlide }] }]}
        >
          {/* Tag pill */}
          <View style={s.tagPill}>
            <Text style={s.tagText}>· TRIP BUDGET</Text>
          </View>

          <Text style={s.heroTripName}>{trip ? trip.name_group : '— — —'}</Text>

          {/* Currency toggle */}
          <View style={s.currencyToggle}>
            {(['JPY', 'USD', 'THB'] as const).map(c => (
              <TouchableOpacity
                key={c}
                style={[s.currencyBtn, currency === c && s.currencyBtnActive]}
                onPress={() => setCurrency(c)}
                activeOpacity={0.8}
              >
                <Text style={[s.currencyBtnText, currency === c && s.currencyBtnTextActive]}>
                  {c === 'JPY' ? '¥ JPY' : c === 'USD' ? '$ USD' : '฿ THB'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Budget card */}
          <View style={s.budgetCard}>
            <View>
              <Text style={s.budgetSubLabel}>· Total Budget</Text>
              <Text style={s.budgetAmount}>
                {budget ? fmt(Number(budget.total_budget)) : '——'}
              </Text>
            </View>
            {canEdit && (
              <TouchableOpacity onPress={openEditBudgetModal} style={s.editBtn}>
                <Ionicons name="pencil" size={13} color={WASHI} />
                <Text style={s.editBtnText}>Edit</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Progress bar */}
          {budget && (
            <View style={s.progressWrap}>
              <View style={s.progressTrack}>
                <View style={[s.progressFill, { width: `${progressPercent * 100}%` as any, backgroundColor: progressColor }]} />
                <View style={[s.progressDot, { left: `${Math.min(progressPercent * 100 - 1.5, 97)}%` as any, backgroundColor: progressColor }]} />
              </View>
              <View style={s.progressMeta}>
                <Text style={s.progressUsed}>Spent {fmt(totalSpent)}</Text>
                <Text style={[s.progressLeft, { color: remaining < 0 ? SAKURA : KINCHA_LIGHT }]}>
                  {remaining < 0 ? '⚠ ' : ''}Remaining {fmt(remaining)}
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
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {canEdit && (
              <TouchableOpacity
                style={[s.deleteModeBtn, isDeleteMode && s.deleteModeBtnActive]}
                onPress={() => setIsDeleteMode(p => !p)}
              >
                <Ionicons name={isDeleteMode ? 'close' : 'trash-outline'} size={16} color={isDeleteMode ? WHITE : BENI} />
              </TouchableOpacity>
            )}
            <View style={s.countBadge}>
              <Text style={s.countText}>{expenses.length}</Text>
            </View>
          </View>
        </View>

        <WashiDivider />

        <FlatList
          data={expenses}
          keyExtractor={item => item.expense_id.toString()}
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
          renderItem={renderExpenseItem}
          ListEmptyComponent={
            <View style={s.emptyWrap}>
              <Text style={s.emptyKanji}></Text>
              <Text style={s.emptyTitle}>No expenses yet</Text>
              <Text style={s.emptySub}>Tap + to log your first expense</Text>
            </View>
          }
        />
      </View>

      {/* ══ FAB — admin only ═════════════════════════════════════════════ */}
      {canEdit && (
        <Animated.View style={[s.fabWrap, { transform: [{ scale: fabScale }] }]}>
          <View style={s.fabRing} />
          <TouchableOpacity style={s.fab} onPress={openModal} activeOpacity={0.88}>
            <Ionicons name="add" size={27} color={WASHI} />
          </TouchableOpacity>
        </Animated.View>
      )}

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
                <Text style={s.fieldPrefix}>{CURRENCY_META[currency].symbol}</Text>
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

      {/* ══ Delete Confirm Modal ════════════════════════════════════════════ */}
      <Modal visible={deleteTargetId !== null} transparent animationType="fade" onRequestClose={() => setDeleteTargetId(null)}>
        <View style={s.confirmOverlay}>
          <View style={s.confirmBox}>
            <View style={s.confirmIconWrap}>
              <Ionicons name="trash-outline" size={28} color={BENI} />
            </View>
            <Text style={s.confirmTitle}>Delete Expense?</Text>
            <Text style={s.confirmSub}>This action cannot be undone.</Text>
            <View style={s.confirmBtnRow}>
              <TouchableOpacity style={s.confirmCancelBtn} onPress={() => setDeleteTargetId(null)}>
                <Text style={s.confirmCancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.confirmDeleteBtn}
                onPress={async () => {
                  if (deleteTargetId !== null) await handleDeleteExpense(deleteTargetId);
                  setDeleteTargetId(null);
                }}
              >
                <Text style={s.confirmDeleteTxt}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ══ Add / Edit Expense Modal ═════════════════════════════════════════ */}
      <Modal visible={isModalVisible} animationType="slide" transparent onRequestClose={closeModal}>
        <View style={s.overlay}>
            <View style={s.expSheet}>
              <View style={s.handle} />
              <View style={s.sheetAccentBar} />

              <View style={s.sheetHeadRow}>
                <Text style={[s.sheetTitle, { flex: 1 }]}>{isEditing ? 'Edit Expense' : 'Add Expense'}</Text>
                <TouchableOpacity onPress={closeModal} style={{ padding: 4 }}>
                  <Ionicons name="close" size={18} color={INK_60} />
                </TouchableOpacity>
              </View>

              <WashiDivider />

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
                {/* Currency toggle */}
                <View style={s.modalCurrencyRow}>
                  {(['JPY', 'USD', 'THB'] as const).map(c => (
                    <TouchableOpacity
                      key={c}
                      style={[s.modalCurrencyBtn, currency === c && s.modalCurrencyBtnActive]}
                      onPress={() => { setCurrency(c); setAmount(''); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.modalCurrencyText, currency === c && s.modalCurrencyTextActive]}>
                        {c === 'JPY' ? '¥ JPY' : c === 'USD' ? '$ USD' : '฿ THB'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Amount */}
                <Text style={s.fieldLabel}>Amount <Text style={s.req}>*</Text></Text>
                <View style={[s.fieldWrap, formErrors.amount ? s.fieldError : null]}>
                  <Text style={s.fieldPrefix}>{CURRENCY_META[currency].symbol}</Text>
                  <TextInput
                    placeholder={currency === 'JPY' ? 'e.g. 1200' : currency === 'USD' ? 'e.g. 8.00' : 'e.g. 280'}
                    keyboardType="decimal-pad"
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

                <View style={s.catGrid}>
                  {EXPENSE_CATEGORIES.map((cat, i) => {
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

              </ScrollView>

              {/* ── Sticky footer ── */}
              <View style={s.stickyFooter}>
                <WashiDivider />
                <View style={s.btnRow}>
                  <TouchableOpacity style={s.cancelBtn} onPress={closeModal}>
                    <Text style={s.cancelTxt}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.saveBtn, isSaving && { opacity: 0.5 }]} onPress={handleSave} disabled={isSaving}>
                    <Text style={s.saveTxt}>{isSaving ? 'Saving...' : 'Save'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: WASHI },

  // ── Hero ──
  heroImg:     { height: 340, justifyContent: 'flex-end' },
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

  // ── Modal currency toggle ──
  modalCurrencyRow: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: 14,
  },
  modalCurrencyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: INK_20,
    backgroundColor: WASHI_DARK,
  },
  modalCurrencyBtnActive: {
    backgroundColor: BENI,
    borderColor: BENI,
  },
  modalCurrencyText: {
    fontSize: 11,
    fontWeight: '700',
    color: INK_60,
    letterSpacing: 0.4,
  },
  modalCurrencyTextActive: {
    color: WHITE,
  },

  // ── Sticky footer ──
  stickyFooter: {
    paddingTop: 4,
    paddingBottom: 24,
  },

  // ── Currency toggle ──
  currencyToggle: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(28,20,16,0.35)',
    borderRadius: 99,
    padding: 3,
    marginBottom: 10,
    gap: 2,
  },
  currencyBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
  },
  currencyBtnActive: {
    backgroundColor: KINCHA,
  },
  currencyBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(250,245,236,0.6)',
    letterSpacing: 0.5,
  },
  currencyBtnTextActive: {
    color: WASHI,
  },
  expCardMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  expDeleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  expCardXBtn: {
    position: 'absolute',
    top: -7,
    right: -7,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: BENI,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  deleteModeBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1.5,
    borderColor: BENI,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteModeBtnActive: {
    backgroundColor: BENI,
    borderColor: BENI,
  },
  expCardWrap: {
    marginBottom: 9,
    overflow: 'visible',
  },
  expTrashBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#F0EBE3',
  },
  // ── Delete confirm modal ──
  confirmOverlay: {
    flex: 1,
    backgroundColor: 'rgba(28,20,16,0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  confirmBox: {
    backgroundColor: WHITE,
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 20,
    width: '100%',
    alignItems: 'center',
  },
  confirmIconWrap: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: BENI + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  confirmTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: SUMI,
    marginBottom: 6,
  },
  confirmSub: {
    fontSize: 13,
    color: INK_60,
    marginBottom: 22,
  },
  confirmBtnRow: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
  },
  confirmCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#E0D8CF',
    alignItems: 'center',
  },
  confirmCancelTxt: {
    fontSize: 14,
    fontWeight: '600',
    color: INK_60,
  },
  confirmDeleteBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: BENI,
    alignItems: 'center',
  },
  confirmDeleteTxt: {
    fontSize: 14,
    fontWeight: '700',
    color: WHITE,
  },
});