/**
 * Implements ADR 00-009: WhatsApp Deep-Link Channels — Client-Resolved
 * Vendor Deep Links for Customer Messaging - "the vendor's published
 * click-to-chat / share deep-link mechanism, resolved entirely
 * client-side".
 *
 * Covers `whatsappChatUrl` (digits-only normalization, message
 * URI-encoding, fail-closed `null` on empty/invalid input) and
 * `whatsappShareUrl` (text encoding, deep-link shape). URL-parsing
 * assertions verify the deep links carry the message intact through the
 * `text` parameter and nothing else — deep links are plain navigation,
 * no tracking parameters (ADR 00-008). All numbers are synthetic
 * all-zero placeholders — no real-world identifier may enter tracked
 * files (ADR 00-007).
 */
import { describe, expect, it } from 'vitest';
import { whatsappChatUrl, whatsappShareUrl } from '@/lib/whatsapp';

/** Synthetic all-zero subscriber number — never a real identifier. */
const SYNTHETIC_NUMBER = '351000000000';

describe('whatsappChatUrl', () => {
  it('builds a click-to-chat deep link with the message URI-encoded', () => {
    expect(whatsappChatUrl(SYNTHETIC_NUMBER, 'Olá, HolyFans!')).toBe(
      `https://wa.me/351000000000?text=${encodeURIComponent('Olá, HolyFans!')}`
    );
  });

  it.each([
    '+351 000 000 000',
    '+351-000-000-000',
    '(351) 000.000.000',
    ' 351000000000 ',
    '351\t000\t000\t000',
    '351\n000\n000\n000',
  ])('normalizes %j to digits-only', (input) => {
    expect(whatsappChatUrl(input, 'hi')).toBe(
      `https://wa.me/351000000000?text=${encodeURIComponent('hi')}`
    );
  });

  it.each(['', '   ', '+', 'not-a-number', '---', '() - .'])(
    'returns null when %j carries no digits (fail-closed)',
    (input) => {
      expect(whatsappChatUrl(input, 'hi')).toBeNull();
    }
  );

  it('emits an empty text parameter when the message is empty', () => {
    expect(whatsappChatUrl(SYNTHETIC_NUMBER, '')).toBe(
      'https://wa.me/351000000000?text='
    );
  });

  it.each(['Olá!\n  Tenho   uma dúvida.', '   ', 'a'.repeat(5_000)])(
    'encodes whitespace-heavy or very long messages intact',
    (message) => {
      expect(whatsappChatUrl(SYNTHETIC_NUMBER, message)).toBe(
        `https://wa.me/351000000000?text=${encodeURIComponent(message)}`
      );
    }
  );

  it('round-trips reserved URL characters through the text parameter', () => {
    const message = 'Tamanho? A&B=C#D%';
    const url = whatsappChatUrl(SYNTHETIC_NUMBER, message);
    expect(url).not.toBeNull();
    // If &, ?, # or % were emitted unencoded, parsing would lose text.
    expect(new URL(url as string).searchParams.get('text')).toBe(message);
  });

  it('produces a plain https navigation link carrying only the text parameter', () => {
    // Deep links are plain navigation — no cookies, beacons, or tracking
    // parameters (ADR 00-008 posture per the implementation plan).
    const url = new URL(whatsappChatUrl(SYNTHETIC_NUMBER, 'hi') as string);
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('wa.me');
    expect(url.pathname).toBe(`/${SYNTHETIC_NUMBER}`);
    expect([...url.searchParams.keys()]).toEqual(['text']);
  });
});

describe('whatsappShareUrl', () => {
  it('builds a recipient-less share deep link with the text URI-encoded', () => {
    const text = 'Check out HolyFans: https://example.com/?a=1&b=2';
    expect(whatsappShareUrl(text)).toBe(
      `https://wa.me/?text=${encodeURIComponent(text)}`
    );
  });

  it('encodes an empty string without producing a recipient segment', () => {
    expect(whatsappShareUrl('')).toBe('https://wa.me/?text=');
  });

  it.each([
    'Veja: https://example.com/?a=1&b=2\n— HolyFans サイズ dúvida',
    'HolyFans '.repeat(1_000),
  ])('encodes unicode, newlines, and very long share text intact', (text) => {
    expect(whatsappShareUrl(text)).toBe(
      `https://wa.me/?text=${encodeURIComponent(text)}`
    );
  });

  it('round-trips reserved URL characters through the text parameter', () => {
    const text = 'Check: https://example.com/?x=1&y=2 #sale';
    const parsed = new URL(whatsappShareUrl(text));
    expect(parsed.searchParams.get('text')).toBe(text);
  });

  it('carries no recipient and no parameters other than text', () => {
    // The share link has no fixed recipient — the visitor picks their
    // contacts — and no tracking parameters (ADR 00-008 posture).
    const url = new URL(whatsappShareUrl('hi'));
    expect(url.protocol).toBe('https:');
    expect(url.hostname).toBe('wa.me');
    expect(url.pathname).toBe('/');
    expect([...url.searchParams.keys()]).toEqual(['text']);
  });
});
