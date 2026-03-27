import type { PropsWithChildren, ReactElement } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  interpolate,
  useAnimatedRef,
  useAnimatedStyle,
  useScrollViewOffset,
} from 'react-native-reanimated';
import { useBottomTabOverflow } from '@/components/ui/TabBarBackground';

const WASHI_DARK = '#EDE5D8';
const SUMI       = '#1C1410';

type Props = PropsWithChildren<{
  headerImage: ReactElement;
  headerBackgroundColor: { dark: string; light: string };
  headerHeight?: number;
}>;

export default function ParallaxScrollView({
  children,
  headerImage,
  headerBackgroundColor,
  headerHeight = 340,
}: Props) {
  const scrollRef    = useAnimatedRef<Animated.ScrollView>();
  const scrollOffset = useScrollViewOffset(scrollRef);
  const bottom       = useBottomTabOverflow();

  const headerAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateY: interpolate(
          scrollOffset.value,
          [-headerHeight, 0, headerHeight],
          [-headerHeight / 2, 0, headerHeight * 0.75]
        ),
      },
      {
        scale: interpolate(
          scrollOffset.value,
          [-headerHeight, 0, headerHeight],
          [2, 1, 1]
        ),
      },
    ],
  }));

  return (
    <Animated.View style={s.container}>
      <Animated.ScrollView
        ref={scrollRef}
        scrollEventThrottle={16}
        scrollIndicatorInsets={{ bottom }}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottom }}
      >
        {/* ── Parallax header ── */}
        <Animated.View
          style={[
            {
              height: headerHeight,
              backgroundColor: SUMI,
              overflow: 'hidden',
            },
            headerAnimatedStyle,
          ]}
        >
          {headerImage}
        </Animated.View>

        {/* ── Body — no padding, no ThemedView ── */}
        <Animated.View style={s.content}>
          {children}
        </Animated.View>
      </Animated.ScrollView>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SUMI,  // ป้องกันขอบขาวระหว่าง header กับ body
  },
  content: {
    flex: 1,
    backgroundColor: WASHI_DARK,  // ธีม Washi cream เหมือนทุกหน้า
    overflow: 'hidden',
    // ไม่มี padding — แต่ละ section จัดการ padding เอง
  },
});