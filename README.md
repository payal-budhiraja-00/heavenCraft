# ErgoShop - Ergonomic Furniture Web Catalog

A responsive React-based e-commerce application for browsing and ordering ergonomic furniture (Chairs and Tables) via email checkout.

## 🎯 Features

- **Responsive Product Catalog**: Browse ergonomic chairs and tables with a mobile-first design
- **Category Filtering**: Filter products by "All", "Chairs", or "Tables"
- **Shopping Cart**: Add, remove, and manage product quantities
- **Email Checkout**: Request quotes by generating pre-formatted emails with order details
- **Persistent Cart**: Cart data is saved to localStorage
- **Modern UI**: Built with Tailwind CSS for a clean, professional look

## 🛠️ Technical Stack

- **React 19.2.3**: Functional components with Hooks
- **React Router**: Client-side routing for category pages
- **Context API**: Global cart state management
- **Tailwind CSS**: Utility-first styling
- **JavaScript (ES6+)**: Modern JavaScript features

## 📁 Project Structure

```
src/
├── components/
│   ├── Header.js          # Navigation header with cart indicator
│   ├── ProductCard.js     # Individual product display card
│   ├── ProductGrid.js     # Responsive grid layout for products
│   └── CartDrawer.js      # Shopping cart sidebar with checkout
├── context/
│   └── CartContext.js     # Global cart state management
├── data/
│   └── products.json      # Product catalog data
├── utils/
│   └── emailCheckout.js   # Email generation and validation utilities
├── App.js                 # Main application component
└── index.js               # Application entry point
```

## 🚀 Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn

### Installation

1. Clone the repository and navigate to the project directory:
```bash
cd furniture
```

2. Install dependencies:
```bash
npm install
```

3. Start the development server:
```bash
npm start
```

4. Open your browser and navigate to `http://localhost:3000`

## 📦 Product Data Structure

Products are defined in `src/data/products.json`:

```json
{
  "id": "chair-001",
  "name": "ErgoPro Mesh Chair",
  "category": "chair",
  "price": 299.00,
  "currency": "USD",
  "description": "High-back mesh chair...",
  "features": ["Adjustable armrests", "Tilt lock"],
  "images": ["/assets/chair-001.jpg"],
  "inStock": true
}
```

### Adding New Products

Simply add a new product object to the `products.json` array. The application will automatically render it in the catalog.

## 🛒 Cart Management

The cart system provides:

- **addToCart(product)**: Add item or increment quantity
- **removeFromCart(id)**: Remove item from cart
- **updateQuantity(id, quantity)**: Update item quantity
- **clearCart()**: Empty the entire cart
- **cartTotal**: Calculated total price
- **cartItemCount**: Total number of items

Cart data persists across browser sessions using localStorage.

## 📧 Email Checkout Workflow

1. User adds products to cart
2. Opens cart drawer
3. Enters required name (phone optional)
4. Clicks "Request Quote via Email"
5. Email client opens with pre-formatted order details:
   - Recipient: orders@ergoshop.com
   - Subject: Order Request - [Customer Name]
   - Body: Itemized list with prices, total, and customer details

## 🎨 Responsive Design

Breakpoints:
- **Mobile**: < 640px (1 column grid)
- **Tablet**: 640px - 1024px (2 column grid)
- **Desktop**: > 1024px (3-4 column grid)

## 🔧 Available Scripts

- `npm start`: Run development server
- `npm build`: Create production build
- `npm test`: Run test suite
- `npm eject`: Eject from Create React App (irreversible)

## 📝 Key Components

### Header
- Logo linking to home
- Category navigation (All, Chairs, Tables)
- Cart icon with item count badge

### ProductCard
- Product image with lazy loading
- Category badge
- Price display
- "Add to Cart" button with loading state
- Stock status indicator

### CartDrawer
- Slide-in cart sidebar
- Item quantity controls (+/-)
- Remove item functionality
- Customer information form
- Live total calculation
- Email checkout button

### ProductGrid
- Responsive grid layout
- Category filtering
- Empty state handling
- Product count display

## 🌟 Best Practices Implemented

1. **Component Separation**: Clear separation of concerns
2. **State Management**: Centralized cart state with Context API
3. **Code Reusability**: Modular, reusable components
4. **Error Handling**: Validation and error messages
5. **Accessibility**: ARIA labels and semantic HTML
6. **Performance**: Lazy image loading, optimized re-renders
7. **User Experience**: Loading states, visual feedback, smooth transitions
8. **Persistence**: LocalStorage for cart data
9. **Mobile-First**: Responsive design from ground up
10. **Maintainability**: Clean code structure, comments, consistent naming

## 🔄 Future Enhancements

- Product detail pages
- Product search functionality
- Image galleries for products
- Product reviews and ratings
- Wishlist feature
- Compare products
- Sort and advanced filtering
- Backend integration with real payment gateway

## 📧 Contact

For orders and inquiries: orders@ergoshop.com

## 📄 License

This project is licensed under the MIT License.

---

Built with ❤️ using React and Tailwind CSS
