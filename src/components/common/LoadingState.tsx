import { Loader2 } from "lucide-react";

interface LoadingStateProps {
  label?: string;
}

export function LoadingState({ label = "Đang xử lý..." }: LoadingStateProps) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-line bg-white px-4 py-3 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin text-brand" />
      <span>{label}</span>
    </div>
  );
}
