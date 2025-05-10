import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { InventoryForm } from '@/components/inventory/InventoryForm';
import { UNIT_OPTIONS, SUBCATEGORY_OPTIONS, getMainCategory } from '@/types/inventory';

describe('InventoryForm', () => {
  it('calls onAddItem with correct category based on selected subcategory', () => {
    const onAddItem = jest.fn();
    const defaultSubcategory = 'other';
    render(
      <InventoryForm
        onAddItem={onAddItem}
        unitOptions={UNIT_OPTIONS}
        subcategoryOptions={SUBCATEGORY_OPTIONS}
        defaultSubcategory={defaultSubcategory}
      />
    );

    // Fill in name and quantity
    fireEvent.change(screen.getByLabelText(/Name/i), { target: { value: 'Test Item' } });
    fireEvent.change(screen.getByLabelText(/Quantity/i), { target: { value: '3' } });

    // Change subcategory from default 'other' to 'fruit'
    // The InventoryForm renders two comboboxes: unit and category; select the second
    const combos = screen.getAllByRole('combobox');
    const categorySelect = combos[1];
    fireEvent.click(categorySelect);
    // Select the 'fruit' option from the dropdown
    const fruitOption = screen.getByRole('option', { name: 'fruit' });
    fireEvent.click(fruitOption);

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Add Item/i }));

    expect(onAddItem).toHaveBeenCalledWith({
      name: 'Test Item',
      quantity: 3,
      unit: UNIT_OPTIONS[0],
      subcategory: 'fruit',
      category: getMainCategory('fruit'),
    });
  });
});