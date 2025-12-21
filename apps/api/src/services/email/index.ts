/**
 * Email Service
 * Handles transactional emails using Supabase Edge Functions
 * Falls back to logging if edge function is not configured
 */

import { supabase } from '../supabase/client.js';
import { logger } from '../../utils/logger.js';

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

interface InviteEmailParams {
  email: string;
  inviteLink: string;
  workspaceName: string;
  inviterName?: string;
}

/**
 * Send email via Supabase Edge Function
 * Falls back to logging if edge function is not available
 */
export async function sendEmail(params: SendEmailParams): Promise<{ success: boolean; error?: string }> {
  const { to, subject, html, text } = params;

  try {
    // Try to invoke Supabase Edge Function for sending email
    const { error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html, text },
    });

    if (error) {
      // Edge function not available, log instead
      logger.warn('Email edge function not available, logging email details', {
        to,
        subject,
        error: error.message,
      });
      return { success: false, error: 'Email service not configured' };
    }

    logger.info('Email sent successfully', { to, subject });
    return { success: true };
  } catch (error) {
    // Edge function doesn't exist or other error
    logger.warn('Email sending failed, function may not be deployed', {
      to,
      subject,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return { success: false, error: 'Email service unavailable' };
  }
}

/**
 * Send workspace invite email
 */
export async function sendInviteEmail(params: InviteEmailParams): Promise<{ success: boolean; error?: string }> {
  const { email, inviteLink, workspaceName, inviterName } = params;

  const subject = `You've been invited to join ${workspaceName} on TeamBrain`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a; color: #e2e8f0; padding: 40px 20px;">
      <div style="max-width: 560px; margin: 0 auto; background-color: #1e293b; border-radius: 12px; padding: 40px; border: 1px solid #334155;">
        <h1 style="color: #f59e0b; font-size: 24px; margin-bottom: 24px; text-align: center;">
          You're Invited!
        </h1>

        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 16px;">
          ${inviterName ? `<strong>${inviterName}</strong> has invited you` : 'You have been invited'} to join <strong>${workspaceName}</strong> on TeamBrain AI.
        </p>

        <p style="font-size: 16px; line-height: 1.6; margin-bottom: 32px;">
          TeamBrain AI helps teams answer questions instantly using your organization's knowledge base.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${inviteLink}" style="display: inline-block; background-color: #f59e0b; color: #0f172a; font-weight: 600; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-size: 16px;">
            Accept Invitation
          </a>
        </div>

        <p style="font-size: 14px; color: #94a3b8; line-height: 1.6; margin-top: 32px;">
          This invitation will expire in 7 days. If you didn't expect this email, you can safely ignore it.
        </p>

        <hr style="border: none; border-top: 1px solid #334155; margin: 32px 0;">

        <p style="font-size: 12px; color: #64748b; text-align: center;">
          TeamBrain AI - Intelligent Knowledge Management for Teams
        </p>
      </div>
    </body>
    </html>
  `;

  const text = `
You've been invited to join ${workspaceName} on TeamBrain!

${inviterName ? `${inviterName} has invited you` : 'You have been invited'} to join ${workspaceName} on TeamBrain AI.

TeamBrain AI helps teams answer questions instantly using your organization's knowledge base.

Accept the invitation: ${inviteLink}

This invitation will expire in 7 days.

---
TeamBrain AI - Intelligent Knowledge Management for Teams
  `.trim();

  const result = await sendEmail({ to: email, subject, html, text });

  // Log invite details regardless of email status (so admins can share manually)
  logger.info('Workspace invite created', {
    email,
    workspaceName,
    inviteLink,
    emailSent: result.success,
  });

  return result;
}
