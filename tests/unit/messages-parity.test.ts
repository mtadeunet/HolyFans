/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover ...
 * message-catalog parity across Locales."
 *
 * Implements ADR 00-005: Internationalization - both Locales (`pt` Primary
 * Locale and `en`) must expose identical message key trees so no string
 * renders untranslated in either Locale.
 *
 * Compares the flattened key paths of `messages/pt.json` and
 * `messages/en.json`; any key present in one catalog and missing in the
 * other fails the test.
 */
import { describe, expect, it } from 'vitest';
import pt from '@/messages/pt.json';
import en from '@/messages/en.json';

/**
 * Flatten a nested message catalog into `a.b.c` key paths.
 * @param value - The catalog object or subtree being flattened.
 * @param prefix - Accumulated key prefix for nested objects.
 * @returns Sorted array of leaf key paths.
 */
function flattenKeys(value: unknown, prefix = ''): string[] {
  if (value === null || typeof value !== 'object') {
    return prefix ? [prefix] : [];
  }
  return Object.entries(value as Record<string, unknown>).flatMap(
    ([key, child]) => flattenKeys(child, prefix ? `${prefix}.${key}` : key)
  );
}

describe('message-catalog parity', () => {
  const ptKeys = flattenKeys(pt).sort();
  const enKeys = flattenKeys(en).sort();

  it('every pt key exists in en', () => {
    const missing = ptKeys.filter((key) => !enKeys.includes(key));
    expect(missing).toEqual([]);
  });

  it('every en key exists in pt', () => {
    const missing = enKeys.filter((key) => !ptKeys.includes(key));
    expect(missing).toEqual([]);
  });
});
