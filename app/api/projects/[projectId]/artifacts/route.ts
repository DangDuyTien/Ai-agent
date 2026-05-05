import { apiError, apiOk, getRouteParams } from "@/lib/api";
import { getProjectBundle } from "@/lib/store";

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await getRouteParams(context);
    const bundle = await getProjectBundle(projectId);
    if (!bundle) {
      return apiError(new Error("Không tìm thấy dự án"), 404);
    }
    return apiOk({ artifacts: bundle.artifacts });
  } catch (error) {
    return apiError(error);
  }
}
