"use client";

import { useState } from "react";

interface Props {
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  examples: string[];
}

export function PromptInput({ onGenerate, isGenerating, examples }: Props) {
  const [prompt, setPrompt] = useState("");
  const [showExamples, setShowExamples] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) {
      onGenerate(prompt.trim());
    }
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <form onSubmit={handleSubmit}>
        <label className="block text-sm font-medium text-slate-700 mb-2">
          Describe the application you want to build
        </label>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments..."
          className="w-full h-32 px-4 py-3 border border-slate-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-slate-900 placeholder:text-slate-400"
          disabled={isGenerating}
        />
        <div className="mt-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setShowExamples(!showExamples)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {showExamples ? "Hide examples" : "Show examples"}
          </button>
          <button
            type="submit"
            disabled={!prompt.trim() || isGenerating}
            className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isGenerating ? (
              <>
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Generating...
              </>
            ) : (
              "Generate Application"
            )}
          </button>
        </div>
      </form>

      {showExamples && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">Example prompts</p>
          <div className="space-y-2">
            {examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => {
                  setPrompt(ex);
                  setShowExamples(false);
                }}
                className="block w-full text-left px-3 py-2 text-sm text-slate-700 bg-slate-50 hover:bg-blue-50 hover:text-blue-700 rounded-lg transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
