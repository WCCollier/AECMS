// User types
export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  role: 'owner' | 'admin' | 'member' | 'guest';
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  display_name?: string;
}

// Content types
export interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featured_image_url: string | null;
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  author: User;
  categories: Category[];
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  template: string | null;
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  parent_id: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  parent_id: string | null;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
}

// Product types
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  sku: string;
  stock_quantity: number;
  track_inventory: boolean;
  allow_backorder: boolean;
  is_digital: boolean;
  featured_image_url: string | null;
  gallery_urls: string[];
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  status: 'draft' | 'published' | 'archived';
  categories: Category[];
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

// Cart types
export interface CartItem {
  id: string;
  product_id: string;
  product: Product;
  quantity: number;
  unit_price: number;
  created_at: string;
}

export interface Cart {
  id: string;
  user_id: string | null;
  session_id: string | null;
  items: CartItem[];
  created_at: string;
  updated_at: string;
}

// Order types
export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  product_sku: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  guest_email: string | null;
  status: 'pending' | 'paid' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';
  payment_status: 'pending' | 'paid' | 'failed' | 'refunded';
  payment_provider: 'stripe' | 'paypal' | null;
  payment_id: string | null;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  shipping_address: ShippingAddress;
  billing_address: ShippingAddress | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

// Pagination types
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
}

// Payment types
export interface PaymentIntent {
  payment_id: string;
  client_secret: string;
  provider: 'stripe' | 'paypal';
  status: string;
  approval_url?: string; // For PayPal
}

// Media types
export interface Media {
  id: string;
  filename: string;
  original_filename: string;
  mime_type: string;
  size: number;
  url: string;
  alt_text: string | null;
  caption: string | null;
  created_at: string;
}
