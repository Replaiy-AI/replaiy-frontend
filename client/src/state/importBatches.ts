// Replaiy - tiny module-level store for recorded CSV import batches per
// campaign. Each import (from the mapping screen's applyResult) records one
// batch here so the Manual-import source in the Audience tab can list what was
// imported and let the user UNDO a whole batch (remove exactly its leads and
// reverse the pool it added).
//
// Like importDraft.ts this is deliberately NOT a React context or a persisted
// store: it's a plain mutable module array, mock only, no backend. Callers
// trigger a re-render themselves after mutating (the sources card bumps state).

// One recorded import batch. poolDelta is the exact amount this batch added to
// the pool, so undo can subtract it precisely and restore can add it back.
export type ImportBatch = {
  id: string;
  campaignId: string;
  filename: string;
  importedAt: number; // Date.now()
  total: number; // rows in the file
  net: number; // total - duplicates (leads actually added)
  duplicates: number;
  qualified: number; // leads above the ICP bar (the summary's aboveIcp)
  poolDelta: { cold: number; warm: number; warmest: number };
};

// All batches across campaigns, newest appended last.
let importBatches: ImportBatch[] = [];

// Batches for one campaign, most recent first.
export function getImportBatches(campaignId: string): ImportBatch[] {
  return importBatches
    .filter((b) => b.campaignId === campaignId)
    .sort((a, b) => b.importedAt - a.importedAt);
}

// Append a freshly imported batch.
export function addImportBatch(batch: ImportBatch): void {
  importBatches.push(batch);
}

// Remove a batch by id and return it (so the caller can reverse pool + leads),
// or null if it wasn't found.
export function removeImportBatch(id: string): ImportBatch | null {
  const idx = importBatches.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  const [removed] = importBatches.splice(idx, 1);
  return removed;
}

// Re-add a previously removed batch (for Restore).
export function restoreImportBatch(batch: ImportBatch): void {
  importBatches.push(batch);
}
