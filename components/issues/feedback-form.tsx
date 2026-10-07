"use client";

/**
 * Citizen feedback after resolution (spec §43) + reopen flow (spec §44).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils/format";

export function FeedbackForm({ publicId }: { publicId: string }) {
  const router = useRouter();
  const [resolutionStatus, setResolutionStatus] = useState<"YES" | "PARTIALLY" | "NO" | null>(null);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    if (!resolutionStatus || rating === 0) {
      toast.error("Please answer both questions before submitting.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${publicId}/feedback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating, resolutionStatus, comment }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't save your feedback.");
        return;
      }
      toast.success("Thank you! Your feedback keeps the platform accountable.");
      router.refresh();
    } catch {
      toast.error("Network problem — please try again.");
    } finally {
      setLoading(false);
    }
  }

  const options = [
    { v: "YES" as const, label: "Yes, fully resolved", cls: "data-[on=true]:border-verdant data-[on=true]:bg-verdant-soft" },
    { v: "PARTIALLY" as const, label: "Partially resolved", cls: "data-[on=true]:border-amber-accent data-[on=true]:bg-amber-soft" },
    { v: "NO" as const, label: "No, not resolved", cls: "data-[on=true]:border-alert data-[on=true]:bg-alert-soft" },
  ];

  return (
    <div className="rounded-xl border border-terra-200 bg-terra-50/60 p-5" aria-labelledby="feedback-heading">
      <h3 id="feedback-heading" className="text-sm font-bold text-ink">Was this issue actually resolved?</h3>
      <p className="mt-1 text-xs text-ink-muted">
        Your honest answer helps the platform measure real outcomes — and lets you reopen the issue if the fix didn&apos;t hold.
      </p>
      <div className="mt-3.5 grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            data-on={resolutionStatus === o.v}
            onClick={() => setResolutionStatus(o.v)}
            aria-pressed={resolutionStatus === o.v}
            className={cn("rounded-lg border-2 bg-surface px-3 py-2.5 text-[13px] font-semibold text-ink transition-colors", o.cls)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <fieldset className="mt-4">
        <legend className="text-sm font-semibold text-ink">Rate the resolution</legend>
        <div className="mt-1.5 flex items-center gap-1" role="radiogroup" aria-label="Rating from 1 to 5 stars">
          {[1, 2, 3, 4, 5].map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={rating === s}
              aria-label={`${s} star${s > 1 ? "s" : ""}`}
              onClick={() => setRating(s)}
              onMouseEnter={() => setHoverRating(s)}
              onMouseLeave={() => setHoverRating(0)}
              className="rounded p-0.5"
            >
              <Star
                className={cn(
                  "h-6 w-6 transition-colors",
                  s <= (hoverRating || rating) ? "fill-amber-accent text-amber-accent" : "text-line-strong"
                )}
                aria-hidden
              />
            </button>
          ))}
          {rating > 0 && <span className="ml-2 text-xs font-semibold text-ink-soft">{rating}/5</span>}
        </div>
      </fieldset>
      <div className="mt-4">
        <Textarea
          rows={2}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={1000}
          placeholder="Optional — tell us more about the outcome…"
          aria-label="Feedback comment (optional)"
        />
      </div>
      <Button className="mt-3.5 w-full sm:w-auto" onClick={submit} loading={loading} disabled={loading}>
        Submit feedback
      </Button>
    </div>
  );
}

export function ReopenButton({ publicId, isReporter }: { publicId: string; isReporter: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (reason.trim().length < 15) {
      setError("Please explain why the issue needs reopening (at least 15 characters).");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/issues/${publicId}/reopen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Couldn't reopen the issue.");
        return;
      }
      toast.success("Issue reopened. The responsible team has been notified.");
      setOpen(false);
      setReason("");
      router.refresh();
    } catch {
      setError("Network problem — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <RotateCcw className="h-4 w-4" aria-hidden />
        {isReporter ? "Problem not fixed? Reopen" : "Reopen issue"}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="Reopen this complaint?" size="sm"
        description="Reopening notifies the authority and restarts the resolution clock.">
        <div className="space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-ink">Why does it need reopening?</span>
            <Textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              maxLength={800}
              placeholder='e.g. "The pothole has reopened after two days and the patch has come apart."'
            />
          </label>
          {error && <p className="text-xs font-medium text-alert" role="alert">{error}</p>}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit} loading={loading} disabled={loading}>Reopen issue</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}
