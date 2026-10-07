"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils/format";

/** Web Share API with copy-link fallback (spec §139). */
export function ShareButton({
  publicId,
  title,
  variant = "primary",
  className,
}: {
  publicId: string;
  title: string;
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${window.location.origin}/issues/${publicId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} · CivicIssue`, url });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy the link. Your browser blocked clipboard access.");
    }
  }

  const styles = {
    primary: "bg-terra-600 text-white hover:bg-terra-700",
    secondary: "border border-line bg-surface text-ink-soft hover:bg-surface-2",
    ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
  };

  return (
    <button
      type="button"
      onClick={share}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-5 text-sm font-semibold transition-colors",
        styles[variant],
        className
      )}
      aria-label={`Share complaint ${publicId}`}
    >
      {copied ? <Check className="h-4 w-4" aria-hidden /> : <Share2 className="h-4 w-4" aria-hidden />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
