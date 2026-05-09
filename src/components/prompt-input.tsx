"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, ChevronDown, Loader2 } from "lucide-react";
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
  const dropdownRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim() && !isGenerating && !isOverLimit) {
      onGenerate(prompt.trim());
    }
  };

  const charCount = prompt.length;
  const isOverLimit = charCount > MAX_CHARS;
  const isEmpty = !prompt.trim();

  const closeDropdown = useCallback(() => setShowExamples(false), []);

  useEffect(() => {
    if (!showExamples) return;

    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeDropdown();
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showExamples, closeDropdown]);

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="Describe the application you want to build..."
        rows={5}
        className={cn(
          "w-full px-4 py-3 rounded-lg resize-none transition-all duration-200",
          "bg-slate-950/50 border border-slate-800 text-slate-100",
          "placeholder:text-slate-500 placeholder:font-mono",
          "focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/40",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          "text-sm leading-relaxed"
        )}
        disabled={isGenerating}
      />

      <div className="flex items-center justify-between">
        <div className="relative">
          <Button
            ref={triggerRef}
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowExamples((prev) => !prev)}
            className="text-slate-400 hover:text-slate-200 gap-1.5 px-2"
          >
            <ChevronDown
              className={cn(
                "w-3.5 h-3.5 transition-transform duration-200",
                showExamples && "rotate-180"
              )}
            />
            Try an example
          </Button>

          <AnimatePresence>
            {showExamples && (
              <motion.div
                ref={dropdownRef}
                initial={{ opacity: 0, y: 4, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 4, scale: 0.98 }}
                transition={{ duration: 0.15, ease: "easeOut" }}
                className={cn(
                  "absolute left-0 top-full mt-1.5 z-50",
                  "w-[420px] max-h-[280px] overflow-y-auto",
                  "rounded-lg border border-slate-800 bg-slate-900 shadow-xl shadow-black/40",
                  "p-1"
                )}
              >
                {examples.map((ex, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      setPrompt(ex);
                      setShowExamples(false);
                    }}
                    className={cn(
                      "w-full text-left px-3 py-2.5 rounded-md text-sm",
                      "text-slate-300 hover:text-slate-100",
                      "hover:bg-slate-800/80 transition-colors duration-100",
                      "leading-snug"
                    )}
                  >
                    {ex}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          <span
            className={cn(
              "text-xs tabular-nums select-none",
              isOverLimit ? "text-red-400" : "text-slate-600"
            )}
          >
            {charCount}/{MAX_CHARS}
          </span>

          <Button
            type="submit"
            disabled={isEmpty || isGenerating || isOverLimit}
            className={cn(
              "bg-gradient-to-r from-blue-600 to-violet-600",
              "hover:from-blue-500 hover:to-violet-500",
              "text-white border-0 shadow-lg shadow-blue-600/20",
              "disabled:from-slate-700 disabled:to-slate-700 disabled:shadow-none",
              "disabled:text-slate-500",
              "h-9 px-4 text-sm font-medium"
            )}
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                Compiling...
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5" />
                Compile
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
