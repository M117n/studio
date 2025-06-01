'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

export default function AccessDeniedPage() {
  return (
    <div className="container mx-auto max-w-md py-24">
      <Card className="shadow-lg border-red-200">
        <CardHeader className="bg-red-50 border-b border-red-100">
          <CardTitle className="text-red-700">Access Denied</CardTitle>
        </CardHeader>
        <CardContent className="py-6">
          <div className="flex flex-col items-center text-center space-y-4">
            <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <p className="text-gray-600">
              You do not have permission to access this page. This area is restricted to admin users only.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-center border-t pt-4">
          <Link href="/">
            <Button variant="outline">Return to Home</Button>
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
