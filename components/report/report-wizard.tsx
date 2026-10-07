"use client";

/**
 * The multi-step report experience (spec §12–§21, §52, §53, §146–148).
 *
 * Step 1 What happened?  → title, AI category suggestion, description, voice input
 * Step 2 Evidence        → photo upload + optional AI image analysis
 * Step 3 Location        → geolocation / search / map pin + privacy choice
 * Step 4 Severity & review → severity, duplicate check, priority preview, submit
 *
 * State survives failures via localStorage, and drafts can be saved server-side.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Copy,
  FileText,
  Lightbulb,
  Loader2,
  MapPin,
  Mic,
  MicOff,
  Save,
  Sparkles,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/input";
import { CategoryIcon } from "@/components/ui/category-icon";
import { FileUploader, type UploadedFile } from "@/components/issues/file-uploader";
import { LocationPicker, type LocationValue } from "@/components/maps/location-picker";
import { PriorityBadge } from "@/components/issues/priority-badge";
import { cn, timeAgo } from "@/lib/utils/format";
import type { Priority, Severity } from "@/lib/types";

interface CategoryOption {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string | null;
}

interface WizardState {
  step: number;
  title: string;
  description: string;
  categorySlug: string;
  categoryAccepted: boolean;
  aiCategory: string | null;
  aiConfidence: number | null;
  aiSeverity: Severity | null;
  severity: Severity | null;
  location: LocationValue;
  imageKeys: string[];
  aiObservations: string[];
}

const EMPTY_LOCATION: LocationValue = {
  latitude: null,
  longitude: null,
  address: "",
  city: "",
  state: "Maharashtra",
  pincode: "",
  locality: "",
  zone: "",
  locationPrivacy: "EXACT",
};

const STORAGE_KEY = "civicissue-report-wizard-v1";

const SEVERITY_OPTIONS: {
  value: Severity;
  title: string;
  example: string;
  tone: string;
}[] = [
  { value: "LOW", title: "Low", example: "Minor inconvenience — a faded marking, a small litter pile.", tone: "border-line bg-surface data-[on=true]:border-info data-[on=true]:bg-info-soft" },
  { value: "MEDIUM", title: "Medium", example: "Meaningful disruption — a streetlight out for days, a slow water leak.", tone: "border-line bg-surface data-[on=true]:border-amber-accent data-[on=true]:bg-amber-soft" },
  { value: "HIGH", title: "High", example: "Significant danger or disruption — a large pothole, blocked drainage flooding homes.", tone: "border-line bg-surface data-[on=true]:border-terra-500 data-[on=true]:bg-terra-50" },
  { value: "CRITICAL", title: "Critical", example: "Immediate safety risk — an open manhole on a school route, exposed live wires.", tone: "border-line bg-surface data-[on=true]:border-alert data-[on=true]:bg-alert-soft" },
];

const STEPS = [
  { label: "What happened?", icon: FileText },
  { label: "Evidence", icon: Camera },
  { label: "Location", icon: MapPin },
  { label: "Severity & review", icon: Check },
];

interface DuplicateCandidate {
  publicId: string;
  title: string;
  categoryName: string;
  distanceMeters: number;
  createdAt: string;
  upvotes: number;
  status: string;
  similarity: number;
  likelyDuplicate: boolean;
}

export default function ReportWizard({
  userName,
  userLocality,
  userCity,
  categories,
  initialDraftId,
}: {
  userName: string;
  userLocality: string | null;
  userCity: string | null;
  categories: CategoryOption[];
  initialDraftId?: string | null;
}) {
  const router = useRouter();
  const [state, setState] = useState<WizardState>(() => ({
    step: 0,
    title: "",
    description: "",
    categorySlug: "",
    categoryAccepted: false,
    aiCategory: null,
    aiConfidence: null,
    aiSeverity: null,
    severity: null,
    location: { ...EMPTY_LOCATION, city: userCity ?? "", locality: userLocality ?? "" },
    imageKeys: [],
    aiObservations: [],
  }));
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [restored, setRestored] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(initialDraftId ?? null);
  const [draftLoaded, setDraftLoaded] = useState(!initialDraftId);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [analyzingImage, setAnalyzingImage] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateCandidate[] | null>(null);
  const [dupChecking, setDupChecking] = useState(false);
  const [priorityPreview, setPriorityPreview] = useState<{
    priority: Priority;
    score: number;
    explanation: string;
  } | null>(null);
  const [listening, setListening] = useState(false);
  const [voiceText, setVoiceText] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [validation, setValidation] = useState<Record<string, string>>({});
  const [savingDraft, setSavingDraft] = useState(false);
  const recognitionRef = useRef<{ stop: () => void } | null>(null);

  const patch = useCallback(
    (p: Partial<WizardState>) => setState((s) => ({ ...s, ...p })),
    []
  );

  // Restore a requested account draft first; otherwise recover local work.
  useEffect(() => {
    let cancelled = false;
    const restoreLocal = () => {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return;
        const saved = JSON.parse(raw) as Partial<WizardState>;
        const location = { ...EMPTY_LOCATION, ...(saved.location ?? {}) };
        const keys = Array.isArray(saved.imageKeys) ? saved.imageKeys.filter((key): key is string => typeof key === "string") : [];
        if (saved.title || saved.description || location.latitude !== null) {
          setState((current) => ({ ...current, ...saved, location, imageKeys: keys, step: 0 }));
          setFiles(keys.map((key) => ({ key, localPreview: key, name: key.split("/").at(-1) ?? "Uploaded photo", size: 0, status: "done" as const, progress: 100 })));
          setRestored(true);
        }
      } catch {
        /* Corrupted local storage is non-fatal. */
      }
    };

    if (!initialDraftId) {
      restoreLocal();
      setDraftLoaded(true);
      return () => { cancelled = true; };
    }

    void fetch(`/api/drafts?id=${encodeURIComponent(initialDraftId)}`, { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load the saved draft.");
        return response.json() as Promise<{ items?: { id: string; payload: Record<string, unknown> }[] }>;
      })
      .then((data) => {
        if (cancelled) return;
        const item = data.items?.[0];
        if (!item) {
          restoreLocal();
          return;
        }
        const payload = item.payload ?? {};
        const saved = payload.state && typeof payload.state === "object" ? payload.state as Partial<WizardState> : null;
        if (!saved) {
          restoreLocal();
          return;
        }
        const location = { ...EMPTY_LOCATION, ...(saved.location ?? {}) };
        const payloadFiles = Array.isArray(payload.files) ? payload.files : [];
        const fromFiles = payloadFiles.flatMap((file) => {
          if (!file || typeof file !== "object") return [];
          const value = file as { key?: unknown; name?: unknown; size?: unknown };
          if (typeof value.key !== "string" || !value.key) return [];
          return [{ key: value.key, localPreview: value.key, name: typeof value.name === "string" ? value.name : "Uploaded photo", size: typeof value.size === "number" ? value.size : 0, status: "done" as const, progress: 100 }];
        });
        const keys = Array.isArray(saved.imageKeys) ? saved.imageKeys.filter((key): key is string => typeof key === "string") : fromFiles.map((file) => file.key);
        const step = typeof saved.step === "number" && Number.isInteger(saved.step) ? Math.min(3, Math.max(0, saved.step)) : 0;
        setState((current) => ({ ...current, ...saved, location, imageKeys: keys, step }));
        setFiles(fromFiles.length ? fromFiles : keys.map((key) => ({ key, localPreview: key, name: key.split("/").at(-1) ?? "Uploaded photo", size: 0, status: "done" as const, progress: 100 })));
        setDraftId(item.id);
        setRestored(true);
      })
      .catch(() => {
        if (!cancelled) {
          restoreLocal();
          toast.error("Couldn't open that saved draft. Any work saved on this device is still available.");
        }
      })
      .finally(() => {
        if (!cancelled) setDraftLoaded(true);
      });

    return () => { cancelled = true; };
  }, [initialDraftId]);

  // Persist locally on every change (debounced through effect). Avoid writing
  // the initial blank state while an account draft is still loading.
  useEffect(() => {
    if (!draftLoaded) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch {
        /* Storage full — non-fatal. */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [state, draftLoaded]);

  // Sync uploaded file keys into state.
  useEffect(() => {
    const keys = files.filter((f) => f.status === "done").map((f) => f.key);
    setState((s) => (keys.join(",") === s.imageKeys.join(",") ? s : { ...s, imageKeys: keys }));
  }, [files]);

  // AI category suggestion when the description is meaningful (debounced).
  useEffect(() => {
    if (state.categoryAccepted) return;
    if (state.description.trim().length < 25) return;
    const t = setTimeout(async () => {
      setClassifying(true);
      try {
        const res = await fetch("/api/ai/classify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title: state.title, description: state.description }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as {
          category: string;
          confidence: number;
          severity: Severity | null;
        };
        setState((s) => ({
          ...s,
          aiCategory: data.category,
          aiConfidence: data.confidence,
          aiSeverity: data.severity ?? s.aiSeverity,
          categorySlug: s.categorySlug || data.category,
        }));
      } catch {
        /* AI unavailable — manual flow continues (spec §63) */
      } finally {
        setClassifying(false);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [state.description, state.title, state.categoryAccepted]);

  const category = useMemo(
    () => categories.find((c) => c.slug === state.categorySlug),
    [categories, state.categorySlug]
  );

  // -------------------------------------------------------------------
  // Voice input (Web Speech API) → AI extraction → editable fields
  // -------------------------------------------------------------------
  const [speechSupported] = useState(
    () => typeof window !== "undefined" && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
  );

  const startVoice = () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const w = window as any;
    const SR = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!SR) {
      toast.error("Voice input isn't supported in this browser. Try Chrome or Edge, or type instead.");
      return;
    }
    const rec = new SR();
    rec.lang = "en-IN";
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => {
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const chunk = event.results[i]![0]!.transcript;
        if (i === event.results.length - 1) interim = chunk;
        else finalText += chunk;
      }
      setVoiceText((finalText + interim).trim());
    };
    rec.onerror = () => {
      setListening(false);
      toast.error("We couldn't hear that. Check your microphone permission and try again.");
    };
    rec.onend = async () => {
      setListening(false);
      const text = finalText.trim() || (voiceText ?? "").trim();
      if (!text) return;
      setExtracting(true);
      try {
        const res = await fetch("/api/ai/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            problem: string | null;
            locationHint: string | null;
            risk: string | null;
            timeContext: string | null;
            categorySlug: string | null;
            severity: Severity | null;
          };
          setState((s) => ({
            ...s,
            title: s.title || (data.problem ?? text.slice(0, 90)),
            description:
              s.description ||
              [text, data.risk && `Risk: ${data.risk}`, data.timeContext && `Duration: ${data.timeContext}`]
                .filter(Boolean)
                .join(" "),
            categorySlug: s.categorySlug || data.categorySlug || "",
            aiCategory: s.aiCategory ?? data.categorySlug,
            aiSeverity: s.aiSeverity ?? data.severity,
            location: data.locationHint
              ? { ...s.location, locality: s.location.locality || data.locationHint }
              : s.location,
          }));
          toast.success("We've filled the form from your voice note — please review everything before submitting.");
        }
      } catch {
        /* fallback: keep raw text */
      } finally {
        setExtracting(false);
      }
    };
    recognitionRef.current = rec;
    rec.start();
    setListening(true);
    setVoiceText("");
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  // -------------------------------------------------------------------
  // AI image analysis (optional assist)
  // -------------------------------------------------------------------
  const analyzeImage = async (file: { base64: string; mimeType: string }) => {
    setAnalyzingImage(true);
    try {
      const res = await fetch("/api/ai/analyze-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: file.base64, mimeType: file.mimeType }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        detectedIssue: string | null;
        severityEstimate: Severity | null;
        confidence: number;
        observations: string[];
        isFallback: boolean;
      };
      if (data.isFallback || (!data.detectedIssue && !data.observations.length)) return;
      setState((s) => ({
        ...s,
        aiSeverity: s.aiSeverity ?? data.severityEstimate,
        aiObservations: data.observations,
      }));
      if (data.severityEstimate) {
        toast.info(`AI analysis suggests this may be a ${data.severityEstimate.toLowerCase()}-severity issue. You can override this.`);
      }
    } catch {
      /* silent — analysis is optional */
    } finally {
      setAnalyzingImage(false);
    }
  };

  // -------------------------------------------------------------------
  // Duplicate check + priority preview when entering review step
  // -------------------------------------------------------------------
  const runDuplicateCheck = useCallback(async () => {
    const { title, description, categorySlug, location } = state;
    if (!categorySlug || location.latitude === null || location.longitude === null) return;
    setDupChecking(true);
    try {
      const res = await fetch("/api/ai/duplicates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          categorySlug,
          latitude: location.latitude,
          longitude: location.longitude,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { candidates: DuplicateCandidate[] };
        setDuplicates(data.candidates.filter((c) => c.likelyDuplicate || c.similarity >= 0.55).slice(0, 3));
      }
    } catch {
      /* non-fatal */
    } finally {
      setDupChecking(false);
    }
  }, [state]);

  const runPriorityPreview = useCallback(async () => {
    if (!state.categorySlug || !state.severity) return;
    try {
      const res = await fetch("/api/ai/priority", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title,
          description: state.description,
          categorySlug: state.categorySlug,
          severity: state.severity,
        }),
      });
      if (res.ok) setPriorityPreview(await res.json());
    } catch {
      /* non-fatal */
    }
  }, [state.title, state.description, state.categorySlug, state.severity]);

  useEffect(() => {
    if (state.step === 3) {
      void runDuplicateCheck();
      void runPriorityPreview();
    }
  }, [state.step, runDuplicateCheck, runPriorityPreview]);

  // -------------------------------------------------------------------
  // Step validation & navigation
  // -------------------------------------------------------------------
  const validateStep = (step: number): boolean => {
    const v: Record<string, string> = {};
    if (step === 0) {
      if (state.title.trim().length < 8) v.title = "Title must contain at least 8 characters — e.g. “Large pothole near college gate”.";
      if (state.title.trim().length > 120) v.title = "Title must be under 120 characters.";
      if (!state.categorySlug) v.category = "Please choose a category so we can route your report.";
      if (state.description.trim().length < 20)
        v.description = "Description must contain at least 20 characters. What exactly is the problem, and who does it affect?";
    }
    if (step === 2) {
      if (state.location.latitude === null || state.location.longitude === null)
        v.location = "Please select a valid location on the map, search for one, or use your current location.";
      if (state.location.pincode && !/^\d{5,6}$/.test(state.location.pincode))
        v.pincode = "Pincode must be 5–6 digits.";
    }
    if (step === 3 && !state.severity) {
      v.severity = "Please choose how serious the problem is.";
    }
    setValidation(v);
    return Object.keys(v).length === 0;
  };

  const next = () => {
    if (!validateStep(state.step)) {
      toast.error("Please fix the highlighted fields before continuing.");
      return;
    }
    patch({ step: Math.min(3, state.step + 1) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const back = () => {
    patch({ step: Math.max(0, state.step - 1) });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // -------------------------------------------------------------------
  // Draft saving (spec §146)
  // -------------------------------------------------------------------
  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftId ?? undefined,
          payload: {
            state,
            files: files.filter((file) => file.status === "done").map(({ key, name, size }) => ({ key, name, size })),
          },
        }),
      });
      const data = (await res.json()) as { id?: string };
      if (res.ok && data.id) {
        setDraftId(data.id);
        toast.success("Draft saved. You can finish this report later from My Reports.");
      }
    } catch {
      toast.error("Couldn't save your draft. Your information is still on this page.");
    } finally {
      setSavingDraft(false);
    }
  };

  // -------------------------------------------------------------------
  // Submit
  // -------------------------------------------------------------------
  const submit = async () => {
    if (!validateStep(0) || !validateStep(2) || !validateStep(3)) {
      toast.error("Some required information is missing. Please review the highlighted steps.");
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const res = await fetch("/api/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: state.title.trim(),
          description: state.description.trim(),
          categorySlug: state.categorySlug,
          severity: state.severity,
          latitude: state.location.latitude,
          longitude: state.location.longitude,
          address: state.location.address || null,
          city: state.location.city || null,
          state: state.location.state || null,
          pincode: state.location.pincode || null,
          locality: state.location.locality || null,
          zone: state.location.zone || null,
          locationPrivacy: state.location.locationPrivacy,
          imageKeys: state.imageKeys,
          aiCategory: state.categoryAccepted ? state.aiCategory : null,
          aiConfidence: state.categoryAccepted ? state.aiConfidence : null,
          aiSeverity: state.aiSeverity,
          aiObservations: state.aiObservations.length ? state.aiObservations : null,
        }),
      });
      const data = (await res.json()) as { publicId?: string; error?: string };
      if (!res.ok || !data.publicId) {
        setSubmitError(
          data.error ?? "We couldn't submit your report. Your information is still here. Please try again."
        );
        return;
      }
      // Clean up local state.
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch { /* ignore */ }
      if (draftId) {
        fetch(`/api/drafts?id=${draftId}`, { method: "DELETE" }).catch(() => {});
      }
      toast.success("Your report has been submitted.");
      router.push(`/report/success/${data.publicId}`);
    } catch {
      setSubmitError("We couldn't submit your report. Your information is still here. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------------
  // Smart assistant tips (spec §53)
  // -------------------------------------------------------------------
  const tips = useMemo(() => {
    const t: { icon: React.ReactNode; text: string }[] = [];
    if (state.step === 0 && state.description.trim().length > 0 && state.description.trim().length < 20)
      t.push({ icon: <Lightbulb className="h-3.5 w-3.5" />, text: "Add a little more detail — at least 20 characters helps the authority understand the problem." });
    if (state.step === 0 && !state.categorySlug && state.description.trim().length >= 25)
      t.push({ icon: <Sparkles className="h-3.5 w-3.5" />, text: "We're reading your description and will suggest a category in a moment." });
    if (state.step === 1 && files.length === 0)
      t.push({ icon: <Camera className="h-3.5 w-3.5" />, text: "Reports with a photo are verified up to 3× faster. Even one picture helps." });
    if (state.step === 2 && state.location.latitude === null)
      t.push({ icon: <MapPin className="h-3.5 w-3.5" />, text: "Your report is missing a location. Adding one will help the authority resolve it faster." });
    if (state.step === 2 && state.location.latitude !== null && state.location.locationPrivacy === "EXACT")
      t.push({ icon: <AlertTriangle className="h-3.5 w-3.5" />, text: "Choose “Approximate” if you'd rather not show your exact spot publicly — staff will still see it." });
    if (state.step === 3 && duplicates && duplicates.length > 0)
      t.push({ icon: <Copy className="h-3.5 w-3.5" />, text: "A similar complaint exists nearby. Supporting it adds weight — but you can still create a new report." });
    if (state.step === 3 && state.severity && priorityPreview)
      t.push({ icon: <Sparkles className="h-3.5 w-3.5" />, text: `Based on everything you entered, the system priority is ${priorityPreview.priority}.` });
    return t.slice(0, 3);
  }, [state, files.length, duplicates, priorityPreview]);

  // -------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      {/* Header + stepper */}
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">Report a civic issue</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Hello {userName.split(" ")[0]} — take your time. Your progress is saved as you type.
          </p>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" size="sm" onClick={saveDraft} loading={savingDraft} disabled={savingDraft}>
            {!savingDraft && <Save className="h-3.5 w-3.5" aria-hidden />} Save draft
          </Button>
          {restored && (
            <button
              type="button"
              onClick={() => {
                localStorage.removeItem(STORAGE_KEY);
                setFiles([]);
                setDraftId(null);
                setDuplicates(null);
                setPriorityPreview(null);
                setState({
                  step: 0, title: "", description: "", categorySlug: "", categoryAccepted: false,
                  aiCategory: null, aiConfidence: null, aiSeverity: null, severity: null,
                  location: { ...EMPTY_LOCATION, city: userCity ?? "", locality: userLocality ?? "" },
                  imageKeys: [], aiObservations: [],
                });
                setRestored(false);
              }}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-muted hover:bg-surface-2"
            >
              <Trash2 className="h-3.5 w-3.5" /> Start fresh
            </button>
          )}
        </div>
      </div>

      {/* Stepper */}
      <ol className="mb-8 flex items-center gap-1.5 sm:gap-2" aria-label="Report progress">
        {STEPS.map((s, i) => {
          const done = state.step > i;
          const current = state.step === i;
          return (
            <li key={s.label} className="flex flex-1 items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={() => (i < state.step ? patch({ step: i }) : validateStep(state.step) && i <= state.step + 1 && patch({ step: i }))}
                className={cn(
                  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors sm:h-9 sm:w-9",
                  done ? "border-verdant bg-verdant text-white" : current ? "border-terra-500 bg-terra-50 text-terra-600" : "border-line bg-surface text-ink-muted"
                )}
                aria-current={current ? "step" : undefined}
                aria-label={`Step ${i + 1}: ${s.label}${done ? " (completed)" : ""}`}
              >
                {done ? <Check className="h-4 w-4" /> : i + 1}
              </button>
              <span className={cn("hidden text-xs font-semibold md:block", current ? "text-ink" : done ? "text-verdant" : "text-ink-muted")}>
                {s.label}
              </span>
              {i < STEPS.length - 1 && <span className={cn("h-0.5 flex-1 rounded", done ? "bg-verdant/40" : "bg-line")} aria-hidden />}
            </li>
          );
        })}
      </ol>

      <div className="grid gap-6 lg:grid-cols-[1fr_290px]">
        <div className="rounded-card border border-line bg-surface p-5 shadow-card sm:p-7">
          {/* ------------------------------------------------------ STEP 1 -- */}
          {state.step === 0 && (
            <div className="space-y-6">
              <header>
                <h2 className="text-lg font-bold text-ink">What happened?</h2>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Describe the problem in your own words. Be specific — it helps the right team respond faster.
                </p>
              </header>

              {speechSupported && (
                <div className={cn("rounded-xl border p-4 transition-colors", listening ? "border-alert bg-alert-soft" : "border-line bg-surface-2/50")}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-ink">Describe by voice</p>
                      <p className="text-[11px] text-ink-muted">
                        {listening ? "Listening… speak naturally about the problem." : "Speak naturally — we'll fill the form for you to review."}
                      </p>
                    </div>
                    <Button type="button" variant={listening ? "danger" : "outline"} size="sm" onClick={listening ? stopVoice : startVoice}>
                      {extracting ? <Loader2 className="h-4 w-4 animate-spin" /> : listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                      {listening ? "Stop" : extracting ? "Reading…" : "Start"}
                    </Button>
                  </div>
                  {voiceText && (
                    <p className="mt-3 rounded-lg bg-surface px-3 py-2 text-xs italic leading-relaxed text-ink-soft">
                      “{voiceText}”
                    </p>
                  )}
                </div>
              )}

              <Field label="Issue title" required error={validation.title} hint="Example: “Large pothole near college gate”">
                {(id) => (
                  <Input
                    id={id}
                    value={state.title}
                    onChange={(e) => patch({ title: e.target.value })}
                    maxLength={120}
                    placeholder="Large pothole near college gate"
                    aria-invalid={!!validation.title || undefined}
                  />
                )}
              </Field>

              {/* AI category suggestion */}
              <fieldset>
                <legend className="mb-2 block text-sm font-medium text-ink">
                  Category <span className="text-alert" aria-hidden>*</span>
                </legend>
                {validation.category && <p className="mb-2 text-xs font-medium text-alert" role="alert">{validation.category}</p>}
                {state.aiCategory && !state.categoryAccepted && (
                  <div className="mb-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-active/30 bg-active-soft px-4 py-3">
                    <Sparkles className="h-4 w-4 text-active" aria-hidden />
                    <p className="flex-1 text-[13px] font-medium text-ink">
                      AI suggestion:{" "}
                      <strong className="text-active">
                        {categories.find((c) => c.slug === state.aiCategory)?.name ?? state.aiCategory}
                      </strong>
                      {state.aiConfidence !== null && (
                        <span className="ml-1.5 text-[11px] font-normal text-ink-muted">
                          {Math.round(state.aiConfidence * 100)}% confident
                        </span>
                      )}
                    </p>
                    <Button type="button" size="sm" onClick={() => patch({ categorySlug: state.aiCategory!, categoryAccepted: true })}>
                      Accept
                    </Button>
                    <Button type="button" size="sm" variant="ghost" onClick={() => patch({ aiCategory: null, categoryAccepted: true })}>
                      Change
                    </Button>
                  </div>
                )}
                {classifying && (
                  <p className="mb-3 flex items-center gap-2 text-xs text-active">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Reading your description…
                  </p>
                )}
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                  {categories.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => patch({ categorySlug: c.slug, categoryAccepted: true })}
                      aria-pressed={state.categorySlug === c.slug}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border p-3 text-left transition-colors",
                        state.categorySlug === c.slug
                          ? "border-terra-500 bg-terra-50 ring-1 ring-terra-300"
                          : "border-line bg-surface hover:border-terra-300 hover:bg-terra-50/40"
                      )}
                    >
                      <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", state.categorySlug === c.slug ? "bg-terra-600 text-white" : "bg-surface-2 text-ink-soft")}>
                        <CategoryIcon name={c.icon} className="h-4 w-4" />
                      </span>
                      <span className="text-[12px] font-semibold leading-tight text-ink">{c.name}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <Field
                label="Description"
                required
                error={validation.description}
                hint={`${state.description.trim().length}/3000 characters — describe what you see, who is affected, and how long it has been like this.`}
              >
                {(id) => (
                  <Textarea
                    id={id}
                    rows={5}
                    value={state.description}
                    onChange={(e) => patch({ description: e.target.value })}
                    maxLength={3000}
                    placeholder="A deep pothole has formed near the main entrance. Two-wheelers are having difficulty passing through it, especially during rain. It has been like this for two weeks."
                    aria-invalid={!!validation.description || undefined}
                  />
                )}
              </Field>
            </div>
          )}

          {/* ------------------------------------------------------ STEP 2 -- */}
          {state.step === 1 && (
            <div className="space-y-5">
              <header>
                <h2 className="text-lg font-bold text-ink">Add evidence</h2>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Photos dramatically speed up verification. Take one from a safe spot that shows the whole problem.
                </p>
              </header>
              <FileUploader files={files} onChange={setFiles} max={6} onAnalyze={analyzeImage} analysisBusy={analyzingImage} />
              {state.aiObservations.length > 0 && (
                <div className="rounded-xl border border-active/25 bg-active-soft px-4 py-3.5">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-active">
                    <Sparkles className="h-4 w-4" aria-hidden /> AI analysis suggests this may be a
                    {state.aiSeverity ? ` ${state.aiSeverity.toLowerCase()}-severity` : ""} issue
                  </p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-relaxed text-ink-soft">
                    {state.aiObservations.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                  <p className="mt-2 text-[11px] text-ink-muted">
                    This is assistance, not truth — you can change the severity in the next steps.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ------------------------------------------------------ STEP 3 -- */}
          {state.step === 2 && (
            <div className="space-y-5">
              <header>
                <h2 className="text-lg font-bold text-ink">Where is it?</h2>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Use your current location, search for a landmark, or drop a pin. Avoid entering your exact home address.
                </p>
              </header>
              {validation.location && (
                <p className="rounded-lg bg-alert-soft px-3.5 py-2.5 text-xs font-medium text-alert" role="alert">
                  {validation.location}
                </p>
              )}
              <LocationPicker
                value={state.location}
                onChange={(location) => patch({ location })}
                defaultLocality={userLocality}
                defaultCity={userCity}
              />
            </div>
          )}

          {/* ------------------------------------------------------ STEP 4 -- */}
          {state.step === 3 && (
            <div className="space-y-6">
              <header>
                <h2 className="text-lg font-bold text-ink">How serious is it?</h2>
                <p className="mt-1 text-[13px] text-ink-muted">
                  Your severity is one input — the system also weighs safety impact, location and community support to compute the final priority.
                </p>
              </header>

              {validation.severity && <p className="text-xs font-medium text-alert" role="alert">{validation.severity}</p>}

              <fieldset className="grid gap-2.5 sm:grid-cols-2" aria-label="Severity level">
                {SEVERITY_OPTIONS.map((opt) => {
                  const on = state.severity === opt.value;
                  return (
                    <label key={opt.value} className="cursor-pointer">
                      <input
                        type="radio"
                        name="severity"
                        value={opt.value}
                        checked={on}
                        onChange={() => patch({ severity: opt.value })}
                        className="sr-only"
                      />
                      <span
                        data-on={on}
                        className={cn(
                          "flex items-start gap-3 rounded-xl border-2 p-4 transition-colors",
                          opt.tone
                        )}
                      >
                        <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2", on ? "border-terra-600 bg-terra-600 text-white" : "border-line-strong")}>
                          {on && <Check className="h-3 w-3" />}
                        </span>
                        <span>
                          <span className="block text-sm font-bold text-ink">{opt.title}</span>
                          <span className="mt-0.5 block text-[11px] leading-relaxed text-ink-muted">{opt.example}</span>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </fieldset>

              {state.aiSeverity && state.severity && state.aiSeverity !== state.severity && (
                <p className="flex items-start gap-2 rounded-lg bg-active-soft px-3.5 py-2.5 text-xs text-ink-soft">
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-active" aria-hidden />
                  The AI suggested <strong>{state.aiSeverity}</strong> from your photos and text, but your choice
                  (<strong>{state.severity}</strong>) is what counts.
                </p>
              )}

              {/* Duplicate banner (spec §20) */}
              {dupChecking && (
                <p className="flex items-center gap-2 text-xs text-ink-muted">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Checking for similar reports nearby…
                </p>
              )}
              {!!duplicates?.length && (
                <div className="rounded-xl border border-amber-accent/40 bg-amber-soft p-4">
                  <p className="flex items-center gap-2 text-sm font-bold text-ink">
                    <AlertTriangle className="h-4 w-4 text-amber-accent" aria-hidden />
                    A similar issue already exists nearby
                  </p>
                  <ul className="mt-3 space-y-2.5">
                    {duplicates.map((d) => (
                      <li key={d.publicId} className="flex flex-wrap items-center gap-3 rounded-lg border border-line bg-surface px-3.5 py-3">
                        <div className="min-w-0 flex-1">
                          <p className="font-mono text-[10px] tracking-wide text-ink-muted">{d.publicId} · {Math.round(d.similarity * 100)}% similar</p>
                          <p className="truncate text-[13px] font-semibold text-ink">{d.title}</p>
                          <p className="text-[11px] text-ink-muted">
                            {d.categoryName} · {d.distanceMeters < 1000 ? `${d.distanceMeters} m away` : `${(d.distanceMeters / 1000).toFixed(1)} km away`} · reported {timeAgo(d.createdAt)} · {d.upvotes} supporters
                          </p>
                        </div>
                        <SupportExistingButton candidate={d} onSupported={() => toast.success("You're now supporting that report. We'll notify you of its progress.")} />
                        <a
                          href={`/issues/${d.publicId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs font-semibold text-terra-600 underline-offset-2 hover:underline"
                        >
                          Open
                        </a>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-3 text-[11px] text-ink-muted">
                    You are never forced to merge — continue below to create your own report if this is a different problem.
                  </p>
                </div>
              )}

              {/* Priority preview */}
              {priorityPreview && (
                <div className="rounded-xl border border-line bg-surface-2/60 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">System priority preview</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <PriorityBadge priority={priorityPreview.priority} score={priorityPreview.score} />
                    <p className="max-w-md text-xs leading-relaxed text-ink-soft">{priorityPreview.explanation}</p>
                  </div>
                </div>
              )}

              {/* Review summary (spec §147) */}
              <div className="rounded-xl border border-line">
                <p className="border-b border-line bg-surface-2/60 px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ink-soft">
                  Review your report
                </p>
                <dl className="divide-y divide-line text-sm">
                  <ReviewRow label="Issue" value={state.title} />
                  <ReviewRow label="Category" value={category?.name ?? "—"} />
                  <ReviewRow label="Priority" value={priorityPreview ? `${priorityPreview.priority} (${priorityPreview.score}/100)` : "Computed on submit"} />
                  <ReviewRow
                    label="Location"
                    value={
                      state.location.latitude !== null
                        ? [state.location.address, state.location.locality, state.location.city].filter(Boolean).join(", ") +
                          (state.location.locationPrivacy === "APPROXIMATE" ? " (approximate)" : "")
                        : "—"
                    }
                  />
                  <ReviewRow label="Evidence" value={`${state.imageKeys.length} photo${state.imageKeys.length === 1 ? "" : "s"}`} />
                  <ReviewRow label="Description" value={state.description.length > 220 ? state.description.slice(0, 220) + "…" : state.description} multiline />
                </dl>
              </div>

              {submitError && (
                <p className="flex items-start gap-2 rounded-lg bg-alert-soft px-4 py-3 text-xs font-medium text-alert" role="alert">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {submitError}
                </p>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="mt-8 flex items-center justify-between gap-3 border-t border-line pt-5">
            <Button type="button" variant="ghost" onClick={back} disabled={state.step === 0 || submitting}>
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </Button>
            {state.step < 3 ? (
              <Button type="button" size="lg" onClick={next}>
                Continue <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            ) : (
              <Button type="button" size="lg" onClick={submit} loading={submitting} disabled={submitting || files.some((f) => f.status === "uploading")}>
                {!submitting && <Check className="h-4 w-4" aria-hidden />} Submit Report
              </Button>
            )}
          </div>
        </div>

        {/* Smart assistant sidebar (spec §53) */}
        <aside className="hidden lg:block" aria-label="Reporting assistant">
          <div className="sticky top-20 space-y-4">
            <div className="rounded-card border border-line bg-surface p-4 shadow-card">
              <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-active">
                <Sparkles className="h-4 w-4" aria-hidden /> Reporting assistant
              </p>
              <ul className="mt-3 space-y-3">
                {tips.length === 0 && (
                  <li className="text-xs leading-relaxed text-ink-muted">
                    Looking good. Fill in the step and I&apos;ll chime in if something could make your report stronger.
                  </li>
                )}
                {tips.map((t, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-xs leading-relaxed text-ink-soft">
                    <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-active-soft text-active" aria-hidden>
                      {t.icon}
                    </span>
                    {t.text}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-card border border-line bg-surface-2/60 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-ink-muted">Good reports include</p>
              <ul className="mt-2.5 space-y-2 text-[11px] leading-relaxed text-ink-soft">
                <li className="flex gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-verdant" aria-hidden /> A clear photo taken from a safe distance</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-verdant" aria-hidden /> How long the problem has existed</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-verdant" aria-hidden /> Who it affects (children, commuters, residents…)</li>
                <li className="flex gap-2"><Check className="mt-0.5 h-3 w-3 shrink-0 text-verdant" aria-hidden /> A nearby landmark for the field team</li>
              </ul>
            </div>
            <p className="px-1 text-[10px] leading-relaxed text-ink-muted">
              Please don&apos;t include personal information about yourself or others. For emergencies, call your
              local emergency services instead of using this platform.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

function ReviewRow({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div className={cn("grid gap-1 px-4 py-3 sm:grid-cols-[140px_1fr] sm:gap-4")}>
      <dt className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className={cn("text-[13px] text-ink", multiline && "leading-relaxed text-ink-soft")}>{value || "—"}</dd>
    </div>
  );
}

function SupportExistingButton({
  candidate,
  onSupported,
}: {
  candidate: DuplicateCandidate;
  onSupported: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  return (
    <Button
      type="button"
      size="sm"
      variant={done ? "success" : "outline"}
      disabled={loading || done}
      onClick={async () => {
        setLoading(true);
        try {
          const res = await fetch(`/api/issues/${candidate.publicId}/upvote`, { method: "POST" });
          if (res.ok) {
            setDone(true);
            onSupported();
          } else {
            const data = (await res.json()) as { error?: string };
            toast.error(data.error ?? "Couldn't support that report.");
          }
        } catch {
          toast.error("Couldn't support that report. Check your connection.");
        } finally {
          setLoading(false);
        }
      }}
    >
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <ThumbsUp className="h-3.5 w-3.5" aria-hidden />}
      {done ? "Supporting" : "Support Existing Issue"}
    </Button>
  );
}
