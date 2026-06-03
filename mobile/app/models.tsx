import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchModels, type ModelInfo } from '@/lib/models';
import { getStarredModels, setStarredModels, getActiveModel, setActiveModel } from '@/lib/config';
import { resetEngines } from '@/lib/engine';
import { usePalette } from '@/lib/theme';

export default function Models() {
  const c = usePalette();
  const [all, setAll] = useState<ModelInfo[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [starred, setStarred] = useState<string[]>(getStarredModels());
  const [active, setActive] = useState(getActiveModel());

  useEffect(() => {
    (async () => {
      try { setAll(await fetchModels()); }
      catch (e: unknown) { setErr(e instanceof Error ? e.message : String(e)); }
      finally { setLoading(false); }
    })();
  }, []);

  const toggleStar = (id: string) => {
    const next = starred.includes(id) ? starred.filter((x) => x !== id) : [...starred, id];
    setStarredModels(next);
    setStarred(next);
  };

  const choose = (id: string) => {
    setActiveModel(id);
    setActive(id);
    resetEngines();
    router.back();
  };

  const list = useMemo(() => {
    const f = q.trim().toLowerCase();
    const filtered = f ? all.filter((m) => m.id.toLowerCase().includes(f) || m.name.toLowerCase().includes(f)) : all;
    return [...filtered].sort((a, b) => (starred.includes(b.id) ? 1 : 0) - (starred.includes(a.id) ? 1 : 0));
  }, [all, q, starred]);

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <TextInput
        style={[styles.search, { backgroundColor: c.surface, color: c.text }]}
        placeholder="ค้นหา model..."
        placeholderTextColor={c.faint}
        value={q}
        onChangeText={setQ}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} color={c.accent} />
      ) : err ? (
        <Text style={[styles.err, { color: '#e0564b' }]}>โหลด model ไม่ได้: {err}</Text>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(m) => m.id}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled"
          renderItem={({ item }) => {
            const isActive = item.id === active;
            const isStar = starred.includes(item.id);
            return (
              <View style={[styles.row, { borderBottomColor: c.border }]}>
                <Pressable style={{ flex: 1 }} onPress={() => choose(item.id)}>
                  <Text style={[styles.id, { color: isActive ? c.accent : c.text }]} numberOfLines={1}>
                    {isActive ? '✓ ' : ''}{item.id}
                  </Text>
                  <Text style={[styles.name, { color: c.subtext }]} numberOfLines={1}>{item.name}</Text>
                </Pressable>
                <Pressable onPress={() => toggleStar(item.id)} hitSlop={12} style={styles.star}>
                  <Ionicons name={isStar ? 'star' : 'star-outline'} size={22} color={isStar ? '#f5b301' : c.faint} />
                </Pressable>
              </View>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  search: { margin: 12, paddingHorizontal: 16, paddingVertical: 11, fontSize: 16, borderRadius: 22, borderCurve: 'continuous' },
  err: { textAlign: 'center', marginTop: 40, paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  id: { fontSize: 15, fontWeight: '500' },
  name: { fontSize: 12, marginTop: 2 },
  star: { padding: 2 },
});
