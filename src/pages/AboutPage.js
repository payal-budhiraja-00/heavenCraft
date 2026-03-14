import React from 'react';

const AboutPage = () => {
  return (
    <div className="py-16" style={{background: 'linear-gradient(to bottom, #FAF8F3 0%, #F5F2E9 50%, #FAF8F3 100%)'}}>
      <div className="container mx-auto px-4">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold text-black mb-4">
            About <span className="text-[#DFA947]">HeavenCraft</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Transforming workspaces with premium ergonomic furniture designed for comfort,
            productivity, and style.
          </p>
        </div>

        {/* Story Section */}
        <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12 mb-12">
          <h2 className="text-3xl font-bold text-black mb-6">Our <span className="text-[#DFA947]">Story</span></h2>
          <div className="space-y-4 text-gray-700 leading-relaxed">
            <p>
              Founded with a vision to revolutionize the way people experience their workspaces,
              HeavenCraft has been at the forefront of ergonomic furniture design since its inception.
              We believe that great furniture isn't just about aesthetics—it's about creating an
              environment where people can thrive.
            </p>
            <p>
              Our journey began when our founders realized that many people spend over 8 hours a day
              at their desks, often in uncomfortable conditions that affect their health and productivity.
              This sparked a mission to design and deliver furniture that combines ergonomic excellence
              with stunning design.
            </p>
            <p>
              Today, HeavenCraft serves thousands of satisfied customers, from home offices to corporate
              enterprises, helping them create workspaces that inspire productivity and promote wellbeing.
            </p>
          </div>
        </div>

        {/* Values Section */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="text-5xl mb-4">🎯</div>
            <h3 className="text-2xl font-bold text-black mb-3">Our Mission</h3>
            <p className="text-gray-600">
              To provide ergonomic furniture solutions that enhance comfort, boost productivity,
              and improve the overall quality of work life.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="text-5xl mb-4">👁️</div>
            <h3 className="text-2xl font-bold text-black mb-3">Our Vision</h3>
            <p className="text-gray-600">
              To be the leading provider of innovative ergonomic furniture, making healthy
              workspaces accessible to everyone.
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-8 text-center">
            <div className="text-5xl mb-4">💎</div>
            <h3 className="text-2xl font-bold text-black mb-3">Our Values</h3>
            <p className="text-gray-600">
              Quality, innovation, customer satisfaction, and sustainability guide everything
              we do at HeavenCraft.
            </p>
          </div>
        </div>

        {/* Statistics Section */}
        <div className="bg-gradient-to-r from-black to-gray-900 rounded-2xl shadow-xl p-8 md:p-12 mb-12">
          <h2 className="text-3xl font-bold text-center mb-12 text-[#DFA947]">HeavenCraft by the Numbers</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-4xl md:text-5xl font-bold mb-2 text-white">10K+</div>
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
              <div className="text-gray-300">Customer Rating</div>
            </div>
          </div>
        </div>

        {/* Team Section */}
        <div className="text-center">
          <h2 className="text-3xl font-bold text-black mb-4">Our <span className="text-[#DFA947]">Commitment</span></h2>
          <p className="text-gray-600 max-w-3xl mx-auto mb-8">
            At HeavenCraft, we're committed to delivering exceptional products and service.
            Every piece of furniture is carefully crafted and tested to meet the highest standards
            of quality and ergonomics. Our dedicated team is always here to help you find the
            perfect furniture solution for your needs.
          </p>
          <a
            href="mailto:heavencraft09@gmail.com"
            className="inline-block bg-[#DFA947] text-black px-8 py-4 rounded-lg font-semibold hover:bg-[#C89437] transition-colors duration-200 shadow-lg"
          >
            Get in Touch
          </a>
        </div>
      </div>
    </div>
  );
};

export default AboutPage;

