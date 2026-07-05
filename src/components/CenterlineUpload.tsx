"use client";

// ---------------------------------------------------------------------------
// CenterlineUpload.tsx
//
// Optional LandXML centerline file upload panel.
//
// Behaviour:
//  - Accepts .xml files only (drag-and-drop + click-to-browse).
//  - After parsing, if multiple alignments are found, shows a dropdown so
//    the user can pick which one to use.
//  - If a single alignment is found it is selected automatically.
//  - Calls onAlignmentSelected(alignment) or onAlignmentSelected(null) when
//    the selection changes (including when the file is cleared).
// ---------------------------------------------------------------------------

import { useRef, useState, DragEvent, ChangeEvent } from "react";
import { parseLandXmlAlignment } from "@/src/lib/parseLandXml";
import type { ParsedAlignment } from "@/src/types/stabSheet";

interface Props {
  /** Called whenever the active alignment changes (null = no alignment). */
  onAlignmentSelected: (alignment: ParsedAlignment | null) => void;
}

export default function CenterlineUpload({ onAlignmentSelected }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const [fileName, setFileName]       = useState<string | null>(null);
  const [parseError, setParseError]   = useState<string | null>(null);
  const [parseWarnings, setParseWarnings] = useState<string[]>([]);
  const [alignments, setAlignments]   = useState<ParsedAlignment[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  // ── File reading ───────────────────────────────────────────────────────

  function processXml(content: string, name: string) {
    setFileName(name);
    setParseError(null);
    setParseWarnings([]);
    setAlignments([]);
    onAlignmentSelected(null);

    const result = parseLandXmlAlignment(content);
    setParseWarnings(result.warnings);

    if (result.error) {
      setParseError(result.error);
      return;
    }

    if (result.alignments.length === 0) {
      setParseError("No valid alignments found in the uploaded XML.");
      return;
    }

    setAlignments(result.alignments);
    setSelectedIdx(0);
    onAlignmentSelected(result.alignments[0]);
  }

  function readFile(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      if (typeof content === "string") {
        processXml(content, file.name);
      } else {
        setParseError("Could not read file contents.");
      }
    };
    reader.onerror = () => {
      setParseError(`Could not read "${file.name}". Make sure it is a valid XML file.`);
    };
    reader.readAsText(file);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const inputEl = e.target;
    if (file) {
      readFile(file);
    }
    inputEl.value = "";
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) readFile(file);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave() {
    setIsDragging(false);
  }

  // ── Alignment selection ────────────────────────────────────────────────

  function handleSelectChange(e: ChangeEvent<HTMLSelectElement>) {
    const idx = parseInt(e.target.value, 10);
    setSelectedIdx(idx);
    onAlignmentSelected(alignments[idx] ?? null);
  }

  function handleClear() {
    setFileName(null);
    setParseError(null);
    setParseWarnings([]);
    setAlignments([]);
    setSelectedIdx(0);
    onAlignmentSelected(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  // ── Selected alignment summary ─────────────────────────────────────────

  const active = alignments[selectedIdx] ?? null;

  // ── Render ─────────────────────────────────────────────────────────────

  return (
    <section className="rounded-xl border border-teal-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-bold text-gray-800">
            Centerline LandXML
            <span className="ml-2 rounded-full bg-teal-100 px-2 py-0.5 text-xs font-medium text-teal-700">
              optional
            </span>
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Upload a LandXML file to add station/offset columns to the report.
          </p>
        </div>
        {fileName && (
          <button
            onClick={handleClear}
            className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-500 hover:border-gray-300 hover:text-gray-700 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload LandXML centerline file"
        className={[
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors",
          isDragging
            ? "border-teal-500 bg-teal-50"
            : "border-gray-300 bg-gray-50 hover:border-teal-400 hover:bg-teal-50",
        ].join(" ")}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* XML / route icon */}
        <svg
          className={`mb-3 h-9 w-9 ${isDragging ? "text-teal-500" : "text-gray-400"}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M9 6.75V15m6-6v8.25m.503-9.998 4.875 2.25a.75.75 0 0 1 0 1.496l-4.875 2.25" />
          <path strokeLinecap="round" strokeLinejoin="round"
            d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
        </svg>

        {fileName ? (
          <p className="text-sm font-medium text-teal-700">{fileName}</p>
        ) : (
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-teal-600">Click to upload</span>{" "}
            or drag and drop
          </p>
        )}
        <p className="mt-1 text-xs text-gray-400">LandXML (.xml)</p>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept=".xml"
        className="hidden"
        onChange={handleInputChange}
      />

      {/* Parse error */}
      {parseError && (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span className="font-semibold">Parse error: </span>{parseError}
        </div>
      )}

      {/* Parse warnings */}
      {parseWarnings.length > 0 && (
        <div className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 mb-1">
            Warnings ({parseWarnings.length}):
          </p>
          <ul className="space-y-0.5">
            {parseWarnings.map((w, i) => (
              <li key={i} className="text-xs text-amber-700">{w}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Alignment picker (only when multiple alignments found) */}
      {alignments.length > 1 && (
        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Select alignment to use:
          </label>
          <select
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
            value={selectedIdx}
            onChange={handleSelectChange}
          >
            {alignments.map((al, i) => (
              <option key={i} value={i}>
                {al.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Active alignment info chip */}
      {active && (
        <div className="mt-4 rounded-md border border-teal-100 bg-teal-50 px-4 py-3">
          <p className="text-xs font-semibold text-teal-800 mb-1">
            Active alignment: <span className="font-bold">{active.name}</span>
          </p>
          <p className="text-xs text-teal-700">
            Start station: {active.staStart.toFixed(3)}&nbsp;&nbsp;·&nbsp;&nbsp;
            Length: {active.length.toFixed(3)}&nbsp;&nbsp;·&nbsp;&nbsp;
            Segments: {active.segments.length} ({active.segments.map((s) => s.type).join(", ")})
          </p>
        </div>
      )}
    </section>
  );
}
