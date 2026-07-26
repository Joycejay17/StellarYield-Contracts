import type { Request, Response, NextFunction } from "express";
import { config } from "../../config.js";
import { logger } from "../../logger.js";

function parseIpv4(ip: string): number {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((p) => isNaN(p) || p < 0 || p > 255)) {
    return -1;
  }
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function ipMatchesCidr(ip: string, cidr: string): boolean {
  const [rangeIp, bitsStr] = cidr.split("/");
  const bits = bitsStr ? parseInt(bitsStr, 10) : 32;

  if (isNaN(bits) || bits < 0 || bits > 32) return false;

  const ipNum = parseIpv4(ip);
  const rangeNum = parseIpv4(rangeIp);

  if (ipNum === -1 || rangeNum === -1) return false;

  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

function getClientIp(req: Request): string {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string") {
    return forwarded.split(",")[0].trim();
  }
  const raw = req.ip ?? req.socket.remoteAddress ?? "";
  // Normalise IPv4-mapped IPv6 addresses (e.g. ::ffff:127.0.0.1 → 127.0.0.1)
  if (raw.startsWith("::ffff:")) {
    return raw.slice(7);
  }
  // ::1 is IPv6 loopback — normalise to 127.0.0.1
  if (raw === "::1") {
    return "127.0.0.1";
  }
  return raw;
}

export function ipAllowlist(): (req: Request, res: Response, next: NextFunction) => void {
  const allowed = config.adminIpAllowlist;

  if (allowed.length === 0) {
    return (_req, _res, next) => next();
  }

  return (req: Request, res: Response, next: NextFunction) => {
    const clientIp = getClientIp(req);

    const allowed_ip = allowed.some((entry) => ipMatchesCidr(clientIp, entry));

    if (!allowed_ip) {
      logger.warn({ ip: clientIp }, "Blocked admin request from disallowed IP");
      res.status(403).json({ error: "Forbidden", message: "IP not allowed" });
      return;
    }

    next();
  };
}
