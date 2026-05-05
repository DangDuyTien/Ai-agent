import { apiError, apiOk, getRouteParams } from "@/lib/api";
import { buildBlueprint } from "@/packages/orchestrator/workflow-engine";

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await getRouteParams(context);
    const blueprint = await buildBlueprint(projectId);
    return apiOk({ blueprint });
  } catch (error) {
    return apiError(error, 404);
  }
}
