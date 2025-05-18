// InventoryList.case‑unit.test.tsx
it("renders quantity in original unit when defaultUnit differs", () => {
    render(<InventoryList
      inventory={[{ id:"1", name:"Soda", quantity:24, unit:"case", category:"dry", subcategory:"other"}]}
      defaultUnit="kg"
      /* …other required props… */
    />);
    expect(screen.getByText(/24\s*case/i)).toBeInTheDocument();
  });
  