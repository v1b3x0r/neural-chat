import { type ReactNode } from 'react';
import { Platform, View, type ViewStyle } from 'react-native';
import { GlassView } from 'expo-glass-effect';

// iOS 26 gets real liquid-glass (progressive blur of whatever's behind);
// everywhere else falls back to a solid surface.
export function Frosted({ style, solid, children }: { style?: ViewStyle | ViewStyle[]; solid: string; children?: ReactNode }) {
  if (Platform.OS === 'ios') {
    return <GlassView style={style}>{children}</GlassView>;
  }
  return <View style={[style, { backgroundColor: solid }]}>{children}</View>;
}
