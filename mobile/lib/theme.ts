import { useColorScheme } from 'react-native';

export interface Palette {
  bg: string;           // top of the ambient gradient
  ambient: string;      // bottom of the ambient gradient (glow)
  surface: string;      // cards / inputs / frosted-fallback
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
  bg: '#faf7f2', ambient: '#f1e7d8', surface: '#efe9df', text: '#2b2926', subtext: '#6a655d', faint: '#a8a29a',
  accent: '#7c5cff', onAccent: '#ffffff', theirsBg: '#ece6dc', theirsText: '#2b2926',
  badgeBg: 'rgba(0,0,0,0.05)', badgeText: '#6a655d', border: '#d8d0c4', glassIcon: '#3a3631',
};

const dark: Palette = {
  bg: '#0d0d10', ambient: '#231a47', surface: '#1c1c22', text: '#f2f2f2', subtext: '#a6a6a6', faint: '#6f6f6f',
  accent: '#8b6dff', onAccent: '#ffffff', theirsBg: '#222230', theirsText: '#f0f0f0',
  badgeBg: 'rgba(255,255,255,0.08)', badgeText: '#9a9a9a', border: '#3a3a44', glassIcon: '#e8e8e8',
};

export function usePalette(): Palette {
  return useColorScheme() === 'dark' ? dark : light;
}
