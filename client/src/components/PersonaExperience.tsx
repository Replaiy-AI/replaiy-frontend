// ─────────────────────────────────────────────────────────────────
// PersonaExperience — the living top of the Persona detail pane.
//
// Two parts, designed to "ontzorg" the user and bring the platform to life:
//   1. Preset cards  — five one-click personalities (same mascot, different
//      fin colour). Picking one fills tone + strategy. Rich micro-animations:
//      idle breathing, hover lift + fin glow, springy pop on click, the
//      selected card stays gently alive with an accent ring.
//   2. Live preview  — the selected mascot + an example LinkedIn opener in the
//      inbox bubble style. The message rewrites itself (fade/slide) whenever
//      the personality or tone changes, so the user sees the effect instantly.
//
// All motion uses framer-motion (Apple springs). Built on the real design
// primitives (stilt-card, glass). The preset colours live ONLY here as
// character labels — blue #2F6BFF stays the single UI accent elsewhere.
// ─────────────────────────────────────────────────────────────────
import { AnimatePresence, motion } from 'framer-motion';
import { APPLE_SPRING } from '@/lib/motion';
import { Check } from 'lucide-react';
import {
  personaPresets,
  previewLead,
  type Persona,
  type PersonaPreset,
} from '@/data/mockPersona';
import { StiltAvatar } from '@/components/Avatar';

// Resolve the mascot image per preset id (Vite needs static import refs).
import mascotPatient from '@/assets/preset_patient.png';
import mascotWarm from '@/assets/preset_warm.png';
import mascotConsultative from '@/assets/preset_consultative.png';
import mascotSharp from '@/assets/preset_sharp.png';
import mascotDirect from '@/assets/preset_direct.png';

const MASCOT: Record<PersonaPreset['mascot'], string> = {
  patient: mascotPatient,
  warm: mascotWarm,
  consultative: mascotConsultative,
  sharp: mascotSharp,
  direct: mascotDirect,
};

