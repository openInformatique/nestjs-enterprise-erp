import { registerAs } from '@nestjs/config';
import { MailDriver } from './environment.validation';

/** Configuration du module d'envoi d'e-mails. */
export interface MailConfig {
  driver: MailDriver;
  host: string;
  port: number;
  /** Identifiants facultatifs (serveur SMTP local sans authentification). */
  username?: string;
  password?: string;
  from: string;
}

export const mailConfig = registerAs('mail', (): MailConfig => ({
  driver: process.env.MAIL_DRIVER as MailDriver,
  host: process.env.MAIL_HOST as string,
  port: Number(process.env.MAIL_PORT),
  username: process.env.MAIL_USERNAME || undefined,
  password: process.env.MAIL_PASSWORD || undefined,
  from: process.env.MAIL_FROM as string,
}));
