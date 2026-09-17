import { expect, test } from "@playwright/test";
import {
  attachSessionCookie,
  countOutbox,
  countUserSets,
  createE2ESession,
  destroyE2ESession,
  sumUserReps,
} from "./helpers/session";

const PRESETS = [10, 20, 50] as const;

test.describe.configure({ mode: "serial" });

test("install, go offline, log three sets, reconnect, verify sync", async ({
  page,
  context,
  baseURL,
}) => {
  const origin = baseURL ?? "http://127.0.0.1:4173";
  const session = await createE2ESession();

  try {
    await attachSessionCookie(context, session.sessionToken, origin);
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Log 20", exact: true })).toBeVisible();

    await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) {
        throw new Error("This browser does not support service workers.");
      }
      await navigator.serviceWorker.ready;
    });

    if (await page.evaluate(() => navigator.serviceWorker.controller === null)) {
      await page.reload({ waitUntil: "domcontentloaded" });
      await expect.poll(async () =>
        page.evaluate(() => navigator.serviceWorker.controller !== null),
      ).toBe(true);
    }

    await expect(page.getByRole("button", { name: "Log 20", exact: true })).toBeVisible();

    await context.setOffline(true);

    for (const preset of PRESETS) {
      await page.getByRole("button", { name: `Quick log ${preset}` }).click();
    }

    const expectedReps = PRESETS[0] + PRESETS[1] + PRESETS[2];
    await expect(
      page.getByLabel(`${expectedReps} reps today`),
    ).toBeVisible();
    await expect(page.getByText(/3 waiting to sync/)).toBeVisible();
    expect(await countOutbox(page)).toBe(3);
    expect(await countUserSets(session.userId)).toBe(0);

    await context.setOffline(false);
    await expect(page.getByText(/waiting to sync/)).toHaveCount(0, {
      timeout: 45_000,
    });
    await expect(page.getByLabel(`${expectedReps} reps today`)).toBeVisible();

    await expect
      .poll(async () => countOutbox(page), { timeout: 45_000 })
      .toBe(0);
    await expect
      .poll(async () => countUserSets(session.userId), { timeout: 45_000 })
      .toBe(3);
    expect(await sumUserReps(session.userId)).toBe(expectedReps);

    await page.reload({ waitUntil: "domcontentloaded" });
    await expect(page.getByLabel(`${expectedReps} reps today`)).toBeVisible();
    expect(await countUserSets(session.userId)).toBe(3);
  } finally {
    await destroyE2ESession(session.userId);
  }
});
