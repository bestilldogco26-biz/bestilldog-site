/*
  Progressive enhancement only. Every page is complete without this file.
  1. Mobile navigation toggle (Escape closes and returns focus to the toggle).
  2. Inquiry form: checks the answers, then opens an email draft in the visitor's own email app.
  3. Back to top: shown after about one viewport of scrolling; moves focus to main content.
  4. In-page links keep working on the 404 page, where a base element points at the site root.
*/

/*
  Inquiry delivery: the form builds an email draft in the visitor's own email app.
  No form service, endpoint, or secret is used.
*/
const INQUIRY_CONFIG = Object.freeze({ to: 'bestilldogco@gmail.com', maxUrlLength: 1800 });

function initNavigation() {
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.getElementById('site-nav');
  if (!header || !toggle || !nav) return;

  toggle.hidden = false;

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';
  const setOpen = (open) => {
    toggle.setAttribute('aria-expanded', String(open));
    header.classList.toggle('nav-open', open);
  };

  toggle.addEventListener('click', () => setOpen(!isOpen()));

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && isOpen()) {
      setOpen(false);
      toggle.focus();
    }
  });
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fieldValue(form, name) {
  const field = form.elements.namedItem(name);
  if (!field) return '';
  return String(field.value || '').trim();
}

function checkInquiry(form) {
  const errors = [];
  const method = fieldValue(form, 'reply_method');
  const contact = fieldValue(form, 'reply_contact');

  if (!fieldValue(form, 'owner_name')) {
    errors.push({ id: 'owner-name', message: 'Enter your name.' });
  }
  if (!method) {
    errors.push({ id: 'reply-method', message: 'Choose how you would like a reply.' });
  }
  if (!contact) {
    errors.push({ id: 'reply-contact', message: 'Enter the phone number or email address for your reply.' });
  } else if (method === 'email' && !EMAIL_PATTERN.test(contact)) {
    errors.push({ id: 'reply-contact', message: 'Enter a complete email address, including the @ sign.' });
  } else if (method === 'phone' && contact.replace(/\D/g, '').length < 10) {
    errors.push({ id: 'reply-contact', message: 'Enter a phone number with at least 10 digits.' });
  }
  if (!fieldValue(form, 'dog_name')) {
    errors.push({ id: 'dog-name', message: "Enter your dog's name." });
  }
  if (!form.querySelector('input[name="service"]:checked')) {
    errors.push({ id: 'service-training', group: 'service-group', message: 'Choose training, boarding, or not sure.' });
  }
  if (!fieldValue(form, 'details')) {
    errors.push({ id: 'details', message: 'Describe your goals or concerns for your dog.' });
  }
  return errors;
}

function clearErrors(form) {
  form.querySelectorAll('[aria-invalid="true"]').forEach((element) => {
    element.removeAttribute('aria-invalid');
  });
  form.querySelectorAll('.field-error').forEach((element) => {
    element.textContent = '';
    element.hidden = true;
  });
}

function showErrors(form, summary, errors) {
  const list = summary.querySelector('ul');
  list.textContent = '';

  errors.forEach((error) => {
    const errorTarget = error.group || error.id;
    const message = document.getElementById(`${errorTarget}-error`);
    if (message) {
      message.textContent = `Error: ${error.message}`;
      message.hidden = false;
    }
    const control = document.getElementById(errorTarget);
    if (control) control.setAttribute('aria-invalid', 'true');

    const item = document.createElement('li');
    const link = document.createElement('a');
    link.href = `#${error.id}`;
    link.textContent = error.message;
    link.addEventListener('click', (event) => {
      event.preventDefault();
      const field = document.getElementById(error.id);
      if (field) field.focus();
    });
    item.append(link);
    list.append(item);
  });

  summary.hidden = false;
  summary.focus();
}

const SERVICE_LABELS = { training: 'Training', boarding: 'Boarding', 'not-sure': 'Not sure yet' };
const REPLY_LABELS = { phone: 'Phone call', email: 'Email' };
const CRLF = '\r\n';

