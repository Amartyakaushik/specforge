"use client";

interface Props {
  metrics: {
    totalLatencyMs: number;
    stageLatencies: Record<string, number>;
    llmCalls: number;
    tokensUsed: number;
    validationErrors: number;
    validationWarnings: number;
    repairAttempts: number;
    repairSuccesses: number;
    estimatedCostUsd: number;
  };
}

export function MetricsPanel({ metrics }: Props) {
  const stats = [
    {
      label: "Total Latency",
      value: `${(metrics.totalLatencyMs / 1000).toFixed(1)}s`,
      color: "text-blue-700",
      bg: "bg-blue-50",
    },
    {
      label: "LLM Calls",
      value: metrics.llmCalls.toString(),
      color: "text-purple-700",
      bg: "bg-purple-50",
    },
    {
      label: "Tokens Used",
      value: metrics.tokensUsed.toLocaleString(),
      color: "text-indigo-700",
      bg: "bg-indigo-50",
    },
    {
      label: "Est. Cost",
      value: `$${metrics.estimatedCostUsd.toFixed(4)}`,
      color: "text-emerald-700",
      bg: "bg-emerald-50",
    },
    {
      label: "Validation Errors",
      value: metrics.validationErrors.toString(),
      color: metrics.validationErrors > 0 ? "text-red-700" : "text-green-700",
      bg: metrics.validationErrors > 0 ? "bg-red-50" : "bg-green-50",
    },
    {
      label: "Warnings",
      value: metrics.validationWarnings.toString(),
      color: "text-amber-700",
      bg: "bg-amber-50",
    },
    {
      label: "Repair Attempts",
      value: metrics.repairAttempts.toString(),
      color: "text-orange-700",
      bg: "bg-orange-50",
    },
    {
      label: "Repairs Applied",
      value: metrics.repairSuccesses.toString(),
      color: "text-teal-700",
      bg: "bg-teal-50",
    },
  ];

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 uppercase tracking-wide">
        Pipeline Metrics
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div key={stat.label} className={`${stat.bg} rounded-lg p-3`}>
            <div className={`text-lg font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-slate-600 mt-0.5">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Stage breakdown */}
      <div className="mt-4 border-t border-slate-100 pt-3">
        <p className="text-xs text-slate-500 font-medium mb-2">Stage Latencies</p>
        <div className="flex gap-2 flex-wrap">
          {Object.entries(metrics.stageLatencies).map(([stage, ms]) => (
            <span
              key={stage}
              className="inline-flex items-center gap-1 px-2 py-1 bg-slate-100 rounded text-xs text-slate-700"
            >
              <span className="font-medium capitalize">{stage}:</span>
              <span>{(ms / 1000).toFixed(1)}s</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
