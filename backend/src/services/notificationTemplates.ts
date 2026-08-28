import { query } from "../db/index.js";

export interface NotificationTemplate {
  id: number;
  event_type: string;
  channel: string;
  body_template: string;
  active: boolean;
}

/**
 * Look up the notification template for an (eventType, channel) pair.
 * Returns `null` when no template is registered for the pair.
 */
export async function getTemplate(
  eventType: string,
  channel: string,
): Promise<NotificationTemplate | null> {
  const rows = await query<NotificationTemplate>(
    `SELECT id, event_type, channel, body_template, active
     FROM notification_templates
     WHERE event_type = $1 AND channel = $2`,
    [eventType, channel],
  );
  return rows[0] ?? null;
}

/**
 * Render a template body against a payload. Placeholders use `{{dotted.path}}`
 * syntax and are resolved against `payload`; an unresolved path renders as an
 * empty string. Nested objects/arrays render as compact JSON.
 */
export function renderTemplate(bodyTemplate: string, payload: unknown): string {
  return bodyTemplate.replace(/\{\{\s*([\w.[\]]+)\s*\}\}/g, (_match, rawPath: string) => {
    const value = resolvePath(payload, rawPath);
    if (value == null) return "";
    if (typeof value === "object") return JSON.stringify(value);
    return String(value);
  });
}

function resolvePath(root: unknown, path: string): unknown {
  const segments = path
    .replace(/\[(\w+)\]/g, ".$1")
    .split(".")
    .filter((s) => s.length > 0);

  let current: unknown = root;
  for (const segment of segments) {
    if (current == null || typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
}
