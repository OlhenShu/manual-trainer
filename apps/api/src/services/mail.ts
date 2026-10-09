import nodemailer from 'nodemailer';

const pendingLinks = new Map<string, string>();

export function smtpConfigured(): boolean {
  return Boolean(process.env['SMTP_HOST'] && process.env['MAIL_FROM']);
}

export function rememberVerificationLink(email: string, url: string): void {
  pendingLinks.set(email.toLowerCase(), url);
}

export function verificationPathFor(email: string): string {
  const url = pendingLinks.get(email.toLowerCase());
  if (!url) {
    throw new Error(`No verification link stored for ${email}`);
  }
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function skipDelivery(): boolean {
  return process.env['VITEST'] === 'true' || process.env['E2E_EXPOSE_VERIFICATION'] === '1';
}

export async function sendVerificationEmail(email: string, url: string): Promise<void> {
  rememberVerificationLink(email, url);
  if (skipDelivery()) return;
  if (!smtpConfigured()) {
    throw new Error('MAIL_NOT_CONFIGURED');
  }
  const port = Number(process.env['SMTP_PORT'] ?? 587);
  const user = process.env['SMTP_USER']?.trim();
  const pass = (process.env['SMTP_PASSWORD'] ?? '').replace(/\s+/g, '');
  const transport = nodemailer.createTransport({
    host: process.env['SMTP_HOST'],
    port,
    secure: process.env['SMTP_SECURE'] === 'true' || port === 465,
    ...(user ? { auth: { user, pass } } : {}),
  });
  await transport.sendMail({
    from: process.env['MAIL_FROM'],
    to: email,
    subject: 'Підтвердьте реєстрацію в Тренажері QA',
    text: [
      'Щоб завершити реєстрацію, відкрийте це посилання:',
      url,
      '',
      'Посилання діє 24 години. Якщо ви не реєструвалися, проігноруйте цей лист.',
    ].join('\n'),
  });
}
