
import React, { useState } from 'react';
import { Message, EpisodicMemory, VectorMatch, MessageImage } from '../types';
import { BrainCircuit, MessageSquare, Sparkles, X, Info, ThumbsUp, ThumbsDown, Image as ImageIcon } from 'lucide-react';

interface MemoryNetworkProps {
  recalledMessages: VectorMatch<Message>[];
  recalledFacts: VectorMatch<EpisodicMemory>[];
  onClose: () => void;
  onRateMemory?: (id: string, rating: number) => void;
}

interface MemoryNode {
  id: string;
  type: 'fact' | 'history';
  content: string;
  sim: number;
  rating?: number;
  image?: MessageImage;
}

const MemoryNetwork: React.FC<MemoryNetworkProps> = ({ recalledMessages, recalledFacts, onClose, onRateMemory }) => {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);

  const allNodes: MemoryNode[] = [
    ...recalledFacts.map(f => ({ 
      id: f.item.id, 
      type: 'fact' as const, 
      content: f.item.content, 
      sim: f.similarity,
      rating: f.item.relevanceRating 
    })),
    ...recalledMessages.map((m, i) => ({ 
      id: `msg-${i}`, 
      type: 'history' as const, 
      content: m.item.content, 
      sim: m.similarity,
      rating: undefined,
      image: m.item.image
    }))
  ];

  if (allNodes.length === 0) return null;

  return (
    <div className="absolute inset-x-4 top-20 z-20 pointer-events-none">
      <div className="max-w-xl mx-auto bg-white/90 backdrop-blur-xl border border-indigo-100 rounded-3xl shadow-2xl p-6 pointer-events-auto animate-in fade-in slide-in-from-top-4 duration-500">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2">
            <div className="bg-indigo-600 p-1.5 rounded-lg shadow-lg shadow-indigo-200">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800 leading-tight">Neural Memory Pulse</h3>
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Semantic Node Mapping</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-full transition-colors text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="relative h-48 w-full flex items-center justify-center mb-4">
          {/* Central Active Thought */}
          <div className="relative z-10 w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center shadow-xl shadow-indigo-300 ring-4 ring-indigo-50 animate-pulse">
            <Info className="w-6 h-6 text-white" />
            <div className="absolute -bottom-6 whitespace-nowrap text-[10px] font-bold text-indigo-600 uppercase tracking-tighter">Current Query</div>
          </div>

          {/* Lines & Nodes */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
            {allNodes.map((node, i) => {
              const angle = (i / allNodes.length) * 2 * Math.PI - Math.PI / 2;
              const radius = 80;
              const x = 50 + Math.cos(angle) * radius * 0.4; // % based
              const y = 50 + Math.sin(angle) * radius * 0.35; // % based
              const isHovered = hoveredNode === node.id;
              const nodeColor = node.type === 'fact' ? '#10b981' : '#6366f1';
              
              return (
                <line 
                  key={`line-${i}`}
                  x1="50%" y1="50%" 
                  x2={`${x}%`} y2={`${y}%`} 
                  stroke={nodeColor} 
                  strokeWidth={isHovered ? "4" : "1.5"} 
                  strokeDasharray={isHovered ? "0" : "4 4"} 
                  className={`transition-all duration-300 ${
                    isHovered ? 'opacity-100 animate-pulse' : 'opacity-20'
                  }`}
                  style={isHovered ? { filter: `drop-shadow(0 0 4px ${nodeColor})` } : {}}
                />
              );
            })}
          </svg>

          {allNodes.map((node, i) => {
            const angle = (i / allNodes.length) * 2 * Math.PI - Math.PI / 2;
            const radius = 80;
            const x = 50 + Math.cos(angle) * radius * 0.4;
            const y = 50 + Math.sin(angle) * radius * 0.35;
            
            return (
              <div 
                key={node.id}
                className="absolute cursor-help group pointer-events-auto transition-transform hover:scale-110"
                style={{ left: `${x}%`, top: `${y}%`, transform: 'translate(-50%, -50%)' }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 border-white transition-all duration-300 ${
                  node.type === 'fact' 
                    ? (node.rating === 1 ? 'bg-emerald-600' : node.rating === -1 ? 'bg-rose-500' : 'bg-emerald-500')
                    : 'bg-slate-100 text-slate-500 shadow-slate-100'
                } ${node.type === 'fact' ? 'text-white shadow-emerald-200' : ''} ${hoveredNode === node.id ? 'ring-4 ring-offset-2 ring-indigo-500 scale-125' : ''}`}>
                  {node.type === 'fact' ? <BrainCircuit className="w-5 h-5" /> : (node.image ? <ImageIcon className="w-5 h-5 text-indigo-500" /> : <MessageSquare className="w-5 h-5" />)}
                </div>
                
                {/* Micro-label */}
                <div className={`absolute -bottom-2 left-1/2 -translate-x-1/2 text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow-sm whitespace-nowrap transition-opacity ${
                  node.type === 'fact' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
                }`}>
                  {(node.sim * 100).toFixed(0)}%
                </div>

                {/* Content Tooltip */}
                <div className={`absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-64 p-3 bg-slate-900 text-white rounded-xl text-[10px] leading-relaxed shadow-2xl transition-all duration-200 pointer-events-none z-30 ${
                  hoveredNode === node.id ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
                }`}>
                  <div className="font-bold uppercase mb-1 flex justify-between">
                    <span>{node.type === 'fact' ? 'Distilled Fact' : 'Raw Context'}</span>
                    <span className="text-indigo-400">Match {node.sim.toFixed(2)}</span>
                  </div>

                  {node.image && (
                    <div className="mb-2 relative rounded-lg overflow-hidden border border-white/10 bg-black/20">
                      <img 
                        src={`data:${node.image.mimeType};base64,${node.image.data}`} 
                        className="w-full h-24 object-cover" 
                        alt="Recalled visual context"
                      />
                      <div className="absolute top-1 right-1 bg-black/60 px-1.5 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">Visual Memory</div>
                    </div>
                  )}

                  <div className="max-h-24 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-700">
                    {node.content}
                  </div>
                  
                  {node.type === 'fact' && onRateMemory && (
                    <div className="mt-3 pt-2 border-t border-slate-700 flex items-center justify-between pointer-events-auto">
                      <span className="text-[8px] text-slate-400 uppercase font-bold">Rate Relevance:</span>
                      <div className="flex gap-2">
                        <button 
                          onClick={(e) => { e.stopPropagation(); onRateMemory(node.id, 1); }}
                          className={`p-1 rounded hover:bg-emerald-500/20 transition-colors ${node.rating === 1 ? 'text-emerald-400' : 'text-slate-500'}`}
                          title="Relevant & Accurate"
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); onRateMemory(node.id, -1); }}
                          className={`p-1 rounded hover:bg-rose-500/20 transition-colors ${node.rating === -1 ? 'text-rose-400' : 'text-slate-500'}`}
                          title="Irrelevant or Wrong"
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-900"></div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="text-center">
          <p className="text-[10px] text-slate-400 font-medium">
            Chronos combined <span className="text-emerald-600 font-bold">{recalledFacts.length} facts</span> and <span className="text-indigo-600 font-bold">{recalledMessages.length} history nodes</span> to synthesize this turn.
          </p>
        </div>
      </div>
    </div>
  );
};

export default MemoryNetwork;
