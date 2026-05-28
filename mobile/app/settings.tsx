import { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { getChatKey, setChatKey } from '@/lib/config';
import { resetEngines } from '@/lib/engine';
import { usePalette } from '@/lib/theme';

export default function Settings() {
  const c = usePalette();
  const [key, setKey] = useState('');

  useEffect(() => { (async () => setKey(await getChatKey()))(); }, []);

  const save = async () => {
    await setChatKey(key.trim());
    resetEngines();
    Alert.alert('บันทึกแล้ว', 'ใช้กับข้อความถัดไป');
  };

  return (
    <ScrollView style={{ backgroundColor: c.bg }} contentContainerStyle={{ padding: 16, gap: 14 }} contentInsetAdjustmentBehavior="automatic">
      <Text style={[styles.hint, { color: c.subtext }]}>
        ใส่ OpenRouter API key ครั้งเดียว (หรือใส่ใน .env.local). โมเดลเลือกได้ในหน้า Models — chat + embeddings ใช้ key เดียวกัน.
      </Text>
      <View style={{ gap: 6 }}>
        <Text style={[styles.label, { color: c.subtext }]}>OpenRouter API Key</Text>
        <TextInput
          style={[styles.input, { borderColor: c.border, color: c.text, backgroundColor: c.surface }]}
          value={key}
          onChangeText={setKey}
          placeholder="sk-or-v1-..."
          placeholderTextColor={c.faint}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
        />
      </View>
      <Pressable onPress={save} style={[styles.save, { backgroundColor: c.accent }]}>
        <Text style={[styles.saveText, { color: c.onAccent }]}>บันทึก</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 13, lineHeight: 19 },
  label: { fontSize: 13 },
  input: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, borderCurve: 'continuous', paddingHorizontal: 12, paddingVertical: 11, fontSize: 15 },
  save: { paddingVertical: 14, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center', marginTop: 4 },
  saveText: { fontSize: 16, fontWeight: '600' },
});
