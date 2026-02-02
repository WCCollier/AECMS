import { render, screen, waitFor } from '@testing-library/react';
import { VerifyEmailPageClient } from '@/app/auth/verify-email/VerifyEmailPageClient';
import api from '@/lib/api';

// Mock next/navigation
const mockSearchParams = new Map<string, string>();
jest.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: (key: string) => mockSearchParams.get(key) || null,
  }),
}));

// Mock the api module
jest.mock('@/lib/api', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
  getErrorMessage: jest.fn((error) => {
    if (error?.response?.data?.message) {
      return error.response.data.message;
    }
    return error?.message || 'An error occurred';
  }),
}));

const mockApi = api as jest.Mocked<typeof api>;

describe('VerifyEmailPageClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams.clear();
  });

  it('shows no-token state when no token is provided', () => {
    render(<VerifyEmailPageClient />);
    expect(screen.getByText(/invalid verification link/i)).toBeInTheDocument();
    expect(screen.getByText(/no verification token was provided/i)).toBeInTheDocument();
  });

  it('shows loading state initially when token is provided', () => {
    mockSearchParams.set('token', 'valid-token');
    mockApi.get.mockImplementation(() => new Promise(() => {})); // Never resolves

    render(<VerifyEmailPageClient />);
    expect(screen.getByText(/verifying your email address/i)).toBeInTheDocument();
    expect(screen.getByText(/please wait while we verify/i)).toBeInTheDocument();
  });

  it('shows success state when verification succeeds', async () => {
    mockSearchParams.set('token', 'valid-token');
    mockApi.get.mockResolvedValueOnce({ data: { message: 'Email verified' } });

    render(<VerifyEmailPageClient />);

    await waitFor(() => {
      expect(screen.getByText(/your email has been verified/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/successfully verified/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /sign in/i })).toBeInTheDocument();
  });

  it('shows error state when verification fails', async () => {
    mockSearchParams.set('token', 'invalid-token');
    mockApi.get.mockRejectedValueOnce({
      response: { data: { message: 'Invalid or expired token' } },
    });

    render(<VerifyEmailPageClient />);

    await waitFor(() => {
      expect(screen.getByText(/verification failed/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/invalid or expired token/i)).toBeInTheDocument();
    expect(screen.getByText(/verification link may have expired/i)).toBeInTheDocument();
  });

  it('calls API with correct token', async () => {
    mockSearchParams.set('token', 'my-verification-token');
    mockApi.get.mockResolvedValueOnce({ data: { message: 'Email verified' } });

    render(<VerifyEmailPageClient />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/auth/verify-email?token=my-verification-token');
    });
  });

  it('encodes token in URL to handle special characters', async () => {
    mockSearchParams.set('token', 'token+with=special&chars');
    mockApi.get.mockResolvedValueOnce({ data: { message: 'Email verified' } });

    render(<VerifyEmailPageClient />);

    await waitFor(() => {
      expect(mockApi.get).toHaveBeenCalledWith('/auth/verify-email?token=token%2Bwith%3Dspecial%26chars');
    });
  });

  it('shows sign in link on success', async () => {
    mockSearchParams.set('token', 'valid-token');
    mockApi.get.mockResolvedValueOnce({ data: { message: 'Email verified' } });

    render(<VerifyEmailPageClient />);

    await waitFor(() => {
      const signInLink = screen.getByRole('link', { name: /sign in/i });
      expect(signInLink).toHaveAttribute('href', '/auth/login');
    });
  });

  it('shows back to login link on error', async () => {
    mockSearchParams.set('token', 'invalid-token');
    mockApi.get.mockRejectedValueOnce({
      response: { data: { message: 'Token expired' } },
    });

    render(<VerifyEmailPageClient />);

    await waitFor(() => {
      const backLink = screen.getByRole('link', { name: /back to login/i });
      expect(backLink).toHaveAttribute('href', '/auth/login');
    });
  });

  it('shows back to login link when no token provided', () => {
    render(<VerifyEmailPageClient />);
    const backLink = screen.getByRole('link', { name: /back to login/i });
    expect(backLink).toHaveAttribute('href', '/auth/login');
  });

  it('renders AECMS logo link', () => {
    render(<VerifyEmailPageClient />);
    const logoLink = screen.getByRole('link', { name: /aecms/i });
    expect(logoLink).toHaveAttribute('href', '/');
  });
});
