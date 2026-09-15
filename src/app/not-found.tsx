import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-24 text-center">
      <p className="slash text-5xl">{"//"}</p>
      <p className="label-lg">Not found</p>
      <p className="label text-muted">That title is not in the library, or it moved.</p>
      <Link href="/" className="btn">Back to library</Link>
    </main>
  );
}
