"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { THEMES, type Theme } from "@/lib/theme-shared";

const LABELS: Record<Theme, string> = { dark: "Dark", light: "Light", auto: "Auto" };

/** Tiny wireframe swatch like the mockup's theme cards. */
function Swatch({ theme }: { theme: Theme }) {
  const dark = { bg: "#0f0f11", bar: "#2a2a2f", accent: "#e0141d" };
  const light = { bg: "#f4f2ee", bar: "#c9c5bc", accent: "#d10f18" };
  const left = theme === "light" ? light : dark;
  const right = theme === "auto" ? light : left;
  return (
    <svg viewBox="0 0 160 64" className="h-16 w-full" aria-hidden>
      <rect width="80" height="64" fill={left.bg} />
      <rect x="80" width="80" height="64" fill={right.bg} />
      <rect x="18" y="16" width="44" height="5" fill={left.bar} />
      <rect x="18" y="27" width="30" height="5" fill={left.accent} />
      <rect x="18" y="38" width="38" height="5" fill={left.bar} />
      <rect x="98" y="16" width="44" height="5" fill={right.bar} />
      <rect x="98" y="27" width="30" height="5" fill={right.accent} />
      <rect x="98" y="38" width="38" height="5" fill={right.bar} />
    </svg>
  );
}

export function ThemePicker({ current }: { current: Theme }) {
  const router = useRouter();
  const [selected, setSelected] = useState<Theme>(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(theme: Theme) {
    setSelected(theme);
    setBusy(true);
    setError(null);
    document.documentElement.setAttribute("data-theme", theme);
    try {
      const response = await fetch("/api/display", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      if (!response.ok) throw new Error();
      router.refresh();
    } catch {
      setError("Could not save the theme.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-4" role="radiogroup" aria-label="Theme">
        {THEMES.map((theme) => {
          const active = theme === selected;
          return (
            <button
              key={theme}
              type="button"
              role="radio"
              aria-checked={active}
              disabled={busy}
              onClick={() => choose(theme)}
              className={`border p-1 text-left transition-colors ${active ? "border-accent" : "border-line hover:border-line-strong"}`}
            >
              <Swatch theme={theme} />
              <p className={`label mt-3 px-1 pb-1 ${active ? "text-text" : "text-muted"}`}>
                {LABELS[theme]}
                {active && <span className="mt-1 block h-[2px] w-6 bg-accent" />}
              </p>
            </button>
          );
        })}
      </div>
      {error && <p className="label mt-4 text-accent" role="alert">{error}</p>}
    </div>
  );
}
