import { describe, expect, it } from "vitest";

import { assertDistinctLocalTestDatabaseUrls } from "../integration/support/postgres";

describe("PostgreSQL test database safety", () => {
  it.each([
    [
      "postgres://postgres:test@localhost/mdez_test",
      "postgres://postgres:test@127.0.0.1:5432/mdez_test"
    ],
    [
      "postgres://postgres:test@127.0.0.1/mdez_test",
      "postgres://postgres:test@localhost:5432/mdez_test"
    ]
  ])("rejects local aliases for the same database", (chainUrl, primaryUrl) => {
    expect(() => assertDistinctLocalTestDatabaseUrls(chainUrl, primaryUrl)).toThrow(
      "MDEZ_CHAIN_DATABASE_URL must differ from MDEZ_TEST_DATABASE_URL."
    );
  });

  it("allows distinct local test databases", () => {
    expect(() => assertDistinctLocalTestDatabaseUrls(
      "postgres://postgres:test@localhost:5432/mdez_chain_test",
      "postgres://postgres:test@127.0.0.1/mdez_test"
    )).not.toThrow();
  });
});
