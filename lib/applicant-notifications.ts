import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isSmtpConfigured, sendSmtpEmail } from "@/lib/smtp-email";

type NotificationContext = {
  db: SupabaseClient;
  user?: { id: string } | null;
  organizationId: string;
};

type ApplicantNotificationDetails = {
  applicantId: string;
  applicationId: string;
  recipient: string;
  eventType: string;
  subject: string;
  body: string;
};

export type ApplicantEmailDelivery = {
  emailStatus: "sent" | "failed";
  errorMessage: string | null;
};

export async function createApplicantNotification(
  ctx: NotificationContext,
  details: ApplicantNotificationDetails,
): Promise<ApplicantEmailDelivery> {
  const { error: portalError } = await ctx.db.from("applicant_notifications").insert({
    organization_id: ctx.organizationId,
    applicant_id: details.applicantId,
    job_application_id: details.applicationId,
    event_type: details.eventType,
    channel: "portal",
    recipient: details.recipient,
    subject: details.subject,
    body: details.body,
    delivery_status: "sent",
    sent_at: new Date().toISOString(),
    created_by: ctx.user?.id ?? null,
  });
  if (portalError) throw new Error(portalError.message);

  const { data: emailNotification, error: queueError } = await ctx.db
    .from("applicant_notifications")
    .insert({
      organization_id: ctx.organizationId,
      applicant_id: details.applicantId,
      job_application_id: details.applicationId,
      event_type: details.eventType,
      channel: "email",
      recipient: details.recipient,
      subject: details.subject,
      body: details.body,
      delivery_status: "pending",
      created_by: ctx.user?.id ?? null,
    })
    .select("id")
    .single();
  if (queueError || !emailNotification)
    throw new Error(queueError?.message || "The email notification could not be queued.");

  if (!isSmtpConfigured()) {
    const errorMessage = "SMTP email delivery is not configured.";
    await ctx.db
      .from("applicant_notifications")
      .update({ delivery_status: "failed", error_message: errorMessage })
      .eq("id", emailNotification.id);
    return { emailStatus: "failed", errorMessage };
  }

  try {
    const result = await sendSmtpEmail({
      to: details.recipient,
      subject: details.subject,
      text: details.body,
    });
    await ctx.db
      .from("applicant_notifications")
      .update({
        delivery_status: "sent",
        provider_message_id: result.messageId || null,
        sent_at: new Date().toISOString(),
        error_message: null,
      })
      .eq("id", emailNotification.id);
    return { emailStatus: "sent", errorMessage: null };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Email delivery failed.";
    await ctx.db
      .from("applicant_notifications")
      .update({
        delivery_status: "failed",
        error_message: errorMessage,
      })
      .eq("id", emailNotification.id);
    return { emailStatus: "failed", errorMessage };
  }
}
