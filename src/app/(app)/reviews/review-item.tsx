"use client";

import { CheckIcon, MessageSquareTextIcon, Undo2Icon } from "lucide-react";
import { useState, useTransition } from "react";
import { FormMessage } from "@/components/form-message";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { REVIEW_COMMENT_MAX } from "@/lib/reviews";
import { decideReview, type ReviewAction } from "./actions";

/** One request waiting for the current user (BR-54). */
export function ReviewItem({
  reviewId,
  title,
  description,
  owner,
  meta,
  previousComment,
}: {
  reviewId: string;
  title: string;
  description: string | null;
  owner: string;
  meta: string;
  previousComment: string | null;
}) {
  const [comment, setComment] = useState("");
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();

  function run(action: ReviewAction) {
    setError(undefined);
    startTransition(async () => {
      const result = await decideReview(reviewId, action, comment);
      if (result.ok) setComment("");
      else setError(result.error);
    });
  }

  const inputId = `review-comment-${reviewId}`;

  return (
    <li
      data-review-title={title}
      className="flex flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
      aria-busy={pending}
    >
      <div className="flex flex-col gap-1">
        <p className="font-semibold">{title}</p>
        <p className="text-sm text-muted-foreground">
          ของ <span className="font-medium text-foreground">{owner}</span> · {meta}
        </p>
        {description && <p className="text-sm whitespace-pre-line">{description}</p>}
        {previousComment && (
          <p className="flex items-start gap-1.5 rounded-lg bg-primary/8 px-2 py-1.5 text-sm">
            <MessageSquareTextIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            ความเห็นก่อนหน้าของคุณ: {previousComment}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={inputId}>ความเห็น (ไม่บังคับ เว้นแต่กด &ldquo;ให้ความเห็น&rdquo;)</Label>
        <Textarea
          id={inputId}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          maxLength={REVIEW_COMMENT_MAX}
          rows={2}
          placeholder="เช่น ตรวจแล้วเรียบร้อย / ขอแก้ตารางหน้า 3"
        />
      </div>

      <FormMessage error={error} />

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run("approve")} disabled={pending} className="gap-1.5">
          <CheckIcon aria-hidden />
          ผ่าน
        </Button>
        <Button variant="outline" onClick={() => run("return")} disabled={pending} className="gap-1.5">
          <Undo2Icon aria-hidden />
          ส่งกลับแก้
        </Button>
        <Button variant="ghost" onClick={() => run("comment")} disabled={pending} className="gap-1.5">
          <MessageSquareTextIcon aria-hidden />
          ให้ความเห็น
        </Button>
      </div>
    </li>
  );
}
