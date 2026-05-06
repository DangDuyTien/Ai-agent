import axiosClient from "./axiosClient";
import type { Project, ProjectFormValues } from "../types/project.type";

export const projectApi = {
  async list(): Promise<Project[]> {
    const response = await axiosClient.get<Project[]>("/projects");
    return response.data;
  },

  async get(id: string): Promise<Project> {
    const response = await axiosClient.get<Project>(`/projects/${id}`);
    return response.data;
  },

  async create(input: ProjectFormValues): Promise<Project> {
    const response = await axiosClient.post<Project>("/projects", input);
    return response.data;
  },

  async update(id: string, input: ProjectFormValues): Promise<Project> {
    const response = await axiosClient.put<Project>(`/projects/${id}`, input);
    return response.data;
  },

  async scanContext(id: string): Promise<Project> {
    const response = await axiosClient.post<Project>(`/projects/${id}/scan-context`);
    return response.data;
  },

  async remove(id: string): Promise<void> {
    await axiosClient.delete(`/projects/${id}`);
  }
};
