import { generateOrderEmail, validateCheckout } from '../utils/emailCheckout';

describe('Email Checkout Utilities', () => {
  describe('validateCheckout', () => {
    test('should return invalid for empty name', () => {
      const result = validateCheckout('');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    test('should return invalid for name with only spaces', () => {
      const result = validateCheckout('   ');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    test('should return invalid for name shorter than 2 characters', () => {
      const result = validateCheckout('A');
      expect(result.isValid).toBe(false);
      expect(result.error).toBeTruthy();
    });

    test('should return valid for proper name', () => {
      const result = validateCheckout('John Doe');
      expect(result.isValid).toBe(true);
      expect(result.error).toBeNull();
    });
  });

  describe('generateOrderEmail', () => {
    const mockCartItems = [
      {
        product: { id: '1', name: 'Test Chair', price: 100.00 },
        quantity: 2
      },
      {
        product: { id: '2', name: 'Test Table', price: 200.00 },
        quantity: 1
      }
    ];

    test('should generate mailto link with correct structure', () => {
      const result = generateOrderEmail(mockCartItems, 'John Doe', '555-1234');
      expect(result).toContain('mailto:orders@ergoshop.com');
      expect(result).toContain('subject=');
      expect(result).toContain('body=');
    });

    test('should include customer name in subject', () => {
      const result = generateOrderEmail(mockCartItems, 'John Doe');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('John Doe');
    });

    test('should include all items in body', () => {
      const result = generateOrderEmail(mockCartItems, 'John Doe');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('Test Chair');
      expect(decoded).toContain('Test Table');
      expect(decoded).toContain('2x');
      expect(decoded).toContain('1x');
    });

    test('should calculate correct total', () => {
      const result = generateOrderEmail(mockCartItems, 'John Doe');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('$400.00'); // (2 * 100) + (1 * 200)
    });

    test('should include phone when provided', () => {
      const result = generateOrderEmail(mockCartItems, 'John Doe', '555-1234');
      const decoded = decodeURIComponent(result);
      expect(decoded).toContain('555-1234');
    });

    test('should work without phone', () => {
      const result = generateOrderEmail(mockCartItems, 'John Doe');
      expect(result).toBeTruthy();
      expect(result).toContain('mailto:');
    });
  });
});

