import { Modal, View, Text, Pressable, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePalette } from '@/lib/theme';

export interface SheetAction { label: string; onPress: () => void; destructive?: boolean; }

// A bottom action sheet — the Expo Go-compatible stand-in for a native context menu.
export function ActionSheet({ visible, onClose, actions }: { visible: boolean; onClose: () => void; actions: SheetAction[] }) {
  const c = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.surface, paddingBottom: insets.bottom + 8 }]} onPress={() => {}}>
          <View style={[styles.grabber, { backgroundColor: c.faint }]} />
          {actions.map((a, i) => (
            <Pressable key={i} onPress={() => { onClose(); a.onPress(); }} style={styles.row}>
              <Text style={[styles.label, { color: a.destructive ? '#ff5a5f' : c.text }]}>{a.label}</Text>
            </Pressable>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 22, borderTopRightRadius: 22, borderCurve: 'continuous', paddingTop: 6, paddingHorizontal: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginVertical: 8, opacity: 0.5 },
  row: { paddingVertical: 15, paddingHorizontal: 16, borderRadius: 12, borderCurve: 'continuous' },
  label: { fontSize: 17, fontWeight: '500' },
});
