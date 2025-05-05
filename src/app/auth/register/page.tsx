"use client";

import { AuthPanel } from '@/components/AuthPanel';

export default function RegisterPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Shawinv Register</h1>
      <AuthPanel initialMode="register" />
    </div>
  );
}