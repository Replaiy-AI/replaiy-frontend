// Replaiy - tiny module-level store for the workspace's reusable custom-field
// LIBRARY. The import mapping screen reads from this so unmapped CSV columns
// can be mapped to a SAVED custom field (Industry, Region, ...) instead of
// everyone inventing new one-off duplicate fields every import.
//
// Like importDraft.ts this is deliberately NOT a React context or a persisted
// store: it is a plain mutable module object with getters + an appender. No
// backend, mock only. The seed fields are the realistic reusable fields a
// LinkedIn-outreach team would keep around.

// A single reusable custom field.
export type CustomField = { id: string; label: string };

// Seeded library. ids are readable slugs so they are stable + debuggable.
let library: CustomField[] = [
  { id: 'cf_industry', label: 'Industry' },
  { id: 'cf_region', label: 'Region' },
  { id: 'cf_company_size', label: 'Company size' },
  { id: 'cf_seniority', label: 'Seniority' },
  { id: 'cf_lead_source', label: 'Lead source' },
];

// Returns a COPY so callers can't mutate the library in place.
export function getCustomFields(): CustomField[] {
  return library.map((f) => ({ ...f }));
}

// Slugify a label into an id-friendly stem (letters/numbers, underscores).
function slugify(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

// Add a field to the library. Trims the label and dedupes case-insensitively:
// if a field with the same (normalized) label already exists, the EXISTING one
// is returned instead of creating a duplicate (the anti-duplication guard).
// Otherwise a stable id (slug + short random suffix) is generated, the field is
// appended, and returned.
export function addCustomField(label: string): CustomField {
  const trimmed = label.trim();
  const key = trimmed.toLowerCase();
  const existing = library.find((f) => f.label.trim().toLowerCase() === key);
  if (existing) return { ...existing };

  const stem = slugify(trimmed) || 'field';
  const id = `cf_${stem}_${Math.random().toString(36).slice(2, 6)}`;
  const field: CustomField = { id, label: trimmed };
  library = [...library, field];
  return { ...field };
}
