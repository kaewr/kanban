// BR-53..56 review requests and notifications: shared constants and labels.

export const REVIEW_COMMENT_MAX = 500;

export type ReviewStatus = "open" | "approved" | "returned" | "withdrawn";

export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  open: "รอตรวจ",
  approved: "ผ่าน",
  returned: "ส่งกลับแก้",
  withdrawn: "ยกเลิกคำขอ",
};

export type NotificationKind =
  | "review_requested"
  | "review_withdrawn"
  | "review_commented"
  | "review_approved"
  | "review_returned";

/** Sentence shown in the bell, e.g. "สมชาย ขอให้คุณตรวจงาน". */
export function notificationText(kind: string, actor: string): string {
  switch (kind) {
    case "review_requested":
      return `${actor} ขอให้คุณตรวจงาน`;
    case "review_withdrawn":
      return `${actor} ยกเลิกคำขอตรวจงาน`;
    case "review_commented":
      return `${actor} ให้ความเห็นงานของคุณ`;
    case "review_approved":
      return `${actor} ตรวจผ่านงานของคุณ`;
    case "review_returned":
      return `${actor} ส่งงานกลับให้แก้`;
    default:
      return `${actor} มีการแจ้งเตือนถึงคุณ`;
  }
}

/** Where a notification leads: reviewers to their inbox, owners to their board. */
export function notificationHref(kind: string): string {
  return kind === "review_requested" || kind === "review_withdrawn" ? "/reviews" : "/board";
}
