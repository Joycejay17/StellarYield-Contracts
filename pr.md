# Pull Request: Add GraphQL query limiting, public TVL, and portfolio analytics endpoints

This PR adds GraphQL query depth/complexity limiting and three new analytics endpoints.

Closes #774
Closes #775
Closes #776
Closes #777

## Issues Fixed

### 1. GraphQL query depth and complexity limiting (#774)

Deep or complex GraphQL queries can cause excessive DB load. This adds validation-level
limits to the existing Apollo Server:

- Installed `graphql-depth-limit` and `graphql-query-complexity`.
- New `src/graphql/queryLimits.ts` exports `depthLimitRule` and `complexityLimitRule`,
  wired into `ApolloServer`'s `validationRules`.
- Max depth: 7. Exceeding it returns `Query depth {n} exceeds maximum of 7`.
- Max complexity: 200, via a custom estimator where every field costs 1 and any
  field whose type resolves to a list costs 10. Exceeding it returns
  `Query complexity {n} exceeds maximum of 200`.

### 2. Public cross-vault TVL aggregate (#775)

`GET /api/v1/admin/stats` includes platform-wide TVL but is admin-gated. Dashboards need
a public equivalent:

- `GET /api/v1/analytics/tvl` returns `{ totalValueLocked, activeVaultCount, fundingVaultCount }`.
- `totalValueLocked` sums `total_assets` across all non-archived vaults; the two counts
  are vaults in the `Active` and `Funding` states respectively.
- No authentication required — mounted on the existing public `analyticsRouter`.
- Response includes `Cache-Control: max-age=30`.

### 3. Portfolio asset allocation breakdown (#776)

- `GET /api/v1/users/:address/portfolio/allocation` returns
  `{ allocations: [{ category, deposited, percentage }] }`.
- Groups a user's positions by `vaults.rwa_category` (falling back to `"Uncategorized"`),
  summing `deposited` per category.
- `percentage` is left unrounded (`categoryDeposited / totalDeposited * 100`) so that
  percentages across categories sum to 100 within floating-point precision.
- Returns `{ allocations: [] }` for a user with no positions.

### 4. Portfolio diversification score (#777)

- `GET /api/v1/users/:address/portfolio/diversification` returns
  `{ score, vaultCount, categoryCount, herfindahlIndex }`.
- `herfindahlIndex` is the sum of squared per-vault deposit shares — lower means more
  diversified.
- `score = (1 - herfindahlIndex) * 100`, rounded to one decimal place.
- A user with a single position gets `score: 0`; a user with equal deposits across
  four vaults gets `score: 75`.

## Verification

- `npx tsc --noEmit` — clean
- New tests added: `src/graphql/queryLimits.test.ts`, `src/api/controllers/analytics.test.ts`,
  `src/services/user.portfolio-analytics.test.ts`
- `npx vitest run` — all tests pass except two pre-existing, unrelated flakes
  (`src/services/indexer.test.ts`, `src/api/controllers/admin.test.ts`), both confirmed
  present on `main` prior to this change and passing when run in isolation
