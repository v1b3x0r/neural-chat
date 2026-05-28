import { Text, Pressable, StyleSheet } from 'react-native';
import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/icon';

export function DrawerContent(props: DrawerContentComponentProps) {
  const go = (path: string) => { props.navigation.closeDrawer(); (router.push as (p: string) => void)(path); };
  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 24 }}>
      <Text style={styles.section}>Friends</Text>
      {/* P1: real persona list. For now a single default friend (empty system prompt). */}
      <Row icon="persona" label="default" onPress={() => go('/')} />

      <Text style={[styles.section, { marginTop: 16 }]}>App</Text>
      <Row icon="settings" label="Settings" onPress={() => go('/settings')} />
    </DrawerContentScrollView>
  );
}

function Row({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={styles.row}>
      <Icon name={icon} size={20} color="#888" />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  section: { color: '#999', fontSize: 12, paddingHorizontal: 16, paddingVertical: 6, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12 },
  label: { fontSize: 16 },
});
