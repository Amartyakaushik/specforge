"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, ChevronDown, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onGenerate: (prompt: string) => void;
  isGenerating: boolean;
  examples: string[];
}

const MAX_CHARS = 2000;

export function PromptInput({ onGenerate, isGenerating, examples }: Props) {
  const [prompt, setPrompt] = useState("");
  const [showExamples, setShowExamples] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating) {
      onGenerate(prompt.trim());
    }
  };

  const charCount = prompt.length;
  const isOverLimit = charCount > MAX_CHARS;

  return (
    <Card className="border-slate-800 bg-slate-900/60 backdrop-blur-sm">
      <CardContent className="p-6">
        <form onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Describe the application you want to build
          </label>

          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Build a CRM with login, contacts, dashboard, role-based access, and premium plan with payments..."
              className={cn(
                "w-full h-36 px-4 py-3 rounded-lg resize-none transition-all duration-200",
                "bg-slate-950/60 border border-slate-700 text-slate-100 placeholder:text-slate-500",
                "focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500/50",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
              disabled={isGenerating}
              maxLength={MAX_CHARS + 200}
            />
            <span
              className={cn(
                "absolute bottom-3 right-3 text-xs tabular-nums",
                isOverLimit ? "text-red-400" : "text-slate-600"
              )}
            >
              {charCount}/{MAX_CHARS}
            </span>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setShowExamples((prev) => !prev)}
              className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-blue-400 transition-colors font-medium"
            >
              <ChevronDown
                className={cn(
                  "w-4 h-4 transition-transform duration-200",
                  showExamples && "rotate-180"
                )}
              />
              {showExamples ? "Hide examples" : "Show examples"}
            </button>

            <Button
              type="submit"
              size="lg"
              disabled={!prompt.trim() || isGenerating || isOverLimit}
              className={cn(
                "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500",
                "text-white shadow-lg shadow-blue-600/20 border-0",
                "disabled:from-slate-700 disabled:to-slate-700 disabled:shadow-none"
              )}
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="animate-pulse">Generating...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Generate Application
                </>
              )}
            </Button>
          </div>
        </form>

        <AnimatePresence>
          {showExamples && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="mt-5 border-t border-slate-800 pt-5">
                <p className="text-xs text-slate-500 mb-3 font-medium uppercase tracking-wider">
                  Example prompts
                </p>
                <div className="grid gap-2">
                  {examples.map((ex, i) => (
                    <motion.button
                      key={i}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: i * 0.04 }}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.995 }}
                      onClick={() => {
                        setPrompt(ex);
                        setShowExamples(false);
                      }}
                      className={cn(
                        "w-full text-left px-4 py-3 rounded-lg transition-colors duration-150",
                        "bg-slate-800/50 border border-slate-700/50",
                        "text-sm text-slate-300 hover:text-blue-300",
                        "hover:bg-slate-800 hover:border-blue-500/30"
                      )}
                    >
                      {ex}
                    </motion.button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
