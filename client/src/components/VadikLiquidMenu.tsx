// ─────────────────────────────────────────────────────────────────
// VadikLiquidMenu — LETTERLIJK dezelfde DOM-recipe als de tab-pill
// (VadikLiquidSwitcher), maar dan:
//   • Vertical-only
//   • Variabele hoogte (groeit met het aantal items)
//   • Vaste pixel-breedte (bv 200px)
//   • Sliding indicator achter het actieve item
//   • Items hebben icoon + label (naast elkaar, niet alleen icoon)
//
// Gebruikt voor de View-selector dropdown (Inbox/Snoozed/Sent/Done/
// Drafts/Spam etc.) zodat de dropdown identiek matte glass look heeft
// als de tab-pill.
//
// Volgt het tab-pill patroon: outer <div> met hard pixel-w/h en alle
// shadows, inner <fieldset> met backdrop-filter (via fallback CSS),
// per-segment <label> met radio-input.
// ─────────────────────────────────────────────────────────────────
import { useEffect, useId, useRef, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  vadikTrackBoxShadow,
  vadikGlassSurfaceStyle,
} from '@/lib/vadik-glass-style';

export interface VadikMenuOption<K extends string> {
  key: K;
  icon: LucideIcon;
  label: string;
  tint?: string;
}

export interface VadikLiquidMenuProps<K extends string> {
  options: VadikMenuOption<K>[];
  value: K;
  onChange: (key: K) => void;
  /** Width van het menu in px. Default 200. */
  width?: number;
  /** Hoogte per item in px. Default 48. */
  itemHeight?: number;
  /** Verticale padding rondom de items in px. Default 8. */
  padY?: number;
  /** Horizontale padding aan beide kanten in px. Default 8. */
  padX?: number;
  /** Testing id. */
  testId?: string;
}

