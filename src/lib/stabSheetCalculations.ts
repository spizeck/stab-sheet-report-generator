// ---------------------------------------------------------------------------
// stabSheetCalculations.ts
//
// Core calculation and coordinate-matching logic.
//
// CALCULATION RULE
// ----------------
//   adjustedDesignElevation = designElevation - designThickness
//   difference               = asBuiltElevation - adjustedDesignElevation
//
//   difference > 0  → "Cut"      (as-built is ABOVE the adjusted design)
//   difference < 0  → "Fill"     (as-built is BELOW the adjusted design)
//   difference = 0  → "On Grade"
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
// Cut / Fill status
// ---------------------------------------------------------------------------

/**
 * Determines Cut / Fill / On Grade from a signed difference value.
 *
 *   positive → as-built is ABOVE the target → material must be CUT
 *   negative → as-built is BELOW the target → area needs FILL
 *   zero     → exactly on grade
 */
function getCutFillStatus(difference: number): CutFillStatus {
  if (difference > 0) return "Cut";
  if (difference < 0) return "Fill";
  return "On Grade";
}

// ---------------------------------------------------------------------------
// Single-point calculation
// ---------------------------------------------------------------------------

/**
 * Calculates all derived fields for one matched pair of as-built / design points.
 *
 * @param asBuilt         - Point from the As-Built file
 * @param designElevation - Design elevation resolved from the Design file
 * @param designThickness - Thickness entered in the report form
 */
function calculatePoint(
  asBuilt: RawAsBuiltPoint,
  designElevation: number,
  designThickness: number
): CalculatedPoint {
  // Step 1: subtract design thickness to get the target finished-surface elevation
  const adjustedDesignElevation = designElevation - designThickness;

  // Step 2: compare actual as-built to that adjusted target
  const difference = asBuilt.asBuiltElevation - adjustedDesignElevation;

  // Step 3: classify as Cut, Fill, or On Grade
  const status = getCutFillStatus(difference);

  return {
    // Use the As-Built point name as the report identifier
    pointId: asBuilt.pointId,
    northing: asBuilt.northing,
    easting: asBuilt.easting,
    asBuiltElevation: asBuilt.asBuiltElevation,
    designElevation,
    adjustedDesignElevation,
    difference,
    status,
    absDifference: Math.abs(difference),
  };
}

// ---------------------------------------------------------------------------
// Coordinate-based matching + batch calculation
// ---------------------------------------------------------------------------

/**
 * Matches as-built points to design points by coordinate key, then calculates
 * cut/fill for every matched pair.
 *
 * Points that cannot be matched are collected into separate unmatched lists
 * and are NOT included in cut/fill totals.
 *
 * @param asBuiltPoints  - Parsed rows from the As-Built file
 * @param designPoints   - Parsed rows from the Design file
 * @param designThickness - From the report info form
 * @returns               MatchResult with matched, unmatchedAsBuilt, unmatchedDesign
 */
export function matchAndCalculate(
  asBuiltPoints: RawAsBuiltPoint[],
  designPoints: RawDesignPoint[],
  designThickness: number
): MatchResult {
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
      // Found a match – calculate cut/fill and record it
      matched.push(calculatePoint(ab, designPoint.designElevation, designThickness));
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
// Display helper
// ---------------------------------------------------------------------------

/**
 * Rounds a number to 3 decimal places for display.
 * Raw numeric values are always kept at full precision on the data objects.
 */
export function round3(value: number): string {
  return value.toFixed(3);
}
