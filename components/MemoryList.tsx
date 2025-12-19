
import React, { useState } from 'react';
import { EpisodicMemory, ProspectiveMemory } from '../types';
import { 
  Brain, 
  Calendar, 
  Tag, 
  Trash2, 
  ThumbsUp, 
  ThumbsDown, 
  Image as ImageIcon, 
  Clock, 
  CheckCircle2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface MemoryListProps {
  memories: EpisodicMemory[];
  prospective: ProspectiveMemory[];
  onDelete: (id: string) => void;
  onDeleteIntent: (id: string) => void;
  onResolveIntent: (id: string) => void;
}

const MemoryList: React.FC<MemoryListProps> = ({ 
  memories, 
  prospective, 
  onDelete, 
  onDeleteIntent, 
  onResolveIntent 
}) => {
  const [showPlans, setShowPlans] = useState(true);
  const [showEpisodic, setShowEpisodic] = useState(true);

  return (
    <div className="flex flex-col gap-2 overflow-y-auto max-h-[calc(100vh-180px)] p-2">
      
      {/* Prospective Memory Section */}
      <div className="mb-4">
        <button 
          onClick={() => setShowPlans(!showPlans)}
          className="w-full flex items-center justify-between px-3 py-2 bg-amber-50 rounded-xl mb-2 border border-amber-100"
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-600" />
            <h2 className="font-black text-[10px] text-amber-700 uppercase tracking-widest">Future Plans ({prospective.filter(p => p.status === 'pending').length})</h2>
          </div>
          {showPlans ? <ChevronUp className="w-3 h-3 text-amber-400" /> : <ChevronDown className="w-3 h-3 text-amber-400" />}
        </button>
        
        {showPlans && (
          <div className="space-y-2">
            {prospective.filter(p => p.status === 'pending').length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-4 italic">No pending plans detected...</p>
            ) : (
              prospective.filter(p => p.status === 'pending').map(intent => (
                <div key={intent.id} className="bg-white border border-amber-100 p-3 rounded-xl shadow-sm hover:shadow-md transition-all group">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-bold text-slate-700 leading-tight">{intent.intent}</p>
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => onResolveIntent(intent.id)}
                        className="p-1 text-slate-300 hover:text-emerald-500 transition-colors"
                        title="Mark as completed"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => onDeleteIntent(intent.id)}
                        className="p-1 text-slate-300 hover:text-rose-500 transition-colors"
                        title="Remove plan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[8px] font-black bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded uppercase">Priority {intent.priority}</span>
                    <span className="text-[8px] text-slate-400 font-medium">{new Date(intent.timestamp).toLocaleDateString('th-TH')}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Episodic Memory Section */}
      <div>
        <button 
          onClick={() => setShowEpisodic(!showEpisodic)}
          className="w-full flex items-center justify-between px-3 py-2 bg-indigo-50 rounded-xl mb-2 border border-indigo-100"
        >
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-indigo-600" />
            <h2 className="font-black text-[10px] text-indigo-700 uppercase tracking-widest">Knowledge Base ({memories.length})</h2>
          </div>
          {showEpisodic ? <ChevronUp className="w-3 h-3 text-indigo-400" /> : <ChevronDown className="w-3 h-3 text-indigo-400" />}
        </button>

        {showEpisodic && (
          <div className="space-y-3">
            {memories.length === 0 ? (
              <p className="text-[10px] text-slate-400 text-center py-12 italic">No memories stored yet...</p>
            ) : (
              memories
                .sort((a, b) => b.timestamp - a.timestamp)
                .map((memory) => (
                  <div 
                    key={memory.id} 
                    className="group relative bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200 animate-in fade-in slide-in-from-left-2"
                  >
                    <button 
                      onClick={() => onDelete(memory.id)}
                      className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-3">
                      <Calendar className="w-3 h-3" />
                      {new Date(memory.timestamp).toLocaleDateString('th-TH')}
                      <div className="ml-auto flex items-center gap-1.5">
                        {memory.relevanceRating === 1 && <ThumbsUp className="w-3 h-3 text-emerald-500" />}
                        {memory.relevanceRating === -1 && <ThumbsDown className="w-3 h-3 text-rose-500" />}
                        <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
                          Imp: {memory.importance}
                        </span>
                      </div>
                    </div>

                    {memory.image && (
                      <div className="mb-3 relative w-full h-24 rounded-lg overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center group-hover:shadow-inner transition-all">
                        <img 
                          src={`data:${memory.image.mimeType};base64,${memory.image.data}`} 
                          className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" 
                          alt="Episodic context"
                        />
                        <div className="absolute top-1 right-1 bg-indigo-600/80 p-1 rounded-md">
                          <ImageIcon className="w-2.5 h-2.5 text-white" />
                        </div>
                      </div>
                    )}
                    
                    <p className="text-sm text-slate-700 leading-relaxed mb-3 line-clamp-4 font-medium">
                      {memory.content}
                    </p>
                    
                    <div className="flex flex-wrap gap-1">
                      {memory.tags.map(tag => (
                        <span key={tag} className="flex items-center gap-1 text-[9px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-bold uppercase tracking-tighter">
                          <Tag className="w-2 h-2" />
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default MemoryList;
