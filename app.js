/* =========================================================
   BidMind – Website interactions
   ========================================================= */

/* ── Sticky nav ── */
const nav = document.getElementById('nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 20);
}, { passive: true });

/* ── Hamburger / mobile menu ── */
const hamburger = document.getElementById('hamburger');
const mobileMenu = document.getElementById('mobileMenu');
hamburger.addEventListener('click', () => {
  const open = mobileMenu.classList.toggle('open');
  const spans = hamburger.querySelectorAll('span');
  spans[0].style.transform = open ? 'rotate(45deg) translate(5px, 5px)' : '';
  spans[1].style.opacity   = open ? '0' : '';
  spans[2].style.transform = open ? 'rotate(-45deg) translate(5px, -5px)' : '';
});
mobileMenu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  mobileMenu.classList.remove('open');
  hamburger.querySelectorAll('span').forEach(s => { s.style.transform = ''; s.style.opacity = ''; });
}));

/* ── Scroll reveal (generic .reveal elements) ── */
const revealObs = new IntersectionObserver(entries => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      e.target.style.transitionDelay = `${(Array.from(e.target.parentElement.children).indexOf(e.target) % 4) * 0.07}s`;
      e.target.classList.add('visible');
      revealObs.unobserve(e.target);
    }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

/* Elements to animate in */
[
  '.feat-card', '.step-card', '.fw-card', '.testi-card',
  '.logo-pill', '.mm-metric', '.bene-item',
].forEach(sel => {
  document.querySelectorAll(sel).forEach(el => {
    el.classList.add('reveal');
    revealObs.observe(el);
  });
});

/* Section headers fade up */
document.querySelectorAll('.section-h2, .section-sub, .section-label, .feat-main, .bv-card-main').forEach(el => {
  el.classList.add('reveal');
  revealObs.observe(el);
});

/* ── Progress bar animation ── */
const progFill = document.querySelector('.mm-prog-fill');
if (progFill) {
  const target = progFill.style.width;
  progFill.style.width = '0%';
  const po = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      setTimeout(() => { progFill.style.width = target; }, 400);
      po.disconnect();
    }
  }, { threshold: 0.5 });
  po.observe(progFill);
}

/* ── Bar chart animation ── */
document.querySelectorAll('.bvc-bar-before, .bvc-bar-after').forEach(bar => {
  const target = bar.style.width;
  bar.style.width = '0%';
  const bo = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting) {
      setTimeout(() => { bar.style.width = target; }, 300);
      bo.disconnect();
    }
  }, { threshold: 0.3 });
  bo.observe(bar);
});

/* ── Smooth scroll ── */
document.querySelectorAll('a[href^="#"]').forEach(a => {
  a.addEventListener('click', e => {
    const href = a.getAttribute('href');
    if (href === '#') return;
    const target = document.querySelector(href);
    if (target) {
      e.preventDefault();
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - 80, behavior: 'smooth' });
    }
  });
});

/** Vercel: `/api/contact`. Klassieke PHP-hosting: zet naar `contact.php` en gebruik FormData i.p.v. JSON. */
const CONTACT_API_URL = '/api/contact';

async function postContactForm(form) {
  const website = form.querySelector('[name="website"]')?.value ?? '';
  const name = form.querySelector('#contactName')?.value.trim() ?? '';
  const email = form.querySelector('#contactEmail')?.value.trim() ?? '';
  const message = form.querySelector('#contactMessage')?.value.trim() ?? '';

  const res = await fetch(CONTACT_API_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ website, name, email, message }),
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

