import { useEffect, useState } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, KeyboardAvoidingView,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, Link } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from 'expo-glass-effect';
import type { Message } from '@nature-labs/living-memory-engine';
import { getEngine } from '@/lib/engine';
import { getChatKey } from '@/lib/config';
import { Icon } from '@/components/icon';

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState(true);
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();

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
      setMessages((await storage.load()).messages);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setMessages((prev) => prev.map((m) => (m.id === tempId ? { ...m, text: '⚠️ ' + msg } : m)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={{ flex: 1 }}>
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
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: insets.top + 56, paddingBottom: 12, gap: 10 }}
            renderItem={({ item }) => <Bubble m={item} />}
          />
        )}
      </View>

      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
        {/* the "invisible div": gradient fades the messages out behind the floating pill */}
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', '#fff']}
          style={styles.gradient}
        />
        {!hasKey && (
          <Link href="/settings" asChild>
            <Pressable style={styles.banner}>
              <Text style={styles.bannerText}>ยังไม่ได้ตั้ง API key — แตะเพื่อตั้งค่า</Text>
            </Pressable>
          </Link>
        )}
        <View style={[styles.composer, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.pill}>
            <TextInput
              style={styles.input}
              value={input}
              onChangeText={setInput}
              placeholder="พิมพ์ยาวๆ ไปเลย..."
              placeholderTextColor="#9a9a9a"
              multiline
            />
          </View>
          <GlassView isInteractive style={styles.sendGlass}>
            <Pressable onPress={send} disabled={busy} style={styles.send}>
              {busy ? <ActivityIndicator color="#fff" /> : <Icon name="send" size={20} color="#fff" />}
            </Pressable>
          </GlassView>
        </View>
      </KeyboardAvoidingView>

      {/* floating hamburger — no header bar */}
      <Pressable
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        hitSlop={12}
        style={[styles.menuWrap, { top: insets.top + 6 }]}
      >
        <GlassView isInteractive style={styles.menuBtn}>
          <Icon name="menu" size={22} color="#333" />
        </GlassView>
      </Pressable>
    </View>
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
  root: { flex: 1, backgroundColor: '#fff' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  greeting: { fontSize: 22, color: '#666', fontWeight: '600' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderCurve: 'continuous' },
  mine: { alignSelf: 'flex-end', backgroundColor: '#7c5cff' },
  theirs: { alignSelf: 'flex-start', backgroundColor: 'rgba(127,127,127,0.16)' },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  mineText: { color: '#fff' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, top: -56 },
  banner: { marginHorizontal: 16, marginBottom: 6, backgroundColor: '#fff3d6', paddingVertical: 9, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center' },
  bannerText: { color: '#8a5a00', fontSize: 13 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingTop: 6, backgroundColor: 'transparent' },
  pill: {
    flex: 1, minHeight: 54, maxHeight: 150, justifyContent: 'center',
    paddingHorizontal: 20, paddingVertical: 6, borderRadius: 28, borderCurve: 'continuous',
    backgroundColor: '#fff', boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
  },
  input: { fontSize: 16, lineHeight: 21, color: '#111' },
  sendGlass: { width: 54, height: 54, borderRadius: 27, borderCurve: 'continuous', overflow: 'hidden' },
  send: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#7c5cff' },
  menuWrap: { position: 'absolute', left: 14 },
  menuBtn: { width: 42, height: 42, borderRadius: 21, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
