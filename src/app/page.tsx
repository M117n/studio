"use client";
import { AuthPanel } from "@/components/AuthPanel";
import { useAuth } from "@/hooks/useAuth";
import InventoryApp from "@/components/inventory/InventoryApp"; // ← new file, see below

export default function Home() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="container mx-auto p-4">
        <p>Loading…</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="container mx-auto p-4">
        <h1 className="text-2xl font-bold mb-4">Shawinv</h1>
        <AuthPanel />
      </div>
    );
  }

  // ✔ Authenticated – render everything that has hooks *inside* InventoryApp
  return <InventoryApp />;
}
