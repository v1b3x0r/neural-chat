
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Message, EpisodicMemory, VectorMatch, MessageImage, OntologySettings, ProspectiveMemory } from './types';
import { chatWithMemoryStream, extractMemories, extractIntents, getEmbedding, mmrSearch, getImageDescription } from './services/geminiService';
import MemoryList from './components/MemoryList';
import MemoryNetwork from './components/MemoryNetwork';
import OntologyPanel from './components/OntologyPanel';
import { 
  Send, Sidebar, History, BrainCircuit, 
  Image as ImageIcon, X, Layers, 
  Network, Loader2, Settings2, Compass, CheckCircle2
} from 'lucide-react';

const DEFAULT_ONTOLOGY: OntologySettings = {
  importanceThreshold: 5,
  decayRate: 1.0,
  focusEntities: ["Personal", "Professional"],
  customConstraint: "",
  systemPrompt: ""
};

const App: React.FC = () => {
  // --- Core Persistent State ---
  const [messages, setMessages] = useState<Message[]>([]);
  const [memories, setMemories] = useState<EpisodicMemory[]>([]);
  const [prospective, setProspective] = useState<ProspectiveMemory[]>([]);
  const [ontology, setOntology] = useState<OntologySettings>(DEFAULT_ONTOLOGY);
  const [lastDistilledIndex, setLastDistilledIndex] = useState(0);

  // --- UI Transient State ---
  const [input, setInput] = useState('');
  const [selectedImage, setSelectedImage] = useState<MessageImage | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isBackgroundIndexing, setIsBackgroundIndexing] = useState(false);
  const [isDistilling, setIsDistilling] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);
  const [showOntology, setShowOntology] = useState(true);
  const [showNetwork, setShowNetwork] = useState(false);
  const [recalledMessages, setRecalledMessages] = useState<VectorMatch<Message>[]>([]);
  const [recalledFacts, setRecalledFacts] = useState<VectorMatch<EpisodicMemory>[]>([]);

  // --- Refs ---
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const indexingTimeoutRef = useRef<number | null>(null);
  const distillationTimeoutRef = useRef<number | null>(null);

  // --- Initialization & Persistence ---
  useEffect(() => {
    const savedMessages = localStorage.getItem('chronos_messages');
    const savedMemories = localStorage.getItem('chronos_memories');
    const savedProspective = localStorage.getItem('chronos_prospective');
    const savedOntology = localStorage.getItem('chronos_ontology');
    const savedLastIndex = localStorage.getItem('chronos_last_distilled');
    
    if (savedMessages) setMessages(JSON.parse(savedMessages));
    if (savedMemories) setMemories(JSON.parse(savedMemories));
    if (savedProspective) setProspective(JSON.parse(savedProspective));
    if (savedLastIndex) setLastDistilledIndex(parseInt(savedLastIndex));
    if (savedOntology) setOntology({ ...DEFAULT_ONTOLOGY, ...JSON.parse(savedOntology) });
  }, []);

  useEffect(() => {
    localStorage.setItem('chronos_messages', JSON.stringify(messages));
    localStorage.setItem('chronos_memories', JSON.stringify(memories));
    localStorage.setItem('chronos_prospective', JSON.stringify(prospective));
    localStorage.setItem('chronos_ontology', JSON.stringify(ontology));
    localStorage.setItem('chronos_last_distilled', lastDistilledIndex.toString());
  }, [messages, memories, prospective, ontology, lastDistilledIndex]);

  // --- Background Processing ---
  useEffect(() => {
    if (messages.length > lastDistilledIndex && !isLoading) {
      if (distillationTimeoutRef.current) window.clearTimeout(distillationTimeoutRef.current);
      distillationTimeoutRef.current = window.setTimeout(async () => {
        setIsDistilling(true);
        try {
          const newSegment = messages.slice(lastDistilledIndex);
          if (newSegment.length > 0) {
            const [extractedFacts, extractedIntents] = await Promise.all([
              extractMemories(newSegment, ontology.customConstraint),
              extractIntents(newSegment)
            ]);
            if (extractedFacts?.length > 0) {
              const processed = extractedFacts
                .filter(e => (e.importance || 5) >= ontology.importanceThreshold)
                .map(e => ({
                  id: Math.random().toString(36).substr(2, 9),
                  content: e.content || '',
                  importance: e.importance || 5,
                  tags: [...(e.tags || []), ...ontology.focusEntities],
                  timestamp: Date.now(),
                  relevanceRating: 0,
                }));
              if (processed.length > 0) setMemories(prev => [...prev, ...processed]);
            }
            if (extractedIntents?.length > 0) {
              const processedIntents = extractedIntents.map(i => ({
                id: Math.random().toString(36).substr(2, 9),
                intent: i.intent || '',
                status: 'pending' as const,
                priority: i.priority || 1,
                timestamp: Date.now(),
                context_clue: i.context_clue || ''
              }));
              setProspective(prev => [...prev, ...processedIntents]);
            }
          }
          setLastDistilledIndex(messages.length);
        } finally { setIsDistilling(false); }
      }, 5000); 
    }
  }, [messages, lastDistilledIndex, isLoading, ontology]);

  useEffect(() => {
    const startIndexing = () => {
      const msgToIndex = messages.find(m => !m.embedding && m.content.trim().length > 0);
      if (msgToIndex) {
        setIsBackgroundIndexing(true);
        getEmbedding(msgToIndex.content).then(emb => {
          if (emb.length) setMessages(prev => prev.map(m => m.timestamp === msgToIndex.timestamp ? { ...m, embedding: emb } : m));
        });
        return;
      }
      const memToIndex = memories.find(m => !m.embedding);
      if (memToIndex) {
        setIsBackgroundIndexing(true);
        getEmbedding(memToIndex.content).then(emb => {
          if (emb.length) setMemories(prev => prev.map(m => m.id === memToIndex.id ? { ...m, embedding: emb } : m));
        });
        return;
      }
      setIsBackgroundIndexing(false);
    };
    if (indexingTimeoutRef.current) window.clearTimeout(indexingTimeoutRef.current);
    indexingTimeoutRef.current = window.setTimeout(startIndexing, 1500);
  }, [messages, memories]);

  const scrollToBottom = useCallback(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, []);
  useEffect(() => { scrollToBottom(); }, [messages, isLoading, scrollToBottom]);

  // --- Logic ---
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => { setSelectedImage({ data: (reader.result as string).split(',')[1], mimeType: file.type }); };
      reader.readAsDataURL(file);
    }
  };

  const handleRateMemory = (id: string, rating: number) => {
    setMemories(prev => prev.map(m => m.id === id ? { ...m, relevanceRating: rating } : m));
    // Also update current recalled facts display if applicable
    setRecalledFacts(prev => prev.map(m => m.item.id === id ? { ...m, item: { ...m.item, relevanceRating: rating } } : m));
  };

  const handleSend = async () => {
    if ((!input.trim() && !selectedImage) || isLoading) return;

    const userInput = input.trim();
    const currentImage = selectedImage;
    
    setInput('');
    setSelectedImage(null);
    setIsLoading(true);

    try {
      setIsSearching(true);
      
      // Local Multimodal Memory Retrieval: 
      let queryText = userInput;
      if (currentImage && !userInput) {
        queryText = await getImageDescription(currentImage);
      } else if (currentImage && userInput) {
        const desc = await getImageDescription(currentImage);
        queryText = `${userInput}. ${desc}`;
      }

      const queryEmbedding = await getEmbedding(queryText || "Observation");
      const matchedMsgs = mmrSearch(queryEmbedding, messages, 3, 0.6, ontology.decayRate);
      const matchedFacts = mmrSearch(queryEmbedding, memories, 3, 0.4, ontology.decayRate); 
      
      setRecalledMessages(matchedMsgs);
      setRecalledFacts(matchedFacts);
      if (matchedMsgs.length || matchedFacts.length) setShowNetwork(true);
      setIsSearching(false);

      const userMsg: Message = {
        role: 'user',
        content: userInput || (currentImage ? "[Analyzing local context...]" : ""),
        timestamp: Date.now(),
        embedding: queryEmbedding,
        image: currentImage || undefined
      };
      
      const sessionMessages = [...messages, userMsg];
      setMessages(sessionMessages);

      const botMsg: Message = { role: 'model', content: '', timestamp: Date.now() };
      setMessages(prev => [...prev, botMsg]);

      const stream = chatWithMemoryStream(sessionMessages, memories, matchedMsgs, matchedFacts, prospective, ontology.systemPrompt);
      
      let fullContent = '';
      for await (const chunk of stream) {
        fullContent += chunk;
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last.role === 'model') {
            last.content = fullContent;
          }
          return updated;
        });
      }
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'model', content: 'Neural synchronization error.', timestamp: Date.now() }]);
    } finally {
      setIsLoading(false);
      setIsSearching(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-800 overflow-hidden">
      <aside className={`bg-white border-r border-slate-200 transition-all duration-300 flex flex-col shrink-0 ${showSidebar ? 'w-80' : 'w-0 overflow-hidden'}`}>
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg">
              <BrainCircuit className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight">Chronos</span>
          </div>
          <button onClick={() => setShowSidebar(false)} className="text-slate-400 p-1 hover:bg-slate-50 rounded-lg transition-colors"><Sidebar className="w-5 h-5" /></button>
        </div>
        
        <div className="p-3 bg-slate-50 border-b border-slate-100 space-y-3">
          <div className="flex items-center justify-between text-[10px] font-bold text-slate-400 uppercase tracking-wider">
            <span>Neural Store</span>
            <div className="flex items-center gap-1.5">
              {isDistilling && <span className="text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded animate-pulse">Distilling</span>}
              {isBackgroundIndexing && <span className="text-indigo-500 bg-indigo-50 px-1.5 py-0.5 rounded animate-pulse">Indexing</span>}
              {!isDistilling && !isBackgroundIndexing && <span className="text-slate-400 px-2">Idling</span>}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-4">
          <div className="px-2">
            <div className="flex items-center gap-2 mb-3">
              <Compass className="w-4 h-4 text-emerald-500" />
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-widest">Prospectives</h3>
            </div>
            {prospective.filter(p => p.status === 'pending').map(p => (
              <div key={p.id} className="group bg-emerald-50/50 border border-emerald-100 p-3 rounded-xl mb-2 flex gap-3 items-start animate-in fade-in slide-in-from-left-2">
                <div className="flex-1">
                  <p className="text-xs text-slate-700 font-medium leading-tight">{p.intent}</p>
                </div>
                <button 
                  onClick={() => setProspective(prev => prev.map(x => x.id === p.id ? {...x, status: 'resolved'} : x))} 
                  className="opacity-0 group-hover:opacity-100 p-1 text-emerald-400 hover:text-emerald-600 transition-all"
                >
                  <CheckCircle2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="border-t border-slate-100 my-4" />
          <MemoryList memories={memories} onDelete={(id) => setMemories(prev => prev.filter(m => m.id !== id))} />
        </div>

        <div className="p-4 border-t border-slate-100">
          <button onClick={() => { if (confirm('Purge local nodes?')) { setMessages([]); setMemories([]); setProspective([]); } }} className="w-full flex items-center justify-center gap-2 text-xs text-slate-400 hover:text-red-500 transition-colors py-2"><History className="w-3 h-3" /> System Purge</button>
        </div>
      </aside>

      <main className="flex-1 flex flex-col relative min-w-0 bg-slate-50">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-6 sticky top-0 z-30 shadow-sm">
          <div className="flex items-center gap-4">
            {!showSidebar && <button onClick={() => setShowSidebar(true)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors"><Sidebar className="w-5 h-5 text-slate-500" /></button>}
            <h1 className="font-semibold text-slate-700 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-500" />
              Stream Matrix
              {isLoading && <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            {showNetwork && (
              <button onClick={() => setShowNetwork(!showNetwork)} className="flex items-center gap-2 text-[10px] font-bold px-3 py-1.5 rounded-full bg-indigo-600 text-white shadow-lg transition-all active:scale-95">
                <Network className="w-3 h-3" /> LOCAL RECALL GRAPH
              </button>
            )}
            <button onClick={() => setShowOntology(!showOntology)} className={`p-2 rounded-lg transition-colors ${showOntology ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}><Settings2 className="w-5 h-5" /></button>
          </div>
        </header>

        {showNetwork && (
          <MemoryNetwork 
            recalledMessages={recalledMessages} 
            recalledFacts={recalledFacts} 
            onClose={() => setShowNetwork(false)} 
            onRateMemory={handleRateMemory}
          />
        )}

        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center max-w-sm mx-auto space-y-4 pt-20">
              <div className="bg-white p-8 rounded-full shadow-xl shadow-indigo-100/50 border border-slate-100"><BrainCircuit className="w-12 h-12 text-indigo-600" /></div>
              <h3 className="text-xl font-bold text-slate-800 tracking-tight">Local Episodic Brain</h3>
              <p className="text-slate-500 text-sm">Chronos retrieves facts from your private memory store. Upload an image to find semantically related past experiences.</p>
            </div>
          ) : (
            messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
                <div className={`max-w-[85%] md:max-w-[70%] rounded-2xl p-4 relative ${msg.role === 'user' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100 rounded-tr-none' : 'bg-white border border-slate-200 text-slate-700 shadow-sm rounded-tl-none'}`}>
                  <div className="text-xs opacity-50 mb-1 font-mono flex justify-between gap-10">
                    <span>{msg.role === 'user' ? 'User' : 'Chronos'}</span>
                    <span>{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  {msg.image && (
                    <div className="mb-2 relative rounded-lg overflow-hidden border border-black/5">
                      <img src={`data:${msg.image.mimeType};base64,${msg.image.data}`} className="max-w-full h-auto" />
                      <div className="absolute bottom-2 right-2 bg-black/50 text-white text-[8px] px-1.5 py-0.5 rounded uppercase font-bold tracking-widest backdrop-blur-md">Local Input</div>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                    {msg.content || (msg.role === 'model' && <span className="opacity-50 animate-pulse">Recalling...</span>)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="p-4 md:p-6 bg-white border-t border-slate-200">
          <div className="max-w-4xl mx-auto flex flex-col gap-3">
            <div className="bg-slate-50 rounded-3xl border border-slate-200 shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
              <div className="flex gap-2 p-2.5 items-end">
                <input type="file" min="1" max="1" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileChange} />
                <button onClick={() => fileInputRef.current?.click()} className={`p-3 transition-colors rounded-2xl ${selectedImage ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400 hover:text-indigo-600'}`}>
                  <ImageIcon className="w-5 h-5" />
                </button>
                <textarea 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }} 
                  placeholder={selectedImage ? "Recall from image context..." : "Talk to Chronos..."}
                  className="flex-1 bg-transparent border-none focus:ring-0 resize-none py-3 px-3 text-sm md:text-base max-h-48 min-h-[44px]" 
                  rows={1} 
                />
                <button 
                  onClick={handleSend} 
                  disabled={isLoading} 
                  className={`p-3 rounded-2xl transition-all ${isLoading ? 'bg-slate-200 text-slate-400' : 'bg-indigo-600 text-white shadow-md active:scale-95 hover:bg-indigo-700'}`}
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>

            {selectedImage && (
              <div className="flex gap-2 animate-in zoom-in-50 slide-in-from-bottom-2">
                <div className="relative group">
                  <img src={`data:${selectedImage.mimeType};base64,${selectedImage.data}`} className="h-14 w-14 object-cover rounded-xl border-2 border-white shadow-lg ring-1 ring-slate-200" />
                  <button onClick={() => setSelectedImage(null)} className="absolute -top-2 -right-2 bg-slate-900 text-white p-1 rounded-full shadow-lg hover:bg-red-500 transition-colors"><X className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {showOntology && <OntologyPanel settings={ontology} onUpdate={setOntology} />}
    </div>
  );
};

export default App;
