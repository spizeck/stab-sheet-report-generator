// ---------------------------------------------------------------------------
// stabSheetCalculations.ts
//
// Core calculation and coordinate-matching logic.
//
// CALCULATION RULE
// ----------------
//   adjustedDesignElevation = designElevation - designThickness
//   variance                = adjustedDesignElevation - asBuiltElevation
//
//   variance < 0  → "Cut"      (as-built is ABOVE the adjusted design, material to remove)
//   variance > 0  → "Fill"     (as-built is BELOW the adjusted design, material to add)
//   variance = 0  → "On Grade" (exact match)
//
// TOLERANCE RULE
// ----------------
//   Cut:   variance < 0 AND abs(variance) >= cutTolerance
//   Fill:  variance > 0 AND abs(variance) >= fillTolerance
//   On Grade: abs(variance) < applicable tolerance
//
// MATCHING RULE
// -------------
//   Points are matched by coordinate, NOT by point name.
//   The coordinate key is:  `${northing.toFixed(3)}|${easting.toFixed(3)}`
//   Normalising to 3 decimal places absorbs minor rounding differences between
//   the two files.  The As-Built point name is always used in the final report.
// ---------------------------------------------------------------------------

import type {
  RawAsBuiltPoint,
  RawDesignPoint,
  CalculatedPoint,
  CutFillStatus,
  MatchResult,
  ReportSummary,
  ToleranceConfig,
} from "@/src/types/stabSheet";

// ---------------------------------------------------------------------------
// Coordinate key
// ---------------------------------------------------------------------------

/**
 * Builds a lookup key from a northing/easting pair.
 * Normalised to 3 decimal places so tiny floating-point differences between
 * the as-built and design files do not prevent a match.
 *
 * Example:  coordKey(668030.0914, 1242096.3139)  →  "668030.091|1242096.314"
 */
export function coordKey(northing: number, easting: number): string {
  return `${northing.toFixed(3)}|${easting.toFixed(3)}`;
}

// ---------------------------------------------------------------------------
// Cut / Fill status (base status without tolerance)
// ---------------------------------------------------------------------------

/**
 * Determines the base Cut / Fill / On Grade from variance.
 * This is the raw calculation before tolerance is applied.
 *
 *   variance < 0 → as-built is ABOVE the target → material must be CUT
 *   variance > 0 → as-built is BELOW the target → area needs FILL
 *   variance = 0 → exactly on grade
 */
function getBaseStatus(variance: number): CutFillStatus {
  if (variance < 0) return "Cut";
  if (variance > 0) return "Fill";
  return "On Grade";
}

// ---------------------------------------------------------------------------
// Tolerance-based status calculation
// ---------------------------------------------------------------------------

// Small epsilon for floating point comparisons
const FP_EPSILON = 1e-9;

/**
 * Determines the final status based on variance and tolerance settings.
 *
 * Tolerance Logic:
 *   Cut:   variance < 0 AND abs(variance) >= cutTolerance
 *   Fill:  variance > 0 AND abs(variance) >= fillTolerance
 *   On Grade: abs(variance) < applicable tolerance
 *
 * Equal to tolerance counts as Cut or Fill (highlighted).
 * Only values strictly below tolerance are considered On Grade.
 *
 * @param variance - Signed variance (negative=cut, positive=fill)
 * @param tolerance - Tolerance configuration with cut and fill thresholds
 * @returns Final status after applying tolerance rules
 */
function applyTolerance(
  variance: number,
  tolerance: ToleranceConfig
): CutFillStatus {
  const absVariance = Math.abs(variance);

  if (variance < 0) {
    // Cut: negative variance, check against cut tolerance
    // Equal to or greater than tolerance = Cut
    // Less than tolerance = On Grade
    return absVariance + FP_EPSILON >= tolerance.cutTolerance ? "Cut" : "On Grade";
  }

  if (variance > 0) {
    // Fill: positive variance, check against fill tolerance
    // Equal to or greater than tolerance = Fill
    // Less than tolerance = On Grade
    return absVariance + FP_EPSILON >= tolerance.fillTolerance ? "Fill" : "On Grade";
  }

  return "On Grade";
}

// ---------------------------------------------------------------------------
// Single-point calculation
// ---------------------------------------------------------------------------

/**
 * Calculates all derived fields for one matched pair of as-built / design points.
 * Applies tolerance rules to determine the final status.
 *
 * @param asBuilt         - Point from the As-Built file
 * @param designElevation - Design elevation resolved from the Design file
 * @param designThickness - Thickness entered in the report form
 * @param tolerance       - Tolerance configuration for cut/fill highlighting
 */
