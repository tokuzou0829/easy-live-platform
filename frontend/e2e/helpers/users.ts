import type { BrowserContext, TestType } from "@playwright/test";
import type { User } from "next-auth";
import type { TestFixtures, WorkerFixtures } from "../fixtures";

export async function createAuthState(context: BrowserContext, user: User) {
    await context.addCookies([
      {
        name: "authjs.session-token",
        value: btoa(
          JSON.stringify({
            ...user,
            // google provides picture, not the image key
            picture: user.image,
          }),
        ),
        domain: "localhost",
        path: "/",
        httpOnly: true,
        sameSite: "Lax",
        expires: Math.round((Date.now() + 60 * 60 * 24 * 1000 * 7) / 1000),
      },
    ]);
    await context.storageState({
      path: getStorageStatePath(user),
    });
  }
  
  export async function useUser<T extends TestType<TestFixtures, WorkerFixtures>>(
    test: T,
    user: User,
  ) {
    test.use({ storageState: getStorageStatePath(user) });
  }
  
  export function getStorageStatePath(user: User) {
    return `e2e/.auth/${user.id}.json`;
  }