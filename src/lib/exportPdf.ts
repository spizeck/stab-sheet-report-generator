// ---------------------------------------------------------------------------
// exportPdf.ts
//
// Generates a stab-sheet PDF report using jsPDF + jspdf-autotable.
// This runs entirely in the browser – nothing is sent to a server.
//
// The PDF contains:
//   1. Report header block (name, date, preparer, project, thickness)
//   2. Summary statistics row
//   3. Matched results table
//   4. Unmatched As-Built table  (omitted when empty)
//   5. Unmatched Design table    (omitted when empty)
// ---------------------------------------------------------------------------

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { ReportInfo, MatchResult, ReportSummary } from "@/src/types/stabSheet";
import { round3 } from "@/src/lib/stabSheetCalculations";

// ---------------------------------------------------------------------------
// Colour palette (R, G, B)
// ---------------------------------------------------------------------------

const COLOR_HEADER_BG:   [number, number, number] = [30,  64, 175]; // blue-800
const COLOR_HEADER_TEXT: [number, number, number] = [255, 255, 255];
const COLOR_SECTION_BG:  [number, number, number] = [241, 245, 249]; // slate-100
const COLOR_CUT:         [number, number, number] = [185,  28,  28]; // red-700
const COLOR_FILL:        [number, number, number] = [21,  128,  61]; // green-700
const COLOR_ON_GRADE:    [number, number, number] = [100, 116, 139]; // slate-500
const COLOR_UNMATCHED_AB:[number, number, number] = [194,  65,  12]; // orange-700
const COLOR_UNMATCHED_D: [number, number, number] = [109,  40, 217]; // violet-700

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Formats a date string "YYYY-MM-DD" to a readable label, or returns as-is. */
function formatDate(raw: string): string {
  if (!raw) return "—";
  const d = new Date(raw + "T00:00:00"); // force local midnight
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
}

/** Unit label for the current unit system. */
function unitLabel(info: ReportInfo): string {
  return info.unitSystem === "meters" ? "m" : "ft";
}

/** Display-friendly unit system name. */
function displayUnitSystem(unitSystem: string): string {
  if (unitSystem === "meters") return "Meters";
  if (unitSystem === "feet") return "Feet";
  return unitSystem;
}

// ---------------------------------------------------------------------------
// Main export function
// ---------------------------------------------------------------------------

/**
 * Builds and triggers a browser download of the stab-sheet PDF.
 *
 * @param reportInfo - Header data from the form
 * @param result     - Matched + unmatched point sets
 * @param summary    - Pre-computed aggregate counts
 */
