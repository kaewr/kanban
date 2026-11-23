"use server";

import { refresh } from "next/cache";
import { requireProfile } from "@/lib/auth";
import { REVIEW_COMMENT_MAX } from "@/lib/reviews";
import { createClient } from "@/lib/supabase/server";

// BR-54: the reviewer approves (-> done), returns (-> in_progress) or only comments.
// review_decide() checks that the caller is the reviewer of an open request.

export type ReviewAction = "approve" | "return" | "comment";
export type ReviewActionResult = { ok: true } | { ok: false; error: string };

export async function decideReview(reviewId: string, action: ReviewAction, comment: string): Promise<ReviewActionResult> {
  await requireProfile();
  const text = comment.trim();
  if (action === "comment" && !text) return { ok: false, error: "กรุณาเขียนความเห็น" };
  if (text.length > REVIEW_COMMENT_MAX) {
    return { ok: false, error: `ความเห็นยาวได้ไม่เกิน ${REVIEW_COMMENT_MAX} ตัวอักษร` };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_decide", {
    p_review_id: reviewId,
    p_action: action,
    p_comment: text || undefined,
  });
  if (error) {
    // P0001/P0002 carry Thai messages written for the user.
    const known = error.code === "P0001" || error.code === "P0002";
    return { ok: false, error: known ? error.message : "บันทึกผลการตรวจไม่สำเร็จ กรุณาลองใหม่อีกครั้ง" };
  }
  refresh();
  return { ok: true };
}
