import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SSOAuth } from '../SSOAuth';
import { SSOConfig } from '../../../shared/types';

// Mock the electron API
const mockElectronAPI = {
  sso: {
    authenticate: jest.fn(),
    logout: jest.fn(),
  }
};

(global as any).window = {
  electronAPI: mockElectronAPI
};

describe('SSOAuth Component', () => {
  const mockOnAuthenticate = jest.fn();
  const mockOnLogout = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders authentication form when not authenticated', () => {
    render(
      <SSOAuth
        onAuthenticate={mockOnAuthenticate}
        onLogout={mockOnLogout}
        isAuthenticated={false}
        isAuthenticating={false}
      />
    );

    expect(screen.getByText('AWS SSO Authentication')).toBeInTheDocument();
    expect(screen.getByLabelText(/SSO Start URL/)).toBeInTheDocument();
    expect(screen.getByLabelText(/AWS Region/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign In with AWS SSO/ })).toBeInTheDocument();
  });

  it('renders authenticated state when authenticated', () => {
    const config: SSOConfig = {
      startUrl: 'https://test.awsapps.com/start',
      region: 'us-east-1',
      sessionName: 'test-session'
    };

    render(
      <SSOAuth
        onAuthenticate={mockOnAuthenticate}
        onLogout={mockOnLogout}
        isAuthenticated={true}
        isAuthenticating={false}
        currentConfig={config}
      />
    );

    expect(screen.getByText('Successfully authenticated')).toBeInTheDocument();
    expect(screen.getByText('https://test.awsapps.com/start')).toBeInTheDocument();
    expect(screen.getByText('us-east-1')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Sign Out/ })).toBeInTheDocument();
  });

  it('calls onAuthenticate when form is submitted', async () => {
    render(
      <SSOAuth
        onAuthenticate={mockOnAuthenticate}
        onLogout={mockOnLogout}
        isAuthenticated={false}
        isAuthenticating={false}
      />
    );

    const startUrlInput = screen.getByLabelText(/SSO Start URL/);
    const regionSelect = screen.getByLabelText(/AWS Region/);
    const submitButton = screen.getByRole('button', { name: /Sign In with AWS SSO/ });

    fireEvent.change(startUrlInput, { target: { value: 'https://test.awsapps.com/start' } });
    fireEvent.change(regionSelect, { target: { value: 'us-west-2' } });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(mockOnAuthenticate).toHaveBeenCalledWith({
        startUrl: 'https://test.awsapps.com/start',
        region: 'us-west-2',
        sessionName: 'aws-network-flow-visualizer'
      });
    });
  });

  it('calls onLogout when sign out button is clicked', async () => {
    const config: SSOConfig = {
      startUrl: 'https://test.awsapps.com/start',
      region: 'us-east-1'
    };

    render(
      <SSOAuth
        onAuthenticate={mockOnAuthenticate}
        onLogout={mockOnLogout}
        isAuthenticated={true}
        isAuthenticating={false}
        currentConfig={config}
      />
    );

    const signOutButton = screen.getByRole('button', { name: /Sign Out/ });
    fireEvent.click(signOutButton);

    await waitFor(() => {
      expect(mockOnLogout).toHaveBeenCalled();
    });
  });

  it('shows loading state when authenticating', () => {
    render(
      <SSOAuth
        onAuthenticate={mockOnAuthenticate}
        onLogout={mockOnLogout}
        isAuthenticated={false}
        isAuthenticating={true}
      />
    );

    expect(screen.getByText('Authenticating...')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Authenticating.../ })).toBeDisabled();
  });

  it('displays authentication error', () => {
    render(
      <SSOAuth
        onAuthenticate={mockOnAuthenticate}
        onLogout={mockOnLogout}
        isAuthenticated={false}
        isAuthenticating={false}
        authError="Invalid SSO configuration"
      />
    );

    expect(screen.getByText('Authentication Error')).toBeInTheDocument();
    expect(screen.getByText('Invalid SSO configuration')).toBeInTheDocument();
  });

  it('shows advanced options when toggled', () => {
    render(
      <SSOAuth
        onAuthenticate={mockOnAuthenticate}
        onLogout={mockOnLogout}
        isAuthenticated={false}
        isAuthenticating={false}
      />
    );

    const advancedToggle = screen.getByText('Show Advanced Options');
    fireEvent.click(advancedToggle);

    expect(screen.getByLabelText(/Session Name/)).toBeInTheDocument();
    expect(screen.getByText('Hide Advanced Options')).toBeInTheDocument();
  });
});