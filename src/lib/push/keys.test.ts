import { describe, expect, it } from "vitest";
import { urlBase64ToUint8Array } from "./keys";

describe("urlBase64ToUint8Array", () => {
  it("decodes URL-safe base64 without padding", () => {
    const bytes = urlBase64ToUint8Array("AQID");
    expect([...bytes]).toEqual([1, 2, 3]);
  });
});
