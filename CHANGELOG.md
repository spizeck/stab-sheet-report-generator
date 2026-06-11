# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Initial project setup with Next.js 16 and TypeScript
- Survey file upload and parsing (CSV, TXT, tab-delimited, semicolon-delimited)
- As-Built and Design file comparison by Northing/Easting coordinates
- Cut/Fill/On Grade calculation with design thickness adjustment
- PDF report generation with professional formatting
- Summary statistics display (Cut, Fill, On Grade counts)
- Point-by-point results table with color-coded status
- Multi-line project description support with character limit
- Client-side only processing — no server upload required

### Changed

- Simplified PDF report layout to focus on essential QC data
- Removed Matched/Unmatched counts from summary (still available in detailed view)

### Fixed

- Description text wrapping in PDF reports to prevent overlap

## [0.1.0] - 2026-06-11

### Added

- Initial release
- Basic stab sheet report generation functionality
