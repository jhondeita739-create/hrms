import "server-only";

import nodemailer from "nodemailer";

type EmailMessage = {
  to: string;
  subject: string;
  text: string;
};

function smtpSettings() {
  const host = process.env.SMTP_HOST?.trim();
  const port = Number(process.env.SMTP_PORT || "465");
  const user = process.env.SMTP_USER?.trim();
  let password = process.env.SMTP_PASSWORD?.trim();
  const from = process.env.SMTP_FROM?.trim() || user;

  if (host?.toLowerCase().endsWith("gmail.com") && password) {
    password = password.replace(/\s+/g, "");
  }

  return {
    host,
    port,
    secure:
      process.env.SMTP_SECURE === undefined
        ? port === 465
        : process.env.SMTP_SECURE.toLowerCase() === "true",
    user,
    password,
    from,
  };
}

export function isSmtpConfigured() {
  const settings = smtpSettings();
  return Boolean(
    settings.host &&
      Number.isInteger(settings.port) &&
      settings.port > 0 &&
      settings.user &&
      settings.password &&
      settings.from,
  );
}

export async function sendSmtpEmail(message: EmailMessage) {
  const settings = smtpSettings();
  if (
    !settings.host ||
    !Number.isInteger(settings.port) ||
    settings.port <= 0 ||
    !settings.user ||
    !settings.password ||
    !settings.from
  ) {
    throw new Error("SMTP email delivery is not configured.");
  }

  const transporter = nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: {
      user: settings.user,
      pass: settings.password,
    },
    connectionTimeout: 15_000,
    greetingTimeout: 15_000,
    socketTimeout: 30_000,
  });

  try {
    const result = await transporter.sendMail({
      from: settings.from,
      to: message.to,
      subject: message.subject,
      text: message.text,
    });
    return { messageId: result.messageId };
  } finally {
    transporter.close();
  }
}
