"use client";

// ---------------------------------------------------------------------------
// page.tsx  –  Stab Sheet Report Generator (main page)
//
// Application state lives here. Four sections:
//   1. ReportInfoForm  – report header + design thickness
//   2. Two FileUpload panels – As-Built file and Design file
//   3. SummaryCards    – matched / cut / fill / on-grade / unmatched counts
//   4. ResultsTable    – matched rows + unmatched sections
//
// Matching runs automatically via useEffect whenever either file or the
// design thickness changes.
// ---------------------------------------------------------------------------

import { useState, useEffect } from "react";
import type {
  ReportInfo,
  RawAsBuiltPoint,
  RawDesignPoint,
  MatchResult,
} from "@/src/types/stabSheet";
import ReportInfoForm from "@/src/components/ReportInfoForm";
import FileUpload from "@/src/components/FileUpload";
import SummaryCards from "@/src/components/SummaryCards";
import ResultsTable from "@/src/components/ResultsTable";
import { parseAsBuiltFile, parseDesignFile } from "@/src/lib/parseSurveyFile";
import { matchAndCalculate, buildSummary } from "@/src/lib/stabSheetCalculations";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Renders a collapsible list of parse warnings. */
function WarningBox({ label, warnings }: { label: string; warnings: string[] }) {
  if (warnings.length === 0) return null;
  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-5 py-4">
      <p className="text-sm font-semibold text-amber-700">
        {label} – {warnings.length} row{warnings.length > 1 ? "s" : ""} skipped
      </p>
      <ul className="mt-2 space-y-1">
        {warnings.map((w, i) => (
          <li key={i} className="text-sm text-amber-700">{w}</li>
        ))}
      </ul>
    </div>
  );
}

