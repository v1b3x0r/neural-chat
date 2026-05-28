import { Text, Pressable, StyleSheet } from 'react-native';
import { DrawerContentScrollView, type DrawerContentComponentProps } from '@react-navigation/drawer';
import { router } from 'expo-router';
import { Icon, type IconName } from '@/components/icon';
import { listPersonas, getActivePersona, setActivePersona } from '@/lib/personas';

export function DrawerContent(props: DrawerContentComponentProps) {
  const go = (path: string) => { props.navigation.closeDrawer(); (router.push as (p: string) => void)(path); };
  const personas = listPersonas();
  const activeId = getActivePersona().id;

  const pickPersona = (id: string) => {
    setActivePersona(id); // reactive — chat reloads the right thread
    props.navigation.closeDrawer();
  };

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 24 }}>
      <Text style={styles.section}>Friends</Text>
      {personas.map((p) => {
        const active = p.id === activeId;
        return (
          <Pressable key={p.id} onPress={() => pickPersona(p.id)} style={[styles.row, active && styles.activeRow]}>
            <Icon name="persona" size={20} color={active ? '#7c5cff' : '#888'} />
            <Text style={[styles.label, active && styles.activeLabel]} numberOfLines={1}>{p.name}</Text>
          </Pressable>
        );
      })}
      <Pressable onPress={() => go('/new-persona')} style={styles.row}>
        <Icon name="add" size={20} color="#888" />
        <Text style={styles.label}>สร้างเพื่อน</Text>
      </Pressable>

      <Text style={[styles.section, { marginTop: 16 }]}>App</Text>
      <Row icon="models" label="Models" onPress={() => go('/models')} />
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
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12, borderCurve: 'continuous' },
  activeRow: { backgroundColor: 'rgba(124,92,255,0.10)' },
  label: { fontSize: 16, color: '#222' },
  activeLabel: { color: '#7c5cff', fontWeight: '600' },
});
