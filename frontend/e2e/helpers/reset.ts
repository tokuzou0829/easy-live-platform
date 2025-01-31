import type { BrowserContext } from "@playwright/test";


export async function reset(context: BrowserContext) {

  await context.clearCookies();
}