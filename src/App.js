import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { CartProvider } from './context/CartContext';
import Header from './components/Header';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import CategoryPage from './components/CategoryPage';
import ProductDetailPage from './pages/ProductDetailPage';
import SearchResults from './pages/SearchResults';
import CartDrawer from './components/CartDrawer';
import productsData from './data/products.json';

function App() {
  const [isCartOpen, setIsCartOpen] = useState(false);

  return (
    <CartProvider>
      <Router>
        <div className="min-h-screen" style={{background: 'linear-gradient(to bottom, #FAF8F3, #F5F2E9)'}}>
          <Header onCartOpen={() => setIsCartOpen(true)} />

          <main>
            <Routes>
              <Route path="/" element={<HomePage products={productsData} />} />
              <Route path="/about" element={<AboutPage />} />
              <Route path="/contact" element={<ContactPage />} />
              <Route path="/search" element={<SearchResults products={productsData} />} />
              <Route path="/product/:productId" element={<ProductDetailPage products={productsData} />} />
              <Route path="/chairs" element={<CategoryPage products={productsData} />} />
              <Route path="/tables" element={<CategoryPage products={productsData} />} />
              <Route path="/accessories" element={<CategoryPage products={productsData} />} />
            </Routes>
          </main>

          <CartDrawer
            isOpen={isCartOpen}
            onClose={() => setIsCartOpen(false)}
          />

          {/* Footer */}
          <footer className="bg-black border-t border-[#DFA947] mt-16">
            <div className="container mx-auto px-4 py-8">
              <div className="text-center">
                <p className="text-[#DFA947] font-semibold text-lg mb-2">
                  HeavenCraft
                </p>
                <p className="text-gray-400 text-sm mb-3">
                  © 2026 HeavenCraft - Premium Ergonomic Furniture
                </p>
                <p className="text-gray-400 text-xs">
                  Contact us at: <a href="mailto:heavencraft09@gmail.com" className="text-[#DFA947] hover:text-[#C89437] transition-colors">heavencraft09@gmail.com</a>
                </p>
              </div>
            </div>
          </footer>
        </div>
      </Router>
    </CartProvider>
  );
}

export default App;
