import Link from 'next/link';

export function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLink = 'text-muted hover:text-accent transition-colors';

  return (
    <footer className="bg-surface border-t border-border mt-16">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div>
            <h3 className="text-base font-bold mb-3 text-accent">Fantasy v Reality</h3>
            <p className="text-muted text-sm leading-relaxed">
              Philosophy, fiction, and firearms — written from principle, not from permission.
            </p>
          </div>

          {/* Reading */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground/80 uppercase tracking-wider">Reading</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/latest" className={footerLink}>Latest Articles</Link></li>
              <li><Link href="/latest?category=short-thoughts" className={footerLink}>Short Thoughts</Link></li>
              <li><Link href="/latest?category=reviews" className={footerLink}>Book Reviews</Link></li>
            </ul>
          </div>

          {/* Shop */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground/80 uppercase tracking-wider">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/shop" className={footerLink}>All Products</Link></li>
              <li><Link href="/cart" className={footerLink}>Shopping Cart</Link></li>
            </ul>
          </div>

          {/* Account */}
          <div>
            <h4 className="text-sm font-semibold mb-3 text-foreground/80 uppercase tracking-wider">Account</h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/auth/login" className={footerLink}>Login</Link></li>
              <li><Link href="/auth/register" className={footerLink}>Register</Link></li>
              <li><Link href="/account/orders" className={footerLink}>Order History</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-muted">
          <p>&copy; {currentYear} Fantasy v Reality. All rights reserved.</p>
          <div className="flex gap-6">
            <Link href="/privacy" className={footerLink}>Privacy Policy</Link>
            <Link href="/terms" className={footerLink}>Terms of Service</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
