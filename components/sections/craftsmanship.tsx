'use client';

import {useState} from 'react';

export default function Craftsmanship() {
  const t = (key: string) => key;
  const [activeFeature, setActiveFeature] = useState(0);

  const features = [
    {
      id: 0,
      title: t('features.premium_materials.title'),
      description: t('features.premium_materials.description'),
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      )
    },
    {
      id: 1,
      title: t('features.artistic_design.title'),
      description: t('features.artistic_design.description'),
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"/>
        </svg>
      )
    },
    {
      id: 2,
      title: t('features.embroidery.title'),
      description: t('features.embroidery.description'),
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
          <path d="M2 5a2 2 0 012-2h12a2 2 0 012 2v10a2 2 0 01-2 2H4a2 2 0 01-2-2V5zm3.293 1.293a1 1 0 011.414 0l3 3a1 1 0 010 1.414l-3 3a1 1 0 01-1.414-1.414L7.586 10 5.293 7.707a1 1 0 010-1.414zM11 12a1 1 0 100 2h3a1 1 0 100-2h-3z"/>
        </svg>
      )
    },
    {
      id: 3,
      title: t('features.metal_details.title'),
      description: t('features.metal_details.description'),
      icon: (
        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732l-3.354 1.935-1.18 4.455a1 1 0 01-1.933 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732l3.354-1.935 1.18-4.455A1 1 0 0112 2z" clipRule="evenodd"/>
        </svg>
      )
    }
  ];

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

        {/* Main Story */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center mb-20">
          <div className="space-y-6">
            <div className="prose prose-lg max-w-none">
              <p className="text-text-secondary leading-relaxed">
                {t('story.paragraph1')}
              </p>
              <p className="text-text-secondary leading-relaxed">
                {t('story.paragraph2')}
              </p>
              <p className="text-text-secondary leading-relaxed">
                {t('story.paragraph3')}
              </p>
            </div>
            
            <div className="bg-background rounded-xl p-6 border-2 border-transparent hover:border-accent/30 transition-all duration-500">
              <h3 className="text-xl font-semibold text-primary mb-3">
                {t('quality_promise.title')}
              </h3>
              <p className="text-text-secondary">
                {t('quality_promise.description')}
              </p>
            </div>
          </div>

          <div className="relative">
            {/* Placeholder for craftsmanship image */}
            <div className="relative aspect-square max-w-lg mx-auto">
              <div className="absolute inset-0 bg-gradient-to-br from-background to-border rounded-2xl shadow-2xl flex items-center justify-center">
                <div className="text-center space-y-4">
                  <div className="w-32 h-32 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                    <svg className="w-16 h-16 text-accent" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd"/>
                    </svg>
                  </div>
                  <p className="text-text-secondary">Craftsmanship Details</p>
                  <p className="text-sm text-text-secondary/60">
                    Premium materials & artistic design
                  </p>
                </div>
              </div>
              
              {/* Floating badges */}
              <div className="absolute -top-4 -right-4 w-20 h-20 bg-accent/10 rounded-full flex items-center justify-center animate-pulse">
                <span className="text-accent font-bold text-sm">HANDMADE</span>
              </div>
              <div className="absolute -bottom-4 -left-4 w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                <span className="text-primary font-bold text-xs">PREMIUM</span>
              </div>
            </div>
          </div>
        </div>

        {/* Interactive Features */}
        <div className="space-y-8">
          <h3 className="text-2xl md:text-3xl font-serif text-primary text-center">
            {t('features.title')}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature) => (
              <button
                key={feature.id}
                onClick={() => setActiveFeature(feature.id)}
                className={`p-6 rounded-xl border-2 transition-all duration-500 text-left ${
                  activeFeature === feature.id
                    ? 'border-accent bg-accent/5 shadow-lg'
                    : 'border-transparent hover:border-accent/30 bg-background'
                }`}
              >
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4 text-accent">
                  {feature.icon}
                </div>
                <h4 className="text-lg font-semibold text-primary mb-2">
                  {feature.title}
                </h4>
                <p className="text-sm text-text-secondary">
                  {feature.description}
                </p>
              </button>
            ))}
          </div>

          {/* Feature Detail Display */}
          <div className="bg-background rounded-xl p-8 border-2 border-accent/20">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center flex-shrink-0 text-accent">
                {features[activeFeature].icon}
              </div>
              <div className="flex-1">
                <h4 className="text-xl font-semibold text-primary mb-3">
                  {features[activeFeature].title}
                </h4>
                <p className="text-text-secondary leading-relaxed">
                  {features[activeFeature].description}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Process Timeline */}
        <div className="mt-20">
          <h3 className="text-2xl md:text-3xl font-serif text-primary text-center mb-12">
            {t('process.title')}
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: t('process.step1.title'),
                description: t('process.step1.description'),
                number: '01'
              },
              {
                step: t('process.step2.title'),
                description: t('process.step2.description'),
                number: '02'
              },
              {
                step: t('process.step3.title'),
                description: t('process.step3.description'),
                number: '03'
              }
            ].map((process, index) => (
              <div key={index} className="text-center space-y-4">
                <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto">
                  <span className="text-accent font-bold text-xl">{process.number}</span>
                </div>
                <h4 className="text-lg font-semibold text-primary">{process.step}</h4>
                <p className="text-sm text-text-secondary">{process.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
