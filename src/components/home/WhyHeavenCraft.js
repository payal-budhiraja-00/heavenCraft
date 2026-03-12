import React from 'react';

const WhyHeavenCraft = () => {
  const features = [
    {
      icon: '✨',
      title: 'Premium Quality',
      description: 'Every product is crafted with the finest materials and attention to detail, ensuring long-lasting durability and comfort.'
    },
    {
      icon: '🏥',
      title: 'Ergonomic Design',
      description: 'Scientifically designed furniture that supports your body, reduces strain, and promotes better posture and health.'
    },
    {
      icon: '🎨',
      title: 'Modern Aesthetics',
      description: 'Beautiful designs that complement any workspace, from home offices to corporate environments.'
    },
    {
      icon: '💰',
      title: 'Great Value',
      description: 'Competitive pricing without compromising on quality. Get premium furniture at accessible prices.'
    },
    {
      icon: '🚚',
      title: 'Fast Delivery',
      description: 'Quick and reliable nationwide delivery service. Get your furniture delivered right to your doorstep.'
    },
    {
      icon: '🛡️',
      title: 'Quality Guarantee',
      description: 'All our products come with warranty coverage and dedicated customer support for peace of mind.'
    }
  ];

  return (
    <div className="py-16 bg-gray-50">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
            Why Choose <span className="text-[#DFA947]">HeavenCraft</span>?
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            We're committed to providing the best ergonomic furniture solutions with exceptional service
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <div
              key={index}
              className="bg-white rounded-xl p-8 hover:shadow-2xl border-2 border-gray-200 hover:border-[#DFA947] transition-all duration-300 group"
            >
              <div className="text-5xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                {feature.icon}
              </div>
              <h3 className="text-xl font-bold text-gray-900 group-hover:text-[#DFA947] mb-3 transition-colors duration-300">
                {feature.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">
                {feature.description}
              </p>
            </div>
          ))}
        </div>

        {/* Stats Section */}
        <div className="mt-16 bg-gradient-to-r from-black to-gray-900 rounded-2xl p-8 md:p-12 text-white shadow-xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2 text-[#DFA947]">10K+</div>
              <div className="text-gray-300">Happy Customers</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2 text-white">500+</div>
              <div className="text-gray-300">Products</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2 text-white">50+</div>
              <div className="text-gray-300">Cities Served</div>
            </div>
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2 text-[#DFA947]">4.8★</div>
              <div className="text-gray-300">Average Rating</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhyHeavenCraft;