/* ── Demo-aanvraagformulier (naam, e-mail, bericht → mail via contact.php) ── */
const contactForm = document.getElementById('contactForm');
const contactFormMsg = document.getElementById('contactFormMsg');

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
  const defaultContactBtnText = submitBtn ? submitBtn.textContent : '';

  contactForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideContactFormMessage();

    const name = contactForm.querySelector('#contactName')?.value.trim() ?? '';
    const email = contactForm.querySelector('#contactEmail')?.value.trim() ?? '';
    const message = contactForm.querySelector('#contactMessage')?.value.trim() ?? '';

    if (!name || !email.includes('@') || message.length < 10) {
      showContactFormMessage('Vul je naam, een geldig e-mailadres en een bericht in (minimaal 10 tekens).', { error: true });
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = 'Versturen…';

    try {
      const { res, data } = await postContactForm(contactForm);

      if (res.ok && data.ok) {
        submitBtn.textContent = '✓ Verstuurd';
        submitBtn.style.background = 'var(--green)';
        submitBtn.disabled = true;
        contactForm.reset();
        showContactFormMessage('Bedankt! Je demo-aanvraag is verstuurd. We nemen zo snel mogelijk contact op.');
        return;
      }

      if (data.error === 'email') {
        showContactFormMessage('Controleer je e-mailadres.', { error: true });
      } else if (data.error === 'name' || data.error === 'message') {
        showContactFormMessage('Vul een geldige naam en een bericht van minimaal 10 tekens in.', { error: true });
      } else if (data.error === 'missing_phpmailer') {
        showContactFormMessage(
          'Server mist mail-ondersteuning (PHPMailer). Neem contact op met de beheerder of mail rechtstreeks naar info@bidmind.nl.',
          { error: true }
        );
      } else if (data.error === 'smtp_password_missing') {
        showContactFormMessage(
          'E-mail is op de server nog niet geconfigureerd (SMTP-wachtwoord ontbreekt). Mail naar info@bidmind.nl.',
          { error: true }
        );
      } else {
        const hint = data.detail ? ` Technische info: ${data.detail}` : '';
        showContactFormMessage(
          `Versturen is mislukt. Probeer het later opnieuw of mail naar info@bidmind.nl.${hint}`,
          { error: true }
        );
      }
    } catch {
      const subj = encodeURIComponent('Demo-aanvraag www.bidmind.nl');
      const body = encodeURIComponent(
        `Naam: ${name}\nE-mail: ${email}\n\nBericht:\n${message}`
      );
      showContactFormMessage(
        `Kon niet versturen via de server. <a href="mailto:info@bidmind.nl?subject=${subj}&body=${body}">Open je mailapp</a> of mail naar info@bidmind.nl.`,
        { error: true, html: true }
      );
    }

    submitBtn.disabled = false;
    submitBtn.textContent = defaultContactBtnText;
    submitBtn.style.background = '';
  });
}

/* ── Active nav highlight ── */
const sections = document.querySelectorAll('section[id]');
const navLinks = document.querySelectorAll('.nav-links a');
window.addEventListener('scroll', () => {
  let cur = '';
  sections.forEach(s => {
    if (window.scrollY >= s.offsetTop - 100) cur = s.getAttribute('id');
  });
  navLinks.forEach(l => {
    l.style.color = '';
    if (l.getAttribute('href') === `#${cur}`) l.style.color = 'var(--indigo)';
  });
}, { passive: true });

/* ── Parallax on hero blobs ── */
window.addEventListener('scroll', () => {
  const y = window.scrollY;
  document.querySelectorAll('.blob').forEach((blob, i) => {
    blob.style.transform = `translateY(${y * (0.06 + i * 0.02)}px)`;
  });
}, { passive: true });

/* ── Stagger for hero stats ── */
document.querySelectorAll('.hero-social-proof, .hero-btns').forEach(el => {
  el.classList.add('reveal');
  revealObs.observe(el);
});

/* ── Section-header text centered where needed ── */
document.querySelectorAll('.hiw-section .section-h2, .hiw-section .section-sub, .features-section .section-h2, .features-section .section-sub').forEach(el => {
  el.style.textAlign = 'center';
});
document.querySelectorAll('.features-section .section-sub').forEach(el => {
  el.style.margin = '0 auto';
});

/* ── AI generator typewriter text ── */
const aiGenCard = document.querySelector('.ai-gen-card');
if (aiGenCard) {
  const typingLines = Array.from(aiGenCard.querySelectorAll('.agc-typing'));

  const fillAllInstantly = () => {
    typingLines.forEach(line => { line.textContent = line.dataset.text || ''; });
    aiGenCard.classList.add('typing-done');
  };

  const typeLine = (el, done) => {
    const text = el.dataset.text || '';
    let idx = 0;
    const tick = () => {
      if (idx <= text.length) {
        el.textContent = text.slice(0, idx);
        idx += 1;
        const jitter = 12 + Math.floor(Math.random() * 22);
        setTimeout(tick, jitter);
        return;
      }
      done();
    };
    tick();
  };

  const startTyping = () => {
    if (aiGenCard.dataset.typingStarted === 'true') return;
    aiGenCard.dataset.typingStarted = 'true';

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      fillAllInstantly();
      return;
    }

    let lineIdx = 0;
    const nextLine = () => {
      if (lineIdx >= typingLines.length) {
        aiGenCard.classList.add('typing-done');
        return;
      }
      const current = typingLines[lineIdx];
      lineIdx += 1;
      typeLine(current, () => setTimeout(nextLine, 220));
    };
    nextLine();
  };

  const maybeStartTyping = () => {
    const rect = aiGenCard.getBoundingClientRect();
    const vh = window.innerHeight || document.documentElement.clientHeight;
    if (rect.top < vh * 0.9 && rect.bottom > 0) startTyping();
  };

  if ('IntersectionObserver' in window) {
    const typeObs = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      startTyping();
      typeObs.disconnect();
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    typeObs.observe(aiGenCard);
  }

  // Fallback: start also on load/scroll so it never stays empty.
  window.addEventListener('load', maybeStartTyping, { once: true });
  window.addEventListener('scroll', maybeStartTyping, { passive: true });
  setTimeout(maybeStartTyping, 900);
  setTimeout(startTyping, 120);
}
