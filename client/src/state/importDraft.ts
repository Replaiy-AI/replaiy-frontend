// Replaiy - tiny module-level store for carrying a parsed CSV import draft
// across a route change (from the Sources dropzone in AudienceSourcesCard to
// the /campaigns/:id/import mapping screen) and back for the confirmation.
//
// This is deliberately NOT a React context or a persisted store: the mapping
// screen and the sources card never coexist, so a plain mutable module object
// with a getter/setter is the simplest correct thing. No backend, mock only.

// The parsed CSV draft the mapping screen reads.
export type ImportDraft = {
  campaignId: string;
  filename: string;
  // Real column headers from the first non-empty line of the CSV.
  headers: string[];
  // First ~5 data rows, each a string[] aligned to headers.
  rows: string[][];
  // Total number of data rows (leads) in the file.
  total: number;
} | null;

// The last completed (mock) import result, so the Sources Manual-import row
// can show the "{N} leads imported" confirmation after returning.
export type ImportResult = {
  campaignId: string;
  count: number;
} | null;

let importDraft: ImportDraft = null;
let importResult: ImportResult = null;

export function setImportDraft(draft: NonNullable<ImportDraft>): void {
  importDraft = draft;
}

export function getImportDraft(): ImportDraft {
  return importDraft;
}

export function clearImportDraft(): void {
  importDraft = null;
}

export function setImportResult(campaignId: string, count: number): void {
  importResult = { campaignId, count };
}

export function getImportResult(): ImportResult {
  return importResult;
}

export function clearImportResult(): void {
  importResult = null;
}
