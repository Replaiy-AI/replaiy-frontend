// ─────────────────────────────────────────────────────────────────
// GlassTextarea — the auto-growing, optionally surface-less textarea used
// for knowledge answers (Persona / knowledge editors) and the campaign Goal
// description. Shared so both surfaces stay byte-for-byte consistent.
//
// `bare` removes the textarea's own surface (no background, border, radius,
// inset shadow or padding): the surrounding rp-card IS the field, so the user
// types straight into the card instead of into a framed block-in-block. Only
// the text styling + auto-grow behaviour is kept.
// ─────────────────────────────────────────────────────────────────
import { useRef, useLayoutEffect } from 'react';

export function GlassTextarea({
  value,
  onChange,
  placeholder,
  rows = 3,
  testId,
  bare = false,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  testId?: string;
  /** When true, the textarea has NO surface of its own (no background, border,
   *  radius, inset shadow or padding): the surrounding rp-card IS the field, so
   *  the user types straight into the card instead of into a framed block-in-
   *  block. Only the text styling + auto-grow behaviour is kept. */
  bare?: boolean;
}) {
  // Auto-grow to fit content so answers never clip (rows is the min height).
  // On a narrow phone an answer can wrap to more lines than `rows` — without
  // this the last line would be hidden by the fixed-height textarea.
  const ref = useRef<HTMLTextAreaElement>(null);
  const resize = () => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  };
  // Recalculate on value change.
  useLayoutEffect(() => {
    resize();
  }, [value]);
  // Recalculate after first layout settles (fonts/responsive width) and on any
  // width change. Without this the initial scrollHeight is measured against a
  // not-yet-final width, so wrapped answers can clip on narrow phones. We also
  // wait for web fonts to finish loading because metrics shift line-wrapping,
  // and resize once more on the next frame after that.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const raf = requestAnimationFrame(() => requestAnimationFrame(resize));
    const ro = new ResizeObserver(() => resize());
    ro.observe(el);
    let fontRaf = 0;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts?.ready) {
      fonts.ready.then(() => {
        fontRaf = requestAnimationFrame(resize);
      });
    }
    return () => {
      cancelAnimationFrame(raf);
      cancelAnimationFrame(fontRaf);
      ro.disconnect();
    };
  }, []);
  return (
    <textarea
      ref={ref}
      data-testid={testId}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      className={
        bare
          ? 'w-full resize-none bg-transparent p-0 text-[14px] leading-[1.5] text-foreground/90 placeholder:text-foreground/35 outline-none overflow-hidden'
          : 'w-full resize-none rounded-2xl bg-foreground/[0.035] dark:bg-white/[0.04] px-3.5 py-2.5 text-[14px] leading-[1.5] text-foreground/90 placeholder:text-foreground/35 outline-none focus:bg-foreground/[0.06] dark:focus:bg-white/[0.06] transition-colors overflow-hidden'
      }
      style={bare ? undefined : { boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.05)' }}
    />
  );
}
