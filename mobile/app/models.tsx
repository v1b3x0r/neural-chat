import { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fetchModels, type ModelInfo } from '@/lib/models';
import { getStarredModels, setStarredModels, getActiveModel, setActiveModel } from '@/lib/config';
import { resetEngines } from '@/lib/engine';

export default function Models() {
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
    <View style={styles.root}>
      <TextInput
        style={styles.search}
        placeholder="ค้นหา model..."
        placeholderTextColor="#999"
        value={q}
        onChangeText={setQ}
        autoCapitalize="none"
        autoCorrect={false}
      />
      {loading ? (
        <ActivityIndicator style={{ marginTop: 40 }} />
      ) : err ? (
        <Text style={styles.err}>โหลด model ไม่ได้: {err}</Text>
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
              <View style={styles.row}>
                <Pressable style={{ flex: 1 }} onPress={() => choose(item.id)}>
                  <Text style={[styles.id, isActive && styles.activeId]} numberOfLines={1}>
                    {isActive ? '✓ ' : ''}{item.id}
                  </Text>
                  <Text style={styles.name} numberOfLines={1}>{item.name}</Text>
                </Pressable>
                <Pressable onPress={() => toggleStar(item.id)} hitSlop={12} style={styles.star}>
                  <Ionicons name={isStar ? 'star' : 'star-outline'} size={22} color={isStar ? '#f5b301' : '#c4c4c4'} />
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
  search: {
    margin: 12, paddingHorizontal: 16, paddingVertical: 11, fontSize: 16,
    borderRadius: 22, borderCurve: 'continuous', backgroundColor: 'rgba(127,127,127,0.12)',
  },
  err: { textAlign: 'center', marginTop: 40, color: '#c0392b', paddingHorizontal: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(127,127,127,0.15)' },
  id: { fontSize: 15, fontWeight: '500' },
  activeId: { color: '#7c5cff' },
  name: { fontSize: 12, color: '#999', marginTop: 2 },
  star: { padding: 2 },
});
