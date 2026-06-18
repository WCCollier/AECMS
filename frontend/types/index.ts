// User types
export interface User {
  id: string;
  email: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  role: 'owner' | 'admin' | 'member' | 'guest';
  emailVerified: boolean;
  totpEnabled?: boolean;
  hasBackstageAccess?: boolean;
  createdAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthUser {
  id: string;
  email: string;
  username?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  role: 'owner' | 'admin' | 'member' | 'guest';
  emailVerified: boolean;
  hasBackstageAccess?: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  username: string;
  password: string;
  firstName?: string;
  lastName?: string;
}

// Media widget type — shared across Articles, Products (and future Pages)
export interface MediaItem {
  id: string;
  url: string;
  order: number;
  is_primary: boolean;
  alt_text?: string | null;
}

// Content types
export interface Article {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt: string | null;
  featured_image_url: string | null;
  media: MediaItem[];
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  author: User & { first_name?: string; last_name?: string };
  categories: Category[];
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export type PageLayout = 'no_sidebar' | 'sidebar_left' | 'sidebar_right' | 'split_comparison';

export interface PageContent {
  layout: PageLayout;
  zones: {
    main?: object;
    sidebar?: object;
    left?: object;
    right?: object;
  };
}

export interface Page {
  id: string;
  title: string;
  slug: string;
  content: string;
  template: string | null;
  layout?: PageLayout;
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  status: 'draft' | 'published' | 'archived';
  published_at: string | null;
  parent_id: string | null;
  sort_order: number;
  show_in_nav: boolean;
  nav_order: number;
  admin_can_edit: boolean;
  admin_can_delete: boolean;
  meta_title?: string | null;
  meta_description?: string | null;
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
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  sku: string;
  stock_quantity: number | null;
  stock_status: 'in_stock' | 'out_of_stock' | 'back_ordered' | 'backorder' | 'available' | 'unavailable';
  product_type: 'physical' | 'digital' | 'service';
  featured_image_url: string | null;
  media: MediaItem[];
  visibility: 'public' | 'logged_in_only' | 'admin_only';
  status: 'draft' | 'published' | 'archived';
  guest_purchaseable: boolean;
  comment_count: number;
  review_count: number;
  average_rating: number | null;
  categories: Category[];
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

// Cart types

// Minimal product snapshot embedded in each cart item by transformCart().
// Intentionally narrower than Product — the cart UI needs only these fields and
// can render in a single request without fetching full product records.
// Adding fields here requires a matching change in cart.service.ts transformCart().
// See docs/Shape_Audit.md Item 7 for the full rationale.
export interface CartProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  product_type: 'physical' | 'digital' | 'service';
  stock_status: string;
  stock_quantity: number | null;
  featured_image_url: string | null;
}

export interface CartItem {
  id: string;
  product_id: string;
  product: CartProduct;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Cart {
  id: string;
  user_id: string | null;
  session_id: string | null;
  items: CartItem[];
  item_count: number;
  subtotal: number;
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
  product?: {
    id: string;
    name: string;
    product_type: 'physical' | 'digital' | 'service';
  };
}

export type OrderStatus = 'pending' | 'processing' | 'scheduled' | 'shipped' | 'completed' | 'cancelled' | 'refunded';

export interface Order {
  id: string;
  order_number: string;
  user_id: string | null;
  email: string | null;
  status: OrderStatus;
  payment_method: 'stripe' | 'paypal' | null;
  payment_intent_id: string | null;
  paid_at: string | null;
  subtotal: number;
  tax: number;
  shipping: number;
  total: number;
  shipping_address: ShippingAddress | null;
  // Physical fulfillment
  tracking_number: string | null;
  tracking_carrier: string | null;
  shipped_at: string | null;
  // Service scheduling
  scheduled_at: string | null;
  scheduled_note: string | null;
  items: OrderItem[];
  created_at: string;
  updated_at: string;
}

export interface SavedShippingAddress {
  shipping_street: string | null;
  shipping_city: string | null;
  shipping_state: string | null;
  shipping_postal_code: string | null;
  shipping_country: string | null;
  has_address: boolean;
}

export interface ShippingAddress {
  street: string;
  city: string;
  state: string;
  postal_code: string;
  country: string;
}

// Digital products types

export interface DigitalDownload {
  id: string;
  digitalFileId: string;
  orderId: string;
  downloadToken: string;
  downloadCount: number;
  kindleSendCount: number;
  maxDownloads: number;
  expiresAt: string;
  createdAt: string;
  lastDownloadedAt: string | null;
  format: string;
  productName: string;
}

export interface DigitalProductFile {
  id: string;
  productId: string;
  format: string;
  fileId: string;
  personalizationEnabled: boolean;
  personalizationTested: boolean;
  maxDownloads: number;
  createdAt: string;
  updatedAt: string;
}

export interface KindleDevice {
  id: string;
  userId: string;
  friendlyName: string;
  kindleEmail: string;
  isDefault: boolean;
  lastUsedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Comment types

export interface CommentAuthor {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

// A rating dimension within a review-type comment.
// title: "Overall" (always first); future aspect ratings add more rows.
// value: 1–5 integer.
export interface CommentRating {
  id: string;
  title: string;
  value: number;
}

// A Comment becomes a Review when ratings.length > 0.
// The first rating always has title "Overall".
// verified_purchase is system-set; true when the commenter has a
// completed/processing order containing the reviewed product.
export interface Comment {
  id: string;
  content: string;
  title: string | null;          // Review headline
  verified_purchase: boolean;
  status: 'approved' | 'pending' | 'rejected' | 'spam';
  moderation_status: 'pending' | 'flagged' | 'approved' | 'rejected';
  user_id: string;
  article_id: string | null;
  product_id: string | null;
  parent_id: string | null;
  user: CommentAuthor | null;
  // Hydrated by commentInclude — present on all public endpoints
  article: { id: string; title: string; slug: string } | null;
  product: { id: string; title: string; slug: string } | null;
  ratings: CommentRating[];
  replies: Comment[];
  created_at: string;
  updated_at: string;
}

// Pagination types
export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    total_pages: number;
  };
  // Legacy flat shape (some endpoints)
  total?: number;
  page?: number;
  limit?: number;
  total_pages?: number;
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

// Domain Alias types
export interface DomainAlias {
  id: string;
  domain: string;
  target_route: string;
  is_verified: boolean;
  is_active: boolean;
  verification_token: string;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DomainAliasCreateData {
  domain: string;
  target_route: string;
}

export interface DomainVerificationInstructions {
  domain: string;
  record_type: string;
  record_name: string;
  record_value: string;
  instructions: string;
}
