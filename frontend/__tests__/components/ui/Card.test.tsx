import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter
} from '@/components/ui/Card';

describe('Card Components', () => {
  describe('Card', () => {
    it('renders children correctly', () => {
      render(<Card>Card content</Card>);
      expect(screen.getByText('Card content')).toBeInTheDocument();
    });

    it('applies base styles', () => {
      render(<Card>Content</Card>);
      const card = screen.getByText('Content');
      expect(card.className).toContain('bg-background');
      expect(card.className).toContain('rounded-lg');
      expect(card.className).toContain('shadow-sm');
    });

    it('applies custom className', () => {
      render(<Card className="my-custom-class">Content</Card>);
      const card = screen.getByText('Content');
      expect(card.className).toContain('my-custom-class');
    });
  });

  describe('CardHeader', () => {
    it('renders children correctly', () => {
      render(<CardHeader>Header content</CardHeader>);
      expect(screen.getByText('Header content')).toBeInTheDocument();
    });

    it('applies padding styles', () => {
      render(<CardHeader>Header</CardHeader>);
      const header = screen.getByText('Header');
      expect(header.className).toContain('px-6');
      expect(header.className).toContain('py-4');
    });

    it('has bottom border', () => {
      render(<CardHeader>Header</CardHeader>);
      expect(screen.getByText('Header').className).toContain('border-b');
    });

    it('applies custom className', () => {
      render(<CardHeader className="custom-header">Header</CardHeader>);
      expect(screen.getByText('Header').className).toContain('custom-header');
    });
  });

  describe('CardTitle', () => {
    it('renders children correctly', () => {
      render(<CardTitle>My Title</CardTitle>);
      expect(screen.getByText('My Title')).toBeInTheDocument();
    });

    it('renders as h3 element', () => {
      render(<CardTitle>Title</CardTitle>);
      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Title');
    });

    it('applies font styles', () => {
      render(<CardTitle>Title</CardTitle>);
      const title = screen.getByText('Title');
      expect(title.className).toContain('text-lg');
      expect(title.className).toContain('font-semibold');
    });

    it('applies custom className', () => {
      render(<CardTitle className="custom-title">Title</CardTitle>);
      expect(screen.getByText('Title').className).toContain('custom-title');
    });
  });

  describe('CardDescription', () => {
    it('renders children correctly', () => {
      render(<CardDescription>Description text</CardDescription>);
      expect(screen.getByText('Description text')).toBeInTheDocument();
    });

    it('applies small text style', () => {
      render(<CardDescription>Description</CardDescription>);
      expect(screen.getByText('Description').className).toContain('text-sm');
    });

    it('applies custom className', () => {
      render(<CardDescription className="custom-desc">Description</CardDescription>);
      expect(screen.getByText('Description').className).toContain('custom-desc');
    });
  });

  describe('CardContent', () => {
    it('renders children correctly', () => {
      render(<CardContent>Main content</CardContent>);
      expect(screen.getByText('Main content')).toBeInTheDocument();
    });

    it('applies padding styles', () => {
      render(<CardContent>Content</CardContent>);
      const content = screen.getByText('Content');
      expect(content.className).toContain('px-6');
      expect(content.className).toContain('py-4');
    });

    it('applies custom className', () => {
      render(<CardContent className="custom-content">Content</CardContent>);
      expect(screen.getByText('Content').className).toContain('custom-content');
    });
  });

  describe('CardFooter', () => {
    it('renders children correctly', () => {
      render(<CardFooter>Footer content</CardFooter>);
      expect(screen.getByText('Footer content')).toBeInTheDocument();
    });

    it('has top border', () => {
      render(<CardFooter>Footer</CardFooter>);
      expect(screen.getByText('Footer').className).toContain('border-t');
    });

    it('applies padding styles', () => {
      render(<CardFooter>Footer</CardFooter>);
      const footer = screen.getByText('Footer');
      expect(footer.className).toContain('px-6');
      expect(footer.className).toContain('py-4');
    });

    it('applies custom className', () => {
      render(<CardFooter className="custom-footer">Footer</CardFooter>);
      expect(screen.getByText('Footer').className).toContain('custom-footer');
    });
  });

  describe('Composed Card', () => {
    it('renders a complete card structure', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Product Card</CardTitle>
            <CardDescription>A great product</CardDescription>
          </CardHeader>
          <CardContent>
            <p>Product details here</p>
          </CardContent>
          <CardFooter>
            <button>Buy Now</button>
          </CardFooter>
        </Card>
      );

      expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Product Card');
      expect(screen.getByText('A great product')).toBeInTheDocument();
      expect(screen.getByText('Product details here')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Buy Now' })).toBeInTheDocument();
    });
  });
});
