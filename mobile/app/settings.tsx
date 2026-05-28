import { useEffect, useState } from 'react';
import { ScrollView, View, Text, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import {
  getChatCfg, setChatCfg, getEmbedCfg, setEmbedCfg,
  getChatKey, setChatKey, getEmbedKey, setEmbedKey, type EndpointCfg,
} from '@/lib/config';
import { resetEngines } from '@/lib/engine';

export default function Settings() {
  const [chat, setChat] = useState<EndpointCfg>(getChatCfg());
  const [embed, setEmbed] = useState<EndpointCfg>(getEmbedCfg());
  const [chatKey, setCk] = useState('');
  const [embedKey, setEk] = useState('');

  useEffect(() => {
    (async () => { setCk(await getChatKey()); setEk(await getEmbedKey()); })();
  }, []);

  const save = async () => {
    setChatCfg(chat);
    setEmbedCfg(embed);
    await setChatKey(chatKey);
    await setEmbedKey(embedKey);
    resetEngines();
    Alert.alert('บันทึกแล้ว', 'ตั้งค่าใหม่จะใช้กับข้อความถัดไป');
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 20 }} contentInsetAdjustmentBehavior="automatic">
      <Section title="Chat — โมเดลฉลาด (OpenRouter)">
        <Field label="Base URL" value={chat.baseURL} onChange={(v) => setChat({ ...chat, baseURL: v })} />
        <Field label="Model" value={chat.model} onChange={(v) => setChat({ ...chat, model: v })} />
        <Field label="API Key" value={chatKey} onChange={setCk} secure />
      </Section>

      <Section title="Embeddings — local/offline (LM Studio)">
        <Field label="Base URL" value={embed.baseURL} onChange={(v) => setEmbed({ ...embed, baseURL: v })} />
        <Field label="Model" value={embed.model} onChange={(v) => setEmbed({ ...embed, model: v })} />
        <Field label="API Key (ถ้ามี)" value={embedKey} onChange={setEk} secure />
      </Section>

      <Pressable onPress={save} style={styles.save}>
        <Text style={styles.saveText}>บันทึก</Text>
      </Pressable>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: 10 }}>
      <Text style={styles.section}>{title}</Text>
      {children}
    </View>
  );
}

function Field({ label, value, onChange, secure }: { label: string; value: string; onChange: (v: string) => void; secure?: boolean }) {
  return (
    <View style={{ gap: 4 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry={secure}
        placeholderTextColor="#999"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: 13, fontWeight: '700', color: '#888', textTransform: 'uppercase', letterSpacing: 0.5 },
  label: { fontSize: 13, color: '#666' },
  input: {
    borderWidth: StyleSheet.hairlineWidth, borderColor: '#bbb', borderRadius: 10, borderCurve: 'continuous',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: 'rgba(127,127,127,0.06)',
  },
  save: { backgroundColor: '#7c5cff', paddingVertical: 14, borderRadius: 12, borderCurve: 'continuous', alignItems: 'center' },
  saveText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
