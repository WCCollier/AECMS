import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('renders input element', () => {
    render(<Input placeholder="Enter text" />);
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument();
  });

  it('renders label when provided', () => {
    render(<Input label="Email" name="email" />);
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('associates label with input via id', () => {
    render(<Input label="Username" id="username" />);
    const input = screen.getByLabelText('Username');
    expect(input).toHaveAttribute('id', 'username');
  });

  it('uses name as id fallback when id is not provided', () => {
    render(<Input label="Password" name="password" />);
    const input = screen.getByLabelText('Password');
    expect(input).toHaveAttribute('id', 'password');
  });

  it('displays error message when error prop is provided', () => {
    render(<Input error="This field is required" />);
    expect(screen.getByText('This field is required')).toBeInTheDocument();
  });

  it('applies error styling when error is present', () => {
    render(<Input error="Error" data-testid="error-input" />);
    const input = screen.getByTestId('error-input');
    expect(input.className).toContain('border-red-500');
  });

  it('displays hint message when provided', () => {
    render(<Input hint="Enter at least 8 characters" />);
    expect(screen.getByText('Enter at least 8 characters')).toBeInTheDocument();
  });

  it('hides hint when error is present', () => {
    render(<Input hint="Hint text" error="Error text" />);
    expect(screen.queryByText('Hint text')).not.toBeInTheDocument();
    expect(screen.getByText('Error text')).toBeInTheDocument();
  });

  it('handles value changes', () => {
    const handleChange = jest.fn();
    render(<Input onChange={handleChange} placeholder="Type here" />);
    fireEvent.change(screen.getByPlaceholderText('Type here'), {
      target: { value: 'test value' },
    });
    expect(handleChange).toHaveBeenCalled();
  });

  it('can be disabled', () => {
    render(<Input disabled placeholder="Disabled" />);
    expect(screen.getByPlaceholderText('Disabled')).toBeDisabled();
  });

  it('applies custom className', () => {
    render(<Input className="custom-input" data-testid="custom" />);
    expect(screen.getByTestId('custom').className).toContain('custom-input');
  });

  it('forwards ref correctly', () => {
    const ref = { current: null };
    render(<Input ref={ref} />);
    expect(ref.current).toBeInstanceOf(HTMLInputElement);
  });

  it('passes additional HTML attributes', () => {
    render(
      <Input
        type="email"
        required
        maxLength={50}
        data-testid="email-input"
      />
    );
    const input = screen.getByTestId('email-input');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('maxLength', '50');
  });

  it('supports controlled input', () => {
    const { rerender } = render(
      <Input value="initial" onChange={() => {}} data-testid="controlled" />
    );
    expect(screen.getByTestId('controlled')).toHaveValue('initial');

    rerender(
      <Input value="updated" onChange={() => {}} data-testid="controlled" />
    );
    expect(screen.getByTestId('controlled')).toHaveValue('updated');
  });
});
