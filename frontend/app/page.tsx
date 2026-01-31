import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-foreground/10">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold">
            AECMS
          </Link>
          <nav className="flex items-center gap-4">
            <Link href="/shop" className="hover:text-foreground/70">
              Shop
            </Link>
            <Link href="/blog" className="hover:text-foreground/70">
              Blog
            </Link>
            <Link href="/auth/login" className="hover:text-foreground/70">
              Login
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="text-4xl font-bold mb-4">
            Welcome to AECMS
          </h1>
          <p className="text-lg text-foreground/70 mb-8">
            Advanced Ecommerce Content Management System - A modern alternative to WordPress.
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/shop"
              className="px-6 py-3 bg-foreground text-background rounded-lg hover:opacity-90 transition-opacity"
            >
              Browse Shop
            </Link>
            <Link
              href="/blog"
              className="px-6 py-3 border border-foreground/20 rounded-lg hover:bg-foreground/5 transition-colors"
            >
              Read Blog
            </Link>
          </div>
        </div>
      </main>

      <footer className="border-t border-foreground/10 mt-auto">
        <div className="container mx-auto px-4 py-8 text-center text-foreground/60">
          <p>&copy; {new Date().getFullYear()} AECMS. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
