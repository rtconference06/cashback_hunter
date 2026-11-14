import { previewHobbies } from "@/lib/lists";

export const NO_UPCOMING_OCCASIONS = "No upcoming occasions";

export function PersonListMeta({
  budget,
  nextOccasion,
  hobbies,
}: {
  budget: string;
  nextOccasion: { title: string; label: string } | null;
  hobbies: string[];
}) {
  const preview = previewHobbies(hobbies);
  return (
    <>
      <span className="block text-xs text-[#575757]">Budget {budget}</span>
      <span className="block text-xs text-[#575757]">
        {nextOccasion ? `${nextOccasion.title} · ${nextOccasion.label}` : NO_UPCOMING_OCCASIONS}
      </span>
      {preview.shown.length ? (
        <span className="block text-xs text-[#575757]">
          {preview.shown.join(", ")}
          {preview.extra > 0 ? ` +${preview.extra}` : ""}
        </span>
      ) : null}
    </>
  );
}
