// ─────────────────────────────────────────────────────────────────
// Mock persona data — user/seat level (one persona per member).
//
// Maps 1:1 onto the backend (app/persona/*):
//   • tone_profile     → HOW we sound (tone, language, style, do's/don'ts)
//   • strategy_profile → WHAT we do strategically (qualifying / closing /
//                        push-vs-wait)
// The backend serialises both blobs as JSON into the prompt, so this shape
// must round-trip cleanly through JSON.stringify. We deliberately keep it
// structured (no loose string) so the editor can render discrete fields.
//
// KNOWLEDGE (personal level) = two ways to feed the AI:
//   • questions → targeted intake questions the user answers
//   • files     → uploaded documents (writing samples, pitch, ...)
// (Backend: rag_documents scoped by member_id; answers become chunks.)
// ─────────────────────────────────────────────────────────────────

export type ToneFormality = 'informal' | 'neutral' | 'formal';
export type ToneLength = 'short' | 'medium' | 'long';

export interface ToneProfile {
  language: 'nl' | 'en';
  formality: ToneFormality;
  length: ToneLength;
  /** Free-form description of the voice — "sounds like the user". */
  voice: string;
  dos: string[];
  donts: string[];
}

export type StrategyStance = 'push' | 'balanced' | 'patient';

export interface StrategyProfile {
  stance: StrategyStance;
  qualification: string;
  closing: string;
  pushVsWait: string;
}

// ── Knowledge: questions + files ──────────────────────────────────
export interface KnowledgeQA {
  id: string;
  /** The question we ask. */
  question: string;
  /** Short hint/example shown beneath the question. */
  hint?: string;
  /** The user's answer (empty = not answered yet). */
  answer: string;
}

export interface KnowledgeDoc {
  id: string;
  title: string;
  kind: 'pdf' | 'doc' | 'note' | 'link';
  hint: string;
  meta: string;
}

export interface KnowledgeBundle {
  questions: KnowledgeQA[];
  files: KnowledgeDoc[];
}

export interface Persona {
  memberId: string;
  memberName: string;
  memberInitials: string;
  role: string;
  tone: ToneProfile;
  strategy: StrategyProfile;
  /** Personal knowledge (questions + files). */
  knowledge: KnowledgeBundle;
}

export const mockPersona: Persona = {
  memberId: 'mem_simon',
  memberName: 'Simon van Basten',
  memberInitials: 'SB',
  role: 'Founder · Replaiy',
  tone: {
    language: 'en',
    formality: 'informal',
    length: 'short',
    voice:
      'Direct, warm and human. Talks like a founder who is genuinely interested — no sales talk, no clichés. Short sentences, the occasional wink.',
    dos: [
      'Lead with value and a genuine observation',
      'Ask one concrete, easy follow-up question',
      'Reference something specific from their profile or post',
    ],
    donts: [
      "Don't pitch in the first message",
      'No over-the-top enthusiasm or exclamation marks',
      'No generic openers ("Hi, how are you?")',
    ],
  },
  strategy: {
    stance: 'balanced',
    qualification:
      'Surface fit and intent first with an open question about their current approach. Never qualify like an interrogation — let it flow naturally.',
    closing:
      'Only suggest a short call once there is real interest. Keep the bar low: 15 minutes, no obligation.',
    pushVsWait:
      'When in doubt or met with silence: one light, valuable follow-up. After that, wait rather than keep pushing — protect the relationship.',
  },
  knowledge: {
    questions: [
      {
        id: 'pq_role',
        question: 'What is your role, and why do you do this work?',
        hint: 'Gives your AI context about who is talking.',
        answer:
          'Founder of Replaiy. I build the product myself and talk to sales teams every day — I know how it feels when good leads quietly die in the inbox.',
      },
      {
        id: 'pq_diff',
        question: 'What makes your approach in conversations different?',
        hint: 'How do you stand out personally?',
        answer:
          'I never pitch first. I open with a genuine observation about their work and ask one good question. People can tell it is real.',
      },
      {
        id: 'pq_proof',
        question: 'Which result or story do you like to bring up?',
        hint: 'A concrete proof point that builds trust.',
        answer: '',
      },
    ],
    files: [
      {
        id: 'pf_voice',
        title: 'My writing samples',
        kind: 'note',
        hint: 'Winning messages that genuinely sound like me',
        meta: '8 examples',
      },
      {
        id: 'pf_pitch',
        title: 'Personal pitch',
        kind: 'doc',
        hint: 'How I explain Replaiy in one sentence',
        meta: 'DOC · 1 page',
      },
    ],
  },
};
