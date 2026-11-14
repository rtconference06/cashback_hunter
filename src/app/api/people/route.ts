import { toPersonJson } from "@/lib/person-json";
import { listPeople } from "@/lib/people";

export async function GET() {
  const people = await listPeople();
  return Response.json({ people: people.map(toPersonJson) });
}
