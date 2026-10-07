"use client";

/**
 * Comments section with role indicators, moderation for staff, and
 * spam-aware rate feedback (spec §24).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EyeOff, Eye, Flag, MessageCircle, Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { ConfirmDialog, Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { timeAgo } from "@/lib/utils/format";

export interface CommentItem {
  id: string;
  content: string;
  createdAt: string | Date;
  isHidden: boolean;
  user: { id: string; name: string; role: string; profileImage: string | null };
}

const ROLE_BADGE: Record<string, { label: string; cls: string }> = {
  CITIZEN: { label: "Citizen", cls: "bg-info-soft text-info" },
  AUTHORITY: { label: "Authority", cls: "bg-terra-100 text-terra-700" },
  WORKER: { label: "Field Worker", cls: "bg-amber-soft text-amber-accent" },
  ADMIN: { label: "Admin", cls: "bg-active-soft text-active" },
};

export function CommentsSection({
  publicId,
  comments,
  isLoggedIn,
  canModerate,
}: {
  publicId: string;
  comments: CommentItem[];
  isLoggedIn: boolean;
  canModerate: boolean;
}) {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<CommentItem | null>(null);
  const [pendingReport, setPendingReport] = useState<CommentItem | null>(null);

  async function submit() {
    if (content.trim().length < 2) {
      toast.error("Comment cannot be empty.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/issues/${publicId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content.trim() }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Couldn't post your comment.");
        return;
      }
      setContent("");
      toast.success("Comment added.");
      router.refresh();
    } catch {
      toast.error("Network problem — please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function moderate(comment: CommentItem, action: "hide" | "restore" | "delete") {
    try {
      const res = await fetch(`/api/comments/${comment.id}`, {
        method: action === "delete" ? "DELETE" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: action === "delete" ? undefined : JSON.stringify({ action }),
      });
      if (res.ok) {
        toast.success(action === "delete" ? "Comment deleted." : action === "hide" ? "Comment hidden from public view." : "Comment restored.");
        router.refresh();
      } else {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Couldn't moderate the comment.");
      }
    } catch {
      toast.error("Network problem — please try again.");
    }
  }

  return (
    <section aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-ink-muted">
        <MessageCircle className="h-4 w-4" aria-hidden /> Discussion ({comments.length})
      </h2>

      {isLoggedIn ? (
        <div className="mt-4 space-y-2.5">
          <Textarea
            rows={3}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            maxLength={1000}
            placeholder="Add helpful, respectful information about this issue…"
            aria-label="Write a comment"
          />
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-ink-muted">
              Keep it constructive. Abuse, spam and personal information are removed.
            </p>
            <Button size="sm" onClick={submit} loading={loading} disabled={loading || content.trim().length < 2}>
              Post comment
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-3 rounded-lg bg-surface-2 px-4 py-3 text-[13px] text-ink-soft">
          <a href={`/login?next=/issues/${publicId}`} className="font-semibold text-terra-600 hover:underline">Log in</a>{" "}
          to join the discussion.
        </p>
      )}

      <ul className="mt-5 space-y-4">
        {comments.length === 0 && (
          <li className="rounded-lg border border-dashed border-line px-4 py-6 text-center text-[13px] text-ink-muted">
            No comments yet. Be the first to add useful information.
          </li>
        )}
        {comments.map((c) => {
          const badge = ROLE_BADGE[c.user.role] ?? ROLE_BADGE.CITIZEN!;
          return (
            <li key={c.id} className={c.isHidden ? "opacity-55" : undefined}>
              <div className="flex gap-3">
                <Avatar name={c.user.name} src={c.user.profileImage} role={c.user.role} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink">{c.user.name}</span>
                    <span className={`rounded px-1.5 py-px text-[10px] font-bold uppercase tracking-wide ${badge.cls}`}>
                      {badge.label}
                    </span>
                    <span className="text-[11px] text-ink-muted">{timeAgo(c.createdAt)}</span>
                    {c.isHidden && (
                      <span className="rounded bg-alert-soft px-1.5 py-px text-[10px] font-bold uppercase text-alert">Hidden</span>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-wrap text-[13px] leading-relaxed text-ink-soft">{c.content}</p>
                  {canModerate && (
                    <div className="mt-1.5 flex gap-3">
                      <button
                        onClick={() => moderate(c, c.isHidden ? "restore" : "hide")}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted hover:text-ink"
                      >
                        {c.isHidden ? <Eye className="h-3 w-3" aria-hidden /> : <EyeOff className="h-3 w-3" aria-hidden />}
                        {c.isHidden ? "Restore" : "Hide"}
                      </button>
                      <button
                        onClick={() => setPendingDelete(c)}
                        className="inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted hover:text-alert"
                      >
                        <Trash2 className="h-3 w-3" aria-hidden /> Delete
                      </button>
                    </div>
                  )}
                  {isLoggedIn && !canModerate && (
                    <button onClick={() => setPendingReport(c)} className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-ink-muted hover:text-alert">
                      <Flag className="h-3 w-3" aria-hidden /> Report comment
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <CommentReportModal
        open={!!pendingReport}
        publicId={publicId}
        commentId={pendingReport?.id ?? ""}
        onClose={() => setPendingReport(null)}
      />
      <ConfirmDialog
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={() => {
          if (pendingDelete) void moderate(pendingDelete, "delete");
          setPendingDelete(null);
        }}
        title="Delete comment?"
        message={
          <>
            This permanently removes the comment from the discussion. The action is
            recorded in the moderation audit log.
          </>
        }
        confirmLabel="Delete comment"
      />
    </section>
  );
}

function CommentReportModal({
  open,
  publicId,
  commentId,
  onClose,
}: {
  open: boolean;
  publicId: string;
  commentId: string;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("SPAM");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    try {
      const response = await fetch(`/api/issues/${encodeURIComponent(publicId)}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entityType: "COMMENT", entityId: commentId, reasonType: reason, details }),
      });
      const data = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(data.error ?? "Couldn't report this comment.");
      toast.success(data.message ?? "Thanks. Moderators will review this comment.");
      setDetails("");
      onClose();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't report this comment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Report comment" description="Moderators review every report. Submission does not automatically hide the comment." size="sm">
      <div className="space-y-4">
        <label className="block space-y-1.5"><span className="text-sm font-medium text-ink">Reason</span><Select value={reason} onChange={(event) => setReason(event.target.value)} aria-label="Reason for reporting comment"><option value="SPAM">Spam or advertising</option><option value="OFFENSIVE">Offensive content</option><option value="FALSE_INFO">False information</option><option value="PII">Personal information</option><option value="FRAUD">Fraud</option><option value="OTHER">Other</option></Select></label>
        <label className="block space-y-1.5"><span className="text-sm font-medium text-ink">Details <span className="text-xs font-normal text-ink-muted">(optional)</span></span><Textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={1000} rows={3} placeholder="What should the moderator review?" /></label>
        <div className="flex justify-end gap-2"><Button variant="ghost" onClick={onClose}>Cancel</Button><Button variant="danger" onClick={() => void submit()} loading={saving}><Flag className="h-3.5 w-3.5" aria-hidden /> Send report</Button></div>
      </div>
    </Modal>
  );
}
