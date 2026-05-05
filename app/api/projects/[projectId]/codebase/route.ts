import { apiError, apiOk, getRouteParams } from "@/lib/api";
import { attachCodebaseToProject } from "@/packages/orchestrator/workflow-engine";
import { attachCodebaseInputSchema } from "@/packages/schemas/project-blueprint.schema";

export async function POST(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await getRouteParams(context);
    const body = await request.json();
    const input = attachCodebaseInputSchema.parse(body);
    const blueprint = await attachCodebaseToProject(projectId, input.sourcePath);
    return apiOk({ blueprint });
  } catch (error) {
    return apiError(error, 400);
  }
}

