import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, KeyboardAvoidingView,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, Link, router, useFocusEffect } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from 'expo-glass-effect';
import type { Message } from '@nature-labs/living-memory-engine';
import { getEngine } from '@/lib/engine';
import { getChatKey, getActiveModel } from '@/lib/config';
import { shortModel } from '@/lib/models';
import { getActivePersona, getActivePersonaId, subscribeActivePersona } from '@/lib/personas';
import { usePalette } from '@/lib/theme';
import { Icon } from '@/components/icon';
import { ActionSheet, type SheetAction } from '@/components/action-sheet';

const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

function timeLabel(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
function dayKey(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}
function dateLabel(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const startOf = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const diffDays = Math.round((startOf(now) - startOf(d)) / 86_400_000);
  if (diffDays === 0) return 'วันนี้';
  if (diffDays === 1) return 'เมื่อวาน';
  const base = `${d.getDate()} ${TH_MONTHS[d.getMonth()]}`;
  return d.getFullYear() !== now.getFullYear() ? `${base} ${d.getFullYear()}` : base;
}

type Row = { type: 'date'; key: string; ts: number } | { type: 'msg'; key: string; m: Message };
function buildRows(messages: Message[]): Row[] {
  const rows: Row[] = [];
  let lastDay = '';
  for (const m of messages) {
    const k = dayKey(m.ts);
    if (k !== lastDay) { rows.push({ type: 'date', key: 'd-' + k, ts: m.ts }); lastDay = k; }
    rows.push({ type: 'msg', key: m.id, m });
  }
  return rows;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [hasKey, setHasKey] = useState(true);
  const [model, setModel] = useState(getActiveModel());
  const [sheet, setSheet] = useState<SheetAction[] | null>(null);
  const activeId = useSyncExternalStore(subscribeActivePersona, getActivePersonaId, getActivePersonaId);
  const persona = getActivePersona();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const c = usePalette();

  const eng = () => getEngine(persona.id, persona.systemPrompt);

  useEffect(() => {
    (async () => {
      const { engine, storage } = await eng();
      setMessages((await storage.load()).messages);
      try { await engine.tick(); } catch { /* deep tick on open; ignore offline */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  useFocusEffect(useCallback(() => {
    setModel(getActiveModel());
    (async () => setHasKey(!!(await getChatKey())))();
  }, []));

  const refresh = async () => {
    const { storage } = await eng();
    setMessages((await storage.load()).messages);
  };

  const streamRespond = async (text: string) => {
    setBusy(true);
    const { engine, storage } = await eng();
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

  const send = () => {
    const text = input.trim();
    if (!text || busy) return;
    setInput('');
    streamRespond(text);
  };

  const retry = async (modelMsg: Message) => {
    if (busy) return;
    const { engine, storage } = await eng();
    const msgs = (await storage.load()).messages;
    const idx = msgs.findIndex((m) => m.id === modelMsg.id);
    let user: Message | undefined;
    for (let i = idx; i >= 0; i--) { if (msgs[i]!.role === 'user') { user = msgs[i]; break; } }
    if (!user) return;
    await engine.rewindTo(user.id);
    await refresh();
    streamRespond(user.text);
  };

  const onLongPress = (m: Message) => {
    if (busy || m.text === '') return;
    if (m.role === 'user') {
      setSheet([
        { label: '✏️  แก้ไข', onPress: async () => { const { engine } = await eng(); await engine.rewindTo(m.id); await refresh(); setInput(m.text); } },
        { label: '⏪  ย้อนมาตรงนี้', destructive: true, onPress: async () => { const { engine } = await eng(); await engine.rewindTo(m.id); await refresh(); } },
      ]);
    } else {
      setSheet([{ label: '↻  ลองใหม่', onPress: () => retry(m) }]);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: c.bg }]}>
      <View style={{ flex: 1 }}>
        {messages.length === 0 ? (
          <View style={styles.empty}>
            <Icon name="sparkles" size={44} color={c.accent} />
            <Text style={[styles.greeting, { color: c.subtext }]}>คุยอะไรดี</Text>
          </View>
        ) : (
          <FlatList
            data={[...buildRows(messages)].reverse()}
            inverted
            keyExtractor={(r) => r.key}
            contentContainerStyle={{ paddingHorizontal: 12, paddingTop: insets.top + 56, paddingBottom: 12, gap: 8 }}
            renderItem={({ item }) =>
              item.type === 'date' ? (
                <DateBadge label={dateLabel(item.ts)} />
              ) : (
                <Pressable onLongPress={() => onLongPress(item.m)} delayLongPress={280}>
                  <Bubble m={item.m} />
                </Pressable>
              )
            }
          />
        )}
      </View>

      <KeyboardAvoidingView behavior="padding" keyboardVerticalOffset={0}>
        <LinearGradient
          pointerEvents="none"
          colors={[c.bg + '00', c.bg + 'd9', c.bg]}
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
          <View style={[styles.pill, { backgroundColor: c.surface }]}>
            <TextInput
              style={[styles.input, { color: c.text }]}
              value={input}
              onChangeText={setInput}
              placeholder="พิมพ์ยาวๆ ไปเลย..."
              placeholderTextColor={c.faint}
              multiline
            />
          </View>
          <GlassView isInteractive style={styles.sendGlass}>
            <Pressable onPress={send} disabled={busy} style={[styles.send, { backgroundColor: c.accent }]}>
              {busy ? <ActivityIndicator color={c.onAccent} /> : <Icon name="send" size={20} color={c.onAccent} />}
            </Pressable>
          </GlassView>
        </View>
      </KeyboardAvoidingView>

      <Pressable
        onPress={() => navigation.dispatch(DrawerActions.openDrawer())}
        hitSlop={12}
        style={[styles.menuWrap, { top: insets.top + 6 }]}
      >
        <GlassView isInteractive style={styles.menuBtn}>
          <Icon name="menu" size={22} color={c.glassIcon} />
        </GlassView>
      </Pressable>

      <View pointerEvents="box-none" style={[styles.topCenter, { top: insets.top + 8 }]}>
        <Pressable onPress={() => router.push('/models')} hitSlop={8} style={[styles.modelChip, { backgroundColor: c.badgeBg }]}>
          <Text style={[styles.modelChipText, { color: c.subtext }]} numberOfLines={1}>{shortModel(model)} ▾</Text>
        </Pressable>
      </View>

      <ActionSheet visible={!!sheet} actions={sheet ?? []} onClose={() => setSheet(null)} />
    </View>
  );
}

function DateBadge({ label }: { label: string }) {
  const c = usePalette();
  return (
    <View style={styles.dateWrap}>
      <Text style={[styles.dateBadge, { backgroundColor: c.badgeBg, color: c.badgeText }]}>{label}</Text>
    </View>
  );
}

function Bubble({ m }: { m: Message }) {
  const c = usePalette();
  const mine = m.role === 'user';
  return (
    <View style={{ width: '100%', alignItems: mine ? 'flex-end' : 'flex-start' }}>
      <View style={[styles.bubble, { backgroundColor: mine ? c.accent : c.theirsBg }]}>
        <Text selectable style={[styles.bubbleText, { color: mine ? c.onAccent : c.theirsText }]}>{m.text || '…'}</Text>
      </View>
      <Text style={[styles.time, { color: c.faint }]}>{timeLabel(m.ts)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  greeting: { fontSize: 22, fontWeight: '600' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderCurve: 'continuous' },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  time: { fontSize: 11, marginTop: 3, marginHorizontal: 4 },
  dateWrap: { alignItems: 'center', paddingVertical: 8 },
  dateBadge: { fontSize: 12, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderCurve: 'continuous', overflow: 'hidden' },
  gradient: { position: 'absolute', left: 0, right: 0, bottom: 0, top: -56 },
  banner: { marginHorizontal: 16, marginBottom: 6, backgroundColor: '#fff3d6', paddingVertical: 9, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center' },
  bannerText: { color: '#8a5a00', fontSize: 13 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 14, paddingTop: 6, backgroundColor: 'transparent' },
  pill: {
    flex: 1, minHeight: 54, maxHeight: 150, justifyContent: 'center',
    paddingHorizontal: 20, paddingVertical: 6, borderRadius: 28, borderCurve: 'continuous',
    boxShadow: '0 2px 16px rgba(0,0,0,0.10)',
  },
  input: { fontSize: 16, lineHeight: 21 },
  sendGlass: { width: 54, height: 54, borderRadius: 27, borderCurve: 'continuous', overflow: 'hidden' },
  send: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  menuWrap: { position: 'absolute', left: 14 },
  menuBtn: { width: 42, height: 42, borderRadius: 21, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  topCenter: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  modelChip: { maxWidth: '60%', paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderCurve: 'continuous' },
  modelChipText: { fontSize: 14, fontWeight: '600' },
});
