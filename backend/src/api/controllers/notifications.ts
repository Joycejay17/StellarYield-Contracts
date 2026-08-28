import type { Request, Response, NextFunction } from "express";
import { query } from "../../db/index.js";
import { logger } from "../../logger.js";
import { validateWebhookUrl } from "../../services/notifications.js";
import { getTemplate, renderTemplate } from "../../services/notificationTemplates.js";

const HEALTH_CHECK_TIMEOUT_MS = 3000;

/**
 * POST /api/v1/admin/notifications/preview
 * Render a notification template for an (eventType, channel) pair against a
 * sample payload, without sending anything (#1026).
 */
export async function previewNotification(req: Request, res: Response, next: NextFunction) {
  try {
    const { eventType, channel, samplePayload } = req.body as {
      eventType: string;
      channel: string;
      samplePayload: Record<string, unknown>;
    };

    const template = await getTemplate(eventType, channel);
    if (!template) {
      res.status(404).json({
        error: "TemplateNotFound",
        message: `No notification template for event "${eventType}" on channel "${channel}"`,
      });
      return;
    }

    const rendered = renderTemplate(template.body_template, samplePayload);
    res.json({ rendered });
  } catch (err) {
    next(err);
  }
}

interface HealthWebhookRow {
  id: number;
  url: string;
}

/**
 * GET /api/v1/admin/notifications/health
 * HEAD-ping every active webhook URL and report reachability + latency (#1027).
 */
export async function notificationsHealth(_req: Request, res: Response, next: NextFunction) {
  try {
    const webhooks = await query<HealthWebhookRow>(
      "SELECT id, url FROM webhooks WHERE active = TRUE ORDER BY priority ASC, created_at DESC",
    );

    const channels = await Promise.all(webhooks.map((w) => pingChannel(w)));
    res.json({ channels });
  } catch (err) {
    next(err);
  }
}

async function pingChannel(
  webhook: HealthWebhookRow,
): Promise<{ id: number; url: string; reachable: boolean; latencyMs: number | null }> {
  try {
    await validateWebhookUrl(webhook.url);
  } catch (err) {
    logger.warn({ webhookId: webhook.id, err }, "Health check skipped: webhook URL failed SSRF check");
    return { id: webhook.id, url: webhook.url, reachable: false, latencyMs: null };
  }

  const start = Date.now();
  try {
    await fetch(webhook.url, {
      method: "HEAD",
      signal: AbortSignal.timeout(HEALTH_CHECK_TIMEOUT_MS),
      redirect: "manual",
    });
    // Any HTTP response — including a non-2xx status — means the host is reachable.
    return { id: webhook.id, url: webhook.url, reachable: true, latencyMs: Date.now() - start };
  } catch {
    return { id: webhook.id, url: webhook.url, reachable: false, latencyMs: null };
  }
}
