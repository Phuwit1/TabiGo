import React from 'react';
import { View, Text, StyleSheet, Platform, StatusBar } from 'react-native';

// ─── Japanese Palette ─────────────────────────────────────────────────────────
const SUMI         = '#1C1410';
const BENI         = '#C0392B';
const KINCHA       = '#B8963E';
const KINCHA_LIGHT = '#D4AF55';
const WHITE        = '#FFFFFF';

export default function TopBar() {
  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor={SUMI} />
      <View style={s.container}>
        {/* 3px Beni top accent — shared across all screens */}
        <View style={s.topAccent} />

        <View style={s.inner}>

        </View>

        {/* Kincha ✦ bottom rule */}
        <View style={s.bottomRule}>
          <View style={s.ruleLine} />
          <Text style={s.ruleDot}>✦</Text>
          <View style={s.ruleLine} />
        </View>
      </View>
    </>
  );
}

const s = StyleSheet.create({
  container: {
    backgroundColor: SUMI,
    paddingTop: Platform.OS === 'ios' ? 52 : (StatusBar.currentHeight ?? 24) + 6,
  },
  topAccent: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    height: 3,
    backgroundColor: BENI,
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 10,
    gap: 10,
  },
  logoMark: {
    width: 28,
    height: 28,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: 'rgba(184,150,62,0.45)',
    backgroundColor: 'rgba(184,150,62,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoKanji: {
    fontSize: 13,
    color: KINCHA_LIGHT,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: WHITE,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  bottomRule: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingBottom: 7,
  },
  ruleLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: KINCHA,
    opacity: 0.3,
  },
  ruleDot: {
    fontSize: 7,
    color: KINCHA,
    marginHorizontal: 7,
    opacity: 0.45,
  },
});