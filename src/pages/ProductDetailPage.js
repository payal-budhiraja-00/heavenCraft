import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import ProductReviews from '../components/ProductReviews';

const ProductDetailPage = ({ products }) => {
  const { productId } = useParams();
  const navigate = useNavigate();
  const { addToCart } = useCart();

  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [isAdding, setIsAdding] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const product = products.find(p => p.id === productId);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [productId]);

  if (!product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Product Not Found</h1>
        <p className="text-gray-600 mb-8">The product you're looking for doesn't exist.</p>
        <button
          onClick={() => navigate('/')}
          className="bg-[#DFA947] text-black px-6 py-3 rounded-lg font-semibold hover:bg-[#C89437] transition-colors"
        >
          Back to Home
        </button>
      </div>
    );
  }

  // Ensure product has multiple images for gallery effect
  const productImages = product.images && product.images.length > 0
    ? product.images
    : ['https://via.placeholder.com/600x600/DFA947/FFFFFF?text=No+Image'];

  const handleAddToCart = () => {
    setIsAdding(true);
    for (let i = 0; i < quantity; i++) {
      addToCart(product);
    }
    setTimeout(() => {
      setIsAdding(false);
    }, 800);
  };

  const handleImageError = () => {
    setImageError(true);
  };

  const placeholderImage = product.category === 'chair'
    ? 'https://via.placeholder.com/600x600/DFA947/FFFFFF?text=Chair'
    : 'https://via.placeholder.com/600x600/DFA947/FFFFFF?text=Table';

  // Generate a consistent unique customer count based on product ID
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

  const goToPreviousImage = () => {
    setSelectedImageIndex((prev) =>
      prev === 0 ? productImages.length - 1 : prev - 1
    );
  };

  const goToNextImage = () => {
    setSelectedImageIndex((prev) =>
      prev === productImages.length - 1 ? 0 : prev + 1
    );
  };

  return (
    <div className="py-8 min-h-screen" style={{background: 'linear-gradient(to bottom, #FAF8F3, #F5F2E9)'}}>
      <div className="container mx-auto px-4">
        {/* Close Button - Top Right */}
        <div className="flex justify-end mb-4">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center justify-center w-10 h-10 rounded-full bg-black hover:bg-gray-800 text-white transition-all duration-200 shadow-lg hover:shadow-xl"
            aria-label="Close"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Breadcrumb */}
        <nav className="mb-6 text-sm">
          <ol className="flex items-center space-x-2 text-gray-600">
            <li>
              <button onClick={() => navigate('/')} className="hover:text-[#DFA947] transition-colors">
                Home
              </button>
            </li>
            <li>/</li>
            <li>
              <button
                onClick={() => navigate(`/${product.category}s`)}
                className="hover:text-[#DFA947] transition-colors capitalize"
              >
                {product.category}s
              </button>
            </li>
            <li>/</li>
            <li className="text-gray-900 font-semibold">{product.name}</li>
          </ol>
        </nav>

        {/* Main Product Section */}
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="grid md:grid-cols-2 gap-8 p-6 md:p-8">
            {/* Image Gallery with Arrow Navigation */}
            <div className="space-y-4">
              {/* Main Image with Navigation Arrows */}
              <div className="relative bg-gradient-to-br from-[#FAF8F3] to-[#F5F2E9] rounded-lg overflow-hidden group">
                <div className="aspect-square p-8 relative">
                  <img
                    src={imageError ? placeholderImage : productImages[selectedImageIndex]}
                    alt={`${product.name} - View ${selectedImageIndex + 1}`}
                    onError={handleImageError}
                    className="w-full h-full object-contain drop-shadow-2xl"
                  />
                </div>
                {!product.inStock && (
                  <div className="absolute inset-0 bg-black bg-opacity-60 flex items-center justify-center">
                    <span className="bg-red-500 text-white px-6 py-3 rounded-lg font-bold text-xl">
                      Out of Stock
                    </span>
                  </div>
                )}

                {/* Navigation Arrows - Show only if multiple images */}
                {productImages.length > 1 && (
                  <>
                    {/* Left Arrow */}
                    <button
                      onClick={goToPreviousImage}
                      className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-lg"
                      aria-label="Previous image"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                    </button>

                    {/* Right Arrow */}
                    <button
                      onClick={goToNextImage}
                      className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 rounded-full bg-black/70 hover:bg-black text-white flex items-center justify-center transition-all duration-200 opacity-0 group-hover:opacity-100 shadow-lg"
                      aria-label="Next image"
                    >
                      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>

                    {/* Image Counter */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/70 text-white px-4 py-2 rounded-full text-sm font-medium">
                      {selectedImageIndex + 1} / {productImages.length}
                    </div>
                  </>
                )}
              </div>

              {/* Dot Indicators for Multiple Images */}
              {productImages.length > 1 && (
                <div className="flex justify-center gap-2">
                  {productImages.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedImageIndex(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-200 ${
                        selectedImageIndex === index
                          ? 'bg-[#DFA947] w-8'
                          : 'bg-gray-300 hover:bg-gray-400'
                      }`}
                      aria-label={`Go to image ${index + 1}`}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Product Info */}
            <div className="flex flex-col">
              {/* Category Badge */}
              <div className="mb-4">
                <span className={`inline-block px-4 py-2 rounded-full text-sm font-bold uppercase tracking-wide ${
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
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                {product.name}
              </h1>

              {/* Rating */}
              {product.rating && (
                <div className="flex items-center gap-3 mb-6">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <svg
                        key={star}
                        className={`w-6 h-6 ${
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
                            <linearGradient id={`half-detail-${product.id}-${star}`}>
                              <stop offset="50%" stopColor="#DFA947" />
                              <stop offset="50%" stopColor="#D1D5DB" />
                            </linearGradient>
                          </defs>
                        ) : null}
                        <path
                          d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"
                          fill={
                            star - 0.5 <= product.rating && star > Math.floor(product.rating)
                              ? `url(#half-detail-${product.id}-${star})`
                              : 'currentColor'
                          }
                        />
                      </svg>
                    ))}
                  </div>
                  <span className="text-xl font-bold text-gray-900">
                    {product.rating.toFixed(1)}
                  </span>
                  <span className="text-gray-500">
                    ({product.reviews ? product.reviews.length : 0} {product.reviews && product.reviews.length === 1 ? 'review' : 'reviews'})
                  </span>
                  {product.reviews && product.reviews.length > 0 && (
                    <span className="text-sm font-semibold text-[#DFA947] bg-[#DFA947]/10 px-3 py-1 rounded-full">
                      {customerCount}+ customers
                    </span>
                  )}
                </div>
              )}

              {/* Price */}
              <div className="mb-6">
                <div className="flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-black">
                    ₹{product.price.toLocaleString('en-IN')}
                  </span>
                  <span className="text-gray-500 text-sm">Inc. of all taxes</span>
                </div>
              </div>

              {/* Stock Status */}
              <div className="mb-6">
                {product.inStock ? (
                  <div className="flex items-center text-green-600">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">In Stock</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600">
                    <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    <span className="font-semibold">Out of Stock</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <h2 className="text-xl font-bold text-gray-900 mb-3">Description</h2>
                <p className="text-gray-700 leading-relaxed">
                  {product.description}
                </p>
              </div>

              {/* Features */}
              {product.features && product.features.length > 0 && (
                <div className="mb-8">
                  <h2 className="text-xl font-bold text-gray-900 mb-3">Key Features</h2>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {product.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <svg className="w-5 h-5 mr-2 text-[#DFA947] flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        <span className="text-gray-700">{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Quantity and Add to Cart */}
              <div className="mt-auto pt-6 border-t border-gray-200">
                <div className="flex items-center gap-4 mb-4">
                  <label className="text-gray-700 font-semibold">Quantity:</label>
                  <div className="flex items-center border-2 border-gray-300 rounded-lg">
                    <button
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={!product.inStock}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max="99"
                      value={quantity}
                      onChange={(e) => setQuantity(Math.max(1, Math.min(99, parseInt(e.target.value) || 1)))}
                      disabled={!product.inStock}
                      className="w-16 text-center py-2 border-x-2 border-gray-300 focus:outline-none disabled:bg-gray-50"
                    />
                    <button
                      onClick={() => setQuantity(Math.min(99, quantity + 1))}
                      disabled={!product.inStock}
                      className="px-4 py-2 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  onClick={handleAddToCart}
                  disabled={!product.inStock || isAdding}
                  className={`w-full py-4 rounded-lg font-bold text-lg transition-all duration-200 ${
                    !product.inStock
                      ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                      : isAdding
                      ? 'bg-green-500 text-white scale-95'
                      : 'bg-[#DFA947] text-black hover:bg-[#C89437] hover:scale-105 shadow-lg hover:shadow-xl'
                  }`}
                >
                  {isAdding ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin h-5 w-5 mr-2" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      Added to Cart!
                    </span>
                  ) : (
                    'Add to Cart'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info Section */}
        <div className="mt-8 grid md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <div className="text-4xl mb-3">🚚</div>
            <h3 className="font-bold text-gray-900 mb-2">Free Shipping</h3>
            <p className="text-sm text-gray-600">On orders over ₹10,000</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <div className="text-4xl mb-3">🔒</div>
            <h3 className="font-bold text-gray-900 mb-2">Secure Payment</h3>
            <p className="text-sm text-gray-600">100% secure transactions</p>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 text-center">
            <div className="text-4xl mb-3">↩️</div>
            <h3 className="font-bold text-gray-900 mb-2">Easy Returns</h3>
            <p className="text-sm text-gray-600">30-day return policy</p>
          </div>
        </div>

        {/* Customer Reviews Section */}
        <div className="mt-8">
          <ProductReviews
            reviews={product.reviews}
            productRating={product.rating || 0}
          />
        </div>
      </div>
    </div>
  );
};

export default ProductDetailPage;

