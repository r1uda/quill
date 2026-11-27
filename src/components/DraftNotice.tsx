import React from "react";
import { useDrafts } from "../drafts";
import { Label } from "../ui";
export function DraftNotice() {
  const d = useDrafts();
  return (
    <Label
      muted
      style={{ fontSize: 11, color: d.error ? "#b48e68" : undefined }}
    >
      {d.error ||
        (d.status === "saving"
          ? "正在保留草稿…"
          : "未完成的内容会自动保留，回来可以接着填。")}
    </Label>
  );
}
