"use client";

// ---------------------------------------------------------------------------
// ReportInfoForm.tsx
//
// Form for entering report header information (name, date, preparer, etc.)
// and the design thickness / unit system used for all calculations.
// ---------------------------------------------------------------------------

import type { ReportInfo, UnitSystem } from "@/src/types/stabSheet";

interface Props {
  reportInfo: ReportInfo;
  onChange: (updated: ReportInfo) => void;
}

/** Human-readable labels for each supported unit system. */
const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: "decimal-feet", label: "Decimal Feet (Engineer Scale)" },
  { value: "inches", label: "Inches" },
  { value: "metric", label: "Metric (Meters)" },
];

/** Shared Tailwind classes for form inputs. */
const inputClass =
  "w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 " +
  "placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

const labelClass = "block text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1";

export default function ReportInfoForm({ reportInfo, onChange }: Props) {
  /** Generic string field updater. */
  function handleText(field: keyof ReportInfo, value: string) {
    onChange({ ...reportInfo, [field]: value });
  }

  /** Numeric field updater – stores raw number, falls back to 0 for empty. */
  function handleNumber(field: keyof ReportInfo, value: string) {
    const num = parseFloat(value);
    onChange({ ...reportInfo, [field]: isNaN(num) ? 0 : num });
  }

  const unitLabel =
    reportInfo.unitSystem === "metric" ? "m" :
    reportInfo.unitSystem === "inches" ? "in" : "ft";

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-bold text-gray-800">Report Information</h2>

      {/* Row 1: Name + Date */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Stab Sheet Name</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. Parking Lot A – Phase 1"
            value={reportInfo.stabSheetName}
            onChange={(e) => handleText("stabSheetName", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Date of Data Collection</label>
          <input
            type="date"
            className={inputClass}
            value={reportInfo.dateOfCollection}
            onChange={(e) => handleText("dateOfCollection", e.target.value)}
          />
        </div>
      </div>

      {/* Row 2: Prepared By + Project ID */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Prepared By</label>
          <input
            type="text"
            className={inputClass}
            placeholder="Name or initials"
            value={reportInfo.preparedBy}
            onChange={(e) => handleText("preparedBy", e.target.value)}
          />
        </div>
        <div>
          <label className={labelClass}>Project ID</label>
          <input
            type="text"
            className={inputClass}
            placeholder="e.g. 2024-042"
            value={reportInfo.projectId}
            onChange={(e) => handleText("projectId", e.target.value)}
          />
        </div>
      </div>

      {/* Row 3: Project Description (full width) */}
      <div className="mt-4">
        <label className={labelClass}>Project Description</label>
        <input
          type="text"
          className={inputClass}
          placeholder="Brief description of the project or area"
          value={reportInfo.projectDescription}
          onChange={(e) => handleText("projectDescription", e.target.value)}
        />
      </div>

      {/* Row 4: Unit System + Design Thickness */}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label className={labelClass}>Unit System / Elevation Units</label>
          <select
            className={inputClass}
            value={reportInfo.unitSystem}
            onChange={(e) =>
              handleText("unitSystem", e.target.value as UnitSystem)
            }
          >
            {UNIT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelClass}>
            Design Thickness&nbsp;
            <span className="font-normal text-gray-400">({unitLabel})</span>
          </label>
          <input
            type="number"
            step="0.001"
            min="0"
            className={inputClass}
            placeholder="e.g. 0.583"
            value={reportInfo.designThickness === 0 ? "" : reportInfo.designThickness}
            onChange={(e) => handleNumber("designThickness", e.target.value)}
          />
        </div>
      </div>

    </section>
  );
}
