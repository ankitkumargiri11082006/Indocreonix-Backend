/**
 * ╔══════════════════════════════════════════════════════════════════════════╗
 * ║              Indocreonix — Professional Email Service                   ║
 * ║  Templates: Job Application · Internship Application · Contact Form     ║
 * ║             Internal HR Notification · Internal Lead Notification       ║
 * ╚══════════════════════════════════════════════════════════════════════════╝
 */

import { env } from '../config/env.js'

// ─── Constants ────────────────────────────────────────────────────────────────

const BRAND       = 'Indocreonix'
const BRAND_SITE  = 'https://indocreonix.com'
const LOGO_URL    = 'https://indocreonix.com/logo.png'
const YEAR        = new Date().getFullYear()

// Palette — deep navy + electric cyan accent
const COLOR = {
  bg:          '#f0f4f9',
  card:        '#ffffff',
  headerGrad:  'linear-gradient(135deg, #050d1a 0%, #0a1f3d 45%, #0d3063 100%)',
  accent:      '#00b4d8',
  accentDark:  '#0077a8',
  gold:        '#f0a500',
  bodyText:    '#1e293b',
  mutedText:   '#64748b',
  border:      '#e2e8f0',
  rowEven:     '#f8fafc',
  btnBg:       '#0a1f3d',
  btnHover:    '#0d3063',
  tagBg:       '#e0f7ff',
  tagText:     '#0077a8',
  footerBg:    '#050d1a',
  footerText:  '#94a3b8',
  footerLink:  '#38bdf8',
  divider:     '#1e3a5f',
  successBg:   '#ecfdf5',
  successBdr:  '#10b981',
  warnBg:      '#fffbeb',
  warnBdr:     '#f59e0b',
}

// ─── Sender Routing ───────────────────────────────────────────────────────────

function getSenderAddress(kind = 'info') {
  if (kind === 'careers') return env.resendCareersFrom
  if (kind === 'contact') return env.resendContactFrom
  return env.resendInfoFrom || env.resendFrom
}

export async function verifySmtpConnection() {
  if (env.emailProvider !== 'resend') {
    console.warn(
      `[Email] EMAIL_PROVIDER=${env.emailProvider} is not supported in this build. Falling back to resend mode.`
    )
  }

  if (!env.resendApiKey) {
    console.warn('[Email] Resend selected but RESEND_API_KEY is missing.')
    return false
  }

  console.log('[Email] Email provider: resend (HTTPS API). SMTP is disabled in this build.')
  return true
}

async function sendMail(options) {
  if (!env.resendApiKey) {
    console.warn('[Email] RESEND_API_KEY missing — email skipped.')
    return null
  }

  try {
    const to = Array.isArray(options.to) ? options.to : [options.to]
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${env.resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: options.from || `"${BRAND}" <${getSenderAddress('info')}>`,
        to,
        subject: options.subject,
        html: options.html,
        reply_to: options.replyTo,
      }),
    })

    const payload = await response.json().catch(() => ({}))
    if (!response.ok) {
      console.error(
        `[Email] ❌ Resend failed (${response.status}): ${payload?.message || payload?.error || 'Unknown error'}`
      )
      return null
    }

    console.log(`[Email] ✅ Sent via Resend to ${to.join(', ')} — ${payload?.id || 'queued'}`)
    return payload
  } catch (err) {
    console.error(`[Email] ❌ Resend request failed: ${err.message}`)
    return null
  }
}

// ─── Shared layout shell ──────────────────────────────────────────────────────

