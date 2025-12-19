
import React, { useState, useMemo } from 'react';
import { Message, EpisodicMemory, VectorMatch, MessageImage, CognitiveInsight } from '../types';
import { BrainCircuit, MessageSquare, Sparkles, X, Info, Zap, Link as LinkIcon, Activity } from 'lucide-react';

interface MemoryNetworkProps {
  recalledMessages: VectorMatch<Message>[];
  recalledFacts: VectorMatch<EpisodicMemory>[];
  insight?: CognitiveInsight;
  onClose: () => void;
}

const MemoryNetwork: React.FC<MemoryNetworkProps> = ({ recalledMessages, recalledFacts, insight, onClose }) => {
  const [activeTab, setActiveTab] = useState<'graph' | 'reasoning'>('graph');

  return (
    <div className="absolute inset-x-4 top-20 z-20 pointer-events-none">
      <div className="max-w-2xl mx-auto bg-slate-900/95 backdrop-blur-2xl border border-slate-800 rounded-[2.5rem] shadow-2xl p-8 pointer-events-auto animate-in zoom-in-95 duration-300">
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Activity className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-black text-white tracking-tight">Context Synthesis Engine</h3>
              <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em]">Pre-LLM Cognition Active</p>
            </div>
          </div>
          <div className="flex bg-slate-800 p-1 rounded-xl">
            <button 
              onClick={() => setActiveTab('graph')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'graph' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Neural Map
            </button>
            <button 
              onClick={() => setActiveTab('reasoning')}
              className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${activeTab === 'reasoning' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              Reasoning
            </button>
          </div>
        </div>

        {activeTab === 'graph' ? (
          <div className="relative h-64 w-full flex items-center justify-center overflow-hidden rounded-3xl bg-black/20 border border-white/5">
            {/* Simple Graph Representation */}
            <div className="relative z-10 w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(255,255,255,0.2)]">
              <Sparkles className="w-8 h-8 text-indigo-600" />
            </div>
            
            {/* Recalled Nodes Orbiting */}
            {[...recalledFacts, ...recalledMessages].map((node, i) => {
              const angle = (i / (recalledFacts.length + recalledMessages.length)) * 2 * Math.PI;
              const x = 50 + Math.cos(angle) * 35;
              const y = 50 + Math.sin(angle) * 35;
              return (
                <div 
                  key={i}
                  className="absolute w-8 h-8 rounded-full border border-white/20 bg-slate-800 flex items-center justify-center shadow-lg"
                  style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  {'item' in node && 'id' in node.item && node.item.id.startsWith('msg-') ? <MessageSquare className="w-4 h-4 text-indigo-400" /> : <BrainCircuit className="w-4 h-4 text-emerald-400" />}
                </div>
              );
            })}
            
            <svg className="absolute inset-0 w-full h-full opacity-20">
              {[...recalledFacts, ...recalledMessages].map((_, i) => (
                <line key={i} x1="50%" y1="50%" x2={`${50 + Math.cos((i / (recalledFacts.length + recalledMessages.length)) * 2 * Math.PI) * 35}%`} y2={`${50 + Math.sin((i / (recalledFacts.length + recalledMessages.length)) * 2 * Math.PI) * 35}%`} stroke="white" strokeWidth="0.5" />
              ))}
            </svg>
          </div>
        ) : (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2">
            {insight ? (
              <>
                <div className="p-5 bg-indigo-500/10 border border-indigo-500/20 rounded-[2rem]">
                  <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                    <Zap className="w-3 h-3" /> Core Synthesis
                  </h4>
                  <p className="text-sm text-slate-300 leading-relaxed font-medium italic">"{insight.reasoning}"</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-5 bg-slate-800/50 rounded-[2rem] border border-white/5">
                    <h4 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <LinkIcon className="w-3 h-3" /> Detected Connections
                    </h4>
                    <ul className="space-y-2">
                      {insight.connections.map((c, i) => (
                        <li key={i} className="text-[11px] text-slate-400 flex items-start gap-2">
                          <span className="w-1 h-1 bg-indigo-500 rounded-full mt-1.5 shrink-0" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="p-5 bg-emerald-500/5 rounded-[2rem] border border-emerald-500/10">
                    <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Activity className="w-3 h-3" /> Anticipatory Bias
                    </h4>
                    <p className="text-[11px] text-emerald-100/70 leading-relaxed font-medium">{insight.anticipation}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="py-12 text-center text-slate-500 italic text-sm">Synthesizing neural paths...</div>
            )}
          </div>
        )}

        <button 
          onClick={onClose}
          className="mt-8 w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-indigo-50 transition-all active:scale-[0.98]"
        >
          Inject Context to Main LLM
        </button>
      </div>
    </div>
  );
};

export default MemoryNetwork;
