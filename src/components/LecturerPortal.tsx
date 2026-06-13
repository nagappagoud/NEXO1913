import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  BookOpen, Clock, BarChart3, LogOut, CheckCircle2, UserCheck, 
  RefreshCw, Wifi, Award, Users, Save, Calendar, Activity, Scan
} from 'lucide-react';
import { apiClient } from '../api';
import { Student, TimetableSlot, AttendanceRecord, ActiveSession, UserSession, Subject, Lecturer } from '../types';
import CalendarView from './CalendarView';
import AnalyticsDashboard from './AnalyticsDashboard';
import FaceVerification from './FaceVerification';

interface LecturerPortalProps {
  session: UserSession;
  onLogout: () => void;
}

type TabType = 'dashboard' | 'attendance' | 'timetable' | 'reports' | 'analytics' | 'verification';

export default function LecturerPortal({ session, onLogout }: LecturerPortalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [mySlots, setMySlots] = useState<TimetableSlot[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<AttendanceRecord[]>([]);
  const [allLecturers, setAllLecturers] = useState<Lecturer[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Take Attendance State Selection (Defaulting to schedule option)
  const [attendanceMode, setAttendanceMode] = useState<'schedule' | 'manual_custom'>('schedule');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  
  // Custom Manual Selection States
  const [selectedDept, setSelectedDept] = useState('');
  const [selectedSem, setSelectedSem] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');

  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split('T')[0]);
  const [takingMode, setTakingMode] = useState<'manual' | 'smart' | null>(null);

  // Take Attendance List Checklist
  const [studentStatuses, setStudentStatuses] = useState<Record<string, 'Present' | 'Absent' | 'Late'>>({});

  // Active Smart Scanner OTP Session State
  const [activeSession, setActiveSession] = useState<ActiveSession | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState(0);

  const loadLecturerStats = async () => {
    setLoading(true);
    try {
      const [allStuds, slots, logs, subjectsList, lecturersList] = await Promise.all([
        apiClient.getStudents(),
        apiClient.getTimetable(),
        apiClient.getAttendance(),
        apiClient.getSubjects(),
        apiClient.getLecturers().catch(() => [])
      ]);

      // Filter timetable slots assigned to THIS lecturer matching l_id
      const assigned = slots.filter(s => s.lecturerId === session.user.id);
      setMySlots(assigned);
      setStudents(allStuds);
      setAttendanceLogs(logs);
      setAllSubjects(subjectsList || []);
      setAllLecturers(lecturersList || []);

      // Pre-seed checklist for first assigned slot
      if (assigned.length > 0 && !selectedSlotId) {
        setSelectedSlotId(assigned[0].id);
      }
      
      if (session.user.department && !selectedDept) {
        setSelectedDept(session.user.department);
      }
      
      const sems = Array.from(new Set(allStuds.map(s => s.semester))).filter(Boolean);
      if (sems.length > 0 && !selectedSem) {
        setSelectedSem(sems[0]);
      }
    } catch (err: any) {
      setErrorMsg('Dynamic sync failure: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLecturerStats();
  }, []);

  // Resolve active Department and Semester class filters based on chosen model
  const selectedSlot = mySlots.find(s => s.id === selectedSlotId);
  const activeDept = attendanceMode === 'schedule' ? (selectedSlot ? selectedSlot.department || '' : '') : selectedDept;
  const activeSem = attendanceMode === 'schedule' ? (selectedSlot ? selectedSlot.semester || '' : '') : selectedSem;

  // Dynamically filter student lists matching active Class (dept & sem) details
  const filteredStudents = students.filter(s => {
    if (!activeDept || !activeSem) return false;
    return s.department.toLowerCase() === activeDept.toLowerCase() && s.semester === activeSem;
  });

  // Automatically initialize default checked states for active class students
  useEffect(() => {
    if (filteredStudents.length > 0) {
      const initial: Record<string, 'Present' | 'Absent' | 'Late'> = { ...studentStatuses };
      let changed = false;
      filteredStudents.forEach(s => {
        if (!initial[s.id]) {
          initial[s.id] = 'Present'; // default to Present
          changed = true;
        }
      });
      if (changed) {
        setStudentStatuses(initial);
      }
    }
  }, [filteredStudents, selectedSlotId, attendanceMode]);

  // Handle active countdown timer when smart session runs
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeSession && secondsRemaining > 0) {
      timer = setInterval(() => {
        const remaining = Math.max(0, Math.round((new Date(activeSession.expiresAt).getTime() - Date.now()) / 1000));
        setSecondsRemaining(remaining);
        if (remaining <= 0) {
          setActiveSession(null);
        }
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeSession, secondsRemaining]);

  const handleStatusChange = (studentId: string, status: 'Present' | 'Absent' | 'Late') => {
    setStudentStatuses(prev => ({
      ...prev,
      [studentId]: status
    }));
  };

  // Submit manual checklist to server
  const handleManualSubmit = async () => {
    if (attendanceMode === 'schedule' && !selectedSlotId) {
      setErrorMsg('Please select a Class Slot.');
      return;
    }
    if (attendanceMode === 'manual_custom' && (!selectedDept || !selectedSem || !selectedSubject)) {
      setErrorMsg('Please select Class (Department & Semester) and Subject.');
      return;
    }
    if (filteredStudents.length === 0) {
      setErrorMsg('No students discovered matching this class.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const recordsToSubmit = filteredStudents.map(s => ({
        studentId: s.id,
        status: studentStatuses[s.id] || 'Present'
      }));

      const extraParams = attendanceMode === 'manual_custom' ? {
        subjectCode: selectedSubject,
        department: selectedDept,
        semester: selectedSem,
        lecturerId: session.user.id
      } : undefined;

      await apiClient.submitAttendance(
        attendanceMode === 'schedule' ? selectedSlotId : '',
        attendanceDate,
        recordsToSubmit,
        extraParams
      );

      setSuccessMsg('Ledger protocol validated & synchronized permanently.');
      loadLecturerStats();
      setTakingMode(null);
    } catch (err: any) {
      setErrorMsg('Direct submission failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // Spin up smart beacon scan session
  const handleStartSmartSession = async () => {
    if (!selectedSlotId) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const sessionData = await apiClient.startSession(selectedSlotId);
      setActiveSession(sessionData);
      
      const seconds = Math.max(0, Math.round((new Date(sessionData.expiresAt).getTime() - Date.now()) / 1000));
      setSecondsRemaining(seconds);

      setSuccessMsg('Tactical Bluetooth Beacon Signal ONLINE. Secure scanning active.');
    } catch (err: any) {
      setErrorMsg('Failed to initialize cyber beacon session.');
    }
  };

  // Compute metrics
  const myLogs = attendanceLogs.filter(r => 
    (r.timetableSlotId && mySlots.some(slot => slot.id === r.timetableSlotId)) ||
    (r.lecturerName && r.lecturerName.toLowerCase() === session.user.name.toLowerCase()) ||
    (r.subjectCode && mySlots.some(s => s.subject.toUpperCase() === r.subjectCode.toUpperCase()))
  );

  const totalClassesLectured = myLogs.length;

  const todayStr = new Date().toISOString().split('T')[0];
  const todayLogs = myLogs.filter(r => r.date === todayStr);

  const slotsStats = mySlots.map(slot => {
    const slotLogs = attendanceLogs.filter(l => 
      l.timetableSlotId === slot.id || 
      (l.subjectCode?.toUpperCase() === slot.subject?.toUpperCase() && 
       l.department?.toLowerCase() === slot.department?.toLowerCase() && 
       l.semester === slot.semester)
    );
    const total = slotLogs.length;
    const presents = slotLogs.filter(l => l.status === 'Present' || l.status === 'Late').length;
    const rate = total > 0 ? Math.round((presents / total) * 100) : 100;
    return {
      slot,
      total,
      presents,
      rate
    };
  });

  return (
    <div className="min-h-screen bg-[#020617] text-gray-300 font-sans flex flex-col md:flex-row relative overflow-x-hidden">
      {/* Background glowing decorations */}
      <div className="absolute inset-0 pointer-events-none opacity-20 z-0">
        <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(rgba(0,240,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(0,240,255,0.05)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
        <div className="absolute inset-y-0 right-0 w-[400px] bg-cyan-500/5 rounded-full blur-[100px]"></div>
      </div>
      
      {/* Top Mobile Comm Header bar */}
      <div className="md:hidden w-full bg-[#0a0c14]/80 backdrop-blur-md border-b border-cyan-500/20 px-4 py-3 flex justify-between items-center z-40">
        <div className="flex items-center space-x-2">
          <BookOpen className="w-5 h-5 text-cyan-400" />
          <span className="font-display font-extrabold text-sm tracking-wider text-white">NEXO // LECTOR</span>
        </div>
        <button 
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="text-cyan-400 border border-cyan-500/30 px-2 py-1 rounded text-xs font-mono"
        >
          {sidebarOpen ? 'CLOSE_NAV' : 'OPEN_NAV'}
        </button>
      </div>

      {/* Cyberpunk Navigation Panel Sidebar */}
      <nav className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-[#0a0d1f]/80 backdrop-blur-lg border-r border-cyan-500/15 flex flex-col justify-between p-5 z-30 transition-transform duration-300 transform ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        <div>
          {/* Logo Heading */}
          <div className="flex items-center space-x-2.5 mb-8 pb-4 border-b border-cyan-500/10">
            <BookOpen className="w-6 h-6 text-cyan-400" />
            <div>
              <span className="font-display font-black tracking-widest text-lg text-white">NEXO</span>
              <span className="block text-[8px] tracking-wider text-cyan-500 font-mono">LECTURER COMMAND TERMINAL</span>
            </div>
          </div>

          <div className="mb-4">
            <span className="text-[10px] text-cyan-500/65 tracking-widest font-mono uppercase">Lector Tasks</span>
          </div>

          {/* Navigation Links */}
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span>LECTOR_DASHBOARD</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => { setActiveTab('attendance'); setSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'attendance'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                }`}
              >
                <UserCheck className="w-4 h-4 text-cyan-400" />
                <span>RECORD_ATTENDANCE</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => { setActiveTab('timetable'); setSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'timetable'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                }`}
              >
                <Clock className="w-4 h-4 text-cyan-400" />
                <span>MY_CURRICULUM</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => { setActiveTab('reports'); setSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'reports'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>METRICS_REPORT</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => { setActiveTab('analytics'); setSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'analytics'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                }`}
              >
                <Activity className="w-4 h-4 text-cyan-400" />
                <span>LECTOR_ANALYTICS</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => { setActiveTab('verification'); setSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'verification'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                }`}
              >
                <Scan className="w-4 h-4 text-cyan-400" />
                <span>VERIFY_FACE</span>
              </button>
            </li>
          </ul>
        </div>

        {/* User Identity at bottom */}
        <div className="border-t border-cyan-500/10 pt-4 mt-8 flex flex-col">
          <span className="text-[10px] text-gray-500 font-mono">LECTOR ASSIGNED:</span>
          <span className="text-white text-xs font-bold leading-tight font-display">{session.user.name}</span>
          <span className="text-[10px] text-cyan-500/80 font-mono mt-0.5">{session.user.department}</span>
          <button 
            onClick={onLogout}
            className="mt-4 flex items-center space-x-1.5 align-middle text-red-400 hover:text-red-300 text-[11px] font-mono font-bold tracking-wider cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>DISCONNECT_TERMINAL</span>
          </button>
        </div>
      </nav>

      {/* Main Panel Content Area */}
      <main className="flex-1 min-h-screen p-6 md:p-8 overflow-y-auto w-full relative">
        {/* Sync status top indicators */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-cyan-500/10 pb-4 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-white font-display tracking-tight flex items-center">
              SYSTEM PORTAL / <span className="text-cyan-400 font-mono text-base md:text-lg ml-2">{activeTab.toUpperCase()}</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">Faculty class register console for active subject rosters.</p>
          </div>
          <button 
            onClick={loadLecturerStats}
            className="mt-3 md:mt-0 flex items-center space-x-1.5 border border-cyan-500/30 text-cyan-400 text-xs px-3 py-1.5 rounded-lg bg-black hover:bg-cyan-950/20 hover:text-white cursor-pointer transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>RE-SYNC SERVICES</span>
          </button>
        </div>

        {/* Notification Blocks */}
        {errorMsg && (
          <div className="mb-6 p-4 border border-red-500/30 bg-red-950/20 text-red-400 rounded-lg text-xs font-mono flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-red-400 font-bold ml-2">X</button>
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-4 border border-green-500/30 bg-green-950/20 text-green-400 rounded-lg text-xs font-mono flex items-center justify-between">
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-green-400 font-bold">X</button>
          </div>
        )}

        <div id="lecturer-view-container">

          {/* VIEW: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 relative z-10">
              {/* Quick Lecturer Stats Bento cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
                <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-5 rounded-xl shadow-[0_8px_32px_0_rgba(6,182,212,0.05)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 block">Classes Assigned</span>
                    <h3 className="text-3xl font-extrabold text-white mt-1.5 font-display tracking-tight">{mySlots.length}</h3>
                    <span className="text-[10px] text-gray-500 block mt-1 font-mono">Weekly active blocks</span>
                  </div>
                  <div className="p-3 bg-cyan-700/10 border border-cyan-500/10 rounded-xl text-cyan-400">
                    <Clock className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-5 rounded-xl shadow-[0_8px_32px_0_rgba(6,182,212,0.05)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 block">Total Logs Plotted</span>
                    <h3 className="text-3xl font-extrabold text-white mt-1.5 font-display tracking-tight">{totalClassesLectured}</h3>
                    <span className="text-[10px] text-gray-500 block mt-1 font-mono">Attendance submissions</span>
                  </div>
                  <div className="p-3 bg-cyan-700/10 border border-cyan-500/10 rounded-xl text-cyan-400">
                    <Users className="w-5 h-5" />
                  </div>
                </div>

                <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-5 rounded-xl shadow-[0_8px_32px_0_rgba(6,182,212,0.05)] flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-[#00ffbb]/80 block">Faculty Dept</span>
                    <h3 className="text-xl font-extrabold mt-1.5 font-display tracking-tight text-[#00ffd2] uppercase leading-tight">{session.user.department}</h3>
                    <span className="text-[10px] text-gray-500 block mt-1 font-mono">Secured authorization</span>
                  </div>
                  <div className="p-3 bg-cyan-700/10 border border-cyan-500/10 rounded-xl text-cyan-400">
                    <Award className="w-5 h-5" />
                  </div>
                </div>
              </div>

              {/* Sub-Card list of classes of today */}
              <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-5 rounded-xl">
                <h4 className="text-sm font-bold text-white font-display mb-1 uppercase tracking-wider">Assigned Curriculum Directory</h4>
                <p className="text-[11px] text-cyan-300/50 font-mono mb-4 uppercase">Direct curriculum paths allocated on core servers</p>

                {mySlots.length === 0 ? (
                  <p className="text-xs font-mono text-gray-500 uppercase py-6 text-center">NO CURRICULUMS REGISTERED FOR YOUR SIGNATURE IN GRID</p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {mySlots.map(slot => (
                      <div key={slot.id} className="bg-slate-950/45 hover:bg-slate-950/60 border border-cyan-500/15 p-4 rounded-lg flex flex-col justify-between hover:border-cyan-400/50 transition-colors">
                        <div>
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold font-display text-white">{slot.subject}</span>
                            <span className="text-[9px] font-mono text-cyan-400 border border-cyan-500/15 px-2 py-0.5 rounded uppercase">{slot.room}</span>
                          </div>
                          <p className="text-[10px] font-mono text-cyan-500/80 mt-1 uppercase">{slot.day} // {slot.timeStart} - {slot.timeEnd}</p>
                          <p className="text-[10px] text-gray-500 mt-2 font-sans">Applicable: <b className="text-white font-medium">{slot.department}</b> // Semester {slot.semester}</p>
                        </div>
                        <button
                          onClick={() => {
                            setSelectedSlotId(slot.id);
                            setActiveTab('attendance');
                          }}
                          className="mt-4 flex items-center justify-center space-x-1.5 text-xs text-cyan-400 hover:text-black border border-cyan-400 hover:bg-cyan-400 py-1.5 rounded transition-all cursor-pointer font-bold font-mono text-center w-full"
                        >
                          <UserCheck className="w-3.5 h-3.5" />
                          <span>RECORD_ATTENDANCE_NOW</span>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Dual Column grid for Today's Feed & Class Metrics */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
                
                {/* COLUMN 1: Today's Real-time Attendance Feed */}
                <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-5 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white font-display uppercase tracking-wider">Today's Attendance Feed</h4>
                        <p className="text-[10px] font-mono text-cyan-400 mt-0.5 uppercase">Direct bio-scanning feed for {todayStr}</p>
                      </div>
                      <span className="text-[9px] bg-cyan-950/40 text-cyan-400 border border-cyan-500/15 px-2 py-0.5 rounded font-mono font-bold uppercase">
                        REALTIME_LIVE
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[280px] overflow-y-auto pr-1">
                      {todayLogs.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-cyan-500/10 rounded-lg">
                          <p className="text-[10px] font-mono text-gray-500 uppercase">No student registers created yet today</p>
                        </div>
                      ) : (
                        todayLogs.map(log => (
                          <div key={log.id} className="p-3 bg-slate-950/40 border border-cyan-500/5 hover:border-cyan-500/15 rounded flex items-center justify-between text-xs transition-all">
                            <div>
                              <span className="font-bold text-white block">{log.studentName}</span>
                              <span className="text-[9px] font-mono text-cyan-400 block uppercase mt-0.5">
                                USN: {log.studentUsn} • DEPT: {log.department || 'N/A'} • {log.time || 'N/A'}
                              </span>
                              <span className="text-[8.5px] text-gray-400 block mt-0.5">
                                Subject: {log.subjectName || log.subjectCode} • Method: <b className="text-cyan-400">{log.verificationMethod || 'Biometric'}</b>
                              </span>
                            </div>
                            <span className="bg-emerald-950/30 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 text-[9px] font-mono font-bold rounded uppercase animate-pulse">
                              {log.status}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* COLUMN 2: Class Attendance Distribution Matrix */}
                <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-5 rounded-xl flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between items-center mb-3">
                      <div>
                        <h4 className="text-sm font-bold text-white font-display uppercase tracking-wider">Class Attendance Statistics</h4>
                        <p className="text-[10px] font-mono text-cyan-400 mt-0.5 uppercase">Curriculum segment attendance summary</p>
                      </div>
                      <span className="text-[9px] bg-cyan-950/40 text-cyan-400 border border-cyan-500/15 px-2 py-0.5 rounded font-mono font-bold uppercase">
                        ANALYTIC_RATES
                      </span>
                    </div>

                    <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
                      {slotsStats.length === 0 ? (
                        <div className="text-center py-8 border border-dashed border-cyan-500/10 rounded-lg">
                          <p className="text-[10px] font-mono text-gray-500 uppercase">No scheduled slots assigned</p>
                        </div>
                      ) : (
                        slotsStats.map(({ slot, total, presents, rate }) => (
                          <div key={slot.id} className="p-3 bg-slate-950/40 border border-cyan-500/5 rounded text-xs space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <div>
                                <span className="font-bold text-white block uppercase line-clamp-1">{slot.subject}</span>
                                <span className="text-[9px] font-mono text-gray-500 block uppercase mt-0.5">
                                  {slot.day} // {slot.timeStart} - {slot.timeEnd} // Room {slot.room}
                                </span>
                              </div>
                              <span className={`text-sm font-extrabold font-mono shrink-0 ${rate < 75 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}`}>
                                {rate}%
                              </span>
                            </div>
                            
                            {/* Horizontal Progress bar element */}
                            <div className="w-full bg-cyan-950/50 h-2 rounded-full overflow-hidden relative border border-cyan-500/5">
                              <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-red-400/80 z-10" />
                              <div 
                                className={`h-full rounded-full transition-all duration-500 ${rate < 75 ? 'bg-gradient-to-r from-rose-600 to-rose-400' : 'bg-gradient-to-r from-cyan-600 to-[#00ffbb]'}`}
                                style={{ width: `${rate}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-[8px] text-gray-500 font-mono uppercase">
                              <span>Presents: {presents} / Total records: {total}</span>
                              <span className={rate < 75 ? 'text-rose-400 font-bold' : 'text-emerald-400 font-bold'}>
                                {rate < 75 ? 'WARNING: BELOW 75%' : 'RATIO MET'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* VIEW: TAKE ATTENDANCE */}
          {activeTab === 'attendance' && (
            <div className="space-y-6 relative z-10">
              
              {/* Method choice selector */}
              <div className="flex bg-black/40 border border-cyan-500/15 p-1 rounded-xl max-w-md">
                <button
                  type="button"
                  onClick={() => {
                    setAttendanceMode('schedule');
                    setTakingMode(null);
                  }}
                  className={`flex-1 py-2 text-xs font-mono font-bold tracking-wider rounded-lg transition-all cursor-pointer ${
                    attendanceMode === 'schedule'
                      ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/15'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  SCHEDULED_SESSION
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAttendanceMode('manual_custom');
                    setTakingMode('manual'); // Force manual taking mode for custom setup
                  }}
                  className={`flex-1 py-2 text-xs font-mono font-bold tracking-wider rounded-lg transition-all cursor-pointer ${
                    attendanceMode === 'manual_custom'
                      ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/15'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  MANUAL_CUSTOM_CLASS
                </button>
              </div>

              {/* Selector configurations */}
              <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 rounded-xl p-5 shadow-lg space-y-4">
                <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-cyan-400" />
                  <span>Configure Active Class & Subject Parameters</span>
                </h3>
                
                {attendanceMode === 'schedule' ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">1. Target Class Slot</label>
                      <select
                        className="w-full text-xs bg-slate-950/60 text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none backdrop-blur-sm shadow-inner cursor-pointer"
                        value={selectedSlotId}
                        onChange={(e) => {
                          setSelectedSlotId(e.target.value);
                          setTakingMode(null);
                          setActiveSession(null);
                        }}
                      >
                        <option value="" className="bg-slate-900">Select an assigned class...</option>
                        {mySlots.map(s => (
                          <option key={s.id} value={s.id} className="bg-slate-900">{s.subject} ({s.day} // {s.timeStart})</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">2. Record Calendar Date</label>
                      <input
                        type="date"
                        className="w-full text-xs font-mono bg-slate-950/60 text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none backdrop-blur-sm cursor-pointer"
                        value={attendanceDate}
                        onChange={(e) => setAttendanceDate(e.target.value)}
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">3. Record Verification Mode</label>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setTakingMode('smart')}
                          disabled={!selectedSlotId}
                          className={`text-xs py-2 border font-mono rounded tracking-wider cursor-pointer ${
                            takingMode === 'smart'
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                              : 'border-cyan-500/15 hover:border-cyan-400/30 text-gray-400'
                          } disabled:opacity-30`}
                        >
                          CYBER_SCAN
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTakingMode('manual');
                            setActiveSession(null);
                          }}
                          disabled={!selectedSlotId}
                          className={`text-xs py-2 border font-mono rounded tracking-wider cursor-pointer ${
                            takingMode === 'manual'
                              ? 'bg-cyan-500/10 text-cyan-400 border-cyan-400 shadow-[0_0_10px_rgba(6,182,212,0.1)]'
                              : 'border-cyan-500/15 hover:border-cyan-400/30 text-gray-400'
                          } disabled:opacity-30`}
                        >
                          MANUAL_GRID
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">1. Select Class (Dept)</label>
                        <select
                          className="w-full text-xs bg-slate-950/60 text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none backdrop-blur-sm cursor-pointer"
                          value={selectedDept}
                          onChange={(e) => {
                            setSelectedDept(e.target.value);
                            setSelectedSubject('');
                          }}
                        >
                          <option value="">Choose Department Class...</option>
                          {Array.from(new Set([
                            ...students.map(s => s.department),
                            ...allSubjects.map(s => s.department)
                          ])).filter(Boolean).sort().map(dept => (
                            <option key={dept} value={dept} className="bg-slate-900">{dept}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">2. Select Class (Semester)</label>
                        <select
                          className="w-full text-xs bg-slate-950/60 text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none backdrop-blur-sm cursor-pointer"
                          value={selectedSem}
                          onChange={(e) => {
                            setSelectedSem(e.target.value);
                            setSelectedSubject('');
                          }}
                        >
                          <option value="">Choose Semester...</option>
                          {Array.from(new Set([
                            ...students.map(s => s.semester),
                            ...allSubjects.map(s => s.semester)
                          ])).filter(Boolean).sort().map(sem => (
                            <option key={sem} value={sem} className="bg-slate-900">Semester {sem}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">3. Select Subject Code</label>
                        <select
                          className="w-full text-xs bg-slate-950/60 text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none backdrop-blur-sm cursor-pointer disabled:opacity-30"
                          value={selectedSubject}
                          disabled={!selectedDept || !selectedSem}
                          onChange={(e) => setSelectedSubject(e.target.value)}
                        >
                          <option value="">Choose Subject...</option>
                          {allSubjects
                            .filter(sub => sub.department === selectedDept && sub.semester === selectedSem)
                            .map(sub => (
                              <option key={sub.subjectCode} value={sub.subjectCode} className="bg-slate-900">{sub.subjectCode} - {sub.subjectName}</option>
                            ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">4. Calendar Record Date</label>
                        <input
                          type="date"
                          className="w-full text-xs font-mono bg-slate-950/60 text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none backdrop-blur-sm cursor-pointer"
                          value={attendanceDate}
                          onChange={(e) => setAttendanceDate(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {(selectedSlotId || (attendanceMode === 'manual_custom' && selectedDept && selectedSem && selectedSubject)) && (
                <div>
                  
                  {/* MODE: SMART SCAN BEACON */}
                  {takingMode === 'smart' && attendanceMode === 'schedule' && (
                    <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 rounded-xl p-6 shadow-[0_8px_32px_rgba(6,182,212,0.05)] text-center max-w-xl mx-auto space-y-6 relative overflow-hidden">
                      <div className="absolute inset-x-0 top-0 h-0.5 bg-cyan-400 animation-pulse" />
                      
                      <div className="flex flex-col items-center">
                        <Wifi className="w-12 h-12 text-cyan-400 animate-pulse mb-3" />
                        <h4 className="text-base font-bold text-white font-display uppercase tracking-widest">Holographic Beacon Scanning Signal</h4>
                        <p className="text-gray-400 text-xs font-mono max-w-sm mt-1 leading-relaxed">
                          Students entering this exact session reference can enter the dynamic security code to register check-in logs directly.
                        </p>
                      </div>

                      {activeSession ? (
                        <div className="p-6 bg-slate-950/60 border border-cyan-500/25 backdrop-blur-sm rounded-xl space-y-4 shadow-xl max-w-xs mx-auto">
                          <span className="text-[10px] text-cyan-400/60 font-mono block uppercase">TRANSMITTING CHECKIN SIGN LEVEL</span>
                          <span className="text-4xl font-extrabold text-cyan-400 font-display tracking-widest neon-text-cyan block select-all">
                            {activeSession.otpCode}
                          </span>
                          
                          <div className="border-t border-cyan-500/10 pt-2 flex justify-between items-center text-xs font-mono">
                            <span className="text-gray-500 uppercase">SIGNAL TIMING decay:</span>
                            <span className="text-red-400 font-bold">{secondsRemaining}s</span>
                          </div>
                        </div>
                      ) : (
                        <div className="py-4">
                          <button
                            type="button"
                            onClick={handleStartSmartSession}
                            className="bg-cyan-750/50 hover:bg-cyan-500 hover:text-black border border-cyan-400 text-white font-display text-sm tracking-widest font-extrabold px-6 py-3 rounded cursor-pointer transition-all"
                          >
                            LAUNCH_SCANNING_BEACON
                          </button>
                        </div>
                      )}

                      <div className="border-t border-cyan-500/10 pt-4 text-[10px] font-mono text-cyan-500/60 flex justify-between uppercase">
                        <span>DEPT: {selectedSlot ? selectedSlot.department : 'N/A'}</span>
                        <span>SECTOR: {selectedSlot ? selectedSlot.room : 'N/A'}</span>
                      </div>
                    </div>
                  )}

                  {/* MODE: MANUAL LEDGER WRITING */}
                  {takingMode === 'manual' && (
                    <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 rounded-xl overflow-hidden shadow-lg animate-fade-in">
                      <div className="p-4 bg-cyan-950/30 border-b border-cyan-500/15 flex justify-between items-center flex-wrap gap-3">
                        <div>
                          <h4 className="text-sm font-bold text-white font-sans uppercase tracking-wider flex items-center gap-2">
                            <Users className="w-4 h-4 text-cyan-400" />
                            <span>
                              Class Checklist Ledger: {activeDept} (Sem {activeSem})
                            </span>
                          </h4>
                          <p className="text-[10px] font-mono text-cyan-400/60 uppercase mt-0.5">
                            Active registry: {filteredStudents.length} student{filteredStudents.length !== 1 ? 's' : ''} detected. Toggle status values & lock signature.
                          </p>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                          {filteredStudents.length > 0 && (
                            <div className="flex gap-1.5 mr-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const bulk: Record<string, 'Present' | 'Absent' | 'Late'> = { ...studentStatuses };
                                  filteredStudents.forEach(s => { bulk[s.id] = 'Present'; });
                                  setStudentStatuses(bulk);
                                }}
                                className="px-2 py-1 bg-emerald-950/25 border border-emerald-500/30 rounded text-[9px] font-mono text-emerald-400 hover:bg-emerald-500/10 transition-colors cursor-pointer"
                              >
                                ALL_PRESENT
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  const bulk: Record<string, 'Present' | 'Absent' | 'Late'> = { ...studentStatuses };
                                  filteredStudents.forEach(s => { bulk[s.id] = 'Absent'; });
                                  setStudentStatuses(bulk);
                                }}
                                className="px-2 py-1 bg-red-950/25 border border-red-500/30 rounded text-[9px] font-mono text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
                              >
                                ALL_ABSENT
                              </button>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={handleManualSubmit}
                            disabled={filteredStudents.length === 0}
                            className="flex items-center space-x-1.5 text-xs text-black bg-cyan-400 font-bold px-4 py-2 rounded shadow-[0_0_15px_rgba(6,182,212,0.15)] hover:shadow-cyan-400/35 hover:bg-cyan-350 transition-all cursor-pointer font-sans disabled:opacity-35 disabled:cursor-not-allowed"
                          >
                            <Save className="w-4 h-4" />
                            <span>SAVE_ATTENDANCE</span>
                          </button>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                          <thead>
                            <tr className="border-b border-cyan-500/5 bg-slate-950/40">
                              <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">STUDENT PROFILE NODE</th>
                              <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">USN LOG CODE</th>
                              <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">DEPARTMENT MATRIX</th>
                              <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider text-center">ATTENDANCE STATUS</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-cyan-500/5">
                            {filteredStudents.length === 0 ? (
                              <tr>
                                <td colSpan={4} className="p-8 text-center text-xs font-mono text-gray-500 uppercase">
                                  NO STUDENTS FOUND IN THIS DEPARTMENT & SEMESTER
                                </td>
                              </tr>
                            ) : (
                              filteredStudents.map(stud => (
                                <tr key={stud.id} className="hover:bg-cyan-950/5 transition-colors">
                                  <td className="p-4">
                                    <span className="font-semibold text-white text-xs block">{stud.name}</span>
                                    <span className="text-[9px] font-mono text-gray-500 block leading-none mt-0.5">{stud.email}</span>
                                  </td>
                                  <td className="p-4 font-mono text-xs text-cyan-400/90 tracking-wider uppercase">{stud.usn}</td>
                                  <td className="p-4 text-xs font-sans text-gray-400">{stud.department} (Sem {stud.semester})</td>
                                  <td className="p-4">
                                    <div className="flex justify-center items-center space-x-2">
                                      <button
                                        type="button"
                                        onClick={() => handleStatusChange(stud.id, 'Present')}
                                        className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                          studentStatuses[stud.id] === 'Present'
                                            ? 'bg-emerald-950/20 border-emerald-500 text-emerald-400 font-bold shadow-[0_0_8px_rgba(16,185,129,0.1)]'
                                            : 'border-cyan-500/5 hover:border-cyan-500/20 text-gray-500'
                                        }`}
                                      >
                                        PRESENT
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleStatusChange(stud.id, 'Absent')}
                                        className={`text-[10px] font-mono font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${
                                          studentStatuses[stud.id] === 'Absent'
                                            ? 'bg-red-950/20 border-red-500 text-red-400 font-bold shadow-[0_0_8px_rgba(239,68,68,0.1)]'
                                            : 'border-cyan-500/5 hover:border-cyan-500/20 text-gray-500'
                                        }`}
                                      >
                                        ABSENT
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                </div>
              )}

            </div>
          )}

          {/* VIEW: TIMETABLE */}
          {activeTab === 'timetable' && (
            <div className="space-y-6 relative z-10 animate-fade-in">
              <CalendarView slots={mySlots} />
            </div>
          )}

          {/* VIEW: REPORTS */}
          {activeTab === 'reports' && (
            <div className="space-y-6 relative z-10">
              <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 bg-cyan-950/30 border-b border-cyan-500/15 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider">Attendance register transactions</h4>
                    <p className="text-[10px] font-mono text-cyan-400/55 uppercase mt-0.5">Logs recorded securely matching your lectured units</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-cyan-500/5 bg-slate-950/40">
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-bold">TIMESTAMP</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">STUDENT NODE IDENTIFIER</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">USN TYPE</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">LECTURED UNT target</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider text-center">CHECKIN STATE</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/5 text-xs">
                      {attendanceLogs.filter(r => mySlots.some(slot => slot.id === r.timetableSlotId)).length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-xs font-mono text-gray-500 uppercase">NO ACTIVE STUDENT SUBMISSIONS UNDER YOUR IDENTITY</td>
                        </tr>
                      ) : (
                        attendanceLogs
                          .filter(r => mySlots.some(slot => slot.id === r.timetableSlotId))
                          .reverse()
                          .map(rec => {
                            const slot = mySlots.find(t => t.id === rec.timetableSlotId);
                            return (
                              <tr key={rec.id} className="hover:bg-cyan-950/5 transition-colors">
                                <td className="p-4 font-mono text-gray-400 text-[11px]">
                                  {rec.timestamp ? new Date(rec.timestamp).toLocaleString() : '---'}
                                </td>
                                <td className="p-4 font-semibold text-white">{rec.studentName}</td>
                                <td className="p-4 font-mono text-cyan-400 text-xs">{rec.studentUsn}</td>
                                <td className="p-4 font-sans text-gray-300">
                                  {slot ? slot.subject : 'Subject'} <span className="text-[10px] font-mono text-gray-500 ml-1">({rec.date})</span>
                                </td>
                                <td className="p-4 text-center">
                                  <span className={`inline-block font-mono text-[9px] font-bold px-2.5 py-0.5 rounded uppercase border ${
                                    rec.status === 'Present'
                                      ? 'bg-emerald-950/20 border-emerald-500/35 text-emerald-400'
                                      : rec.status === 'Late'
                                      ? 'bg-amber-950/20 border-amber-500/35 text-amber-400'
                                      : 'bg-red-950/20 border-red-500/35 text-red-400'
                                  }`}>
                                    {rec.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: ANALYTICS */}
          {activeTab === 'analytics' && (
            <div className="space-y-6 relative z-10 animate-fade-in">
              <AnalyticsDashboard
                students={students}
                lecturers={allLecturers}
                subjects={allSubjects}
                attendance={attendanceLogs}
                timetable={mySlots}
                userRole="lecturer"
                lecturerId={session.user.id}
                lecturerDept={session.user.department}
              />
            </div>
          )}

          {/* VIEW: FACE VERIFICATION */}
          {activeTab === 'verification' && (
            <FaceVerification 
              students={students}
              onRefresh={loadLecturerStats}
            />
          )}

        </div>
      </main>
    </div>
  );
}
