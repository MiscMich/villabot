'use client';

import {
  Navbar,
  Hero,
  TrustBadges,
  FeaturesBento,
  PricingCards,
  Testimonials,
  CTASection,
  Footer,
} from '@/components/landing';

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <main className="overflow-hidden">
        <Hero />
        <TrustBadges />
        <FeaturesBento />
        <PricingCards />
        <Testimonials />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
