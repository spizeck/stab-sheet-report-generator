# Stab Sheet Report Generator

A professional survey analysis tool for comparing As-Built and Design elevation data. Built for construction quality control, paving inspection, and civil engineering projects.

## What This App Does

The Stab Sheet Report Generator helps engineers, inspectors, and project managers analyze survey data by comparing **As-Built** field measurements against **Design** specifications.

### How It Works

1. **Upload two survey files**:
   - **As-Built File**: Field-measured elevations with point IDs, Northing, Easting, and elevation
   - **Design File**: Design elevations with matching coordinate format

2. **Automatic Point Matching**: The app matches points by comparing Northing and Easting coordinates (rounded to 3 decimal places). As-Built point names are always used in the final report.

3. **Cut/Fill Analysis**: For each matched point, the app calculates:
   ```
   adjustedDesignElevation = designElevation - designThickness
   difference = asBuiltElevation - adjustedDesignElevation
   ```

4. **Status Classification**:
   - **Cut** (positive difference): As-Built is higher than design — material needs to be removed
   - **Fill** (negative difference): As-Built is lower than design — material needs to be added
   - **On Grade** (zero difference): Matches design specification exactly

5. **Generate PDF Report**: Export a professional report with summary statistics and point-by-point results.

## Local Development

### Prerequisites

- Node.js 18+ 
- npm, yarn, pnpm, or bun

### Setup

```bash
# Clone the repository
git clone <repository-url>
cd stab-sheet-report-generator

# Install dependencies
npm install

# Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

### Build

```bash
# Create production build
npm run build

# Preview production build locally
npm run start
```

### Lint

```bash
npm run lint
```

### Testing

The project uses [Vitest](https://vitest.dev/) for testing with [Testing Library](https://testing-library.com/) for DOM assertions.

```bash
# Run tests once
npm test

# Run tests in watch mode (for development)
npm run test:watch

# Run tests with coverage report
npm run test:coverage
```

#### Test Coverage

The test suite targets 90%+ coverage of:
- `src/lib/stabSheetCalculations.ts` — Coordinate matching, cut/fill calculations, design thickness adjustments, summary counts
- `src/lib/parseSurveyFile.ts` — File parsing, header alias mapping, delimiter detection

#### Test Categories

- **Coordinate matching logic** — Tests for point matching by Northing/Easting with 3-decimal rounding
- **Cut/Fill/On Grade calculations** — Tests for all three status classifications
- **Design thickness adjustments** — Tests for pavement thickness subtraction
- **Unmatched point detection** — Tests for identifying orphaned points
- **File parsing** — Tests for CSV, tab-delimited, semicolon-delimited formats
- **Header alias mapping** — Tests for various column name variations (e.g., "north", "y", "n" for Northing)

## Deployment on Vercel

This app is optimized for deployment on [Vercel](https://vercel.com):

1. Push your code to GitHub
2. Import the repository in Vercel
3. Deploy with default settings (Next.js preset)

No additional environment variables or server configuration are required for the current client-side-only version.

**Important**: For production deployments, ensure HTTPS is enabled to protect any sensitive project data during file processing.

## Supported Upload Formats

The app accepts survey files in the following formats:

- **CSV** (comma-separated values)
- **TXT** (plain text)
- **Tab-delimited** files
- **Semicolon-delimited** files
- Files with **space-separated** columns

### Expected Column Structure

Files should contain:
- Point ID
- Northing coordinate
- Easting coordinate
- Elevation (As-Built or Design)

The app automatically detects headers and common column name variations. For headerless files, a swap N/E toggle is available if your file uses Easting/Northing order.

## Current Limitations

- **Client-side processing only**: All calculations happen in the browser
- **No database**: Data is not persisted between sessions
- **No user accounts**: No authentication or user management
- **No server-side file storage**: Files exist only in memory during processing
- **Coordinate matching**: Currently rounds to 3 decimal places for matching

## Future Feature Ideas

- Tolerance highlighting for pass/fail indicators
- Export history and saved reports
- PDF branding with company logos
- Additional unit options (feet/inches, fractional display)
- Advanced column mapping for non-standard file formats
- Better handling and reporting of unmatched points
- Bulk file processing
- Report templates for DOT/FAA/USACE compliance

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines on contributing to this project.

## Security

See [SECURITY.md](./SECURITY.md) for security considerations and responsible disclosure.

## License

[MIT License](./LICENSE) - Copyright (c) 2026 Chad Nuttall
