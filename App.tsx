
// Fix: Implementing the main App component with memory management, retrieval, and chat logic
import React, { useState, useEffect, useRef } from 'react';
import { 
  Message, 
  EpisodicMemory, 
  ProspectiveMemory, 
  OntologySettings, 
  ChatSession,
  VectorMatch,
  GroundingLink,
  CognitiveInsight
} from './types';
import { 
  getEmbedding, 
  mmrSearch, 
  chatWithMemoryStream, 
  extractMemories, 
  extractIntents,
  getImageDescription,
  synthesizeContext
} from './services/geminiService';
import MemoryList from './components/MemoryList';
import MemoryNetwork from './components/MemoryNetwork';
import OntologyPanel from './components/OntologyPanel';
import { 
  Send, 
  Image as ImageIcon, 
  Brain, 
  Settings, 
  X, 
  Loader2, 
  Database,
  MessageSquare,
  Sparkles,
  Download,
  Upload,
  Trash2,
  ExternalLink,
  Activity
} from 'lucide-react';

const STORAGE_KEY = 'chronos_chat_session';
const SETTINGS_KEY = 'chronos_ontology_settings';

const DEFAULT_SETTINGS: OntologySettings = {
  importanceThreshold: 5,
  decayRate: 0.5,
  mmrLambda: 0.5,
  similarityThreshold: 0.4,
  focusEntities: ["Personal", "Professional"],
  customConstraint: "",
  systemPrompt: ""
};

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<EpisodicMemory[]>([]);
  const [prospective, setProspective] = useState<ProspectiveMemory[]>([]);
  const [settings, setSettings] = useState<OntologySettings>(DEFAULT_SETTINGS);
  
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ data: string, mimeType: string } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showOntology, setShowOntology] = useState(false);
  const [showNetwork, setShowNetwork] = useState(false);
  const [currentInsight, setCurrentInsight] = useState<CognitiveInsight | undefined>();
  const [recalledData, setRecalledData] = useState<{
    messages: VectorMatch<Message>[];
    facts: VectorMatch<EpisodicMemory>[];
  }>({ messages: [], facts: [] });

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    if (savedSession) {
      try {
        const parsed: ChatSession = JSON.parse(savedSession);
        setMessages(parsed.messages || []);
        setMemories(parsed.memories || []);
        setProspective(parsed.prospective || []);
      } catch (e) {}
    }
    if (savedSettings) try { setSettings(JSON.parse(savedSettings)); } catch (e) {}
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ messages, memories, prospective }));
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [messages, memories, prospective, settings]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;

    const userContent = inputText;
    const userImage = selectedImage;
    setInputText('');
    setSelectedImage(null);
    setIsLoading(true);
    setCurrentInsight(undefined);

    try {
      const visualContext = userImage ? await getImageDescription(userImage) : "";
      const queryText = userContent + (visualContext ? ` [Visual: ${visualContext}]` : "");
      const queryEmbedding = await getEmbedding(queryText || "Image Context");

      // 1. Semantic Retrieval
      const recalledMsg = mmrSearch<Message>(queryEmbedding, messages, 4, settings.mmrLambda, settings.decayRate, settings.similarityThreshold);
      const recalledFacts = mmrSearch<EpisodicMemory>(queryEmbedding, memories, 5, settings.mmrLambda, settings.decayRate, settings.similarityThreshold);
      setRecalledData({ messages: recalledMsg, facts: recalledFacts });

      // 2. Pre-LLM Cognitive Synthesis (Thinking before responding)
      const insight = await synthesizeContext(queryText, recalledMsg, recalledFacts, prospective);
      setCurrentInsight(insight);
      setShowNetwork(true); // แสดงกระบวนการคิด

      const newUserMessage: Message = { role: 'user', content: userContent || "[Image Context]", timestamp: Date.now(), embedding: queryEmbedding, image: userImage || undefined };
      setMessages(prev => [...prev, newUserMessage]);

      const modelPlaceholder: Message = { role: 'model', content: '', timestamp: Date.now(), insight };
      setMessages(prev => [...prev, modelPlaceholder]);

      // 3. Main Response Stream
      let fullResponse = "";
      let latestGroundingLinks: GroundingLink[] = [];
      const stream = chatWithMemoryStream([...messages, newUserMessage], memories, recalledMsg, recalledFacts, prospective, insight, settings.systemPrompt);

      for await (const chunk of stream) {
        fullResponse += chunk.text;
        latestGroundingLinks = chunk.groundingLinks || [];
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: fullResponse, groundingLinks: latestGroundingLinks }];
        });
      }

      // 4. Post-process (Embedding & Memory Extraction)
      const responseEmbedding = await getEmbedding(fullResponse);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, embedding: responseEmbedding }];
      });

      const chatSegment = [newUserMessage, { ...modelPlaceholder, content: fullResponse }];
      const [extractedMemories, extractedIntents] = await Promise.all([extractMemories(chatSegment, settings.customConstraint), extractIntents(chatSegment)]);

      const newMemories: EpisodicMemory[] = extractedMemories
        .filter((item: any) => item.importance >= settings.importanceThreshold && item.content)
        .map((item: any) => ({
          id: crypto.randomUUID(), content: item.content, importance: item.importance, tags: item.tags || [], timestamp: Date.now(), 
          embedding: [], relevanceRating: 0, image: userImage || undefined
        }));
      
      // Async get embeddings for memories to not block
      for (const m of newMemories) m.embedding = await getEmbedding(m.content);
      if (newMemories.length > 0) setMemories(prev => [...prev, ...newMemories]);

      const newIntents: ProspectiveMemory[] = extractedIntents.map((i: any) => ({
        id: crypto.randomUUID(), intent: i.intent || "", priority: i.priority || 1, status: 'pending', timestamp: Date.now(), context_clue: i.context_clue || ""
      }));
      if (newIntents.length > 0) setProspective(prev => [...prev, ...newIntents]);

    } catch (error) { console.error(error); } finally { setIsLoading(false); }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      <div className="hidden lg:flex flex-col w-80 bg-white border-r border-slate-200 shadow-xl z-10">
        <div className="p-6 border-b border-slate-100 flex items-center gap-2 bg-indigo-600 text-white">
          <Brain className="w-6 h-6" /> <h1 className="font-black tracking-tighter text-2xl uppercase">Chronos</h1>
        </div>
        <div className="flex-1 overflow-hidden">
          <MemoryList memories={memories} prospective={prospective} onDelete={id => setMemories(m => m.filter(x => x.id !== id))} onDeleteIntent={id => setProspective(p => p.filter(x => x.id !== id))} onResolveIntent={id => setProspective(p => p.map(x => x.id === id ? {...x, status: 'resolved'} : x))} />
        </div>
      </div>

      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-16 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md border-b border-slate-200 z-20">
          <div className="flex items-center gap-4">
            <Activity className="w-5 h-5 text-indigo-600 animate-pulse" />
            <span className="font-black text-xs uppercase tracking-widest text-slate-400">Associative Network Active</span>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowNetwork(!showNetwork)} className={`p-2 rounded-xl ${showNetwork ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}><Activity className="w-5 h-5" /></button>
            <button onClick={() => setShowOntology(!showOntology)} className={`p-2 rounded-xl ${showOntology ? 'bg-indigo-600 text-white' : 'bg-slate-50 text-slate-400'}`}><Settings className="w-5 h-5" /></button>
          </div>
        </header>

        {showNetwork && <MemoryNetwork recalledMessages={recalledData.messages} recalledFacts={recalledData.facts} insight={currentInsight} onClose={() => setShowNetwork(false)} />}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-12 space-y-10 scroll-smooth">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl mb-8"><Brain className="w-12 h-12 text-white" /></div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Associative Cognition</h2>
              <p className="text-slate-500 mt-4 text-sm font-medium">ระบบที่ "คิด" และ "เชื่อมโยง" ความจำก่อนที่จะตอบคุณ</p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                <div className={`max-w-[85%] md:max-w-[75%] group flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {msg.insight && (
                    <div className="mb-1 flex items-center gap-2 px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[9px] font-black uppercase tracking-widest border border-indigo-100">
                      <Sparkles className="w-3 h-3" /> Context Synthesized
                    </div>
                  )}
                  <div className={`px-5 py-4 rounded-3xl shadow-sm text-sm leading-relaxed ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-none' : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'}`}>
                    {msg.image && <img src={`data:${msg.image.mimeType};base64,${msg.image.data}`} className="mb-4 rounded-2xl max-h-80 w-full object-contain" />}
                    <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                    {msg.groundingLinks && msg.groundingLinks.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap gap-2">
                        {msg.groundingLinks.map((link, idx) => <a key={idx} href={link.uri} target="_blank" className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 text-indigo-600 text-[11px] font-bold rounded-lg border border-indigo-100"><ExternalLink className="w-3 h-3" /> {link.title || 'Source'}</a>)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          {isLoading && <div className="flex justify-start animate-pulse"><div className="bg-white border border-slate-200 p-5 rounded-3xl flex items-center gap-4"><Loader2 className="w-6 h-6 text-indigo-600 animate-spin" /><span className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Synthesizing Insight...</span></div></div>}
        </div>

        <div className="p-6 bg-white/80 backdrop-blur-xl border-t border-slate-200 z-10">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            <div className="relative flex items-center">
              <input type="text" value={inputText} onChange={e => setInputText(e.target.value)} onKeyDown={e => e.key === 'Enter' && !isLoading && handleSendMessage()} placeholder="Tell Chronos anything..." className="w-full pl-6 pr-32 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] focus:bg-white transition-all outline-none" />
              <div className="absolute right-3 flex items-center gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-indigo-600"><ImageIcon className="w-6 h-6" /></button>
                <button onClick={handleSendMessage} disabled={isLoading} className="p-2.5 bg-indigo-600 text-white rounded-full shadow-lg hover:scale-105 active:scale-95 transition-all"><Send className="w-6 h-6" /></button>
              </div>
              <input type="file" ref={fileInputRef} onChange={e => {
                const file = e.target.files?.[0];
                if (file) {
                  const reader = new FileReader();
                  reader.onload = ev => setSelectedImage({ data: (ev.target?.result as string).split(',')[1], mimeType: file.type });
                  reader.readAsDataURL(file);
                }
              }} accept="image/*" className="hidden" />
            </div>
          </div>
        </div>
      </main>

      {showOntology && <OntologyPanel settings={settings} onUpdate={setSettings} />}
    </div>
  );
};

export default App;
