"use client";

/** Last-resort boundary for failures in the root layout itself. */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  void error;
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#faf7f2", color: "#26221d" }}>
        <div style={{ maxWidth: 420, margin: "0 auto", padding: "96px 24px", textAlign: "center" }}>
          <h1 style={{ fontSize: 20, fontWeight: 700 }}>CivicIssue hit an unexpected error</h1>
          <p style={{ marginTop: 8, fontSize: 14, color: "#575046" }}>
            Please retry. If the problem persists, contact the platform administrator.
          </p>
          <button
            onClick={reset}
            style={{
              marginTop: 24,
              background: "#bf4726",
              color: "#fff",
              border: 0,
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
