
// Fix: Implementing the main App component with memory management, retrieval, and chat logic
import React, { useState, useEffect, useRef } from 'react';
import { 
  Message, 
  EpisodicMemory, 
  ProspectiveMemory, 
  OntologySettings, 
  ChatSession,
  VectorMatch 
} from './types';
import { 
  getEmbedding, 
  mmrSearch, 
  chatWithMemoryStream, 
  extractMemories, 
  extractIntents,
  getImageDescription
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
  Trash2
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
  const [recalledData, setRecalledData] = useState<{
    messages: VectorMatch<Message>[];
    facts: VectorMatch<EpisodicMemory>[];
  }>({ messages: [], facts: [] });

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  // Initialize and load session from local storage
  useEffect(() => {
    const savedSession = localStorage.getItem(STORAGE_KEY);
    const savedSettings = localStorage.getItem(SETTINGS_KEY);
    
    if (savedSession) {
      try {
        const parsed: ChatSession = JSON.parse(savedSession);
        setMessages(parsed.messages || []);
        setMemories(parsed.memories || []);
        setProspective(parsed.prospective || []);
      } catch (e) {
        console.error("Failed to load session", e);
      }
    }
    
    if (savedSettings) {
      try {
        setSettings(JSON.parse(savedSettings));
      } catch (e) {
        console.error("Failed to load settings", e);
      }
    }
  }, []);

  // Persist session to local storage whenever state changes
  useEffect(() => {
    const session: ChatSession = { messages, memories, prospective };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [messages, memories, prospective]);

  // Persist settings
  useEffect(() => {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }, [settings]);

  // Auto-scroll to the bottom of the chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleExport = () => {
    const fullState = {
      messages,
      memories,
      prospective,
      settings,
      exportDate: new Date().toISOString(),
      version: "2.0"
    };
    const blob = new Blob([JSON.stringify(fullState, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `chronos_memory_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target?.result as string);
        if (data.messages) setMessages(data.messages);
        if (data.memories) setMemories(data.memories);
        if (data.prospective) setProspective(data.prospective);
        if (data.settings) setSettings(data.settings);
        alert("Chronos Neural State synchronized successfully!");
      } catch (err) {
        alert("Failed to parse memory file. Ensure it is a valid Chronos JSON.");
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        const data = base64.split(',')[1];
        setSelectedImage({ data, mimeType: file.type });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;

    const userContent = inputText;
    const userImage = selectedImage;
    setInputText('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      let visualContext = "";
      if (userImage) {
        visualContext = await getImageDescription(userImage);
      }

      const queryText = userContent + (visualContext ? ` [Visual: ${visualContext}]` : "");
      const queryEmbedding = await getEmbedding(queryText);

      // Fix: Explicitly provide Message type parameter to correctly type the retrieved semantic matches.
      const recalledMsg = mmrSearch<Message>(
        queryEmbedding, 
        messages, 
        4, 
        settings.mmrLambda, 
        settings.decayRate, 
        settings.similarityThreshold
      );
      // Fix: Explicitly provide EpisodicMemory type parameter to correctly type the retrieved semantic matches.
      const recalledFacts = mmrSearch<EpisodicMemory>(
        queryEmbedding, 
        memories, 
        5, 
        settings.mmrLambda, 
        settings.decayRate, 
        settings.similarityThreshold
      );

      setRecalledData({ messages: recalledMsg, facts: recalledFacts });
      if (recalledMsg.length > 0 || recalledFacts.length > 0) {
        setShowNetwork(true);
      }

      const newUserMessage: Message = {
        role: 'user',
        content: userContent,
        timestamp: Date.now(),
        embedding: queryEmbedding,
        image: userImage || undefined
      };

      setMessages(prev => [...prev, newUserMessage]);

      const modelPlaceholder: Message = {
        role: 'model',
        content: '',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, modelPlaceholder]);

      let fullResponse = "";
      const stream = chatWithMemoryStream(
        [...messages, newUserMessage],
        memories,
        recalledMsg,
        recalledFacts,
        prospective,
        settings.systemPrompt
      );

      for await (const chunk of stream) {
        fullResponse += chunk;
        setMessages(prev => {
          const last = prev[prev.length - 1];
          return [...prev.slice(0, -1), { ...last, content: fullResponse }];
        });
      }

      const responseEmbedding = await getEmbedding(fullResponse);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, embedding: responseEmbedding }];
      });

      const chatSegment = [newUserMessage, { ...modelPlaceholder, content: fullResponse }];
      
      const [extractedMemories, extractedIntents] = await Promise.all([
        extractMemories(chatSegment, settings.customConstraint),
        extractIntents(chatSegment)
      ]);

      const newMemories: EpisodicMemory[] = [];
      for (const item of extractedMemories) {
        if (item.importance && item.importance >= settings.importanceThreshold && item.content) {
          const emb = await getEmbedding(item.content);
          newMemories.push({
            id: crypto.randomUUID(),
            content: item.content,
            importance: item.importance,
            tags: item.tags || [],
            timestamp: Date.now(),
            embedding: emb,
            relevanceRating: 0
          });
        }
      }
      if (newMemories.length > 0) setMemories(prev => [...prev, ...newMemories]);

      const newIntents: ProspectiveMemory[] = extractedIntents.map(i => ({
        id: crypto.randomUUID(),
        intent: i.intent || "",
        priority: i.priority || 1,
        status: 'pending',
        timestamp: Date.now(),
        context_clue: i.context_clue || ""
      }));
      if (newIntents.length > 0) setProspective(prev => [...prev, ...newIntents]);

    } catch (error) {
      console.error("Cognitive loop failed:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const deleteMemory = (id: string) => {
    setMemories(prev => prev.filter(m => m.id !== id));
  };

  const rateMemory = (id: string, rating: number) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, relevanceRating: rating } : m));
  };

  const clearChat = () => {
    if (window.confirm("Purge ALL neural data? This includes LTM memories and settings.")) {
      setMessages([]);
      setMemories([]);
      setProspective([]);
      setSettings(DEFAULT_SETTINGS);
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SETTINGS_KEY);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Left Sidebar: Knowledge Base */}
      <div className="hidden lg:flex flex-col w-80 bg-white border-r border-slate-200 shadow-xl z-10">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6" />
            <h1 className="font-black tracking-tighter text-2xl uppercase">Chronos</h1>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <MemoryList memories={memories} onDelete={deleteMemory} />
        </div>

        {/* Action Controls */}
        <div className="p-4 bg-slate-50 border-t border-slate-100 space-y-2">
          <div className="flex items-center gap-2">
            <button 
              onClick={handleExport}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-100 transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Export
            </button>
            <button 
              onClick={() => importInputRef.current?.click()}
              className="flex-1 flex items-center justify-center gap-2 py-2 px-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black text-slate-500 uppercase tracking-widest hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-100 transition-all"
            >
              <Upload className="w-3.5 h-3.5" />
              Import
            </button>
            <input 
              type="file" 
              ref={importInputRef} 
              onChange={handleImport} 
              accept="application/json" 
              className="hidden" 
            />
          </div>
          <button 
            onClick={clearChat}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 bg-rose-50 border border-rose-100 rounded-xl text-[10px] font-black text-rose-500 uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Purge All Data
          </button>
        </div>
      </div>

      {/* Main Experience Area */}
      <main className="flex-1 flex flex-col relative min-w-0">
        <header className="h-16 flex items-center justify-between px-6 bg-white/80 backdrop-blur-md border-b border-slate-200 shrink-0 z-20 sticky top-0">
          <div className="flex items-center gap-4">
            <div className="lg:hidden flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <span className="font-black text-lg tracking-tighter">Chronos</span>
            </div>
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                <MessageSquare className="w-3 h-3" />
                <span>{messages.length} TURNS</span>
              </div>
              <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full border border-slate-200">
                <Database className="w-3 h-3" />
                <span>{memories.length} LTM NODES</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowNetwork(!showNetwork)}
              className={`p-2 rounded-xl transition-all ${showNetwork ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white border border-slate-100'}`}
              title="Neural Connectivity View"
            >
              <Brain className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setShowOntology(!showOntology)}
              className={`p-2 rounded-xl transition-all ${showOntology ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-white border border-slate-100'}`}
              title="Ontology Config"
            >
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        {showNetwork && (
          <MemoryNetwork 
            recalledMessages={recalledData.messages} 
            recalledFacts={recalledData.facts} 
            onClose={() => setShowNetwork(false)}
            onRateMemory={rateMemory}
          />
        )}

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-6 md:p-12 space-y-10 scroll-smooth"
        >
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-md mx-auto">
              <div className="relative mb-8">
                <div className="w-24 h-24 bg-indigo-600 rounded-[2.5rem] flex items-center justify-center shadow-2xl shadow-indigo-200 animate-pulse">
                  <Brain className="w-12 h-12 text-white" />
                </div>
                <div className="absolute -top-2 -right-2 w-8 h-8 bg-amber-400 rounded-full flex items-center justify-center shadow-lg animate-bounce">
                  <Sparkles className="w-4 h-4 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-800 tracking-tight">Cognitive Memory Assistant</h2>
              <p className="text-slate-500 mt-4 text-sm leading-relaxed font-medium">
                I integrate every conversation into a vectorized knowledge base. 
                State is persisted locally and can be exported as JSON for backup.
              </p>
            </div>
          ) : (
            messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                <div className={`max-w-[85%] md:max-w-[75%] group ${msg.role === 'user' ? 'items-end' : 'items-start'} flex flex-col gap-2`}>
                  <div className={`px-5 py-4 rounded-3xl shadow-sm text-sm leading-relaxed relative ${
                    msg.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-tr-none' 
                      : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none shadow-slate-200/50'
                  }`}>
                    {msg.image && (
                      <div className="mb-4 rounded-2xl overflow-hidden border border-black/5 shadow-inner">
                        <img 
                          src={`data:${msg.image.mimeType};base64,${msg.image.data}`} 
                          alt="User visual input" 
                          className="max-h-80 w-full object-contain bg-slate-50"
                        />
                      </div>
                    )}
                    <div className="whitespace-pre-wrap font-medium">{msg.content}</div>
                  </div>
                  <div className={`flex items-center gap-3 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 p-5 rounded-3xl rounded-tl-none shadow-sm flex items-center gap-4">
                <Loader2 className="w-6 h-6 text-indigo-600 animate-spin" />
                <span className="text-[11px] text-slate-500 font-bold uppercase tracking-widest">Neural Processing...</span>
              </div>
            </div>
          )}
        </div>

        <div className="p-6 bg-white/80 backdrop-blur-xl border-t border-slate-200 z-10">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            {selectedImage && (
              <div className="flex items-center gap-4 p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl animate-in zoom-in-95 duration-200 shadow-sm">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-md">
                  <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} className="w-full h-full object-cover" alt="Preview" />
                </div>
                <button onClick={() => setSelectedImage(null)} className="p-2 hover:bg-white text-slate-400 hover:text-red-500 rounded-xl transition-all"><X className="w-5 h-5" /></button>
              </div>
            )}
            
            <div className="relative flex items-center">
              <input 
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                placeholder="Message Chronos..."
                className="w-full pl-6 pr-32 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-[15px] font-medium placeholder:text-slate-400 shadow-inner"
              />
              <div className="absolute right-3 flex items-center gap-2">
                <button onClick={() => fileInputRef.current?.click()} className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all border border-transparent hover:border-indigo-100"><ImageIcon className="w-6 h-6" /></button>
                <button onClick={handleSendMessage} disabled={isLoading || (!inputText.trim() && !selectedImage)} className="p-2.5 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 disabled:opacity-30 transition-all active:scale-95">
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                </button>
              </div>
              <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" />
            </div>
          </div>
        </div>
      </main>

      {showOntology && <OntologyPanel settings={settings} onUpdate={setSettings} />}
    </div>
  );
};

export default App;
