// ─────────────────────────────────────────────────────────────────
// Compose page — v32
//
// Two presentations, one editor:
//
//   • Desktop (>=1024px): thin wrapper that fills column 3 of the
//     LayoutShell with an InlineReplyBar in composeMode. UI-identical
//     to v31 — no chrome, no sheet, the bar provides its own header
//     and footer like Reply / Forward.
//
//   • Mobile (<1024px): InlineReplyBar is rendered chromeless inside
//     a ComposeSheetMobile wrapper (92vh bottom sheet, glass-strong,
//     blurred inbox behind). The wrapper supplies a sticky top chrome
//     (X / Compose-subject pill / Send) and a sticky bottom glass
//     formatting toolbar. Communication is via imperative ref triggers
//     (sendRef / formatRef / fileRef) that the bar attaches its
//     handlers to.
//
// Mode switching is driven by a matchMedia listener so a rotation /
// resize from one mode to the other re-renders cleanly without a
// full route reload.
// ─────────────────────────────────────────────────────────────────
import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { AnimatePresence } from 'framer-motion';
import { useStilt } from '@/state/StiltContext';
import { InlineReplyBar } from '@/components/InlineReplyBar';
import {
  ComposeSheetMobile,
  useComposeSheetRefs,
} from '@/components/ComposeSheetMobile';
import { ComposeColumnDesktop } from '@/components/ComposeColumnDesktop';

// 1024px breakpoint matches the ContactInfoPanel mobile-sheet pattern
// used elsewhere — anything below the laptop tier gets the sheet.
function useIsCompactViewport(): boolean {
  const [compact, setCompact] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !window.matchMedia('(min-width: 1024px)').matches;
  });
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setCompact(!mq.matches);
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);
  return compact;
}

export function Compose() {
  const [, navigate] = useLocation();
  const { composePrefill, setComposePrefill } = useStilt();

  // One-shot read of any prefill (from expand-from-reply flows). The
  // bar reads these via its defaultSubject / first-render to-state.
  // We clear immediately so a second visit starts blank.
  const prefill = composePrefill;
  if (prefill) setComposePrefill(null);

  const compact = useIsCompactViewport();
  // Live subject mirror — InlineReplyBar pushes changes into this
  // state via its onSubjectChange callback so the mobile sheet pill
  // can render the live preview. Desktop ignores it.
  const [liveSubject, setLiveSubject] = useState<string>(prefill?.subject ?? '');
  // v34.2 — Currently active inline formats (bold/italic/underline/ul/ol)
  // reported by InlineReplyBar via onActiveFormatsChange. Mirrors into the
  // mobile sheet + desktop column so their floating formatting pill can
  // render a glass indicator capsule under each active toggle.
  const [activeFormats, setActiveFormats] = useState<
    Array<'bold' | 'italic' | 'underline' | 'ul' | 'ol'>
  >([]);
  // Stable callback identity — InlineReplyBar uses this in a useEffect
  // dependency array, so passing a fresh function every render would
  // cause an infinite update loop.
  const handleActiveFormatsChange = useCallback(
    (formats: Array<'bold' | 'italic' | 'underline' | 'ul' | 'ol'>) => {
      setActiveFormats(formats);
    },
    [],
  );

  const {
    sendRef,
    formatRef,
    fileRef,
    closeRef,
    hasContentRef,
    saveDraftRef,
    discardRef,
  } = useComposeSheetRefs();

  const handleSend = () => {
    // Draft is already cleared by InlineReplyBar (composeMode key).
    // Mock send: just navigate back to inbox.
    navigate('/');
  };

  const handleClose = () => navigate('/');

  // ─── Mobile presentation (bottom sheet) ─────────────────────────
  if (compact) {
    return (
      <AnimatePresence>
        <ComposeSheetMobile
          key="compose-sheet"
          subject={liveSubject}
          onClose={handleClose}
          sendRef={sendRef}
          formatRef={formatRef}
          fileRef={fileRef}
          closeRef={closeRef}
          hasContentRef={hasContentRef}
          saveDraftRef={saveDraftRef}
          discardRef={discardRef}
          activeFormats={activeFormats}
        >
          <InlineReplyBar
            composeMode
            chromeless
            defaultSubject={prefill?.subject ?? ''}
            recipientEmail={prefill?.to}
            aiDraft={prefill?.body ?? null}
            onSend={handleSend}
            onSubjectChange={setLiveSubject}
            onComposeClose={handleClose}
            onActiveFormatsChange={handleActiveFormatsChange}
            externalSendTrigger={sendRef}
            externalFormatTrigger={formatRef}
            externalFileTrigger={fileRef}
            externalRequestCloseTrigger={closeRef}
            externalHasContentTrigger={hasContentRef}
            externalSaveDraftTrigger={saveDraftRef}
            externalDiscardTrigger={discardRef}
          />
        </ComposeSheetMobile>
      </AnimatePresence>
    );
  }

  // ─── Desktop presentation (column 3 fill with glass chrome) ────
  // v33 — Desktop now uses ComposeColumnDesktop so it matches the
  // mobile sheet's chrome (X / Compose+subject pill / Send + floating
  // formatting pill). InlineReplyBar runs in chromeless mode so it
  // hides its own header right-side group, internal formatting
  // toolbar, and floating send circle — letting the wrapper supply
  // them instead.
  return (
    <ComposeColumnDesktop
      subject={liveSubject}
      onClose={handleClose}
      onSend={handleSend}
      sendRef={sendRef}
      formatRef={formatRef}
      fileRef={fileRef}
      closeRef={closeRef}
      hasContentRef={hasContentRef}
      saveDraftRef={saveDraftRef}
      discardRef={discardRef}
      activeFormats={activeFormats}
    >
      <InlineReplyBar
        composeMode
        chromeless
        defaultSubject={prefill?.subject ?? ''}
        recipientEmail={prefill?.to}
        aiDraft={prefill?.body ?? null}
        onSend={handleSend}
        onSubjectChange={setLiveSubject}
        onComposeClose={handleClose}
        onActiveFormatsChange={handleActiveFormatsChange}
        externalSendTrigger={sendRef}
        externalFormatTrigger={formatRef}
        externalFileTrigger={fileRef}
        externalRequestCloseTrigger={closeRef}
        externalHasContentTrigger={hasContentRef}
        externalSaveDraftTrigger={saveDraftRef}
        externalDiscardTrigger={discardRef}
      />
    </ComposeColumnDesktop>
  );
}

export default Compose;
