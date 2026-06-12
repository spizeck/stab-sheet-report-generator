"use client";

// ---------------------------------------------------------------------------
// ResultsTable.tsx
//
// Renders three sections:
//   1. Matched results table (cut/fill calculated rows)
//   2. Unmatched As-Built points (no design point found at those coordinates)
//   3. Unmatched Design points (no as-built point found at those coordinates)
//
// Displayed values are rounded to 3 decimal places via round3().
// The tables scroll horizontally on small screens.
// ---------------------------------------------------------------------------

import type { MatchResult, RawAsBuiltPoint, RawDesignPoint, ToleranceConfig } from "@/src/types/stabSheet";
import { round3, formatSignedVariance } from "@/src/lib/stabSheetCalculations";

interface Props {
  result: MatchResult;
  designThickness: number;
  tolerance?: ToleranceConfig;
}

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------

const th = "px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500 whitespace-nowrap";
const td = "px-3 py-2.5 text-sm text-gray-800 whitespace-nowrap";
const tdMono = `${td} font-mono`;

/** Tailwind badge classes for Cut / Fill / On Grade. */
function statusBadge(status: "Cut" | "Fill" | "On Grade") {
  const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold";
  if (status === "Cut")      return `${base} bg-red-100 text-red-700`;
  if (status === "Fill")     return `${base} bg-green-100 text-green-700`;
  return `${base} bg-gray-100 text-gray-600`;
}

/** Determine row background class based on index (for unmatched tables). */
function rowBg(idx: number): string;
/** Determine row background based on index, status, and tolerance highlighting. */
function rowBg(
  idx: number,
  status: "Cut" | "Fill" | "On Grade",
  tolerance?: ToleranceConfig
): string;
function rowBg(
  idx: number,
  status?: "Cut" | "Fill" | "On Grade",
  tolerance?: ToleranceConfig
): string {
  const baseBg = idx % 2 === 0 ? "bg-white" : "bg-gray-50/50";

  // If no status provided (unmatched tables), just return base background
  if (!status) {
    return baseBg;
  }

  return baseBg;
}

/** Get inline background style for tolerance highlighting. */
function getHighlightStyle(
  status: "Cut" | "Fill" | "On Grade",
  tolerance?: ToleranceConfig
): React.CSSProperties {
  if (status === "Cut" && tolerance) {
    return { backgroundColor: tolerance.cutHighlightColor };
  }
  if (status === "Fill" && tolerance) {
    return { backgroundColor: tolerance.fillHighlightColor };
  }
  return {};
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function UnmatchedAsBuiltTable({ points }: { points: RawAsBuiltPoint[] }) {
  if (points.length === 0) return null;
  return (
    <section className="rounded-xl border border-orange-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-orange-100 bg-orange-50">
        <h3 className="text-base font-bold text-orange-800">
          Unmatched As-Built Points ({points.length})
        </h3>
        <p className="text-xs text-orange-600 mt-0.5">
          These as-built points had no matching design point at the same coordinates.
          Not included in cut/fill totals.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Point ID</th>
              <th className={th}>Northing</th>
              <th className={th}>Easting</th>
              <th className={th}>As-Built Elev.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {points.map((pt, idx) => (
              <tr key={`unmatched-ab-${idx}`} className={rowBg(idx)}>
                <td className={`${td} font-medium text-gray-900`}>{pt.pointId}</td>
                <td className={tdMono}>{round3(pt.northing)}</td>
                <td className={tdMono}>{round3(pt.easting)}</td>
                <td className={tdMono}>{round3(pt.asBuiltElevation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function UnmatchedDesignTable({ points }: { points: RawDesignPoint[] }) {
  if (points.length === 0) return null;
  return (
    <section className="rounded-xl border border-purple-200 bg-white shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-purple-100 bg-purple-50">
        <h3 className="text-base font-bold text-purple-800">
          Unmatched Design Points ({points.length})
        </h3>
        <p className="text-xs text-purple-600 mt-0.5">
          These design points had no matching as-built point at the same coordinates.
          Not included in cut/fill totals.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-100">
          <thead className="bg-gray-50">
            <tr>
              <th className={th}>Point ID</th>
              <th className={th}>Northing</th>
              <th className={th}>Easting</th>
              <th className={th}>Design Elev.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50 bg-white">
            {points.map((pt, idx) => (
              <tr key={`unmatched-d-${idx}`} className={rowBg(idx)}>
                <td className={`${td} font-medium text-gray-900`}>{pt.pointId}</td>
                <td className={tdMono}>{round3(pt.northing)}</td>
                <td className={tdMono}>{round3(pt.easting)}</td>
                <td className={tdMono}>{round3(pt.designElevation)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function ResultsTable({ result, designThickness, tolerance }: Props) {
  if (result.matched.length === 0 && result.unmatchedAsBuilt.length === 0 && result.unmatchedDesign.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {/* ── Matched results ── */}
      {result.matched.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="text-lg font-bold text-gray-800">
              Matched Results ({result.matched.length})
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Design thickness applied:{" "}
              <span className="font-medium">{round3(designThickness)}</span>
              &nbsp;·&nbsp; Points matched by coordinate (±0.001)
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className={th}>Point ID</th>
                  <th className={th}>Northing</th>
                  <th className={th}>Easting</th>
                  <th className={th}>As-Built Elev.</th>
                  <th className={th}>Design Elev.</th>
                  <th className={th}>Design Thickness</th>
                  <th className={th}>Adj. Design Elev.</th>
                  <th className={th}>Status</th>
                  <th className={th}>Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {result.matched.map((pt, idx) => (
                  <tr
                    key={`${pt.pointId}-${idx}`}
                    className={rowBg(idx, pt.status, tolerance)}
                    style={getHighlightStyle(pt.status, tolerance)}
                  >
                    <td className={`${td} font-medium text-gray-900`}>{pt.pointId}</td>
                    <td className={tdMono}>{round3(pt.northing)}</td>
                    <td className={tdMono}>{round3(pt.easting)}</td>
                    <td className={tdMono}>{round3(pt.asBuiltElevation)}</td>
                    <td className={tdMono}>{round3(pt.designElevation)}</td>
                    <td className={tdMono}>{round3(designThickness)}</td>
                    <td className={tdMono}>{round3(pt.adjustedDesignElevation)}</td>
                    <td className={td}>
                      <span className={statusBadge(pt.status)}>{pt.status}</span>
                    </td>
                    {/* Variance column: always show signed value with 3 decimals */}
                    <td className={`${tdMono} font-semibold ${
                      pt.status === "Cut"  ? "text-red-700" :
                      pt.status === "Fill" ? "text-green-700" : "text-gray-500"
                    }`}>
                      {formatSignedVariance(pt.variance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ── Unmatched sections ── */}
      <UnmatchedAsBuiltTable points={result.unmatchedAsBuilt} />
      <UnmatchedDesignTable  points={result.unmatchedDesign}  />
    </div>
  );
}
