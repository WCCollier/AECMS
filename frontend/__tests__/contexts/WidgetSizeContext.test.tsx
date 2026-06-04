import React from 'react';
import { render, screen } from '@testing-library/react';
import { WidgetSizeProvider, useWidgetSize } from '@/contexts/WidgetSizeContext';

function Consumer() {
  const size = useWidgetSize();
  return <div data-testid="size">{size}</div>;
}

describe('WidgetSizeContext', () => {
  it('defaults to "large" without a provider', () => {
    render(<Consumer />);
    expect(screen.getByTestId('size').textContent).toBe('large');
  });

  it('provides "large" when provider is set to large', () => {
    render(
      <WidgetSizeProvider size="large">
        <Consumer />
      </WidgetSizeProvider>,
    );
    expect(screen.getByTestId('size').textContent).toBe('large');
  });

  it('provides "small" when provider is set to small', () => {
    render(
      <WidgetSizeProvider size="small">
        <Consumer />
      </WidgetSizeProvider>,
    );
    expect(screen.getByTestId('size').textContent).toBe('small');
  });

  it('inner provider overrides outer provider', () => {
    render(
      <WidgetSizeProvider size="large">
        <WidgetSizeProvider size="small">
          <Consumer />
        </WidgetSizeProvider>
      </WidgetSizeProvider>,
    );
    expect(screen.getByTestId('size').textContent).toBe('small');
  });
});
