"use client";

// ---------------------------------------------------------------------------
// SummaryCards.tsx
//
// Displays three summary stat cards: cut, fill, and on-grade.
// ---------------------------------------------------------------------------

import type { ReportSummary } from "@/src/types/stabSheet";

interface Props {
  summary: ReportSummary;
}

interface CardConfig {
  label: string;
  value: number;
  colorClass: string;
  dotClass: string;
}

export default function SummaryCards({ summary }: Props) {
  const cards: CardConfig[] = [
    {
      label: "Cut",
      value: summary.cutCount,
      colorClass: "bg-red-50 border-red-200 text-red-800",
      dotClass: "bg-red-400",
    },
    {
      label: "Fill",
      value: summary.fillCount,
      colorClass: "bg-green-50 border-green-200 text-green-800",
      dotClass: "bg-green-400",
    },
    {
      label: "On Grade",
      value: summary.onGradeCount,
      colorClass: "bg-gray-50 border-gray-200 text-gray-700",
      dotClass: "bg-gray-400",
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-4">
      {cards.map((card) => (
        <div
          key={card.label}
          className={`flex flex-col items-center rounded-xl border px-3 py-5 shadow-sm ${card.colorClass}`}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`inline-block h-2 w-2 rounded-full flex-shrink-0 ${card.dotClass}`} />
            <span className="text-xs font-semibold uppercase tracking-wide text-center leading-tight">
              {card.label}
            </span>
          </div>
          <span className="text-3xl font-bold">{card.value}</span>
        </div>
      ))}
    </div>
  );
}
