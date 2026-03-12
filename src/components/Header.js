import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const Header = ({ onCartOpen }) => {
  const { cartItemCount } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname === path;
  };

  const navLinkClass = (path) => {
    const baseClass = "px-4 py-2 rounded-lg transition-colors duration-200 font-medium";
    return isActive(path)
      ? `${baseClass} bg-[#DFA947] text-black`
      : `${baseClass} text-white hover:bg-gray-800`;
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery('');
    }
  };

  return (
    <header className="sticky top-0 z-50">
      {/* Top Promotional Bar */}
      <div className="bg-[#DFA947] txt-black py-2 px-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-center text-center text-sm md:text-base font-semibold">
            <span>✨ Premium Ergonomic Furniture • Free Shipping on Orders Above ₹20,000 ✨</span>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="bg-black shadow-md">
        <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center space-x-3">
            <img
              src="/images/logo/heavencraft-logo.jpg"
              alt="HeavenCraft Logo"
              className="h-16 w-auto"
              onError={(e) => {
                e.target.onerror = null;
                e.target.style.display = 'none';
              }}
            />
            <div className="flex flex-col">
              <div className="text-3xl font-bold text-[#DFA947]">
                HeavenCraft
              </div>
              <div className="text-sm font-medium text-[#DFA947] ml-20">
                A unit of Jiwan
              </div>
            </div>
          </Link>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-2">
            <Link to="/" className={navLinkClass('/')}>
              Home
            </Link>
            <Link to="/chairs" className={navLinkClass('/chairs')}>
              Chairs
            </Link>
            <Link to="/tables" className={navLinkClass('/tables')}>
              Tables
            </Link>
            <Link to="/accessories" className={navLinkClass('/accessories')}>
              Accessories
            </Link>
            <Link to="/about" className={navLinkClass('/about')}>
              About
            </Link>
            <Link to="/contact" className={navLinkClass('/contact')}>
              Contact
            </Link>
          </nav>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="hidden md:flex items-center">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-64 px-4 py-2 pl-10 rounded-lg bg-gray-800 text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#DFA947] focus:border-transparent transition-all"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </form>

          {/* Cart Button */}
          <button
            onClick={onCartOpen}
            className="relative p-2 text-white hover:bg-gray-800 rounded-lg transition-colors duration-200"
            aria-label="Open cart"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            {cartItemCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {cartItemCount}
              </span>
            )}
          </button>
        </div>

        {/* Mobile Navigation */}
        <nav className="md:hidden mt-4">
          {/* Mobile Search Bar */}
          <form onSubmit={handleSearch} className="mb-4">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search products..."
                className="w-full px-4 py-2 pl-10 rounded-lg bg-gray-800 text-white placeholder-gray-400 border border-gray-700 focus:outline-none focus:ring-2 focus:ring-[#DFA947] focus:border-transparent transition-all"
              />
              <svg
                className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </form>

          <div className="flex items-center justify-center flex-wrap gap-2">
            <Link to="/" className={navLinkClass('/')}>
              Home
            </Link>
            <Link to="/chairs" className={navLinkClass('/chairs')}>
              Chairs
            </Link>
            <Link to="/tables" className={navLinkClass('/tables')}>
              Tables
            </Link>
            <Link to="/accessories" className={navLinkClass('/accessories')}>
              Accessories
            </Link>
            <Link to="/about" className={navLinkClass('/about')}>
              About
            </Link>
            <Link to="/contact" className={navLinkClass('/contact')}>
              Contact
            </Link>
          </div>
        </nav>
      </div>
      </div>
    </header>
  );
};

export default Header;

