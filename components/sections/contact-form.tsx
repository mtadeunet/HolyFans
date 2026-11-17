'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_SUBJECT_MAX_LENGTH,
} from '@/lib/contact';

/**
 * Implements ADR 00-014: Contact Channel — the Contact Form's
 * "States are localized: idle, sending, sent (an in-page
 * confirmation), and a graceful unavailable state."
 */
type FormState = 'idle' | 'sending' | 'sent' | 'unavailable';

/**
 * Implements ADR 00-014: Contact Channel — "An Island in the Feed
 * Surface: the visitor's name, their email address (required — it is
 * the reply path), an optional subject, and the message, plus a
 * honeypot field invisible to humans. A purpose-bound consent line at
 * the capture point states the single purpose — answering the inquiry
 * — in the visitor's Locale."
 *
 * The Contact Form Island: POSTs the fields plus the visitor's Locale
 * and the `website` honeypot to the contact Route Handler. Any non-2xx
 * or network failure surfaces the graceful unavailable state — honest
 * failure, never a fake success; success shows the in-page
 * confirmation (the auto-acknowledgment email is deferred per ADR
 * 00-014, so the confirmation IS the acknowledgment).
 */
export default function ContactForm() {
  const t = useTranslations('contact');
  const locale = useLocale();
  const [state, setState] = useState<FormState>('idle');

  /**
   * Submit handler: serializes the form (including the honeypot
   * field) and POSTs to `/api/contact`. The in-flight guard prevents
   * duplicate sends; the handler's response — or any failure reaching
   * it — resolves the state machine.
   */
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (state === 'sending') {
      return;
    }

    const data = new FormData(e.currentTarget);
    setState('sending');
    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: data.get('name'),
          email: data.get('email'),
          subject: data.get('subject'),
          message: data.get('message'),
          locale,
          website: data.get('website'),
        }),
      });
      setState(response.ok ? 'sent' : 'unavailable');
    } catch {
      setState('unavailable');
    }
  };

  // Sent state (ADR 00-014): "sent (an in-page confirmation)" — the
  // form is replaced by the confirmation; the delivered email is the
  // only record.
  if (state === 'sent') {
    return (
      <div role="status" className="py-6 text-center">
        <h2 className="mb-2 text-lg font-semibold text-text-primary">
          {t('sent_title')}
        </h2>
        <p className="text-sm text-text-secondary">
          {t('sent_description')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label
          htmlFor="contact-name"
          className="mb-1 block text-sm font-medium text-text-primary"
        >
          {t('name_label')}
        </label>
        <input
          id="contact-name"
          name="name"
          type="text"
          maxLength={CONTACT_NAME_MAX_LENGTH}
          placeholder={t('name_placeholder')}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="contact-email"
          className="mb-1 block text-sm font-medium text-text-primary"
        >
          {t('email_label')}
        </label>
        <input
          id="contact-email"
          name="email"
          type="email"
          required
          maxLength={CONTACT_EMAIL_MAX_LENGTH}
          placeholder={t('email_placeholder')}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="contact-subject"
          className="mb-1 block text-sm font-medium text-text-primary"
        >
          {t('subject_label')}
        </label>
        <input
          id="contact-subject"
          name="subject"
          type="text"
          maxLength={CONTACT_SUBJECT_MAX_LENGTH}
          placeholder={t('subject_placeholder')}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="contact-message"
          className="mb-1 block text-sm font-medium text-text-primary"
        >
          {t('message_label')}
        </label>
        <textarea
          id="contact-message"
          name="message"
          required
          rows={6}
          maxLength={CONTACT_MESSAGE_MAX_LENGTH}
          placeholder={t('message_placeholder')}
          className="w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-sm text-text-primary placeholder:text-text-secondary/60 focus:border-accent focus:outline-none"
        />
      </div>

      {/* Honeypot (ADR 00-014: "a honeypot field invisible to humans"):
          visually hidden, off the tab order, autocomplete off — real
          visitors never fill it; a filled `website` marks a bot and the
          handler answers a silent success. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor="contact-website">{t('website_label')}</label>
        <input
          id="contact-website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Purpose-bound consent line (ADR 00-014): states the single
          purpose — answering the inquiry — in the visitor's Locale. */}
      <p className="text-xs leading-relaxed text-text-secondary">
        {t('consent')}
      </p>

      {state === 'unavailable' && (
        <p role="alert" className="text-sm text-red-600">
          {t('unavailable_title')} — {t('unavailable_description')}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="w-full rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-primary/90 disabled:opacity-60"
      >
        {state === 'sending' ? t('submitting') : t('submit')}
      </button>
    </form>
  );
}
