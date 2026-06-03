import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import {
  View, Text, TextInput, FlatList, Pressable, Keyboard, Platform,
  ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, Link, router, useFocusEffect } from 'expo-router';
import { DrawerActions } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassView } from 'expo-glass-effect';
import * as Clipboard from 'expo-clipboard';
import type { Message } from '@nature-labs/living-memory-engine';
import { getEngine } from '@/lib/engine';
import { getChatKey, getActiveModel } from '@/lib/config';
import { shortModel } from '@/lib/models';
import { getActivePersona, getActivePersonaId, subscribeActivePersona } from '@/lib/personas';
import { usePalette } from '@/lib/theme';
import { Icon } from '@/components/icon';
import { Frosted } from '@/components/frosted';
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
  const [editing, setEditing] = useState<Message | null>(null);
  const [kb, setKb] = useState(0);
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

  // Track keyboard height to lift the floating composer above it (KeyboardAvoidingView
  // doesn't move an absolutely-positioned overlay).
  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const s = Keyboard.addListener(showEvt, (e) => setKb(e.endCoordinates.height));
    const h = Keyboard.addListener(hideEvt, () => setKb(0));
    return () => { s.remove(); h.remove(); };
  }, []);

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
    if (editing) {
      const target = editing;
      setEditing(null);
      (async () => { const { engine } = await eng(); await engine.rewindTo(target.id); await refresh(); streamRespond(text); })();
    } else {
      streamRespond(text);
    }
  };

  const cancelEdit = () => { setEditing(null); setInput(''); };

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
    const copy: SheetAction = { label: '📋  คัดลอก', onPress: () => { Clipboard.setStringAsync(m.text); } };
    if (m.role === 'user') {
      setSheet([
        copy,
        { label: '✏️  แก้ไข', onPress: () => { setEditing(m); setInput(m.text); } },
        { label: '⏪  ย้อนมาตรงนี้', destructive: true, onPress: async () => { const { engine } = await eng(); await engine.rewindTo(m.id); await refresh(); } },
      ]);
    } else {
      setSheet([copy, { label: '↻  ลองใหม่', onPress: () => retry(m) }]);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      {/* ambient gradient: glow at the bottom fading up into the bg */}
      <LinearGradient pointerEvents="none" colors={[c.bg, c.bg, c.ambient]} style={StyleSheet.absoluteFill} />

      {messages.length === 0 ? (
        <View style={styles.empty}>
          <Icon name="sparkles" size={44} color={c.accent} />
          <Text style={[styles.greeting, { color: c.subtext }]}>คุยอะไรดี</Text>
        </View>
      ) : (
        <FlatList
          style={{ flex: 1 }}
          data={[...buildRows(messages)].reverse()}
          inverted
          keyExtractor={(r) => r.key}
          keyboardDismissMode="interactive"
          contentContainerStyle={{ paddingHorizontal: 12, paddingTop: insets.top + 56, paddingBottom: insets.bottom + 96 + kb, gap: 8 }}
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

      {/* floating composer — messages scroll behind it, edge-to-edge */}
      <View pointerEvents="box-none" style={[styles.composerOverlay, { bottom: kb }]}>
        {!hasKey && (
          <Link href="/settings" asChild>
            <Pressable style={styles.banner}>
              <Text style={styles.bannerText}>ยังไม่ได้ตั้ง API key — แตะเพื่อตั้งค่า</Text>
            </Pressable>
          </Link>
        )}
        {editing && (
          <View style={[styles.editBar, { backgroundColor: c.badgeBg }]}>
            <Text style={[styles.editText, { color: c.subtext }]} numberOfLines={1}>แก้ไข: {editing.text}</Text>
            <Pressable onPress={cancelEdit} hitSlop={8}><Text style={[styles.editCancel, { color: c.accent }]}>ยกเลิก</Text></Pressable>
          </View>
        )}
        <View style={[styles.composerWrap, { paddingBottom: kb > 0 ? 12 : insets.bottom + 10 }]}>
          <Frosted solid={c.surface} style={styles.pill}>
            <TextInput
              style={[styles.input, { color: c.text }]}
              value={input}
              onChangeText={setInput}
              placeholder="พิมพ์ยาวๆ ไปเลย..."
              placeholderTextColor={c.subtext}
              multiline
            />
            <Pressable onPress={send} disabled={busy} style={[styles.sendBtn, { backgroundColor: c.accent }]}>
              {busy ? <ActivityIndicator color={c.onAccent} /> : <Icon name="send" size={20} color={c.onAccent} />}
            </Pressable>
          </Frosted>
        </View>
      </View>

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
        <Pressable onPress={() => router.push('/models')} hitSlop={8}>
          <Frosted solid={c.surface} style={styles.modelChip}>
            <Text style={[styles.modelChipText, { color: c.text }]} numberOfLines={1}>{shortModel(model)} ▾</Text>
          </Frosted>
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
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  greeting: { fontSize: 22, fontWeight: '600' },
  bubble: { maxWidth: '82%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, borderCurve: 'continuous' },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  time: { fontSize: 11, marginTop: 3, marginHorizontal: 4 },
  dateWrap: { alignItems: 'center', paddingVertical: 8 },
  dateBadge: { fontSize: 12, paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, borderCurve: 'continuous', overflow: 'hidden' },
  banner: { marginHorizontal: 16, marginBottom: 6, backgroundColor: '#fff3d6', paddingVertical: 9, borderRadius: 14, borderCurve: 'continuous', alignItems: 'center' },
  bannerText: { color: '#8a5a00', fontSize: 13 },
  editBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginHorizontal: 16, marginBottom: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 14, borderCurve: 'continuous' },
  editText: { flex: 1, fontSize: 13 },
  editCancel: { fontSize: 13, fontWeight: '700' },
  composerOverlay: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  composerWrap: { paddingHorizontal: 12, paddingTop: 4 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 58,
    paddingLeft: 22, paddingRight: 8, paddingVertical: 9,
    borderRadius: 30, borderCurve: 'continuous', overflow: 'hidden',
    boxShadow: '0 4px 24px rgba(0,0,0,0.14)',
  },
  input: { flex: 1, fontSize: 16, lineHeight: 22, paddingTop: 0, paddingBottom: 0, maxHeight: 140 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center' },
  menuWrap: { position: 'absolute', left: 14 },
  menuBtn: { width: 42, height: 42, borderRadius: 21, borderCurve: 'continuous', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  topCenter: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  modelChip: { maxWidth: 240, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 16, borderCurve: 'continuous', overflow: 'hidden' },
  modelChipText: { fontSize: 14, fontWeight: '600' },
});
