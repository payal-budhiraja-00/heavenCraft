import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Hero = () => {
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      title: "Transform Your Workspace",
      subtitle: "Premium Ergonomic Furniture for Modern Living",
      description: "Experience comfort and productivity with our expertly designed furniture",
      image:  "/images/products/chairs/mesh-chair/4 - Neuro.jpeg",
      category: "Ergonomic Chairs"
    },
    {
      title: "Designed for Comfort",
      subtitle: "Executive Tables for Professionals",
      description: "Enhance your workspace with elegant and functional office tables",
      image: "/images/products/tables/executive-table/1 - Imperium.jpeg",
      category: "Premium Tables"
    },
    {
      title: "Work Smarter, Not Harder",
      subtitle: "Essential Workspace Accessories",
      description: "Complete your setup with ergonomic accessories for ultimate comfort",
      image: "/images/products/accessories/footrest/2 - Plus.jpeg",
      category: "Smart Accessories"
    }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  return (
    <div className="relative text-gray-900 overflow-hidden" style={{background: 'linear-gradient(135deg, #FAF8F3 0%, #F5F2E9 100%)'}}>
      <div className="container mx-auto px-4 py-16 md:py-24">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="space-y-6 animate-fade-in">
            <div className="inline-block px-4 py-2 bg-black text-[#DFA947] rounded-full text-sm font-semibold border-2 border-[#DFA947]">
              ✨ Welcome to HeavenCraft
            </div>

            <h1 className="text-4xl md:text-6xl font-bold leading-tight text-black">
              {slides[currentSlide].title}
            </h1>

            <h2 className="text-2xl md:text-3xl font-semibold text-[#DFA947]">
              {slides[currentSlide].subtitle}
            </h2>

            <p className="text-lg md:text-xl text-gray-800">
              {slides[currentSlide].description}
            </p>

            <div className="flex flex-wrap gap-4 pt-4 relative z-10">
              <Link
                to="/chairs"
                className="inline-flex items-center justify-center bg-[#DFA947] text-black px-8 py-4 rounded-lg font-semibold border-2 border-[#DFA947] hover:bg-black hover:text-[#DFA947] transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer select-none"
                style={{ pointerEvents: 'auto' }}
              >
                Shop Now
              </Link>
              <Link
                to="/about"
                className="inline-flex items-center justify-center bg-black border-2 border-[#DFA947] text-[#DFA947] px-8 py-4 rounded-lg font-semibold hover:bg-[#DFA947] hover:text-black transition-all duration-200 shadow-lg hover:shadow-xl cursor-pointer select-none"
                style={{ pointerEvents: 'auto' }}
              >
                Learn More
              </Link>
            </div>
          </div>

          {/* Animated Product Image */}
          <div className="flex items-center justify-center relative">
            <div className="relative w-full max-w-md">
              {/* Product Image Container */}
              <div className="relative aspect-square rounded-2xl overflow-hidden bg-gradient-to-br from-[#FAF8F3] to-[#F5F2E9] p-8 shadow-2xl transform transition-all duration-700 animate-float">
                <div className="absolute inset-0 bg-gradient-to-br from-[#DFA947]/10 to-transparent"></div>
                <img
                  src={slides[currentSlide].image}
                  alt={slides[currentSlide].category}
                  className="relative z-10 w-full h-full object-contain drop-shadow-2xl transition-all duration-700"
                  key={currentSlide}
                />
                {/* Category Badge */}
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-black/80 backdrop-blur-sm text-[#DFA947] px-6 py-2 rounded-full text-sm font-semibold border-2 border-[#DFA947] z-20">
                  {slides[currentSlide].category}
                </div>
              </div>
              {/* Glow Effect */}
              <div className="absolute inset-0 bg-[#DFA947]/20 blur-3xl rounded-full animate-pulse -z-10"></div>
              {/* Decorative Circles */}
              <div className="absolute -top-4 -right-4 w-24 h-24 bg-[#DFA947]/30 rounded-full blur-2xl animate-pulse"></div>
              <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-black/10 rounded-full blur-2xl animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Slide Indicators */}
        <div className="flex justify-center gap-3 mt-12">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-2 rounded-full transition-all duration-300 ${
                currentSlide === index ? 'w-8 bg-black' : 'w-2 bg-gray-400'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#DFA947]/10 rounded-full blur-3xl pointer-events-none -z-10"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-black/5 rounded-full blur-3xl pointer-events-none -z-10"></div>
    </div>
  );
};

export default Hero;

