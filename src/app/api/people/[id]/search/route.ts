import { searchAdhocNeed } from "@/lib/search-service";
import { NotFoundError } from "@/lib/people";
import { ValidationError } from "@/lib/validation";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = (await request.json().catch(() => ({}))) as { need?: string; deadline?: string | null };
  try {
    const result = await searchAdhocNeed(id, {
      need: body.need ?? "",
      deadline: body.deadline ?? null,
    });
    return Response.json({
      deals: result.deals,
      message: result.message,
      occasionId: result.occasionId,
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof NotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    throw error;
  }
}
