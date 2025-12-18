
import React from 'react';
import { EpisodicMemory } from '../types';
import { Brain, Calendar, Tag, Trash2, ThumbsUp, ThumbsDown } from 'lucide-react';

interface MemoryListProps {
  memories: EpisodicMemory[];
  onDelete: (id: string) => void;
}

const MemoryList: React.FC<MemoryListProps> = ({ memories, onDelete }) => {
  return (
    <div className="flex flex-col gap-4 overflow-y-auto max-h-[calc(100vh-200px)] p-2">
      <div className="flex items-center gap-2 mb-2 px-2">
        <Brain className="w-5 h-5 text-indigo-600" />
        <h2 className="font-bold text-slate-700">Episodic Memory Store</h2>
      </div>
      {memories.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-8">No memories stored yet...</p>
      ) : (
        memories
          .sort((a, b) => b.timestamp - a.timestamp)
          .map((memory) => (
            <div 
              key={memory.id} 
              className="group relative bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:shadow-md transition-all duration-200"
            >
              <button 
                onClick={() => onDelete(memory.id)}
                className="absolute top-2 right-2 p-1 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              
              <div className="flex items-center gap-2 text-[10px] text-slate-400 mb-2">
                <Calendar className="w-3 h-3" />
                {new Date(memory.timestamp).toLocaleString()}
                <div className="ml-auto flex items-center gap-1.5">
                  {memory.relevanceRating === 1 && <ThumbsUp className="w-3 h-3 text-emerald-500" />}
                  {memory.relevanceRating === -1 && <ThumbsDown className="w-3 h-3 text-rose-500" />}
                  <span className="bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full font-semibold">
                    Imp: {memory.importance}
                  </span>
                </div>
              </div>
              
              <p className="text-sm text-slate-700 leading-relaxed mb-3">
                {memory.content}
              </p>
              
              <div className="flex flex-wrap gap-1">
                {memory.tags.map(tag => (
                  <span key={tag} className="flex items-center gap-1 text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded">
                    <Tag className="w-2.5 h-2.5" />
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
};

export default MemoryList;
