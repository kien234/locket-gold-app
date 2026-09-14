export interface FeatureItem {
  id: string;
  icon: string;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  badge?: string;
  color: 'pink' | 'gold' | 'lavender' | 'sky';
}

export interface PricingPackage {
  id: string;
  name: string;
  priceVnd: string;
  priceUsd: string;
  periodVnd: string;
  periodEn: string;
  description: string;
  descriptionEn: string;
  popular?: boolean;
  ribbonText?: string;
  features: string[];
  featuresEn: string[];
  ctaText: string;
  ctaTextEn: string;
  badgeIcon: string;
}

export interface StepItem {
  number: number;
  title: string;
  titleEn: string;
  description: string;
  descriptionEn: string;
  icon: string;
}

export interface Testimonial {
  id: string;
  name: string;
  handle: string;
  avatar: string;
  rating: number;
  comment: string;
  commentEn: string;
  tag: string;
}

export interface FAQItem {
  id: string;
  question: string;
  questionEn?: string;
  answer: string;
  answerEn?: string;
  category: 'activation' | 'security' | 'pricing' | 'support';
}
