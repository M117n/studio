"use client";

import { Suspense } from "react";
import { AuthPanel } from '@/components/AuthPanel';

export default function LoginPage() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Shawinv Login</h1>
      <Suspense fallback={<div>Cargando...</div>}>
        <AuthPanel initialMode="login" />
      </Suspense>
    </div>
  );
}
