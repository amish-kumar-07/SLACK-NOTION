import { db } from "../../db/index.js";
import { usersTable } from "../../db/schema.js";
import { eq } from "drizzle-orm";

export async function createUser(
  name: string,
  email: string,
  password: string,
  role : "admin" | "user"
) {
  try {
    // 1. Check if email already exists
    const [existingUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (existingUser) {
      return null;
    }

    // 2. Create user
    const [user] = await db
      .insert(usersTable)
      .values({
        name,
        email,
        password,
        role
      })
      .returning();

    return user;
  } catch (err) {
    console.error(err);
    return null;
  }
}

export async function findOne(email: string) {
  try {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .limit(1);

    if (!user) return null;

    return user;
  } catch (err) {
    console.error(err);
    return null;
  }
}