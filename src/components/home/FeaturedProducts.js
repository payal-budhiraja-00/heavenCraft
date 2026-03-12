import React, { useState, useEffect, useMemo } from 'react';
import ProductCard from '../ProductCard';

const FeaturedProducts = ({ products }) => {
  const [animatedProducts, setAnimatedProducts] = useState([]);

  // Get a diverse mix of featured products - chairs, tables, and accessories
  const featuredProducts = useMemo(() => {
    const chairs = products.filter(p => p.category === 'chair');
    const tables = products.filter(p => p.category === 'table');
    const accessories = products.filter(p => p.category === 'accessories');

    // Select top products from each category based on rating
    const topChairs = chairs.sort((a, b) => b.rating - a.rating).slice(0, 4);
    const topTables = tables.sort((a, b) => b.rating - a.rating).slice(0, 2);
    const topAccessories = accessories.sort((a, b) => b.rating - a.rating).slice(0, 2);

    // Combine and shuffle for variety
    return [...topChairs, ...topTables, ...topAccessories];
  }, [products]);

  useEffect(() => {
    // Reset animated products when featuredProducts change
    setAnimatedProducts([]);

    // Animate products one by one
    featuredProducts.forEach((_, index) => {
      setTimeout(() => {
        setAnimatedProducts(prev => [...prev, index]);
      }, index * 100);
    });
  }, [featuredProducts]);

  return (
    <div className="py-16 bg-white">
      <div className="container mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold text-black mb-4">
            Featured <span className="text-[#DFA947]">Products</span>
          </h2>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Discover our top-rated chairs, tables, and accessories - handpicked for your perfect workspace
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {featuredProducts.map((product, index) => (
            <div
              key={product.id}
              className={`transform transition-all duration-500 ${
                animatedProducts.includes(index)
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              }`}
            >
              <ProductCard product={product} />
            </div>
          ))}
        </div>

        <div className="text-center mt-12">
          <a
            href="/chairs"
            className="inline-block bg-[#DFA947] text-black px-8 py-4 rounded-lg font-semibold hover:bg-[#C89437] transition-colors duration-200 shadow-lg hover:shadow-xl"
          >
            View All Products
          </a>
        </div>
      </div>
    </div>
  );
};

export default FeaturedProducts;

