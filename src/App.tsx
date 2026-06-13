/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import AdminPortal from './components/AdminPortal';
import LecturerPortal from './components/LecturerPortal';
import StudentPortal from './components/StudentPortal';
import { UserSession } from './types';

const STORAGE_KEY = 'nexo_user_session';

export default function App() {
  const [session, setSession] = useState<UserSession | null>(null);

  // Re-hydrate session from localStorage on initial build cycle
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSession(JSON.parse(saved));
      } catch (e) {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const handleLoginSuccess = (newSession: UserSession) => {
    setSession(newSession);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSession));
  };

  const handleLogout = () => {
    setSession(null);
    localStorage.removeItem(STORAGE_KEY);
  };

  if (!session) {
    return <LandingPage onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="min-h-screen bg-[#050508] text-gray-200">
      {session.role === 'admin' && (
        <AdminPortal session={session} onLogout={handleLogout} />
      )}
      {session.role === 'lecturer' && (
        <LecturerPortal session={session} onLogout={handleLogout} />
      )}
      {session.role === 'student' && (
        <StudentPortal session={session} onLogout={handleLogout} />
      )}
    </div>
  );
}