function calculatePoint(
  asBuilt: RawAsBuiltPoint,
  designElevation: number,
  designThickness: number,
  tolerance: ToleranceConfig
): CalculatedPoint {
  // Step 1: subtract design thickness to get the target finished-surface elevation
  const adjustedDesignElevation = designElevation - designThickness;

  // Step 2: calculate variance (adjustedDesign - asBuilt)
  // Negative = Cut (point is high), Positive = Fill (point is low)
  const variance = adjustedDesignElevation - asBuilt.asBuiltElevation;
  const absVariance = Math.abs(variance);

  // Step 3: apply tolerance rules to get final status
  const status = applyTolerance(variance, tolerance);

  return {
    // Use the As-Built point name as the report identifier
    pointId: asBuilt.pointId,
    northing: asBuilt.northing,
    easting: asBuilt.easting,
    asBuiltElevation: asBuilt.asBuiltElevation,
    designElevation,
    adjustedDesignElevation,
    variance,
    status,
    absVariance,
  };
}

// ---------------------------------------------------------------------------
// Coordinate-based matching + batch calculation
// ---------------------------------------------------------------------------

/**
 * Matches as-built points to design points by coordinate key, then calculates
 * cut/fill for every matched pair. Applies tolerance rules to determine
 * final status for highlighting.
 *
 * Points that cannot be matched are collected into separate unmatched lists
 * and are NOT included in cut/fill totals.
 *
 * @param asBuiltPoints  - Parsed rows from the As-Built file
 * @param designPoints   - Parsed rows from the Design file
 * @param designThickness - From the report info form
 * @param tolerance       - Tolerance configuration (defaults to zero tolerance if not provided)
 * @returns               MatchResult with matched, unmatchedAsBuilt, unmatchedDesign
 */
export function matchAndCalculate(
  asBuiltPoints: RawAsBuiltPoint[],
  designPoints: RawDesignPoint[],
  designThickness: number,
  tolerance?: ToleranceConfig
): MatchResult {
  // Default tolerance: zero tolerance (all cuts/fills are reported)
  const effectiveTolerance: ToleranceConfig = tolerance ?? {
    cutTolerance: 0,
    fillTolerance: 0,
    cutHighlightColor: "#ffcccc",
    fillHighlightColor: "#fff4cc",
  };
  // Build a lookup map: coordKey → design point
  // This allows O(1) lookup for each as-built point instead of O(n²) scanning.
  const designByCoord = new Map<string, RawDesignPoint>();
  for (const dp of designPoints) {
    designByCoord.set(coordKey(dp.northing, dp.easting), dp);
  }

  const matched: CalculatedPoint[] = [];
  const unmatchedAsBuilt: RawAsBuiltPoint[] = [];

  // Walk every as-built point and look for a design point at the same location
  for (const ab of asBuiltPoints) {
    const key = coordKey(ab.northing, ab.easting);
    const designPoint = designByCoord.get(key);

    if (designPoint) {
      // Found a match – calculate cut/fill with tolerance and record it
      matched.push(calculatePoint(ab, designPoint.designElevation, designThickness, effectiveTolerance));
      // Remove from map so we can detect leftover design-only points afterwards
      designByCoord.delete(key);
    } else {
      // No design point at this coordinate
      unmatchedAsBuilt.push(ab);
    }
  }

  // Any design points still in the map had no corresponding as-built point
  const unmatchedDesign = Array.from(designByCoord.values());

  return { matched, unmatchedAsBuilt, unmatchedDesign };
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/**
 * Builds aggregate counts from a MatchResult for the summary cards.
 */
export function buildSummary(result: MatchResult): ReportSummary {
  return {
    matchedCount: result.matched.length,
    cutCount: result.matched.filter((p) => p.status === "Cut").length,
    fillCount: result.matched.filter((p) => p.status === "Fill").length,
    onGradeCount: result.matched.filter((p) => p.status === "On Grade").length,
    unmatchedAsBuiltCount: result.unmatchedAsBuilt.length,
    unmatchedDesignCount: result.unmatchedDesign.length,
  };
}

// ---------------------------------------------------------------------------
// Display helpers
// ---------------------------------------------------------------------------

/**
 * Rounds a number to 3 decimal places for display.
 * Raw numeric values are always kept at full precision on the data objects.
 */
export function round3(value: number): string {
  return value.toFixed(3);
}

/**
 * Formats a signed variance value for display.
 * Always includes the sign (+ or -) and 3 decimal places.
 * Examples: -0.020, +0.040, -0.011, +0.008
 */
export function formatSignedVariance(variance: number): string {
  const sign = variance >= 0 ? "+" : "";
  return `${sign}${variance.toFixed(3)}`;
}