function shell(previewText, bodyHtml) {
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
  <meta name="format-detection" content="telephone=no,date=no,address=no,email=no"/>
  <meta name="x-apple-disable-message-reformatting"/>
  <title>${BRAND}</title>
  <!--[if mso]>
  <noscript><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml></noscript>
  <![endif]-->
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:${COLOR.bg};font-family:'Inter',Arial,sans-serif;color:${COLOR.bodyText};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%}
    a{color:${COLOR.accent};text-decoration:none}
    img{border:0;outline:0;display:block;max-width:100%}
    table{border-collapse:collapse;mso-table-lspace:0;mso-table-rspace:0}
    .email-wrapper{max-width:620px;margin:32px auto;background:${COLOR.card};border-radius:20px;overflow:hidden;box-shadow:0 8px 40px rgba(0,0,0,.12)}
    /* Header */
    .header{background:${COLOR.headerGrad};padding:0}
    .header-inner{padding:36px 44px 32px}
    .logo-wrap{text-align:center;margin-bottom:20px}
    .logo-wrap img{height:72px;width:auto;margin:0 auto}
    .header-title{font-size:11px;font-weight:700;letter-spacing:2.5px;text-transform:uppercase;color:${COLOR.accent};text-align:center;margin-bottom:10px}
    .header-divider{height:1px;background:${COLOR.divider};margin:0 44px}
    /* Tag strip */
    .tag-strip{padding:16px 44px 0;display:flex;align-items:center;gap:10px}
    .tag{display:inline-block;background:${COLOR.tagBg};color:${COLOR.tagText};font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;padding:5px 14px;border-radius:40px;border:1px solid ${COLOR.accent}22}
    /* Body */
    .body{padding:32px 44px 28px}
    .greeting{font-size:22px;font-weight:700;color:${COLOR.bodyText};margin-bottom:14px;line-height:1.3}
    .intro{font-size:15px;line-height:1.75;color:#374151;margin-bottom:20px}
    /* Alert boxes */
    .box{border-radius:12px;padding:20px 22px;margin:22px 0}
    .box-success{background:${COLOR.successBg};border-left:4px solid ${COLOR.successBdr}}
    .box-warn{background:${COLOR.warnBg};border-left:4px solid ${COLOR.warnBdr}}
    .box-blue{background:#eff6ff;border-left:4px solid #3b82f6}
    .box-dark{background:#0a1f3d08;border:1px solid ${COLOR.border};border-radius:12px}
    .box-label{font-size:11px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;color:${COLOR.mutedText};margin-bottom:8px}
    .box-value{font-size:15px;color:${COLOR.bodyText};line-height:1.65;white-space:pre-wrap}
    /* Info table */
    .info-table{width:100%;border-radius:12px;overflow:hidden;border:1px solid ${COLOR.border};margin:20px 0;font-size:14px}
    .info-table tr:nth-child(even) td{background:${COLOR.rowEven}}
    .info-table td{padding:11px 16px;border-bottom:1px solid ${COLOR.border};vertical-align:top}
    .info-table td:first-child{font-weight:600;color:${COLOR.mutedText};width:36%;white-space:nowrap}
    .info-table td:last-child{color:${COLOR.bodyText}}
    /* CTA Button */
    .btn-wrap{margin:24px 0 8px}
    .cta-btn{display:inline-block;background:${COLOR.btnBg};color:#fff!important;padding:14px 32px;border-radius:10px;font-size:15px;font-weight:700;letter-spacing:.3px;text-decoration:none!important}
    .cta-btn:hover{background:${COLOR.btnHover}}
    /* Divider */
    .divider{height:1px;background:${COLOR.border};margin:24px 0}
    /* Step list */
    .steps{list-style:none;margin:16px 0;padding:0}
    .steps li{display:flex;align-items:flex-start;gap:12px;padding:10px 0;border-bottom:1px solid ${COLOR.border};font-size:14px;color:#374151}
    .steps li:last-child{border-bottom:0}
    .step-num{min-width:26px;height:26px;background:${COLOR.accent};color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;flex-shrink:0;line-height:26px;text-align:center}
    /* Footer */
    .footer{background:${COLOR.footerBg};padding:30px 44px}
    .footer-logo-row{text-align:center;margin-bottom:18px}
    .footer-logo-row img{height:36px;opacity:.85}
    .footer-links{text-align:center;margin-bottom:14px}
    .footer-links a{color:${COLOR.footerLink}!important;font-size:12px;margin:0 8px;text-decoration:underline}
    .footer-copy{text-align:center;font-size:11px;color:${COLOR.footerText};line-height:1.8}
    .footer-sig{text-align:center;margin-top:16px;padding-top:16px;border-top:1px solid ${COLOR.divider}}
    .footer-sig p{font-size:13px;font-weight:600;color:${COLOR.footerLink};letter-spacing:.3px}
    .footer-sig span{font-size:11px;color:${COLOR.footerText};display:block;margin-top:3px}
    /* Highlight pill row */
    .pill-row{display:flex;gap:8px;flex-wrap:wrap;margin:16px 0}
    .pill{display:inline-block;background:#0a1f3d12;border:1px solid ${COLOR.border};color:${COLOR.bodyText};font-size:12px;font-weight:600;padding:5px 14px;border-radius:40px}
    @media(max-width:640px){
      .email-wrapper{margin:0;border-radius:0}
      .header-inner,.body,.footer,.tag-strip{padding-left:20px;padding-right:20px}
      .header-divider{margin:0 20px}
      .greeting{font-size:18px}
    }
  </style>
</head>
<body>
  <!-- Preview text (hidden) -->
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${previewText}&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;</div>

  <div class="email-wrapper">
    ${bodyHtml}
    ${footer()}
  </div>
</body>
</html>`
}

// ─── Footer (shared) ──────────────────────────────────────────────────────────

function footer() {
  return `
  <div class="footer">
    <div class="footer-logo-row">
      <img src="${LOGO_URL}" alt="${BRAND} Logo" height="40" style="height:40px;width:auto;margin:0 auto"/>
    </div>
    <div class="footer-links">
      <a href="${BRAND_SITE}">Website</a>
      <a href="${BRAND_SITE}/privacy-policy">Privacy&nbsp;Policy</a>
      <a href="${BRAND_SITE}/terms-and-conditions">Terms</a>
      <a href="mailto:info@indocreonix.com">Contact&nbsp;Us</a>
    </div>
    <div class="footer-copy">
      &copy; ${YEAR} ${BRAND} Infotech &bull; All rights reserved<br/>
      This email was sent automatically. Please do not reply to this address.
    </div>
    <div class="footer-sig">
      <p>Team ${BRAND}</p>
      <span>Digital Innovation &nbsp;&bull;&nbsp; Engineering Excellence &nbsp;&bull;&nbsp; Intelligent Solutions</span>
    </div>
  </div>`
}

// ─── Header component ─────────────────────────────────────────────────────────

function header(eyebrow) {
  return `
  <div class="header">
    <div class="header-inner">
      <div class="logo-wrap">
        <img src="${LOGO_URL}" alt="${BRAND}" height="68" style="height:68px;width:auto;margin:0 auto"/>
      </div>
      <div class="header-title">${eyebrow}</div>
    </div>
    <div class="header-divider"></div>
  </div>`
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1 — JOB APPLICATION CONFIRMATION  (to candidate)
// ─────────────────────────────────────────────────────────────────────────────

export function buildJobConfirmationEmail({ fullName, opportunityTitle, experience, skills }) {
  const subject = `Application Received — ${opportunityTitle} | ${BRAND}`
  const preview = `Hi ${fullName}, we've received your job application for ${opportunityTitle}. Our team will review it shortly.`

  const body = `
  ${header('Career Opportunity')}
  <div class="tag-strip"><span class="tag">&#10003; Application Submitted</span><span class="tag" style="background:#fef9ec;color:#92400e;border-color:#f0a50022">Full-Time Position</span></div>
  <div class="body">
    <p class="greeting">Dear ${fullName},</p>
    <p class="intro">Thank you for your interest in joining <strong>${BRAND}</strong>. We have successfully received your application for the role listed below. Our hiring team will review your profile and get in touch if your qualifications align with our current requirements.</p>

    <div class="box box-success">
      <div class="box-label">Position Applied</div>
      <div class="box-value" style="font-weight:700;font-size:17px;color:#065f46">${opportunityTitle}</div>
      <div style="margin-top:8px;font-size:13px;color:${COLOR.mutedText}">Employment Type: <strong>Full-Time / Job</strong></div>
    </div>

    <div class="box box-dark" style="padding:18px 22px;margin-top:0">
      <div class="box-label" style="margin-bottom:12px">What happens next?</div>
      <ul class="steps">
        <li><span class="step-num">1</span><span><strong>Application Review</strong> — Our HR team carefully reviews every submission against the role requirements.</span></li>
        <li><span class="step-num">2</span><span><strong>Shortlisting</strong> — Shortlisted candidates will be contacted via email and phone.</span></li>
        <li><span class="step-num">3</span><span><strong>Interview Process</strong> — Selected candidates will be invited for a structured interview round.</span></li>
        <li><span class="step-num">4</span><span><strong>Final Decision</strong> — We aim to communicate our decision within <strong>7–10 business days</strong>.</span></li>
      </ul>
    </div>

    <div class="pill-row">
      <span class="pill">⏱ Response in 5–7 days</span>
      <span class="pill">📍 Position: ${opportunityTitle}</span>
      ${experience ? `<span class="pill">🏅 Experience: ${experience}</span>` : ''}
    </div>

    <div class="divider"></div>
    <p class="intro" style="font-size:14px;color:${COLOR.mutedText}">In the meantime, explore our work and company culture at <a href="${BRAND_SITE}" style="color:${COLOR.accentDark};font-weight:600">${BRAND_SITE}</a>. For job-related enquiries, write to us at <a href="mailto:careers@indocreonix.com" style="color:${COLOR.accentDark}">careers@indocreonix.com</a>.</p>

    <p class="intro" style="margin-top:20px">We appreciate your time and wish you the very best.<br/><br/>
    Warm regards,<br/><strong style="color:${COLOR.btnBg}">Team ${BRAND}</strong></p>
  </div>`

  return { subject, html: shell(preview, body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2 — INTERNSHIP APPLICATION CONFIRMATION  (to candidate)
// ─────────────────────────────────────────────────────────────────────────────

export function buildInternshipConfirmationEmail({ fullName, opportunityTitle, qualification, skills }) {
  const subject = `Internship Application Received — ${opportunityTitle} | ${BRAND}`
  const preview = `Hi ${fullName}, your internship application at ${BRAND} has been received. Watch out for our response!`

  const body = `
  ${header('Internship Programme')}
  <div class="tag-strip"><span class="tag">&#10003; Application Submitted</span><span class="tag" style="background:#fef3ff;color:#7e22ce;border-color:#a855f722">Internship</span></div>
  <div class="body">
    <p class="greeting">Hey ${fullName}! 👋</p>
    <p class="intro">Exciting news — your internship application has landed safely with us at <strong>${BRAND}</strong>! We're thrilled to see passionate emerging talent applying, and we'll be reviewing your application with full attention.</p>

    <div class="box" style="background:#f5f3ff;border-left:4px solid #7c3aed">
      <div class="box-label" style="color:#6d28d9">Internship Role</div>
      <div class="box-value" style="font-weight:700;font-size:17px;color:#4c1d95">${opportunityTitle}</div>
      <div style="margin-top:8px;font-size:13px;color:${COLOR.mutedText}">Programme Type: <strong>Internship</strong></div>
    </div>

    <div class="box box-dark" style="padding:18px 22px;margin-top:0">
      <div class="box-label" style="margin-bottom:12px">Your application journey</div>
      <ul class="steps">
        <li><span class="step-num" style="background:#7c3aed">1</span><span><strong>Profile Review</strong> — We review your academic background, skills, and motivation.</span></li>
        <li><span class="step-num" style="background:#7c3aed">2</span><span><strong>Shortlisting</strong> — Selected candidates proceed to a brief technical/aptitude assessment.</span></li>
        <li><span class="step-num" style="background:#7c3aed">3</span><span><strong>Introductory Call</strong> — A short call with our team to understand your goals better.</span></li>
        <li><span class="step-num" style="background:#7c3aed">4</span><span><strong>Onboarding</strong> — Successful interns get a formal offer letter and structured onboarding.</span></li>
      </ul>
    </div>

    <div class="box box-blue" style="font-size:14px;color:#1e3a8a">
      💡 <strong>Pro tip:</strong> Keep an eye on your inbox (and spam folder!) over the next 5–7 business days. Our response will come from <strong>careers@indocreonix.com</strong>.
    </div>

    <div class="pill-row">
      <span class="pill">⏱ Response in 5–7 days</span>
      ${qualification ? `<span class="pill">🎓 ${qualification}</span>` : ''}
    </div>

    <div class="divider"></div>
    <p class="intro" style="font-size:14px;color:${COLOR.mutedText}">Questions? Reach our careers team at <a href="mailto:careers@indocreonix.com" style="color:${COLOR.accentDark}">careers@indocreonix.com</a>. We love hearing from motivated students!</p>

    <p class="intro" style="margin-top:20px">Best of luck — we look forward to meeting you. 🚀<br/><br/>
    Warm regards,<br/><strong style="color:${COLOR.btnBg}">Team ${BRAND}</strong></p>
  </div>`

  return { subject, html: shell(preview, body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3 — CONTACT FORM CONFIRMATION  (to user)
// ─────────────────────────────────────────────────────────────────────────────

export function buildContactConfirmationEmail({ name, message }) {
  const subject = `We Received Your Message | ${BRAND}`
  const preview = `Hi ${name}, thank you for getting in touch. Our team will respond within 1–2 business days.`
  const shortMsg = message.length > 220 ? message.slice(0, 217) + '…' : message

  const body = `
  ${header('Get In Touch')}
  <div class="tag-strip"><span class="tag">&#10003; Message Received</span></div>
  <div class="body">
    <p class="greeting">Hello ${name},</p>
    <p class="intro">Thank you for reaching out to <strong>${BRAND}</strong>. We appreciate you taking the time to contact us — your message is important to us, and our team will get back to you as soon as possible.</p>

    <div class="box box-dark" style="padding:20px 22px">
      <div class="box-label">Your Message</div>
      <div class="box-value">${shortMsg}</div>
    </div>

    <div class="box box-success" style="margin-top:0">
      <div style="font-size:15px;font-weight:600;color:#065f46;margin-bottom:4px">⏱ Expected Response Time</div>
      <div style="font-size:14px;color:#374151">Our team typically responds within <strong>1–2 business days</strong>. For urgent matters, call us directly.</div>
    </div>

    <div class="divider"></div>
    <p style="font-size:14px;color:${COLOR.mutedText};margin-bottom:16px">Want to explore our services while you wait?</p>
    <div class="btn-wrap">
      <a href="${BRAND_SITE}" class="cta-btn">Explore ${BRAND} &rarr;</a>
    </div>

    <div class="divider" style="margin-top:28px"></div>
    <p class="intro" style="font-size:13px;color:${COLOR.mutedText}">If your matter is urgent, you can also reach us at <a href="mailto:contact@indocreonix.com" style="color:${COLOR.accentDark}">contact@indocreonix.com</a>.</p>

    <p class="intro" style="margin-top:20px">Looking forward to speaking with you!<br/><br/>
    Warm regards,<br/><strong style="color:${COLOR.btnBg}">Team ${BRAND}</strong></p>
  </div>`

  return { subject, html: shell(preview, body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 4 — INTERNAL: Career Application Notification  (to HR inbox)
// ─────────────────────────────────────────────────────────────────────────────

export function buildApplicationNotificationEmail({ fullName, email, phone, city, roleType, opportunityTitle, experience, qualification, skills, portfolio, message }) {
  const isInternship = roleType === 'internship'
  const roleLabel    = isInternship ? 'Internship' : 'Full-Time Job'
  const accentColor  = isInternship ? '#7c3aed' : COLOR.accentDark
  const subject      = `[${roleLabel} Application] ${fullName} → ${opportunityTitle}`
  const preview      = `New ${roleLabel.toLowerCase()} application from ${fullName} for ${opportunityTitle}. Review details inside.`

  const body = `
  ${header(`New ${roleLabel} Application`)}
  <div class="tag-strip">
    <span class="tag" style="background:${isInternship ? '#faf5ff' : COLOR.tagBg};color:${accentColor};border-color:${accentColor}22">&#128276; ${roleLabel}</span>
    <span class="tag" style="background:#fff7ed;color:#c2410c;border-color:#ea580c22">Action Required</span>
  </div>
  <div class="body">
    <p class="greeting" style="font-size:19px">New Application Received</p>
    <p class="intro">A candidate has submitted a <strong>${roleLabel.toLowerCase()}</strong> application through the ${BRAND} careers portal. All details are captured below.</p>

    <table class="info-table">
      <tr><td>Full Name</td><td><strong>${fullName}</strong></td></tr>
      <tr><td>Email Address</td><td><a href="mailto:${email}" style="color:${COLOR.accentDark}">${email}</a></td></tr>
      <tr><td>Phone</td><td>${phone || '—'}</td></tr>
      <tr><td>City / Location</td><td>${city || '—'}</td></tr>
      <tr><td>Role Applied For</td><td><strong>${opportunityTitle || roleType}</strong></td></tr>
      <tr><td>Application Type</td><td><span style="color:${accentColor};font-weight:700">${roleLabel}</span></td></tr>
      <tr><td>Experience</td><td>${experience || '—'}</td></tr>
      <tr><td>Qualification</td><td>${qualification || '—'}</td></tr>
      <tr><td>Skills</td><td>${skills || '—'}</td></tr>
      <tr><td>Portfolio / GitHub</td><td>${portfolio ? `<a href="${portfolio}" style="color:${COLOR.accentDark}">${portfolio}</a>` : '—'}</td></tr>
    </table>

    <div class="box box-dark" style="padding:18px 22px;margin-top:4px">
      <div class="box-label">Cover Message</div>
      <div class="box-value">${message || '—'}</div>
    </div>

    <div class="box box-warn" style="font-size:14px;color:#78350f">
      ⚡ <strong>CV attached by admin panel.</strong> Log in to download the CV, update application status, or add admin notes.
    </div>

    <div class="btn-wrap">
      <a href="${BRAND_SITE}/admin/careers/applications" class="cta-btn">Open Admin Panel &rarr;</a>
    </div>

    <div class="divider"></div>
    <p style="font-size:12px;color:${COLOR.mutedText}">This is an automated notification generated by the ${BRAND} careers system. Do not reply to this email.</p>
  </div>`

  return { subject, html: shell(preview, body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 5 — INTERNAL: Contact Lead Notification  (to contact inbox)
// ─────────────────────────────────────────────────────────────────────────────

export function buildContactNotificationEmail({ name, email, phone, company, message }) {
  const subject = `[New Enquiry] ${name}${company ? ` — ${company}` : ''}`
  const preview = `New contact form submission from ${name}${company ? ` (${company})` : ''}. Review and respond promptly.`

  const body = `
  ${header('New Contact Enquiry')}
  <div class="tag-strip">
    <span class="tag">&#128140; Contact Form</span>
    <span class="tag" style="background:#fff7ed;color:#c2410c;border-color:#ea580c22">Respond within 24h</span>
  </div>
  <div class="body">
    <p class="greeting" style="font-size:19px">New Enquiry Received</p>
    <p class="intro">Someone has submitted the contact form on <strong>${BRAND_SITE}</strong>. Please respond within your target SLA of 1–2 business days.</p>

    <table class="info-table">
      <tr><td>Name</td><td><strong>${name}</strong></td></tr>
      <tr><td>Email</td><td><a href="mailto:${email}" style="color:${COLOR.accentDark}">${email}</a></td></tr>
      <tr><td>Phone</td><td>${phone || '—'}</td></tr>
      <tr><td>Company / Organisation</td><td>${company || '—'}</td></tr>
    </table>

    <div class="box box-dark" style="padding:18px 22px;margin-top:4px">
      <div class="box-label">Their Message</div>
      <div class="box-value">${message || '—'}</div>
    </div>

    <div class="btn-wrap" style="display:flex;gap:12px;flex-wrap:wrap">
      <a href="mailto:${email}" class="cta-btn" style="background:#065f46">Reply via Email &rarr;</a>
      <a href="${BRAND_SITE}/admin/leads" class="cta-btn">View in Admin Panel &rarr;</a>
    </div>

    <div class="divider"></div>
    <p style="font-size:12px;color:${COLOR.mutedText}">This is an automated notification from the ${BRAND} contact system. Do not reply to this automated email.</p>
  </div>`

  return { subject, html: shell(preview, body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC SEND HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Career application — smart dispatcher
 * Sends the correct template (job vs internship) based on roleType
 */
export async function sendApplicationConfirmation(to, data) {
  const isInternship = data.roleType === 'internship'
  const { subject, html } = isInternship
    ? buildInternshipConfirmationEmail(data)
    : buildJobConfirmationEmail(data)

  return sendMail({
    from:    `"${BRAND} Careers" <${getSenderAddress('careers')}>`,
    replyTo: env.resendCareersFrom,
    to,
    subject,
    html,
  })
}

/**
 * Internal HR notification — sent to careers@indocreonix.com
 */
export async function sendApplicationNotification(data) {
  const { subject, html } = buildApplicationNotificationEmail(data)
  return sendMail({
    from:    `"${BRAND} Careers Bot" <${getSenderAddress('careers')}>`,
    replyTo: data.email,
    to:      env.resendCareersFrom,
    subject,
    html,
  })
}

export function buildReviewingNotificationEmail({ fullName, opportunityTitle }) {
  const subject = `Application Update: Under Review — ${opportunityTitle}`
  const preview = `Hi ${fullName}, your application for ${opportunityTitle} is now under review.`

  const body = `
  ${header('Application Update')}
  <div class="tag-strip">
    <span class="tag" style="background:#f0fdf4;color:#166534;border-color:#16a34a22">&#128269; Application Status</span>
    <span class="tag" style="background:#f0fdf4;color:#166534;border-color:#16a34a22">Under Review</span>
  </div>
  <div class="body">
    <p class="greeting">Hey ${fullName}! 👋</p>
    <p class="intro">We wanted to share a quick update regarding your application for the <strong>${opportunityTitle}</strong> position at <strong>${BRAND}</strong>. Our Talent Acquisition team has successfully processed your profile and it is currently <strong>under active review</strong>.</p>

    <div class="box" style="background:#f0fdf4;border-left:4px solid #16a34a">
      <div class="box-label" style="color:#15803d">Application Status</div>
      <div class="box-value" style="font-weight:700;font-size:17px;color:#166534">Under Review</div>
      <div style="margin-top:8px;font-size:13px;color:${COLOR.mutedText}">Your profile is being evaluated against the role requirements.</div>
    </div>

    <div class="box box-dark" style="padding:18px 22px;margin-top:0">
      <div class="box-label" style="margin-bottom:12px">Your Application Journey</div>
      <ul class="steps">
        <li><span class="step-num" style="background:#16a34a">&#10003;</span><span><strong>Passed Initial Screening</strong> — Your application has cleared the automated checks.</span></li>
        <li><span class="step-num" style="background:#16a34a">2</span><span><strong>Deep Profile Review</strong> — Our hiring managers are currently evaluating your portfolio, experience, and skills.</span></li>
      </ul>
    </div>

    <div class="box box-blue" style="font-size:14px;color:#1e3a8a">
      💡 <strong>Pro tip:</strong> This review typically takes between <strong>3–5 business days</strong>. Once completed, Human Resources will reach out to you directly with the outcome. Keep an eye on your inbox!
    </div>

    <div class="divider"></div>
    <p class="intro" style="font-size:14px;color:${COLOR.mutedText}">Questions? Reply directly to this email and our team will get back to you.</p>

    <p class="intro" style="margin-top:20px">Warm regards,<br/><strong style="color:${COLOR.btnBg}">Team ${BRAND}</strong></p>
  </div>`

  return { subject, html: shell(preview, body) }
}

export function buildShortlistNotificationEmail({ fullName, opportunityTitle }) {
  const subject = `Congratulations! You've been shortlisted — ${opportunityTitle}`
  const preview = `Great news, ${fullName}! Your application for ${opportunityTitle} has been shortlisted.`

  const body = `
  ${header('Great News!')}
  <div class="tag-strip">
    <span class="tag" style="background:#f0fdf4;color:#166534;border-color:#16a34a22">&#127881; Application Status</span>
    <span class="tag" style="background:#f0fdf4;color:#166534;border-color:#16a34a22">Shortlisted</span>
  </div>
  <div class="body">
    <p class="greeting">Hey ${fullName}! 👋</p>
    <p class="intro">We are delighted to inform you that your profile has stood out to us, and you have been officially <strong>shortlisted</strong> for the <strong>${opportunityTitle}</strong> role at <strong>${BRAND}</strong>.</p>

    <div class="box" style="background:#f0fdf4;border-left:4px solid #16a34a">
      <div class="box-label" style="color:#15803d">Application Status</div>
      <div class="box-value" style="font-weight:700;font-size:17px;color:#166534">Shortlisted for Next Round</div>
      <div style="margin-top:8px;font-size:13px;color:${COLOR.mutedText}">You are now moving on to the formal interview stages.</div>
    </div>

    <div class="box box-dark" style="padding:18px 22px;margin-top:0">
      <div class="box-label" style="margin-bottom:12px">Your Next Steps</div>
      <ul class="steps">
        <li><span class="step-num" style="background:#16a34a">1</span><span><strong>HR Outreach</strong> — Human Resources will contact you shortly to schedule an introductory call.</span></li>
        <li><span class="step-num" style="background:#16a34a">2</span><span><strong>Prepare Your Setup</strong> — Ensure your portfolio and previously submitted details are ready to be discussed.</span></li>
        <li><span class="step-num" style="background:#16a34a">3</span><span><strong>Possible Assessment</strong> — Depending on the role, you may receive a brief technical or aptitude assignment.</span></li>
      </ul>
    </div>

    <div class="box box-blue" style="font-size:14px;color:#1e3a8a">
      💡 <strong>Pro tip:</strong> Start reviewing your core skills and familiarise yourself with Indocreonix's recent projects on our website. Our technical interviews are highly practical!
    </div>

    <div class="divider"></div>
    <p class="intro" style="font-size:14px;color:${COLOR.mutedText}">Please keep a close watch on your email and phone so you don't miss our HR team's call.</p>

    <p class="intro" style="margin-top:20px">Looking forward to speaking with you,<br/><strong style="color:${COLOR.btnBg}">Team ${BRAND}</strong></p>
  </div>`

  return { subject, html: shell(preview, body) }
}

export function buildHiredNotificationEmail({ fullName, opportunityTitle }) {
  const subject = `Offer of Employment — ${opportunityTitle}`
  const preview = `Dear ${fullName}, we are delighted to offer you the position of ${opportunityTitle} at Indocreonix.`

  const body = `
  ${header('Offer of Employment')}
  <div class="tag-strip">
    <span class="tag" style="background:#f0fdf4;color:#166534;border-color:#16a34a22">&#11088; Formal Offer</span>
    <span class="tag" style="background:#f0fdf4;color:#166534;border-color:#16a34a22">Selected</span>
  </div>
  <div class="body">
    <p class="greeting">Dear ${fullName},</p>
    <p class="intro">It is our great pleasure to officially inform you that you have been <strong>selected</strong> for the position of <strong>${opportunityTitle}</strong> at <strong>${BRAND}</strong>.</p>
    
    <div class="box" style="background:#f0fdf4;border-left:4px solid #16a34a">
      <div class="box-label" style="color:#15803d">Application Status</div>
      <div class="box-value" style="font-weight:700;font-size:17px;color:#166534">Offer Extended</div>
      <div style="margin-top:8px;font-size:13px;color:${COLOR.mutedText}">You are moving to the final onboarding stage.</div>
    </div>

    <div class="box box-dark" style="padding:18px 22px;margin-top:0">
      <div class="box-label" style="margin-bottom:12px">Onboarding Steps</div>
      <ul class="steps">
        <li><span class="step-num" style="background:#16a34a">1</span><span><strong>Offer Letter Issuance</strong> — Our Human Resources department is generating your formal employment offer.</span></li>
        <li><span class="step-num" style="background:#16a34a">2</span><span><strong>Documentation</strong> — You will be required to submit standard documentation for your employee record.</span></li>
        <li><span class="step-num" style="background:#16a34a">3</span><span><strong>Induction</strong> — We will establish your reporting date and familiarise you with company protocols.</span></li>
      </ul>
    </div>

    <div class="divider"></div>
    <p class="intro" style="font-size:14px;color:${COLOR.mutedText}">A representative from Human Resources will contact you shortly to coordinate the delivery of your contractual documents and discuss the next formalities.</p>

    <p class="intro" style="margin-top:20px">We commend you on your successful interview process and look forward to welcoming you to the firm.<br/><br/>Sincerely,<br/><strong style="color:${COLOR.btnBg}">Human Resources<br/>Team ${BRAND}</strong></p>
  </div>`

  return { subject, html: shell(preview, body) }
}

export function buildRejectedNotificationEmail({ fullName, opportunityTitle }) {
  const subject = `Update regarding your application for ${opportunityTitle}`
  const preview = `Dear ${fullName}, thank you for your patience. We have an update regarding your application.`

  const body = `
  ${header('Application Update')}
  <div class="tag-strip">
    <span class="tag" style="background:#f3f4f6;color:#374151;border-color:#6b728022">&#128269; Application Status</span>
    <span class="tag" style="background:#f3f4f6;color:#374151;border-color:#6b728022">Not Proceeding</span>
  </div>
  <div class="body">
    <p class="greeting">Dear ${fullName},</p>
    <p class="intro">Thank you for taking the time to apply for the <strong>${opportunityTitle}</strong> position at <strong>${BRAND}</strong>, and for your patience while our Talent Acquisition team reviewed your profile.</p>

    <div class="box box-dark" style="padding:18px 22px;margin-top:16px">
      <div class="box-label">Decision Update</div>
      <div class="box-value" style="font-size:15px;line-height:1.65;white-space:normal;color:${COLOR.bodyText}">
        We received a significant number of strong applications for this position. After careful consideration, we have decided to move forward with other candidates whose qualifications more closely align with our current structural needs for this particular role.
      </div>
    </div>

    <div class="divider"></div>
    <p class="intro" style="font-size:14px;color:${COLOR.mutedText}">Please know that this decision does not reflect upon your skills or potential. We genuinely appreciate your interest in our company and the time you invested in the application process.</p>
    <p class="intro" style="font-size:14px;color:${COLOR.mutedText}">We will keep your resume on file and may reach out if a role matching your profile opens up in the future.</p>

    <p class="intro" style="margin-top:20px">We wish you the absolute best in your professional endeavours.<br/><br/>Sincerely,<br/><strong style="color:${COLOR.btnBg}">Human Resources<br/>Team ${BRAND}</strong></p>
  </div>`

  return { subject, html: shell(preview, body) }
}

export async function sendStatusUpdateNotification(to, status, data) {
  let payload
  if (status === 'reviewing') payload = buildReviewingNotificationEmail(data)
  else if (status === 'shortlisted') payload = buildShortlistNotificationEmail(data)
  else if (status === 'hired') payload = buildHiredNotificationEmail(data)
  else if (status === 'rejected') payload = buildRejectedNotificationEmail(data)
  else return null

  return sendMail({
    from:    `"${BRAND} Careers" <${getSenderAddress('careers')}>`,
    to,
    subject: payload.subject,
    html: payload.html,
  })
}

/**
 * Contact form — confirmation to the person who wrote to us
 */
export async function sendContactConfirmation(to, data) {
  const { subject, html } = buildContactConfirmationEmail(data)
  return sendMail({
    from:    `"${BRAND}" <${getSenderAddress('contact')}>`,
    replyTo: env.resendContactFrom,
    to,
    subject,
    html,
  })
}

/**
 * Contact form — internal notification to contact@indocreonix.com
 */
export async function sendContactNotification(data) {
  const { subject, html } = buildContactNotificationEmail(data)
  return sendMail({
    from:    `"${BRAND} Contact Bot" <${getSenderAddress('contact')}>`,
    replyTo: data.email,
    to:      env.resendContactFrom,
    subject,
    html,
  })
}
/**
 * Project form — confirmation to the client
 */
export async function sendOrderConfirmation(to, data) {
  const { subject, html } = buildOrderConfirmationEmail(data)
  return sendMail({
    from: `"${BRAND}" <${getSenderAddress('info')}>`,
    replyTo: env.resendInfoFrom,
    to,
    subject,
    html,
  })
}

/**
 * Project form — internal notification to team
 */
export async function sendOrderNotification(data) {
  const { subject, html } = buildOrderNotificationEmail(data)
  return sendMail({
    from: `"${BRAND} Order Bot" <${getSenderAddress('info')}>`,
    replyTo: data.email,
    to: env.resendInfoFrom,
    subject,
    html,
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 6 — PROJECT ORDER CONFIRMATION (to client)
// ─────────────────────────────────────────────────────────────────────────────

export function buildOrderConfirmationEmail({ fullName, projectCategory, projectSubtype }) {
  const subject = `Project Request Received — ${projectCategory} | ${BRAND}`
  const preview = `Hi ${fullName}, thank you for your project request for ${projectCategory}. Our team will review it and get back to you.`

  const body = `
  ${header('Project Request')}
  <div class="tag-strip"><span class="tag">&#10003; Request Received</span><span class="tag" style="background:#ecfdf5;color:#065f46;border-color:#10b98122">Project Draft</span></div>
  <div class="body">
    <p class="greeting">Hello ${fullName},</p>
    <p class="intro">Thank you for choosing <strong>${BRAND}</strong> for your project. We have received your request for a <strong>${projectCategory}${projectSubtype ? ` (${projectSubtype})` : ''}</strong>. Our engineering and project teams will review your requirements and reach out to you within <strong>1–2 business days</strong>.</p>

    <div class="box box-success">
      <div class="box-label">Request Status</div>
      <div class="box-value" style="font-weight:700;font-size:17px;color:#065f46">Pending Review</div>
      <div style="margin-top:8px;font-size:13px;color:${COLOR.mutedText}">Our team is currently evaluating your goals and requirements.</div>
    </div>

    <div class="box box-dark" style="padding:18px 22px;margin-top:0">
      <div class="box-label" style="margin-bottom:12px">What to expect next?</div>
      <ul class="steps">
        <li><span class="step-num">1</span><span><strong>Requirement Analysis</strong> — We review your summary, goals, and any attached documentation.</span></li>
        <li><span class="step-num">2</span><span><strong>Introductory Call</strong> — A project manager will contact you to discuss details and clarify unknowns.</span></li>
        <li><span class="step-num">3</span><span><strong>Proposal & Quote</strong> — We provide a formal proposal including budget and timeline estimates.</span></li>
        <li><span class="step-num">4</span><span><strong>Kick-off</strong> — Once the proposal is approved, we start the development cycle.</span></li>
      </ul>
    </div>

    <div class="divider"></div>
    <p style="font-size:14px;color:${COLOR.mutedText};margin-bottom:16px">Curious about our process and past work?</p>
    <div class="btn-wrap">
      <a href="${BRAND_SITE}/services" class="cta-btn">View Our Services &rarr;</a>
    </div>

    <div class="divider" style="margin-top:28px"></div>
    <p class="intro" style="font-size:13px;color:${COLOR.mutedText}">For any immediate queries, you can reach our project team at <a href="mailto:info@indocreonix.com" style="color:${COLOR.accentDark}">info@indocreonix.com</a>.</p>

    <p class="intro" style="margin-top:20px">Looking forward to building something great Together!<br/><br/>
    Warm regards,<br/><strong style="color:${COLOR.btnBg}">Team ${BRAND}</strong></p>
  </div>`

  return { subject, html: shell(preview, body) }
}

// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 7 — INTERNAL: Project Order Notification (to team)
// ─────────────────────────────────────────────────────────────────────────────

export function buildOrderNotificationEmail({ fullName, email, phone, company, targetBudget, targetTimeline, projectCategory, projectSubtype, requestedService, businessGoals, projectSummary }) {
  const subject = `[New Project Request] ${fullName} — ${projectCategory}`
  const preview = `New project request from ${fullName} for ${projectCategory}. Review and respond.`

  const body = `
  ${header('New Project Request')}
  <div class="tag-strip">
    <span class="tag">&#128188; Project Enquiry</span>
    <span class="tag" style="background:#fff7ed;color:#c2410c;border-color:#ea580c22">High Priority</span>
  </div>
  <div class="body">
    <p class="greeting" style="font-size:19px">New Project Detail Received</p>
    <p class="intro">A new project request has been submitted via the ${BRAND} website. Please review the requirements and assign a project manager.</p>

    <table class="info-table">
      <tr><td>Client Name</td><td><strong>${fullName}</strong></td></tr>
      <tr><td>Email</td><td><a href="mailto:${email}" style="color:${COLOR.accentDark}">${email}</a></td></tr>
      <tr><td>Phone</td><td>${phone || '—'}</td></tr>
      <tr><td>Company</td><td>${company || '—'}</td></tr>
      <tr><td>Category</td><td><strong>${projectCategory}</strong></td></tr>
      <tr><td>Subtype</td><td>${projectSubtype || '—'}</td></tr>
      <tr><td>Type</td><td>${requestedService || '—'}</td></tr>
      <tr><td>Budget</td><td>${targetBudget || 'Not specified'}</td></tr>
      <tr><td>Timeline</td><td>${targetTimeline || 'Not specified'}</td></tr>
    </table>

    <div class="box box-dark" style="padding:18px 22px;margin-top:4px">
      <div class="box-label">Business Goals</div>
      <div class="box-value">${businessGoals || '—'}</div>
    </div>

    <div class="box box-dark" style="padding:18px 22px;margin-top:4px">
      <div class="box-label">Project Summary</div>
      <div class="box-value">${projectSummary || '—'}</div>
    </div>

    <div class="box box-warn" style="font-size:14px;color:#78350f">
      ⚡ <strong>Documents may be attached.</strong> Log in to the admin panel to download PRD and supporting documents.
    </div>

    <div class="btn-wrap" style="display:flex;gap:12px;flex-wrap:wrap">
      <a href="mailto:${email}" class="cta-btn" style="background:#065f46">Reply to Client &rarr;</a>
      <a href="${BRAND_SITE}/admin/orders" class="cta-btn">View in Admin Panel &rarr;</a>
    </div>

    <div class="divider"></div>
    <p style="font-size:12px;color:${COLOR.mutedText}">This is an automated notification from the ${BRAND} project management system.</p>
  </div>`

  return { subject, html: shell(preview, body) }
}
