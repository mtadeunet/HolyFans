'use client';

import {useState, useEffect} from 'react';

export default function SocialProof() {
  const [currentTestimonial, setCurrentTestimonial] = useState(0);

  const testimonials = [
    {
      id: 1,
      name: 'João Silva',
      location: 'Lisbon, Portugal',
      rating: 5,
      text: 'The quality is exceptional! Worth every penny.',
      avatar: 'JD'
    },
    {
      id: 2,
      name: 'Maria Costa',
      location: 'Porto, Portugal',
      rating: 5,
      text: 'Beautiful craftsmanship and fast shipping.',
      avatar: 'MC'
    },
    {
      id: 3,
      name: 'Ana Santos',
      location: 'Faro, Portugal',
      rating: 5,
      text: 'Exceeded my expectations. Highly recommend!',
      avatar: 'AS'
    },
    {
      id: 4,
      name: 'Rui Fernandes',
      location: 'Coimbra, Portugal',
      rating: 5,
      text: 'Perfect gift for my husband. He loves it!',
      avatar: 'RF'
    },
    {
      id: 5,
      name: 'Lucia Torres',
      location: 'Madeira, Portugal',
      rating: 5,
      text: 'Outstanding quality and customer service.',
      avatar: 'LT'
    }
  ];

  const socialStats = [
    {
      number: '10K+',
      label: 'Happy Customers',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z"/>
        </svg>
      )
    },
    {
      number: '4.9/5',
      label: 'Average Rating',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
        </svg>
      )
    },
    {
      number: '50+',
      label: 'Countries',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd"/>
        </svg>
      )
    },
    {
      number: '98%',
      label: 'Satisfaction',
      icon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
        </svg>
      )
    }
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [testimonials.length]);

  const renderStars = (rating: number) => {
    return Array.from({length: 5}, (_, i) => (
      <svg
        key={i}
        className={`w-5 h-5 ${i < rating ? 'text-accent' : 'text-border'}`}
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
      </svg>
    ));
  };

  return (
    <section className="py-16 md:py-24 lg:py-32 bg-background">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-serif text-primary mb-6">
            What Our Customers Say
          </h2>
          <p className="text-lg md:text-xl text-text-secondary max-w-3xl mx-auto leading-relaxed">
            Join thousands of satisfied customers who have discovered the perfect blend of tradition and innovation
          </p>
        </div>

        {/* Social Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-20">
          {socialStats.map((stat, index) => (
            <div key={index} className="text-center space-y-3">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center mx-auto text-accent">
                {stat.icon}
              </div>
              <div className="text-3xl font-bold text-primary">{stat.number}</div>
              <div className="text-sm text-text-secondary">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Testimonials Carousel */}
        <div className="mb-20">
          <div className="max-w-4xl mx-auto">
            <div className="bg-surface rounded-2xl p-8 md:p-12 shadow-xl border-2 border-transparent hover:border-accent/30 transition-all duration-500">
              <div className="text-center space-y-6">
                {/* Stars */}
                <div className="flex justify-center space-x-1">
                  {renderStars(testimonials[currentTestimonial].rating)}
                </div>
                
                {/* Testimonial Text */}
                <blockquote className="text-xl md:text-2xl text-text-secondary leading-relaxed font-medium italic">
                  "{testimonials[currentTestimonial].text}"
                </blockquote>
                
                {/* Author */}
                <div className="flex items-center justify-center space-x-4">
                  <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center">
                    <span className="text-accent font-bold">{testimonials[currentTestimonial].avatar}</span>
                  </div>
                  <div className="text-left">
                    <div className="font-semibold text-primary">
                      {testimonials[currentTestimonial].name}
                    </div>
                    <div className="text-sm text-text-secondary">
                      {testimonials[currentTestimonial].location}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Carousel Indicators */}
            <div className="flex justify-center space-x-2 mt-8">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentTestimonial(index)}
                  className={`w-2 h-2 rounded-full transition-all duration-500 ${
                    index === currentTestimonial
                      ? 'bg-accent w-8'
                      : 'bg-border hover:bg-accent/50'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Instagram Gallery */}
        <div className="mb-20">
          <h3 className="text-2xl md:text-3xl font-serif text-primary text-center mb-12">
            Follow Us on Instagram
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Array.from({length: 8}, (_, i) => (
              <div key={i} className="relative aspect-square bg-gradient-to-br from-surface to-border rounded-xl overflow-hidden group cursor-pointer">
                <div className="absolute inset-0 bg-accent/20 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-500">
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                </div>
                <div className="absolute bottom-2 left-2 text-white text-xs">
                  @holyfans
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8">
            <button className="btn-secondary">
              Follow Us
            </button>
          </div>
        </div>

        {/* Press Mentions */}
        <div className="mb-20">
          <h3 className="text-2xl md:text-3xl font-serif text-primary text-center mb-12">
            As Seen In
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                name: 'Fashion Weekly',
                logo: 'P1',
                quote: 'Exceptional quality and design'
              },
              {
                name: 'Luxury Magazine',
                logo: 'P2',
                quote: 'The perfect blend of tradition and modernity'
              },
              {
                name: 'Style Journal',
                logo: 'P3',
                quote: 'Outstanding craftsmanship that stands out'
              }
            ].map((mention, index) => (
              <div key={index} className="bg-surface rounded-xl p-6 text-center border-2 border-transparent hover:border-accent/30 transition-all duration-500">
                <div className="w-16 h-16 bg-accent/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <span className="text-accent font-bold text-xl">{mention.logo}</span>
                </div>
                <h4 className="font-semibold text-primary mb-2">{mention.name}</h4>
                <p className="text-text-secondary text-sm italic">"{mention.quote}"</p>
              </div>
            ))}
          </div>
        </div>

        {/* Community Section */}
        <div className="bg-gradient-to-r from-primary to-accent rounded-2xl p-8 md:p-12 text-white">
          <div className="text-center space-y-6">
            <h3 className="text-2xl md:text-3xl font-serif">
              Join Our Community
            </h3>
            <p className="text-lg max-w-3xl mx-auto text-white/90">
              Be part of a growing community of enthusiasts who appreciate quality craftsmanship and timeless design
            </p>
            
            <div className="flex flex-wrap justify-center gap-4">
              <button className="bg-white text-primary px-6 py-3 rounded-lg font-semibold hover:bg-white/90 transition-colors">
                Join Now
              </button>
              <button className="bg-transparent border-2 border-white text-white px-6 py-3 rounded-lg font-semibold hover:bg-white hover:text-primary transition-all duration-500">
                #HolyFans
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
