import React from 'react';
import { Link } from 'react-router-dom';

const CategoryShowcase = () => {

  const categories = [
    {
      id: 'chairs',
      name: 'Chairs',
      icon: 'https://cdn-icons-png.flaticon.com/512/5410/5410415.png',
      isImage: true,
      description: 'Ergonomic chairs for all-day comfort',
      count: '150+ Models'
    },
    {
      id: 'tables',
      name: 'Tables',
      icon: 'https://cdn-icons-png.flaticon.com/512/2344/2344244.png',
      isImage: true,
      description: 'Versatile desks and workstations',
      count: '200+ Models'
    },
    {
      id: 'accessories',
      name: 'Accessories',
      icon: '🔧',
      description: 'Essential workspace accessories',
      count: '100+ Products'
    }
  ];

  return (
    <div className="py-16">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
            Shop by <span className="text-[#DFA947]">Category</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Explore our carefully curated collection of ergonomic furniture and accessories
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {categories.map((category) => (
            <Link
              key={category.id}
              to={`/${category.id}`}
              className="group relative bg-white rounded-2xl p-8 overflow-hidden transform transition-all duration-300 hover:scale-105 hover:shadow-2xl border-2 border-gray-200 hover:border-[#DFA947]"
            >
              {/* Gold accent bar */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#DFA947] to-[#C89437]"></div>

              {/* Background overlay on hover */}
              <div className="absolute inset-0 bg-gradient-to-br from-[#DFA947]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>

              {/* Content */}
              <div className="relative z-10">
                <div className="text-6xl mb-4 transform group-hover:scale-110 transition-transform duration-300">
                  {category.isImage ? (
                    <img
                      src={category.icon}
                      alt={category.name}
                      className="w-16 h-16 object-contain"
                    />
                  ) : (
                    category.icon
                  )}
                </div>

                <h3 className="text-2xl font-bold mb-2 text-black group-hover:text-[#DFA947] transition-colors duration-300">
                  {category.name}
                </h3>

                <p className="text-gray-600 mb-4 leading-relaxed">
                  {category.description}
                </p>

                <div className="inline-flex items-center gap-2 bg-black text-[#DFA947] px-4 py-2 rounded-full text-sm font-semibold shadow-md group-hover:bg-[#DFA947] group-hover:text-black transition-all duration-300">
                  <span>{category.count}</span>
                  <svg className="w-4 h-4 transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>

                {/* Arrow Icon */}
                <div className="absolute bottom-8 right-8 opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all duration-300 text-[#DFA947]">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CategoryShowcase;