export function exportPdf(
  reportInfo: ReportInfo,
  result: MatchResult,
  summary: ReportSummary
): void {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 12;
  let cursorY = margin;

  // ── 1. Page header band ─────────────────────────────────────────────────
  doc.setFillColor(...COLOR_HEADER_BG);
  doc.rect(0, 0, pageW, 22, "F");

  doc.setTextColor(...COLOR_HEADER_TEXT);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Stab Sheet Report", margin, 10);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("As-Built Survey Analysis", margin, 16);

  // Generated timestamp (right-aligned)
  const generatedAt = new Date().toLocaleString();
  doc.text(`Generated: ${generatedAt}`, pageW - margin, 16, { align: "right" });

  cursorY = 28;

  // ── 2. Report info block ─────────────────────────────────────────────────
  const ul = unitLabel(reportInfo);
  const col1x = margin + 4;
  const col2x = margin + 85;
  const col3x = margin + 170;
  const lineH = 5.5;

  // Calculate description height first to determine block height
  // Description text starts at col2x + 28 and must end before col3x with padding
  const descWidth = col3x - col2x - 32; // 28 for label offset + 4 padding
  const descText = reportInfo.projectDescription || "—";
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const descLines = doc.splitTextToSize(descText, descWidth);
  const descLineCount = Math.max(1, descLines.length);
  const descHeight = descLineCount * 4 + 2; // 4mm per line + padding

  // Base height for info block (3 lines in col1 + padding)
  const baseBlockHeight = 28;
  // Extra height needed for multi-line description
  const extraHeight = Math.max(0, descHeight - lineH);
  const blockHeight = baseBlockHeight + extraHeight;

  doc.setFillColor(...COLOR_SECTION_BG);
  doc.rect(margin, cursorY, pageW - margin * 2, blockHeight, "F");

  // Left column
  doc.setTextColor(55, 65, 81); // gray-700
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");

  let iy = cursorY + 6;

  function infoRow(x: number, label: string, value: string) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(label, x, iy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(17, 24, 39);
    doc.text(value || "—", x + 28, iy);
  }

  infoRow(col1x, "Report Name:", reportInfo.stabSheetName);
  iy += lineH;
  infoRow(col1x, "Prepared By:", reportInfo.preparedBy);
  iy += lineH;
  infoRow(col1x, "Date:", formatDate(reportInfo.dateOfCollection));
  iy += lineH;
  infoRow(col1x, "Project ID:", reportInfo.projectId);

  iy = cursorY + 6;
  infoRow(col2x, "Units:", displayUnitSystem(reportInfo.unitSystem));
  iy += lineH;
  infoRow(col2x, "Design Thick.:", `${round3(reportInfo.designThickness)} ${ul}`);
  iy += lineH;

  // Description label
  doc.setFont("helvetica", "bold");
  doc.setTextColor(100, 116, 139);
  doc.text("Description:", col2x, iy);
  // Description value - multi-line wrapped text (confined to column 2 area)
  doc.setFont("helvetica", "normal");
  doc.setTextColor(17, 24, 39);
  doc.text(descLines, col2x + 28, iy, { maxWidth: descWidth });

  iy = cursorY + 6;
  // Summary stats in col 3 – Cut, Fill, On Grade only
  const statsLabels = [
    ["Cut:",      String(summary.cutCount)],
    ["Fill:",     String(summary.fillCount)],
    ["On Grade:", String(summary.onGradeCount)],
  ];
  for (const [lbl, val] of statsLabels) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 116, 139);
    doc.text(lbl, col3x, iy);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(17, 24, 39);
    doc.text(val, col3x + 30, iy);
    iy += lineH - 0.5;
  }

  cursorY += blockHeight + 4;

  // ── 3. Matched results table ─────────────────────────────────────────────
  if (result.matched.length > 0) {

    const matchedRows = result.matched.map((pt) => [
      pt.pointId,
      round3(pt.northing),
      round3(pt.easting),
      round3(pt.asBuiltElevation),
      round3(pt.designElevation),
      round3(reportInfo.designThickness),
      round3(pt.adjustedDesignElevation),
      pt.status,
      pt.status === "On Grade" ? "—" : round3(pt.absDifference),
    ]);

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [[
        "Point ID", "Northing", "Easting",
        `As-Built Elev (${ul})`, `Design Elev (${ul})`,
        `Design Thick (${ul})`, `Adj. Design Elev (${ul})`,
        "Status", "Cut/Fill Amount",
      ]],
      body: matchedRows,
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        font: "helvetica",
        overflow: "linebreak",
      },
      headStyles: {
        fillColor: COLOR_HEADER_BG,
        textColor: COLOR_HEADER_TEXT,
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      // Colour the Status and Cut/Fill Amount cells by cut/fill result
      didParseCell(data) {
        if (data.section === "body" && (data.column.index === 7 || data.column.index === 8)) {
          const status = result.matched[data.row.index]?.status;
          if (status === "Cut")       data.cell.styles.textColor = COLOR_CUT;
          else if (status === "Fill") data.cell.styles.textColor = COLOR_FILL;
          else                        data.cell.styles.textColor = COLOR_ON_GRADE;
          data.cell.styles.fontStyle = "bold";
        }
      },
      didDrawPage() {
        // Re-draw page number on each new page
        addPageNumber(doc);
      },
    });

    cursorY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── 4. Unmatched As-Built table ──────────────────────────────────────────
  if (result.unmatchedAsBuilt.length > 0) {
    // Start a new page if not enough room
    if (cursorY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      cursorY = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_UNMATCHED_AB);
    doc.text(
      `Unmatched As-Built Points (${result.unmatchedAsBuilt.length}) – not included in totals`,
      margin, cursorY
    );
    cursorY += 3;

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [["Point ID", "Northing", "Easting", `As-Built Elev (${ul})`]],
      body: result.unmatchedAsBuilt.map((pt) => [
        pt.pointId, round3(pt.northing), round3(pt.easting), round3(pt.asBuiltElevation),
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: {
        fillColor: [194, 65, 12],
        textColor: COLOR_HEADER_TEXT,
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [255, 247, 237] },
      didDrawPage() { addPageNumber(doc); },
    });

    cursorY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  }

  // ── 5. Unmatched Design table ────────────────────────────────────────────
  if (result.unmatchedDesign.length > 0) {
    if (cursorY > doc.internal.pageSize.getHeight() - 40) {
      doc.addPage();
      cursorY = margin;
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(...COLOR_UNMATCHED_D);
    doc.text(
      `Unmatched Design Points (${result.unmatchedDesign.length}) – not included in totals`,
      margin, cursorY
    );
    cursorY += 3;

    autoTable(doc, {
      startY: cursorY,
      margin: { left: margin, right: margin },
      head: [["Point ID", "Northing", "Easting", `Design Elev (${ul})`]],
      body: result.unmatchedDesign.map((pt) => [
        pt.pointId, round3(pt.northing), round3(pt.easting), round3(pt.designElevation),
      ]),
      styles: { fontSize: 7.5, cellPadding: 1.8 },
      headStyles: {
        fillColor: [109, 40, 217],
        textColor: COLOR_HEADER_TEXT,
        fontStyle: "bold",
        fontSize: 7,
      },
      alternateRowStyles: { fillColor: [245, 243, 255] },
      didDrawPage() { addPageNumber(doc); },
    });
  }

  // Add page number to the last page
  addPageNumber(doc);

  // ── 6. Trigger download ──────────────────────────────────────────────────
  const safeName = (reportInfo.stabSheetName || "stab-sheet")
    .replace(/[^a-zA-Z0-9_\-\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
  doc.save(`${safeName}_report.pdf`);
}

// ---------------------------------------------------------------------------
// Page number footer helper
// ---------------------------------------------------------------------------

/** Current page number for the footer. */
function currentPageNumber(doc: jsPDF): number {
  return (doc as jsPDF & { internal: { getNumberOfPages: () => number } })
    .internal.getNumberOfPages();
}

function addPageNumber(doc: jsPDF) {
  const pageNum = currentPageNumber(doc);
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(156, 163, 175); // gray-400
  doc.text(
    `Page ${pageNum}`,
    pageW / 2,
    pageH - 5,
    { align: "center" }
  );
}
