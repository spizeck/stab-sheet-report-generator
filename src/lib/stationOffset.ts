// ---------------------------------------------------------------------------
// stationOffset.ts
//
// Station and offset calculations for points relative to a road centerline
// defined by a ParsedAlignment (LandXML geometry).
//
// Supported segment types:
//   Line  – perpendicular projection onto the tangent
//   Curve – radial projection from the arc center
//
// Public API:
//   calculateStationOffset(point, alignment) → StationOffsetResult
//   formatStation(station)                   → "12+45.67"
//   formatOffset(offset, side)               → "L 12.34"
//   applyStationOffsets(points, alignment)   → CalculatedPoint[] with SO data
// ---------------------------------------------------------------------------

import type {
  ParsedAlignment,
  AlignmentLine,
  AlignmentCurve,
  StationOffsetResult,
  StationOffsetWarning,
  OffsetSide,
  CalculatedPoint,
} from "@/src/types/stabSheet";

// ---------------------------------------------------------------------------
// Formatting helpers
// ---------------------------------------------------------------------------

/**
 * Formats a raw station distance into standard road station notation.
 * 1000.00  → "10+00.00"
 * 1245.67  → "12+45.67"
 * 500.5    → "5+00.50"
 */
export function formatStation(station: number): string {
  const hundreds = Math.floor(station / 100);
  const remainder = station - hundreds * 100;
  return `${hundreds}+${remainder.toFixed(2).padStart(5, "0")}`;
}

/**
 * Formats an offset distance and side into a display string.
 * (12.34, "L") → "L 12.34"
 * (0.00,  "R") → "R 0.00"
 */
