import { user1 } from "../dummyUsers";
import { expect, test } from "../fixtures";
import { reset } from "../helpers/reset";
import { TopPage } from "../models/TopPage";
import { useUser } from "../helpers/users";

test.afterEach(async ({ context }) => {
  await reset(context);
});

test.describe("user1", () => {
  useUser(test, user1);

  test.beforeEach(async ({ page }) => {

    const topPage = new TopPage(page);

    await topPage.goTo();
  });

  test("should create an item and then delete all items", async ({ page }) => {
    const topPage = new TopPage(page);

    await topPage.expectSidebarUI("signIn", user1);
  });
});

test.describe("no signed in", () => {
  test.beforeEach(async ({ page }) => {
    const topPage = new TopPage(page);

    await topPage.goTo();
  });

  test("should hide all UI related to sign in", async ({ page }) => {
    const topPage = new TopPage(page);

    await topPage.expectSidebarUI("signOut", user1);
  });
});