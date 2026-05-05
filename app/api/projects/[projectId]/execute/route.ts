import { apiError, apiOk, getRouteParams } from "@/lib/api";
import { executeProject } from "@/packages/orchestrator/workflow-engine";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await getRouteParams(context);
    const result = await executeProject(projectId);
    return apiOk({ result });
  } catch (error) {
    return apiError(error, 400);
  }
}
