'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

/**
 * Implements ADR 03-002: Landing Page Composition — Three-Column Feed
 * Shell with Simplified Purchase Surface - the `post-faq` feed unit's
 * card body embeds "a condensed FAQ Island ... reusing the existing
 * `faq` message namespace."
 *
 * A compact expandable list carrying the first question of each FAQ
 * category. The questions/answers come from the existing `faq.*`
 * catalog keys; only the list chrome uses the `feed.faq` namespace.
 */
const FAQ_ITEMS = [
  {
    question: 'categories.general.questions.q1.question',
    answer: 'categories.general.questions.q1.answer',
  },
  {
    question: 'categories.product.questions.q1.question',
    answer: 'categories.product.questions.q1.answer',
  },
  {
    question: 'categories.shipping.questions.q1.question',
    answer: 'categories.shipping.questions.q1.answer',
  },
] as const;

export default function FeedFaq() {
  const tFaq = useTranslations('faq');
  const tFeed = useTranslations('feed.faq');
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <div className="px-4 pb-4">
      <h3 className="text-base font-semibold text-text-primary mb-2">
        {tFeed('title')}
      </h3>
      <ul className="divide-y divide-border rounded-xl border border-border">
        {FAQ_ITEMS.map((item, index) => {
          const isOpen = expanded === index;
          return (
            <li key={index}>
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : index)}
                aria-expanded={isOpen}
                aria-label={isOpen ? tFeed('collapse') : tFeed('expand')}
                className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="text-sm font-medium text-text-primary">
                  {tFaq(item.question)}
                </span>
                <svg
                  className={`mt-0.5 h-4 w-4 flex-shrink-0 text-text-secondary transition-transform duration-300 ${
                    isOpen ? 'rotate-180' : ''
                  }`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 9l-7 7-7-7"
                  />
                </svg>
              </button>
              <div
                className={`overflow-hidden transition-all duration-500 ${
                  isOpen ? 'max-h-96' : 'max-h-0'
                }`}
              >
                <p className="px-4 pb-3 text-sm leading-relaxed text-text-secondary">
                  {tFaq(item.answer)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
