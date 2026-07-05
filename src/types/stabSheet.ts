// ---------------------------------------------------------------------------
// stabSheet.ts – shared TypeScript types for the Stab Sheet Report Generator
// ---------------------------------------------------------------------------

/** Units supported for elevation / thickness entry. Decimal only — no feet-and-inches. */
export type UnitSystem = "feet" | "meters";

/** Tolerance configuration for cut/fill highlighting. */
export interface ToleranceConfig {
  /** Cut tolerance - cuts below this threshold show as On Grade */
  cutTolerance: number;
  /** Fill tolerance - fills below this threshold show as On Grade */
  fillTolerance: number;
  /** CSS color for cut highlight (e.g., "#ffcccc") */
  cutHighlightColor: string;
  /** CSS color for fill highlight (e.g., "#fff4cc") */
  fillHighlightColor: string;
}

/** Report header information filled out by the user. */
export interface ReportInfo {
  stabSheetName: string;
  dateOfCollection: string;
  preparedBy: string;
  projectId: string;
  projectDescription: string;
  /** Design thickness expressed in the selected unit system. */
  designThickness: number;
  unitSystem: UnitSystem;
  /** Tolerance settings for cut/fill classification */
  tolerance: ToleranceConfig;
}

// ---------------------------------------------------------------------------
// Raw parsed points – one type per file role
// ---------------------------------------------------------------------------

/**
 * A point parsed from the As-Built survey file.
 * Contains the field-measured elevation.
 */
export interface RawAsBuiltPoint {
  pointId: string;
  northing: number;
  easting: number;
  asBuiltElevation: number;
}

/**
 * A point parsed from the Design file.
 * Contains the design (finished grade) elevation.
 */
export interface RawDesignPoint {
  pointId: string;
  northing: number;
  easting: number;
  designElevation: number;
}

// ---------------------------------------------------------------------------
// Calculated result types
// ---------------------------------------------------------------------------

/** Status after comparing as-built to adjusted design elevation. */
export type CutFillStatus = "Cut" | "Fill" | "On Grade";

/**
 * A fully calculated stab-sheet row produced when an as-built point is
 * successfully matched to a design point by coordinate.
 * The as-built point name is always used as the display pointId.
 */
export interface CalculatedPoint {
  /** Point name from the As-Built file (used in the report). */
  pointId: string;
  northing: number;
  easting: number;
  asBuiltElevation: number;
  designElevation: number;
  /** designElevation - designThickness */
  adjustedDesignElevation: number;
  /**
   * Variance = adjustedDesignElevation - asBuiltElevation
   * Negative = Cut (point is high, material must be removed)
   * Positive = Fill (point is low, material must be added)
   * Zero = On Grade (exact match)
   */
  variance: number;
  /**
   * Status determined by variance sign and tolerance:
   * Cut: variance < 0 and abs(variance) >= cutTolerance
   * Fill: variance > 0 and abs(variance) >= fillTolerance
   * On Grade: abs(variance) < applicable tolerance
   */
  status: CutFillStatus;
  /** Absolute value of variance (|variance|) */
  absVariance: number;
}

// ---------------------------------------------------------------------------
// Matching result
// ---------------------------------------------------------------------------

/**
 * The full output of matchAndCalculate():
 *   - matched:          points that have both as-built and design data
 *   - unmatchedAsBuilt: as-built points with no corresponding design point
 *   - unmatchedDesign:  design points with no corresponding as-built point
 */
export interface MatchResult {
  matched: CalculatedPoint[];
  unmatchedAsBuilt: RawAsBuiltPoint[];
  unmatchedDesign: RawDesignPoint[];
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

/** Aggregate counts shown in the summary cards. */
export interface ReportSummary {
  matchedCount: number;
  cutCount: number;
  fillCount: number;
  onGradeCount: number;
  unmatchedAsBuiltCount: number;
  unmatchedDesignCount: number;
}

// ---------------------------------------------------------------------------
// LandXML Alignment types
// ---------------------------------------------------------------------------

/** A tangent (straight) segment within an alignment CoordGeom. */
export interface AlignmentLine {
  type: "Line";
  /** Northing of start point */
  startN: number;
  /** Easting of start point */
  startE: number;
  /** Northing of end point */
  endN: number;
  /** Easting of end point */
  endE: number;
  /** Horizontal length of segment */
  length: number;
  /** Station at the start of this segment */
  staStart: number;
}

/** A circular arc segment within an alignment CoordGeom. */
export interface AlignmentCurve {
  type: "Curve";
  /** Northing of start point */
  startN: number;
  /** Easting of start point */
  startE: number;
  /** Northing of end point */
  endN: number;
  /** Easting of end point */
  endE: number;
  /** Northing of curve center */
  centerN: number;
  /** Easting of curve center */
  centerE: number;
  /** Curve radius */
  radius: number;
  /** Arc length */
  length: number;
  /** Rotation direction: "cw" = clockwise, "ccw" = counter-clockwise */
  rot: "cw" | "ccw";
  /** Station at the start of this segment */
  staStart: number;
}

export type AlignmentSegment = AlignmentLine | AlignmentCurve;

/** A parsed LandXML alignment. */
export interface ParsedAlignment {
  /** Alignment name from the XML */
  name: string;
  /** Starting station of the alignment */
  staStart: number;
  /** Total geometric length of all segments */
  length: number;
  /** Ordered list of geometry segments */
  segments: AlignmentSegment[];
}

// ---------------------------------------------------------------------------
// Station/Offset result types
// ---------------------------------------------------------------------------

/** Warning codes for station/offset calculation results. */
export type StationOffsetWarning =
  | "OK"
  | "OUTSIDE_ALIGNMENT_LIMITS"
  | "AMBIGUOUS_PROJECTION"
  | "UNABLE_TO_CALCULATE";

/** Side of centerline: Left or Right */
export type OffsetSide = "L" | "R";

/** Station/offset result for one point relative to a parsed alignment. */
export interface StationOffsetResult {
  /** Raw station value (e.g. 1245.67) */
  station: number;
  /** Formatted station string (e.g. "12+45.67") */
  stationFormatted: string;
  /** Perpendicular offset distance (always positive) */
  offset: number;
  /** Side of the centerline */
  side: OffsetSide;
  /** Formatted offset string (e.g. "L 12.34") */
  offsetFormatted: string;
  /** Type of segment that produced the result */
  segmentType: "Line" | "Curve";
  /** Calculation warning */
  warning: StationOffsetWarning;
}
