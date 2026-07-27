import { describe, it, expect } from "vitest";
import { buildSchema, parse, validate } from "graphql";
import { depthLimitRule, complexityLimitRule, MAX_QUERY_DEPTH, MAX_QUERY_COMPLEXITY } from "./queryLimits.js";

// A schema shaped like the acceptance criteria in #774: an 8-level-deep chain
// of object fields, and a vaults -> positions -> vault cycle to exercise the
// complexity estimator's list handling.
const testSchema = buildSchema(`
  type Position {
    id: ID!
    vaultId: ID!
    vault: Vault!
  }

  type Vault {
    id: ID!
    positions: [Position!]!
  }

  type L8 { value: String }
  type L7 { l8: L8 }
  type L6 { l7: L7 }
  type L5 { l6: L6 }
  type L4 { l5: L5 }
  type L3 { l4: L4 }
  type L2 { l3: L3 }
  type L1 { l2: L2 }

  type Query {
    vaults: [Vault!]!
    deep: L1
  }
`);

describe("depthLimitRule (#774)", () => {
  it("allows a query at or below the max depth", () => {
    const document = parse(`{ vaults { id positions { id vaultId } } }`);
    const errors = validate(testSchema, document, [depthLimitRule]);
    expect(errors).toHaveLength(0);
  });

  it("rejects a query nested 8 levels deep with a descriptive error", () => {
    // 9 nested field selections -> depth 8 (leaf fields contribute 0).
    const document = parse(`
      query Deep {
        deep { l2 { l3 { l4 { l5 { l6 { l7 { l8 { value } } } } } } } }
      }
    `);
    const errors = validate(testSchema, document, [depthLimitRule]);
    expect(errors.map((e) => e.message)).toContain(
      `Query depth 8 exceeds maximum of ${MAX_QUERY_DEPTH}`,
    );
  });
});

describe("complexityLimitRule (#774)", () => {
  const vaultSelection = `
    id
    positions {
      id
      vaultId
      vault {
        id
        positions { id vaultId }
      }
    }
  `;

  it("allows a single vaults-with-positions selection under the max complexity", () => {
    // vaults(10) + [id(1) + positions(10 + [id(1)+vaultId(1)+vault(1 + [id(1)+positions(10+2)])])] = 37
    const document = parse(`{ vaults { ${vaultSelection} } }`);
    const errors = validate(testSchema, document, [complexityLimitRule]);
    expect(errors).toHaveLength(0);
  });

  it("rejects a query requesting all vaults with all nested positions as too complex", () => {
    // Repeating the same vaults->positions->vault->positions shape via
    // aliases mimics a client fanning out the same nested-list fetch many
    // times over, each one genuinely costing the DB the same amount.
    const aliasedSelections = Array.from(
      { length: 7 },
      (_, i) => `v${i}: vaults { ${vaultSelection} }`,
    ).join("\n");
    const document = parse(`{ ${aliasedSelections} }`);

    const errors = validate(testSchema, document, [complexityLimitRule]);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toBe(
      `Query complexity 259 exceeds maximum of ${MAX_QUERY_COMPLEXITY}`,
    );
  });
});
