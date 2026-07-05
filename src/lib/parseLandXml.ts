// ---------------------------------------------------------------------------
// parseLandXml.ts
//
// Parses a LandXML file and extracts horizontal alignment geometry.
//
// Supported geometry elements (LandXML v1):
//   Line  – tangent straight segment
//   Curve – circular arc (constant radius)
//
// Public API:
//   parseLandXmlAlignment(xmlText) → ParsedAlignment[]
//
// The caller is responsible for selecting which alignment to use when
// multiple alignments are present (the UI shows a dropdown).
// ---------------------------------------------------------------------------

import type {
  ParsedAlignment,
  AlignmentSegment,
  AlignmentLine,
  AlignmentCurve,
} from "@/src/types/stabSheet";

// ---------------------------------------------------------------------------
// Result type
// ---------------------------------------------------------------------------

export interface LandXmlParseResult {
  alignments: ParsedAlignment[];
  error: string | null;
  warnings: string[];
}

// ---------------------------------------------------------------------------
// XML attribute helpers
// ---------------------------------------------------------------------------

function attr(el: Element, name: string): string {
  return el.getAttribute(name) ?? "";
}

function attrFloat(el: Element, name: string): number {
  return parseFloat(el.getAttribute(name) ?? "NaN");
}

/**
 * Parses a space-separated coordinate pair "northing easting" from a text
 * node or attribute. LandXML uses N E order in coordinate text content.
 */
function parseNE(raw: string): { n: number; e: number } | null {
  const parts = raw.trim().split(/\s+/);
  if (parts.length < 2) return null;
  const n = parseFloat(parts[0]);
  const e = parseFloat(parts[1]);
  if (isNaN(n) || isNaN(e)) return null;
  return { n, e };
}

/** Returns the text content of the first matching child element, or null. */
function childText(parent: Element, tagName: string): string | null {
  const child = parent.getElementsByTagName(tagName)[0];
  return child ? child.textContent ?? null : null;
}

// ---------------------------------------------------------------------------
// Segment parsers
// ---------------------------------------------------------------------------

/**
 * Parses a <Line> element.
 * Expected child elements: <Start> and <End> containing "N E" text.
 * Length is read from the len="" attribute; if absent, computed from coords.
 */
function parseLine(
  el: Element,
  staStart: number,
  warnings: string[]
): AlignmentLine | null {
  const startText = childText(el, "Start");
  const endText   = childText(el, "End");

  if (!startText || !endText) {
    warnings.push(`<Line> skipped – missing <Start> or <End> child element.`);
    return null;
  }

  const start = parseNE(startText);
  const end   = parseNE(endText);

  if (!start || !end) {
    warnings.push(`<Line> skipped – could not parse coordinates from <Start>/<End>.`);
    return null;
  }

  let length = attrFloat(el, "length");
  if (isNaN(length) || length <= 0) length = attrFloat(el, "len");
  if (isNaN(length) || length <= 0) {
    // Compute from Euclidean distance if attribute is missing or zero
    const dN = end.n - start.n;
    const dE = end.e - start.e;
    length = Math.sqrt(dN * dN + dE * dE);
  }

  return {
    type: "Line",
    startN: start.n,
    startE: start.e,
    endN: end.n,
    endE: end.e,
    length,
    staStart,
  };
}

/**
 * Parses a <Curve> element.
 * Expected child elements: <Start>, <End>, <Center> containing "N E" text.
 * Radius from radius="" attribute; length from len="" attribute.
 * Rotation from rot="" attribute: "cw" or "ccw".
 */
