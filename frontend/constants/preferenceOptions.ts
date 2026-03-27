// ─── Preference options (mirrors onboarding) ──────────────────────────────────
// Shared by index.tsx (For You section) and profile.tsx (My Interests card).

export const STYLE_OPTIONS = [
  { label: 'Relax & Slow',    value: 'relax',     icon: 'leaf-outline' },
  { label: 'Culture & Art',   value: 'culture',   icon: 'color-palette-outline' },
  { label: 'Food Explorer',   value: 'food',      icon: 'restaurant-outline' },
  { label: 'Adventure',       value: 'adventure', icon: 'bicycle-outline' },
  { label: 'City Hopping',    value: 'city',      icon: 'train-outline' },
  { label: 'Nature & Hiking', value: 'nature',    icon: 'partly-sunny-outline' },
];

export const INTEREST_OPTIONS = [
  { label: 'Temples',     value: 'temples',     icon: 'business-outline' },
  { label: 'Anime',       value: 'anime',       icon: 'game-controller-outline' },
  { label: 'Street Food', value: 'street_food', icon: 'fast-food-outline' },
  { label: 'Shopping',    value: 'shopping',    icon: 'bag-handle-outline' },
  { label: 'Hot Springs', value: 'onsen',       icon: 'water-outline' },
  { label: 'Sakura',      value: 'sakura',      icon: 'flower-outline' },
  { label: 'Night Life',  value: 'night',       icon: 'moon-outline' },
  { label: 'Photography', value: 'photo',       icon: 'camera-outline' },
];

export const LENGTH_OPTIONS = [
  { label: '1–3 Days',  value: 'short' },
  { label: '4–7 Days',  value: 'week' },
  { label: '1–2 Weeks', value: 'twoweek' },
  { label: '1 Month+',  value: 'long' },
];
