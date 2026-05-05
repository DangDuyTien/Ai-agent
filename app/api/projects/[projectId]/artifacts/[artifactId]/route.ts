import { apiError, apiOk, getRouteParams } from "@/lib/api";
import { getArtifact, setProjectTasks, updateArtifactContent } from "@/lib/store";
import {
  editableArtifactTypes,
  parseEditableArtifactContent,
  type ProjectTask,
  updateArtifactContentInputSchema
} from "@/packages/schemas/project-blueprint.schema";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ projectId: string; artifactId: string }> }
) {
  try {
    const { projectId, artifactId } = await getRouteParams(context);
    const body = await request.json();
    const input = updateArtifactContentInputSchema.parse(body);
    const existingArtifact = await getArtifact(projectId, artifactId);
    if (!existingArtifact) {
      return apiError(new Error("Không tìm thấy tài liệu"), 404);
    }
    if (!editableArtifactTypes.includes(existingArtifact.artifactType as never)) {
      return apiError(new Error(`Không thể chỉnh sửa tài liệu ${existingArtifact.artifactType}`), 400);
    }
    const content = parseEditableArtifactContent(existingArtifact.artifactType, input.content);
    const artifact = await updateArtifactContent(projectId, artifactId, content);
    if (existingArtifact.artifactType === "task_plan") {
      await setProjectTasks(projectId, content as ProjectTask[]);
    }
    return apiOk({ artifact });
  } catch (error) {
    return apiError(error, 400);
  }
}
