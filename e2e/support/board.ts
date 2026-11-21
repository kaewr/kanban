import type { Locator, Page } from "@playwright/test";
import type { TaskStatus } from "../../src/types/domain";

export function column(page: Page, status: TaskStatus): Locator {
  return page.locator(`section[data-status="${status}"]`);
}

export function columnList(page: Page, status: TaskStatus): Locator {
  return column(page, status).locator("ol");
}

export function card(page: Page, id: string): Locator {
  return page.locator(`li[data-task-id="${id}"]`);
}

export function cardByTitle(scope: Page | Locator, title: string): Locator {
  return scope.locator("li[data-task-id]").filter({ hasText: title });
}

export async function titlesIn(page: Page, status: TaskStatus): Promise<string[]> {
  return column(page, status).getByTestId("task-title").allTextContents();
}

export function unsavedCount(page: Page): Locator {
  return page.getByTestId("unsaved-count");
}

/** Mouse drag with small steps so dnd-kit's distance activation and collision run. */
export async function mouseDrag(page: Page, source: Locator, target: Locator, where: "center" | "top" = "center") {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("mouseDrag: element not visible");

  const startX = from.x + from.width / 2;
  const startY = from.y + Math.min(12, from.height / 2);
  const endX = to.x + to.width / 2;
  const endY = where === "top" ? to.y + 4 : to.y + to.height / 2;

  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 4, startY + 8, { steps: 4 });
  await page.waitForTimeout(100); // let dnd-kit activate and measure droppables
  await page.mouse.move(endX, endY, { steps: 30 });
  await page.mouse.move(endX, endY + 1, { steps: 2 });
  await page.waitForTimeout(100); // let collision detection settle on the target
  await page.mouse.up();
  await page.waitForTimeout(250); // drop animation
}

/** Long-press touch drag through CDP (dnd-kit TouchSensor needs real touch events). */
export async function touchDrag(page: Page, source: Locator, target: Locator, where: "center" | "top" = "center") {
  const from = await source.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error("touchDrag: element not visible");

  const start = { x: from.x + from.width / 2, y: from.y + Math.min(12, from.height / 2) };
  const end = { x: to.x + to.width / 2, y: where === "top" ? to.y + 4 : to.y + to.height / 2 };

  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [start] });
  await page.waitForTimeout(450); // longer than the 250 ms press delay
  const steps = 15;
  for (let i = 1; i <= steps; i++) {
    const point = { x: start.x + ((end.x - start.x) * i) / steps, y: start.y + ((end.y - start.y) * i) / steps };
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [point] });
    await page.waitForTimeout(16);
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}
