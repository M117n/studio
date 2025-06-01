import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { InventoryList } from '@/components/inventory/InventoryList';
import type { InventoryItem, Unit, Category } from '@/types/inventory';

describe('InventoryList integration', () => {
  const inventory = [
    { id: '1', name: 'Apple', quantity: 5, unit: 'kg' as Unit, category: 'cooler' as Category, subcategory: 'fruit' as const },
  ];
  const onDeleteItem = jest.fn();
  const onEditItem = jest.fn();
  const defaultUnit: Unit = 'kg';
  const convertUnits = (_value: number, _from: string, _to: string) => _value;

  it('renders inventory items when category is expanded', async () => {
    const user = userEvent.setup();
    render(
      <InventoryList
        inventory={inventory}
        onDeleteItem={onDeleteItem}
        onEditItem={onEditItem}
        defaultUnit={defaultUnit}
        convertUnits={convertUnits}
        subcategoryOptions={[]}
        unitOptions={[]}
        searchQuery=""
      />
    );
    // Ensure category header is rendered
    const coolerHeader = screen.getByText('Cooler');
    expect(coolerHeader).toBeInTheDocument();
    // Expand the Cooler category accordion within act to handle state updates
    await act(async () => {
      await user.click(coolerHeader);
    });
    // After expanding main category, expand the Fruit subcategory
    const fruitHeader = screen.getByText('Fruit');
    expect(fruitHeader).toBeInTheDocument();
    // Expand the Fruit subcategory accordion
    await act(async () => {
      await user.click(fruitHeader);
    });
    // Check that the item details are rendered
    expect(screen.getByText('Apple')).toBeInTheDocument();
    // Quantity should be formatted to two decimal places
    expect(screen.getByText('5.00')).toBeInTheDocument();
    // Unit should reflect the default unit after conversion
    expect(screen.getByText(defaultUnit)).toBeInTheDocument();
  });
});