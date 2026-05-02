import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';

const ProductCard = ({ product }) => {
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [isAdding, setIsAdding] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleAddToCart = (e) => {
    e.stopPropagation(); // Prevent card click when clicking button
    setIsAdding(true);
    addToCart(product);

    // Visual feedback
    setTimeout(() => {
      setIsAdding(false);
    }, 500);
  };

  const handleCardClick = () => {
    navigate(`/product/${product.id}`);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  // Placeholder image based on category
  const placeholderImage = product.category === 'chair'
    ? 'https://via.placeholder.com/400x300/3B82F6/FFFFFF?text=Chair'
    : 'https://via.placeholder.com/400x300/10B981/FFFFFF?text=Table';

  // Unique customer count per product based on ID hash
  const getCustomerCount = (id) => {
    let hash = 5381;
    for (let i = 0; i < id.length; i++) {
      hash = ((hash << 5) + hash) ^ id.charCodeAt(i);
    }
    // Knuth multiplicative hash — spreads sequential values far apart
    const spread = Math.abs((Math.imul(hash, 2654435761)) >>> 0) % 420;
    const base = 80 + spread; // range: 80–499
    return Math.floor(base / 10) * 10;
  };
  const customerCount = getCustomerCount(product.id);

  return (
    <div
      onClick={handleCardClick}
      className="bg-white rounded-lg shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col cursor-pointer transform hover:scale-105"
    >
      {/* Product Image */}
      <div className="relative bg-gradient-to-br from-[#FAF8F3] to-[#F5F2E9] overflow-hidden">
        <div className="aspect-[3/4] p-6 relative">
          <img
            src={imageError ? placeholderImage : product.images[0]}
            alt={product.name}
            onError={handleImageError}
            loading="lazy"
            className="w-full h-full object-cover drop-shadow-lg transition-transform duration-300 hover:scale-105"
          />
        </div>
        {!product.inStock && (
          <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
            <span className="bg-red-500 text-white px-4 py-2 rounded-lg font-semibold">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      {/* Product Details */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Category Badge */}
        <div className="mb-2">
          <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold uppercase ${
            product.category === 'chair' 
              ? 'bg-[#DFA947]/20 text-[#DFA947]' 
              : product.category === 'table'
              ? 'bg-black text-white'
              : 'bg-gray-800 text-white'
          }`}>
            {product.category}
          </span>
        </div>

        {/* Product Name */}
        <h3 className="text-lg font-bold text-gray-900 mb-2">
          {product.name}
        </h3>

        {/* Rating */}
        {product.rating && (
          <div className="flex flex-col gap-1 mb-2">
          <div className="flex items-center gap-2">
            <div className="flex items-center">
              {[1, 2, 3, 4, 5].map((star) => (
                <svg
                  key={star}
                  className={`w-4 h-4 ${
                    star <= Math.floor(product.rating)
                      ? 'text-[#DFA947]'
                      : star - 0.5 <= product.rating
                      ? 'text-[#DFA947]'
                      : 'text-gray-300'
                  }`}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  {star - 0.5 <= product.rating && star > Math.floor(product.rating) ? (
                    // Half star
                    <defs>
                      <linearGradient id={`half-${product.id}-${star}`}>
                        <stop offset="50%" stopColor="#DFA947" />
                        <stop offset="50%" stopColor="#D1D5DB" />
                      </linearGradient>
                    </defs>
                  ) : null}
                  <path
                    d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                    fill={
                      star - 0.5 <= product.rating && star > Math.floor(product.rating)
                        ? `url(#half-${product.id}-${star})`
                        : 'currentColor'
                    }
                  />
                </svg>
              ))}
            </div>
            <span className="text-sm font-semibold text-gray-700">
              {product.rating.toFixed(1)}
            </span>
          </div>
          {product.reviews && product.reviews.length > 0 && (
            <span className="text-xs text-gray-500">
              {product.reviews.length} {product.reviews.length === 1 ? 'review' : 'reviews'} &nbsp;·&nbsp; {customerCount}+ customers
            </span>
          )}
          </div>
        )}

        {/* Description */}
        <p className="text-sm text-gray-600 mb-3 line-clamp-2 flex-1">
          {product.description}
        </p>

        {/* Features */}
        {product.features && product.features.length > 0 && (
          <ul className="text-xs text-gray-500 mb-3 space-y-1">
            {product.features.slice(0, 2).map((feature, index) => (
              <li key={index} className="flex items-center">
                <svg className="w-3 h-3 mr-1 text-[#DFA947]" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                {feature}
              </li>
            ))}
          </ul>
        )}

        {/* Price and Add to Cart */}
        <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-200">
          <div className="text-2xl font-bold text-black">
            ₹{product.price.toFixed(2)}
          </div>
          <button
            onClick={handleAddToCart}
            disabled={!product.inStock || isAdding}
            className={`px-4 py-2 rounded-lg font-semibold transition-all duration-200 ${
              !product.inStock
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : isAdding
                ? 'bg-green-500 text-white scale-95'
                : 'bg-[#DFA947] text-black hover:bg-[#C89437] hover:scale-105 shadow-md'
            }`}
          >
            {isAdding ? (
              <span className="flex items-center">
                <svg className="animate-spin h-4 w-4 mr-1" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Added
              </span>
            ) : (
              'Add to Cart'
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;

