import { useColorScheme } from 'react-native';

export interface Palette {
  bg: string;
  surface: string;      // cards / inputs
  text: string;
  subtext: string;
  faint: string;
  accent: string;
  onAccent: string;
  theirsBg: string;     // model bubble
  theirsText: string;
  badgeBg: string;
  badgeText: string;
  border: string;
  glassIcon: string;
}

const light: Palette = {
  bg: '#ffffff', surface: '#f1f1f3', text: '#111111', subtext: '#666666', faint: '#a8a8a8',
  accent: '#7c5cff', onAccent: '#ffffff', theirsBg: '#ececee', theirsText: '#111111',
  badgeBg: 'rgba(0,0,0,0.06)', badgeText: '#777777', border: '#cccccc', glassIcon: '#333333',
};

const dark: Palette = {
  bg: '#0d0d10', surface: '#1c1c20', text: '#f2f2f2', subtext: '#a6a6a6', faint: '#6f6f6f',
  accent: '#8b6dff', onAccent: '#ffffff', theirsBg: '#232327', theirsText: '#f0f0f0',
  badgeBg: 'rgba(255,255,255,0.09)', badgeText: '#9a9a9a', border: '#3a3a40', glassIcon: '#e8e8e8',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
