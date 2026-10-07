"use client";

import { useState, useCallback, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, ImageIcon } from "lucide-react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils/format";

export interface GalleryImage {
  url: string;
  type: string;
  caption?: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  BEFORE: "Before",
  PROGRESS: "Progress",
  AFTER: "After",
  OTHER: "Evidence",
};

/** Evidence gallery with keyboard-accessible lightbox (spec §23). */
export function ImageGallery({ images, className }: { images: GalleryImage[]; className?: string }) {
  const [openIdx, setOpenIdx] = useState<number | null>(null);

  const close = useCallback(() => setOpenIdx(null), []);
  const step = useCallback(
    (dir: number) =>
      setOpenIdx((i) => (i === null ? null : (i + dir + images.length) % images.length)),
    [images.length]
  );

  useEffect(() => {
    if (openIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [openIdx, close, step]);

  if (!images.length) {
    return (
      <div className={cn("flex h-40 items-center justify-center rounded-lg border border-dashed border-line bg-surface-2/50 text-ink-muted", className)}>
        <ImageIcon className="mr-2 h-5 w-5" aria-hidden />
        <p className="text-sm">No photos were attached to this report.</p>
      </div>
    );
  }

  return (
    <>
      <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", className)}>
        {images.map((img, i) => (
          <button
            key={`${img.url}-${i}`}
            onClick={() => setOpenIdx(i)}
            className="group relative aspect-[4/3] overflow-hidden rounded-lg border border-line bg-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-terra-500"
            aria-label={`View evidence photo ${i + 1}${img.caption ? `: ${img.caption}` : ""}`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={img.url}
              alt={img.caption ?? `${TYPE_LABEL[img.type] ?? img.type} evidence photo ${i + 1}`}
              loading="lazy"
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
            />
            <span className="absolute bottom-1.5 left-1.5 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
              {TYPE_LABEL[img.type] ?? img.type}
            </span>
          </button>
        ))}
      </div>
      {openIdx !== null &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="fixed inset-0 z-[1100] flex items-center justify-center bg-ink/90 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Evidence photo viewer"
            onClick={close}
          >
            <button
              className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20"
              onClick={close}
              aria-label="Close viewer"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              className="absolute left-3 rounded-lg bg-white/10 p-2.5 text-white hover:bg-white/20 sm:left-6"
              onClick={(e) => { e.stopPropagation(); step(-1); }}
              aria-label="Previous photo"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={images[openIdx]!.url}
              alt={images[openIdx]!.caption ?? `Evidence photo ${openIdx + 1} of ${images.length}`}
              className="max-h-[82vh] max-w-full rounded-lg object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute right-3 rounded-lg bg-white/10 p-2.5 text-white hover:bg-white/20 sm:right-6"
              onClick={(e) => { e.stopPropagation(); step(1); }}
              aria-label="Next photo"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <p className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-1.5 text-xs text-white">
              {openIdx + 1} / {images.length}
              {images[openIdx]!.caption ? ` · ${images[openIdx]!.caption}` : ""}
            </p>
          </div>,
          document.body
        )}
    </>
  );
}

/** Before/After comparison with a draggable slider (spec §96). */
export function BeforeAfterSlider({ before, after }: { before: string; after: string }) {
  const [pos, setPos] = useState(50);
  const [dragging, setDragging] = useState(false);

  const onMove = (clientX: number, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    setPos(Math.min(98, Math.max(2, ((clientX - rect.left) / rect.width) * 100)));
  };

  return (
    <div
      className="ba-slider relative aspect-[16/10] w-full rounded-lg border border-line bg-surface-2 select-none"
      onMouseDown={(e) => { setDragging(true); onMove(e.clientX, e.currentTarget); }}
      onMouseMove={(e) => dragging && onMove(e.clientX, e.currentTarget)}
      onMouseUp={() => setDragging(false)}
      onMouseLeave={() => setDragging(false)}
      onTouchStart={(e) => { setDragging(true); onMove(e.touches[0]!.clientX, e.currentTarget); }}
      onTouchMove={(e) => dragging && onMove(e.touches[0]!.clientX, e.currentTarget)}
      onTouchEnd={() => setDragging(false)}
      role="slider"
      aria-label="Compare before and after photos"
      aria-valuenow={Math.round(pos)}
      aria-valuemin={0}
      aria-valuemax={100}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft") setPos((p) => Math.max(2, p - 4));
        if (e.key === "ArrowRight") setPos((p) => Math.min(98, p + 4));
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={before} alt="Before resolution" className="absolute inset-0 h-full w-full object-cover" draggable={false} />
      <div className="ba-after" style={{ width: `${pos}%` }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={after} alt="After resolution" className="h-full w-full object-cover" draggable={false} />
      </div>
      <span className="absolute left-2 top-2 rounded bg-ink/70 px-2 py-0.5 text-[10px] font-bold uppercase text-white">Before</span>
      <span className="absolute right-2 top-2 rounded bg-verdant/85 px-2 py-0.5 text-[10px] font-bold uppercase text-white">After</span>
      <div className="absolute inset-y-0 z-10" style={{ left: `${pos}%` }}>
        <div className="h-full w-0.5 -translate-x-1/2 bg-white shadow" />
        <div className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2 flex h-9 w-9 cursor-ew-resize items-center justify-center rounded-full border-2 border-white bg-terra-600 text-white shadow-pop">
          <ChevronLeft className="h-3.5 w-3.5 -mr-1" />
          <ChevronRight className="h-3.5 w-3.5 -ml-1" />
        </div>
      </div>
    </div>
  );
}
