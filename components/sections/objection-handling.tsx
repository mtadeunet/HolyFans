'use client';

import {useState} from 'react';

export default function ObjectionHandling() {
  const t = (key: string) => key;
  const [expandedObjection, setExpandedObjection] = useState<number | null>(null);

  const objections = [
    {
      id: 1,
      question: t('objection1.question'),
      answer: t('objection1.answer'),
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      )
    },
    {
      id: 2,
      question: t('objection2.question'),
      answer: t('objection2.answer'),
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      )
    },
    {
      id: 3,
      question: t('objection3.question'),
      answer: t('objection3.answer'),
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      )
    },
    {
      id: 4,
      question: t('objection4.question'),
      answer: t('objection4.answer'),
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      )
    },
    {
      id: 5,
      question: t('objection5.question'),
      answer: t('objection5.answer'),
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      )
    }
  ];

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-background">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-primary mb-6">
            {t('title')}
          </h2>
          <p className="text-lg md:text-xl text-text-secondary max-w-3xl mx-auto leading-relaxed">
            {t('subtitle')}
          </p>
        </div>

        {/* Trust Banner */}
        <div className="bg-surface rounded-2xl p-8 mb-16 border-2 border-transparent hover:border-accent/30 transition-all duration-500">
          <div className="text-center space-y-4">
            <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-accent" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
              </svg>
            </div>
            <h3 className="text-2xl font-semibold text-primary">
              {t('trust_banner.title')}
            </h3>
            <p className="text-text-secondary max-w-2xl mx-auto">
              {t('trust_banner.description')}
            </p>
          </div>
        </div>

        {/* Objections Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {objections.map((objection) => (
            <div
              key={objection.id}
              className="bg-surface rounded-xl overflow-hidden border-2 border-transparent hover:border-accent/30 transition-all duration-500"
            >
              <button
                onClick={() => setExpandedObjection(
                  expandedObjection === objection.id ? null : objection.id
                )}
                className="w-full p-6 text-left flex items-start space-x-4 hover:bg-accent/5 transition-colors"
              >
                <div className="w-10 h-10 bg-accent/20 rounded-full flex items-center justify-center flex-shrink-0 text-accent">
                  {objection.icon}
                </div>
                <div className="flex-1">
                  <h4 className="text-lg font-semibold text-primary mb-2">
                    {objection.question}
                  </h4>
                  <div className={`transition-all duration-500 overflow-hidden ${
                    expandedObjection === objection.id ? 'max-h-96' : 'max-h-0'
                  }`}>
                    <p className="text-text-secondary leading-relaxed">
                      {objection.answer}
                    </p>
                  </div>
                </div>
                <div className={`transform transition-transform duration-300 ${
                  expandedObjection === objection.id ? 'rotate-180' : ''
                }`}>
                  <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
            </div>
          ))}
        </div>

        {/* Risk Reversal Section */}
        <div className="mt-20 bg-gradient-to-r from-primary to-accent rounded-2xl p-8 md:p-12 text-white">
          <div className="text-center space-y-6">
            <h3 className="text-2xl md:text-3xl font-serif">
              {t('risk_reversal.title')}
            </h3>
            <p className="text-lg max-w-3xl mx-auto leading-relaxed text-white/90">
              {t('risk_reversal.description')}
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12">
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                </div>
                <h4 className="font-semibold">{t('risk_reversal.guarantee.title')}</h4>
                <p className="text-sm text-white/80">{t('risk_reversal.guarantee.description')}</p>
              </div>
              
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                </div>
                <h4 className="font-semibold">{t('risk_reversal.quality.title')}</h4>
                <p className="text-sm text-white/80">{t('risk_reversal.quality.description')}</p>
              </div>
              
              <div className="text-center space-y-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                </div>
                <h4 className="font-semibold">{t('risk_reversal.support.title')}</h4>
                <p className="text-sm text-white/80">{t('risk_reversal.support.description')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-16 text-center">
          <h3 className="text-2xl md:text-3xl font-serif text-primary mb-6">
            {t('final_cta.title')}
          </h3>
          <p className="text-lg text-text-secondary mb-8 max-w-2xl mx-auto">
            {t('final_cta.description')}
          </p>
          <button className="btn-primary text-lg px-8 py-4 shadow-xl hover:shadow-2xl transform hover:-translate-y-1 transition-all duration-500">
            {t('final_cta.button')}
          </button>
        </div>
      </div>
    </section>
  );
}
