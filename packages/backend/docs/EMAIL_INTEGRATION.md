# Email Integration Options for BugSpotter

## Overview

The email notifier currently has the structure but no actual delivery implementation. This document presents 5 production-ready solutions with pros/cons and implementation examples.

---

## Option 1: SendGrid (Recommended for Easy Setup) ⭐

**Best for**: Quick setup, reliable delivery, no infrastructure management

### Pros

- ✅ Generous free tier (100 emails/day)
- ✅ Simple REST API (no SMTP configuration)
- ✅ Excellent deliverability (industry leader)
- ✅ Built-in analytics and tracking
- ✅ Official Node.js SDK

### Cons

- ❌ Requires Twilio/SendGrid account
- ❌ Paid plans start at $15/month for 50k emails

### Setup

```bash
pnpm add @sendgrid/mail
```

### Implementation

```typescript
// packages/backend/src/queue/workers/notifications/email-notifier.ts

import sgMail from '@sendgrid/mail';

export class EmailNotifier implements INotifier {
  readonly type = 'email';
  private readonly config: EmailNotifierConfig;

  constructor(config: EmailNotifierConfig) {
    this.config = config;
    // Initialize SendGrid
    if (config.sendgrid_api_key) {
      sgMail.setApiKey(config.sendgrid_api_key);
    }
  }

  async send(
    recipient: string,
    context: NotificationContext,
    event: string
  ): Promise<NotificationResult> {
    if (!this.config.sendgrid_api_key) {
      throw new Error('SendGrid API key not configured');
    }

    const subject = this.getSubject(event, context);
    const htmlBody = await this.buildHtmlEmail(context, event);
    const textBody = this.buildTextEmail(context, event);

    try {
      await sgMail.send({
        to: recipient,
        from: this.config.from, // Must be verified in SendGrid
        subject,
        text: textBody,
        html: htmlBody,
      });

      return { success: true, timestamp: new Date() };
    } catch (error) {
      logger.error('SendGrid delivery failed', { error, recipient, event });
      return {
        success: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

### Environment Variables

```bash
# .env
EMAIL_NOTIFICATIONS_ENABLED=true
EMAIL_FROM=notifications@yourdomain.com
SENDGRID_API_KEY=SG.xxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### Config Interface Update

```typescript
export interface EmailNotifierConfig extends BaseNotifierConfig {
  type: 'email';
  from: string;
  sendgrid_api_key?: string; // Add this
}

static loadConfig(): EmailNotifierConfig | null {
  if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'true') {
    return null;
  }

  return {
    type: 'email',
    enabled: true,
    from: process.env.EMAIL_FROM || 'noreply@bugspotter.dev',
    sendgrid_api_key: process.env.SENDGRID_API_KEY,
  };
}
```

---

## Option 2: AWS SES (Best for Scale)

**Best for**: High volume, cost optimization, AWS infrastructure

### Pros

- ✅ Extremely cost-effective ($0.10 per 1,000 emails)
- ✅ Integrates with AWS infrastructure
- ✅ Built-in bounce/complaint handling
- ✅ High sending limits (can request increases)

### Cons

- ❌ Requires AWS account and setup
- ❌ Production access requires verification (takes 24-48h)
- ❌ More complex configuration

### Setup

```bash
pnpm add @aws-sdk/client-ses
```

### Implementation

