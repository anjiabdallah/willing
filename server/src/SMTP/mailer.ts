import nodemailer from 'nodemailer';
import config from '../config.js';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
} = config;

const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: false,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
});

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
}) {
  return transporter.sendMail({
    from: MAIL_FROM,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
  });
}
