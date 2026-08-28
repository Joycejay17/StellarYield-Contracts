import nodemailer from "nodemailer";
import { config } from "../config.js";
import { logger } from "../logger.js";

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (transporter) return transporter;

  if (!config.smtp.host || !config.smtp.port || !config.smtp.user || !config.smtp.pass || !config.smtp.from) {
    return null;
  }

  transporter = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  return transporter;
}

export async function sendEmail(options: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    logger.debug({ to: options.to }, "SMTP not configured, skipping email");
    return;
  }

  try {
    await transport.sendMail({
      from: config.smtp.from,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    logger.info({ to: options.to }, "Email sent successfully");
  } catch (err) {
    logger.error({ to: options.to, err }, "Failed to send email");
    throw err;
  }
}