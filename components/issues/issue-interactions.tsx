"use client";

/**
 * Community interaction controls on an issue page: support (upvote),
 * follow, confirm-exists, share and report-abuse (spec §23, §25, §140).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, BellOff, Check, Flag, Share2, ThumbsUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils/format";

export function IssueInteractions({
  publicId,
  title,
  initial,
  isLoggedIn,
  isReporter,
  viewerRole,
}: {
  publicId: string;
  title: string;
  initial: { upvoted: boolean; following: boolean; confirmed: boolean; upvotes: number; confirmations: number };
  isLoggedIn: boolean;
  isReporter: boolean;
  viewerRole: string | null;
}) {
  const router = useRouter();
  const [upvoted, setUpvoted] = useState(initial.upvoted);
  const [upvotes, setUpvotes] = useState(initial.upvotes);
  const [following, setFollowing] = useState(initial.following);
  const [confirmed, setConfirmed] = useState(initial.confirmed);
  const [confirmations, setConfirmations] = useState(initial.confirmations);
  const [busy, setBusy] = useState<string | null>(null);
  const [reportOpen, setReportOpen] = useState(false);

  const requireLogin = () => {
    toast.info("Please log in to interact with this report.", {
      action: { label: "Log in", onClick: () => router.push(`/login?next=/issues/${publicId}`) },
    });
    return false;
  };

  async function call(url: string, method: "POST" | "DELETE" | "PATCH" = "POST", body?: unknown) {
    const res = await fetch(url, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    return res;
  }

  async function toggleUpvote() {
    if (!isLoggedIn) return requireLogin();
    setBusy("upvote");
    try {
      const res = await call(`/api/issues/${publicId}/upvote`);
      const data = (await res.json()) as { upvoted?: boolean; count?: number; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't update your support.");
        return;
      }
      setUpvoted(!!data.upvoted);
      setUpvotes(data.count ?? upvotes);
      toast.success(data.upvoted ? "You're supporting this issue." : "Support removed.");
      router.refresh();
    } catch {
      toast.error("Network problem — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function toggleFollow() {
    if (!isLoggedIn) return requireLogin();
    setBusy("follow");
    try {
      const res = await call(`/api/issues/${publicId}/follow`);
      const data = (await res.json()) as { following?: boolean };
      if (res.ok) {
        setFollowing(!!data.following);
        toast.success(data.following ? "Following — we'll notify you of updates." : "Unfollowed.");
      }
    } catch {
      toast.error("Network problem — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function confirmExists() {
    if (!isLoggedIn) return requireLogin();
    setBusy("confirm");
    try {
      const res = await call(`/api/issues/${publicId}/confirm`);
      const data = (await res.json()) as { count?: number; error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't confirm.");
        return;
      }
      setConfirmed(true);
      setConfirmations(data.count ?? confirmations + 1);
      toast.success("Thanks! Your confirmation helps the authority prioritize.");
      router.refresh();
    } catch {
      toast.error("Network problem — please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    const url = `${window.location.origin}/issues/${publicId}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${title} · CivicIssue`, url });
        return;
      } catch { /* cancelled */ }
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  return (
    <>
      <div className="space-y-2.5">
        <Button
          variant={upvoted ? "success" : "primary"}
          className="w-full"
          size="lg"
          onClick={toggleUpvote}
          loading={busy === "upvote"}
          disabled={busy !== null}
          aria-pressed={upvoted}
        >
          <ThumbsUp className={cn("h-4 w-4", upvoted && "fill-current")} aria-hidden />
          {upvoted ? "Supporting" : "Support this issue"} · {upvotes}
        </Button>
        <div className="grid grid-cols-2 gap-2.5">
          <Button variant="secondary" onClick={toggleFollow} loading={busy === "follow"} disabled={busy !== null} aria-pressed={following}>
            {following ? <BellOff className="h-4 w-4" aria-hidden /> : <Bell className="h-4 w-4" aria-hidden />}
            {following ? "Following" : "Follow"}
          </Button>
          <Button variant="secondary" onClick={share}>
            <Share2 className="h-4 w-4" aria-hidden /> Share
          </Button>
        </div>
        {!isReporter && (
          <Button
            variant="outline"
            className="w-full"
            onClick={confirmExists}
            disabled={confirmed || busy !== null || viewerRole !== "CITIZEN"}
            loading={busy === "confirm"}
          >
            {confirmed ? <Check className="h-4 w-4" aria-hidden /> : <Check className="h-4 w-4 opacity-60" aria-hidden />}
            {confirmed ? `Confirmed (${confirmations})` : "I can confirm this issue exists"}
          </Button>
        )}
        {isLoggedIn && (
          <button
            onClick={() => setReportOpen(true)}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium text-ink-muted hover:bg-surface-2 hover:text-alert"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden /> Report inappropriate content
          </button>
        )}
      </div>

      <ReportAbuseModal open={reportOpen} onClose={() => setReportOpen(false)} publicId={publicId} />
    </>
  );
}

function ReportAbuseModal({
  open,
  onClose,
  publicId,
}: {
  open: boolean;
  onClose: () => void;
  publicId: string;
}) {
  const [reason, setReason] = useState("SPAM");
  const [details, setDetails] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${publicId}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "ISSUE", entityId: publicId, reasonType: reason, details }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't submit the report.");
        return;
      }
      toast.success(data.message ?? "Reported. Our moderators will review this.");
      setDetails("");
      onClose();
    } catch {
      toast.error("Network problem — please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Report inappropriate content" description="Moderators review every report. Submission does not automatically hide the issue." size="sm">
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Reason</span>
          <Select value={reason} onChange={(e) => setReason(e.target.value)} aria-label="Report reason">
            <option value="SPAM">Spam or advertising</option>
            <option value="OFFENSIVE">Offensive content</option>
            <option value="FALSE_INFO">False information</option>
            <option value="PII">Exposes personal information</option>
            <option value="FRAUD">Fraudulent complaint</option>
            <option value="OTHER">Other</option>
          </Select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-ink">Details <span className="text-xs font-normal text-ink-muted">(optional)</span></span>
          <Textarea rows={3} value={details} onChange={(e) => setDetails(e.target.value)} maxLength={1000} placeholder="Tell moderators what's wrong with this content…" />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="danger" onClick={submit} loading={loading} disabled={loading}>Submit report</Button>
        </div>
      </div>
    </Modal>
  );
}
