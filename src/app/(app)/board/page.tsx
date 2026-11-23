import { notFound } from "next/navigation";
import { Board } from "@/components/board/board";
import { requireProfile } from "@/lib/auth";
import { loadBoard, loadBoardOwners } from "@/lib/board/load";
import { loadTodayNotice } from "@/lib/leave/today";
import { listPeople } from "@/lib/people";

export const metadata = { title: "บอร์ด | Kanban Board บันทึกงาน" };
// Every page reads the session per request, so it cannot be an instant navigation.
export const instant = false;

export default async function BoardPage({ searchParams }: PageProps<"/board">) {
  const profile = await requireProfile();
  const { year, user } = await searchParams;
  const isAdmin = profile.role === "admin";

  // FR-11: only admins may open another user's board; ?user= is ignored for everyone else.
  const owners = isAdmin ? await loadBoardOwners() : [];
  let owner = { id: profile.id, username: profile.username, displayName: profile.displayName };
  if (isAdmin && typeof user === "string" && user !== profile.username) {
    const found = owners.find((o) => o.username === user);
    if (!found) notFound();
    owner = found;
  }

  const [data, todayNotice, people] = await Promise.all([
    loadBoard(owner.id, year),
    loadTodayNotice(owner.id),
    listPeople(),
  ]);

  // key: a different owner or year mounts a fresh board store.
  return (
    <Board
      key={`${owner.id}:${data.year}`}
      ownerId={owner.id}
      data={data}
      viewer={{ id: profile.id, username: profile.username }}
      owner={owner}
      owners={owners}
      todayNotice={todayNotice}
      people={people}
    />
  );
}
