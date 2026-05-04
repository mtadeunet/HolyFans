import { getSiteConfig } from '@/lib/site-config';
import AdminForm from './admin-form';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const config = await getSiteConfig();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <header className="mb-8">
        <h1 className="font-serif text-3xl text-primary">HolyFans Admin</h1>
        <p className="mt-2 text-text-secondary">
          Toggle which sections and chrome elements appear on the live site.
          Changes are persisted to Vercel Edge Config.
        </p>
      </header>
      <AdminForm initial={config} />
    </main>
  );
}
