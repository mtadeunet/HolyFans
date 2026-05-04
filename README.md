# HolyFans - Faith-Based Clothing E-Commerce

A modern e-commerce platform for faith-based clothing, built with Next.js 14 and featuring complete internationalization support.

## 🚀 Features

- **Modern Tech Stack**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Internationalization**: Complete Portuguese and English language support with next-intl
- **E-Commerce**: Full shopping cart and checkout functionality
- **Responsive Design**: Mobile-first design with Tailwind CSS
- **Component Architecture**: Modular, reusable React components
- **Type Safety**: Full TypeScript implementation

## 🛠️ Technical Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Internationalization**: next-intl
- **State Management**: React Context API
- **Build Tool**: Turbopack

## 🌍 Languages

- **Portuguese (pt)** - Default locale
- **English (en)** - Full translation support

## 📦 Installation

```bash
npm install
```

## 🚀 Getting Started

```bash
# Development
npm run dev

# Production
npm run build
npm start
```

## 📁 Project Structure

```
├── app/[locale]/           # Internationalized pages
├── components/             # Reusable React components
├── lib/                   # Utilities and configuration
├── messages/               # Translation files
└── public/                 # Static assets
```

## 🎯 Key Features

### Shopping Cart
- Add/remove items
- Quantity management
- Price calculation
- Empty state handling

### Checkout Process
- Multi-step checkout flow
- Form validation
- Payment integration ready
- Order confirmation

### Internationalization
- Complete Portuguese translations
- Complete English translations
- Locale-based routing
- Language toggle functionality

### Responsive Design
- Mobile-first approach
- Tablet and desktop optimizations
- Touch-friendly interactions

## 🔧 Configuration

The project is configured with:
- Portuguese as default locale
- Automatic locale detection
- Cache control headers
- TypeScript strict mode
- Tailwind CSS optimization

## � Admin & Site Toggles

A password-protected `/admin` page lets you enable/disable homepage sections
and global chrome (header, footer, mobile sticky CTA, premium features modal)
without redeploying. State is stored in **Vercel Edge Config**.

### Setup

1. In the Vercel dashboard, create an **Edge Config** store and connect it to
   this project. Vercel will inject the `EDGE_CONFIG` connection string
   automatically.
2. Create a personal/team API token with Edge Config write scope.
3. Set the following env vars on the project:

   | Variable                 | Purpose                                                       |
   | ------------------------ | ------------------------------------------------------------- |
   | `EDGE_CONFIG`            | Auto-injected connection string (read access).                |
   | `VERCEL_EDGE_CONFIG_ID`  | Bare id (`ecfg_...`) used for REST writes.                    |
   | `VERCEL_API_TOKEN`       | Token used by the admin UI to PATCH the Edge Config.          |
   | `VERCEL_TEAM_ID`         | Only required when the Edge Config lives under a team.        |
   | `ADMIN_PASSWORD`         | Password for `/admin` (basic auth, any username is accepted). |

4. Visit `/admin`, authenticate, toggle sections, Save.

5. For `/qrcoderedirect`, store the destination URL at
   `siteConfig.sections.qrcoderedirect` in the Edge Config JSON payload.

Missing/invalid config falls back to all sections enabled. The admin route is
excluded from indexing and gated by middleware basic auth.

## �📱 Browser Support

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License.
