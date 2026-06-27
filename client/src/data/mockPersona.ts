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
  /** Which preset is currently applied (null = custom / fine-tuned). */
  activePresetId: string | null;
  tone: ToneProfile;
  strategy: StrategyProfile;
  /** Personal knowledge (questions + files). */
  knowledge: KnowledgeBundle;
}

// ── Persona presets ───────────────────────────────────────────────
// One-click personalities that fill tone + strategy. Pick one and be done,
// or fine-tune afterwards. Each carries the same mascot with a different fin
// colour as a character label (agreed exception to the single-blue rule).
export interface PersonaPreset {
  id: string;
  name: string;
  blurb: string;
  color: string;
  mascot: 'patient' | 'warm' | 'consultative' | 'sharp' | 'direct';
  tone: Pick<ToneProfile, 'formality' | 'length' | 'voice' | 'dos' | 'donts'>;
  strategy: StrategyProfile;
  /** Example opener shown in the live preview. */
  sample: string;
}

export interface PreviewLead {
  name: string;
  headline: string;
  initials: string;
  avatar: string;
}

export const previewLead: PreviewLead = {
  name: 'Emma Chen',
  headline: 'VP Sales · Series-B SaaS',
  initials: 'EC',
  // Same photo as Emma in the inbox, so the preview feels like the real thing.
  avatar: 'https://i.pravatar.cc/120?img=47',
};

