/**
 * Generates a mailto link with order details
 * @param {Array} cartItems - Array of cart items with product and quantity
 * @param {string} customerName - Customer's name
 * @param {string} customerPhone - Customer's phone (optional)
 * @returns {string} - Formatted mailto URL
 */
export const generateOrderEmail = (cartItems, customerName, customerPhone = '') => {
  const recipientEmail = 'heavencraft09@gmail.com';
  const subject = `Order Request - ${customerName}`;

  // Build order items list
  let orderItemsList = '';
  cartItems.forEach((item) => {
    const { product, quantity } = item;
    const itemTotal = (product.price * quantity).toFixed(2);
    orderItemsList += `- ${quantity}x ${product.name} (₹${product.price.toFixed(2)} each = ₹${itemTotal})\n`;
  });

  // Calculate total
  const total = cartItems.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  ).toFixed(2);

  // Build email body
  const body = `Hello Team,

I would like to order:

${orderItemsList}
Total Estimate: ₹${total}

My Details:
Name: ${customerName}
${customerPhone ? `Phone: ${customerPhone}` : ''}

Please contact me to confirm the order and provide payment details.

Thank you!`;

  // Encode the mailto URL
  const mailtoLink = `mailto:${recipientEmail}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return mailtoLink;
};

/**
 * Validates customer information before checkout
 * @param {string} name - Customer's name
 * @returns {Object} - Validation result with isValid and error message
 */
export const validateCheckout = (name) => {
  if (!name || name.trim() === '') {
    return {
      isValid: false,
      error: 'Please enter your name to proceed with checkout.',
    };
  }

  if (name.trim().length < 2) {
    return {
      isValid: false,
      error: 'Please enter a valid name (at least 2 characters).',
    };
  }

  return {
    isValid: true,
    error: null,
  };
};

