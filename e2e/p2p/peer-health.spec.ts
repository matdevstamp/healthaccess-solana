import { expect, test } from "@playwright/test";

test.describe("peer heartbeat", () => {
  test("hospital-s reports a healthy ambulance-a peer", async ({ request }) => {
    await expect
      .poll(
        async () =>
          (await (await request.get("http://localhost:3001/api/health")).json()).data.peer,
        { timeout: 20_000, intervals: [500] },
      )
      .toEqual(
        expect.objectContaining({
          healthy: true,
          serverId: "ambulance-a",
          lastCheckedAt: expect.any(String),
        }),
      );
  });

  test("ambulance-a reports a healthy hospital-s peer", async ({ request }) => {
    await expect
      .poll(
        async () =>
          (await (await request.get("http://localhost:3002/api/health")).json()).data.peer,
        { timeout: 20_000, intervals: [500] },
      )
      .toEqual(
        expect.objectContaining({
          healthy: true,
          serverId: "hospital-s",
          lastCheckedAt: expect.any(String),
        }),
      );
  });

  test("peer status is surfaced on every health probe", async ({ request }) => {
    const response = await request.get("http://localhost:3001/api/health");

    expect(response.ok()).toBeTruthy();

    const body = await response.json();

    expect(body.ok).toBe(true);
    expect(body.data.server).toBe("hospital-s");
    expect(body.data.peer).toMatchObject({
      healthy: expect.any(Boolean),
      serverId: expect.any(String),
      lastCheckedAt: expect.any(String),
    });
  });
});
