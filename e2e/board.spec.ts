// M5: FR-07, FR-08, FR-12, BR-01..04, BR-07, BR-08, BR-12 (state only — saving is M6)
import { expect, loginAs, test } from "./fixtures";
import {
  card,
  cardByTitle,
  column,
  columnList,
  mouseDrag,
  titlesIn,
  unsavedCount,
} from "./support/board";
import { currentYear, firstCategory, seedTasks, tasksOf } from "./support/tasks";
import { service } from "./support/users";

test.describe("FR-07 / FR-12 board and years", () => {
  test("shows five columns with only the owner's tasks of the selected year", async ({ page, makeUser }) => {
    const user = await makeUser();
    const other = await makeUser();
    const year = await currentYear();
    await seedTasks(user.id, [
      { title: "งานสั้น", status: "short_term" },
      { title: "งานกำลังทำ", status: "in_progress", startedAt: new Date().toISOString() },
      { title: "งานปีก่อน", status: "done", year: year - 1, startedAt: "2025-01-02T00:00:00Z", completedAt: "2025-01-03T00:00:00Z" },
    ]);
    await seedTasks(other.id, [{ title: "งานของคนอื่น", status: "short_term" }]);

    await loginAs(page, user);
    for (const name of ["งานระยะยาว (ภายในปี)", "งานค้างระยะสั้น", "กำลังทำ", "รอตรวจสอบ", "เสร็จแล้ว"]) {
      await expect(page.getByRole("region", { name })).toBeVisible();
    }
    await expect(cardByTitle(column(page, "short_term"), "งานสั้น")).toBeVisible();
    await expect(cardByTitle(column(page, "in_progress"), "งานกำลังทำ")).toBeVisible();
    await expect(cardByTitle(page, "งานของคนอื่น")).toHaveCount(0);
    await expect(cardByTitle(page, "งานปีก่อน")).toHaveCount(0);
    await expect(unsavedCount(page)).toHaveText("ไม่มีรายการที่ยังไม่บันทึก");

    // FR-12: switch year.
    await page.getByLabel("เลือกปี").selectOption(String(year - 1));
    await expect(page).toHaveURL(new RegExp(`/board\\?year=${year - 1}$`));
    await expect(cardByTitle(column(page, "done"), "งานปีก่อน")).toBeVisible();
    await expect(cardByTitle(page, "งานสั้น")).toHaveCount(0);
  });
});

