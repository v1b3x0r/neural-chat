import { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { addPersona, setActivePersona } from '@/lib/personas';
import { usePalette } from '@/lib/theme';

export default function NewPersona() {
  const c = usePalette();
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');

  const create = () => {
    if (!name.trim()) return;
    const p = addPersona(name, prompt);
    setActivePersona(p.id);
    router.back();
  };

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 16 }} contentInsetAdjustmentBehavior="automatic">
      <Text style={[styles.hint, { color: c.subtext }]}>สร้างเพื่อนใหม่ — ความจำแยกจากคนอื่น 100%</Text>

      <View style={{ gap: 6 }}>
        <Text style={[styles.label, { color: c.subtext }]}>ชื่อ</Text>
        <TextInput
          style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          value={name}
          onChangeText={setName}
          placeholder="เช่น หมอ, เพื่อนซี้"
          placeholderTextColor={c.faint}
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={[styles.label, { color: c.subtext }]}>System prompt — เว้นว่างได้ (ตัวตนงอกเอง)</Text>
        <TextInput
          style={[styles.input, styles.multiline, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="อยากให้เป็นใคร / เว้นว่างเพื่อให้ emerge เอง"
          placeholderTextColor={c.faint}
          multiline
        />
      </View>

      <Pressable onPress={create} disabled={!name.trim()} style={[styles.create, { backgroundColor: c.accent }, !name.trim() && { opacity: 0.4 }]}>
        <Text style={[styles.createText, { color: c.onAccent }]}>สร้าง</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13 },
  label: { fontSize: 13 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, borderCurve: 'continuous', paddingHorizontal: 12, paddingVertical: 10, fontSize: 15 },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  create: { paddingVertical: 14, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center' },
  createText: { fontSize: 16, fontWeight: '600' },
});
