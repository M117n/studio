import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AddMultipleItemsRequestComponent } from '@/components/inventory/AddMultipleItemsRequestComponent';

// Mock fetch
global.fetch = jest.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({}) })) as jest.Mock;

describe('AddMultipleItemsRequestComponent', () => {
  const unitOptions = ['kg', 'piece'];
  const subcategoryOptions = ['fruit', 'vegetables'];

  it('adds items to list and submits request', async () => {
    render(
      <AddMultipleItemsRequestComponent
        unitOptions={unitOptions}
        subcategoryOptions={subcategoryOptions}
        defaultSubcategory={'fruit'}
        userId="user1"
        userName="User One"
      />
    );

    fireEvent.change(screen.getByLabelText(/Item Name/i), { target: { value: 'Apples' } });
    fireEvent.change(screen.getByLabelText(/Quantity/i), { target: { value: '5' } });

    const form = document.querySelector('form');
    if (!form) throw new Error('form not found');
    fireEvent.submit(form);

    expect(await screen.findByText('Apples')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Send Addition Request/i }));
    fireEvent.click(screen.getByRole('button', { name: /Confirm/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
      const body = JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body);
      expect(body.requestedItems.length).toBe(1);
      expect(body.requestedItems[0].name).toBe('Apples');
    });
  });
});
