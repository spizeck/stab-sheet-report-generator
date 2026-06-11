// ---------------------------------------------------------------------------
// parseSurveyFile.ts
//
// Parses delimited survey files (CSV, TSV, semicolon) into typed raw-point
// arrays. Two public functions are exported:
//
//   parseAsBuiltFile(content)  →  AsBuiltParseResult  (elevation = field measurement)
//   parseDesignFile(content)   →  DesignParseResult   (elevation = design/finished grade)
//
// SUPPORTED FILE FORMATS
// ----------------------
//  Headered  (any col order):  recognised by header aliases below
//  Headerless 4-col (PNED):    Point | Northing | Easting | Elevation
//  Headerless 5-col:           Point | Northing | Easting | Elev1 | Elev2
//    (5-col headerless: col 3 = design elev, col 4 = as-built elev)
// ---------------------------------------------------------------------------

import type { RawAsBuiltPoint, RawDesignPoint } from "@/src/types/stabSheet";

// ---------------------------------------------------------------------------
// Header alias maps – add new aliases here as needed
// ---------------------------------------------------------------------------

const POINT_ID_ALIASES = new Set([
  "point id", "pointid", "point", "pt", "pt id", "pt. id", "point_id", "name",
]);

const NORTHING_ALIASES = new Set([
  "northing", "north", "n", "y", "northing (ft)", "northing(ft)",
]);

const EASTING_ALIASES = new Set([
  "easting", "east", "e", "x", "easting (ft)", "easting(ft)",
]);

const DESIGN_ELEV_ALIASES = new Set([
  "design elevation", "design elev", "designelev", "designel", "design z",
  "design_elev", "design_elevation", "desn elev", "des elev", "design ht",
  "design height", "finished grade", "fg", "fg elev",
]);

const AS_BUILT_ELEV_ALIASES = new Set([
  "as-built elevation", "as built elevation", "as-built elev", "as built elev",
  "asbuiltelev", "as built z", "asbuilt z", "as-built z", "as_built_elev",
  "as_built_elevation", "ab elev", "field elev", "measured elev",
  "observed elev", "surveyed elev",
]);

// Generic elevation aliases – used when a file has only one elevation column
// and no specific header to distinguish design vs as-built.
const GENERIC_ELEV_ALIASES = new Set([
  "elev", "elevation", "z", "ht", "height",
]);

// ---------------------------------------------------------------------------
// Result types
// ---------------------------------------------------------------------------

export interface AsBuiltParseResult {
  points: RawAsBuiltPoint[];
  warnings: string[];
  error: string | null;
}

