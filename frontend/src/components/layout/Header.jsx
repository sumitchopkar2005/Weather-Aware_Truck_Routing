import { Activity, CloudSun, LoaderCircle } from "lucide-react";

export default function Header({ loading, error }) {
  const status = loading ? "Analyzing trip..." : error ? "API error" : "API ready";

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
      <div className="flex w-full items-center justify-between px-6 py-4 lg:px-10">
        <div className="flex items-center gap-3">
          <div className="rounded-2xl bg-navy p-2.5 text-white shadow-sm">
            <CloudSun size={25} />
          </div>
          <div>
            <p className="text-lg font-bold tracking-tight text-slate-950 sm:text-xl">
              Weather-Aware Truck Routing
            </p>
            <p className="text-xs font-medium text-slate-500 sm:text-sm">
              Weather Intelligence for Safer Trucking
            </p>
          </div>
        </div>
        <div
          className={`flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold sm:text-sm ${
            loading
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {loading ? (
            <LoaderCircle className="animate-spin" size={16} />
          ) : (
            <Activity size={16} />
          )}
          {status}
        </div>
      </div>
    </header>
  );
}
