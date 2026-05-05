import { NextResponse } from "next/server";

export function apiOk<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function apiError(error: unknown, status = 500) {
  console.error("[API ERROR]", error);
  const message = error instanceof Error ? error.message : "Lỗi chưa xác định";
  return NextResponse.json({ error: message }, { status });
}

export async function getRouteParams<T extends Record<string, string>>(context: { params: T | Promise<T> }): Promise<T> {
  return Promise.resolve(context.params);
}
