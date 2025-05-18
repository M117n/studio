'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface AdminUser {
  uid: string;
  name: string;
  email: string;
  role: string;
  picture?: string;
}

export function AdminNavbar() {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pathname = usePathname();

  useEffect(() => {
    const fetchAdminUser = async () => {
      setIsLoading(true);
      try {
        const response = await fetch('/api/auth/me');
        if (!response.ok) {
          throw new Error('Not authenticated or server error');
        }
        const userData: AdminUser = await response.json();
        if (userData.role !== 'admin') {
          setError("Access Denied: Admin privileges required");
          setAdminUser(null);
        } else {
          setAdminUser(userData);
        }
      } catch (err: any) {
        console.error("Auth fetch error:", err);
        setError(err.message || 'Authentication error');
        setAdminUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAdminUser();
  }, []);

  if (isLoading) {
    return (
      <div className="bg-slate-100 border-b p-4">
        <p className="text-sm text-center">Loading admin navigation...</p>
      </div>
    );
  }

  if (error || !adminUser) {
    return (
      <div className="bg-red-50 border-b border-red-200 p-4">
        <p className="text-sm text-red-600 text-center">
          {error || "Not authenticated as admin"}
        </p>
      </div>
    );
  }

  const navItems = [
    { href: '/admin/dashboard', label: 'Admin Dashboard' },
    { href: '/admin/requests', label: 'Removal Requests' },
    { href: '/admin/make-admin', label: 'Make Admin' },
  ];

  return (
    <div className="bg-slate-800 text-white p-4">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between">
        <div className="flex items-center mb-4 sm:mb-0">
          <span className="font-semibold mr-2">Admin Panel</span>
          <span className="text-xs bg-slate-700 px-2 py-1 rounded-full">
            {adminUser.name}
          </span>
        </div>
        
        <nav className="flex space-x-1 sm:space-x-4">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 text-sm rounded-md transition-colors ${
                pathname === item.href
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-300 hover:bg-slate-700 hover:text-white'
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/"
            className="px-3 py-2 text-sm text-slate-300 hover:bg-slate-700 hover:text-white rounded-md transition-colors"
          >
            Back to Main Site
          </Link>
        </nav>
      </div>
    </div>
  );
}
