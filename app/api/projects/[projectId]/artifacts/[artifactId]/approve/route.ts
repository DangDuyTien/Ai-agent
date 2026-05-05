import { apiError, apiOk, getRouteParams } from "@/lib/api";
import { approveArtifact } from "@/lib/store";

export async function POST(
  _request: Request,
  context: { params: Promise<{ projectId: string; artifactId: string }> }
) {
  try {
    const { projectId, artifactId } = await getRouteParams(context);
    const artifact = await approveArtifact(projectId, artifactId);
    return apiOk({ artifact });
  } catch (error) {
    return apiError(error, 400);
  }
}
