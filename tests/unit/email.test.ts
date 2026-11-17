/**
 * Implements ADR 00-007: Quality Tooling and CI - "Unit tests cover logic
 * with real behavior."
 *
 * Implements ADR 00-013: Email Delivery Channel — "The client is lazy and
 * fail-closed like the managed-store client: unconfigured → every
 * dependent surface degrades to its graceful-unavailable state and no
 * send is attempted." and "Four environment variables configure the
 * channel: `ZEPTOMAIL_TOKEN` ..., `ZEPTOMAIL_API_BASE` ..., `EMAIL_FROM`
 * ..., and `OPERATOR_INBOX`".
 *
 * Covers `lib/email.ts`: `getEmailConfig` fails closed when any one of
 * the four variables is unset/blank and memoizes its first resolution;
 * `buildZeptoMailPayload` produces the provider's `/v1.1/email` shape
 * (`from`/`to`/`reply_to`/`subject`/`textbody`/`htmlbody`); `sendEmail`
 * returns `true` only on a provider 2xx and `false` on unconfigured,
 * non-2xx, or a transport throw — never logging recipient content.
 *
 * The config is memoized module state, so each case resets the module
 * registry and stubs env before a dynamic import — the same env-first
 * ordering the memoization contract requires.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { SendEmailInput } from '@/lib/email';

const FULL_ENV = {
  ZEPTOMAIL_TOKEN: 'zoho-mail-agent-token',
  ZEPTOMAIL_API_BASE: 'https://api.zeptomail.example.test/',
  EMAIL_FROM: 'store@example.test',
  OPERATOR_INBOX: 'ops@example.test',
} as const;

const SEND_INPUT: SendEmailInput = {
  to: 'user@example.test',
  toName: 'Example User',
  replyTo: 'ops@example.test',
  subject: 'Synthetic subject',
  text: 'Synthetic plain-text body',
  html: '<p>Synthetic HTML body</p>',
};

/**
 * Stub the channel env and import a fresh `lib/email` — `getEmailConfig`
 * memoizes on first call, so the env must be in place before the module
 * resolves (and each case needs its own module instance).
 *
 * @param env - Partial env overrides; `undefined` deletes the variable.
 * @returns The freshly imported module.
 */
async function importEmailModule(
  env: Partial<Record<keyof typeof FULL_ENV, string | undefined>> = {}
) {
  vi.resetModules();
  for (const key of Object.keys(FULL_ENV) as (keyof typeof FULL_ENV)[]) {
    const value = key in env ? env[key] : FULL_ENV[key];
    vi.stubEnv(key, value as string | undefined);
  }
  return import('@/lib/email');
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('getEmailConfig', () => {
  it('resolves the full configuration and joins the send URL on the API base', async () => {
    const { getEmailConfig } = await importEmailModule();
    expect(getEmailConfig()).toEqual({
      sendUrl: 'https://api.zeptomail.example.test/v1.1/email',
      token: 'zoho-mail-agent-token',
      from: 'store@example.test',
      operatorInbox: 'ops@example.test',
    });
  });

  it.each(Object.keys(FULL_ENV) as (keyof typeof FULL_ENV)[])(
    'fails closed (null) when %s is unset — ADR 00-013',
    async (missing) => {
      const { getEmailConfig } = await importEmailModule({
        [missing]: undefined,
      });
      expect(getEmailConfig()).toBeNull();
    }
  );

  it.each(Object.keys(FULL_ENV) as (keyof typeof FULL_ENV)[])(
    'fails closed (null) when %s is blank whitespace',
    async (blank) => {
      const { getEmailConfig } = await importEmailModule({ [blank]: '   ' });
      expect(getEmailConfig()).toBeNull();
    }
  );

  it('memoizes a resolved config — later env changes do not leak in', async () => {
    const { getEmailConfig } = await importEmailModule();
    const resolved = getEmailConfig();
    expect(resolved).not.toBeNull();
    vi.stubEnv('ZEPTOMAIL_TOKEN', undefined);
    expect(getEmailConfig()).toBe(resolved);
  });

  it('memoizes the fail-closed null — later env does not reopen the channel', async () => {
    const { getEmailConfig } = await importEmailModule({
      ZEPTOMAIL_TOKEN: undefined,
    });
    expect(getEmailConfig()).toBeNull();
    vi.stubEnv('ZEPTOMAIL_TOKEN', FULL_ENV.ZEPTOMAIL_TOKEN);
    expect(getEmailConfig()).toBeNull();
  });
});

describe('buildZeptoMailPayload', () => {
  it('builds the provider shape: from/to/subject/textbody/htmlbody/reply_to', async () => {
    const { buildZeptoMailPayload } = await importEmailModule();
    expect(buildZeptoMailPayload(SEND_INPUT, 'store@example.test')).toEqual({
      from: { address: 'store@example.test' },
      to: [
        {
          email_address: {
            address: 'user@example.test',
            name: 'Example User',
          },
        },
      ],
      reply_to: [{ address: 'ops@example.test' }],
      subject: 'Synthetic subject',
      textbody: 'Synthetic plain-text body',
      htmlbody: '<p>Synthetic HTML body</p>',
    });
  });

  it('omits toName, reply_to, and htmlbody when the input does not carry them', async () => {
    const { buildZeptoMailPayload } = await importEmailModule();
    const payload = buildZeptoMailPayload(
      { to: 'user@example.test', subject: 's', text: 't' },
      'store@example.test'
    );
    expect(payload.to[0].email_address).toEqual({
      address: 'user@example.test',
    });
    expect(payload).not.toHaveProperty('reply_to');
    expect(payload).not.toHaveProperty('htmlbody');
  });
});

describe('sendEmail', () => {
  it('posts the payload to the provider with the Mail Agent token and resolves true on 2xx', async () => {
    const { sendEmail } = await importEmailModule();
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendEmail(SEND_INPUT)).resolves.toBe(true);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.zeptomail.example.test/v1.1/email');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      Authorization: 'Zoho-enczapikey zoho-mail-agent-token',
      'Content-Type': 'application/json',
    });
    expect(JSON.parse(init.body as string)).toMatchObject({
      from: { address: 'store@example.test' },
      subject: 'Synthetic subject',
    });
  });

  it('returns false without attempting a send when the channel is unconfigured — fail-closed (ADR 00-013)', async () => {
    const { sendEmail } = await importEmailModule({
      OPERATOR_INBOX: undefined,
    });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(sendEmail(SEND_INPUT)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([400, 500])(
    'returns false when the provider answers HTTP %i',
    async (status) => {
      const { sendEmail } = await importEmailModule();
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('{}', { status }))
      );
      await expect(sendEmail(SEND_INPUT)).resolves.toBe(false);
    }
  );

  it('returns false when the transport throws', async () => {
    const { sendEmail } = await importEmailModule();
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('network down'))
    );
    await expect(sendEmail(SEND_INPUT)).resolves.toBe(false);
  });
});
