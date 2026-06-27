// ─────────────────────────────────────────────────────────────────
// Mock persona-data — gebruiker/seat niveau (1 persona per member).
//
// Mapt 1:1 op de backend (app/persona/*):
//   • tone_profile     → HOE we klinken (toon, taal, stijl, do's/don'ts)
//   • strategy_profile → WAT we strategisch doen (kwalificeren / closen /
//                        push-vs-wachten)
// De backend serialiseert beide blobs als JSON in de prompt, dus deze
// shape moet schoon door JSON.stringify kunnen. We houden 'm bewust
// gestructureerd (geen losse string) zodat de editor velden kan tonen.
//
// Persoonlijke knowledge (docs/bestanden) hangt OOK aan de gebruiker en
// staat in dit bestand zodat de hub één bron heeft tijdens de mock-fase.
// (Backend: rag_documents met member_id gevuld.)
// ─────────────────────────────────────────────────────────────────

export type ToneFormality = 'informeel' | 'neutraal' | 'formeel';
export type ToneLength = 'kort' | 'gemiddeld' | 'uitgebreid';

export interface ToneProfile {
  /** Taal waarin de AI standaard schrijft. */
  language: 'nl' | 'en';
  /** Mate van formaliteit (je/u, losheid). */
  formality: ToneFormality;
  /** Voorkeurslengte van berichten. */
  length: ToneLength;
  /** Vrije omschrijving van de stem — "klinkt als de gebruiker". */
  voice: string;
  /** Korte, krachtige do's. */
  dos: string[];
  /** Dingen die de AI nooit mag doen. */
  donts: string[];
}

export type StrategyStance = 'push' | 'gebalanceerd' | 'geduldig';

export interface StrategyProfile {
  /** Hoe hard sturen we aan op de volgende stap? */
  stance: StrategyStance;
  /** Hoe kwalificeren we (fit + intentie achterhalen). */
  qualification: string;
  /** Hoe en wanneer closen we (call/demo voorstellen). */
  closing: string;
  /** Wanneer juist wachten i.p.v. duwen. */
  pushVsWait: string;
}

export interface PersonaKnowledgeDoc {
  id: string;
  title: string;
  kind: 'pdf' | 'doc' | 'note' | 'link';
  /** Korte omschrijving / waar het over gaat. */
  hint: string;
  /** Mock-grootte of bron-label. */
  meta: string;
}

export interface Persona {
  memberId: string;
  memberName: string;
  memberInitials: string;
  /** Korte rol/zin onder de naam in de hub-header. */
  role: string;
  tone: ToneProfile;
  strategy: StrategyProfile;
  knowledge: PersonaKnowledgeDoc[];
}

export const mockPersona: Persona = {
  memberId: 'mem_simon',
  memberName: 'Simon van Basten',
  memberInitials: 'SB',
  role: 'Founder · Replaiy',
  tone: {
    language: 'nl',
    formality: 'informeel',
    length: 'kort',
    voice:
      'Direct, warm en menselijk. Praat als een founder die echt geïnteresseerd is — geen sales-praat, geen clichés. Korte zinnen, af en toe een knipoog.',
    dos: [
      'Leid met waarde en een oprechte observatie',
      'Stel één concrete, makkelijke vervolgvraag',
      'Verwijs naar iets specifieks uit hun profiel of post',
    ],
    donts: [
      'Niet pitchen in het eerste bericht',
      'Geen overdreven enthousiasme of uitroeptekens',
      'Geen generieke openers ("Hoi, hoe gaat het?")',
    ],
  },
  strategy: {
    stance: 'gebalanceerd',
    qualification:
      'Achterhaal eerst fit en intentie via een open vraag over hun huidige aanpak. Niet kwalificeren als verhoor — laat het natuurlijk vloeien.',
    closing:
      'Stel pas een korte call voor zodra er echte interesse blijkt. Maak de drempel laag: 15 minuten, geen verplichting.',
    pushVsWait:
      'Bij twijfel of stilte: één lichte, waardevolle follow-up. Daarna wachten i.p.v. blijven duwen — liever de relatie behouden.',
  },
  knowledge: [
    {
      id: 'kn_voice',
      title: 'Mijn schrijfvoorbeelden',
      kind: 'note',
      hint: 'Winnende berichten die echt als mij klinken',
      meta: '8 voorbeelden',
    },
    {
      id: 'kn_pitch',
      title: 'Persoonlijke pitch',
      kind: 'doc',
      hint: 'Hoe ik Replaiy in één zin uitleg',
      meta: 'DOC · 1 pagina',
    },
  ],
};
