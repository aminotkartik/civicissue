import { forwardRef, type InputHTMLAttributes, type ReactNode, useId } from "react";
import { cn } from "@/lib/utils/format";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-line bg-surface px-3.5 text-sm text-ink",
        "placeholder:text-ink-muted transition-colors",
        "focus:border-terra-400 focus:outline-none focus:ring-2 focus:ring-terra-200",
        "aria-[invalid=true]:border-alert aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-alert-soft",
        "disabled:bg-surface-2 disabled:text-ink-muted",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        "w-full rounded-lg border border-line bg-surface px-3.5 py-3 text-sm text-ink leading-relaxed",
        "placeholder:text-ink-muted transition-colors min-h-24",
        "focus:border-terra-400 focus:outline-none focus:ring-2 focus:ring-terra-200",
        "aria-[invalid=true]:border-alert aria-[invalid=true]:ring-2 aria-[invalid=true]:ring-alert-soft",
        className
      )}
      {...props}
    />
  )
);
Textarea.displayName = "Textarea";

export interface FieldProps {
  label: string;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  required?: boolean;
  optional?: boolean;
  children: (id: string) => ReactNode;
  className?: string;
}

/** Accessible form field wrapper: label + hint + error (spec §99). */
export function Field({ label, htmlFor, hint, error, required, optional, children, className }: FieldProps) {
  const autoId = useId();
  const id = htmlFor ?? autoId;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
        {required && <span className="text-alert" aria-hidden> *</span>}
        {optional && <span className="text-ink-muted font-normal text-xs ml-1.5">(optional)</span>}
      </label>
      {children(id)}
      {hint && !error && <p className="text-xs text-ink-muted">{hint}</p>}
      {error && (
        <p className="text-xs text-alert font-medium" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
