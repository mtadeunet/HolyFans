/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 00-014: Contact Channel — "input caps on body size and
 * field lengths, strict validation (email shape and length bound, a
 * Locale that must be supported, a honeypot that must be empty)" and the
 * honeypot's silent-success contract — a filled trap reports its own
 * tagged kind so the Route Handler can acknowledge without sending.
 *
 * Covers `lib/contact.ts`: `parseContactBody` narrows untrusted JSON to a
 * `ContactSubmission` — required `email`/`message`/`locale`, optional
 * `name`/`subject` within their caps, and the `website` honeypot. No
 * framework or store imports; the same route-vs-logic split as
 * `lib/stock-notification.ts`.
 */
import { describe, expect, it } from 'vitest';
import {
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_MESSAGE_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
  CONTACT_SUBJECT_MAX_LENGTH,
  parseContactBody,
} from '@/lib/contact';
import { locales } from '@/lib/i18n';

const VALID_MINIMAL = {
  email: 'user@example.test',
  message: 'A synthetic question about an order.',
  locale: 'pt',
};

describe('parseContactBody — accepted submissions', () => {
  it('accepts a minimal valid body with optional fields undefined', () => {
    const result = parseContactBody(VALID_MINIMAL, locales);
    expect(result).toEqual({
      kind: 'ok',
      submission: {
        name: undefined,
        email: 'user@example.test',
        subject: undefined,
        message: VALID_MINIMAL.message,
        locale: 'pt',
      },
    });
  });

  it('accepts a full valid body and trims every field', () => {
    const result = parseContactBody(
      {
        name: '  Example Visitor  ',
        email: '  USER@Example.TEST ',
        subject: '  Order question ',
        message: '  A synthetic question about an order.  ',
        locale: 'en',
      },
      locales
    );
    expect(result).toEqual({
      kind: 'ok',
      submission: {
        name: 'Example Visitor',
        // Normalized to trim + lowercase — the canonical Reply-To.
        email: 'user@example.test',
        subject: 'Order question',
        message: 'A synthetic question about an order.',
        locale: 'en',
      },
    });
  });

  it('treats blank optional fields as absent', () => {
    const result = parseContactBody(
      { ...VALID_MINIMAL, name: '   ', subject: '' },
      locales
    );
    expect(result).toEqual({
      kind: 'ok',
      submission: expect.objectContaining({
        name: undefined,
        subject: undefined,
      }),
    });
  });

  it('accepts optional fields exactly at their caps', () => {
    const result = parseContactBody(
      {
        ...VALID_MINIMAL,
        name: 'n'.repeat(CONTACT_NAME_MAX_LENGTH),
        subject: 's'.repeat(CONTACT_SUBJECT_MAX_LENGTH),
        message: 'm'.repeat(CONTACT_MESSAGE_MAX_LENGTH),
      },
      locales
    );
    expect(result.kind).toBe('ok');
  });

  it('accepts every supported Locale (ADR 00-005)', () => {
    for (const locale of locales) {
      expect(parseContactBody({ ...VALID_MINIMAL, locale }, locales).kind).toBe(
        'ok'
      );
    }
  });
});

describe('parseContactBody — honeypot (ADR 00-014)', () => {
  it('reports a filled website trap as honeypot, never as ok', () => {
    expect(
      parseContactBody(
        { ...VALID_MINIMAL, website: 'https://spam.test' },
        locales
      )
    ).toEqual({ kind: 'honeypot' });
  });

  it('reports a filled honeypot even when the rest of the body is invalid', () => {
    // The trap is checked first — the bot learns nothing about the
    // other fields' validation.
    expect(parseContactBody({ website: 'x' }, locales)).toEqual({
      kind: 'honeypot',
    });
  });

  it.each([[''], ['   '], [undefined]])(
    'treats website %j as unfilled and validates normally',
    (website) => {
      const result = parseContactBody({ ...VALID_MINIMAL, website }, locales);
      expect(result.kind).toBe('ok');
    }
  );
});

