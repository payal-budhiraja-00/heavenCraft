import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import ProductCard from '../components/ProductCard';

const SearchResults = ({ products }) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const query = searchParams.get('q') || '';
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [sortBy, setSortBy] = useState('relevance');

  useEffect(() => {
    if (!query.trim()) {
      setFilteredProducts([]);
      return;
    }

    const searchQuery = query.toLowerCase().trim();

    // Search in product name, description, category, subcategory, and features
    const results = products.filter(product => {
      const name = product.name.toLowerCase();
      const description = product.description.toLowerCase();
      const category = product.category.toLowerCase();
      const subCategory = product.subCategory ? product.subCategory.toLowerCase() : '';
      const features = product.features ? product.features.join(' ').toLowerCase() : '';

      return name.includes(searchQuery) ||
             description.includes(searchQuery) ||
             category.includes(searchQuery) ||
             subCategory.includes(searchQuery) ||
             features.includes(searchQuery);
    });

    setFilteredProducts(results);
  }, [query, products]);

  // Sort products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortBy) {
      case 'price-low-high':
        return a.price - b.price;
      case 'price-high-low':
        return b.price - a.price;
      case 'top-rated':
        return (b.rating || 0) - (a.rating || 0);
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'relevance':
      default:
        // Keep original search relevance order
        return 0;
    }
  });

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Search Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-[#DFA947] transition-colors mb-4"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">
          Search Results
        </h1>

        {query && (
          <p className="text-gray-600 text-lg">
            Showing results for: <span className="font-semibold text-gray-900">"{query}"</span>
          </p>
        )}

        <p className="text-gray-600 mt-2">
          {sortedProducts.length} {sortedProducts.length === 1 ? 'product' : 'products'} found
        </p>
      </div>

      {/* Sort Options */}
      {sortedProducts.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm p-4 mb-6">
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
                <option value="relevance">Relevance</option>
                <option value="price-low-high">Price: Low to High</option>
                <option value="price-high-low">Price: High to Low</option>
                <option value="top-rated">Top-rated</option>
                <option value="name-asc">Name: A-Z</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-gray-700">
                <svg className="fill-current h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
                  <path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Results Grid */}
      {!query ? (
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
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <h3 className="mt-4 text-xl font-semibold text-gray-900">Start Searching</h3>
          <p className="mt-2 text-gray-600">Enter a search term to find products.</p>
        </div>
      ) : sortedProducts.length > 0 ? (
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
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="mt-4 text-xl font-semibold text-gray-900">No products found</h3>
          <p className="mt-2 text-gray-600">
            No results found for "{query}". Try a different search term.
          </p>
          <div className="mt-6">
            <h4 className="text-sm font-semibold text-gray-700 mb-3">Suggestions:</h4>
            <ul className="text-sm text-gray-600 space-y-2">
              <li>• Check your spelling</li>
              <li>• Try more general keywords</li>
              <li>• Try different keywords</li>
              <li>• Browse our categories: Chairs, Tables, Accessories</li>
            </ul>
          </div>
          <div className="mt-8 flex justify-center gap-4">
            <button
              onClick={() => navigate('/chairs')}
              className="px-6 py-2 bg-[#DFA947] text-black rounded-lg hover:bg-[#C89437] transition-colors font-semibold"
            >
              Browse Chairs
            </button>
            <button
              onClick={() => navigate('/tables')}
              className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 transition-colors font-semibold"
            >
              Browse Tables
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SearchResults;

