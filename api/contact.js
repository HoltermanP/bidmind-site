/**
 * Vercel Serverless: demo-aanvraag → e-mail via SMTP (Strato-defaults als host/user ontbreken).
 * Zie MAIL-SETUP.md.
 */

const nodemailer = require('nodemailer');

const utf8len = (s) => [...s].length;

/** Eerst “generieke” Vercel-namen, daarna BIDMIND_* fallback. Verwijdert BOM / trimt (copy-paste uit editors). */
function envTrim(...keys) {
  for (const k of keys) {
    const v = process.env[k];
    if (v == null) continue;
    const s = String(v).replace(/^\uFEFF/, '').trim();
    if (s !== '') return s;
  }
  return '';
}

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

/** Zelfde Strato-defaults als contact.php — zo volstaat op Vercel vaak SMTP_USER + SMTP_PASS. */
function smtpFromEnv() {
  const password = envTrim(
    'SMTP_PASS',
    'BIDMIND_SMTP_PASSWORD',
    'SMTP_PASSWORD',
    'SMTP-PASS'
  );
  if (!password) return null;
  const host =
    envTrim('SMTP_HOST', 'BIDMIND_SMTP_HOST', 'SMTP-HOST') || 'smtp.strato.de';
  const user =
    envTrim('SMTP_USER', 'BIDMIND_SMTP_USER', 'SMTP-USER') || 'info@bidmind.nl';
  const port = parseInt(envTrim('SMTP_PORT', 'BIDMIND_SMTP_PORT') || '465', 10) || 465;
  let enc = envTrim('SMTP_ENCRYPTION', 'BIDMIND_SMTP_ENCRYPTION').toLowerCase();
  if (!enc) {
    enc = port === 587 ? 'tls' : 'ssl';
  }
  const secure = enc === 'ssl';
  return {
    host,
    port,
    secure,
    auth: {
      user,
      pass: password,
    },
    relaxSsl:
      process.env.SMTP_RELAX_SSL === '1' ||
      process.env.SMTP_RELAX_SSL === 'true' ||
      process.env.BIDMIND_SMTP_RELAX_SSL === '1' ||
      process.env.BIDMIND_SMTP_RELAX_SSL === 'true',
  };
}

async function sendViaSmtp({ from, to, replyToEmail, replyToName, subject, text }, cfg) {
  if (!cfg.auth.user) {
    throw new Error('SMTP_USER ontbreekt');
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

  const to = envTrim('CONTACT_EMAIL', 'BIDMIND_MAIL_TO') || 'info@bidmind.nl';
  const from = envTrim('FROM_EMAIL', 'BIDMIND_MAIL_FROM') || to;
  const subject = 'Demo-aanvraag www.bidmind.nl';
  const textBody =
    'Demo-aanvraag via de website.\r\n\r\n' +
    `Naam: ${name}\r\n` +
    `E-mail: ${email}\r\n\r\n` +
    'Aanvraag / bericht:\r\n' +
    `${message}\r\n\r\n` +
    `Tijdstip: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC\r\n` +
    `IP: ${clientIp(req)}\r\n`;

  const smtp = smtpFromEnv();

  try {
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

    console.error('[api/contact] Geen SMTP-config (SMTP_PASS e.d.)');
    const debugSmtpHint =
      debug &&
      JSON.stringify({
        VERCEL_ENV: process.env.VERCEL_ENV || null,
        SMTP_PASS_aanwezig: Object.prototype.hasOwnProperty.call(process.env, 'SMTP_PASS'),
        SMTP_PASS_niet_leeg: envTrim('SMTP_PASS') !== '',
        BIDMIND_SMTP_PASSWORD_niet_leeg: envTrim('BIDMIND_SMTP_PASSWORD') !== '',
        SMTP_PASSWORD_niet_leeg: envTrim('SMTP_PASSWORD') !== '',
      });
    res.status(500).json({
      ok: false,
      error: 'smtp_password_missing',
      ...(debug
        ? {
            detail:
              'Vul SMTP_PASS (mailbox-wachtwoord) en SMTP_USER; SMTP_HOST alleen nodig als je geen Strato-default wilt. Zelfde variabelen voor Production én Preview; na wijzigingen opnieuw deployen.',
            env_hint: debugSmtpHint,
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
