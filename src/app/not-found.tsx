import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="font-serif text-4xl">That page is not on the desk.</h1>
      <Link href="/" className="mt-6 inline-flex h-10 items-center rounded-full bg-ink px-4 text-sm text-paper">
        Back to upcoming
      </Link>
    </main>
  );
}
