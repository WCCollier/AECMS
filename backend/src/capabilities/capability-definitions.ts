/**
 * Canonical capability definitions — single source of truth for the runtime.
 * AuthService reads this on every Owner login to upsert any missing capabilities
 * and guarantee the owner always holds the full set, regardless of seed state.
 *
 * Keep in sync with backend/scripts/seed-minimal.js (CJS bootstrap script).
 */
export interface CapabilityDefinition {
  name: string;
  category: string;
  scope: 'backstage' | 'customer';
  description: string;
}

export const CAPABILITY_DEFINITIONS: CapabilityDefinition[] = [
  // Content Management
  { name: 'article.create',      category: 'content',   scope: 'backstage', description: 'Create articles' },
  { name: 'article.edit.own',    category: 'content',   scope: 'backstage', description: 'Edit own articles' },
  { name: 'article.edit.any',    category: 'content',   scope: 'backstage', description: 'Edit any article' },
  { name: 'article.delete.own',  category: 'content',   scope: 'backstage', description: 'Delete own articles' },
  { name: 'article.delete.any',  category: 'content',   scope: 'backstage', description: 'Delete any article' },
  { name: 'article.publish',     category: 'content',   scope: 'backstage', description: 'Publish articles' },
  { name: 'page.create',         category: 'content',   scope: 'backstage', description: 'Create pages' },
  { name: 'page.edit',           category: 'content',   scope: 'backstage', description: 'Edit pages' },
  { name: 'page.delete',         category: 'content',   scope: 'backstage', description: 'Delete pages' },
  { name: 'media.upload',        category: 'content',   scope: 'backstage', description: 'Upload media files' },
  { name: 'media.delete',        category: 'content',   scope: 'backstage', description: 'Delete media files' },
  // Ecommerce
  { name: 'product.create',      category: 'ecommerce', scope: 'backstage', description: 'Create products' },
  { name: 'product.edit.own',    category: 'ecommerce', scope: 'backstage', description: 'Edit own products' },
  { name: 'product.edit',        category: 'ecommerce', scope: 'backstage', description: 'Edit any product' },
  { name: 'product.delete.own',  category: 'ecommerce', scope: 'backstage', description: 'Delete own products' },
  { name: 'product.delete',      category: 'ecommerce', scope: 'backstage', description: 'Delete any product' },
  { name: 'order.view.all',      category: 'ecommerce', scope: 'backstage', description: 'View all orders' },
  { name: 'order.edit',          category: 'ecommerce', scope: 'backstage', description: 'Edit orders' },
  { name: 'order.refund',        category: 'ecommerce', scope: 'backstage', description: 'Process refunds' },
  // Users
  { name: 'user.create',         category: 'users',     scope: 'backstage', description: 'Create users' },
  { name: 'user.edit',           category: 'users',     scope: 'backstage', description: 'Edit users' },
  { name: 'user.delete',         category: 'users',     scope: 'backstage', description: 'Delete users' },
  { name: 'user.assign_role',    category: 'users',     scope: 'backstage', description: 'Assign user roles' },
  { name: 'user.assign_capability', category: 'users',  scope: 'backstage', description: 'Assign capabilities to users' },
  // Comments & Reviews
  { name: 'comment.view.all',    category: 'content',   scope: 'backstage', description: 'View all comments' },
  { name: 'comment.moderate',    category: 'content',   scope: 'backstage', description: 'Moderate comments' },
  { name: 'comment.delete',      category: 'content',   scope: 'backstage', description: 'Delete any comment' },
  { name: 'review.moderate',     category: 'ecommerce', scope: 'backstage', description: 'Moderate reviews' },
  // System — granular configure atoms
  { name: 'system.configure.general',  category: 'system', scope: 'backstage', description: 'Edit General and Site Identity settings' },
  { name: 'system.configure.email',    category: 'system', scope: 'backstage', description: 'Edit SMTP / email settings and send test emails' },
  { name: 'system.configure.payments', category: 'system', scope: 'backstage', description: 'Edit payment provider credentials and verify connections' },
  { name: 'system.configure.storage',  category: 'system', scope: 'backstage', description: 'Edit file storage provider settings and run storage tests' },
  { name: 'system.view_audit',   category: 'system',    scope: 'backstage', description: 'View audit logs' },
  { name: 'system.export_data',  category: 'system',    scope: 'backstage', description: 'Export data (CSV)' },
  // Domain Management
  { name: 'domain.manage',       category: 'system',    scope: 'backstage', description: 'Manage domain aliases' },
  // Appearance
  { name: 'system.appearance',   category: 'system',    scope: 'backstage', description: 'Change site visual theme' },
  // Digital Delivery
  { name: 'digital.deliver',     category: 'ecommerce', scope: 'backstage', description: 'Manage digital delivery — extend/regenerate download tokens' },
  // Mul Converter
  { name: 'mul.convert',         category: 'system',    scope: 'backstage', description: 'Run the Mul Converter AI tool to extract palettes and page layouts from external URLs' },
  // Role Management
  { name: 'role.manage',         category: 'system',    scope: 'backstage', description: 'Create, edit, and delete roles and their capability assignments' },
  // Registration Controls
  { name: 'registration.configure', category: 'system', scope: 'backstage', description: 'Configure registration policy: default role and approval requirement' },
  { name: 'registration.approve',   category: 'users',  scope: 'backstage', description: 'Review and approve or reject pending user registrations' },
  // Account Deletion
  { name: 'account.delete.limited', category: 'users',  scope: 'backstage', description: 'Delete accounts that do not themselves hold any account.delete capability' },
  { name: 'account.delete.any',     category: 'users',  scope: 'backstage', description: 'Delete any account except your own (including other owners)' },
  // Customer-facing capabilities
  { name: 'comment.article',     category: 'content',   scope: 'customer',  description: 'Post a comment on an article' },
  { name: 'review.article',      category: 'content',   scope: 'customer',  description: 'Post a review on an article' },
  { name: 'comment.product',     category: 'ecommerce', scope: 'customer',  description: 'Post a comment on a product' },
  { name: 'review.product',      category: 'ecommerce', scope: 'customer',  description: 'Post a review on a product' },
  { name: 'comment.edit.own',    category: 'content',   scope: 'customer',  description: 'Edit own comments' },
  { name: 'comment.delete.own',  category: 'content',   scope: 'customer',  description: 'Delete own comments' },
  { name: 'checkout.guest',      category: 'ecommerce', scope: 'customer',  description: 'Checkout without an account' },
  { name: 'purchase.physical',   category: 'ecommerce', scope: 'customer',  description: 'Purchase physical products' },
  { name: 'purchase.digital',    category: 'ecommerce', scope: 'customer',  description: 'Purchase digital products' },
  { name: 'purchase.service',    category: 'ecommerce', scope: 'customer',  description: 'Purchase service products' },
];
