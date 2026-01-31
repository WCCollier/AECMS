import Link from 'next/link';
import { Button } from '@/components/ui';

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-4xl text-center">
          <h1 className="text-5xl font-bold mb-6">
            Welcome to AECMS
          </h1>
          <p className="text-xl text-foreground/70 mb-8 max-w-2xl mx-auto">
            Advanced Ecommerce Content Management System - A modern, lightweight alternative to WordPress with integrated ecommerce.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/shop">
              <Button size="lg">Browse Shop</Button>
            </Link>
            <Link href="/blog">
              <Button variant="outline" size="lg">Read Blog</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 px-4 bg-foreground/5">
        <div className="container mx-auto max-w-6xl">
          <h2 className="text-3xl font-bold text-center mb-12">
            Why Choose AECMS?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <FeatureCard
              title="Lightweight & Fast"
              description="Built with modern technologies for optimal performance. No bloat, just what you need."
            />
            <FeatureCard
              title="Integrated Ecommerce"
              description="Full shopping cart, checkout, and payment processing with Stripe and PayPal."
            />
            <FeatureCard
              title="Content Management"
              description="Powerful article and page management with rich text editing and media library."
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4">
        <div className="container mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to get started?
          </h2>
          <p className="text-foreground/70 mb-8">
            Create an account today and start building your online presence.
          </p>
          <Link href="/auth/register">
            <Button size="lg">Create Account</Button>
          </Link>
        </div>
      </section>
    </>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-background p-6 rounded-lg border border-foreground/10">
      <h3 className="text-xl font-semibold mb-3">{title}</h3>
      <p className="text-foreground/70">{description}</p>
    </div>
  );
}
