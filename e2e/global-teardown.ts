import { deleteTestCategories } from "./support/tasks";
import { deleteAllTestUsers } from "./support/users";

export default async function globalTeardown(): Promise<void> {
  await deleteAllTestUsers();
  await deleteTestCategories();
}
