// Replaiy - tiny module-level store for remembering CSV import layouts, so a
// user who always imports the same column layout gets the whole mapping
// prefilled next time (like Apollo / HeyReach saved mappings).
//
// Same house style as importDraft.ts: a plain mutable module array with
// getters/setters, mock only, no backend and no React context. The mapping is
// keyed by the Replaiy field key -> the normalized HEADER NAME it maps to (not
// a column index), so a saved template re-applies correctly even when a later
// file has the same columns in a different order.

// A saved import layout: its column "fingerprint" + the mapping that worked.
export type ImportTemplate = {
  id: string;
  name: string; // human label, e.g. "LinkedIn Outreach export"
  // Normalized (trim + lowercase) header names, SORTED, so two files with the
  // same columns in any order share one fingerprint.
  fingerprint: string[];
  // ReplaiyFieldKey -> normalized header name it maps to, or '__none__' for
  // "don't import". Storing by name (not index) makes it robust to reordering.
  mapping: Record<string, string>;
  createdAt: number;
};

// Sentinel for "don't import" (kept identical to CampaignDetail's DONT_IMPORT).
const NONE = '__none__';

// Normalize a single header the same way the mapping screen does.
function normHeader(h: string): string {
  return h.trim().toLowerCase();
}

// Build a sorted, normalized fingerprint from raw file headers.
function fingerprintOf(headers: string[]): string[] {
  return headers.map(normHeader).sort();
}

// Two fingerprints are the same template if their sorted normalized arrays match.
function sameFingerprint(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// Module state, seeded with ONE realistic template so recognition can demo on
// first use even before the user has imported anything.
let templates: ImportTemplate[] = [
  {
    id: 'seed-linkedin-outreach',
    name: 'LinkedIn Outreach export',
    fingerprint: fingerprintOf([
      'first name',
      'last name',
      'email',
      'company',
      'job title',
      'linkedin url',
      'phone',
    ]),
    mapping: {
      firstName: 'first name',
      lastName: 'last name',
      email: 'email',
      company: 'company',
      jobTitle: 'job title',
      linkedin: 'linkedin url',
      phone: 'phone',
    },
    createdAt: Date.now(),
  },
];

// Return a shallow copy so callers can't mutate the store in place.
export function getImportTemplates(): ImportTemplate[] {
  return templates.map((t) => ({ ...t }));
}

// Save (or update) a template from a successful import. Dedupes by fingerprint:
// if a template already has the same sorted normalized headers, we UPDATE its
// mapping + name in place instead of adding a duplicate; otherwise we append.
export function saveImportTemplate(
  name: string,
  headers: string[],
  mappingByHeaderName: Record<string, string>,
): ImportTemplate {
  const fingerprint = fingerprintOf(headers);
  const existing = templates.find((t) => sameFingerprint(t.fingerprint, fingerprint));
  if (existing) {
    existing.name = name;
    existing.mapping = { ...mappingByHeaderName };
    existing.createdAt = Date.now();
    return { ...existing };
  }
  const template: ImportTemplate = {
    id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    fingerprint,
    mapping: { ...mappingByHeaderName },
    createdAt: Date.now(),
  };
  templates.push(template);
  return { ...template };
}

// Find the best saved template for an incoming file's headers. Overlap is the
// Jaccard index (|intersection| / |union|) of the two normalized header sets.
// Returns the highest-overlap template if overlap >= 0.8, else null. Ties are
// broken by the most recently created template.
export function matchImportTemplate(headers: string[]): ImportTemplate | null {
  const incoming = fingerprintOf(headers);
  if (incoming.length === 0) return null;

  let best: ImportTemplate | null = null;
  let bestOverlap = 0;

  for (const t of templates) {
    const templateSet = new Set(t.fingerprint);
    let intersection = 0;
    for (const h of incoming) if (templateSet.has(h)) intersection++;
    const union = incoming.length + templateSet.size - intersection;
    const overlap = union === 0 ? 0 : intersection / union;

    if (
      overlap > bestOverlap ||
      (overlap === bestOverlap && best !== null && t.createdAt > best.createdAt)
    ) {
      best = t;
      bestOverlap = overlap;
    }
  }

  if (best && bestOverlap >= 0.8) return { ...best };
  return null;
}

// Re-exported so callers can keep the sentinel consistent if needed.
export { NONE as TEMPLATE_NONE };