function parseCurve(
  el: Element,
  staStart: number,
  warnings: string[]
): AlignmentCurve | null {
  const startText  = childText(el, "Start");
  const endText    = childText(el, "End");
  const centerText = childText(el, "Center");

  if (!startText || !endText || !centerText) {
    warnings.push(`<Curve> skipped – missing <Start>, <End>, or <Center> child element.`);
    return null;
  }

  const start  = parseNE(startText);
  const end    = parseNE(endText);
  const center = parseNE(centerText);

  if (!start || !end || !center) {
    warnings.push(`<Curve> skipped – could not parse coordinates.`);
    return null;
  }

  let radius = attrFloat(el, "radius");
  if (isNaN(radius) || radius <= 0) {
    // Derive radius from distance between center and start
    const dN = start.n - center.n;
    const dE = start.e - center.e;
    radius = Math.sqrt(dN * dN + dE * dE);
  }

  let length = attrFloat(el, "length");
  if (isNaN(length) || length <= 0) length = attrFloat(el, "len");
  if (isNaN(length) || length <= 0) {
    warnings.push(`<Curve> – missing or zero length/len attribute; arc length estimated from geometry.`);
    // Approximate arc length from chord and radius
    const chordN = end.n - start.n;
    const chordE = end.e - start.e;
    const chordLen = Math.sqrt(chordN * chordN + chordE * chordE);
    const halfAngle = Math.asin(Math.min(chordLen / (2 * radius), 1));
    length = 2 * halfAngle * radius;
  }

  const rotRaw = attr(el, "rot").toLowerCase().trim();
  const rot: "cw" | "ccw" = rotRaw === "cw" ? "cw" : "ccw";

  return {
    type: "Curve",
    startN: start.n,
    startE: start.e,
    endN: end.n,
    endE: end.e,
    centerN: center.n,
    centerE: center.e,
    radius,
    length,
    rot,
    staStart,
  };
}

// ---------------------------------------------------------------------------
// Alignment parser
// ---------------------------------------------------------------------------

function parseAlignment(
  el: Element,
  warnings: string[]
): ParsedAlignment | null {
  const name    = attr(el, "name") || attr(el, "desc") || "Unnamed Alignment";
  const staStart = attrFloat(el, "staStart");
  const startStation = isNaN(staStart) ? 0 : staStart;

  // Find the CoordGeom child
  const coordGeomEls = el.getElementsByTagName("CoordGeom");
  if (coordGeomEls.length === 0) {
    warnings.push(`Alignment "${name}" skipped – no <CoordGeom> found.`);
    return null;
  }
  const coordGeom = coordGeomEls[0];

  const segments: AlignmentSegment[] = [];
  let runningStation = startStation;

  for (let i = 0; i < coordGeom.childNodes.length; i++) {
    const node = coordGeom.childNodes[i];
    if (node.nodeType !== Node.ELEMENT_NODE) continue;
    const child = node as Element;

    const tagName = child.tagName || child.nodeName;

    if (tagName === "Line" || tagName.endsWith(":Line")) {
      const seg = parseLine(child, runningStation, warnings);
      if (seg) {
        segments.push(seg);
        runningStation += seg.length;
      }
    } else if (tagName === "Curve" || tagName.endsWith(":Curve")) {
      const seg = parseCurve(child, runningStation, warnings);
      if (seg) {
        segments.push(seg);
        runningStation += seg.length;
      }
    }
    // Spiral / other elements are ignored for v1
  }

  if (segments.length === 0) {
    warnings.push(`Alignment "${name}" has no supported geometry segments (Line/Curve).`);
    return null;
  }

  const totalLength = runningStation - startStation;

  return {
    name,
    staStart: startStation,
    length: totalLength,
    segments,
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

/**
 * Parses a LandXML text string and returns all valid alignments found.
 *
 * @param xmlText - Raw XML file content
 * @returns alignments array, plus any errors or warnings encountered
 */
export function parseLandXmlAlignment(xmlText: string): LandXmlParseResult {
  const warnings: string[] = [];

  // Use the browser DOM parser (runs client-side only)
  let doc: Document;
  try {
    const parser = new DOMParser();
    doc = parser.parseFromString(xmlText, "application/xml");
  } catch {
    return { alignments: [], error: "Failed to parse XML – file may be malformed.", warnings };
  }

  // Check for parser errors embedded in the document
  const parseErrors = doc.getElementsByTagName("parsererror");
  if (parseErrors.length > 0) {
    const msg = parseErrors[0].textContent ?? "Unknown XML parse error.";
    return { alignments: [], error: `XML parse error: ${msg.slice(0, 200)}`, warnings };
  }

  // LandXML may use namespace prefixes; search broadly
  const alignmentEls = doc.getElementsByTagName("Alignment");
  if (alignmentEls.length === 0) {
    return {
      alignments: [],
      error: "No <Alignment> elements found in the uploaded XML file.",
      warnings,
    };
  }

  const alignments: ParsedAlignment[] = [];
  for (let i = 0; i < alignmentEls.length; i++) {
    const al = parseAlignment(alignmentEls[i], warnings);
    if (al) alignments.push(al);
  }

  if (alignments.length === 0) {
    return {
      alignments: [],
      error: "No valid alignment geometry could be read from the XML file.",
      warnings,
    };
  }

  return { alignments, error: null, warnings };
}
