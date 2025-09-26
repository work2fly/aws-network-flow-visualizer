import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { store } from './store/store';
import App from './App';

describe('App Component', () => {
  it('renders the main heading', () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    const heading = screen.getByText('AWS Network Flow Visualizer');
    expect(heading).toBeInTheDocument();
  });

  it('renders the navigation tabs', () => {
    render(
      <Provider store={store}>
        <App />
      </Provider>
    );

    // Check for navigation tabs that should exist
    const authTab = screen.getByText('Authentication');
    expect(authTab).toBeInTheDocument();
  });
});
