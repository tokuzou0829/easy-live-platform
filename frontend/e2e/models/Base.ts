import type { Locator, Page } from "@playwright/test";
import type { User } from "next-auth";
import { expect } from "../fixtures";

export class Base {
  page: Page;
  profileImageLocator: Locator;

  constructor(page: Page) {
    this.page = page;
    this.profileImageLocator = this.page.getByRole("img", { name: "profile" });
  }

  async signIn() {
    await this.page.getByRole('button', { name: 'Login' }).click();
    const signInButton = this.page.getByRole('button', { name: 'Githubでログイン' });
    await expect(signInButton).toBeVisible();
    return signInButton;
  }

  async signOut(): Promise<Locator> {
    await this.page.getByRole('button', { name: 'profile' }).click();
    const signOutButton = this.page.getByRole('menuitem', { name: 'サインアウト' });
    await expect(signOutButton).toBeVisible();
    return signOutButton;
  }

  async init() {
    await this.page.goto(process.env.NEXT_PUBLIC_SITE_URL as string, {
      waitUntil: "networkidle",
    });
  }

  async expectSidebarUI(state: "signIn" | "signOut", user: User) {
    if (state === "signIn") {
      expect(await this.profileImageLocator.getAttribute("src")).toBe(
        user.image,
      );
      await this.signOut();
    }

    if (state === "signOut") {
     await this.signIn();
    }
  }
}
