import AdminGuard from "@/components/AdminGuard";

export default function AdminDashboard() {
  return (
    <AdminGuard>
      <h1>Admin Dashboard</h1>
      {/* Admin-only UI */}
    </AdminGuard>
  );
}