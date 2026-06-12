"use client";

// ---------------------------------------------------------------------------
// ReportInfoForm.tsx
//
// Form for entering report header information (name, date, preparer, etc.)
// and the design thickness / unit system used for all calculations.
// ---------------------------------------------------------------------------

import type { ReportInfo, UnitSystem, ToleranceConfig } from "@/src/types/stabSheet";

interface Props {
  reportInfo: ReportInfo;
  onChange: (updated: ReportInfo) => void;
}

/** Human-readable labels for each supported unit system. */
const UNIT_OPTIONS: { value: UnitSystem; label: string }[] = [
  { value: "feet",   label: "Feet (decimal)" },
  { value: "meters", label: "Meters (decimal)" },
];

/** Tolerance value options in decimal units */
const TOLERANCE_OPTIONS: number[] = [0, 0.010, 0.020, 0.030, 0.040, 0.050, 0.060, 0.080, 0.100];

/** Preset highlight colors for cut (reds) and fill (yellows/oranges) */
const CUT_HIGHLIGHT_COLORS = [
  { value: "#ffcccc", label: "Light Red" },
  { value: "#ffaaaa", label: "Medium Red" },
  { value: "#ff9999", label: "Strong Red" },
  { value: "#ffe0e0", label: "Pale Red" },
];

const FILL_HIGHLIGHT_COLORS = [
  { value: "#fff4cc", label: "Light Yellow" },
  { value: "#ffe4b3", label: "Light Orange" },
  { value: "#fff8dc", label: "Cornsilk" },
  { value: "#ffe7ba", label: "Pale Orange" },
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

  /** Tolerance field updater. */
  function handleTolerance(field: keyof ToleranceConfig, value: number | string) {
    onChange({
      ...reportInfo,
      tolerance: { ...reportInfo.tolerance, [field]: value },
    });
  }

  const unitLabel = reportInfo.unitSystem === "meters" ? "m" : "ft";

  /** Format tolerance value for display */
  function formatTolerance(value: number): string {
    return value.toFixed(3);
  }

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

      {/* Row 3: Unit System + Design Thickness */}
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

      {/* Row 4: Cut/Fill Tolerance Settings */}
      <div className="mt-6 border-t border-gray-200 pt-5">
        <h3 className="mb-4 text-sm font-semibold text-gray-700">
          Cut/Fill Tolerances ({unitLabel})
        </h3>
        <p className="mb-4 text-xs text-gray-500">
          Points with cut or fill amounts below tolerance will be classified as "On Grade".
          Values equal to or greater than tolerance will be highlighted.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Cut Tolerance */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Cut Tolerance</label>
              <select
                className={inputClass}
                value={reportInfo.tolerance.cutTolerance}
                onChange={(e) =>
                  handleTolerance("cutTolerance", parseFloat(e.target.value))
                }
              >
                {TOLERANCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {formatTolerance(opt)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <label className={labelClass}>Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-14 cursor-pointer rounded border border-gray-300"
                  value={reportInfo.tolerance.cutHighlightColor}
                  onChange={(e) =>
                    handleTolerance("cutHighlightColor", e.target.value)
                  }
                  title="Cut highlight color"
                />
              </div>
            </div>
          </div>

          {/* Fill Tolerance */}
          <div className="flex gap-3">
            <div className="flex-1">
              <label className={labelClass}>Fill Tolerance</label>
              <select
                className={inputClass}
                value={reportInfo.tolerance.fillTolerance}
                onChange={(e) =>
                  handleTolerance("fillTolerance", parseFloat(e.target.value))
                }
              >
                {TOLERANCE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {formatTolerance(opt)}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-20">
              <label className={labelClass}>Color</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  className="h-9 w-14 cursor-pointer rounded border border-gray-300"
                  value={reportInfo.tolerance.fillHighlightColor}
                  onChange={(e) =>
                    handleTolerance("fillHighlightColor", e.target.value)
                  }
                  title="Fill highlight color"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Row 5: Project Description (full width, multi-line) */}
      <div className="mt-4">
        <label className={labelClass}>
          Project Description
          <span className="ml-2 font-normal text-gray-400">
            ({reportInfo.projectDescription.length} / 75)
          </span>
        </label>
        <textarea
          className={`${inputClass} min-h-[80px] resize-y`}
          rows={3}
          maxLength={75}
          placeholder="Brief description of the project or area"
          value={reportInfo.projectDescription}
          onChange={(e) => handleText("projectDescription", e.target.value)}
        />
      </div>

    </section>
  );
}