export function formatOffset(offset: number, side: OffsetSide): string {
  return `${side} ${offset.toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Vector math helpers
// ---------------------------------------------------------------------------

/** 2D dot product */
function dot(ax: number, ay: number, bx: number, by: number): number {
  return ax * bx + ay * by;
}

/** 2D cross product (scalar z-component) */
function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

// ---------------------------------------------------------------------------
// Line segment projection
// ---------------------------------------------------------------------------

interface LineProjection {
  station: number;
  offset: number;
  side: OffsetSide;
  t: number; // parametric [0,1] along segment
}

/**
 * Projects a point perpendicularly onto an infinite line defined by the
 * segment tangent, then checks if the foot lies within [0, segment.length].
 *
 * Uses the standard (x=E, y=N) right-handed coordinate plane, where
 * positive cross product means the point is to the LEFT of the direction
 * of travel (LandXML / map convention).
 *
 * Returns null if the perpendicular foot is outside the segment.
 */
function projectOntoLine(
  seg: AlignmentLine,
  pN: number,
  pE: number
): LineProjection | null {
  // Direction vector of segment in (E, N) coordinates
  const dE = seg.endE - seg.startE;
  const dN = seg.endN - seg.startN;
  const segLen = Math.sqrt(dE * dE + dN * dN);
  if (segLen < 1e-10) return null;

  // Unit tangent
  const tE = dE / segLen;
  const tN = dN / segLen;

  // Vector from segment start to point in (E, N) coordinates
  const vE = pE - seg.startE;
  const vN = pN - seg.startN;

  // Parametric projection distance along tangent
  const along = dot(vE, vN, tE, tN);

  // Use a small epsilon to keep the bounds half-open: [epsilon, segLen-epsilon].
  // This avoids treating endpoint hits as valid projections when the same
  // endpoint is also the start of the next segment.
  const EPS = 1e-6;
  if (along < EPS || along > segLen - EPS) return null;

  // Signed perpendicular distance.
  // cross(tE, tN, vE, vN) = tE*vN - tN*vE
  // Positive → point is to the LEFT of the direction of travel.
  const signed = cross(tE, tN, vE, vN);
  const offset = Math.abs(signed);
  const side: OffsetSide = signed >= 0 ? "L" : "R";

  return {
    station: seg.staStart + along,
    offset,
    side,
    t: along / segLen,
  };
}

// ---------------------------------------------------------------------------
// Curve segment projection
// ---------------------------------------------------------------------------

interface CurveProjection {
  station: number;
  offset: number;
  side: OffsetSide;
  angleParam: number; // arc angle from start, in radians
}

/**
 * Projects a point radially from the curve center onto the arc.
 * The station along the arc is computed from the swept angle.
 *
 * Uses the standard (x=E, y=N) right-handed coordinate plane, matching the
 * LandXML "dir" convention (0 = east, angle increases counter-clockwise).
 *
 * Returns null if the radial foot is outside the arc's angular extent.
 */
function projectOntoCurve(
  seg: AlignmentCurve,
  pN: number,
  pE: number
): CurveProjection | null {
  // Vector from center to point in (E, N) coordinates
  const vE = pE - seg.centerE;
  const vN = pN - seg.centerN;
  const distToCenter = Math.sqrt(vE * vE + vN * vN);
  if (distToCenter < 1e-10) return null;

  // Total arc angle
  const totalAngle = seg.length / seg.radius;

  // Standard polar angle from the +E axis, CCW toward +N.
  // This is the LandXML "dir" convention.
  const startE = seg.startE - seg.centerE;
  const startN = seg.startN - seg.centerN;
  const angleToStart = Math.atan2(startN, startE);

  const angleToPoint = Math.atan2(vN, vE);

  // Helper: bring any angle into [0, 2π)
  const normalize = (a: number) => {
    let x = a % (2 * Math.PI);
    if (x < 0) x += 2 * Math.PI;
    return x;
  };

  // Swept angle from start to point, accounting for rotation direction.
  // For CCW we use the non-negative CCW angle; for CW we use the
  // non-negative CW angle.
  let swept: number;
  if (seg.rot === "ccw") {
    swept = normalize(angleToPoint - angleToStart);
  } else {
    swept = normalize(angleToStart - angleToPoint);
  }

  // Check if the projection falls within the arc extent
  if (swept > totalAngle + 1e-9) return null;

  // Clamp to avoid tiny numerical overruns
  swept = Math.min(swept, totalAngle);

  // Arc station
  const arcDistance = swept * seg.radius;
  const station = seg.staStart + arcDistance;

  // Offset: distance from center minus radius
  const offset = Math.abs(distToCenter - seg.radius);

  // Unit radial from center to the point in (E, N)
  const radE = vE / distToCenter;
  const radN = vN / distToCenter;

  // Tangent at the projected arc point, in (E, N).
  // For a CCW arc: rotate radial 90° CCW → (-radN,  radE)
  // For a CW arc:  rotate radial 90° CW  → ( radN, -radE)
  let tangE: number, tangN: number;
  if (seg.rot === "ccw") {
    tangE = -radN;
    tangN =  radE;
  } else {
    tangE =  radN;
    tangN = -radE;
  }

  // The point's offset vector relative to its projection on the arc.
  // projection = center + radius * (radE, radN)
  const offsetE = vE - seg.radius * radE;
  const offsetN = vN - seg.radius * radN;

  // cross(tangent, offsetVector) > 0 means the point is to the LEFT
  // of the direction of travel.
  const signed = cross(tangE, tangN, offsetE, offsetN);
  const side: OffsetSide = signed >= 0 ? "L" : "R";

  return {
    station,
    offset,
    side,
    angleParam: swept,
  };
}

// ---------------------------------------------------------------------------
// Best-candidate selection
// ---------------------------------------------------------------------------

interface Candidate {
  station: number;
  offset: number;
  side: OffsetSide;
  segmentType: "Line" | "Curve";
}

// ---------------------------------------------------------------------------
// Public: calculateStationOffset
// ---------------------------------------------------------------------------

/**
 * Calculates the station and offset of a point relative to an alignment.
 *
 * Algorithm:
 *  1. For each segment, attempt projection (perpendicular for Line, radial for Curve).
 *  2. Collect all valid projections (foot lies within segment bounds).
 *  3. If exactly one valid projection: use it.
 *  4. If multiple valid projections (near segment junctions): pick closest offset.
 *  5. If no valid projection: warn OUTSIDE_ALIGNMENT_LIMITS and return nearest endpoint.
 *
 * @param northing  - Point northing
 * @param easting   - Point easting
 * @param alignment - Parsed alignment
 */
export function calculateStationOffset(
  northing: number,
  easting: number,
  alignment: ParsedAlignment
): StationOffsetResult {
  const candidates: Candidate[] = [];

  for (const seg of alignment.segments) {
    if (seg.type === "Line") {
      const proj = projectOntoLine(seg as AlignmentLine, northing, easting);
      if (proj) {
        candidates.push({
          station: proj.station,
          offset: proj.offset,
          side: proj.side,
          segmentType: "Line",
        });
      }
    } else if (seg.type === "Curve") {
      const proj = projectOntoCurve(seg as AlignmentCurve, northing, easting);
      if (proj) {
        candidates.push({
          station: proj.station,
          offset: proj.offset,
          side: proj.side,
          segmentType: "Curve",
        });
      }
    }
  }

  let warning: StationOffsetWarning = "OK";
  let best: Candidate;

  if (candidates.length === 0) {
    // Point is outside all segment extents – find nearest endpoint station
    warning = "OUTSIDE_ALIGNMENT_LIMITS";
    best = nearestEndpoint(alignment, northing, easting);
  } else if (candidates.length > 1) {
    // Multiple projections (point is near a segment junction) – pick minimum offset
    warning = "AMBIGUOUS_PROJECTION";
    best = candidates.reduce((a, b) => (a.offset <= b.offset ? a : b));
  } else {
    best = candidates[0];
  }

  const stationFormatted = formatStation(best.station);
  const offsetFormatted  = formatOffset(best.offset, best.side);

  return {
    station: best.station,
    stationFormatted,
    offset: best.offset,
    side: best.side,
    offsetFormatted,
    segmentType: best.segmentType,
    warning,
  };
}

// ---------------------------------------------------------------------------
// Nearest-endpoint fallback (for outside alignment limits)
// ---------------------------------------------------------------------------

function nearestEndpoint(
  alignment: ParsedAlignment,
  pN: number,
  pE: number
): Candidate {
  // Build list of segment endpoints
  const points: { n: number; e: number; station: number; segType: "Line" | "Curve" }[] = [];

  for (const seg of alignment.segments) {
    points.push({ n: seg.startN, e: seg.startE, station: seg.staStart, segType: seg.type });
    const endStation = seg.staStart + seg.length;
    points.push({ n: seg.endN, e: seg.endE, station: endStation, segType: seg.type });
  }

  let bestDist = Infinity;
  let bestPt = points[0];
  for (const pt of points) {
    const dN = pN - pt.n;
    const dE = pE - pt.e;
    const dist = Math.sqrt(dN * dN + dE * dE);
    if (dist < bestDist) {
      bestDist = dist;
      bestPt = pt;
    }
  }

  return {
    station: bestPt.station,
    offset: bestDist,
    side: "R", // side is undefined for out-of-range points; use R as placeholder
    segmentType: bestPt.segType,
  };
}

// ---------------------------------------------------------------------------
// Batch helper: annotate CalculatedPoint array with station/offset
// ---------------------------------------------------------------------------

/**
 * Extends a MatchResult matched array with station/offset data appended
 * as extra fields. Returns a new array; original objects are not mutated.
 */
export function applyStationOffsets(
  points: CalculatedPoint[],
  alignment: ParsedAlignment
): (CalculatedPoint & { stationOffset: StationOffsetResult })[] {
  return points.map((pt) => ({
    ...pt,
    stationOffset: calculateStationOffset(pt.northing, pt.easting, alignment),
  }));
}
