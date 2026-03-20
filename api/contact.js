/**
 * Vercel Serverless: demo-aanvraag → e-mail.
 *
 * Optie A — Resend (aanbevolen op Vercel): zet RESEND_API_KEY (+ BIDMIND_MAIL_TO, BIDMIND_MAIL_FROM).
 * Optie B — SMTP (bijv. Strato): zet BIDMIND_SMTP_* variabelen. Zie MAIL-SETUP.md.
 */

const nodemailer = require('nodemailer');

const utf8len = (s) => [...s].length;

async function readJsonBody(req) {
  if (req.body != null && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
    return req.body;
  }
  const chunks = [];
  await new Promise((resolve, reject) => {
    req.on('data', (c) => chunks.push(c));
    req.on('end', resolve);
    req.on('error', reject);
  });
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw || '{}');
  } catch {
    return null;
  }
}

function clientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim();
  }
  return req.headers['x-real-ip'] || 'onbekend';
}

async function sendViaResend({ apiKey, from, to, replyToEmail, subject, text }) {
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      reply_to: replyToEmail,
    }),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = data.message || data.error || r.statusText || 'resend_failed';
    throw new Error(msg);
  }
  return true;
}

function smtpFromEnv() {
  const host = (process.env.BIDMIND_SMTP_HOST || '').trim();
  const password = process.env.BIDMIND_SMTP_PASSWORD || '';
  if (!host || !password) return null;
  const port = parseInt(process.env.BIDMIND_SMTP_PORT || '465', 10) || 465;
  let enc = (process.env.BIDMIND_SMTP_ENCRYPTION || '').toLowerCase();
  if (!enc) {
    enc = port === 587 ? 'tls' : 'ssl';
  }
  const secure = enc === 'ssl';
  return {
    host,
    port,
    secure,
    auth: {
      user: (process.env.BIDMIND_SMTP_USER || '').trim(),
      pass: password,
    },
    relaxSsl: process.env.BIDMIND_SMTP_RELAX_SSL === '1' || process.env.BIDMIND_SMTP_RELAX_SSL === 'true',
  };
}

async function sendViaSmtp({ from, to, replyToEmail, replyToName, subject, text }, cfg) {
  if (!cfg.auth.user) {
    throw new Error('BIDMIND_SMTP_USER ontbreekt');
  }
  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
    tls: cfg.relaxSsl ? { rejectUnauthorized: false } : undefined,
  });
  await transporter.sendMail({
    from: `BidMind website <${from}>`,
    to,
    replyTo: { address: replyToEmail, name: replyToName || undefined },
    subject,
    text,
  });
  return true;
}

module.exports = async (req, res) => {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method' });
    return;
  }

  const debug =
    process.env.BIDMIND_DEBUG === '1' ||
    process.env.BIDMIND_DEBUG === 'true';

  const body = await readJsonBody(req);
  if (!body || typeof body !== 'object') {
    res.status(400).json({ ok: false, error: 'invalid_json' });
    return;
  }

  const honeypot = String(body.website || '').trim();
  if (honeypot !== '') {
    res.status(200).json({ ok: true });
    return;
  }

  const email = String(body.email || '').trim();
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  if (!emailOk) {
    res.status(400).json({ ok: false, error: 'email' });
    return;
  }

  let name = String(body.name || '').trim().replace(/\s+/g, ' ');
  const message = String(body.message || '').trim();

  if (!name || utf8len(name) > 120) {
    res.status(400).json({ ok: false, error: 'name' });
    return;
  }

  if (!message || utf8len(message) < 10) {
    res.status(400).json({ ok: false, error: 'message' });
    return;
  }

  if (utf8len(message) > 8000) {
    res.status(400).json({ ok: false, error: 'message' });
    return;
  }

  const to = (process.env.BIDMIND_MAIL_TO || 'info@bidmind.nl').trim();
  const from = (process.env.BIDMIND_MAIL_FROM || to).trim();
  const subject = 'Demo-aanvraag www.bidmind.nl';
  const textBody =
    'Demo-aanvraag via de website.\r\n\r\n' +
    `Naam: ${name}\r\n` +
    `E-mail: ${email}\r\n\r\n` +
    'Aanvraag / bericht:\r\n' +
    `${message}\r\n\r\n` +
    `Tijdstip: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC\r\n` +
    `IP: ${clientIp(req)}\r\n`;

  const resendKey = (process.env.RESEND_API_KEY || '').trim();
  const smtp = smtpFromEnv();

  try {
    if (resendKey) {
      await sendViaResend({
        apiKey: resendKey,
        from: `BidMind website <${from}>`,
        to,
        replyToEmail: email,
        subject,
        text: textBody,
      });
      res.status(200).json({ ok: true });
      return;
    }

    if (smtp) {
      await sendViaSmtp(
        {
          from,
          to,
          replyToEmail: email,
          replyToName: name,
          subject,
          text: textBody,
        },
        smtp
      );
      res.status(200).json({ ok: true });
      return;
    }

    console.error('[api/contact] Geen RESEND_API_KEY en geen volledige SMTP-config (BIDMIND_SMTP_*)');
    res.status(500).json({
      ok: false,
      error: 'smtp_password_missing',
      ...(debug
        ? {
            detail:
              'Zet RESEND_API_KEY of BIDMIND_SMTP_HOST + BIDMIND_SMTP_USER + BIDMIND_SMTP_PASSWORD in Vercel Environment Variables.',
          }
        : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[api/contact]', msg);
    res.status(500).json({
      ok: false,
      error: 'send',
      ...(debug ? { detail: msg } : {}),
    });
  }
};
