import React from 'react';
import { Link } from 'react-router-dom';

const AboutSection = () => {
  return (
    <div className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Content */}
          <div className="space-y-6">
            <div className="inline-block px-4 py-2 bg-[#DFA947] text-black rounded-full text-sm font-semibold">
              About HeavenCraft
            </div>

            <h2 className="text-3xl md:text-4xl font-bold text-black">
              Transforming Workspaces, Enhancing Lives
            </h2>

            <p className="text-lg text-gray-600 leading-relaxed">
              At HeavenCraft, we believe that great furniture is more than just functional—it's
              an investment in your health, productivity, and well-being. Since our inception,
              we've been dedicated to designing and delivering premium ergonomic furniture that
              makes a real difference in people's lives.
            </p>

            <p className="text-lg text-gray-600 leading-relaxed">
              Our carefully curated collection combines cutting-edge ergonomic design with
              modern aesthetics, ensuring that your workspace is not only comfortable but also
              inspiring. From home offices to corporate environments, we provide solutions that
              help you work better and feel better.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-[#DFA947] rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700 font-medium">Certified Ergonomic Designs</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-[#DFA947] rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700 font-medium">Premium Materials & Construction</span>
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-6 h-6 bg-[#DFA947] rounded-full flex items-center justify-center">
                  <svg className="w-4 h-4 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <span className="text-gray-700 font-medium">Nationwide Delivery & Support</span>
              </div>
            </div>

            <div className="pt-4">
              <Link
                to="/about"
                className="inline-block bg-[#DFA947] text-black px-8 py-4 rounded-lg font-semibold hover:bg-[#C89437] transition-colors duration-200 shadow-lg"
              >
                Learn More About Us
              </Link>
            </div>
          </div>

          {/* Image/Visual */}
          <div className="relative">
            <div className="rounded-2xl p-12" style={{background: 'linear-gradient(135deg, #FAF8F3, #F5F2E9)'}}>
              <div className="space-y-8">
                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border-2 border-[#DFA947]/30 shadow-md hover:shadow-xl transition-shadow">
                  <div className="text-4xl mb-3">🎯</div>
                  <h3 className="text-xl font-bold mb-2 text-[#DFA947]">Our Mission</h3>
                  <p className="text-gray-800">
                    To provide ergonomic furniture solutions that enhance comfort and productivity
                  </p>
                </div>

                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border-2 border-[#4A9EE0]/30 shadow-md hover:shadow-xl transition-shadow">
                  <div className="text-4xl mb-3">👁️</div>
                  <h3 className="text-xl font-bold mb-2 text-[#4A9EE0]">Our Vision</h3>
                  <p className="text-gray-800">
                    To be the leading provider of innovative ergonomic furniture in India
                  </p>
                </div>

                <div className="bg-white/70 backdrop-blur-sm rounded-xl p-6 border-2 border-[#A855F7]/30 shadow-md hover:shadow-xl transition-shadow">
                  <div className="text-4xl mb-3">💎</div>
                  <h3 className="text-xl font-bold mb-2 text-[#A855F7]">Our Values</h3>
                  <p className="text-gray-800">
                    Quality, innovation, customer satisfaction, and sustainability
                  </p>
                </div>
              </div>
            </div>

            {/* Decorative Elements */}
            <div className="absolute -top-4 -right-4 w-24 h-24 bg-[#DFA947]/20 rounded-full blur-2xl"></div>
            <div className="absolute -bottom-4 -left-4 w-32 h-32 bg-[#DFA947]/20 rounded-full blur-2xl"></div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AboutSection;