```typescript
import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';

export class EmailNotifier implements INotifier {
  readonly type = 'email';
  private readonly config: EmailNotifierConfig;
  private readonly sesClient: SESClient;

  constructor(config: EmailNotifierConfig) {
    this.config = config;

    // Initialize SES client
    this.sesClient = new SESClient({
      region: config.aws_region || 'us-east-1',
      credentials:
        config.aws_access_key && config.aws_secret_key
          ? {
              accessKeyId: config.aws_access_key,
              secretAccessKey: config.aws_secret_key,
            }
          : undefined, // Use IAM role if running on EC2/ECS
    });
  }

  async send(
    recipient: string,
    context: NotificationContext,
    event: string
  ): Promise<NotificationResult> {
    const subject = this.getSubject(event, context);
    const htmlBody = await this.buildHtmlEmail(context, event);
    const textBody = this.buildTextEmail(context, event);

    const command = new SendEmailCommand({
      Source: this.config.from,
      Destination: { ToAddresses: [recipient] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: textBody, Charset: 'UTF-8' },
        },
      },
    });

    try {
      await this.sesClient.send(command);
      return { success: true, timestamp: new Date() };
    } catch (error) {
      logger.error('SES delivery failed', { error, recipient, event });
      return {
        success: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

### Environment Variables

```bash
EMAIL_NOTIFICATIONS_ENABLED=true
EMAIL_FROM=notifications@yourdomain.com
AWS_SES_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
```

---

## Option 3: Postmark (Best Developer Experience)

**Best for**: Transactional emails, great deliverability, developer-friendly

### Pros

- ✅ Focused on transactional emails (not marketing)
- ✅ Excellent deliverability rates (99%+)
- ✅ Simple API with great documentation
- ✅ Free trial (100 emails)
- ✅ Built-in templates

### Cons

- ❌ More expensive than SES ($10/month for 10k emails)
- ❌ Requires account setup

### Setup

```bash
pnpm add postmark
```

### Implementation

```typescript
import { ServerClient } from 'postmark';

export class EmailNotifier implements INotifier {
  readonly type = 'email';
  private readonly config: EmailNotifierConfig;
  private readonly client: ServerClient;

  constructor(config: EmailNotifierConfig) {
    this.config = config;
    if (!config.postmark_token) {
      throw new Error('Postmark token not configured');
    }
    this.client = new ServerClient(config.postmark_token);
  }

