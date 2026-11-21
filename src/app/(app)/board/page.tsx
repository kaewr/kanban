import { Board } from "@/components/board/board";
import { requireProfile } from "@/lib/auth";
import { loadBoard } from "@/lib/board/load";

export const metadata = { title: "บอร์ด | Kanban Board บันทึกงาน" };

export default async function BoardPage({ searchParams }: PageProps<"/board">) {
  const profile = await requireProfile();
  const { year } = await searchParams;
  const data = await loadBoard(profile.id, year);

  // key: a different year mounts a fresh board store.
  return <Board key={data.year} ownerId={profile.id} data={data} />;
}
