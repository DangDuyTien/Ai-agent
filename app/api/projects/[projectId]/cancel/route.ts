import { apiError, apiOk, getRouteParams } from "@/lib/api";
import { addLog, cancelRunningAgentRuns, updateProject } from "@/lib/store";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await getRouteParams(context);
    const cancelledRuns = await cancelRunningAgentRuns(projectId);
    await updateProject(projectId, { status: "failed" });
    await addLog(projectId, "warn", `Đã hủy thực thi và đóng ${cancelledRuns.length} agent run đang treo.`, {
      kind: "agent_cancelled",
      cancelledRunIds: cancelledRuns.map((run) => run.id)
    });
    return apiOk({ success: true, message: "Đã hủy thực thi.", cancelledRuns: cancelledRuns.length });
  } catch (error) {
    return apiError(error, 400);
  }
}