// Single-line fields: CR and LF are replaced with spaces so a value can never add a mail header line.
function singleLine(value) {
  return String(value).replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildInquiry(form) {
  const service = SERVICE_LABELS[fieldValue(form, 'service')] || 'Not sure yet';
  const dogName = singleLine(fieldValue(form, 'dog_name'));
  const subject = 'Website inquiry: ' + service + ' for ' + dogName;
  const body = [
    'Name: ' + singleLine(fieldValue(form, 'owner_name')),
    'Preferred reply: ' + (REPLY_LABELS[fieldValue(form, 'reply_method')] || ''),
    'Reply contact: ' + singleLine(fieldValue(form, 'reply_contact')),
    "Dog's name: " + dogName,
    'Age and breed: ' + (singleLine(fieldValue(form, 'dog_details')) || 'Not given'),
    'Service: ' + service,
    '',
    'Goals or concerns:',
    fieldValue(form, 'details').replace(/\r\n|\r|\n/g, CRLF),
    '',
    'Written with the inquiry form on the Be Still Dog Co. website.'
  ].join(CRLF);
  const url = 'mailto:' + INQUIRY_CONFIG.to + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(body);
  return { subject, body, url };
}

function initInquiryForm() {
  const form = document.querySelector('form[data-inquiry-form]');
  if (!(form instanceof HTMLFormElement)) return;

  const summary = document.getElementById('form-errors');
  const status = document.getElementById('form-status');
  const fallback = document.getElementById('mail-fallback');
  const fallbackText = document.getElementById('mail-fallback-text');
  if (!summary || !status) return;

  form.noValidate = true;

  form.addEventListener('submit', (event) => {
    // The script builds the email draft itself; the browser's own form submission never runs.
    event.preventDefault();
    clearErrors(form);
    status.textContent = '';
    if (fallback) fallback.hidden = true;

    const errors = checkInquiry(form);
    if (errors.length) {
      showErrors(form, summary, errors);
      return;
    }

    summary.hidden = true;
    const inquiry = buildInquiry(form);

    if (inquiry.url.length > INQUIRY_CONFIG.maxUrlLength) {
      if (fallback && fallbackText) {
        fallbackText.value = 'Subject: ' + inquiry.subject + CRLF + CRLF + inquiry.body;
        fallback.hidden = false;
        fallbackText.select();
      }
      status.textContent = 'Your message is too long to open in an email app automatically. Copy the text below and email it to ' + INQUIRY_CONFIG.to + '.';
      status.focus();
      return;
    }

    window.location.href = inquiry.url;

    status.textContent = 'Your email app should open with your message ready. Review it and press send there. Nothing has been sent from this page. If no email app opens, write to ' + INQUIRY_CONFIG.to + ' and include the same details.';
    status.focus();
  });
}

function initBackToTop() {
  const holder = document.querySelector('[data-to-top]');
  const link = holder && holder.querySelector('a[href="#top"]');
  const main = document.getElementById('main-content');
  if (!holder || !link || !main) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const update = () => {
    holder.classList.toggle('is-shown', window.scrollY > window.innerHeight * 0.9);
  };

  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();

  // Focus not obscured (WCAG 2.4.11): if the focused element sits under the floating link, scroll it clear.
  // Checked after focus and again when a (possibly smooth) scroll ends.
  const keepFocusClear = () => {
    const target = document.activeElement;
    if (!holder.classList.contains('is-shown') || !(target instanceof Element) || holder.contains(target)) return;
    const focused = target.getBoundingClientRect();
    // Large programmatic targets such as main (focused by this link) are left alone.
    if (target === document.body || target === main || focused.height > window.innerHeight / 2) return;
    const control = link.getBoundingClientRect();
    const covered = focused.left < control.right && focused.right > control.left
      && focused.top < control.bottom && focused.bottom > control.top;
    if (covered) window.scrollBy({ top: focused.bottom - control.top + 16, behavior: 'instant' });
  };
  document.addEventListener('focusin', () => window.requestAnimationFrame(keepFocusClear));
  window.addEventListener('scrollend', keepFocusClear);

  link.addEventListener('click', (event) => {
    event.preventDefault();
    window.scrollTo({ top: 0, behavior: reducedMotion.matches ? 'auto' : 'smooth' });
    // Focus lands on main (tabindex="-1", the skip-link target): the next Tab reaches its first link.
    main.focus({ preventScroll: true });
  });
}

// With a base element (404 page) a bare #fragment href points at the site root. Handle those links here.
function initBaseAnchors() {
  if (!document.querySelector('base[href]')) return;
  document.addEventListener('click', (event) => {
    const link = event.target instanceof Element ? event.target.closest('a[href^="#"]') : null;
    if (!link || event.defaultPrevented) return;
    const id = decodeURIComponent(link.getAttribute('href').slice(1));
    const target = id ? document.getElementById(id) : document.body;
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView();
    if (target instanceof HTMLElement && target.tabIndex < 0 && target.hasAttribute('tabindex')) target.focus({ preventScroll: true });
  });
}

document.documentElement.classList.add('has-js');
initNavigation();
initInquiryForm();
initBackToTop();
initBaseAnchors();