export interface DesignParseResult {
  points: RawDesignPoint[];
  warnings: string[];
  error: string | null;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function detectDelimiter(firstLine: string): string {
  const counts: Record<string, number> = {
    ",": (firstLine.match(/,/g) || []).length,
    ";": (firstLine.match(/;/g) || []).length,
    "\t": (firstLine.match(/\t/g) || []).length,
  };
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

function splitLine(line: string, delimiter: string): string[] {
  return line.split(delimiter).map((cell) => cell.trim());
}

function normalizeHeader(token: string): string {
  return token.toLowerCase().replace(/\s+/g, " ").trim();
}

function matchAlias(token: string, aliases: Set<string>): boolean {
  return aliases.has(normalizeHeader(token));
}

function findColumnIndex(headers: string[], aliases: Set<string>): number {
  return headers.findIndex((h) => matchAlias(h, aliases));
}

/**
 * True if the majority of cells in a row are non-numeric.
 * Used to detect whether the first row is a header.
 */
function looksLikeHeader(cells: string[]): boolean {
  const nonNumericCount = cells.filter((c) => isNaN(parseFloat(c))).length;
  return nonNumericCount > cells.length / 2;
}

/** Prepare lines: normalise endings, drop blanks. */
function prepareLines(fileContent: string): string[] {
  return fileContent
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .filter((line) => line.trim().length > 0);
}

// ---------------------------------------------------------------------------
// Internal column-map types
// ---------------------------------------------------------------------------

interface BaseColumnMap {
  colPointId: number;
  colNorthing: number;
  colEasting: number;
  colElev: number;
}

/** Find Point / Northing / Easting / one-elevation from headers. */
function resolveBaseFromHeaders(
  headers: string[],
  elevAliases: Set<string>
): BaseColumnMap | null {
  const colPointId = findColumnIndex(headers, POINT_ID_ALIASES);
  const colNorthing = findColumnIndex(headers, NORTHING_ALIASES);
  const colEasting  = findColumnIndex(headers, EASTING_ALIASES);

  // Try the specific alias set first, fall back to generic elevation aliases
  let colElev = findColumnIndex(headers, elevAliases);
  if (colElev === -1) colElev = findColumnIndex(headers, GENERIC_ELEV_ALIASES);

  if (colPointId === -1 || colNorthing === -1 || colEasting === -1 || colElev === -1) {
    return null;
  }
  return { colPointId, colNorthing, colEasting, colElev };
}

/**
 * Positional mapping for headerless files.
 *
 * 4-col:  Point | Northing | Easting | Elevation
 * 5-col:  Point | Northing | Easting | Design Elev | As-Built Elev
 *
 * For As-Built files:  elevation is always the LAST column (col 3 or col 4).
 * For Design files:    elevation is always col 3 (the 4th column).
 */
function resolvePositional(
  colCount: number,
  role: "asbuilt" | "design"
): BaseColumnMap | null {
  if (colCount === 4) {
    // 4-column: single elevation in col 3 regardless of role
    return { colPointId: 0, colNorthing: 1, colEasting: 2, colElev: 3 };
  }
  if (colCount >= 5) {
    // 5-column: design = col 3, as-built = col 4
    return {
      colPointId: 0,
      colNorthing: 1,
      colEasting: 2,
      colElev: role === "design" ? 3 : 4,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Shared row parser
// ---------------------------------------------------------------------------

interface ParsedRow {
  pointId: string;
  northing: number;
  easting: number;
  elevation: number;
}

function parseRows(
  lines: string[],
  dataStartIndex: number,
  delimiter: string,
  colMap: BaseColumnMap,
  elevFieldLabel: string,
  warnings: string[]
): ParsedRow[] {
  const rows: ParsedRow[] = [];

  for (let i = dataStartIndex; i < lines.length; i++) {
    const rowNum = i + 1;
    const cells = splitLine(lines[i], delimiter);

    if (cells.every((c) => c === "")) continue;

    const pointId  = cells[colMap.colPointId] ?? "";
    const northing  = parseFloat(cells[colMap.colNorthing] ?? "");
    const easting   = parseFloat(cells[colMap.colEasting]  ?? "");
    const elevation = parseFloat(cells[colMap.colElev]     ?? "");

    const bad: string[] = [];
    if (isNaN(northing))  bad.push("Northing");
    if (isNaN(easting))   bad.push("Easting");
    if (isNaN(elevation)) bad.push(elevFieldLabel);

    if (bad.length > 0) {
      warnings.push(`Row ${rowNum} skipped – invalid number in: ${bad.join(", ")}.`);
      continue;
    }

    rows.push({ pointId: pointId || `Row ${rowNum}`, northing, easting, elevation });
  }

  return rows;
}

// ---------------------------------------------------------------------------
// Shared file-parsing entry point
// ---------------------------------------------------------------------------

function parseFile(
  fileContent: string,
  role: "asbuilt" | "design"
): { rows: ParsedRow[]; warnings: string[]; error: string | null } {
  const warnings: string[] = [];

  const lines = prepareLines(fileContent);
  if (lines.length === 0) {
    return { rows: [], warnings, error: "The uploaded file appears to be empty." };
  }

  const delimiter = detectDelimiter(lines[0]);
  const firstRowCells = splitLine(lines[0], delimiter);
  const hasHeader = looksLikeHeader(firstRowCells);

  const elevAliases = role === "asbuilt" ? AS_BUILT_ELEV_ALIASES : DESIGN_ELEV_ALIASES;
  const elevLabel   = role === "asbuilt" ? "As-Built Elevation"   : "Design Elevation";

  let colMap: BaseColumnMap | null = null;
  let dataStart = 0;

  if (hasHeader) {
    colMap = resolveBaseFromHeaders(firstRowCells, elevAliases);
    dataStart = 1;

    if (!colMap) {
      const missing: string[] = [];
      if (findColumnIndex(firstRowCells, POINT_ID_ALIASES)  === -1) missing.push("Point ID");
      if (findColumnIndex(firstRowCells, NORTHING_ALIASES)  === -1) missing.push("Northing");
      if (findColumnIndex(firstRowCells, EASTING_ALIASES)   === -1) missing.push("Easting");
      missing.push(elevLabel + " (no matching column found)");
      return {
        rows: [],
        warnings,
        error:
          `Could not find required column(s): ${missing.join(", ")}. ` +
          `Headers detected: ${firstRowCells.join(", ")}`,
      };
    }
  } else {
    colMap = resolvePositional(firstRowCells.length, role);
    dataStart = 0;

    if (!colMap) {
      return {
        rows: [],
        warnings,
        error:
          `Unrecognised file format. Expected 4 or 5 columns (no header detected). ` +
          `Found ${firstRowCells.length} column(s) in the first row.`,
      };
    }
  }

  const rows = parseRows(lines, dataStart, delimiter, colMap, elevLabel, warnings);

  if (rows.length === 0) {
    return {
      rows: [],
      warnings,
      error: "No valid data rows were found. Check that the file contains numeric values.",
    };
  }

  return { rows, warnings, error: null };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parses an As-Built survey file.
 * Expects: Point ID, Northing, Easting, As-Built Elevation
 * (4-column headerless files are supported – the 4th column is the elevation)
 */
export function parseAsBuiltFile(fileContent: string): AsBuiltParseResult {
  const { rows, warnings, error } = parseFile(fileContent, "asbuilt");
  if (error) return { points: [], warnings, error };

  const points: RawAsBuiltPoint[] = rows.map((r) => ({
    pointId: r.pointId,
    northing: r.northing,
    easting: r.easting,
    asBuiltElevation: r.elevation,
  }));

  return { points, warnings, error: null };
}

/**
 * Parses a Design survey file.
 * Expects: Point ID, Northing, Easting, Design Elevation
 * (4-column headerless files are supported – the 4th column is the elevation)
 */
export function parseDesignFile(fileContent: string): DesignParseResult {
  const { rows, warnings, error } = parseFile(fileContent, "design");
  if (error) return { points: [], warnings, error };

  const points: RawDesignPoint[] = rows.map((r) => ({
    pointId: r.pointId,
    northing: r.northing,
    easting: r.easting,
    designElevation: r.elevation,
  }));

  return { points, warnings, error: null };
}