test.describe("FR-07 create / edit / delete", () => {
  test("creates a short-term task; counter and unsaved marker update", async ({ page, makeUser }) => {
    const user = await makeUser();
    const category = await firstCategory();
    await loginAs(page, user);

    await page.getByRole("button", { name: "เพิ่มงานใน งานค้างระยะสั้น" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("วันเวลาเริ่มจริง")).toHaveCount(0); // BR-01 only for later columns
    await dialog.getByLabel("ชื่องาน").fill("งานใหม่จากหน้าเว็บ");
    await dialog.getByLabel("หมวดหมู่").selectOption(category.id);
    await dialog.getByLabel("ความสำคัญ").selectOption("1");
    await dialog.getByRole("button", { name: "เพิ่มงาน" }).click();
    await expect(dialog).toHaveCount(0);

    const created = cardByTitle(column(page, "short_term"), "งานใหม่จากหน้าเว็บ");
    await expect(created).toBeVisible();
    await expect(created).toContainText("สูง");
    await expect(created).toContainText(category.name);
    await expect(created.getByTestId("task-unsaved")).toBeVisible();
    await expect(unsavedCount(page)).toHaveText("ยังไม่บันทึก 1 รายการ");
  });

  test("BR-01: creating in done requires start and completion dates (default today)", async ({ page, makeUser }) => {
    const user = await makeUser();
    const category = await firstCategory();
    await loginAs(page, user);

    await page.getByRole("button", { name: "เพิ่มงานใน เสร็จแล้ว" }).click();
    const dialog = page.getByRole("dialog");
    const started = dialog.getByLabel("วันเวลาเริ่มจริง");
    const completed = dialog.getByLabel("วันเวลาเสร็จจริง");
    await expect(started).not.toHaveValue("");
    await expect(completed).not.toHaveValue("");

    await dialog.getByLabel("ชื่องาน").fill("บันทึกย้อนหลัง");
    await dialog.getByLabel("หมวดหมู่").selectOption(category.id);
    await started.fill("");
    await dialog.getByRole("button", { name: "เพิ่มงาน" }).click();
    await expect(dialog.getByText("กรุณากรอกวันเวลาเริ่มจริง")).toBeVisible();

    // BR-58: same day, but finishing before starting is still rejected.
    await started.fill("2026-11-02T09:30");
    await completed.fill("2026-11-02T08:00");
    await dialog.getByRole("button", { name: "เพิ่มงาน" }).click();
    await expect(dialog.getByText("วันเวลาเสร็จต้องไม่ก่อนวันเวลาเริ่ม")).toBeVisible();

    await completed.fill("2026-11-05T16:45");
    // BR-57: minutes worked are required when creating straight in done.
    await dialog.getByRole("button", { name: "เพิ่มงาน" }).click();
    await expect(dialog.getByText("กรุณากรอกเวลาที่ใช้ (นาที)")).toBeVisible();
    await dialog.getByLabel("ใช้เวลา (นาที)").fill("90");
    await dialog.getByRole("button", { name: "เพิ่มงาน" }).click();
    const created = cardByTitle(column(page, "done"), "บันทึกย้อนหลัง");
    await expect(created.getByTestId("task-started")).toHaveText("2 พ.ย. 2569 09:30");
    await expect(created.getByTestId("task-completed")).toHaveText("5 พ.ย. 2569 16:45");
    await expect(created.getByTestId("task-duration")).toHaveText("1 ชม. 30 นาที");

    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByTestId("unsaved-count")).toHaveText("บันทึกแล้ว");
    const { data } = await service().from("tasks").select("duration_minutes").eq("owner_id", user.id).single();
    expect(data?.duration_minutes).toBe(90);

    // Optional afterwards: edit it, or clear it.
    await created.click();
    const edit = page.getByRole("dialog");
    await expect(edit.getByLabel("ใช้เวลา (นาที) ไม่บังคับ")).toHaveValue("90");
    await edit.getByLabel("ใช้เวลา (นาที) ไม่บังคับ").fill("");
    await edit.getByRole("button", { name: "ตกลง" }).click();
    await expect(created.getByTestId("task-duration")).toHaveCount(0);
  });

  test("edits a task by clicking the card", async ({ page, makeUser }) => {
    const user = await makeUser();
    const [task] = await seedTasks(user.id, [{ title: "ชื่อเดิม", status: "long_term", progress: 10 }]);
    await loginAs(page, user);

    await card(page, task.id).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "แก้ไขงาน" })).toBeVisible();
    await dialog.getByLabel("ชื่องาน").fill("ชื่อใหม่");
    await dialog.getByLabel("ความคืบหน้า (%)").fill("60");
    await dialog.getByRole("button", { name: "ตกลง" }).click();

    await expect(card(page, task.id)).toContainText("ชื่อใหม่");
    await expect(card(page, task.id).getByRole("progressbar")).toHaveAttribute("aria-valuenow", "60");
    await expect(unsavedCount(page)).toHaveText("ยังไม่บันทึก 1 รายการ");
  });

  test("BR-12: deletes a task after confirmation", async ({ page, makeUser }) => {
    const user = await makeUser();
    const [task] = await seedTasks(user.id, [{ title: "งานที่จะลบ", status: "short_term" }]);
    await loginAs(page, user);

    await page.getByRole("button", { name: "ตัวเลือกงาน งานที่จะลบ" }).click();
    await page.getByRole("menuitem", { name: "ลบงาน" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "ลบงาน" }).click();
    await expect(card(page, task.id)).toHaveCount(0);
    await expect(unsavedCount(page)).toHaveText("ยังไม่บันทึก 1 รายการ");
  });
});

