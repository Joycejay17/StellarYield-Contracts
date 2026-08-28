## Pull Request Description

This PR implements four key features to enhance the StellarYield backend API:

### Summary

- **#1016**: Added simulation rate limiting with separate quota from read endpoints
- **#1017**: Added simulation audit logging for admin debugging  
- **#1018**: Added email notification channel via SMTP
- **#1019**: Added Slack webhook notification channel with Block Kit formatting

### Type of Change

- [x] New feature (non-breaking change that adds functionality)
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update
- [ ] Refactoring (no functional changes)
- [ ] Performance improvement
- [ ] Security improvement

### Changes Made

#### #1016: Simulation Rate Limiting
- Added `RATE_LIMIT_SIMULATE` environment variable (default: 30 requests/minute)
- Created `simulateLimiter` middleware with custom handler returning HTTP 429 and `Retry-After` header
- Added `/api/v1/simulate/*` routes for deposit, withdraw, and yield-claim operations
- Applied rate limiter exclusively to simulation endpoints, separate from read endpoints

#### #1017: Simulation Audit Logging
- Added debug logging for each simulation request including:
  - `contractId`, `operation`, `params`, `result`, `durationMs`, `fromCache`
- Full result included in logs when `LOG_LEVEL=debug`
- Implemented in `backend/src/api/controllers/simulate.ts`

#### #1018: Email Notification Channel
- Added SMTP configuration environment variables:
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- Installed `nodemailer` package and `@types/nodemailer`
- Created `backend/src/services/email.ts` with `sendEmail()` function
- Email delivery skipped gracefully when SMTP not configured
- Added "email" as valid webhook channel type

#### #1019: Slack Webhook Notification Channel
- Added "slack" as valid webhook channel type
- Implemented Slack Block Kit message formatting for notifications
- Added `channel` column to webhooks table and schema
- Slack webhooks receive formatted Block Kit messages, standard JSON for other channels

### Database Changes

- Added migration `031_webhook_channel.sql` to add `channel` column to webhooks table
- Updated `backend/src/db/schema.sql` to include new channel field

### Configuration Changes

- Updated `backend/.env.example` with new rate limiting and SMTP environment variables
- Added `RATE_LIMIT_SIMULATE`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`

### Testing

- TypeScript compilation successful (`npm run build`)
- All changes follow existing code patterns and conventions
- Minimal implementation focused on core functionality as requested

### Security Considerations

- Simulation rate limiting prevents abuse of computationally cheap endpoints
- Email validation ensures only valid email addresses for email channel
- Slack channel still requires HTTPS URL validation
- SMTP credentials handled via environment variables, not committed to repo

### Additional Context

- Implementation follows minimal approach to conserve tokens as requested by maintainer
- All features are backward compatible - existing webhooks default to "webhook" channel
- Email delivery degrades gracefully when SMTP not configured
- Slack formatting includes vault name extraction from both `vaultName` and `name` fields

Closes #1016, #1017, #1018, #1019