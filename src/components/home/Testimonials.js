import React from 'react';

const Testimonials = () => {
  const testimonials = [
    {
      name: 'Rajesh Kumar',
      role: 'IT Professional',
      image: '👨‍💼',
      rating: 5,
      text: 'The ergonomic chair I purchased from HeavenCraft has completely transformed my work-from-home experience. No more back pain after long hours!'
    },
    {
      name: 'Priya Sharma',
      role: 'Entrepreneur',
      image: '👩‍💼',
      rating: 5,
      text: 'Outstanding quality and excellent customer service. The height-adjustable desk is exactly what my home office needed. Highly recommended!'
    },
    {
      name: 'Amit Patel',
      role: 'Designer',
      image: '👨‍🎨',
      rating: 5,
      text: 'I love the modern design and functionality. The mesh chair is incredibly comfortable, and the delivery was prompt. Great experience overall!'
    },
    {
      name: 'Sneha Reddy',
      role: 'HR Manager',
      image: '👩‍💻',
      rating: 5,
      text: 'We furnished our entire office with HeavenCraft products. The team loves the ergonomic chairs, and productivity has noticeably improved!'
    }
  ];

  return (
    <div className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
            What Our <span className="text-[#DFA947]">Customers</span> Say
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Join thousands of satisfied customers who have transformed their workspaces
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-6 hover:shadow-2xl transition-all duration-300 border-2 border-gray-200 hover:border-[#DFA947]"
            >
              {/* Rating */}
              <div className="flex gap-1 mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <svg
                    key={i}
                    className="w-5 h-5 text-[#DFA947]"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>

              {/* Testimonial Text */}
              <p className="text-gray-700 mb-6 leading-relaxed">
                "{testimonial.text}"
              </p>

              {/* Customer Info */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <div className="text-3xl">{testimonial.image}</div>
                <div>
                  <div className="font-semibold text-gray-900">{testimonial.name}</div>
                  <div className="text-sm text-gray-600">{testimonial.role}</div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Trust Badges */}
        <div className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          <div>
            <div className="text-3xl mb-2">✅</div>
            <div className="font-semibold text-gray-900">Quality Assured</div>
          </div>
          <div>
            <div className="text-3xl mb-2">🔒</div>
            <div className="font-semibold text-gray-900">Secure Shopping</div>
          </div>
          <div>
            <div className="text-3xl mb-2">🚚</div>
            <div className="font-semibold text-gray-900">Fast Delivery</div>
          </div>
          <div>
            <div className="text-3xl mb-2">💬</div>
            <div className="font-semibold text-gray-900">24/7 Support</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Testimonials;