/** Renders a parse error banner. */
function ErrorBox({ label, error }: { label: string; error: string }) {
  return (
    <div className="rounded-lg border border-red-300 bg-red-50 px-5 py-4">
      <p className="text-sm font-semibold text-red-700">{label}</p>
      <p className="mt-1 text-sm text-red-600">{error}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Default form values
// ---------------------------------------------------------------------------

const DEFAULT_REPORT_INFO: ReportInfo = {
  stabSheetName: "",
  dateOfCollection: "",
  preparedBy: "",
  projectId: "",
  projectDescription: "",
  designThickness: 0,
  unitSystem: "decimal-feet",
};

const EMPTY_MATCH_RESULT: MatchResult = {
  matched: [],
  unmatchedAsBuilt: [],
  unmatchedDesign: [],
};

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function StabSheetPage() {
  const [reportInfo, setReportInfo] = useState<ReportInfo>(DEFAULT_REPORT_INFO);

  // Raw parsed points stored separately so matching reruns on any form change
  const [asBuiltPoints, setAsBuiltPoints]   = useState<RawAsBuiltPoint[]>([]);
  const [designPoints,  setDesignPoints]    = useState<RawDesignPoint[]>([]);

  // File names for display in the upload panels
  const [asBuiltFileName, setAsBuiltFileName] = useState<string | null>(null);
  const [designFileName,  setDesignFileName]  = useState<string | null>(null);

  // Parse errors and warnings per file
  const [asBuiltError,    setAsBuiltError]    = useState<string | null>(null);
  const [designError,     setDesignError]     = useState<string | null>(null);
  const [asBuiltWarnings, setAsBuiltWarnings] = useState<string[]>([]);
  const [designWarnings,  setDesignWarnings]  = useState<string[]>([]);

  // The calculated match result
  const [matchResult, setMatchResult] = useState<MatchResult>(EMPTY_MATCH_RESULT);

  // Re-run matching whenever either point set or design thickness changes
  useEffect(() => {
    if (asBuiltPoints.length === 0 || designPoints.length === 0) {
      setMatchResult(EMPTY_MATCH_RESULT);
      return;
    }
    const result = matchAndCalculate(asBuiltPoints, designPoints, reportInfo.designThickness);
    setMatchResult(result);
  }, [asBuiltPoints, designPoints, reportInfo.designThickness]);

  // ── File handlers ───────────────────────────────────────────────────────

  function handleAsBuiltFileRead(content: string, fileName: string) {
    setAsBuiltError(null);
    setAsBuiltWarnings([]);
    setAsBuiltPoints([]);
    setAsBuiltFileName(fileName);

    const { points, warnings, error } = parseAsBuiltFile(content);
    if (error) { setAsBuiltError(error); return; }
    setAsBuiltWarnings(warnings);
    setAsBuiltPoints(points);
  }

  function handleDesignFileRead(content: string, fileName: string) {
    setDesignError(null);
    setDesignWarnings([]);
    setDesignPoints([]);
    setDesignFileName(fileName);

    const { points, warnings, error } = parseDesignFile(content);
    if (error) { setDesignError(error); return; }
    setDesignWarnings(warnings);
    setDesignPoints(points);
  }

  // ── Derived state ───────────────────────────────────────────────────────

  const summary    = buildSummary(matchResult);
  const hasResults =
    matchResult.matched.length > 0 ||
    matchResult.unmatchedAsBuilt.length > 0 ||
    matchResult.unmatchedDesign.length > 0;

  // ── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-100">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <header className="bg-blue-800 text-white shadow-md">
        <div className="mx-auto max-w-6xl px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            {/* Hard-hat icon */}
            <svg
              className="h-7 w-7 text-yellow-300"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M12 3C7.03 3 3 6.69 3 11.25V13h18v-1.75C21 6.69 16.97 3 12 3z" />
              <path strokeLinecap="round" strokeLinejoin="round"
                d="M2 13h20v2a1 1 0 01-1 1H3a1 1 0 01-1-1v-2z" />
            </svg>
            <div>
              <h1 className="text-xl font-bold leading-tight tracking-tight">
                Stab Sheet Report Generator
              </h1>
              <p className="text-xs text-blue-200">
                Paving &amp; Concrete Survey Analysis Tool
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* ── Main content ────────────────────────────────────────────────── */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">

        {/* Section 1 – Report information */}
        <ReportInfoForm reportInfo={reportInfo} onChange={setReportInfo} />

        {/* Section 2 – File uploads (side by side on wider screens) */}
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-3">
            <FileUpload
              label="As-Built File"
              hintText="Point ID · Northing · Easting · As-Built Elevation"
              onFileRead={handleAsBuiltFileRead}
              currentFileName={asBuiltFileName}
            />
            {asBuiltError    && <ErrorBox   label="As-Built Parse Error"    error={asBuiltError} />}
            {asBuiltWarnings.length > 0 && (
              <WarningBox label="As-Built Warnings" warnings={asBuiltWarnings} />
            )}
          </div>

          <div className="space-y-3">
            <FileUpload
              label="Design File"
              hintText="Point ID · Northing · Easting · Design Elevation"
              onFileRead={handleDesignFileRead}
              currentFileName={designFileName}
            />
            {designError    && <ErrorBox   label="Design Parse Error"    error={designError} />}
            {designWarnings.length > 0 && (
              <WarningBox label="Design Warnings" warnings={designWarnings} />
            )}
          </div>
        </div>

        {/* Prompt when only one file is loaded */}
        {(asBuiltPoints.length > 0) !== (designPoints.length > 0) && (
          <div className="rounded-lg border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-700">
            {asBuiltPoints.length > 0
              ? `As-Built file loaded (${asBuiltPoints.length} points). Upload a Design file to run the comparison.`
              : `Design file loaded (${designPoints.length} points). Upload an As-Built file to run the comparison.`}
          </div>
        )}

        {/* Section 3 – Summary cards */}
        {hasResults && <SummaryCards summary={summary} />}

        {/* Section 4 – Results table */}
        {hasResults && (
          <ResultsTable
            result={matchResult}
            designThickness={reportInfo.designThickness}
          />
        )}

      </main>

      {/* ── Footer ──────────────────────────────────────────────────────── */}
      <footer className="mt-8 border-t border-gray-200 bg-white py-4 text-center text-xs text-gray-400">
        Stab Sheet Report Generator &nbsp;·&nbsp; Client-side processing only
        &nbsp;·&nbsp; No data is uploaded to any server
      </footer>
    </div>
  );
}
