// ── Shared file dropzone ──────────────────────────────────────────
// A single, reusable drop surface used by both the knowledge upload
// (MijnAi.tsx `SourceAdders`) and the campaign Manual-import area
// (CampaignDetail.tsx). One source of truth so the two stay visually
// identical forever. It manages its own `dragging` state and hidden
// file input internally; callers just handle the picked files.
//
// The markup below is the exact treatment from the knowledge dropzone:
// a centered stacked, dashed, rounded surface with an UploadCloud icon,
// a primary line and an optional secondary line, and the blue (#2F6BFF)
// drag state. `w-full` lets it fill its container on any screen size.
import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';

export default function FileDropzone({
  onFiles,
  accept,
  primaryLabel,
  secondaryLabel,
  multiple = false,
  testId,
}: {
  onFiles: (files: File[]) => void;
  accept: string;
  primaryLabel: string;
  secondaryLabel?: string;
  multiple?: boolean;
  testId?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const emit = (list: FileList | null | undefined) => {
    if (list?.length) onFiles(Array.from(list));
  };

  return (
    <div
      data-testid={testId}
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        emit(e.dataTransfer.files);
      }}
      className={`w-full cursor-pointer rounded-2xl border border-dashed px-4 py-5 flex flex-col items-center justify-center gap-1.5 text-center transition-colors ${
        dragging
          ? 'border-[#2F6BFF] bg-[#2F6BFF]/[0.06]'
          : 'border-foreground/15 hover:border-foreground/30 bg-foreground/[0.02] dark:bg-white/[0.02]'
      }`}
    >
      <UploadCloud size={20} strokeWidth={1.8} className="text-icon-muted" />
      <div className="text-[13px] font-medium text-foreground/75">{primaryLabel}</div>
      {secondaryLabel && (
        <div className="text-[11.5px] text-foreground/40">{secondaryLabel}</div>
      )}
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="hidden"
        data-testid={testId ? `${testId}-input` : undefined}
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
