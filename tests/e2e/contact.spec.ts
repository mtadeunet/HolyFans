/**
 * Implements ADR 03-002: Landing Page Composition — the Contact Page is
 * composed inside the Feed Shell: "the Feed Surface carries the Contact
 * Form while the Nav Rail and the mobile bottom band persist."
 *
 * Implements ADR 00-014: Contact Channel — "a **Contact Page inside the
 * Feed Shell** carrying a **Contact Form**", "The shell's `contact`
 * navigation entry becomes an internal Locale-routed link to the
 * Contact Page and is always rendered", "States are localized: idle,
 * sending, sent (an in-page confirmation), and a graceful unavailable
 * state", and "a honeypot field invisible to humans". Gate posture:
 * "it is NOT behind the Purchase-Surface Gate and must work
 * pre-launch" — so this spec runs on the `storefront` project where the
 * gate is closed.
 *
 * The Route Handler is stubbed at the network boundary (`page.route`)
 * so the sent and unavailable states are exercised deterministically
 * without a delivery-channel credential — the same convention
 * `feed.spec.ts` uses for the like toggle.
 */
import { expect, test, type Page } from '@playwright/test';

/** The Contact Form Island inside the Feed Surface. */
const form = (page: Page) =>
  page
    .locator('form')
    .filter({ has: page.locator('textarea[name="message"]') });
/** The shell's contact navigation entry (aria-labeled Nav Link). */
const contactNavLink = (page: Page, label: string) =>
  page.locator(`a[aria-label="${label}"]`);

const COPY = {
  pt: {
    navLabel: 'Contacto',
    heading: 'Fale connosco',
    consent: 'usados apenas para responder a este contacto',
    sent: 'Mensagem enviada',
    unavailable: 'Não foi possível enviar a sua mensagem',
  },
  en: {
    navLabel: 'Contact',
    heading: 'Contact us',
    consent: 'used only to answer this inquiry',
    sent: 'Message sent',
    unavailable: "Couldn't send your message",
  },
} as const;

test.describe('Contact Page — shell composition (ADR 00-014)', () => {
  for (const locale of ['pt', 'en'] as const) {
    const copy = COPY[locale];

    test(`/${locale}/contact renders the Contact Form inside the Feed Shell`, async ({
      page,
    }) => {
      await page.goto(`/${locale}/contact`);

      // The form is the Feed Surface occupant: localized heading, the
      // required email + message fields, the consent line, submit.
      await expect(
        page.getByRole('heading', { name: copy.heading })
      ).toBeVisible();
      await expect(form(page).locator('input[name="email"]')).toBeVisible();
      await expect(
        form(page).locator('textarea[name="message"]')
      ).toBeVisible();
      await expect(form(page).locator('button[type="submit"]')).toBeVisible();
      await expect(page.getByText(copy.consent)).toBeVisible();

      // The honeypot exists in the DOM but is invisible to humans:
      // positioned off the viewport's left edge, off the tab order,
      // inside an aria-hidden wrapper (ADR 00-014).
      const honeypot = form(page).locator('input[name="website"]');
      await expect(honeypot).toBeAttached();
      await expect(honeypot).toHaveAttribute('tabindex', '-1');
      await expect(honeypot.locator('xpath=..')).toHaveAttribute(
        'aria-hidden',
        'true'
      );
      const box = await honeypot.boundingBox();
      expect(box).not.toBeNull();
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(0);

      // The shell's navigation persists on the contact route: the
      // contact entry is an internal Locale-routed link to /contact.
      const navLink = contactNavLink(page, copy.navLabel).first();
      await expect(navLink).toBeVisible();
      await expect(navLink).toHaveAttribute('href', `/${locale}/contact`);
    });

    test(`the shell nav contact entry routes /${locale} → /${locale}/contact`, async ({
      page,
    }) => {
      await page.goto(`/${locale}`);
      const navLink = contactNavLink(page, copy.navLabel).first();
      await expect(navLink).toBeVisible();
      await expect(navLink).toHaveAttribute('href', `/${locale}/contact`);
      await navLink.click();
      await page.waitForURL(`**/${locale}/contact`);
      await expect(
        page.getByRole('heading', { name: copy.heading })
      ).toBeVisible();
    });
  }
});

test.describe('Contact Form — submit states (ADR 00-014)', () => {
  test('a successful relay shows the in-page sent confirmation', async ({
    page,
  }) => {
    let postedBody: Record<string, unknown> | undefined;
    await page.route('**/api/contact', (route, request) => {
      postedBody = request.postDataJSON() as Record<string, unknown>;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true }),
      });
    });

    await page.goto('/en/contact');
    await form(page).locator('input[name="name"]').fill('Example Visitor');
    await form(page).locator('input[name="email"]').fill('user@example.test');
    await form(page)
      .locator('textarea[name="message"]')
      .fill('A synthetic question about an order.');
    await form(page).locator('button[type="submit"]').click();

    // Sent state (ADR 00-014): "an in-page confirmation" replaces the
    // form — the delivered email is the only record.
    await expect(
      page.getByRole('status').filter({ hasText: COPY.en.sent })
    ).toBeVisible();
    await expect(form(page)).toHaveCount(0);

    // The Island POSTs the fields plus the visitor Locale and the
    // (empty) honeypot to the Route Handler.
    expect(postedBody).toMatchObject({
      name: 'Example Visitor',
      email: 'user@example.test',
      message: 'A synthetic question about an order.',
      locale: 'en',
      website: '',
    });
  });

  test('a provider failure shows the graceful unavailable state', async ({
    page,
  }) => {
    await page.route('**/api/contact', (route) =>
      route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'contact_unavailable' }),
      })
    );

    await page.goto('/en/contact');
    await form(page).locator('input[name="email"]').fill('user@example.test');
    await form(page)
      .locator('textarea[name="message"]')
      .fill('A synthetic question about an order.');
    await form(page).locator('button[type="submit"]').click();

    // The unavailable state is honest — a visible alert, never a fake
    // success (ADR 00-014's graceful unavailable state).
    await expect(
      page.getByRole('alert').filter({ hasText: COPY.en.unavailable })
    ).toBeVisible();
  });
});
