import { Injectable, Logger } from '@nestjs/common';
import nodemailer from 'nodemailer';

interface SendMailInput {
  to: string;
  subject: string;
  text: string;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async sendMail(input: SendMailInput) {
    const smtpHost = process.env.SMTP_HOST?.trim();

    if (!smtpHost) {
      this.logger.warn(
        `SMTP_HOST 未配置，跳过邮件发送：to=${input.to}, subject=${input.subject}`,
      );
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: (process.env.SMTP_SECURE ?? 'false') === 'true',
      auth: process.env.SMTP_USER
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS ?? '',
          }
        : undefined,
    });

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? 'noreply@gigpayday.local',
      to: input.to,
      subject: input.subject,
      text: input.text,
    });
  }
}
