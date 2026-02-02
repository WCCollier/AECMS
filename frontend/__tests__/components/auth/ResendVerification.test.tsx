import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ResendVerification } from '@/components/auth/ResendVerification';
import api from '@/lib/api';

// Mock the api module
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
  getErrorMessage: jest.fn((error) => {
    if (error?.response?.data?.message) {
      return error.response.data.message;
    }
    return error?.message || 'An error occurred';
  }),
}));

const mockApi = api as jest.Mocked<typeof api>;

// Helper to get email input (since Input component doesn't have proper htmlFor association)
const getEmailInput = () => screen.getByPlaceholderText('you@example.com') as HTMLInputElement;

describe('ResendVerification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders email input and submit button', () => {
    render(<ResendVerification />);
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(getEmailInput()).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /resend verification email/i })).toBeInTheDocument();
  });

  it('uses initial email when provided', () => {
    render(<ResendVerification initialEmail="test@example.com" />);
    const input = getEmailInput();
    expect(input.value).toBe('test@example.com');
  });

  it('updates email on input change', () => {
    render(<ResendVerification />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'new@example.com' } });
    expect(input.value).toBe('new@example.com');
  });

  it('calls API and shows success message on successful submission', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: 'Email sent' } });

    render(<ResendVerification />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }));

    await waitFor(() => {
      expect(mockApi.post).toHaveBeenCalledWith('/auth/resend-verification', { email: 'test@example.com' });
    });

    await waitFor(() => {
      expect(screen.getByText(/verification email has been sent/i)).toBeInTheDocument();
    });
  });

  it('shows error message on API failure', async () => {
    mockApi.post.mockRejectedValueOnce({
      response: { data: { message: 'Email is already verified' } },
    });

    render(<ResendVerification />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'verified@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }));

    await waitFor(() => {
      expect(screen.getByText(/email is already verified/i)).toBeInTheDocument();
    });
  });

  it('calls onSuccess callback when verification email is sent', async () => {
    mockApi.post.mockResolvedValueOnce({ data: { message: 'Email sent' } });
    const onSuccess = jest.fn();

    render(<ResendVerification onSuccess={onSuccess} />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button', { name: /resend verification email/i }));

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalled();
    });
  });

  it('applies custom className', () => {
    const { container } = render(<ResendVerification className="custom-class" />);
    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('disables button and shows loading state during submission', async () => {
    mockApi.post.mockImplementation(() => new Promise((resolve) => setTimeout(resolve, 100)));

    render(<ResendVerification />);
    const input = getEmailInput();
    fireEvent.change(input, { target: { value: 'test@example.com' } });
    fireEvent.click(screen.getByRole('button'));

    await waitFor(() => {
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveTextContent(/loading/i);
    });
  });
});
