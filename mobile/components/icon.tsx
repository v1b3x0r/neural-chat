import { type ComponentProps } from 'react';
import { Platform } from 'react-native';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { Ionicons } from '@expo/vector-icons';

export type IconName = 'send' | 'sparkles' | 'persona' | 'settings' | 'menu' | 'models';

const MAP: Record<IconName, { sf: SymbolViewProps['name']; ion: ComponentProps<typeof Ionicons>['name'] }> = {
  send: { sf: 'arrow.up', ion: 'arrow-up' },
  sparkles: { sf: 'sparkles', ion: 'sparkles' },
  persona: { sf: 'person.crop.circle', ion: 'person-circle-outline' },
  settings: { sf: 'gearshape', ion: 'settings-outline' },
  menu: { sf: 'line.3.horizontal', ion: 'menu' },
  models: { sf: 'square.stack.3d.up', ion: 'layers-outline' },
};

// iOS renders native SF Symbols (faithful to the iPhone target);
// Android falls back to Ionicons so the Android debug loop isn't blank.
export function Icon({ name, size = 22, color = '#888' }: { name: IconName; size?: number; color?: string }) {
  const m = MAP[name];
  if (Platform.OS === 'ios') return <SymbolView name={m.sf} size={size} tintColor={color} />;
  return <Ionicons name={m.ion} size={size} color={color} />;
}