  async send(
    recipient: string,
    context: NotificationContext,
    event: string
  ): Promise<NotificationResult> {
    const subject = this.getSubject(event, context);
    const htmlBody = await this.buildHtmlEmail(context, event);
    const textBody = this.buildTextEmail(context, event);

    try {
      await this.client.sendEmail({
        From: this.config.from,
        To: recipient,
        Subject: subject,
        HtmlBody: htmlBody,
        TextBody: textBody,
        MessageStream: 'outbound',
      });

      return { success: true, timestamp: new Date() };
    } catch (error) {
      logger.error('Postmark delivery failed', { error, recipient, event });
      return {
        success: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

### Environment Variables

```bash
EMAIL_NOTIFICATIONS_ENABLED=true
EMAIL_FROM=notifications@yourdomain.com
POSTMARK_TOKEN=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

---

## Option 4: Resend (Modern Choice)

**Best for**: Modern API, React email templates, developer experience

### Pros

- ✅ Modern developer experience
- ✅ Free tier (100 emails/day, 3k/month)
- ✅ Simple API (similar to SendGrid)
- ✅ React email template support
- ✅ Great documentation

### Cons

- ❌ Newer service (less track record)
- ❌ Smaller market share than SendGrid/AWS

### Setup

```bash
pnpm add resend
```

### Implementation

```typescript
import { Resend } from 'resend';

export class EmailNotifier implements INotifier {
  readonly type = 'email';
  private readonly config: EmailNotifierConfig;
  private readonly resend: Resend;

  constructor(config: EmailNotifierConfig) {
    this.config = config;
    if (!config.resend_api_key) {
      throw new Error('Resend API key not configured');
    }
    this.resend = new Resend(config.resend_api_key);
  }

  async send(
    recipient: string,
    context: NotificationContext,
    event: string
  ): Promise<NotificationResult> {
    const subject = this.getSubject(event, context);
    const htmlBody = await this.buildHtmlEmail(context, event);
    const textBody = this.buildTextEmail(context, event);

    try {
      await this.resend.emails.send({
        from: this.config.from,
        to: recipient,
        subject,
        html: htmlBody,
        text: textBody,
      });

      return { success: true, timestamp: new Date() };
    } catch (error) {
      logger.error('Resend delivery failed', { error, recipient, event });
      return {
        success: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

### Environment Variables

```bash
EMAIL_NOTIFICATIONS_ENABLED=true
EMAIL_FROM=notifications@yourdomain.com
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## Option 5: Nodemailer + SMTP (Self-Hosted)

**Best for**: Full control, self-hosted, use existing SMTP server

### Pros

- ✅ Works with any SMTP server (Gmail, Mailgun, custom)
- ✅ No third-party service lock-in
- ✅ Free if you have SMTP server
- ✅ Maximum flexibility

### Cons

- ❌ Complex configuration (SMTP settings, authentication)
- ❌ Deliverability depends on your SMTP server
- ❌ More maintenance burden
- ❌ Rate limits depend on provider

### Setup

```bash
pnpm add nodemailer
pnpm add -D @types/nodemailer
```

### Implementation

```typescript
import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

export class EmailNotifier implements INotifier {
  readonly type = 'email';
  private readonly config: EmailNotifierConfig;
  private readonly transporter: Transporter;

  constructor(config: EmailNotifierConfig) {
    this.config = config;

    if (!config.smtp) {
      throw new Error('SMTP configuration required');
    }

    this.transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure ?? true, // true for 465, false for 587
      auth: {
        user: config.smtp.user,
        pass: config.smtp.password,
      },
    });
  }

  async send(
    recipient: string,
    context: NotificationContext,
    event: string
  ): Promise<NotificationResult> {
    const subject = this.getSubject(event, context);
    const htmlBody = await this.buildHtmlEmail(context, event);
    const textBody = this.buildTextEmail(context, event);

    try {
      await this.transporter.sendMail({
        from: this.config.from,
        to: recipient,
        subject,
        text: textBody,
        html: htmlBody,
      });

      return { success: true, timestamp: new Date() };
    } catch (error) {
      logger.error('SMTP delivery failed', { error, recipient, event });
      return {
        success: false,
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
```

### Environment Variables

```bash
EMAIL_NOTIFICATIONS_ENABLED=true
EMAIL_FROM=notifications@yourdomain.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-email@gmail.com
SMTP_PASSWORD=your-app-specific-password
```

### Config Interface Update

```typescript
export interface EmailNotifierConfig extends BaseNotifierConfig {
  type: 'email';
  from: string;
  smtp?: {
    host: string;
    port: number;
    secure?: boolean;
    user: string;
    password: string;
  };
}

static loadConfig(): EmailNotifierConfig | null {
  if (process.env.EMAIL_NOTIFICATIONS_ENABLED !== 'true') {
    return null;
  }

  const smtp = process.env.SMTP_HOST
    ? {
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        user: process.env.SMTP_USER || '',
        password: process.env.SMTP_PASSWORD || '',
      }
    : undefined;

  return {
    type: 'email',
    enabled: true,
    from: process.env.EMAIL_FROM || 'noreply@bugspotter.dev',
    smtp,
  };
}
```

---

## Recommendation Summary

### For Quick Start: **SendGrid** ⭐

- Easiest setup, reliable, free tier sufficient for most self-hosted instances

### For High Volume: **AWS SES**

- Best cost at scale ($0.10 per 1,000 emails)

### For Best Deliverability: **Postmark**

- 99%+ delivery rates, transactional focus

### For Modern Stack: **Resend**

- Great DX, React email support

### For Self-Hosted: **Nodemailer + SMTP**

- Use existing infrastructure, no external dependencies

---

## Testing Email Delivery

After implementing, test with:

```typescript
// packages/backend/src/queue/workers/notifications/email-notifier.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { EmailNotifier } from './email-notifier';

describe('EmailNotifier', () => {
  let notifier: EmailNotifier;

  beforeEach(() => {
    const config = {
      type: 'email' as const,
      enabled: true,
      from: 'test@example.com',
      sendgrid_api_key: process.env.SENDGRID_API_KEY || 'test-key',
    };
    notifier = new EmailNotifier(config);
  });

  it('should send bug report notification', async () => {
    const result = await notifier.send(
      'recipient@example.com',
      {
        bugId: 'bug-123',
        projectId: 'proj-456',
        severity: 'high',
        title: 'Test Bug',
        description: 'Test Description',
        timestamp: new Date(),
      },
      'bug.created'
    );

    expect(result.success).toBe(true);
    expect(result.timestamp).toBeDefined();
  });
});
```

---

## Next Steps

1. Choose your preferred email provider
2. Install the corresponding package (`@sendgrid/mail`, `@aws-sdk/client-ses`, etc.)
3. Update `EmailNotifierConfig` interface with provider-specific fields
4. Replace the `TODO` section in `email-notifier.ts` with implementation
5. Add environment variables to `.env`
6. Test with actual email delivery
7. Remove TODO from `email-notifier.ts`

---

**Choose SendGrid for easiest setup** - 100 emails/day free tier is sufficient for most self-hosted BugSpotter instances, and you can upgrade as needed.
