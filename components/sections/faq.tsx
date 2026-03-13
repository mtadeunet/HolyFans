'use client';

import { useTranslations } from '@/lib/use-translations';
import { useState } from 'react';

export default function FAQ() {
  const t = useTranslations('faq');
  const [expandedCategory, setExpandedCategory] = useState<string>('general');
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);

  const categories = {
    general: {
      title: t('categories.general.title'),
      description: t('categories.general.description'),
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
        </svg>
      ),
      questions: [
        {
          id: 1,
          question: t('categories.general.questions.q1.question'),
          answer: t('categories.general.questions.q1.answer')
        },
        {
          id: 2,
          question: t('categories.general.questions.q2.question'),
          answer: t('categories.general.questions.q2.answer')
        },
        {
          id: 3,
          question: t('categories.general.questions.q3.question'),
          answer: t('categories.general.questions.q3.answer')
        }
      ]
    },
    product: {
      title: t('categories.product.title'),
      description: t('categories.product.description'),
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
        </svg>
      ),
      questions: [
        {
          id: 4,
          question: t('categories.product.questions.q1.question'),
          answer: t('categories.product.questions.q1.answer')
        },
        {
          id: 5,
          question: t('categories.product.questions.q2.question'),
          answer: t('categories.product.questions.q2.answer')
        },
        {
          id: 6,
          question: t('categories.product.questions.q3.question'),
          answer: t('categories.product.questions.q3.answer')
        }
      ]
    },
    shipping: {
      title: t('categories.shipping.title'),
      description: t('categories.shipping.description'),
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
          <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z" />
        </svg>
      ),
      questions: [
        {
          id: 7,
          question: t('categories.shipping.questions.q1.question'),
          answer: t('categories.shipping.questions.q1.answer')
        },
        {
          id: 8,
          question: t('categories.shipping.questions.q2.question'),
          answer: t('categories.shipping.questions.q2.answer')
        },
        {
          id: 9,
          question: t('categories.shipping.questions.q3.question'),
          answer: t('categories.shipping.questions.q3.answer')
        }
      ]
    }
  };

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-surface">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-primary mb-6">
            {t('title')}
          </h2>
          <p className="text-lg md:text-xl text-text-secondary max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Search Bar */}
        <div className="max-w-2xl mx-auto mb-12">
          <div className="relative">
            <input
              type="text"
              placeholder={t('search_placeholder')}
              className="w-full px-6 py-4 pl-12 bg-background border-2 border-transparent hover:border-accent/30 focus:border-accent rounded-xl transition-all duration-500 text-primary placeholder-text-secondary"
            />
            <div className="absolute left-4 top-1/2 transform -translate-y-1/2">
              <svg className="w-5 h-5 text-text-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {Object.entries(categories).map(([key, category]) => (
            <button
              key={key}
              onClick={() => setExpandedCategory(key)}
              className={`px-6 py-3 rounded-xl border-2 transition-all duration-500 flex items-center space-x-2 ${expandedCategory === key
                  ? 'border-accent bg-accent/5 shadow-lg'
                  : 'border-transparent hover:border-accent/30 bg-background'
                }`}
            >
              <div className={`w-5 h-5 rounded-full flex items-center justify-center ${expandedCategory === key ? 'text-accent' : 'text-primary'
                }`}>
                {category.icon}
              </div>
              <span className="font-medium">{category.title}</span>
            </button>
          ))}
        </div>

        {/* Active Category Description */}
        <div className="text-center mb-12">
          <p className="text-text-secondary max-w-2xl mx-auto">
            {categories[expandedCategory as keyof typeof categories].description}
          </p>
        </div>

        {/* FAQ Items */}
        <div className="max-w-4xl mx-auto space-y-4">
          {categories[expandedCategory as keyof typeof categories].questions.map((item) => (
            <div
              key={item.id}
              className="bg-background rounded-xl overflow-hidden border-2 border-transparent hover:border-accent/30 transition-all duration-500"
            >
              <button
                onClick={() => setExpandedQuestion(
                  expandedQuestion === item.id ? null : item.id
                )}
                className="w-full p-6 text-left flex items-start space-x-4 hover:bg-accent/5 transition-colors"
              >
                <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 text-accent">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-primary mb-2">
                    {item.question}
                  </h4>
                  <div className={`transition-all duration-500 overflow-hidden ${expandedQuestion === item.id ? 'max-h-96' : 'max-h-0'
                    }`}>
                    <p className="text-text-secondary leading-relaxed">
                      {item.answer}
                    </p>
                  </div>
                </div>
                <div className={`transform transition-transform duration-300 ${expandedQuestion === item.id ? 'rotate-180' : ''
                  }`}>
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* Contact Support */}
        <div className="mt-20 text-center">
          <div className="bg-gradient-to-r from-primary to-accent rounded-2xl p-8 md:p-12 text-white">
            <h3 className="text-2xl md:text-3xl font-serif mb-4">
              {t('still_have_questions.title')}
            </h3>
            <p className="text-lg mb-8 text-white/90 max-w-2xl mx-auto">
              {t('still_have_questions.description')}
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="btn-secondary bg-white text-primary hover:bg-white/90">
                {t('still_have_questions.contact_button')}
              </button>
              <button className="bg-transparent border-2 border-white text-white hover:bg-white hover:text-primary transition-all duration-500 px-8 py-4 rounded-lg font-semibold">
                {t('still_have_questions.email_button')}
              </button>
            </div>
          </div>
        </div>

        {/* Quick Links */}
        <div className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
              </svg>
            </div>
            <h4 className="font-semibold text-primary">{t('quick_links.email.title')}</h4>
            <p className="text-text-secondary text-sm">{t('quick_links.email.description')}</p>
            <a href="#" className="text-accent hover:text-accent/80 transition-colors">
              {t('quick_links.email.link')}
            </a>
          </div>

          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 20 20">
                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
              </svg>
            </div>
            <h4 className="font-semibold text-primary">{t('quick_links.phone.title')}</h4>
            <p className="text-text-secondary text-sm">{t('quick_links.phone.description')}</p>
            <a href="#" className="text-accent hover:text-accent/80 transition-colors">
              {t('quick_links.phone.link')}
            </a>
          </div>

          <div className="text-center space-y-4">
            <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-6 h-6 text-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
            </div>
            <h4 className="font-semibold text-primary">{t('quick_links.chat.title')}</h4>
            <p className="text-text-secondary text-sm">{t('quick_links.chat.description')}</p>
            <a href="#" className="text-accent hover:text-accent/80 transition-colors">
              {t('quick_links.chat.link')}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
