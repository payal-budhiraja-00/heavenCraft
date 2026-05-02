import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import ProductCard from './ProductCard';
import { getCategoryById } from '../data/categories';

const CategoryPage = ({ products }) => {
  const location = useLocation();
  const pathCategory = location.pathname.substring(1); // Remove leading '/'

  // Map plural URLs to singular category IDs
  const categoryMap = {
    'chairs': 'chair',
    'tables': 'table',
    'accessories': 'accessories'
  };

  const category = categoryMap[pathCategory] || pathCategory;
  const [selectedSubcategory, setSelectedSubcategory] = useState('all');
  const [sortBy, setSortBy] = useState('featured');

  useEffect(() => {
    window.scrollTo(0, 0);
    setSelectedSubcategory('all');
  }, [category]);

  const categoryData = getCategoryById(category);

  // Filter products by category
  const categoryProducts = products.filter(product => product.category === category);

  // Further filter by subcategory if one is selected
  let filteredProducts = selectedSubcategory === 'all'
    ? categoryProducts
    : categoryProducts.filter(product => product.subCategory === selectedSubcategory);

  // Sort products based on selected sort option
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low-high':
        return a.price - b.price;
      case 'price-high-low':
        return b.price - a.price;
      case 'top-rated':
        return (b.rating || 0) - (a.rating || 0);
      case 'featured':
      default:
        return 0; // Keep original order
    }
  });

  if (!categoryData) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">Category not found</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Category Header */}
      <div className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <span className="text-4xl">{categoryData.icon}</span>
          {categoryData.name}
        </h1>
        <p className="text-gray-600 mb-6">{categoryData.description}</p>

        {/* Subcategory Filter */}
        <div className="bg-white rounded-lg shadow-sm p-4 mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">
            Filter by Type
          </h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setSelectedSubcategory('all')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                selectedSubcategory === 'all'
                  ? 'bg-[#DFA947] text-black'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              All {categoryData.name}
            </button>
            {categoryData.subcategories.map((subcategory) => (
              <button
                key={subcategory.id}
                onClick={() => setSelectedSubcategory(subcategory.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 ${
                  selectedSubcategory === subcategory.id
                    ? 'bg-[#DFA947] text-black'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {subcategory.name}
              </button>
            ))}
          </div>
        </div>

        {/* Sort Dropdown */}
        <div className="bg-white rounded-lg shadow-sm p-4">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
              Sort By
            </h3>
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg px-4 py-2.5 pr-10 cursor-pointer hover:bg-gray-100 focus:ring-2 focus:ring-[#DFA947] focus:border-[#DFA947] transition-all"
              >
                <option value="featured">Featured</option>
                <option value="price-low-high">Price: Low to High</option>
                <option value="price-high-low">Price: High to Low</option>
                <option value="top-rated">Top-rated</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Products Count */}
      <div className="mb-6">
        <p className="text-gray-600">
          Showing {sortedProducts.length} {sortedProducts.length === 1 ? 'product' : 'products'}
          {selectedSubcategory !== 'all' && (
            <span className="font-semibold">
              {' '}in {categoryData.subcategories.find(sub => sub.id === selectedSubcategory)?.name}
            </span>
          )}
        </p>
      </div>

      {/* Products Grid */}
      {sortedProducts.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {sortedProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <svg
            className="mx-auto h-24 w-24 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <h3 className="mt-4 text-xl font-semibold text-gray-900">No products found</h3>
          <p className="mt-2 text-gray-600">
            Try selecting a different subcategory or browse all products.
          </p>
          <button
            onClick={() => setSelectedSubcategory('all')}
            className="mt-4 px-6 py-2 bg-[#DFA947] text-black rounded-lg hover:bg-[#C89437] transition-colors"
          >
            View All {categoryData.name}
          </button>
        </div>
      )}
    </div>
  );
};

export default CategoryPage;

