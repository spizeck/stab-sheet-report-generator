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
  AlignmentSegment,
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
 * Returns null if the perpendicular foot is outside the segment.
 */
function projectOntoLine(
  seg: AlignmentLine,
  pN: number,
  pE: number
): LineProjection | null {
  // Direction vector of segment (N, E)
  const dN = seg.endN - seg.startN;
  const dE = seg.endE - seg.startE;
  const segLen = Math.sqrt(dN * dN + dE * dE);
  if (segLen < 1e-10) return null;

  // Unit tangent
  const tN = dN / segLen;
  const tE = dE / segLen;

  // Vector from segment start to point
  const vN = pN - seg.startN;
  const vE = pE - seg.startE;

  // Parametric projection distance along tangent
  const along = dot(vN, vE, tN, tE);

  // Use a small epsilon to keep the bounds half-open: [epsilon, segLen-epsilon].
  // This avoids treating endpoint hits as valid projections when the same
  // endpoint is also the start of the next segment.
  const EPS = 1e-6;
  if (along < EPS || along > segLen - EPS) return null;

  // Perpendicular (signed) distance.
  // cross(tN, tE, vN, vE) = tN*vE - tE*vN
  // In N/E coords (N=x, E=y), positive cross → point is to the RIGHT of travel;
  // negative cross → point is to the LEFT of travel.
  const signed = cross(tN, tE, vN, vE);
  const offset = Math.abs(signed);
  const side: OffsetSide = signed >= 0 ? "R" : "L";

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
 * Returns null if the radial foot is outside the arc's angular extent.
 */
function projectOntoCurve(
  seg: AlignmentCurve,
  pN: number,
  pE: number
): CurveProjection | null {
  // Vector from center to point
  const vN = pN - seg.centerN;
  const vE = pE - seg.centerE;
  const distToCenter = Math.sqrt(vN * vN + vE * vE);
  if (distToCenter < 1e-10) return null;

  // Total arc angle
  const totalAngle = seg.length / seg.radius;

  // Angle from center to start point
  const startVN = seg.startN - seg.centerN;
  const startVE = seg.startE - seg.centerE;
  const angleToStart = Math.atan2(startVE, startVN);

  // Angle from center to query point
  const angleToPoint = Math.atan2(vE, vN);

  // Swept angle from start to point, accounting for rotation direction
  let swept: number;
  if (seg.rot === "ccw") {
    swept = angleToPoint - angleToStart;
    if (swept < 0) swept += 2 * Math.PI;
  } else {
    // clockwise: angles decrease
    swept = angleToStart - angleToPoint;
    if (swept < 0) swept += 2 * Math.PI;
  }

  // Check if the projection falls within the arc extent
  if (swept < 0 || swept > totalAngle + 1e-9) return null;

  // Clamp to avoid tiny numerical overruns
  swept = Math.min(swept, totalAngle);

  // Arc station
  const arcDistance = swept * seg.radius;
  const station = seg.staStart + arcDistance;

  // Offset: distance from center minus radius
  const offset = Math.abs(distToCenter - seg.radius);

  // Side: inside arc = right of direction of travel for ccw, left for cw
  // More precisely: if distance to center < radius → inside the arc
  // For ccw rotation: inside = right; outside = left
  // Determine using cross product of (start→center) direction and (center→point)
  // The "left" side is defined relative to the direction of travel along the arc.

  // Direction of travel at the projection point on the arc:
  // For ccw: tangent perpendicular CCW from radial = rotate radial 90° CCW
  // unit radial at projection: (vN/distToCenter, vE/distToCenter)
  const radN = vN / distToCenter;
  const radE = vE / distToCenter;

  let tangN: number, tangE: number;
  if (seg.rot === "ccw") {
    tangN = -radE;
    tangE =  radN;
  } else {
    tangN =  radE;
    tangE = -radN;
  }

  // Sign: cross(tangent, radial) in N/E coords.
  // Positive → point is to the RIGHT of direction of travel.
  const signedOffset = cross(tangN, tangE, radN, radE) * distToCenter;
  const side: OffsetSide = signedOffset >= 0 ? "R" : "L";

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
