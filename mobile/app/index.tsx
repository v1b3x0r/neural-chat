import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, KeyboardAvoidingView,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHeaderHeight } from '@react-navigation/elements';
import { GlassView } from 'expo-glass-effect';
import { Link } from 'expo-router';
import { Icon } from '@/components/icon';
import type { Message } from '@nature-labs/living-memory-engine';
import { getEngine } from '@/lib/engine';
import { getChatKey } from '@/lib/config';

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState(true);
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();

  useEffect(() => {
    (async () => {
      const { engine, storage } = await getEngine();
      setMessages((await storage.load()).messages);
      setHasKey(!!(await getChatKey()));
      try { await engine.tick(); } catch { /* deep tick on open; ignore offline */ }
    })();
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    setBusy(true);
    const { engine, storage } = await getEngine();
    const tempId = 'tmp-' + Date.now();
    setMessages((prev) => [
      ...prev,
      { id: 'u-' + Date.now(), role: 'user', text, ts: Date.now() },
      { id: tempId, role: 'model', text: '', ts: Date.now() + 1 },
    ]);
    try {
      let acc = '';
      for await (const chunk of engine.respond(text)) {
        acc += chunk;
        setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, text: acc } : m)));
      }
      setMessages((await storage.load()).messages); // reconcile with stored ids
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, text: '⚠️ ' + msg } : m)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior="padding"
      keyboardVerticalOffset={headerHeight}
    >
      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="sparkles" size={44} color="#7c5cff" />
          <Text style={styles.greeting}>คุยอะไรดี</Text>
        </View>
      ) : (
        <FlatList
          data={[...messages].reverse()}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          renderItem={({ item }) => <Bubble m={item} />}
        />
      )}

      {!hasKey && (
        <Link href="/settings" asChild>
          <Pressable style={styles.banner}>
            <Text style={styles.bannerText}>ยังไม่ได้ตั้ง API key — แตะเพื่อตั้งค่า</Text>
          </Pressable>
        </Link>
      )}

      <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="พิมพ์ยาวๆ ไปเลย..."
          placeholderTextColor="#999"
          multiline
        />
        <GlassView isInteractive style={styles.sendGlass}>
          <Pressable onPress={send} disabled={busy} style={styles.send}>
            {busy ? <ActivityIndicator color="#fff" /> : <Icon name="send" size={20} color="#fff" />}
          </Pressable>
        </GlassView>
      </View>
    </KeyboardAvoidingView>
  );
}

function Bubble({ m }: { m: Message }) {
  const mine = m.role === 'user';
  return (
    <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
      <Text selectable style={[styles.bubbleText, mine && styles.mineText]}>{m.text || '…'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  greeting: { fontSize: 22, color: '#666', fontWeight: '600' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderCurve: 'continuous' },
  mine: { alignSelf: 'flex-end', backgroundColor: '#7c5cff' },
  theirs: { alignSelf: 'flex-start', backgroundColor: 'rgba(127,127,127,0.16)' },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  mineText: { color: '#fff' },
  banner: { backgroundColor: '#ffefd5', paddingVertical: 10, alignItems: 'center' },
  bannerText: { color: '#8a5a00', fontSize: 13 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8, paddingHorizontal: 12, paddingTop: 8 },
  input: {
    flex: 1, minHeight: 44, maxHeight: 140, paddingHorizontal: 16, paddingVertical: 11,
    borderRadius: 22, borderCurve: 'continuous', backgroundColor: 'rgba(127,127,127,0.12)', fontSize: 16,
  },
  sendGlass: { borderRadius: 22, borderCurve: 'continuous', overflow: 'hidden' },
  send: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7c5cff' },
});
