
import React from 'react';
import { OntologySettings } from '../types';
import { Settings2, FastForward, ShieldAlert, Target, Info, Hash, UserCircle } from 'lucide-react';

interface OntologyPanelProps {
  settings: OntologySettings;
  onUpdate: (settings: OntologySettings) => void;
}

const ENTITY_OPTIONS = ["Personal", "Professional", "Technical", "Philosophical", "Emotional", "Logistics"];

const OntologyPanel: React.FC<OntologyPanelProps> = ({ settings, onUpdate }) => {
  const toggleEntity = (entity: string) => {
    const newFocus = settings.focusEntities.includes(entity)
      ? settings.focusEntities.filter(e => e !== entity)
      : [...settings.focusEntities, entity];
    onUpdate({ ...settings, focusEntities: newFocus });
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-slate-200 w-80 shrink-0 overflow-y-auto animate-in slide-in-from-right-4 duration-300">
      <div className="p-4 border-b border-slate-100 flex items-center gap-2">
        <Settings2 className="w-5 h-5 text-indigo-600" />
        <h2 className="font-bold text-slate-700">Ontology Config</h2>
      </div>

      <div className="p-6 space-y-8 pb-20">
        {/* System Prompt */}
        <section className="space-y-4">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <UserCircle className="w-3 h-3" />
            System Identity
          </label>
          <textarea
            value={settings.systemPrompt}
            onChange={(e) => onUpdate({ ...settings, systemPrompt: e.target.value })}
            placeholder="Define the AI's core personality and role. Leave empty for default Chronos identity."
            className="w-full h-32 p-3 bg-indigo-50/30 border border-indigo-100 rounded-xl text-xs text-slate-700 resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none leading-relaxed"
          />
          <p className="text-[10px] text-slate-400 italic leading-relaxed">
            This prompt governs the AI's voice and behavioral constraints.
          </p>
        </section>

        {/* Extraction Sensitivity */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <ShieldAlert className="w-3 h-3" />
              Recall Sensitivity
            </label>
            <span className="text-xs font-mono bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded">
              {settings.importanceThreshold}/10
            </span>
          </div>
          <input 
            type="range" min="1" max="10" step="1"
            value={settings.importanceThreshold}
            onChange={(e) => onUpdate({ ...settings, importanceThreshold: parseInt(e.target.value) })}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
          />
          <p className="text-[10px] text-slate-400 italic leading-relaxed">
            Higher values filter out trivial interactions, storing only high-importance episodic nodes.
          </p>
        </section>

        {/* Temporal Decay */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <FastForward className="w-3 h-3" />
              Temporal Decay
            </label>
            <span className="text-xs font-mono bg-amber-50 text-amber-600 px-2 py-0.5 rounded">
              {settings.decayRate}x
            </span>
          </div>
          <input 
            type="range" min="0.1" max="2.0" step="0.1"
            value={settings.decayRate}
            onChange={(e) => onUpdate({ ...settings, decayRate: parseFloat(e.target.value) })}
            className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-amber-500"
          />
          <p className="text-[10px] text-slate-400 italic leading-relaxed">
            Adjusts how quickly the similarity score of older memories decreases relative to newer context.
          </p>
        </section>

        {/* Focus Ontology */}
        <section className="space-y-4">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Target className="w-3 h-3" />
            Knowledge Focus
          </label>
          <div className="flex flex-wrap gap-2">
            {ENTITY_OPTIONS.map(entity => (
              <button
                key={entity}
                onClick={() => toggleEntity(entity)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-bold transition-all border ${
                  settings.focusEntities.includes(entity)
                    ? 'bg-indigo-600 border-indigo-700 text-white shadow-md shadow-indigo-100'
                    : 'bg-white border-slate-200 text-slate-500 hover:border-indigo-300'
                }`}
              >
                {entity}
              </button>
            ))}
          </div>
        </section>

        {/* Cognitive Constraints */}
        <section className="space-y-4">
          <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
            <Hash className="w-3 h-3" />
            Active Constraints
          </label>
          <textarea
            value={settings.customConstraint}
            onChange={(e) => onUpdate({ ...settings, customConstraint: e.target.value })}
            placeholder="e.g. Always record names of books mentioned..."
            className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600 resize-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all outline-none"
          />
        </section>
      </div>

      <div className="mt-auto p-4 bg-slate-50 border-t border-slate-100 sticky bottom-0">
        <div className="flex items-start gap-2 p-3 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <p className="text-[9px] text-slate-400 leading-tight uppercase font-bold tracking-tight">
            System Identity changes take effect immediately on next message.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OntologyPanel;
