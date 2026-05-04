import type { ReactNode } from 'react';
import '../[locale]/globals.css';

export const metadata = {
  title: 'HolyFans Admin',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-background text-text-primary">
          {children}
        </div>
      </body>
    </html>
  );
}
