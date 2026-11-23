"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

// BR-53/54: names for the reviewer picker and card labels, plus reviewer comments on
// open requests. Read-only for the life of the board page.

export type ReviewPerson = { id: string; name: string; unitName: string | null; isActive: boolean };

type ReviewInfo = {
  ownerId: string;
  /** Active people the owner may tag (never the owner). */
  candidates: ReviewPerson[];
  nameOf: (id: string | null) => string | null;
  commentOf: (taskId: string) => string | null;
};

const ReviewContext = createContext<ReviewInfo | null>(null);

export function ReviewInfoProvider({
  ownerId,
  people,
  comments,
  children,
}: {
  ownerId: string;
  people: ReviewPerson[];
  comments: Record<string, string>;
  children: ReactNode;
}) {
  const value = useMemo<ReviewInfo>(() => {
    const names = new Map(people.map((p) => [p.id, p.name]));
    return {
      ownerId,
      candidates: people.filter((p) => p.isActive && p.id !== ownerId),
      nameOf: (id) => (id ? (names.get(id) ?? "ผู้ใช้ที่ไม่พบ") : null),
      commentOf: (taskId) => comments[taskId] ?? null,
    };
  }, [ownerId, people, comments]);
  return <ReviewContext.Provider value={value}>{children}</ReviewContext.Provider>;
}

export function useReviewInfo(): ReviewInfo {
  const value = useContext(ReviewContext);
  if (!value) throw new Error("useReviewInfo must be used inside ReviewInfoProvider");
  return value;
}

/** Reviewer options grouped by unit, for a <select>. */
export function groupByUnit(people: readonly ReviewPerson[]): { unit: string; people: ReviewPerson[] }[] {
  const groups = new Map<string, ReviewPerson[]>();
  for (const p of people) {
    const unit = p.unitName ?? "ไม่ระบุสังกัด";
    const list = groups.get(unit);
    if (list) list.push(p);
    else groups.set(unit, [p]);
  }
  return [...groups].map(([unit, list]) => ({ unit, people: list }));
}
