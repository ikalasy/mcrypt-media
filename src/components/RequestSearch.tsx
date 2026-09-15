"use client";

import { useEffect, useState } from "react";
import { tmdbImage, type SeerrSearchResult } from "@/lib/seerr-shared";

type Props = { query: string; libraryHit: boolean };

function key(result: SeerrSearchResult): string {
  return `${result.mediaType}-${result.id}`;
}

function yearOf(result: SeerrSearchResult): string {
  return (result.releaseDate ?? result.firstAirDate ?? "").slice(0, 4);
}

function availability(result: SeerrSearchResult): { label: string; tone: string } {
  const status = result.mediaInfo?.status;
  if (status === 5) return { label: "In library", tone: "text-ok" };
  if (status === 4) return { label: "Partly available", tone: "text-warn" };
  if (status === 3) return { label: "Downloading", tone: "text-warn" };
  if (status === 2 || result.mediaInfo?.requests?.length) return { label: "Requested", tone: "text-muted" };
  return { label: "", tone: "" };
}

/** TMDB matches for the same query, each with a Request button when not already in the library. */
export function RequestSearch({ query, libraryHit }: Props) {
  const [results, setResults] = useState<SeerrSearchResult[] | null>(null);
  const [pending, setPending] = useState<Set<string>>(new Set());
  const [notice, setNotice] = useState<string | null>(null);

  // The parent keys this component by query, so a new search mounts fresh with results = null.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/requests/search?q=${encodeURIComponent(query)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error();
        return (await response.json()) as { results: SeerrSearchResult[] };
      })
      .then((json) => {
        if (!cancelled) setResults(json.results);
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setNotice("Request search is unavailable right now.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  async function submit(result: SeerrSearchResult) {
    const k = key(result);
    setPending((prev) => new Set(prev).add(k));
    setNotice(null);
    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaType: result.mediaType, tmdbId: result.id }),
      });
      const json = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(json.error ?? "Request failed.");
      setNotice(`Requested ${result.title ?? result.name}. It shows up in the library once it lands.`);
      setResults((prev) =>
        (prev ?? []).map((r) =>
          key(r) === k ? { ...r, mediaInfo: { status: r.mediaInfo?.status ?? 2, requests: [{ id: 0, status: 1 }] } } : r,
        ),
      );
    } catch (err) {
      setNotice(err instanceof Error ? err.message : "Request failed.");
    } finally {
      setPending((prev) => {
        const next = new Set(prev);
        next.delete(k);
        return next;
      });
    }
  }

  if (results === null) return <p className="label text-dim">Checking TMDB&hellip;</p>;
  const requestable = results.filter((r) => r.mediaInfo?.status !== 5 || !libraryHit);

  return (
    <div>
      {notice && <p className="label mb-5 text-muted" role="status">{notice}</p>}
      {requestable.length === 0 ? (
        <p className="label border border-dashed border-line px-6 py-8 text-center text-dim">No other matches on TMDB.</p>
      ) : (
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8">
          {requestable.map((result) => {
            const poster = tmdbImage(result.posterPath);
            const state = availability(result);
            return (
              <div key={key(result)} className="flex flex-col">
                <div className="relative aspect-[2/3] overflow-hidden border border-line bg-panel">
                  {poster ? (
                    // eslint-disable-next-line @next/next/no-img-element -- TMDB poster
                    <img src={poster} alt="" loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="art-empty h-full w-full" />
                  )}
                  <span className="label absolute left-2 top-2 bg-bg/80 px-1.5 py-0.5 text-[0.6rem] text-muted">
                    {result.mediaType === "tv" ? "Series" : "Movie"}
                  </span>
                </div>
                <p className="label mt-3 truncate">{result.title ?? result.name}</p>
                <p className="label mt-1 text-[0.62rem] text-muted">{yearOf(result) || " "}</p>
                {state.label ? (
                  <p className={`label mt-3 text-[0.62rem] ${state.tone}`}>{state.label}</p>
                ) : (
                  <button
                    type="button"
                    onClick={() => submit(result)}
                    disabled={pending.has(key(result))}
                    className="btn mt-3 justify-center px-3 py-2 text-[0.62rem]"
                  >
                    {pending.has(key(result)) ? "Sending" : "Request"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
