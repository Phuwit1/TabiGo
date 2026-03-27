import React from 'react';
import { View, Text, Modal, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BENI, SUMI, WASHI, WASHI_DARK, INK_20, INK_60, WHITE } from '@/constants/theme';
import { STYLE_OPTIONS, INTEREST_OPTIONS, LENGTH_OPTIONS } from '@/constants/preferenceOptions';

interface Props {
  visible: boolean;
  onClose: () => void;
  prefStyle: string;
  setPrefStyle: (v: string) => void;
  prefInterests: string[];
  setPrefInterests: React.Dispatch<React.SetStateAction<string[]>>;
  prefLength: string;
  setPrefLength: (v: string) => void;
  onSave: () => void;
  saving: boolean;
}

export default function PreferenceModal({
  visible, onClose,
  prefStyle, setPrefStyle,
  prefInterests, setPrefInterests,
  prefLength, setPrefLength,
  onSave, saving,
}: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={s.backdrop}>
        <View style={s.card}>
          <View style={s.handle} />
          <View style={s.header}>
            <Text style={s.title}>My Interests</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={20} color={SUMI} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* Travel Style */}
            <Text style={s.groupLabel}>Travel Style</Text>
            <View style={s.grid}>
              {STYLE_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.value}
                  style={[s.chip, prefStyle === o.value && s.chipActive]}
                  onPress={() => setPrefStyle(o.value)}
                  activeOpacity={0.8}
                >
                  <Ionicons name={o.icon as any} size={14} color={prefStyle === o.value ? '#fff' : SUMI} />
                  <Text style={[s.chipText, prefStyle === o.value && s.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Interests */}
            <Text style={s.groupLabel}>Interests</Text>
            <View style={s.grid}>
              {INTEREST_OPTIONS.map(o => {
                const active = prefInterests.includes(o.value);
                return (
                  <TouchableOpacity
                    key={o.value}
                    style={[s.chip, active && s.chipActive]}
                    onPress={() => setPrefInterests(prev =>
                      prev.includes(o.value) ? prev.filter(v => v !== o.value) : [...prev, o.value]
                    )}
                    activeOpacity={0.8}
                  >
                    <Ionicons name={o.icon as any} size={14} color={active ? '#fff' : SUMI} />
                    <Text style={[s.chipText, active && s.chipTextActive]}>{o.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Trip Length */}
            <Text style={s.groupLabel}>Trip Length</Text>
            <View style={s.grid}>
              {LENGTH_OPTIONS.map(o => (
                <TouchableOpacity
                  key={o.value}
                  style={[s.chip, prefLength === o.value && s.chipActive]}
                  onPress={() => setPrefLength(o.value)}
                  activeOpacity={0.8}
                >
                  <Text style={[s.chipText, prefLength === o.value && s.chipTextActive]}>{o.label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[s.saveBtn, { marginHorizontal: 4, marginTop: 8, marginBottom: 24 }]}
              onPress={onSave}
              disabled={saving}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={18} color={WHITE} />
              <Text style={s.saveBtnText}>{saving ? 'Saving…' : 'Save Interests'}</Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(28,20,16,0.55)', justifyContent: 'flex-end' },
  card: {
    backgroundColor: WASHI, borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingHorizontal: 20, maxHeight: '85%',
  },
  handle: {
    width: 36, height: 4, backgroundColor: INK_20, borderRadius: 2,
    alignSelf: 'center', marginTop: 12, marginBottom: 8,
  },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingBottom: 14, borderBottomWidth: 0.5, borderBottomColor: INK_20, marginBottom: 4,
  },
  title: { fontSize: 16, fontWeight: '800', color: SUMI },
  groupLabel: {
    fontSize: 11, fontWeight: '700', color: INK_60,
    letterSpacing: 1.2, textTransform: 'uppercase',
    marginTop: 16, marginBottom: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 6,
    borderWidth: 1.2, borderColor: INK_20, backgroundColor: WASHI_DARK,
  },
  chipActive: { backgroundColor: BENI, borderColor: BENI },
  chipText: { fontSize: 12, fontWeight: '600', color: SUMI },
  chipTextActive: { color: WHITE },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: BENI, borderRadius: 6, paddingVertical: 13,
    shadowColor: BENI, shadowOpacity: 0.35, shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  saveBtnText: { color: WHITE, fontSize: 14, fontWeight: '800', letterSpacing: 0.5 },
});
