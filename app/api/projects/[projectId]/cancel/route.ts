import { NextResponse } from "next/server";
import { apiError, apiOk, getRouteParams } from "@/lib/api";
import { updateProject } from "@/lib/store";

export async function POST(_request: Request, context: { params: Promise<{ projectId: string }> }) {
  try {
    const { projectId } = await getRouteParams(context);
    await updateProject(projectId, { status: "failed" });
    return apiOk({ success: true, message: "Đã hủy thực thi." });
  } catch (error) {
    return apiError(error, 400);
  }
}
