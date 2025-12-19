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
  ChevronRight,
  Database,
  Search,
  MessageSquare,
  Sparkles
} from 'lucide-react';

const STORAGE_KEY = 'chronos_chat_session';

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

  // Initialize and load session from local storage
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: ChatSession = JSON.parse(saved);
        setMessages(parsed.messages || []);
        setMemories(parsed.memories || []);
        setProspective(parsed.prospective || []);
      } catch (e) {
        console.error("Failed to load session", e);
      }
    }
  }, []);

  // Persist session to local storage whenever state changes
  useEffect(() => {
    const session: ChatSession = { messages, memories, prospective };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }, [messages, memories, prospective]);

  // Auto-scroll to the bottom of the chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      // 1. Describe image if present for semantic retrieval context
      let visualContext = "";
      if (userImage) {
        visualContext = await getImageDescription(userImage);
      }

      // 2. Get query embedding (incorporating visual context)
      const queryText = userContent + (visualContext ? ` [Visual: ${visualContext}]` : "");
      const queryEmbedding = await getEmbedding(queryText);

      // 3. Neural Retrieval (MMR)
      const recalledMsg = mmrSearch(
        queryEmbedding, 
        messages, 
        4, 
        settings.mmrLambda, 
        settings.decayRate, 
        settings.similarityThreshold
      );
      const recalledFacts = mmrSearch(
        queryEmbedding, 
        memories, 
        5, 
        settings.mmrLambda, 
        settings.decayRate, 
        settings.similarityThreshold
      );

      setRecalledData({ messages: recalledMsg, facts: recalledFacts });
      // Pulse the network visualization if there's any recall
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

      // 4. Chat with retrieved memory context
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

      // 5. Cognitive Distillation: Extract long-term facts and future intents
      const responseEmbedding = await getEmbedding(fullResponse);
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return [...prev.slice(0, -1), { ...last, embedding: responseEmbedding }];
      });

      const chatSegment = [newUserMessage, { ...modelPlaceholder, content: fullResponse }];
      
      // Extraction (Asynchronous)
      const [extractedMemories, extractedIntents] = await Promise.all([
        extractMemories(chatSegment, settings.customConstraint),
        extractIntents(chatSegment)
      ]);

      // Process and save new memories
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

      // Process and save new prospective intents
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
    if (window.confirm("Clear session history? Stored LTM (memories) will persist.")) {
      setMessages([]);
      setProspective([]);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans text-slate-900">
      {/* Left Sidebar: Knowledge Base */}
      <div className="hidden lg:flex flex-col w-80 bg-white border-r border-slate-200 shadow-xl z-10">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-600 text-white">
          <div className="flex items-center gap-2">
            <Brain className="w-6 h-6" />
            <h1 className="font-black tracking-tighter text-2xl">CHRONOS</h1>
          </div>
        </div>
        
        <div className="flex-1 overflow-hidden">
          <MemoryList memories={memories} onDelete={deleteMemory} />
        </div>

        {/* Prospective Memory (Task) List */}
        <div className="p-4 bg-slate-50 border-t border-slate-100">
          <div className="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">
            <span>Prospective Stack</span>
            <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">{prospective.filter(p => p.status === 'pending').length}</span>
          </div>
          <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
            {prospective.filter(p => p.status === 'pending').length === 0 ? (
              <p className="text-[10px] text-slate-400 italic text-center py-2">No pending intents...</p>
            ) : (
              prospective.filter(p => p.status === 'pending').map(p => (
                <div key={p.id} className="p-2 bg-white rounded-lg border border-slate-200 text-[10px] flex items-center gap-2 hover:border-amber-200 transition-colors shadow-sm">
                  <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                  <span className="truncate text-slate-600 font-medium">{p.intent}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Main Experience Area */}
      <main className="flex-1 flex flex-col relative min-w-0">
        {/* Navigation Bar */}
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
            <div className="w-px h-6 bg-slate-200 mx-1" />
            <button 
              onClick={clearChat}
              className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
              title="Reset Session"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Neural Context Visualization Overlay */}
        {showNetwork && (
          <MemoryNetwork 
            recalledMessages={recalledData.messages} 
            recalledFacts={recalledData.facts} 
            onClose={() => setShowNetwork(false)}
            onRateMemory={rateMemory}
          />
        )}

        {/* Chat History */}
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
                Upload images or share complex ideas; I'll recall them precisely when they become relevant.
              </p>
              <div className="grid grid-cols-2 gap-3 mt-10 w-full">
                <div className="p-4 bg-white border border-slate-200 rounded-2xl text-left shadow-sm">
                  <p className="text-[10px] font-black text-indigo-600 uppercase mb-1">Visual Indexing</p>
                  <p className="text-[11px] text-slate-500">"What was that chart I showed you yesterday?"</p>
                </div>
                <div className="p-4 bg-white border border-slate-200 rounded-2xl text-left shadow-sm">
                  <p className="text-[10px] font-black text-emerald-600 uppercase mb-1">Temporal Recall</p>
                  <p className="text-[11px] text-slate-500">"Summarize our discussion on AI ethics from last week."</p>
                </div>
              </div>
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
                    {msg.embedding && (
                      <div className="flex items-center gap-1 text-[8px] bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full uppercase font-black border border-indigo-100/50">
                        <Database className="w-2 h-2" />
                        Embedded
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
          
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white border border-slate-200 p-5 rounded-3xl rounded-tl-none shadow-sm flex items-center gap-4">
                <div className="relative">
                  <div className="w-8 h-8 bg-indigo-50 rounded-xl flex items-center justify-center">
                    <Brain className="w-4 h-4 text-indigo-600 animate-pulse" />
                  </div>
                  <Loader2 className="w-10 h-10 text-indigo-200 animate-spin absolute -top-1 -left-1" />
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Neural Processing</span>
                  <span className="text-[11px] text-slate-500 font-medium">Retrieving memories...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input Controls */}
        <div className="p-6 bg-white/80 backdrop-blur-xl border-t border-slate-200 z-10">
          <div className="max-w-4xl mx-auto flex flex-col gap-4">
            {selectedImage && (
              <div className="flex items-center gap-4 p-3 bg-indigo-50/50 border border-indigo-100 rounded-2xl animate-in zoom-in-95 duration-200 shadow-sm">
                <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white shadow-md">
                  <img 
                    src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} 
                    className="w-full h-full object-cover" 
                    alt="Preview"
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-indigo-600 uppercase tracking-widest mb-0.5">Visual Asset Detected</p>
                  <p className="text-xs text-slate-500 font-medium truncate">Semantic indexing will include visual metadata.</p>
                </div>
                <button 
                  onClick={() => setSelectedImage(null)}
                  className="p-2 hover:bg-white text-slate-400 hover:text-red-500 rounded-xl transition-all border border-transparent hover:border-red-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            
            <div className="relative flex items-center">
              <input 
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                placeholder="Message Chronos... (Semantic retrieval is active)"
                className="w-full pl-6 pr-32 py-5 bg-slate-50 border border-slate-200 rounded-[2rem] focus:bg-white focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all outline-none text-[15px] font-medium placeholder:text-slate-400 shadow-inner"
              />
              <div className="absolute right-3 flex items-center gap-2">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-all border border-transparent hover:border-indigo-100"
                  title="Attach Image"
                >
                  <ImageIcon className="w-6 h-6" />
                </button>
                <button 
                  onClick={handleSendMessage}
                  disabled={isLoading || (!inputText.trim() && !selectedImage)}
                  className="p-2.5 bg-indigo-600 text-white rounded-full shadow-lg shadow-indigo-200 hover:bg-indigo-700 disabled:opacity-30 disabled:shadow-none transition-all active:scale-95"
                >
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Send className="w-6 h-6" />}
                </button>
              </div>
              <input 
                type="file"
                ref={fileInputRef}
                onChange={handleImageSelect}
                accept="image/*"
                className="hidden"
              />
            </div>
            <p className="text-[9px] text-center text-slate-400 font-bold uppercase tracking-widest">
              Every turn is distilled into long-term memory via Semantic Pulse
            </p>
          </div>
        </div>
      </main>

      {/* Right Configuration Sidebar */}
      {showOntology && (
        <OntologyPanel 
          settings={settings} 
          onUpdate={setSettings} 
        />
      )}
    </div>
  );
};

export default App;