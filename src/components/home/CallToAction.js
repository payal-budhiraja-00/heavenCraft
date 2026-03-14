import React from 'react';
import { Link } from 'react-router-dom';

const CallToAction = () => {
  return (
    <div className="py-16" style={{background: 'linear-gradient(135deg, #FAF8F3 0%, #F5F2E9 100%)'}}>
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-5xl font-bold mb-6 text-black">
            Ready to Transform Your <span className="text-[#DFA947]">Workspace</span>?
          </h2>
          <p className="text-xl md:text-2xl text-gray-600 mb-8">
            Discover the perfect ergonomic furniture for your needs.
            Start shopping today and experience the <span className="font-semibold text-[#DFA947]">HeavenCraft</span> difference.
          </p>

          <div className="flex flex-wrap justify-center gap-4 mb-12">
            <Link
              to="/chairs"
              className="bg-[#DFA947] text-black px-8 py-4 rounded-lg font-semibold hover:bg-[#C89437] transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Shop Chairs
            </Link>
            <Link
              to="/tables"
              className="bg-black text-white px-8 py-4 rounded-lg font-semibold hover:bg-gray-800 transition-all duration-200 shadow-lg hover:shadow-xl transform hover:-translate-y-1"
            >
              Shop Tables
            </Link>
            <Link
              to="/accessories"
              className="bg-white border-2 border-[#DFA947] text-[#DFA947] px-8 py-4 rounded-lg font-semibold hover:bg-[#DFA947] hover:text-black transition-all duration-200 shadow-md"
            >
              Browse Accessories
            </Link>
          </div>

          {/* Contact Info */}
          <div className="bg-white border-2 border-[#DFA947]/40 rounded-xl p-8 max-w-2xl mx-auto shadow-xl">
            <h3 className="text-2xl font-bold mb-4 text-black">Need Help <span className="text-[#DFA947]">Choosing</span>?</h3>
            <p className="text-gray-600 mb-6">
              Our team is here to help you find the perfect furniture solution for your workspace.
            </p>
            <div className="flex flex-wrap justify-center gap-6">
              <a
                href="mailto:heavencraft09@gmail.com"
                className="flex items-center gap-2 text-gray-900 hover:text-[#DFA947] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                <span className="font-medium">heavencraft09@gmail.com</span>
              </a>
              <Link
                to="/contact"
                className="flex items-center gap-2 text-gray-900 hover:text-[#DFA947] transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                <span className="font-medium">Contact Us</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CallToAction;

