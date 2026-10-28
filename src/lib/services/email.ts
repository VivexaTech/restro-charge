// ==============================================================================
// RESTROCHARGE - Transactional Email Service (Resend Integration)
// Handcrafted transactional emails for restaurant onboarding & subscriptions.
// ==============================================================================

import { Resend } from "resend";

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || "RestroCharge <onboarding@restrocharge.vivexatech.in>";

const resendClient = resendApiKey && !resendApiKey.includes("demo") ? new Resend(resendApiKey) : null;

interface EmailPayload {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: EmailPayload) {
  if (!resendClient) {
    console.info(`[Email Service Simulation] To: ${to} | Subject: ${subject}`);
    return { success: true, simulated: true, id: `sim_${Date.now()}` };
  }

  try {
    const result = await resendClient.emails.send({
      from: fromEmail,
      to,
      subject,
      html,
    });
    return { success: true, id: result.data?.id };
  } catch (error: any) {
    console.error("[Resend Email Error]:", error);
    return { success: false, error: error.message };
  }
}

// ------------------------------------------------------------------------------
// Email Templates
// ------------------------------------------------------------------------------

export function getRegistrationRequestTemplate(applicantName: string, restaurantName: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
      <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
        <h2 style="color: #ea580c; margin: 0; font-size: 22px;">RestroCharge by Vivexa Tech</h2>
      </div>
      <p style="font-size: 16px; line-height: 1.5;">Dear <strong>${applicantName}</strong>,</p>
      <p style="font-size: 15px; line-height: 1.6; color: #475569;">
        Thank you for submitting an onboarding request for <strong>${restaurantName}</strong>. Our onboarding team is reviewing your restaurant details.
      </p>
      <div style="background-color: #fff7ed; border-left: 4px solid #f97316; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
        <p style="margin: 0; font-size: 14px; color: #9a3412;">
          <strong>Next Steps:</strong> An onboarding executive from Vivexa Tech will contact you shortly to configure your menu, table QR codes, and custom digital menu presence.
        </p>
      </div>
      <p style="font-size: 14px; color: #64748b; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
        RestroCharge Platform • Vivexa Tech SaaS Solutions
      </p>
    </div>
  `;
}

export function getOnboardingApprovedTemplate(restaurantName: string, loginUrl: string, slug: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px;">
      <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
        <h2 style="color: #ea580c; margin: 0; font-size: 22px;">RestroCharge by Vivexa Tech</h2>
      </div>
      <h3 style="color: #0f172a; margin-top: 0;">Welcome to RestroCharge!</h3>
      <p style="font-size: 15px; line-height: 1.6; color: #475569;">
        Your restaurant account for <strong>${restaurantName}</strong> is ready. Your custom restaurant website is live at:
      </p>
      <p style="background: #f8fafc; padding: 12px; border-radius: 6px; font-family: monospace; font-size: 14px;">
        https://restrocharge.vivexatech.in/${slug}
      </p>
      <p style="margin-top: 24px;">
        <a href="${loginUrl}" style="background-color: #ea580c; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
          Access Restaurant Dashboard
        </a>
      </p>
      <p style="font-size: 14px; color: #64748b; margin-top: 32px; border-top: 1px solid #f1f5f9; padding-top: 16px;">
        Need assistance? Contact your Vivexa Tech account manager anytime.
      </p>
    </div>
  `;
}

export function getGracePeriodAlertTemplate(restaurantName: string, daysLeft: number, renewUrl: string) {
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; color: #1e293b; background: #ffffff; border: 1px solid #fecaca; border-radius: 8px;">
      <div style="margin-bottom: 24px; border-bottom: 1px solid #f1f5f9; padding-bottom: 16px;">
        <h2 style="color: #dc2626; margin: 0; font-size: 22px;">RestroCharge Subscription Alert</h2>
      </div>
      <p style="font-size: 15px; line-height: 1.6; color: #475569;">
        The RestroCharge subscription for <strong>${restaurantName}</strong> has expired and is currently in its <strong>${daysLeft}-day grace period</strong>.
      </p>
      <p style="font-size: 14px; color: #991b1b; background: #fef2f2; padding: 12px; border-radius: 6px;">
        Important: After the 3-day grace period, public website access and QR customer ordering will be suspended.
      </p>
      <p style="margin-top: 24px;">
        <a href="${renewUrl}" style="background-color: #dc2626; color: #ffffff; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
          Renew Subscription Now
        </a>
      </p>
    </div>
  `;
}
