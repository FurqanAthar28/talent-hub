'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiFetch } from '../api/client';

export default function Navbar() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await apiFetch('/accounts/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      router.push('/signin');
    }
  }

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link href="/dashboard" className="navbar-brand">
          ProfessionalHub
        </Link>
        <div className="navbar-links">
          <Link href="/dashboard" className="nav-link">Home</Link>
          <Link href="/profile" className="nav-link">Profile</Link>
          <Link href="/connections" className="nav-link">My Network</Link>
          <button
            type="button"
            className="navbar-logout"
            onClick={handleLogout}
            disabled={loggingOut}
          >
            {loggingOut ? 'Logging out...' : 'Logout'}
          </button>
        </div>
      </div>
    </nav>
  );
}