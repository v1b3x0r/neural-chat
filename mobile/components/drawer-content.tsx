import { Text, Pressable, StyleSheet } from 'react-native';
import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/icon';
import { listPersonas, getActivePersona, setActivePersona } from '@/lib/personas';
import { usePalette } from '@/lib/theme';

export function DrawerContent(props: DrawerContentComponentProps) {
  const c = usePalette();
  const go = (path: string) => { props.navigation.closeDrawer(); (router.push as (p: string) => void)(path); };
  const personas = listPersonas();
  const activeId = getActivePersona().id;

  const pickPersona = (id: string) => {
    setActivePersona(id);
    (props.navigation as unknown as { navigate: (n: string) => void }).navigate('index');
  };

  const Row = ({ icon, label, onPress, active }: { icon: IconName; label: string; onPress: () => void; active?: boolean }) => (
    <Pressable onPress={onPress} style={[styles.row, active && { backgroundColor: c.accent + '1f' }]}>
      <Icon name={icon} size={20} color={active ? c.accent : c.subtext} />
      <Text style={[styles.label, { color: active ? c.accent : c.text }, active && styles.activeLabel]} numberOfLines={1}>{label}</Text>
    </Pressable>
  );

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 24 }}>
      <Text style={[styles.section, { color: c.subtext }]}>Friends</Text>
      {personas.map((p) => (
        <Row key={p.id} icon="persona" label={p.name} active={p.id === activeId} onPress={() => pickPersona(p.id)} />
      ))}
      <Row icon="add" label="สร้างเพื่อน" onPress={() => go('/new-persona')} />

      <Text style={[styles.section, { color: c.subtext, marginTop: 16 }]}>App</Text>
      <Row icon="models" label="Models" onPress={() => go('/models')} />
      <Row icon="settings" label="Settings" onPress={() => go('/settings')} />
    </DrawerContentScrollView>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 12, paddingHorizontal: 16, paddingVertical: 6, textTransform: 'uppercase', letterSpacing: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderCurve: 'continuous' },
  label: { fontSize: 16 },
  activeLabel: { fontWeight: '600' },
});
