/* =========================================================
   BidMind – Website interactions
   ========================================================= */

/* ── Sticky nav ── */
const nav = document.getElementById('nav');
const onScrollNav = () => nav.classList.toggle('scrolled', window.scrollY > 40);
window.addEventListener('scroll', onScrollNav, { passive: true });
onScrollNav();

/* ── Hamburger / mobile menu ── */
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
if (hamburger && mobileMenu) {
  const setMenu = (open) => {
    mobileMenu.classList.toggle('open', open);
    hamburger.classList.toggle('open', open);
    nav.classList.toggle('menu-open', open);
    hamburger.setAttribute('aria-expanded', String(open));
    hamburger.setAttribute('aria-label', open ? 'Menu sluiten' : 'Menu openen');
  };
  hamburger.addEventListener('click', () => setMenu(!mobileMenu.classList.contains('open')));
  mobileMenu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
}

/* ── Scroll reveal ── */
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reduceMotion && 'IntersectionObserver' in window) {
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const siblings = Array.from(e.target.parentElement.children);
      const idx = siblings.indexOf(e.target);
      e.target.style.transitionDelay = `${(idx % 4) * 0.06}s`;
      e.target.classList.add('visible');
      revealObs.unobserve(e.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  ['.step', '.feature', '.case', '.sector', '.trust-list li', '.section-head', '.plan', '.faq-intro', '.faq details', '.cta-inner', '.contact-copy', '.contact-panel']
    .forEach((sel) => document.querySelectorAll(sel).forEach((el) => {
      el.classList.add('reveal');
      revealObs.observe(el);
    }));
}

/* ── Smooth scroll with nav offset ── */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const href = a.getAttribute('href');
    if (!href || href === '#') return;
    const target = document.querySelector(href);
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 76;
    window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
    history.replaceState(null, '', href);
  });
});

/* ── Active nav highlight ── */
const sections = Array.from(document.querySelectorAll('main section[id]'));
const navLinks = Array.from(document.querySelectorAll('.nav-links a'));
if (sections.length && navLinks.length) {
  const updateActive = () => {
    let current = '';
    sections.forEach((s) => {
      if (window.scrollY >= s.offsetTop - 120) current = s.id;
    });
    navLinks.forEach((l) => l.classList.toggle('active', l.getAttribute('href') === `#${current}`));
  };
  window.addEventListener('scroll', updateActive, { passive: true });
  updateActive();
}

/* ── Footer year ── */
const yearEl = document.getElementById('year');
if (yearEl) yearEl.textContent = String(new Date().getFullYear());

/* ── Contactformulier ──
   Vercel: `/api/contact` (JSON). Klassieke PHP-hosting: zet CONTACT_API_URL op 'contact.php'
   en gebruik FormData i.p.v. JSON (zie MAIL-SETUP.md). */
const CONTACT_API_URL = '/api/contact';

const contactForm = document.getElementById('contactForm');
const contactFormMsg = document.getElementById('contactFormMsg');

function readForm(form) {
  const val = (sel) => form.querySelector(sel)?.value.trim() ?? '';
  return {
    website: form.querySelector('[name="website"]')?.value ?? '',
    name: val('#contactName'),
    organisation: val('#contactOrg'),
    email: val('#contactEmail'),
    phone: val('#contactPhone'),
    message: val('#contactMessage'),
  };
}

async function postContactForm(payload) {
  const res = await fetch(CONTACT_API_URL, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function showContactFormMessage(text, { error = false, html = false } = {}) {
  if (!contactFormMsg) return;
  contactFormMsg.hidden = false;
  contactFormMsg.classList.remove('is-success', 'is-error');
  contactFormMsg.classList.add(error ? 'is-error' : 'is-success');
  if (html) contactFormMsg.innerHTML = text;
  else contactFormMsg.textContent = text;
}

function hideContactFormMessage() {
  if (!contactFormMsg) return;
  contactFormMsg.hidden = true;
  contactFormMsg.textContent = '';
  contactFormMsg.classList.remove('is-success', 'is-error');
}

if (contactForm) {
  const submitBtn = contactForm.querySelector('.contact-submit');
  const defaultBtnText = submitBtn ? submitBtn.textContent : '';

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideContactFormMessage();

    const payload = readForm(contactForm);

    if (!payload.name || !payload.email.includes('@') || payload.message.length < 10) {
      showContactFormMessage('Vul uw naam, een geldig e-mailadres en een bericht van minimaal 10 tekens in.', { error: true });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Versturen…';

    try {
      const { res, data } = await postContactForm(payload);

      if (res.ok && data.ok) {
        submitBtn.textContent = 'Verstuurd';
        submitBtn.classList.add('is-sent');
        contactForm.reset();
        showContactFormMessage('Bedankt voor uw aanvraag. We nemen binnen één werkdag contact met u op.');
        return;
      }

      if (data.error === 'email') {
        showContactFormMessage('Controleer uw e-mailadres.', { error: true });
      } else if (data.error === 'name' || data.error === 'message') {
        showContactFormMessage('Vul een geldige naam en een bericht van minimaal 10 tekens in.', { error: true });
      } else if (data.error === 'missing_phpmailer' || data.error === 'smtp_password_missing') {
        showContactFormMessage('Het formulier is tijdelijk niet beschikbaar. Mail ons rechtstreeks op info@bidmind.nl.', { error: true });
      } else {
        const hint = data.detail ? ` Technische info: ${data.detail}` : '';
        showContactFormMessage(`Versturen is mislukt. Probeer het later opnieuw of mail naar info@bidmind.nl.${hint}`, { error: true });
      }
    } catch {
      const subj = encodeURIComponent('Demo-aanvraag www.bidmind.nl');
      const body = encodeURIComponent(
        `Naam: ${payload.name}\nOrganisatie: ${payload.organisation}\nE-mail: ${payload.email}\nTelefoon: ${payload.phone}\n\nBericht:\n${payload.message}`
      );
      showContactFormMessage(
        `Kon niet versturen via de server. <a href="mailto:info@bidmind.nl?subject=${subj}&body=${body}">Open uw mailprogramma</a> of mail naar info@bidmind.nl.`,
        { error: true, html: true }
      );
    }

    submitBtn.disabled = false;
    submitBtn.textContent = defaultBtnText;
    submitBtn.classList.remove('is-sent');
  });
}
