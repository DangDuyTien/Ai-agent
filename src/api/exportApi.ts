import axiosClient from "./axiosClient";
import type { ExportFormat, ExportPayload } from "../utils/exportFile";

export const exportApi = {
  async create(format: ExportFormat, payload: ExportPayload): Promise<{ id: string; downloadUrl?: string }> {
    const response = await axiosClient.post<{ id: string; downloadUrl?: string }>("/exports", {
      format,
      payload
    });
    return response.data;
  }
};