// ── One preset card ───────────────────────────────────────────────
function PresetCard({
  preset,
  active,
  onPick,
  index,
}: {
  preset: PersonaPreset;
  active: boolean;
  onPick: () => void;
  index: number;
}) {
  return (
    <motion.button
      type="button"
      data-testid={`preset-${preset.id}`}
      aria-pressed={active}
      onClick={onPick}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...APPLE_SPRING, delay: 0.04 * index }}
      whileHover="hover"
      whileTap={{ scale: 0.97 }}
      className="stilt-card relative rounded-3xl p-4 flex flex-col items-center text-center shrink-0 w-[150px] hover-elevate active-elevate-2"
      style={{
        // Selected = a soft accent ring + tint in the preset colour.
        boxShadow: active
          ? `inset 0 0 0 1.5px ${preset.color}, 0 6px 22px -8px ${preset.color}66`
          : undefined,
      }}
    >
      {/* Mascot — idle breathing; lifts + tilts on hover; the selected one
          stays a touch more alive. */}
      <motion.div
        className="relative w-[88px] h-[88px] flex items-center justify-center"
        variants={{ hover: { y: -6, rotate: -3, scale: 1.06 } }}
        transition={APPLE_SPRING}
      >
        {/* Coloured glow behind the mascot — every preset keeps a soft always-on
            podium in its colour (so each personality reads even when unselected
            and the mascot stays grounded on dark cards); blooms stronger on
            hover and when selected. */}
        <motion.div
          aria-hidden
          className="absolute inset-0 rounded-full"
          initial={false}
          animate={{ opacity: active ? 0.55 : 0.22 }}
          variants={{ hover: { opacity: 0.6 } }}
          transition={APPLE_SPRING}
          style={{
            background: `radial-gradient(circle at 50% 48%, ${preset.color}, transparent 68%)`,
            filter: 'blur(11px)',
          }}
        />
        <motion.img
          src={MASCOT[preset.mascot]}
          alt=""
          aria-hidden
          draggable={false}
          className="relative w-[84px] h-[84px] object-contain select-none pointer-events-none"
          animate={
            active
              ? { y: [0, -4, 0] }
              : { y: [0, -2, 0] }
          }
          transition={{
            duration: active ? 2.6 : 3.6,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </motion.div>

      <div className="mt-2 text-[14px] font-semibold tracking-[-0.01em] text-foreground leading-tight">
        {preset.name}
      </div>
      <div className="mt-1 text-[11.5px] leading-[1.4] text-foreground/55">{preset.blurb}</div>

      {/* Selected check — small, in the preset colour. */}
      <AnimatePresence>
        {active && (
          <motion.div
            key="check"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={APPLE_SPRING}
            className="absolute top-3 right-3 h-5 w-5 rounded-full flex items-center justify-center"
            style={{ background: preset.color }}
          >
            <Check size={12} strokeWidth={3} className="text-white" />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
}

// ── Live preview bubble ───────────────────────────────────────────
function LivePreview({
  preset,
  sample,
}: {
  preset: PersonaPreset | undefined;
  /** The opener to show — rewrites with a fade/slide when it changes. */
  sample: string;
}) {
  const mascotSrc = MASCOT[preset?.mascot ?? 'warm'];

  return (
    <div className="stilt-card rounded-3xl p-5" data-testid="persona-preview">
      {/* Header — one calm line, no trailing fragment. */}
      <div className="mb-1">
        <span className="text-[12.5px] font-semibold tracking-[-0.005em] text-foreground">
          Example message
        </span>
      </div>
      <p className="text-[11.5px] leading-[1.45] text-foreground/45 mb-4">
        Just to give you a feel. Your AI adapts every message to the lead and context.
      </p>

      {/* Lead identity row — mirrors the inbox conversation header (with photo). */}
      <div className="flex items-center gap-2.5 mb-4">
        <StiltAvatar name={previewLead.name} src={previewLead.avatar} size={32} />
        <div className="min-w-0">
          <div className="text-[13.5px] font-semibold text-foreground leading-tight">
            {previewLead.name}
          </div>
          <div className="text-[11.5px] text-foreground/50 truncate">{previewLead.headline}</div>
        </div>
      </div>

      {/* The AI's message — mascot + bubble, styled exactly like the inbox
          conversation (.stilt-bubble, same radius/type/tail + timestamp). */}
      <div className="flex items-end gap-2.5">
        <motion.img
          src={mascotSrc}
          alt=""
          aria-hidden
          draggable={false}
          className="w-8 h-8 object-contain shrink-0 select-none pointer-events-none mb-5"
          key={`m-${preset?.id ?? 'warm'}`}
          initial={{ scale: 0.6, opacity: 0, y: 6 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={APPLE_SPRING}
        />
        <div className="min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={sample}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
              className="stilt-bubble rounded-[20px] px-3.5 py-2.5 text-[14.5px] leading-[1.5] text-foreground inline-block"
              style={{ borderBottomLeftRadius: 6 }}
              data-testid="persona-preview-bubble"
            >
              {sample}
            </motion.div>
          </AnimatePresence>
          <div className="text-[10.5px] mt-1 ml-1 tabular-nums text-foreground/45">
            Just now
          </div>
        </div>
      </div>
    </div>
  );
}

// ── The experience: presets row + live preview ────────────────────
export function PersonaExperience({
  persona,
  setPersona,
}: {
  persona: Persona;
  setPersona: React.Dispatch<React.SetStateAction<Persona>>;
}) {
  const activeId = persona.activePresetId;
  const activePreset = personaPresets.find((p) => p.id === activeId);

  // Applying a preset fills tone + strategy and marks it active. Language is
  // preserved (it's the user's own choice, not part of a personality).
  const applyPreset = (preset: PersonaPreset) => {
    setPersona((prev) => ({
      ...prev,
      activePresetId: preset.id,
      tone: {
        ...prev.tone,
        formality: preset.tone.formality,
        length: preset.tone.length,
        voice: preset.tone.voice,
        dos: [...preset.tone.dos],
        donts: [...preset.tone.donts],
      },
      strategy: { ...preset.strategy },
    }));
  };

  // The preview message: the active preset's sample, or a gentle default.
  const sample =
    activePreset?.sample ??
    'Hey Emma, saw your work on scaling outbound. Curious how you are thinking about reply quality lately?';

  return (
    <div className="flex flex-col gap-5">
      {/* Presets — horizontally scrollable row of personality cards. */}
      <section>
        <div className="flex items-baseline justify-between mb-3 px-2">
          <span className="text-[12.5px] font-semibold tracking-[-0.005em] text-foreground">
            Choose a personality
          </span>
          <span className="text-[12px] text-foreground/45">Pick one, or fine-tune below</span>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1 -mx-1 px-1">
          {personaPresets.map((preset, i) => (
            <PresetCard
              key={preset.id}
              preset={preset}
              active={preset.id === activeId}
              onPick={() => applyPreset(preset)}
              index={i}
            />
          ))}
        </div>
      </section>

      {/* Live preview — the mascot speaking, message reshapes on change. */}
      <LivePreview preset={activePreset} sample={sample} />
    </div>
  );
}

export default PersonaExperience;
