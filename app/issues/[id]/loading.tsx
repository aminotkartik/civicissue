export default function LoadingIssueDetail() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="skeleton h-4 w-48" />
      <div className="mt-3 rounded-xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex gap-2">
          <div className="skeleton h-6 w-28 rounded-full" />
          <div className="skeleton h-6 w-24 rounded-full" />
        </div>
        <div className="skeleton mt-3 h-7 w-3/4 max-w-full" />
        <div className="skeleton mt-3 h-4 w-full max-w-md" />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="skeleton h-20 w-full rounded-xl" />
          <div className="skeleton h-64 w-full rounded-xl" />
          <div className="skeleton h-48 w-full rounded-xl" />
        </div>
        <div className="space-y-5">
          <div className="skeleton h-52 w-full rounded-xl" />
          <div className="skeleton h-64 w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}
