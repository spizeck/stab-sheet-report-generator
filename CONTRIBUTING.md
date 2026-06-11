# Contributing to Stab Sheet Report Generator

Thank you for your interest in contributing! This document outlines the workflow and guidelines for contributing to this project.

## Development Workflow

1. **Create a branch** from `main` for your changes
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make your changes** following the coding style guidelines below

3. **Run lint and build** to ensure code quality
   ```bash
   npm run lint
   npm run build
   ```

4. **Commit your changes** with clear, descriptive messages
   ```bash
   git commit -m "Add feature: description of what changed"
   ```

5. **Push your branch** to the remote repository
   ```bash
   git push origin feature/your-feature-name
   ```

6. **Open a Pull Request** with a clear description of the changes

## Coding Style Guidelines

### TypeScript

- Use TypeScript for all new code
- Define clear types for function parameters and return values
- Avoid using `any` — prefer explicit types or `unknown` with proper guards

### Code Organization

Keep code in the appropriate directories:

- **`src/lib/`** — Calculation logic, parsing functions, and utility helpers
  - Example: `parseSurveyFile.ts`, `stabSheetCalculations.ts`, `exportPdf.ts`

- **`src/components/`** — UI components
  - Example: `ReportInfoForm.tsx`, `FileUpload.tsx`, `SummaryCards.tsx`

- **`src/types/`** — TypeScript type definitions
  - Example: `stabSheet.ts`

### Function Naming

- Use clear, descriptive function names
- Use camelCase for functions and variables
- Use PascalCase for components and types
- Prefix boolean variables with `is`, `has`, or `should` when appropriate

Good examples:
```typescript
function parseAsBuiltFile(content: string, swapNE: boolean): ParseResult
function calculateAdjustedElevation(designElev: number, thickness: number): number
function isValidPointId(id: string): boolean
```

### Dependencies

- **Avoid adding dependencies unless needed**. The app is designed to be lightweight.
- If you need to add a dependency:
  - Explain why it's necessary in your PR description
  - Prefer well-maintained packages with small bundle sizes
  - Update `package.json` and `package-lock.json`

### UI/Styling

- Use Tailwind CSS for styling
- Follow the existing color scheme and component patterns
- Ensure responsive design works on mobile and desktop
- Test with the existing sample data files

### Testing

- Test your changes with realistic survey data
- Verify PDF export works correctly after changes
- Check that file parsing handles edge cases (empty files, malformed data, etc.)

## Pull Request Process

1. Update the [CHANGELOG.md](./CHANGELOG.md) with your changes under the "Unreleased" section
2. Ensure your PR description clearly explains what changed and why
3. Link any related issues
4. Wait for review — maintainers will provide feedback or merge

## Questions?

If you have questions about contributing, feel free to open an issue for discussion.
