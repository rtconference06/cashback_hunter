import { toPersonJson } from "@/lib/person-json";
import { getPerson } from "@/lib/people";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const person = await getPerson(id);
  if (!person) return Response.json({ error: "That person is not on your list." }, { status: 404 });
  return Response.json({ person: toPersonJson(person) });
}
