import { apiError, apiOk, getRouteParams } from "@/lib/api";
import { analyzeProject } from "@/packages/orchestrator/workflow-engine";
import { analyzeProjectInputSchema } from "@/packages/schemas/project-blueprint.schema";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await getRouteParams(context);
    const body = await request.json().catch(() => ({}));
    const input = analyzeProjectInputSchema.parse(body);
    const blueprint = await analyzeProject(projectId, { autoAssume: input.autoAssume });
    return apiOk({ blueprint });
  } catch (error) {
    return apiError(error, 400);
  }
}
