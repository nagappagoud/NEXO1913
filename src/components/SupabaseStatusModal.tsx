import React, { useState, useEffect } from 'react';
import { Database, CheckCircle2, XCircle, RefreshCw, Copy, ExternalLink, ShieldCheck, Code2, X, Server, Zap, Check } from 'lucide-react';
import { apiClient } from '../api';

interface SupabaseStatusModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SupabaseStatusModal({ isOpen, onClose }: SupabaseStatusModalProps) {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean;
    projectUrl: string;
    projectId: string;
    tablesDetected: string[];
    tablesMissing: string[];
    lastChecked: string;
    error?: string;
  } | null>(null);
  const [sqlData, setSqlData] = useState<{ sql: string; url: string; projectId: string } | null>(null);
  const [showSql, setShowSql] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const data = await apiClient.getSupabaseStatus();
      setStatus(data);
    } catch (e: any) {
      console.error('Failed to fetch Supabase status', e);
    } finally {
      setLoading(false);
    }
  };

  const fetchSql = async () => {
    try {
      const data = await apiClient.getSupabaseSql();
      setSqlData(data);
    } catch (e) {
      console.error('Failed to fetch SQL script', e);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      fetchSql();
    }
  }, [isOpen]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await apiClient.syncSupabase();
      if (res.success) {
        setSyncMessage('Successfully synced local records with Supabase database!');
        fetchStatus();
      } else {
        setSyncMessage('Sync finished with warnings. Ensure SQL tables exist in Supabase.');
      }
    } catch (e: any) {
      setSyncMessage(`Sync failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setSyncing(false);
    }
  };

  const copySql = () => {
    if (sqlData?.sql) {
      navigator.clipboard.writeText(sqlData.sql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (!isOpen) return null;

  const expectedTables = ['students', 'lecturers', 'subjects', 'timetable', 'attendance', 'face_profiles'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 overflow-y-auto">
      <div className="relative w-full max-w-3xl bg-[#0b0c10] border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden text-gray-200 my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 bg-[#12141d]/80">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 text-emerald-400">
              <Database className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                Supabase Database Core
                <span className="px-2 py-0.5 text-xs font-mono font-medium rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Project: {status?.projectId || 'qqjfpimvewpchyoxnjht'}
                </span>
              </h3>
              <p className="text-xs text-gray-400 font-mono">
                {status?.projectUrl || 'https://qqjfpimvewpchyoxnjht.supabase.co'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-[#161925] space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Status Indicator Banner */}
          <div className={`p-4 rounded-xl border flex items-start justify-between ${
            status?.connected
              ? 'bg-emerald-950/20 border-emerald-500/30 text-emerald-300'
              : 'bg-amber-950/20 border-amber-500/30 text-amber-300'
          }`}>
            <div className="flex items-start space-x-3">
              {status?.connected ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
              )}
              <div>
                <h4 className="font-semibold text-sm">
                  {status?.connected ? 'Supabase Connection Active' : 'Connecting to Supabase Endpoint...'}
                </h4>
                <p className="text-xs mt-1 opacity-90">
                  Integrated with Supabase project ID <code className="font-mono bg-black/40 px-1 py-0.5 rounded text-cyan-300">{status?.projectId || 'qqjfpimvewpchyoxnjht'}</code>. Data changes automatically sync to Supabase cloud tables.
                </p>
                {status?.lastChecked && (
                  <p className="text-[11px] mt-1 font-mono opacity-60">
                    Last Verified: {new Date(status.lastChecked).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={fetchStatus}
              disabled={loading}
              className="p-2 text-xs bg-gray-900/80 hover:bg-gray-800 border border-gray-700 rounded-lg flex items-center space-x-1 transition-all"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {/* Project Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-4 bg-[#12141d] border border-gray-800 rounded-xl space-y-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Project Endpoint</span>
              <div className="flex items-center justify-between text-sm font-mono text-cyan-300 truncate">
                <span className="truncate">{status?.projectUrl || 'https://qqjfpimvewpchyoxnjht.supabase.co'}</span>
                <a
                  href="https://supabase.com/dashboard/project/qqjfpimvewpchyoxnjht"
                  target="_blank"
                  rel="noreferrer"
                  className="ml-2 text-cyan-400 hover:text-cyan-200 transition-colors shrink-0"
                  title="Open Supabase Dashboard"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>

            <div className="p-4 bg-[#12141d] border border-gray-800 rounded-xl space-y-2">
              <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider block">Database Tables Status</span>
              <div className="text-sm font-mono text-gray-200">
                <span className="text-emerald-400 font-bold">{status?.tablesDetected.length || 0}</span> / {expectedTables.length} Active Tables Detected
              </div>
            </div>
          </div>

          {/* Table List Checklist */}
          <div className="bg-[#12141d] border border-gray-800 rounded-xl p-4">
            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Supabase PostgreSQL Schema Status</h4>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {expectedTables.map(tbl => {
                const detected = status?.tablesDetected.includes(tbl);
                return (
                  <div
                    key={tbl}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs font-mono ${
                      detected
                        ? 'bg-emerald-950/20 border-emerald-500/20 text-emerald-300'
                        : 'bg-gray-900/40 border-gray-800 text-gray-400'
                    }`}
                  >
                    <span>{tbl}</span>
                    {detected ? (
                      <span className="flex items-center text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                        <Check className="w-3 h-3 mr-0.5" /> Ready
                      </span>
                    ) : (
                      <span className="text-[10px] text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded border border-amber-500/20">
                        Pending SQL
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Manual Sync Control */}
          <div className="p-4 bg-[#12141d] border border-gray-800 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                <Zap className="w-4 h-4 text-cyan-400" /> Cloud Database Synchronization
              </h4>
              <p className="text-xs text-gray-400 mt-0.5">
                Push all active student, lecturer, attendance, and biometric records to Supabase cloud.
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={syncing}
              className="w-full sm:w-auto px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-medium text-xs rounded-xl shadow-lg transition-all flex items-center justify-center space-x-2 shrink-0 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing...' : 'Force Sync Now'}</span>
            </button>
          </div>

          {syncMessage && (
            <div className="p-3 bg-cyan-950/30 border border-cyan-500/30 text-cyan-300 text-xs rounded-xl font-mono">
              {syncMessage}
            </div>
          )}

          {/* SQL Setup Script Helper */}
          <div className="bg-[#12141d] border border-gray-800 rounded-xl overflow-hidden">
            <button
              onClick={() => setShowSql(!showSql)}
              className="w-full px-4 py-3 flex items-center justify-between text-xs font-semibold text-cyan-400 hover:bg-gray-800/50 transition-colors"
            >
              <span className="flex items-center space-x-2">
                <Code2 className="w-4 h-4" />
                <span>Supabase SQL Setup Script (Click to view / copy)</span>
              </span>
              <span className="text-gray-500 text-[10px] font-mono">{showSql ? 'Hide Script ▲' : 'Show Script ▼'}</span>
            </button>

            {showSql && (
              <div className="p-4 bg-black/60 border-t border-gray-800 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-400">
                    Paste this into the <a href="https://supabase.com/dashboard/project/qqjfpimvewpchyoxnjht/sql/new" target="_blank" rel="noreferrer" className="text-cyan-400 underline">Supabase SQL Editor</a> to create tables and grant RLS access.
                  </span>
                  <button
                    onClick={copySql}
                    className="px-3 py-1.5 text-xs bg-cyan-950/50 border border-cyan-500/40 text-cyan-300 hover:bg-cyan-900/60 rounded-lg flex items-center space-x-1.5 transition-all"
                  >
                    {copied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy SQL</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="p-3 bg-[#08090d] border border-gray-800 rounded-lg text-[11px] font-mono text-cyan-200/90 overflow-x-auto max-h-60 leading-relaxed">
                  {sqlData?.sql || 'Loading SQL script...'}
                </pre>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-800 bg-[#12141d]/80 text-xs text-gray-400">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            Supabase Client Initialized (@supabase/supabase-js)
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg text-xs transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
