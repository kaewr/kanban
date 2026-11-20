import { deleteAllTestUsers } from "./support/users";

export default async function globalTeardown(): Promise<void> {
  await deleteAllTestUsers();
}
