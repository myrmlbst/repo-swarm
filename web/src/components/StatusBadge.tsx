import type { ReactNode } from "react";
import type { Analysis } from "@/lib/api";
import { CheckIcon, XIcon } from "./icons";

const STATUS: Record<
  Analysis["status"],
  { label: string; classes: string; marker: ReactNode }
> = {
  queued: {
    label: "Queued",
    classes: "bg-gray-100 text-gray-800",
    marker: <span className="size-1.5 rounded-full bg-gray-500" />,
  },
  running: {
    label: "Running",
    classes: "bg-blue-100 text-blue-800",
    marker: (
      <span className="size-1.5 animate-pulse rounded-full bg-blue-600" />
    ),
  },
  complete: {
    label: "Complete",
    classes: "bg-green-100 text-green-800",
    marker: <CheckIcon className="size-3" />,
  },
  failed: {
    label: "Failed",
    classes: "bg-red-100 text-red-800",
    marker: <XIcon className="size-3" />,
  },
};

/** Status is always a word plus a marker — never color alone. */
export function StatusBadge({ status }: { status: Analysis["status"] }) {
  const { label, classes, marker } = STATUS[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${classes}`}
    >
      {marker}
      {label}
    </span>
  );
}
