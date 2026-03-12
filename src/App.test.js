import { render, screen } from '@testing-library/react';
import App from './App';

test('renders HeavenCraft header', () => {
  render(<App />);
  const headerElement = screen.getByText(/HeavenCraft/i);
  expect(headerElement).toBeInTheDocument();
});

test('renders navigation links', () => {
  render(<App />);
  const allLinks = screen.getAllByText(/All/i);
  expect(allLinks.length).toBeGreaterThan(0);
});

test('renders product grid on initial load', () => {
  render(<App />);
  // Should show "All Products" heading
  const heading = screen.getByText(/All Products/i);
  expect(heading).toBeInTheDocument();
});
