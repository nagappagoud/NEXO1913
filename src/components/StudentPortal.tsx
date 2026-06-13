import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, Clock, BarChart3, LogOut, CheckCircle2, User, 
  RefreshCw, Wifi, Sparkles, Calendar, BookOpen, KeyRound, AlertTriangle,
  Download, Printer, TrendingUp, Award, Shield, Check
} from 'lucide-react';
import { apiClient } from '../api';
import { Student, TimetableSlot, AttendanceRecord, UserSession, Subject, DEPARTMENTS, SEMESTERS } from '../types';
import CalendarView from './CalendarView';

interface StudentPortalProps {
  session: UserSession;
  onLogout: () => void;
}

type TabType = 'dashboard' | 'attendance' | 'timetable' | 'profile';

export default function StudentPortal({ session, onLogout }: StudentPortalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [myAttendance, setMyAttendance] = useState<AttendanceRecord[]>([]);
  const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
  const [targetStudent, setTargetStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Interactive UI states
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Mobile sidebar states
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Smart Check-in Form States
  const [checkinSlotId, setCheckinSlotId] = useState('');
  const [checkinOtp, setCheckinOtp] = useState('');
  const [checkinLoading, setCheckinLoading] = useState(false);

  const loadStudentMatrixData = async () => {
    setLoading(true);
    try {
      const [allTimes, logs, studs, subjectsList] = await Promise.all([
        apiClient.getTimetable(),
        apiClient.getAttendance(),
        apiClient.getStudents(),
        apiClient.getSubjects()
      ]);

      setAllSubjects(subjectsList || []);

      // Filter timetable slots by student's department and semester
      const dept = session.user.department || '';
      const sem = session.user.semester || '';
      const filteredSlots = allTimes.filter(
        t => t.department.toLowerCase() === dept.toLowerCase() && t.semester === sem
      );
      setTimetable(filteredSlots);

      // Filter attendance records relating to THIS student USN
      const filteredLogs = logs.filter(
        l => l.studentUsn.toUpperCase() === session.user.usn?.toUpperCase()
      );
      setMyAttendance(filteredLogs);

      // Grab updated statistics for progress dial from server
      const match = studs.find(s => s.id === session.user.id);
      if (match) {
        setTargetStudent(match);
      }

      // Pre-select first class slot for check-in dropdown
      if (filteredSlots.length > 0 && !checkinSlotId) {
        setCheckinSlotId(filteredSlots[0].id);
      }
    } catch (err: any) {
      setErrorMsg('Dynamic link decay: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudentMatrixData();
  }, [session.user.id]);

  const handleCheckin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!checkinSlotId || !checkinOtp) return;
    setCheckinLoading(true);
    setErrorMsg('');
    setSuccessMsg('');

    const activeSlot = timetable.find(t => t.id === checkinSlotId);
    if (activeSlot) {
      const todayStr = new Date().toISOString().split('T')[0];
      const existing = myAttendance.find(a => 
        a.subjectCode.toUpperCase() === activeSlot.subject.toUpperCase() &&
        a.date === todayStr &&
        a.status === 'Present'
      );
      if (existing) {
        const prevTimestamp = existing.timestamp ? new Date(existing.timestamp).toLocaleString() : 'N/A';
        setErrorMsg(`Attendance Already Recorded (Marked Present at: ${prevTimestamp})`);
        setCheckinLoading(false);
        return;
      }
    }

    try {
      await apiClient.checkinSession(session.user.id, checkinSlotId, checkinOtp);
      setSuccessMsg('Holographic attendance authorization SUCCESSFUL. Log stored.');
      setCheckinOtp('');
      loadStudentMatrixData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Key credential rejected by beacon protocol.');
    } finally {
      setCheckinLoading(false);
    }
  };

  const attendancePercentage = targetStudent ? targetStudent.attendancePercentage : 100;

  // Count metrics
  const totalClassesLogCount = myAttendance.length;
  const presentCount = myAttendance.filter(a => a.status === 'Present' || a.status === 'Late').length;
  const absentCount = myAttendance.filter(a => a.status === 'Absent').length;

  // Compute subject-wise attendance metrics
  const studentDept = session.user.department || '';
  const studentSem = session.user.semester || '';

  const subjectStats = allSubjects
    .filter(
      sub =>
        sub.department.toLowerCase() === studentDept.toLowerCase() &&
        sub.semester === studentSem
    )
    .map(sub => {
      const records = myAttendance.filter(
        r => r.subjectCode.toUpperCase() === sub.subjectCode.toUpperCase()
      );
      const total = records.length;
      const presents = records.filter(r => r.status === 'Present' || r.status === 'Late').length;
      const percentage = total > 0 ? Math.round((presents / total) * 100) : 100;
      return {
        ...sub,
        total,
        presents,
        absents: total - presents,
        percentage,
      };
    });

  // Calculate safe to miss threshold helper
  const calculateProgressMeta = (presents: number, total: number) => {
    if (total === 0) {
      return { status: 'SAFE', message: 'No classes delivered yet', color: 'text-cyan-400' };
    }
    const currentRatio = presents / total;
    if (currentRatio >= 0.75) {
      const maxTotalForPresents = Math.floor(presents / 0.75);
      const safeToMiss = maxTotalForPresents - total;
      return {
        status: 'SAFE',
        message: safeToMiss > 0 ? `Can miss ${safeToMiss} class${safeToMiss !== 1 ? 'es' : ''} safely` : 'Perfect attendance threshold',
        color: 'text-emerald-400'
      };
    } else {
      const requiredConseq = Math.ceil(3 * total - 4 * presents);
      return {
        status: 'WARNING',
        message: `Attend next ${requiredConseq} class${requiredConseq !== 1 ? 'es' : ''} consecutively`,
        color: 'text-rose-400 font-bold'
      };
    }
  };

  // CSV Exporter for Student Attendance Report
  const downloadReport = () => {
    try {
      if (myAttendance.length === 0) {
        setErrorMsg("No attendance data discovered to construct a log report.");
        return;
      }

      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "DATE,SUBJECT_CODE,SUBJECT_NAME,STATUS,VERIFICATION_TIMESTAMP,SECURITY_HASH\n";

      myAttendance.forEach(rec => {
        const subMatch = allSubjects.find(s => s.subjectCode.toUpperCase() === rec.subjectCode.toUpperCase());
        const subName = subMatch ? subMatch.subjectName : 'Module';
        const date = rec.date || 'N/A';
        const subCode = rec.subjectCode || 'N/A';
        const status = rec.status || 'N/A';
        const timestamp = rec.timestamp ? new Date(rec.timestamp).toLocaleString().replace(/,/g, '') : 'N/A';
        const securityHash = `SEC-${rec.id.substring(2).toUpperCase()}`;

        csvContent += `"${date}","${subCode}","${subName}","${status}","${timestamp}","${securityHash}"\n`;
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `NEXO_Report_${session.user.usn}_${session.user.name.split(' ').join('_')}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      setSuccessMsg("Document compiled and transmitted. Check your downloads directory.");
    } catch (err: any) {
      setErrorMsg("Failed to compile CSV document: " + err.message);
    }
  };

  const handlePrintReport = () => {
    window.print();
  };

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
          <User className="w-5 h-5 text-cyan-400" />
          <span className="font-display font-extrabold text-sm tracking-wider text-white">NEXO // STUDENT</span>
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
            <User className="w-6 h-6 text-cyan-400" />
            <div>
              <span className="font-display font-black tracking-widest text-lg text-white">NEXO</span>
              <span className="block text-[8px] tracking-wider text-cyan-500 font-mono">STUDENT SECURE ACCESS</span>
            </div>
          </div>

          <div className="mb-4">
            <span className="text-[10px] text-cyan-500/65 tracking-widest font-mono uppercase">Student Nodes</span>
          </div>

          {/* Navigation Links */}
          <ul className="space-y-1">
            <li>
              <button
                onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'dashboard'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
                    : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                }`}
              >
                <BarChart3 className="w-4 h-4 text-cyan-400" />
                <span>MY_ATTENDANCE_DIAL</span>
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
                <CheckCircle2 className="w-4 h-4 text-cyan-400" />
                <span>LOG_LEDGERS</span>
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
                <span>CLASSES_GRID</span>
              </button>
            </li>
            <li>
              <button
                onClick={() => { setActiveTab('profile'); setSidebarOpen(false); }}
                className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                  activeTab === 'profile'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                }`}
              >
                <User className="w-4 h-4 text-cyan-400" />
                <span>REPLICATOR_PROFILE</span>
              </button>
            </li>
          </ul>
        </div>

        {/* User Identity at bottom */}
        <div className="border-t border-cyan-500/10 pt-4 mt-8 flex flex-col">
          <span className="text-[10px] text-gray-500 font-mono">AUTHORIZED USN:</span>
          <span className="text-white text-xs font-bold leading-tight font-display">{session.user.name}</span>
          <span className="text-[10px] text-cyan-500/80 font-mono mt-0.5">{session.user.usn}</span>
          <button 
            onClick={onLogout}
            className="mt-4 flex items-center space-x-1.5 align-middle text-red-400 hover:text-red-300 text-[11px] font-mono font-bold tracking-wider cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>DISCONNECT_GATE</span>
          </button>
        </div>
      </nav>

      {/* Main Panel Content Area */}
      <main className="flex-1 min-h-screen p-6 md:p-8 overflow-y-auto w-full relative">
        {/* Sync status top indicators */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-cyan-500/10 pb-4 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-white font-display tracking-tight flex items-center">
              STUDENT CORRESPONDENCE / <span className="text-cyan-400 font-mono text-base md:text-lg ml-2">{activeTab.toUpperCase()}</span>
            </h2>
            <p className="text-xs text-gray-400 mt-1">Check personal records and register check-ins securely.</p>
          </div>
          <button 
            onClick={loadStudentMatrixData}
            className="mt-3 md:mt-0 flex items-center space-x-1.5 border border-cyan-500/30 text-cyan-400 text-xs px-3 py-1.5 rounded-lg bg-black hover:bg-cyan-950/20 hover:text-white cursor-pointer transition-all"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>RE-SYNC MATRIX</span>
          </button>
        </div>

        {/* Notifications and messages */}
        {errorMsg && (
          <div className="mb-6 p-4 border border-red-500/30 bg-red-950/20 text-red-400 rounded-lg text-xs font-mono flex items-center justify-between">
            <span>⚠️ {errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="text-red-400 font-bold ml-2">X</button>
          </div>
        )}
        {successMsg && (
          <div className="mb-6 p-4 border border-green-500/30 bg-green-950/20 text-green-400 rounded-lg text-xs font-mono flex items-center justify-between">
            <span>✓ {successMsg}</span>
            <button onClick={() => setSuccessMsg('')} className="text-green-400 font-bold ml-2">X</button>
          </div>
        )}

        <div id="student-view-container">

          {/* VIEW: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6 relative z-10 animate-fade-in">
              
              {/* WARNING HEADER: IF OVERALL RATIO < 75% */}
              {attendancePercentage < 75 && (
                <div id="low-attendance-alert" className="bg-black border-2 border-rose-500 rounded-xl p-5 shadow-[0_0_20px_rgba(239,68,68,0.15)] flex flex-col md:flex-row items-center justify-between gap-4 font-mono relative overflow-hidden">
                  <div className="absolute top-0 bottom-0 left-0 w-1 bg-rose-500"></div>
                  <div className="flex items-start gap-3.5">
                    <div className="p-3 bg-rose-950/40 border border-rose-500/30 text-rose-500 rounded-lg shrink-0">
                      <AlertTriangle className="w-6 h-6 animate-pulse text-rose-500" />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block leading-none">⚠️ Low Attendance Warning</span>
                      <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">CRITICAL ELIGIBILITY REGISTRY ALERT</h4>
                      <p className="text-xs text-gray-400 font-sans max-w-xl">
                        Your general attendance is currently running below the required institutional minimum threshold of <strong>75%</strong>. Failure to correct this immediately via subsequent consecutive attendance lectures will disqualify you from entering active academic term-end examination registers.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-6 text-center shrink-0 w-full md:w-auto border-t md:border-t-0 md:border-l border-rose-500/20 pt-4 md:pt-0 md:pl-6">
                    <div>
                      <span className="text-[9px] text-gray-500 block uppercase font-bold mb-1">Current %</span>
                      <span className="text-2xl font-black text-rose-500 font-display leading-none">{attendancePercentage}%</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 block uppercase font-bold mb-1">Required %</span>
                      <span className="text-2xl font-black text-cyan-400 font-display leading-none">75%</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-gray-500 block uppercase font-bold mb-1">Classes Needed</span>
                      <span className="text-2xl font-black text-white font-display leading-none">
                        {Math.max(0, 3 * totalClassesLogCount - 4 * presentCount)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Left Column: Core Dial + Report Actions */}
                <div className="lg:col-span-4 bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 rounded-xl p-5 shadow-[0_8px_32px_0_rgba(6,182,212,0.05)] flex flex-col items-center justify-between min-h-[380px]">
                  <div className="w-full text-center">
                    <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-500/90 mb-4 block">CORE ATTENDANCE RATIO</span>
                    
                    {/* SVG Radial percentage meter */}
                    <div className="relative w-40 h-40 mx-auto flex items-center justify-center">
                      <svg className="w-full h-full transform -rotate-90">
                        <circle
                          cx="80"
                          cy="80"
                          r="68"
                          className="stroke-cyan-950/50 fill-none"
                          strokeWidth="10"
                        />
                        <circle
                          cx="80"
                          cy="80"
                          r="68"
                          className={`fill-none transition-all duration-1000 ${
                            attendancePercentage < 75 ? 'stroke-rose-500/80 shadow-[0_0_8px_rgba(239,68,68,0.2)]' : 'stroke-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.2)]'
                          }`}
                          strokeWidth="10"
                          strokeDasharray={`${2 * Math.PI * 68}`}
                          strokeDashoffset={`${2 * Math.PI * 68 * (1 - attendancePercentage / 100)}`}
                          strokeLinecap="round"
                        />
                      </svg>
                      <div className="absolute text-center">
                        <span className="text-3xl font-extrabold text-white tracking-tight font-display">{attendancePercentage}%</span>
                        <span className="block text-[8px] font-mono text-cyan-500/90 uppercase tracking-widest mt-0.5">OVERALL MATRIX</span>
                      </div>
                    </div>

                    {attendancePercentage < 75 ? (
                      <div className="mt-4 px-3 py-1.5 border border-rose-500/20 bg-rose-950/20 rounded-lg flex items-center justify-center space-x-1.5 text-rose-400 font-mono text-[9px] uppercase font-bold text-center">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-rose-400" />
                        <span>CRITICAL: RATIO BELOW 75% MINIMUM</span>
                      </div>
                    ) : (
                      <div className="mt-4 px-3 py-1.5 border border-emerald-500/20 bg-emerald-950/20 rounded-lg flex items-center justify-center space-x-1.5 text-emerald-400 font-mono text-[9px] uppercase font-bold text-center">
                        <Award className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                        <span>ELIGIBLE FOR EXAMINATIONS</span>
                      </div>
                    )}
                  </div>

                  {/* Quick Action Report Exporters */}
                  <div className="w-full border-t border-cyan-500/10 pt-4 mt-4 space-y-2">
                    <span className="text-[9px] font-mono text-cyan-500/60 uppercase block tracking-wider text-center">DOCUMENT LOG EXPORTS</span>
                    <button
                      type="button"
                      onClick={downloadReport}
                      className="w-full text-xs font-mono py-2 bg-slate-950/80 text-cyan-400 border border-cyan-500/20 rounded-lg hover:bg-cyan-50 hover:text-black transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>DOWNLOAD_CSV_LEDGER</span>
                    </button>
                    <button
                      type="button"
                      onClick={handlePrintReport}
                      className="w-full text-xs font-mono py-2 bg-slate-950/85 text-gray-300 border border-cyan-500/10 rounded-lg hover:border-gray-300 hover:text-white transition-all cursor-pointer flex items-center justify-center gap-2"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>PRINT_OFFICIAL_SHEET</span>
                    </button>
                  </div>
                </div>

                {/* Right Area: Interactive Attendance Visualizations */}
                <div className="lg:col-span-8 bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 rounded-xl p-5 shadow-[0_8px_32px_rgba(6,182,212,0.05)] flex flex-col justify-between min-h-[380px]">
                  <div>
                    <div className="flex justify-between items-center mb-4">
                      <div>
                        <span className="text-[10px] uppercase font-mono tracking-wider text-cyan-500/90 block">SUBJECT ATTENDANCE VECTOR</span>
                        <h3 className="text-sm font-bold text-white font-display uppercase tracking-wider mt-0.5">Subject-Wise Analytics Matrix</h3>
                      </div>
                      <span className="text-[9px] font-mono text-cyan-400 bg-cyan-950/40 px-2 py-0.5 rounded border border-cyan-500/20 uppercase">
                        DYNAMIC_CHART
                      </span>
                    </div>

                    {subjectStats.length === 0 ? (
                      <div className="h-44 flex flex-col items-center justify-center border border-dashed border-cyan-500/15 rounded-lg text-center p-4">
                        <BookOpen className="w-8 h-8 text-cyan-400/30 animate-pulse mb-2" />
                        <span className="text-[10px] font-mono text-gray-500 uppercase">NO RELEVANT SUBJECTS DISCOVERED</span>
                        <span className="text-[9px] font-mono text-gray-600 uppercase mt-0.5">Please check system curriculum database listings.</span>
                      </div>
                    ) : (
                      <div className="relative">
                        {/* Interactive custom SVG Bar Chart component */}
                        <div className="w-full overflow-x-auto select-none">
                          <svg viewBox="0 0 540 220" className="w-full min-w-[480px] h-auto">
                            {/* Y-Axis lines and values */}
                            {[0, 25, 50, 75, 100].map((tick, i) => {
                              const y = 20 + (100 - tick) * 1.5; // graph fits into 150px height
                              return (
                                <g key={tick} className="opacity-40">
                                  <line
                                    x1="45"
                                    y1={y}
                                    x2="520"
                                    y2={y}
                                    stroke="#06b6d4"
                                    strokeWidth="1"
                                    strokeDasharray="3,3"
                                    className="stroke-cyan-500/20"
                                  />
                                  <text
                                    x="35"
                                    y={y + 4}
                                    textAnchor="end"
                                    className="fill-cyan-500/60 font-mono text-[9px] font-bold"
                                  >
                                    {tick}%
                                  </text>
                                </g>
                              );
                            })}

                            {/* Warning zone guide (75%) */}
                            <line
                              x1="45"
                              y1={20 + 25 * 1.5}
                              x2="520"
                              y2={20 + 25 * 1.5}
                              stroke="#ef4444"
                              strokeWidth="1.5"
                              strokeDasharray="4,2"
                              className="opacity-50"
                            />
                            <text
                              x="525"
                              y={20 + 25 * 1.5 + 3}
                              className="fill-red-400 font-mono text-[8px] font-black"
                              textAnchor="start"
                            >
                              REQ (75%)
                            </text>

                            {/* Main Bars */}
                            {subjectStats.map((item, index) => {
                              const barSpacing = (520 - 45) / subjectStats.length;
                              const barWidth = Math.min(30, barSpacing * 0.5);
                              const x = 45 + index * barSpacing + (barSpacing - barWidth) / 2;
                              const heightVal = item.percentage * 1.5;
                              const y = 170 - heightVal; // base is at 170

                              const isUnder = item.percentage < 75;
                              const isHovered = hoveredBarIndex === index;

                              return (
                                <g
                                  key={item.subjectCode}
                                  onMouseEnter={() => setHoveredBarIndex(index)}
                                  onMouseLeave={() => setHoveredBarIndex(null)}
                                  className="cursor-pointer"
                                >
                                  {/* Background Bar Slot */}
                                  <rect
                                    x={x - 2}
                                    y="20"
                                    width={barWidth + 4}
                                    height="150"
                                    className="fill-transparent hover:fill-cyan-950/10 transition-colors duration-150"
                                    rx="2"
                                  />

                                  {/* Active Value Solid Bar */}
                                  <rect
                                    x={x}
                                    y={y}
                                    width={barWidth}
                                    height={heightVal}
                                    rx="3"
                                    className={`transition-all duration-300 ${
                                      isUnder 
                                        ? 'fill-rose-500 hover:fill-rose-400' 
                                        : 'fill-cyan-500 hover:fill-cyan-400'
                                    } ${
                                      isHovered ? 'filter drop-shadow-[0_0_8px_rgba(6,182,212,0.4)] opacity-100' : 'opacity-85'
                                    }`}
                                  />

                                  {/* Code label on X Axis */}
                                  <text
                                    x={x + barWidth / 2}
                                    y="188"
                                    textAnchor="middle"
                                    className={`font-mono text-[9px] font-bold ${
                                      isHovered ? 'fill-cyan-400' : 'fill-gray-400'
                                    }`}
                                  >
                                    {item.subjectCode}
                                  </text>
                                </g>
                              );
                            })}
                          </svg>
                        </div>

                        {/* Interactive Tooltip Overlay */}
                        <div className="h-10 mt-2 flex items-center justify-center border border-cyan-500/10 rounded-lg bg-black/40 px-3">
                          {hoveredBarIndex !== null && subjectStats[hoveredBarIndex] ? (
                            <div className="flex items-center gap-4 text-[10px] font-mono">
                              <span className="text-white font-black uppercase">
                                {subjectStats[hoveredBarIndex].subjectName} ({subjectStats[hoveredBarIndex].subjectCode})
                              </span>
                              <span className="text-gray-500">|</span>
                              <span className="text-cyan-400 font-bold">
                                ATTENDED: {subjectStats[hoveredBarIndex].presents} / {subjectStats[hoveredBarIndex].total}
                              </span>
                              <span className="text-gray-500">|</span>
                              <span className={subjectStats[hoveredBarIndex].percentage < 75 ? "text-rose-400 font-bold" : "text-emerald-400 font-bold"}>
                                RATIO: {subjectStats[hoveredBarIndex].percentage}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-[9px] text-gray-500 font-mono uppercase tracking-wider animate-pulse flex items-center gap-1.5">
                              <TrendingUp className="w-3 h-3 text-cyan-400" /> Hover individual vector columns for detailed session ratios
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

              </div>

              {/* Subject Breakdown List section with rich progress bars and safe/warning predictions */}
              <div className="bg-[#0b0f19]/80 backdrop-blur-md border border-cyan-500/15 rounded-xl p-5 shadow-lg">
                <span className="text-[9px] uppercase font-mono tracking-widest text-cyan-500/70 mb-3 block">CURRICULUM CLASS COGNITIVE TRACK</span>
                <h4 className="text-xs font-bold font-sans text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>Interactive Subject-by-Subject progress & eligibility overview</span>
                </h4>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {subjectStats.map(subItem => {
                    const meta = calculateProgressMeta(subItem.presents, subItem.total);
                    return (
                      <div key={subItem.subjectCode} className="bg-slate-950/40 border border-cyan-500/10 p-4 rounded-xl flex flex-col justify-between hover:border-cyan-500/20 transition-all">
                        <div>
                          <div className="flex justify-between items-start gap-2">
                            <div className="space-y-0.5">
                              <span className="font-mono text-[9px] text-cyan-400 uppercase tracking-wider">{subItem.subjectCode}</span>
                              <h5 className="text-xs font-bold text-white leading-tight uppercase line-clamp-1">{subItem.subjectName}</h5>
                            </div>
                            <span className={`text-base font-extrabold font-mono shrink-0 ${
                              subItem.percentage < 75 ? 'text-rose-400' : 'text-emerald-400'
                            }`}>
                              {subItem.percentage}%
                            </span>
                          </div>

                          {/* Horizontal Progress Bar */}
                          <div className="w-full bg-cyan-950/40 h-2.5 rounded-full overflow-hidden mt-3.5 relative border border-cyan-500/5">
                            {/* 75% Marker Line indicator */}
                            <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-red-400/80 z-10" title="75% minimum" />
                            <div
                              className={`h-full rounded-full transition-all duration-700 ${
                                subItem.percentage < 75 
                                  ? 'bg-gradient-to-r from-rose-600 to-rose-400/95 shadow-[0_0_6px_rgba(239,68,68,0.3)]' 
                                  : 'bg-gradient-to-r from-cyan-600 to-cyan-400/95 shadow-[0_0_6px_rgba(6,182,212,0.3)]'
                              }`}
                              style={{ width: `${subItem.percentage}%` }}
                            />
                          </div>

                          <div className="flex justify-between items-center text-[10px] text-gray-400 mt-2 font-mono">
                            <span>Classes: {subItem.presents} / {subItem.total}</span>
                            <span className="text-[9px] uppercase font-bold tracking-wider opacity-60">Req ratio: 75%</span>
                          </div>
                        </div>

                        <div className="border-t border-cyan-500/5 pt-2.5 mt-3 text-[10px] flex items-center justify-between">
                          <span className={`font-mono leading-none ${meta.color}`}>
                            {meta.message}
                          </span>
                          {subItem.percentage < 75 ? (
                            <span className="text-[8px] bg-rose-950/40 text-rose-400 border border-rose-500/25 font-bold px-1.5 py-0.5 rounded leading-none">
                              ALERT_RISK
                            </span>
                          ) : (
                            <span className="text-[8px] bg-emerald-950/40 text-emerald-400 border border-emerald-500/25 font-bold px-1.5 py-0.5 rounded leading-none">
                              ACC_PASS
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Beacon Scanner Controls & Analytics Summary */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                
                {/* Checkin Console Column */}
                <div className="lg:col-span-8">
                  {/* Checkin console */}
                  <div className="bg-cyan-950/20 backdrop-blur-xl border border-cyan-500/20 p-5 rounded-xl relative overflow-hidden shadow-[0_8px_32px_rgba(6,182,212,0.08)]">
                    <div className="absolute top-0 right-0 p-3 text-cyan-400/10 pointer-events-none">
                      <Wifi className="w-14 h-14" />
                    </div>
                    
                    <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded bg-cyan-950/40 border border-cyan-500/20 text-cyan-400 text-[9px] font-mono mb-3">
                      <Sparkles className="w-3 h-3 animate-spin text-cyan-400" />
                      <span>SECURE BLE SIGNALS BROADCASTING NOW</span>
                    </span>

                    <h3 className="text-base font-bold font-display text-white uppercase tracking-wide">Dynamic Scanning Beacon check-in</h3>
                    <p className="text-xs text-cyan-300/60 font-sans mt-0.5">Enter the live 6-digit credential broadcasted on the screen to declare attendance registers.</p>

                    <form onSubmit={handleCheckin} className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">A. Target Class Segment</label>
                        <select
                          className="w-full text-xs bg-slate-950/60 text-white px-3 py-2 border border-cyan-500/25 rounded focus:border-cyan-400 outline-none backdrop-blur-sm cursor-pointer"
                          value={checkinSlotId}
                          onChange={(e) => setCheckinSlotId(e.target.value)}
                        >
                          {timetable.length === 0 ? (
                            <option value="">No registered class blocks</option>
                          ) : (
                            timetable.map(t => (
                              <option key={t.id} value={t.id} className="bg-slate-900">{t.subject} (Dr. {t.lecturerName ? t.lecturerName.split(' ').pop() : 'Unknown'})</option>
                            ))
                          )}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">B. Dynamic 6-digit Code</label>
                        <input
                          type="text"
                          required
                          maxLength={6}
                          placeholder="e.g. 523812"
                          className="w-full text-xs font-mono bg-slate-950/60 text-white px-3 py-2 border border-cyan-500/25 rounded focus:border-cyan-400 outline-none placeholder-cyan-950 tracking-widest font-bold backdrop-blur-sm"
                          value={checkinOtp}
                          onChange={(e) => setCheckinOtp(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">C. Sign check-in</label>
                        <button
                          type="submit"
                          disabled={checkinLoading || timetable.length === 0}
                          className="w-full text-xs font-display font-semibold bg-cyan-700/50 hover:bg-cyan-500 hover:text-black border border-cyan-400/65 rounded py-2 transition-all cursor-pointer disabled:opacity-30 flex items-center justify-center space-x-1.5"
                        >
                          <KeyRound className="w-3.5 h-3.5" />
                          <span>VERIFY_BEACON</span>
                        </button>
                      </div>
                    </form>
                    <p className="text-[10px] text-cyan-400/40 mt-3 font-mono">
                      *Tip: Go to Lecturer Portal &mdash;&gt; SELECT class &mdash;&gt; CLICK "CYBER_SCAN" &mdash;&gt; Click "LAUNCH_SCANNING_BEACON" to display the active scanned OTP.
                    </p>
                  </div>
                </div>

                {/* Quantitative statistics sub-blocks Column */}
                <div className="lg:col-span-4 flex flex-col justify-between gap-4">
                  <div className="bg-cyan-950/15 backdrop-blur-md border border-cyan-500/10 p-4 rounded-xl flex-1 flex flex-col justify-between">
                    <span className="text-[9px] uppercase font-mono text-cyan-400 block tracking-wider">TOTAL MONITORED LOGS</span>
                    <h4 className="text-2xl font-black font-display text-white mt-1">{totalClassesLogCount}</h4>
                    <span className="text-[9px] text-gray-500 font-mono mt-0.5 block uppercase tracking-wider">Certified registers held</span>
                  </div>

                  <div className="bg-cyan-950/15 backdrop-blur-md border border-cyan-500/10 p-4 rounded-xl flex-1 flex flex-col justify-between">
                    <span className="text-[9px] uppercase font-mono text-cyan-400 block tracking-wider">CERTIFIED PRESENTS</span>
                    <h4 className="text-2xl font-black font-display text-emerald-400 mt-1">{presentCount}</h4>
                    <span className="text-[9px] text-emerald-500/60 font-mono mt-0.5 block uppercase tracking-wider">Verifiable present matches</span>
                  </div>

                  <div className="bg-cyan-950/15 backdrop-blur-md border border-cyan-500/10 p-4 rounded-xl flex-1 flex flex-col justify-between">
                    <span className="text-[9px] uppercase font-mono text-cyan-400 block tracking-wider">DECLARED ABSENCES</span>
                    <h4 className="text-2xl font-black font-display text-rose-400 mt-1">{absentCount}</h4>
                    <span className="text-[9px] text-red-500/60 font-mono mt-0.5 block uppercase tracking-wider">Missed academic classes</span>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* VIEW: ATTENDANCE HISTORY LIST */}
          {activeTab === 'attendance' && (
            <div className="space-y-6 relative z-10">
              <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 bg-cyan-950/30 border-b border-cyan-500/15 flex justify-between items-center">
                  <div>
                    <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider">Historical Personal Attendance Log ledgers</h4>
                    <p className="text-[10px] font-mono text-cyan-400/50 uppercase mt-0.5">Synchronized with central registrar servers</p>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-cyan-500/5 bg-slate-950/40">
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">CERTIFICATE TIMESTAMP</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">CURRICULUM CLASS SEGMENT</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">SECTOR LOCATION</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider text-center">TRANSMITTED SIGNAL STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/5 text-xs">
                      {myAttendance.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-xs font-mono text-gray-500 uppercase">NO ATTENDANCE DATA MONITORED UNDER YOUR SEAT NUMBER</td>
                        </tr>
                      ) : (
                        [...myAttendance].reverse().map(rec => {
                          const slot = timetable.find(t => t.id === rec.timetableSlotId);
                          return (
                            <tr key={rec.id} className="hover:bg-cyan-950/5 transition-all">
                              <td className="p-4 font-mono text-gray-400 text-[11px]">
                                {rec.timestamp ? new Date(rec.timestamp).toLocaleString() : '---'}
                              </td>
                              <td className="p-4 font-semibold text-white">
                                <span className="font-sans font-bold text-white block">
                                  {rec.subjectName || (slot ? slot.subject : rec.subjectCode || 'Subject Module')}
                                </span>
                                <span className="text-[9.5px] font-mono text-cyan-400 uppercase tracking-widest block mt-0.5">
                                  {rec.subjectCode} • {rec.date} {rec.time ? `• ${rec.time}` : ''}
                                </span>
                              </td>
                              <td className="p-4 font-mono text-xs text-gray-300">
                                <span className="block">{rec.room || (slot ? slot.room : 'General Lab')}</span>
                                <span className="text-[8.5px] text-gray-500 uppercase block mt-0.5">
                                  Lecturer: {rec.lecturerName || (slot ? slot.lecturerName : 'Staff')}
                                </span>
                                <span className="text-[8.5px] text-cyan-400/80 font-mono uppercase block">
                                  Method: {rec.verificationMethod || 'Manual Entry'}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`inline-block font-mono text-[9px] font-bold px-2 py-0.5 rounded border ${
                                  rec.status === 'Present'
                                    ? 'bg-emerald-950/25 border-emerald-500/35 text-emerald-400'
                                    : rec.status === 'Late'
                                    ? 'bg-amber-950/25 border-amber-500/35 text-amber-400'
                                    : 'bg-red-950/25 border-red-500/35 text-red-400'
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

          {/* VIEW: CLASSES TIMETABLE SCHEDULES */}
          {activeTab === 'timetable' && (
            <div className="space-y-6 relative z-10 animate-fade-in">
              <CalendarView slots={timetable} />
            </div>
          )}

          {/* VIEW: REPLICATOR PROFILE DETAILS */}
          {activeTab === 'profile' && (
            <div className="space-y-6 relative z-10">
              <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-6 rounded-xl shadow-lg text-xs font-mono relative">
                
                {/* Visual Scanner Horizontal Line */}
                <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent animation-pulse" />

                <div className="flex flex-col md:flex-row gap-6 items-center border-b border-cyan-500/5 pb-6 mb-6">
                  <div className="p-4 rounded-xl border border-cyan-500/20 bg-slate-950/40 relative">
                    <User className="w-16 h-16 text-cyan-400" />
                    <div className="absolute bottom-1 right-1 w-3 h-3 bg-emerald-500 rounded-full border border-black shadow" />
                  </div>
                  <div className="text-center md:text-left space-y-1">
                    <span className="text-[10px] text-cyan-400/80 uppercase">AUTHORIZED STUDENT REPLICATOR ID:</span>
                    <h3 className="text-xl font-bold font-display text-white mt-1 leading-none uppercase">{session.user.name}</h3>
                    <p className="text-cyan-300/60 text-xs mt-1 font-mono tracking-wider">{session.user.usn} // {session.user.department}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-4 bg-slate-950/40 border border-cyan-500/10 rounded">
                    <span className="text-[9px] text-gray-500 block uppercase">CORE REGISTRY EMAIL:</span>
                    <span className="text-white text-xs block mt-1.5 font-bold">{session.user.email || 'aero.chen@nexo.edu'}</span>
                  </div>
                  <div className="p-4 bg-slate-950/40 border border-cyan-500/10 rounded">
                    <span className="text-[9px] text-gray-500 block uppercase">DEPARTMENT BRANCH:</span>
                    <span className="text-white text-xs block mt-1.5 font-bold">{session.user.department || DEPARTMENTS[0]}</span>
                  </div>
                  <div className="p-4 bg-slate-950/40 border border-cyan-500/10 rounded">
                    <span className="text-[9px] text-gray-500 block uppercase">SEMESTER BLOCK LEVEL:</span>
                    <span className="text-white text-xs block mt-1.5 font-bold">{session.user.semester || SEMESTERS[0]}</span>
                  </div>
                  <div className="p-4 bg-slate-950/40 border border-cyan-500/10 rounded">
                    <span className="text-[9px] text-gray-500 block uppercase">SECURITY ACCREDITATION:</span>
                    <span className="text-[#00ffe5] text-xs block mt-1.5 font-bold uppercase">LEVEL 3 ACADEMIC IDENTIFIER</span>
                  </div>
                </div>

                <div className="border-t border-cyan-500/5 pt-5 mt-6 flex justify-between text-[10px] text-gray-500">
                  <span>IDENTITY CODE COMPLIANT: CYB-ID-38290</span>
                  <span>ACCORDANCE COMPLETED // REGISTER SECURE</span>
                </div>
              </div>
            </div>
          )}

        </div>
      </main>
    </div>
  );
}
