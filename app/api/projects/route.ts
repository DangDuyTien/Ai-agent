import { apiError, apiOk } from "@/lib/api";
import { createProject, listProjects } from "@/lib/store";
import { createProjectInputSchema } from "@/packages/schemas/project-blueprint.schema";

export async function GET() {
  try {
    return apiOk({ projects: await listProjects() });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = createProjectInputSchema.parse(body);
    const project = await createProject(input.rawIdea, input.name, input.mode, input.sourcePath);
    return apiOk({ project }, { status: 201 });
  } catch (error) {
    return apiError(error, 400);
  }
}
