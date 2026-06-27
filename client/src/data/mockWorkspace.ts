// ─────────────────────────────────────────────────────────────────
// Mock workspace-data — workspace/organisatie niveau.
//
// Bevat (voor nu) alleen wat de Knowledge-tab nodig heeft:
//   • workspace-knowledge (bedrijfskennis: prijzen, producten, propositie)
//   • de rol van de huidige seat → bepaalt of workspace-knowledge
//     bewerkbaar / zichtbaar is (rol-gating)
//
// Mapt op backend: rag_documents met workspace_id gevuld (member_id leeg).
// Rollen sluiten aan op de members-tabel (role-veld). Later breiden we dit
// uit met team/seats/billing in het workspace-gebied.
// ─────────────────────────────────────────────────────────────────
import type { PersonaKnowledgeDoc } from './mockPersona';

// Seat-rol. 'owner'/'admin' mogen workspace-knowledge bewerken;
// 'member' mag 'm alleen lezen (de AI gebruikt 'm wél, ongeacht rol —
// de rol gaat over BEHEER, niet over of de AI de kennis ziet).
export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface Workspace {
  id: string;
  name: string;
  /** De rol van de ingelogde seat binnen deze workspace. */
  currentRole: WorkspaceRole;
  /** Bedrijfsbrede kennis — door iedereen in de workspace gedeeld. */
  knowledge: PersonaKnowledgeDoc[];
}

/** Mag deze rol workspace-knowledge bewerken (toevoegen/verwijderen)? */
export function canEditWorkspaceKnowledge(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}

export const mockWorkspace: Workspace = {
  id: 'ws_replaiy',
  name: 'Replaiy',
  // Simon is founder → owner. Zet op 'member' om de gating (slotje +
  // read-only) live te zien tijdens het testen.
  currentRole: 'owner',
  knowledge: [
    {
      id: 'ws_pricing',
      title: 'Prijzen & pakketten',
      kind: 'doc',
      hint: 'Actuele prijzen, LTD-deal en credit-systeem',
      meta: 'DOC · 3 pagina’s',
    },
    {
      id: 'ws_product',
      title: 'Productoverzicht',
      kind: 'doc',
      hint: 'Wat Replaiy doet — features en use-cases',
      meta: 'DOC · 2 pagina’s',
    },
    {
      id: 'ws_proposition',
      title: 'Propositie & positionering',
      kind: 'note',
      hint: 'Marketing Fundament: persoonlijk, gecontroleerd, geen automation',
      meta: 'Notitie',
    },
    {
      id: 'ws_objections',
      title: 'Bezwaren & antwoorden',
      kind: 'doc',
      hint: 'Veelgehoorde bezwaren en hoe we ze pareren',
      meta: 'DOC · 1 pagina',
    },
  ],
};
