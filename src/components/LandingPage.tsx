import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Shield, BookOpen, GraduationCap, ArrowRight, Eye, EyeOff, CheckCircle2, Cpu, Sparkles, Wifi } from 'lucide-react';
import { apiClient } from '../api';
import { UserSession } from '../types';

interface LandingPageProps {
  onLoginSuccess: (session: UserSession) => void;
}

export default function LandingPage({ onLoginSuccess }: LandingPageProps) {
  const [selectedRole, setSelectedRole] = useState<'student' | 'lecturer' | 'admin' | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Form Fields
  const [usn, setUsn] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleRoleSelect = (role: 'student' | 'lecturer' | 'admin') => {
    setSelectedRole(role);
    setErrorMsg('');
    setPassword('');
    setUsn('');
    setEmail('');
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      let session: UserSession;
      if (selectedRole === 'admin') {
        session = await apiClient.login({ role: 'admin', password });
      } else if (selectedRole === 'lecturer') {
        session = await apiClient.login({ role: 'lecturer', email, password });
      } else {
        session = await apiClient.login({ role: 'student', usn, password });
      }
      onLoginSuccess(session);
    } catch (err: any) {
      setErrorMsg(err.message || 'Authentication error.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#020617] text-gray-200 font-sans overflow-hidden py-12 px-4 selection:bg-cyan-500 selection:text-black">
      {/* Dynamic Background Cyber-Grid Decorator from Frosted Glass HTML */}
      <div className="absolute inset-0 pointer-events-none opacity-25 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(0,240,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.06)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-cyan-500/5 rounded-full blur-[120px]"></div>
      </div>

      {/* Main Container */}
      <div className="max-w-6xl mx-auto flex flex-col items-center relative z-10">
        {/* Header / Logo */}
        <div className="flex items-center space-x-3 mb-10">
          <div className="relative p-2.5 bg-cyan-950/20 backdrop-blur-md rounded-lg border border-cyan-500/30 cyan-pulse">
            <Cpu className="w-8 h-8 text-cyan-400" />
            <div className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-cyan-400 rounded-full animate-ping" />
          </div>
          <div>
            <h1 className="text-4xl font-black tracking-widest text-white font-display flex items-baseline">
              NEX
              <span className="text-cyan-400 neon-text-cyan">O</span>
            </h1>
            <span className="text-[10px] tracking-wider text-cyan-500/80 font-mono">SMART INTERFACE SYSTEM</span>
          </div>
        </div>

        {/* Hero Area */}
        <div className="text-center max-w-2xl mb-14">
          <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-cyan-950/40 border border-cyan-500/30 text-cyan-400 text-xs font-mono font-bold mb-4 backdrop-blur-md">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            <span>COLLEGE ARCHITECTURE V2.6 ONLINE</span>
          </span>
          <h2 className="text-3xl md:text-5xl font-extrabold text-white tracking-tight leading-none uppercase">
            Precision <span className="text-cyan-400 font-display block mt-1">Attendance</span>
          </h2>
          <p className="mt-4 text-cyan-100/70 text-base md:text-lg leading-relaxed max-w-md mx-auto">
            The ultimate full-stack smart management ecosystem. Eliminate friction with NEXO's automated tracking and real-time synchronization.
          </p>
        </div>

        {/* Portals Selector Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-5xl mb-12">
          {/* Card: Student */}
          <div
            onClick={() => handleRoleSelect('student')}
            id="portal-student-card"
            className={`cursor-pointer border rounded-xl p-6 transition-all duration-300 relative group flex flex-col justify-between h-56 backdrop-blur-md ${
              selectedRole === 'student'
                ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_25px_rgba(6,182,212,0.15)]'
                : 'border-cyan-500/20 bg-cyan-950/20 hover:bg-cyan-400/10 hover:border-cyan-400/80 hover:shadow-lg'
            }`}
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/20 transition-all">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold text-cyan-500/80 border border-cyan-500/20 px-2 py-0.5 rounded uppercase">PORTAL_01</span>
              </div>
              <h3 className="text-xl font-bold text-white font-display group-hover:text-cyan-400 transition-colors uppercase">STUDENT PULSE</h3>
              <p className="text-xs text-cyan-100/60 mt-2 font-sans leading-relaxed">Enter USN identifiers, view percentages, and check in to secure beacon sessions.</p>
            </div>
            <div className="flex items-center text-xs text-cyan-400 font-mono mt-4 font-semibold">
              <span>INITIALIZE PORTAL</span>
              <ArrowRight className="w-4 h-4 ml-1.5 transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>

          {/* Card: Lecturer */}
          <div
            onClick={() => handleRoleSelect('lecturer')}
            id="portal-lecturer-card"
            className={`cursor-pointer border rounded-xl p-6 transition-all duration-300 relative group flex flex-col justify-between h-56 backdrop-blur-md ${
              selectedRole === 'lecturer'
                ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_25px_rgba(6,182,212,0.15)]'
                : 'border-cyan-500/20 bg-cyan-950/20 hover:bg-cyan-400/10 hover:border-cyan-400/80 hover:shadow-lg'
            }`}
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/20 transition-all">
                  <BookOpen className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold text-cyan-500/80 border border-cyan-500/20 px-2 py-0.5 rounded uppercase">PORTAL_02</span>
              </div>
              <h3 className="text-xl font-bold text-white font-display group-hover:text-cyan-400 transition-colors uppercase">Lecturer Hub</h3>
              <p className="text-xs text-cyan-100/60 mt-2 font-sans leading-relaxed">Activate attendance scanning targets, track logs, and record academic sessions.</p>
            </div>
            <div className="flex items-center text-xs text-cyan-400 font-mono mt-4 font-semibold">
              <span>INITIALIZE PORTAL</span>
              <ArrowRight className="w-4 h-4 ml-1.5 transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>

          {/* Card: Admin */}
          <div
            onClick={() => handleRoleSelect('admin')}
            id="portal-admin-card"
            className={`cursor-pointer border rounded-xl p-6 transition-all duration-300 relative group flex flex-col justify-between h-56 backdrop-blur-md ${
              selectedRole === 'admin'
                ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_25px_rgba(6,182,212,0.15)]'
                : 'border-cyan-500/20 bg-cyan-950/20 hover:bg-cyan-400/10 hover:border-cyan-400/80 hover:shadow-lg'
            }`}
          >
            <div>
              <div className="flex justify-between items-start mb-4">
                <div className="p-3 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400 group-hover:bg-cyan-500/20 transition-all">
                  <Shield className="w-6 h-6" />
                </div>
                <span className="text-[10px] font-mono font-bold text-cyan-500/80 border border-cyan-500/20 px-2 py-0.5 rounded uppercase">CRITICAL_00</span>
              </div>
              <h3 className="text-xl font-bold text-white font-display group-hover:text-cyan-400 transition-colors uppercase">Admin Portal</h3>
              <p className="text-xs text-cyan-100/60 mt-2 font-sans leading-relaxed">Manage college nodes, registers, courses timetabling, and review overall percentages.</p>
            </div>
            <div className="flex items-center text-xs text-cyan-400 font-mono mt-4 font-semibold">
              <span>INITIALIZE PORTAL</span>
              <ArrowRight className="w-4 h-4 ml-1.5 transform group-hover:translate-x-1.5 transition-transform" />
            </div>
          </div>
        </div>

        {/* Animated Dropdown Login Form */}
        {selectedRole && (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="w-full max-w-md border border-cyan-400/20 rounded-xl p-6 md:p-8 bg-cyan-950/20 backdrop-blur-xl shadow-2xl relative"
          >
            {/* Visual scanned horizontal line inside login card */}
            <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60 animate-pulse" />

            <h4 className="text-xl font-bold font-display text-white text-center tracking-wider mb-2">
              AUTHORIZE: {selectedRole.toUpperCase()}
            </h4>
            <p className="text-xs text-center text-cyan-100/50 mb-6 font-mono">
              Provide credential parameters to open gateway protocols.
            </p>

            <form onSubmit={handleLogin} className="space-y-5">
              {selectedRole === 'student' && (
                <div>
                  <label className="block text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-2 font-medium">
                    University Seat Number (USN)
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="1NX22CS001"
                    className="w-full bg-slate-950/45 text-white placeholder-cyan-900 border border-cyan-500/20 rounded-md px-4 py-3 focus:outline-none focus:border-cyan-400 transition-all focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm font-mono"
                    value={usn}
                    onChange={(e) => setUsn(e.target.value)}
                  />
                </div>
              )}

              {selectedRole === 'lecturer' && (
                <div>
                  <label className="block text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-2 font-medium">
                    Lector Cybernetic Email
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="aris@nexo.edu"
                    className="w-full bg-slate-950/45 text-white placeholder-cyan-900 border border-cyan-500/20 rounded-md px-4 py-3 focus:outline-none focus:border-cyan-400 transition-all focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm font-mono"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              )}

              <div>
                <label className="block text-[11px] font-mono text-cyan-400 uppercase tracking-wider mb-2 font-medium">
                  Key Signature (Password)
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    placeholder={selectedRole === 'admin' ? '••••••••' : 'password'}
                    className="w-full bg-slate-950/45 text-white placeholder-cyan-900 border border-cyan-500/20 rounded-md pl-4 pr-10 py-3 focus:outline-none focus:border-cyan-400 transition-all focus:shadow-[0_0_15px_rgba(6,182,212,0.1)] text-sm"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-cyan-400 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                  </button>
                </div>
              </div>

              {errorMsg && (
                <div className="p-3 rounded border border-red-500/30 bg-red-950/20 text-red-400 text-xs font-mono text-center">
                  ⚠️ {errorMsg}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-2 font-display bg-cyan-700/60 font-bold tracking-widest text-white border border-cyan-400/80 rounded-md py-3 text-sm hover:bg-cyan-500 hover:text-black hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] transition-all cursor-pointer disabled:opacity-50"
              >
                {loading ? 'PROCESSING SECURE DECRYPT...' : 'COMPILE GATEWAY KEY'}
              </button>
            </form>

            {/* Quick Testing Seed Instructions Accordion */}
            <div className="mt-6 border-t border-cyan-500/10 pt-4">
              <span className="text-[10px] font-mono font-bold text-cyan-500 block mb-2 uppercase">
                ⚙️ Quick testing credentials
              </span>
              <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-cyan-300/80 bg-slate-950/40 p-2.5 rounded border border-cyan-500/10 backdrop-blur-sm">
                {selectedRole === 'admin' ? (
                  <div className="col-span-2">
                    <p className="text-cyan-400/90 font-bold">Admin Code Key:</p>
                    <p className="text-white mt-0.5">Password: <code className="bg-cyan-950/50 text-cyan-300 font-bold px-1 py-0.2 rounded">Nap@1913</code></p>
                  </div>
                ) : selectedRole === 'lecturer' ? (
                  <>
                    <div>
                      <p className="text-cyan-400/90 font-bold">Dr. Aris Thorne:</p>
                      <p>aris@nexo.edu</p>
                      <p>pass: <code className="text-white bg-slate-950/35 px-1 rounded">password</code></p>
                    </div>
                    <div>
                      <p className="text-cyan-400/90 font-bold">Dr. Elena Pierce:</p>
                      <p>elena@nexo.edu</p>
                      <p>pass: <code className="text-white bg-slate-950/35 px-1 rounded">password</code></p>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <p className="text-cyan-400/90 font-bold">Student Aero Chen:</p>
                      <p>USN: 1NX22CS001</p>
                      <p>pass: <code className="text-white bg-slate-950/35 px-1 rounded">password</code></p>
                    </div>
                    <div>
                      <p className="text-cyan-400/90 font-bold">Student Kira Vance:</p>
                      <p>USN: 1NX22CS042</p>
                      <p>pass: <code className="text-white bg-slate-950/35 px-1 rounded">password</code></p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Feature Icons Section */}
        <div className="mt-14 w-full border-t border-cyan-500/10 pt-12">
          <h4 className="text-center text-xs font-mono tracking-[0.25em] text-cyan-400/80 uppercase mb-8">
            NEXO CYBERNETIC COGNITION GRIDFEATURES
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="p-4 bg-cyan-950/15 backdrop-blur-md border border-cyan-500/15 hover:border-cyan-400/60 rounded-lg transition-all duration-300">
              <div className="text-cyan-400 mb-2">
                <Wifi className="w-5 h-5" />
              </div>
              <h5 className="text-white text-xs font-bold uppercase tracking-wider mb-1 font-display">Live Scanning</h5>
              <p className="text-cyan-100/50 text-[11px] font-sans leading-relaxed">Lecturers spin up smart active virtual scan beacons allowing rapid local check-ins.</p>
            </div>
            <div className="p-4 bg-cyan-950/15 backdrop-blur-md border border-cyan-500/15 hover:border-cyan-400/60 rounded-lg transition-all duration-300">
              <div className="text-cyan-400 mb-2">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h5 className="text-white text-xs font-bold uppercase tracking-wider mb-1 font-display">Quantum Reports</h5>
              <p className="text-cyan-100/50 text-[11px] font-sans leading-relaxed">Instantly compile and map attendance values for custom metrics or alerts.</p>
            </div>
            <div className="p-4 bg-cyan-950/15 backdrop-blur-md border border-cyan-500/15 hover:border-cyan-400/60 rounded-lg transition-all duration-300">
              <div className="text-cyan-400 mb-2">
                <BookOpen className="w-5 h-5" />
              </div>
              <h5 className="text-white text-xs font-bold uppercase tracking-wider mb-1 font-display">Node Timetable</h5>
              <p className="text-cyan-100/50 text-[11px] font-sans leading-relaxed">Fully synchronized timetable logs with active classrooms and scheduled hours.</p>
            </div>
            <div className="p-4 bg-cyan-950/15 backdrop-blur-md border border-cyan-500/15 hover:border-cyan-400/60 rounded-lg transition-all duration-300">
              <div className="text-cyan-400 mb-2">
                <Shield className="w-5 h-5" />
              </div>
              <h5 className="text-white text-xs font-bold uppercase tracking-wider mb-1 font-display">Biometric Ready</h5>
              <p className="text-cyan-100/50 text-[11px] font-sans leading-relaxed">Prepared security hooks to transition to face signature verifiers instantly.</p>
            </div>
          </div>
        </div>

        {/* Humility system metadata footer as requested - keep margins clean and professional */}
        <div className="mt-16 text-center text-cyan-700 text-[11px] font-mono tracking-wider">
          SYSTEM NEXO OPERATIONAL // 2026 UNIVERSITY INFRASTRUCTURE GRID
        </div>
      </div>
    </div>
  );
}