test.describe("FR-08 drag and drop", () => {
  test("dragging across columns applies BR-03 / BR-04", async ({ page, makeUser }) => {
    test.slow();
    const user = await makeUser();
    const [task] = await seedTasks(user.id, [{ title: "ลากฉัน", status: "short_term" }]);
    await loginAs(page, user);

    await mouseDrag(page, card(page, task.id), columnList(page, "in_progress"));
    await expect(cardByTitle(column(page, "in_progress"), "ลากฉัน")).toBeVisible();
    await expect(card(page, task.id).getByTestId("task-started")).toBeVisible(); // BR-03

    await mouseDrag(page, card(page, task.id), columnList(page, "done"));
    await expect(cardByTitle(column(page, "done"), "ลากฉัน")).toBeVisible();
    await expect(card(page, task.id).getByTestId("task-completed")).toBeVisible(); // BR-04 in

    await mouseDrag(page, card(page, task.id), columnList(page, "review"));
    await expect(cardByTitle(column(page, "review"), "ลากฉัน")).toBeVisible();
    await expect(card(page, task.id).getByTestId("task-completed")).toHaveCount(0); // BR-04 out
    await expect(card(page, task.id).getByTestId("task-started")).toBeVisible();
    await expect(unsavedCount(page)).toHaveText("ยังไม่บันทึก 1 รายการ");
  });

  test("reorders inside a column", async ({ page, makeUser }) => {
    const user = await makeUser();
    const [, , third] = await seedTasks(user.id, [
      { title: "หนึ่ง", status: "short_term" },
      { title: "สอง", status: "short_term" },
      { title: "สาม", status: "short_term" },
    ]);
    await loginAs(page, user);
    await expect.poll(() => titlesIn(page, "short_term")).toEqual(["หนึ่ง", "สอง", "สาม"]);

    await mouseDrag(page, card(page, third.id), cardByTitle(page, "หนึ่ง"), "top");
    await expect.poll(() => titlesIn(page, "short_term")).toEqual(["สาม", "หนึ่ง", "สอง"]);
  });

  test("moves with the card menu (no dragging)", async ({ page, makeUser }) => {
    const user = await makeUser();
    const [task] = await seedTasks(user.id, [{ title: "ย้ายด้วยเมนู", status: "in_progress", startedAt: new Date().toISOString() }]);
    await loginAs(page, user);

    await page.getByRole("button", { name: "ตัวเลือกงาน ย้ายด้วยเมนู" }).click();
    await page.getByRole("menuitem", { name: "รอตรวจสอบ" }).click();
    await expect(cardByTitle(column(page, "review"), "ย้ายด้วยเมนู")).toBeVisible();
    await expect(card(page, task.id)).toHaveCount(1);
    // The menu click must not open the editor; moving into review asks for a reviewer (BR-53).
    const picker = page.getByRole("dialog", { name: "ส่งให้ใครตรวจ?" });
    await expect(picker).toBeVisible();
    await expect(page.getByRole("dialog", { name: "แก้ไขงาน" })).toHaveCount(0);
    await picker.getByRole("button", { name: "ข้าม" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
});

test.describe("board hints", () => {
  test("BR-08: WIP warning above five tasks in progress", async ({ page, makeUser }) => {
    const user = await makeUser();
    const started = new Date().toISOString();
    await seedTasks(
      user.id,
      Array.from({ length: 6 }, (_, i) => ({ title: `กำลังทำ ${i + 1}`, status: "in_progress" as const, startedAt: started })),
    );
    await loginAs(page, user);

    const warning = column(page, "in_progress").getByTestId("wip-warning");
    await expect(warning).toBeVisible();
    await page.getByRole("button", { name: "ตัวเลือกงาน กำลังทำ 6" }).click();
    await page.getByRole("menuitem", { name: "รอตรวจสอบ" }).click();
    await expect(warning).toHaveCount(0);
  });

  test("BR-07: short-term task due more than 30 days after creation shows a hint", async ({ page, makeUser }) => {
    const user = await makeUser();
    const created = new Date();
    const due = new Date(created.getTime() + 40 * 86_400_000).toISOString().slice(0, 10);
    const soon = new Date(created.getTime() + 10 * 86_400_000).toISOString().slice(0, 10);
    const [far, near] = await seedTasks(user.id, [
      { title: "ไกล", status: "short_term", dueDate: due, createdAt: created.toISOString() },
      { title: "ใกล้", status: "short_term", dueDate: soon, createdAt: created.toISOString() },
    ]);
    await loginAs(page, user);

    await expect(card(page, far.id).getByTestId("long-term-hint")).toBeVisible();
    await expect(card(page, near.id).getByTestId("long-term-hint")).toHaveCount(0);
  });
});

test.describe("FR-09 state only until save", () => {
  test("board changes do not touch the database before บันทึก", async ({ page, makeUser }) => {
    const user = await makeUser();
    const [task] = await seedTasks(user.id, [{ title: "ยังไม่บันทึก", status: "short_term" }]);
    const before = await tasksOf(user.id);
    await loginAs(page, user);

    await page.getByRole("button", { name: "ตัวเลือกงาน ยังไม่บันทึก" }).click();
    await page.getByRole("menuitem", { name: "กำลังทำ" }).click();
    await expect(cardByTitle(column(page, "in_progress"), "ยังไม่บันทึก")).toBeVisible();
    await expect(card(page, task.id).getByTestId("task-unsaved")).toBeVisible();

    await page.waitForTimeout(500);
    expect(await tasksOf(user.id)).toEqual(before);
  });
});
