import { apiError, apiOk, getRouteParams } from "@/lib/api";
import { reviewProject } from "@/packages/orchestrator/workflow-engine";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await getRouteParams(context);
    const report = await reviewProject(projectId);
    return apiOk({ report });
  } catch (error) {
    return apiError(error, 400);
  }
}
