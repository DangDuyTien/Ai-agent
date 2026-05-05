import { apiError, apiOk, getRouteParams } from "@/lib/api";
import { getProjectBundle, updateProject } from "@/lib/store";
import { updateProjectInputSchema } from "@/packages/schemas/project-blueprint.schema";

export async function GET(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await getRouteParams(context);
    const bundle = await getProjectBundle(projectId);
    if (!bundle) {
      return apiError(new Error("Không tìm thấy dự án"), 404);
    }
    return apiOk(bundle);
  } catch (error) {
    return apiError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await getRouteParams(context);
    const body = await request.json();
    const patch = updateProjectInputSchema.parse(body);
    const project = await updateProject(projectId, patch);
    return apiOk({ project });
  } catch (error) {
    return apiError(error, 400);
  }
}
