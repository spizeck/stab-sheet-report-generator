"use client";

// ---------------------------------------------------------------------------
// FileUpload.tsx
//
// Drag-and-drop + click-to-browse file upload area.
// Reads the file using the browser FileReader API and passes the raw text
// content up to the parent (page.tsx) for parsing.
// ---------------------------------------------------------------------------

import { useRef, useState, DragEvent, ChangeEvent } from "react";

interface Props {
  /** Called with the raw file text content once the file is read. */
  onFileRead: (content: string, fileName: string) => void;
  /** Optional: name of the currently loaded file for display. */
  currentFileName?: string | null;
  /** Section heading shown above the drop zone, e.g. "As-Built File". */
  label?: string;
  /** One-line description shown in the hint box, e.g. expected columns. */
  hintText?: string;
}

const ACCEPTED_EXTENSIONS = ".csv,.txt,.tsv,.dat,.xyz";

export default function FileUpload({
  onFileRead,
  currentFileName,
  label = "Upload Survey File",
  hintText = "Point ID · Northing · Easting · Elevation",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);

  /** Reads the File object using FileReader. */
  function readFile(file: File, inputEl?: HTMLInputElement) {
    setReadError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result;
      // Reset the input AFTER the read completes so the File reference stays valid
      if (inputEl) inputEl.value = "";
      if (typeof content === "string") {
        onFileRead(content, file.name);
      } else {
        setReadError("Could not read file contents.");
      }
    };
    reader.onerror = () => {
      if (inputEl) inputEl.value = "";
      setReadError(
        `Could not read "${file.name}". Make sure it is a plain text file (CSV, TXT, TSV).`
      );
    };
    reader.readAsText(file);
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    const inputEl = e.target;
    if (file) {
      readFile(file, inputEl);
    } else {
      inputEl.value = "";
    }
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

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 text-lg font-bold text-gray-800">{label}</h2>

      {/* Drop zone */}
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload survey file"
        className={[
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 transition-colors",
          isDragging
            ? "border-blue-500 bg-blue-50"
            : "border-gray-300 bg-gray-50 hover:border-blue-400 hover:bg-blue-50",
        ].join(" ")}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        {/* Upload icon */}
        <svg
          className={`mb-3 h-10 w-10 ${isDragging ? "text-blue-500" : "text-gray-400"}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"
          />
        </svg>

        {currentFileName ? (
          <p className="text-sm font-medium text-blue-700">{currentFileName}</p>
        ) : (
          <p className="text-sm text-gray-500">
            <span className="font-semibold text-blue-600">Click to upload</span>{" "}
            or drag and drop
          </p>
        )}
        <p className="mt-1 text-xs text-gray-400">CSV, TXT, TSV, DAT, or XYZ</p>
      </div>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS}
        className="hidden"
        onChange={handleInputChange}
      />

      {/* File-reader error */}
      {readError && (
        <p className="mt-3 text-sm font-medium text-red-600">{readError}</p>
      )}

      {/* Hint about expected columns */}
      <div className="mt-4 rounded-md bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-800">
        <p className="font-semibold mb-1">Expected columns (order does not matter):</p>
        <p>{hintText}</p>
        <p className="mt-1 text-amber-700">Common header variations are recognised automatically. Headerless 4-column files are also supported.</p>
      </div>
    </section>
  );
}