export const mockPersona: Persona = {
  memberId: 'mem_simon',
  memberName: 'Simon van Basten',
  memberInitials: 'SB',
  role: 'Founder · Replaiy',
  activePresetId: 'warm',
  tone: {
    language: 'en',
    formality: 'informal',
    length: 'short',
    voice:
      'Direct, warm and human. Talks like a founder who is genuinely interested, no sales talk, no clichés. Short sentences, the occasional wink.',
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
      'Surface fit and intent first with an open question about their current approach. Never qualify like an interrogation; let it flow naturally.',
    closing:
      'Only suggest a short call once there is real interest. Keep the bar low: 15 minutes, no obligation.',
    pushVsWait:
      'When in doubt or met with silence: one light, valuable follow-up. After that, wait rather than keep pushing, and protect the relationship.',
  },
  knowledge: {
    questions: [
      {
        id: 'pq_role',
        question: 'What is your role, and why do you do this work?',
        hint: 'Gives your AI context about who is talking.',
        answer:
          'Founder of Replaiy. I build the product myself and talk to sales teams every day, so I know how it feels when good leads quietly die in the inbox.',
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

// Ordered from most patient to most assertive.
export const personaPresets: PersonaPreset[] = [
  {
    id: 'patient',
    name: 'Patient Nurturer',
    blurb: 'Plays the long game. Stays warm, never pushes.',
    color: '#F59E0B',
    mascot: 'patient',
    tone: {
      formality: 'informal',
      length: 'short',
      voice:
        'Calm, warm and unhurried. Sounds like someone happy to stay in touch with no agenda. Gentle and human.',
      dos: ['Lead with genuine interest', 'Keep it light and low-pressure', 'Add value before anything else'],
      donts: ["Don't ask for time early", 'No urgency or pressure', 'No pitching'],
    },
    strategy: {
      stance: 'patient',
      qualification: 'Let fit emerge naturally over a few light exchanges. No interrogation.',
      closing: 'Only suggest a next step once they clearly lean in. Otherwise keep nurturing.',
      pushVsWait: 'Strongly favour waiting. One soft follow-up at most, then give space.',
    },
    sample:
      'Hey Emma, really enjoyed your take on rep ramp time. No agenda here, just following along. Curious what is working for your team lately?',
  },
  {
    id: 'warm',
    name: 'Warm & Personal',
    blurb: 'Friendly and human. Sounds like a real founder.',
    color: '#2F6BFF',
    mascot: 'warm',
    tone: {
      formality: 'informal',
      length: 'short',
      voice:
        'Direct, warm and human. Talks like a founder who is genuinely interested, no sales talk, no clichés. Short sentences, the occasional wink.',
      dos: [
        'Lead with value and a genuine observation',
        'Ask one concrete, easy follow-up question',
        'Reference something specific from their profile or post',
      ],
      donts: ["Don't pitch in the first message", 'No over-the-top enthusiasm', 'No generic openers'],
    },
    strategy: {
      stance: 'balanced',
      qualification:
        'Surface fit and intent first with an open question about their current approach. Let it flow naturally.',
      closing: 'Suggest a short call once there is real interest. Keep the bar low: 15 minutes, no obligation.',
      pushVsWait: 'One light, valuable follow-up when in doubt, then wait and protect the relationship.',
    },
    sample:
      'Hey Emma, saw your post on scaling SDR outbound, sharp read. Curious how you are handling reply quality as the team grows?',
  },
  {
    id: 'consultative',
    name: 'Consultative',
    blurb: 'Asks sharp questions. Advises before selling.',
    color: '#14B8A6',
    mascot: 'consultative',
    tone: {
      formality: 'neutral',
      length: 'medium',
      voice:
        'Thoughtful and advisory. Leads with smart questions and frames insight before any offer. Calm and credible.',
      dos: ['Open with an insightful question', 'Diagnose before prescribing', 'Reference a relevant pattern you see'],
      donts: ['No pitching before understanding', 'No hype', 'No assumptions about their needs'],
    },
    strategy: {
      stance: 'balanced',
      qualification: 'Qualify deeply through questions about their process, goals and current gaps.',
      closing: 'Propose a working session or call framed as solving a specific problem you uncovered.',
      pushVsWait: 'Follow up with new insight, not reminders. Earn the next step.',
    },
    sample:
      'Hi Emma, quick question on your outbound setup, are dead threads the bottleneck, or is it reply quality? Seeing both slow teams down lately, curious where it bites for you.',
  },
  {
    id: 'sharp',
    name: 'Sharp Closer',
    blurb: 'Direct and focused. Moves toward the next step.',
    color: '#6D5BFF',
    mascot: 'sharp',
    tone: {
      formality: 'neutral',
      length: 'short',
      voice:
        'Confident, crisp and to the point. Friendly but clearly steering toward a next step. No fluff.',
      dos: ['Get to the point quickly', 'Offer a clear, easy next step', 'Stay confident and concise'],
      donts: ['No rambling', 'No over-softening', 'No vague endings'],
    },
    strategy: {
      stance: 'balanced',
      qualification: 'Confirm fit fast with one or two pointed questions.',
      closing: 'Propose a concrete time for a short call early once interest shows.',
      pushVsWait: 'Follow up promptly and clearly. Two nudges before easing off.',
    },
    sample:
      'Hey Emma, we help teams like yours turn dead LinkedIn threads into booked meetings. Worth a quick 15 min this week to see if it fits?',
  },
  {
    id: 'direct',
    name: 'Direct Closer',
    blurb: 'Most assertive. Pushes firmly for the meeting.',
    color: '#F43F5E',
    mascot: 'direct',
    tone: {
      formality: 'neutral',
      length: 'short',
      voice:
        'Bold and decisive. Leads straight to the ask with confidence. Respectful but unmistakably driving to close.',
      dos: ['Open with the value and the ask', 'Be specific about the next step', 'Project conviction'],
      donts: ['No hedging', 'No long warm-ups', 'No leaving the next step open'],
    },
    strategy: {
      stance: 'push',
      qualification: 'Qualify in one line, then move to the ask.',
      closing: 'Ask for the meeting directly with a specific time. Make saying yes effortless.',
      pushVsWait: 'Push persistently with value-led follow-ups until you get a clear yes or no.',
    },
    sample:
      'Emma, straight to it: we book qualified meetings from your existing LinkedIn conversations. I have Thursday 11:00 or Friday 14:00, which works to take a look?',
  },
];

// ── Active persona resolution ──────────────────────────────────────
// The mascot image per preset id (Vite needs static import refs).
import mascotPatient from '@/assets/preset_patient.png';
import mascotWarm from '@/assets/preset_warm.png';
import mascotConsultative from '@/assets/preset_consultative.png';
import mascotSharp from '@/assets/preset_sharp.png';
import mascotDirect from '@/assets/preset_direct.png';

const PRESET_MASCOT: Record<PersonaPreset['mascot'], string> = {
  patient: mascotPatient,
  warm: mascotWarm,
  consultative: mascotConsultative,
  sharp: mascotSharp,
  direct: mascotDirect,
};

// Replaiy's ONE UI accent. Used as the default whenever no preset is active
// (or the balanced "warm" preset is chosen) so the rest of the product stays
// the single blue accent.
export const DEFAULT_AI_ACCENT = '#2F6BFF';

/** The colour + mascot of the currently-active persona, with safe defaults
 *  (blue accent + the real warm mascot). Drives the inbox AI-draft tinting. */
export function activePersona(persona: Persona = mockPersona): {
  color: string;
  mascot: string;
} {
  const preset = personaPresets.find((p) => p.id === persona.activePresetId);
  return {
    color: preset?.color ?? DEFAULT_AI_ACCENT,
    mascot: preset ? PRESET_MASCOT[preset.mascot] : mascotWarm,
  };
}