describe('parseContactBody — invalid input', () => {
  it.each([[null], [undefined], ['x'], [42], [true], [[]]])(
    'rejects non-object body %j',
    (body) => {
      expect(parseContactBody(body, locales)).toEqual({ kind: 'invalid' });
    }
  );

  it.each([
    [''],
    ['not-an-email'],
    ['missing@tld'],
    ['@example.test'],
    ['two@@example.test'],
    ['white space@example.test'],
    [`${'a'.repeat(CONTACT_EMAIL_MAX_LENGTH)}@b.cd`], // over the bound
  ])('rejects email %j — shape and length bound (ADR 00-014)', (email) => {
    expect(parseContactBody({ ...VALID_MINIMAL, email }, locales)).toEqual({
      kind: 'invalid',
    });
  });

  it.each([[null], [123], [{}]])('rejects a non-string email %j', (email) => {
    expect(parseContactBody({ ...VALID_MINIMAL, email }, locales)).toEqual({
      kind: 'invalid',
    });
  });

  it('rejects a name over its cap', () => {
    expect(
      parseContactBody(
        { ...VALID_MINIMAL, name: 'n'.repeat(CONTACT_NAME_MAX_LENGTH + 1) },
        locales
      )
    ).toEqual({ kind: 'invalid' });
  });

  it('rejects a subject over its cap', () => {
    expect(
      parseContactBody(
        {
          ...VALID_MINIMAL,
          subject: 's'.repeat(CONTACT_SUBJECT_MAX_LENGTH + 1),
        },
        locales
      )
    ).toEqual({ kind: 'invalid' });
  });

  // Single-line contract: `name` and `subject` feed the relay email's
  // header lines — a line break is malformed input, not content.
  it.each([['Line one\nline two'], ['carriage\rreturn'], ['crlf\r\nsplit']])(
    'rejects a name containing a line break %j',
    (name) => {
      expect(
        parseContactBody({ ...VALID_MINIMAL, name }, locales)
      ).toEqual({ kind: 'invalid' });
    }
  );

  it.each([['Line one\nline two'], ['carriage\rreturn'], ['crlf\r\nsplit']])(
    'rejects a subject containing a line break %j — it lands in the Subject header',
    (subject) => {
      expect(
        parseContactBody({ ...VALID_MINIMAL, subject }, locales)
      ).toEqual({ kind: 'invalid' });
    }
  );

  it.each([[123], [null], [{}]])(
    'rejects a non-string optional field %j — malformed, not blank',
    (value) => {
      expect(
        parseContactBody({ ...VALID_MINIMAL, name: value }, locales)
      ).toEqual({ kind: 'invalid' });
      expect(
        parseContactBody({ ...VALID_MINIMAL, subject: value }, locales)
      ).toEqual({ kind: 'invalid' });
    }
  );

  it.each([
    [''],
    ['   '],
    [null],
    [42],
    [undefined],
    ['m'.repeat(CONTACT_MESSAGE_MAX_LENGTH + 1)],
  ])('rejects message %j — required, non-blank, capped', (message) => {
    expect(parseContactBody({ ...VALID_MINIMAL, message }, locales)).toEqual({
      kind: 'invalid',
    });
  });

  it.each([['fr'], ['PT'], [''], [null], [42], [undefined]])(
    'rejects locale %j — must be a supported Locale',
    (locale) => {
      expect(parseContactBody({ ...VALID_MINIMAL, locale }, locales)).toEqual({
        kind: 'invalid',
      });
    }
  );

  it('honors the caller-supplied supported set, not a hard-coded one', () => {
    // `supportedLocales` is injected so the parser stays framework-free;
    // a set without 'en' must reject 'en'.
    expect(
      parseContactBody({ ...VALID_MINIMAL, locale: 'en' }, ['pt'])
    ).toEqual({ kind: 'invalid' });
  });
});
