import { PersonForm } from "@/components/forms";

export const metadata = { title: "Add a person" };

export default function NewPersonPage() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-12">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-forest">New person</p>
      <h1 className="mt-2 font-serif text-4xl tracking-tight">Add someone you buy for</h1>
      <p className="mt-3 text-muted">Name and a numeric budget are required. A negative budget is rejected.</p>
      <div className="mt-8">
        <PersonForm submitLabel="Save person" />
      </div>
    </main>
  );
}
