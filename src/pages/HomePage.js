import React from 'react';
import Hero from '../components/home/Hero';
import FeaturedProducts from '../components/home/FeaturedProducts';
import WhyHeavenCraft from '../components/home/WhyHeavenCraft';
import CategoryShowcase from '../components/home/CategoryShowcase';
import AboutSection from '../components/home/AboutSection';
import Testimonials from '../components/home/Testimonials';
import CallToAction from '../components/home/CallToAction';

const HomePage = ({ products }) => {
  return (
    <div style={{background: 'linear-gradient(to bottom, #FAF8F3 0%, #F5F2E9 50%, #FAF8F3 100%)'}}>
      <Hero />
      <CategoryShowcase />
      <FeaturedProducts products={products} />
      <WhyHeavenCraft />
      <AboutSection />
      <Testimonials />
      <CallToAction />
    </div>
  );
};

export default HomePage;