export function VadikLiquidMenu<K extends string>({
  options,
  value,
  onChange,
  width = 200,
  itemHeight = 48,
  padY = 8,
  padX = 8,
  testId,
}: VadikLiquidMenuProps<K>) {
  const filterId = useId().replace(/:/g, '_');
  const activeIdx = Math.max(0, options.findIndex((o) => o.key === value));
  const prevIdxRef = useRef(activeIdx);
  const [wobble, setWobble] = useState(0);

  // v30.21 — SVG filter UIT voor consistente matte look (zelfde als
  // alle andere glass elementen).
  const [useFallback] = useState(true);

  useEffect(() => {
    if (prevIdxRef.current !== activeIdx) {
      prevIdxRef.current = activeIdx;
      setWobble((k) => k + 1);
    }
  }, [activeIdx]);

  // Schaal exact zoals tab-pill: scale = 1 voor consistente rim/drop.
  const scale = 1;
  const s = (v: number) => v * scale;
  const trackBoxShadow = vadikTrackBoxShadow(s);
  const blurPx = s(8);

  // Total height = padY + items * itemHeight + padY
  const totalH = padY * 2 + options.length * itemHeight;

  // v30.26 — Indicator nu IDENTIEK aan tab-pill: vaste `top`+`left`,
  // beweegt via `transform: translateY(...)` voor smooth sliding,
  // z-index: -1 zodat hij achter de labels door beweegt.
  const indW = width - padX * 2;
  const indH = itemHeight;
  const indX = padX;
  const indYBase = padY; // constant; activeIdx aanpassing via translateY
  const indTranslateY = activeIdx * itemHeight;

  const indicatorBoxShadow = [
    `inset 0 0 0 ${s(1)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 10%), transparent)`,
    `inset ${s(2)}px ${s(1)}px 0px ${s(-1)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 90%), transparent)`,
    `inset ${s(-1.5)}px ${s(-1)}px 0px ${s(-1)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 80%), transparent)`,
    `inset ${s(-2)}px ${s(-6)}px ${s(1)}px ${s(-5)}px color-mix(in srgb, var(--vadik-light, #fff) calc(var(--vadik-reflex-light, 1) * 60%), transparent)`,
    `inset ${s(-1)}px ${s(2)}px ${s(3)}px ${s(-1)}px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 20%), transparent)`,
    `inset 0px ${s(-4)}px ${s(1)}px ${s(-2)}px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 10%), transparent)`,
    `0px ${s(3)}px ${s(6)}px 0px color-mix(in srgb, var(--vadik-dark, #000) calc(var(--vadik-reflex-dark, 1) * 8%), transparent)`,
  ].join(', ');

  return (
    // OUTER — identiek aan tab-pill: <div>, hard pixel-w/h, alle
    // shadows. Border-radius matched the menu's height/2 minimum so
    // we get rounded ends + flat sides if too tall, else fully rounded.
    <div
      data-testid={testId}
      style={{
        position: 'relative',
        display: 'inline-block',
        width,
        height: totalH,
        borderRadius: 24,
        boxShadow: useFallback
          ? `${trackBoxShadow}, 0 0 ${s(20)}px 0 rgba(255, 255, 255, 0.10)`
          : trackBoxShadow,
      }}
    >
      <fieldset
        style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          width: '100%',
          height: '100%',
          boxSizing: 'border-box',
          padding: `${padY}px ${padX}px`,
          margin: 0,
          border: 'none',
          borderRadius: 24,
          color: 'var(--foreground)',
          ...vadikGlassSurfaceStyle(filterId, useFallback, blurPx),
          // v30.28 — background transition uit op de fieldset: bij mount
          // zou hij anders van "niets" naar glass-gradient transitionen,
          // wat een visuele "eerst doorzichtig dan glass" stotter geeft.
          // De gradient is statisch dus een transition is sowieso overbodig.
        }}
      >
        {/* Sliding indicator — IDENTIEK aan tab-pill's ::after:
            position:absolute met vaste top/left, transform translateY
            voor de sliding animatie, z-index:-1 zodat hij achter de
            label-tekst door beweegt. */}
        <div
          key={wobble}
          aria-hidden
          style={{
            position: 'absolute',
            left: indX,
            top: indYBase,
            width: indW,
            height: indH,
            borderRadius: 14,
            backgroundColor:
              'color-mix(in srgb, var(--vadik-glass, #bbbbbc) 36%, transparent)',
            zIndex: -1,
            boxShadow: indicatorBoxShadow,
            transform: `translateY(${indTranslateY}px)`,
            transition:
              'background-color 400ms cubic-bezier(1, 0, 0.4, 1), box-shadow 400ms cubic-bezier(1, 0, 0.4, 1), transform 400ms cubic-bezier(1, 0, 0.4, 1)',
            animation: wobble > 0 ? 'vadikScaleToggleV 440ms ease' : undefined,
            transformOrigin: 'center center',
          }}
        />

        {/* Items */}
        {options.map((opt) => {
          const I = opt.icon;
          const isActive = opt.key === value;
          return (
            <label
              key={opt.key}
              data-testid={testId ? `${testId}-option-${opt.key}` : undefined}
              style={{
                position: 'relative',
                // Labels staan in de natural flow met default z-index
                // (auto), de indicator zit op zIndex -1 en glijdt eronder
                // door — identiek aan tab-pill patroon.
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                paddingLeft: 14,
                paddingRight: 14,
                width: '100%',
                height: itemHeight,
                boxSizing: 'border-box',
                borderRadius: 14,
                cursor: isActive ? 'auto' : 'pointer',
                color: 'var(--foreground)',
                fontSize: 14,
                fontWeight: 500,
                letterSpacing: '-0.005em',
                transition: 'all 160ms',
              }}
              onClick={() => onChange(opt.key)}
              onMouseEnter={(e) => {
                const icon = e.currentTarget.querySelector('svg') as SVGElement | null;
                if (icon && !isActive) icon.style.transform = 'scale(1.2)';
              }}
              onMouseLeave={(e) => {
                const icon = e.currentTarget.querySelector('svg') as SVGElement | null;
                if (icon) icon.style.transform = 'scale(1)';
              }}
            >
              <input
                type="radio"
                name={`vadik-menu-${filterId}`}
                value={opt.key}
                checked={isActive}
                onChange={() => onChange(opt.key)}
                aria-label={opt.label}
                style={{
                  position: 'absolute',
                  width: 1,
                  height: 1,
                  margin: -1,
                  padding: 0,
                  overflow: 'hidden',
                  clip: 'rect(0 0 0 0)',
                  clipPath: 'inset(100%)',
                  whiteSpace: 'nowrap',
                  border: 0,
                }}
              />
              <I
                size={16}
                strokeWidth={1.8}
                style={{
                  display: 'block',
                  flexShrink: 0,
                  transition: 'transform 200ms cubic-bezier(0.5, 0, 0, 1)',
                  transform: 'scale(1)',
                  color: opt.tint ?? 'var(--foreground)',
                }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>{opt.label}</span>
            </label>
          );
        })}
      </fieldset>
    </div>
  );
}

export default VadikLiquidMenu;
