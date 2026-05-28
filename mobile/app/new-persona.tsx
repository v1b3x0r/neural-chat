import { useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { addPersona, setActivePersona } from '@/lib/personas';

export default function NewPersona() {
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');

  const create = () => {
    if (!name.trim()) return;
    const p = addPersona(name, prompt);
    setActivePersona(p.id); // reactive — chat switches to the new friend
    router.back();
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }} contentInsetAdjustmentBehavior="automatic">
      <Text style={styles.hint}>สร้างเพื่อนใหม่ — ความจำแยกจากคนอื่น 100%</Text>

      <View style={{ gap: 6 }}>
        <Text style={styles.label}>ชื่อ</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="เช่น หมอ, เพื่อนซี้"
          placeholderTextColor="#999"
        />
      </View>

      <View style={{ gap: 6 }}>
        <Text style={styles.label}>System prompt — เว้นว่างได้ (ตัวตนงอกเอง)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={prompt}
          onChangeText={setPrompt}
          placeholder="อยากให้เป็นใคร / เว้นว่างเพื่อให้ emerge เอง"
          placeholderTextColor="#999"
          multiline
        />
      </View>

      <Pressable onPress={create} disabled={!name.trim()} style={[styles.create, !name.trim() && { opacity: 0.4 }]}>
        <Text style={styles.createText}>สร้าง</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { color: '#888', fontSize: 13 },
  label: { fontSize: 13, color: '#666' },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#bbb', borderRadius: 10, borderCurve: 'continuous',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#111', backgroundColor: 'rgba(127,127,127,0.06)',
  },
  multiline: { minHeight: 100, textAlignVertical: 'top' },
  create: { backgroundColor: '#7c5cff', paddingVertical: 14, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center' },
  createText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
