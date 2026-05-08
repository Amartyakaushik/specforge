"use client";

const STAGES = [
  { id: "intent", label: "Intent Extraction", description: "Parsing natural language into structured intent" },
  { id: "design", label: "System Design", description: "Converting intent to app architecture" },
  { id: "schema", label: "Schema Generation", description: "Generating UI, API, DB, Auth configs" },
  { id: "validation", label: "Validation", description: "Cross-layer consistency checks" },
  { id: "repair", label: "Repair", description: "Fixing detected issues" },
  { id: "complete", label: "Complete", description: "Generation finished" },
];

interface Props {
  currentStage: string;
}

export function PipelineStatus({ currentStage }: Props) {
  const currentIndex = STAGES.findIndex((s) => s.id === currentStage);
  const isFailed = currentStage === "failed";

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">
        Pipeline Progress
      </h3>
      <div className="flex items-center gap-1">
        {STAGES.map((stage, i) => {
          const isActive = stage.id === currentStage;
          const isComplete = !isFailed && currentIndex > i;
          const isPending = !isFailed && currentIndex < i;

          let bgColor = "bg-slate-200";
          let textColor = "text-slate-400";
          let dotColor = "bg-slate-300";

          if (isActive && !isFailed) {
            bgColor = "bg-blue-100";
            textColor = "text-blue-700";
            dotColor = "bg-blue-500 animate-pulse";
          } else if (isComplete) {
            bgColor = "bg-green-100";
            textColor = "text-green-700";
            dotColor = "bg-green-500";
          } else if (isFailed && isActive) {
            bgColor = "bg-red-100";
            textColor = "text-red-700";
            dotColor = "bg-red-500";
          }

          return (
            <div key={stage.id} className="flex-1 flex flex-col items-center">
              <div className={`w-full h-2 rounded-full ${bgColor} transition-colors duration-300`} />
              <div className={`mt-2 w-3 h-3 rounded-full ${dotColor} transition-colors duration-300`} />
              <span className={`mt-1 text-xs font-medium ${textColor} text-center transition-colors duration-300`}>
                {stage.label}
              </span>
              {isActive && (
                <span className="text-[10px] text-slate-500 text-center mt-0.5">
                  {isFailed ? "Failed" : stage.description}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
