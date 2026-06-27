// ─────────────────────────────────────────────────────────────────
// Mock workspace data — workspace/organisation level.
//
// Workspace KNOWLEDGE = company-wide knowledge that feeds your AI, in
// exactly the same shape as personal knowledge: questions (Q&A) + files.
// This is NOT organisation admin (team/roles/billing) — that is something
// entirely separate and does not belong under "My AI".
//
// The seat role only decides whether you can EDIT workspace knowledge.
// The AI uses the knowledge regardless of role.
//
// Maps onto backend: rag_documents scoped by workspace_id (member_id empty).
// Question answers become chunks; files become documents.
// ─────────────────────────────────────────────────────────────────
import type { KnowledgeBundle } from './mockPersona';

export type WorkspaceRole = 'owner' | 'admin' | 'member';

export interface Workspace {
  id: string;
  name: string;
  currentRole: WorkspaceRole;
  knowledge: KnowledgeBundle;
}

/** Can this role edit workspace knowledge (add/remove)? */
export function canEditWorkspaceKnowledge(role: WorkspaceRole): boolean {
  return role === 'owner' || role === 'admin';
}

export const mockWorkspace: Workspace = {
  id: 'ws_replaiy',
  name: 'Replaiy',
  // Simon is founder → owner. Set to 'member' to see the gating (read-only +
  // lock) live while testing.
  currentRole: 'owner',
  knowledge: {
    questions: [
      {
        id: 'wq_oneliner',
        question: 'What does the company do, in one clear sentence?',
        hint: 'Lead with the outcome, not the technology.',
        answer:
          'Replaiy helps sales teams and founders book more meetings from LinkedIn by making follow-up more personal, more consistent and more scalable.',
      },
      {
        id: 'wq_for_whom',
        question: 'Who is it for — and who is it not for?',
        hint: 'A sharp boundary helps the AI qualify.',
        answer:
          'For: sales-driven companies, agencies, founders and solo operators up to ~250 employees. Not for: anyone chasing pure outreach volume who does not care about the conversation.',
      },
      {
        id: 'wq_diff',
        question: 'What sets you apart from the competition?',
        hint: 'The core of the positioning.',
        answer:
          'Most tools automate outreach. Replaiy strengthens the conversation that comes after — where deals are won or lost — while the user stays in control.',
      },
      {
        id: 'wq_objections',
        question: 'What are the main objections, and how do we handle them?',
        hint: 'Tone of voice, control, account safety.',
        answer:
          '"Will it sound like me?" → the AI is trained on your tone of voice. "Do I lose control?" → a guided system with approval and status visibility. "Is it safe?" → rate limits, warm-up, controlled activity.',
      },
    ],
    files: [
      {
        id: 'wf_pricing',
        title: 'Pricing & plans',
        kind: 'doc',
        hint: 'Current pricing, the LTD deal and the credit system',
        meta: 'DOC · 3 pages',
      },
      {
        id: 'wf_product',
        title: 'Product overview',
        kind: 'doc',
        hint: 'What Replaiy does — features and use cases',
        meta: 'DOC · 2 pages',
      },
      {
        id: 'wf_proposition',
        title: 'Proposition & positioning',
        kind: 'note',
        hint: 'Marketing foundation: personal, controlled, no automation',
        meta: 'Note',
      },
    ],
  },
};
