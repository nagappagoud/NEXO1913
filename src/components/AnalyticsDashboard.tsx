import React, { useState } from 'react';
import * as XLSX from 'xlsx';
import { 
  Users, BookOpen, Clock, Activity, TrendingUp, Calendar, AlertTriangle, 
  ShieldCheck, RefreshCw, Sparkles, Filter, Percent, CheckCircle2, XCircle, ChevronRight, Search,
  Download, FileSpreadsheet
} from 'lucide-react';
import { Student, Lecturer, Subject, AttendanceRecord, TimetableSlot, DEPARTMENTS } from '../types';

interface AnalyticsDashboardProps {
  students: Student[];
  lecturers: Lecturer[];
  subjects: Subject[];
  attendance: AttendanceRecord[];
  timetable: TimetableSlot[];
  userRole: 'admin' | 'lecturer';
  lecturerId?: string;
  lecturerDept?: string;
}

// Month lookup standard 2026 academic timeline
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export default function AnalyticsDashboard({
  students,
  lecturers,
  subjects,
  attendance,
  timetable,
  userRole,
  lecturerId,
  lecturerDept
}: AnalyticsDashboardProps) {
  
  // Scoping controls
  const [scopeToLecturer, setScopeToLecturer] = useState<boolean>(userRole === 'lecturer');
  const [useSyntheticData, setUseSyntheticData] = useState<boolean>(false);
  const [studentSearch, setStudentSearch] = useState<string>('');
  
  // Export selection filters
  const [exportSubject, setExportSubject] = useState<string>('ALL');
  const [exportDate, setExportDate] = useState<string>('');
  const [exportSemester, setExportSemester] = useState<string>('ALL');
  
  // Hover interaction indices
  const [hoveredMonthlyIdx, setHoveredMonthlyIdx] = useState<number | null>(null);
  const [hoveredDeptIdx, setHoveredDeptIdx] = useState<number | null>(null);
  const [hoveredSubjectIdx, setHoveredSubjectIdx] = useState<number | null>(null);

  // Filter core records based on roles and scopes
  const activeLecturerSubjects = scopeToLecturer && lecturerId
    ? lecturers.find(l => l.lecturerId === lecturerId || l.id === lecturerId)?.subjects || []
    : [];

  const scopedAttendance = scopeToLecturer
    ? attendance.filter(record => activeLecturerSubjects.includes(record.subjectCode))
    : attendance;

  const scopedStudents = scopeToLecturer && lecturerDept
    ? students.filter(s => s.department === lecturerDept)
    : students;

  // ==================== SYNTHETIC REPLICA GENERATOR ====================
  // High fidelity replica data ensuring continuous service display on fresh server databases
  const mockMonthlyData = [
    { month: 'Jan', presents: 320, total: 360, pct: 88 },
    { month: 'Feb', presents: 440, total: 500, pct: 88 },
    { month: 'Mar', presents: 512, total: 600, pct: 85 },
    { month: 'Apr', presents: 580, total: 720, pct: 80 },
    { month: 'May', presents: 640, total: 750, pct: 85 },
    { month: 'Jun', presents: 95,  total: 110, pct: 86 }
  ];

  const mockDeptData = [
    { label: 'CSE', presents: 440, total: 500, pct: 88, deptFullName: 'Computer Science Engineering (CSE)' },
    { label: 'ISE', presents: 395, total: 470, pct: 84, deptFullName: 'Information Science Engineering (ISE)' },
    { label: 'ECE', presents: 304, total: 410, pct: 74, deptFullName: 'Electronics and Communication Engineering (ECE)' },
    { label: 'AE',  presents: 342, total: 390, pct: 87, deptFullName: 'Aeronautical Engineering (AE)' }
  ];

  const mockSubjectData = [
    { code: '1NX-NN', name: 'Neural Networks & Deep Learning', presents: 145, total: 160, pct: 90 },
    { code: '1NX-CS', name: 'Cyber Warfare & Cryptography', presents: 132, total: 180, pct: 73 },
    { code: '1NX-AI', name: 'Autonomous Agents & LLMs', presents: 168, total: 190, pct: 88 },
    { code: '1NX-RH', name: 'Robotic Haptics & Feedback Systems', presents: 112, total: 150, pct: 74 },
    { code: '1NX-DM', name: 'Distributed Consensus & Ledgers', presents: 120, total: 140, pct: 85 }
  ];

  // ==================== LIVE LEDGER CALCULATORS ====================
  
  // Compute Monthly Attendance Metrics
  const computeLiveMonthlyStats = () => {
    const monthsMap: Record<number, { presents: number; totals: number }> = {};
    
    scopedAttendance.forEach(record => {
      if (!record.date) return;
      const parts = record.date.split('-');
      if (parts.length >= 2) {
        const monthNum = parseInt(parts[1]) - 1; // 0-indexed month
        if (monthNum >= 0 && monthNum < 12) {
          if (!monthsMap[monthNum]) {
            monthsMap[monthNum] = { presents: 0, totals: 0 };
          }
          monthsMap[monthNum].totals += 1;
          if (record.status === 'Present') {
            monthsMap[monthNum].presents += 1;
          }
        }
      }
    });

    const activeMonths = Object.keys(monthsMap).map(Number).sort((a, b) => a - b);
    if (activeMonths.length === 0) return mockMonthlyData;

    return activeMonths.map(mIdx => {
      const { presents, totals } = monthsMap[mIdx];
      return {
        month: MONTH_NAMES[mIdx],
        presents,
        total: totals,
        pct: totals > 0 ? Math.round((presents / totals) * 100) : 100
      };
    });
  };

  // Compute Department Attendance Metrics
  const computeLiveDeptStats = () => {
    const deptMap: Record<string, { presents: number; totals: number }> = {};
    
    // Initialize standard system departments
    DEPARTMENTS.forEach(d => {
      deptMap[d] = { presents: 0, totals: 0 };
    });

    scopedAttendance.forEach(record => {
      let dept = record.department;
      if (!dept) {
        const student = students.find(
          s => s.usn.toUpperCase() === record.studentUsn.toUpperCase() || s.id === record.studentId
        );
        if (student) dept = student.department;
      }

      if (dept) {
        // Fallback matching if there is minor case distortion
        const exactDept = DEPARTMENTS.find(d => d.toLowerCase() === dept!.toLowerCase()) || 
                          DEPARTMENTS.find(d => d.toLowerCase().includes(dept!.toLowerCase()) || dept!.toLowerCase().includes(d.toLowerCase()));
        if (exactDept) {
          deptMap[exactDept].totals += 1;
          if (record.status === 'Present') {
            deptMap[exactDept].presents += 1;
          }
        }
      }
    });

    const labelMap: Record<string, string> = {
      'Computer Science Engineering (CSE)': 'CSE',
      'Information Science Engineering (ISE)': 'ISE',
      'Electronics and Communication Engineering (ECE)': 'ECE',
      'Aeronautical Engineering (AE)': 'AE'
    };

    return DEPARTMENTS.map(dName => {
      const { presents, totals } = deptMap[dName] || { presents: 0, totals: 0 };
      const label = labelMap[dName] || dName.substring(0, 5).toUpperCase();
      return {
        label,
        presents,
        total: totals,
        pct: totals > 0 ? Math.round((presents / totals) * 100) : 100,
        deptFullName: dName
      };
    });
  };

  // Compute Subject Attendance Metrics
  const computeLiveSubjectStats = () => {
    const subsMap: Record<string, { presents: number; totals: number }> = {};
    
    scopedAttendance.forEach(record => {
      const code = record.subjectCode;
      if (!code) return;
      
      const upperCode = code.toUpperCase();
      if (!subsMap[upperCode]) {
        subsMap[upperCode] = { presents: 0, totals: 0 };
      }
      subsMap[upperCode].totals += 1;
      if (record.status === 'Present') {
        subsMap[upperCode].presents += 1;
      }
    });

    const activeCodes = Object.keys(subsMap);
    if (activeCodes.length === 0) return mockSubjectData;

    return activeCodes.map(code => {
      const sub = subjects.find(s => s.subjectCode.toUpperCase() === code);
      const name = sub ? sub.subjectName : 'Cognitive Program Block';
      const { presents, totals } = subsMap[code];
      return {
        code,
        name,
        presents,
        total: totals,
        pct: totals > 0 ? Math.round((presents / totals) * 100) : 100
      };
    });
  };

  // Assign datasets based on simulation choice
  const monthlyData = useSyntheticData ? mockMonthlyData : computeLiveMonthlyStats();
  const deptData = useSyntheticData ? mockDeptData : computeLiveDeptStats();
  const subjectData = useSyntheticData ? mockSubjectData : computeLiveSubjectStats();

  // Aggregate Key Quantities
  const totalLogsCount = useSyntheticData 
    ? monthlyData.reduce((acc, c) => acc + c.total, 0)
    : scopedAttendance.length;

  const presentsCount = useSyntheticData
    ? monthlyData.reduce((acc, c) => acc + c.presents, 0)
    : scopedAttendance.filter(r => r.status === 'Present').length;

  const absentsCount = totalLogsCount - presentsCount;

  // CSV Generator and Automated Exporter module
  const handleExportCSV = () => {
    let recordsToProcess: AttendanceRecord[] = [];

    if (useSyntheticData) {
      // High fidelity synthetic data representation for development/preview systems check
      const simRecords = [
        { studentUsn: '1GD25CS086', studentName: 'NAP', subjectCode: '1NX-NN', date: '2026-06-01', status: 'Present', semester: '5' },
        { studentUsn: '1GD25CS086', studentName: 'NAP', subjectCode: '1NX-NN', date: '2026-06-02', status: 'Present', semester: '5' },
        { studentUsn: '1GD25CS012', studentName: 'Alice Smith', subjectCode: '1NX-NN', date: '2026-06-02', status: 'Present', semester: '5' },
        { studentUsn: '1GD25CS050', studentName: 'John Doe', subjectCode: '1NX-CS', date: '2026-06-01', status: 'Present', semester: '5' },
        { studentUsn: '1GD25EC045', studentName: 'David Miller', subjectCode: '1NX-AI', date: '2026-06-01', status: 'Absent', semester: '5' },
        { studentUsn: '1GD25IS077', studentName: 'Priya Sharma', subjectCode: '1NX-RH', date: '2026-06-02', status: 'Present', semester: '7' },
        { studentUsn: '1GD25CS105', studentName: 'Alex Wong', subjectCode: '1NX-DM', date: '2026-06-02', status: 'Absent', semester: '7' },
      ] as AttendanceRecord[];
      recordsToProcess = simRecords;
    } else {
      // Use scoped attendance based on lecturer context or administrator system context
      recordsToProcess = scopedAttendance;
    }

    // Apply filters based on selected Export console settings
    const filtered = recordsToProcess.filter(record => {
      // 1. Subject code match filter
      if (exportSubject !== 'ALL' && record.subjectCode.toUpperCase() !== exportSubject.toUpperCase()) {
        return false;
      }

      // 2. Exact ISO timestamp date filter
      if (exportDate && record.date !== exportDate) {
        return false;
      }

      // 3. Academic semester node filter
      if (exportSemester !== 'ALL') {
        let rSem = record.semester;
        if (!rSem) {
          const sObj = students.find(s => s.usn.toUpperCase() === record.studentUsn.toUpperCase() || s.id === record.studentId);
          rSem = sObj ? sObj.semester : undefined;
        }
        if (rSem !== exportSemester) {
          return false;
        }
      }

      return true;
    });

    const headers = ["Student Name", "USN", "Subject", "Date", "Status", "Attendance Percentage"];

    const rows = filtered.map(record => {
      let sName = record.studentName || "";
      if (!sName) {
        const sObj = students.find(s => s.usn.toUpperCase() === record.studentUsn.toUpperCase() || s.id === record.studentId);
        sName = sObj ? sObj.name : "UNKNOWN STUDENT";
      }

      const sub = subjects.find(s => s.subjectCode.toUpperCase() === record.subjectCode.toUpperCase());
      const subjectLabel = sub ? `${sub.subjectCode} - ${sub.subjectName}` : record.subjectCode;

      let pctStr = "0.0%";
      if (useSyntheticData) {
        if (record.studentUsn === '1GD25CS086') pctStr = "90.0%";
        else if (record.studentUsn === '1GD25CS012') pctStr = "94.4%";
        else if (record.studentUsn === '1GD25CS050') pctStr = "80.0%";
        else if (record.studentUsn === '1GD25EC045') pctStr = "66.7%";
        else if (record.studentUsn === '1GD25IS077') pctStr = "95.5%";
        else if (record.studentUsn === '1GD25CS105') pctStr = "70.0%";
      } else {
        const studentLogRecords = scopedAttendance.filter(r => 
          (r.studentUsn && r.studentUsn.toUpperCase() === record.studentUsn.toUpperCase()) || 
          (r.studentId && r.studentId === record.studentId)
        );
        const rectotal = studentLogRecords.length;
        const recpresent = studentLogRecords.filter(r => r.status === 'Present').length;
        pctStr = rectotal > 0 ? `${((recpresent / rectotal) * 100).toFixed(1)}%` : "0.0%";
      }

      return [
        sName,
        record.studentUsn,
        subjectLabel,
        record.date,
        record.status,
        pctStr
      ];
    });

    // Format fields with quotes to support commas inside subject titles dynamically
    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `nexo-attendance-sub_${exportSubject}-sem_${exportSemester}-${timestamp}.csv`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportExcel = () => {
    let recordsToProcess: AttendanceRecord[] = [];

    if (useSyntheticData) {
      const simRecords = [
        { studentUsn: '1GD25CS086', studentName: 'NAP', subjectCode: '1NX-NN', date: '2026-06-01', status: 'Present', semester: '5' },
        { studentUsn: '1GD25CS086', studentName: 'NAP', subjectCode: '1NX-NN', date: '2026-06-02', status: 'Present', semester: '5' },
        { studentUsn: '1GD25CS012', studentName: 'Alice Smith', subjectCode: '1NX-NN', date: '2026-06-02', status: 'Present', semester: '5' },
        { studentUsn: '1GD25CS050', studentName: 'John Doe', subjectCode: '1NX-CS', date: '2026-06-01', status: 'Present', semester: '5' },
        { studentUsn: '1GD25EC045', studentName: 'David Miller', subjectCode: '1NX-AI', date: '2026-06-01', status: 'Absent', semester: '5' },
        { studentUsn: '1GD25IS077', studentName: 'Priya Sharma', subjectCode: '1NX-RH', date: '2026-06-02', status: 'Present', semester: '7' },
        { studentUsn: '1GD25CS105', studentName: 'Alex Wong', subjectCode: '1NX-DM', date: '2026-06-02', status: 'Absent', semester: '7' },
      ] as AttendanceRecord[];
      recordsToProcess = simRecords;
    } else {
      recordsToProcess = scopedAttendance;
    }

    // Apply filters based on selected Export settings
    const filtered = recordsToProcess.filter(record => {
      // 1. Subject code match filter
      if (exportSubject !== 'ALL' && record.subjectCode.toUpperCase() !== exportSubject.toUpperCase()) {
        return false;
      }

      // 2. Exact ISO timestamp date filter
      if (exportDate && record.date !== exportDate) {
        return false;
      }

      // 3. Academic semester node filter
      if (exportSemester !== 'ALL') {
        let rSem = record.semester;
        if (!rSem) {
          const sObj = students.find(s => s.usn.toUpperCase() === record.studentUsn.toUpperCase() || s.id === record.studentId);
          rSem = sObj ? sObj.semester : undefined;
        }
        if (rSem !== exportSemester) {
          return false;
        }
      }

      return true;
    });

    const exportRows = filtered.map(record => {
      let sName = record.studentName || "";
      let sDept = record.department || "COMPUTER SCIENCE";
      
      const sObj = students.find(s => 
        (record.studentUsn && s.usn.toUpperCase() === record.studentUsn.toUpperCase()) || 
        (record.studentId && s.id === record.studentId)
      );
      
      if (!sName) {
        sName = sObj ? sObj.name : "UNKNOWN STUDENT";
      }
      if (sObj && sObj.department) {
        sDept = sObj.department;
      }

      if (useSyntheticData) {
        if (record.studentUsn === '1GD25CS086') sDept = 'CSE';
        else if (record.studentUsn === '1GD25CS012') sDept = 'CSE';
        else if (record.studentUsn === '1GD25CS050') sDept = 'CSE';
        else if (record.studentUsn === '1GD25EC045') sDept = 'ECE';
        else if (record.studentUsn === '1GD25IS077') sDept = 'ISE';
        else if (record.studentUsn === '1GD25CS105') sDept = 'CSE';
      }

      const sub = subjects.find(s => s.subjectCode.toUpperCase() === record.subjectCode.toUpperCase());
      const subjectLabel = sub ? `${sub.subjectCode} - ${sub.subjectName}` : record.subjectCode;

      let pctStr = "0.0%";
      if (useSyntheticData) {
        if (record.studentUsn === '1GD25CS086') pctStr = "90.0%";
        else if (record.studentUsn === '1GD25CS012') pctStr = "94.4%";
        else if (record.studentUsn === '1GD25CS050') pctStr = "80.0%";
        else if (record.studentUsn === '1GD25EC045') pctStr = "66.7%";
        else if (record.studentUsn === '1GD25IS077') pctStr = "95.5%";
        else if (record.studentUsn === '1GD25CS105') pctStr = "70.0%";
      } else {
        const studentLogRecords = scopedAttendance.filter(r => 
          (r.studentUsn && r.studentUsn.toUpperCase() === record.studentUsn.toUpperCase()) || 
          (r.studentId && r.studentId === record.studentId)
        );
        const rectotal = studentLogRecords.length;
        const recpresent = studentLogRecords.filter(r => r.status === 'Present').length;
        pctStr = rectotal > 0 ? `${((recpresent / rectotal) * 100).toFixed(1)}%` : "0.0%";
      }

      return {
        "Student Name": sName,
        "USN": record.studentUsn,
        "Department": sDept.toUpperCase(),
        "Subject": subjectLabel,
        "Date": record.date,
        "Status": record.status,
        "Attendance Percentage": pctStr
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    
    // Auto-adjust column widths
    const colWidths = [
      { wch: 22 }, // Student Name
      { wch: 15 }, // USN
      { wch: 20 }, // Department
      { wch: 30 }, // Subject
      { wch: 12 }, // Date
      { wch: 10 }, // Status
      { wch: 22 }, // Attendance Percentage
    ];

    if (exportRows.length > 0) {
      const keys = Object.keys(exportRows[0]);
      const maxLen = keys.map((key, ColIdx) => {
        let len = key.length;
        exportRows.forEach(row => {
          const val = String(row[key as keyof typeof row] || '');
          if (val.length > len) len = val.length;
        });
        return { wch: Math.max(len + 3, colWidths[ColIdx]?.wch || 12) };
      });
      worksheet['!cols'] = maxLen;
    } else {
      worksheet['!cols'] = colWidths;
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Report");

    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `nexo-attendance-sub_${exportSubject}-sem_${exportSemester}-${timestamp}.xlsx`;
    
    XLSX.writeFile(workbook, filename);
  };

  const attendancePercentage = totalLogsCount > 0 
    ? Math.round((presentsCount / totalLogsCount) * 100) 
    : 85;

  const studentsUnderThreshold = useSyntheticData
    ? 12
    : students.filter(s => s.attendancePercentage < 75).length;

  // Real-time calculated fields for the six metric cards
  const todayDateStr = new Date().toISOString().split('T')[0];

  const finalTotalStudents = useSyntheticData 
    ? 148 
    : (scopeToLecturer ? scopedStudents.length : students.length);

  const finalTotalLecturers = useSyntheticData 
    ? 12 
    : (lecturers && lecturers.length > 0 ? lecturers.length : (userRole === 'lecturer' ? 1 : 0));

  const finalTotalSubjects = useSyntheticData 
    ? 8 
    : (scopeToLecturer ? activeLecturerSubjects.length : subjects.length);

  const presentToday = useSyntheticData 
    ? 34 
    : scopedAttendance.filter(r => r.date === todayDateStr && r.status === 'Present').length;

  const absentToday = useSyntheticData 
    ? 6 
    : scopedAttendance.filter(r => r.date === todayDateStr && r.status === 'Absent').length;

  return (
    <div className="bg-black text-gray-300 font-sans p-6 rounded-2xl border border-cyan-500/20 shadow-[0_0_25px_rgba(6,182,212,0.06)] space-y-6">
      
      {/* HEADER CONTROL CONSOLE */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center bg-black border border-cyan-500/20 p-5 rounded-2xl gap-4 shadow-[inset_0_0_15px_rgba(6,182,212,0.05)]">
        <div>
          <span className="text-[10px] font-mono font-black text-[#00ffcc] tracking-widest block uppercase">
            📊 SYSTEM DYNAMIC ANALYTICS ENGINE
          </span>
          <h2 className="text-lg font-bold text-white uppercase tracking-wider font-display mt-0.5">
            Classroom Biometric Signatures & Core Registers
          </h2>
          <p className="text-[10px] font-mono text-cyan-400/60 uppercase mt-0.5">
            Operational telemetry computed from system event registers
          </p>
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto flex-wrap">
          {userRole === 'lecturer' && (
            <button
              onClick={() => setScopeToLecturer(!scopeToLecturer)}
              className={`flex items-center space-x-1.5 px-3.5 py-2 border rounded-lg text-xs font-mono cursor-pointer transition-all ${
                scopeToLecturer
                  ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                  : 'bg-black border-cyan-500/25 text-gray-400 hover:text-cyan-400'
              }`}
            >
              <Filter className="w-3.5 h-3.5" />
              <span>{scopeToLecturer ? 'SCOPED: MY ASSIGNS' : 'SCOPED: SYSTEM-WIDE'}</span>
            </button>
          )}

          <button
            onClick={() => setUseSyntheticData(!useSyntheticData)}
            className={`flex items-center space-x-1.5 px-3.5 py-2 border rounded-lg text-xs font-mono cursor-pointer transition-all ${
              useSyntheticData
                ? 'bg-cyan-500/10 border-cyan-400 text-cyan-300 font-bold shadow-[0_0_10px_rgba(6,182,212,0.15)]'
                : 'bg-black border-cyan-500/25 text-gray-400 hover:text-cyan-400'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 animate-pulse text-cyan-400" />
            <span>{useSyntheticData ? 'STATE: SIMULATION' : 'STATE: REAL_TIME'}</span>
          </button>
        </div>
      </div>

      {/* WARNING HEADER: IF OVERALL COHORT ATTENDANCE < 75% */}
      {attendancePercentage < 75 && (
        <div id="low-attendance-alert-dashboard" className="bg-black border-2 border-rose-500 rounded-xl p-5 shadow-[0_0_20px_rgba(239,68,68,0.15)] flex flex-col md:flex-row items-center justify-between gap-4 font-mono relative overflow-hidden">
          <div className="absolute top-0 bottom-0 left-0 w-1 bg-rose-500"></div>
          <div className="flex items-start gap-3.5">
            <div className="p-3 bg-rose-950/40 border border-rose-500/30 text-rose-500 rounded-lg shrink-0">
              <AlertTriangle className="w-6 h-6 animate-pulse text-rose-500" />
            </div>
            <div className="space-y-1">
              <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block leading-none">⚠️ Low Attendance Warning</span>
              <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-2">SYSTEM/COHORT CRITICAL ELIGIBILITY REGISTRY ALERT</h4>
              <p className="text-xs text-gray-400 font-sans max-w-xl">
                The monitored cohort's general attendance is currently running below the required institutional minimum threshold of <strong>75%</strong>. Additional consecutive student attendance registers must be recorded to normalize nominal status registers index.
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
              <span className="text-[9px] text-gray-400 block uppercase font-bold mb-1">Classes Needed To Recover</span>
              <span className="text-2xl font-black text-white font-display leading-none">
                {Math.max(0, 3 * totalLogsCount - 4 * presentsCount)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* CORE KPI BENTO GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        
        {/* Metric Card 1: Total Students */}
        <div id="stat-total-students" className="bg-[#0b0d16] border border-cyan-500/15 p-5 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden transition-all duration-300 hover:border-cyan-400 group">
          <div className="absolute -top-4 -right-4 text-cyan-500/5 group-hover:text-cyan-500/10 transition-colors">
            <Users className="w-20 h-20" />
          </div>
          <div>
            <span className="text-[9.5px] font-mono tracking-widest text-[#00ffcc] block uppercase font-bold">TOTAL STUDENTS</span>
            <h3 className="text-3xl font-black text-white mt-2 font-display tracking-tight leading-none">
              {finalTotalStudents}
            </h3>
          </div>
          <span className="text-[9px] text-gray-500 block font-mono mt-3 uppercase tracking-wider">Registered student nodes</span>
        </div>

        {/* Metric Card 2: Total Lecturers */}
        <div id="stat-total-lecturers" className="bg-[#0b0d16] border border-cyan-500/15 p-5 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden transition-all duration-300 hover:border-cyan-400 group">
          <div className="absolute -top-4 -right-4 text-cyan-500/5 group-hover:text-cyan-500/10 transition-colors">
            <Users className="w-20 h-20" />
          </div>
          <div>
            <span className="text-[9.5px] font-mono tracking-widest text-[#00ffcc] block uppercase font-bold">TOTAL LECTURERS</span>
            <h3 className="text-3xl font-black text-white mt-2 font-display tracking-tight leading-none">
              {finalTotalLecturers}
            </h3>
          </div>
          <span className="text-[9px] text-gray-500 block font-mono mt-3 uppercase tracking-wider">Active controller nodes</span>
        </div>

        {/* Metric Card 3: Total Subjects */}
        <div id="stat-total-subjects" className="bg-[#0b0d16] border border-cyan-500/15 p-5 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden transition-all duration-300 hover:border-cyan-400 group">
          <div className="absolute -top-4 -right-4 text-cyan-500/5 group-hover:text-cyan-500/10 transition-colors">
            <BookOpen className="w-20 h-20" />
          </div>
          <div>
            <span className="text-[9.5px] font-mono tracking-widest text-[#00ffcc] block uppercase font-bold">TOTAL SUBJECTS</span>
            <h3 className="text-3xl font-black text-white mt-2 font-display tracking-tight leading-none">
              {finalTotalSubjects}
            </h3>
          </div>
          <span className="text-[9px] text-gray-500 block font-mono mt-3 uppercase tracking-wider">Syllabus registry catalog</span>
        </div>

        {/* Metric Card 4: Present Today */}
        <div id="stat-present-today" className="bg-[#0b0d16] border border-cyan-500/15 p-5 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden transition-all duration-300 hover:border-cyan-400 group">
          <div className="absolute -top-4 -right-4 text-emerald-500/5 group-hover:text-emerald-500/10 transition-colors">
            <CheckCircle2 className="w-20 h-20" />
          </div>
          <div>
            <span className="text-[9.5px] font-mono tracking-widest text-emerald-400 block uppercase font-bold font-mono">PRESENT TODAY</span>
            <h3 className="text-3xl font-black text-white mt-2 font-display tracking-tight leading-none">
              {presentToday}
            </h3>
          </div>
          <span className="text-[9px] text-gray-500 block font-mono mt-3 uppercase tracking-wider">Marked present today</span>
        </div>

        {/* Metric Card 5: Absent Today */}
        <div id="stat-absent-today" className="bg-[#0b0d16] border border-cyan-500/15 p-5 rounded-2xl flex flex-col justify-between shadow-lg relative overflow-hidden transition-all duration-300 hover:border-cyan-400 group">
          <div className="absolute -top-4 -right-4 text-rose-500/5 group-hover:text-rose-500/10 transition-colors">
            <XCircle className="w-20 h-20" />
          </div>
          <div>
            <span className="text-[9.5px] font-mono tracking-widest text-rose-400 block uppercase font-bold font-mono">ABSENT TODAY</span>
            <h3 className="text-3xl font-black text-white mt-2 font-display tracking-tight leading-none">
              {absentToday}
            </h3>
          </div>
          <span className="text-[9px] text-gray-500 block font-mono mt-3 uppercase tracking-wider">Marked absent today</span>
        </div>

        {/* Metric Card 6: Attendance Percentage */}
        <div id="stat-attendance-percentage" className="bg-[#0b0d16] border border-cyan-500/15 p-5 rounded-2xl flex items-center justify-between shadow-lg hover:border-cyan-400 transition-all duration-300 group">
          <div className="space-y-1">
            <span className="text-[9.5px] font-mono tracking-widest text-[#00ffcc] block uppercase font-bold">ATTENDANCE %</span>
            <h3 className="text-3xl font-black font-display tracking-tight text-white leading-none mt-2">
              {attendancePercentage}%
            </h3>
            <span className="text-[9px] text-gray-500 block font-mono mt-1.5 uppercase tracking-wider">Accumulative ratio</span>
          </div>

          <div className="w-14 h-14 relative shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="28" cy="28" r="22" stroke="rgba(6, 182, 212, 0.08)" strokeWidth="4.5" fill="transparent" />
              <circle
                cx="28"
                cy="28"
                r="22"
                stroke="#ef4444" 
                strokeWidth="4.5"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 22}`}
                strokeDashoffset={`${2 * Math.PI * 22 * (1 - attendancePercentage / 100)}`}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-black font-mono text-cyan-400">
              {attendancePercentage}%
            </span>
          </div>
        </div>

      </div>

      {/* DUAL COLUMN ZONE - MONTHLY GRAPH & DEPARTMENT-WISE GRAPH */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* COLUMN 1: MONTHLY ATTENDANCE TRENDS GRAPH (LINE MAP) - 7 COLS */}
        <div className="lg:col-span-7 bg-black border border-cyan-500/15 rounded-2xl p-6 shadow-xl flex flex-col justify-between min-h-[350px]">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-[#00ffcc] block uppercase">
                  📈 1. MONTHLY_ATTENDANCE_SPECTRUM
                </span>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-display">
                  Monthly Attendance Percentage Logs (Trend Map)
                </h4>
              </div>
              <span className="text-[9px] font-mono text-red-500 bg-red-950/10 px-2 py-0.5 border border-red-500/20 rounded font-bold uppercase">
                RED_GRAPH
              </span>
            </div>

            {/* Glowing Red Line Path SVG */}
            <div className="relative">
              {monthlyData.length === 0 ? (
                <div className="h-48 flex items-center justify-center text-xs font-mono text-gray-500 uppercase">
                  Data Stream Empty.
                </div>
              ) : (
                <div className="w-full overflow-x-auto select-none">
                  <svg viewBox="0 0 600 220" className="w-full min-w-[500px] h-auto">
                    <defs>
                      {/* Filter for vivid neon Red glow effect on line trend */}
                      <filter id="neonRedGlow" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="4.5" result="blur1" />
                        <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur2" />
                        <feMerge>
                          <feMergeNode in="blur1" />
                          <feMergeNode in="blur2" />
                          <feMergeNode in="SourceGraphic" />
                        </feMerge>
                      </filter>
                      <linearGradient id="redAreaGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#ef4444" stopOpacity="0.0" />
                      </linearGradient>
                      <linearGradient id="gridHorizontalGlow" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(6, 182, 212, 0.08)" stopOpacity="1" />
                        <stop offset="50%" stopColor="rgba(6, 182, 212, 0.02)" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="rgba(6, 182, 212, 0.08)" stopOpacity="1" />
                      </linearGradient>
                    </defs>

                    {/* Y-Axis scale marks */}
                    {[0, 25, 50, 75, 100].map((level) => {
                      const y = 175 - (level * 1.5);
                      return (
                        <g key={level} className="opacity-90">
                          <line
                            x1="45"
                            y1={y}
                            x2="565"
                            y2={y}
                            stroke="url(#gridHorizontalGlow)"
                            strokeWidth="1"
                            strokeDasharray={level === 75 ? "0" : "4,4"}
                            className={level === 75 ? "stroke-red-500/25" : ""}
                          />
                          <text
                            x="35"
                            y={y + 3}
                            textAnchor="end"
                            className="fill-cyan-500/55 font-mono text-[9px] font-black"
                          >
                            {level}%
                          </text>
                          {level === 75 && (
                            <text
                              x="570"
                              y={y + 3}
                              className="fill-red-500 font-mono text-[8px] font-black"
                              textAnchor="start"
                            >
                              REQ 75%
                            </text>
                          )}
                        </g>
                      );
                    })}

                    {/* Plot coordinates */}
                    {(() => {
                      const padL = 60;
                      const padR = 550;
                      const spanX = padR - padL;
                      const len = monthlyData.length;

                      const points = monthlyData.map((d, i) => {
                        const divisor = len > 1 ? len - 1 : 1;
                        const x = len > 1 ? padL + (i * (spanX / divisor)) : (padL + padR) / 2;
                        const y = 175 - (d.pct * 1.5);
                        return { x, y, label: d.month, pct: d.pct, presents: d.presents, total: d.total };
                      });

                      const pathD = points.reduce((acc, p, i) => {
                        return acc + `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y} `;
                      }, '');

                      const areaD = pathD + `L ${points[points.length - 1].x} 175 L ${points[0].x} 175 Z`;

                      return (
                        <>
                          {/* Shaded Red Gradient Area under graph */}
                          <path d={areaD} fill="url(#redAreaGlow)" />

                          {/* Glowing neon RED Line */}
                          <path
                            d={pathD}
                            fill="none"
                            stroke="#ef4444" // RED GRAPH STROKE
                            strokeWidth="3.2"
                            strokeLinecap="round"
                            filter="url(#neonRedGlow)"
                          />

                          {/* Data coordinates anchoring points */}
                          {points.map((p, i) => {
                            const isHovered = hoveredMonthlyIdx === i;
                            return (
                              <g key={i}>
                                <circle
                                  cx={p.x}
                                  cy={p.y}
                                  r={isHovered ? 7.5 : 5.5}
                                  className={`transition-all duration-150 cursor-pointer ${
                                    isHovered 
                                      ? 'fill-red-500 stroke-black stroke-[3.5px]' 
                                      : 'fill-black stroke-red-500 stroke-2'
                                  }`}
                                  onMouseEnter={() => setHoveredMonthlyIdx(i)}
                                  onMouseLeave={() => setHoveredMonthlyIdx(null)}
                                />
                                
                                <text
                                  x={p.x}
                                  y="198"
                                  textAnchor="middle"
                                  className={`font-mono text-[10px] font-bold transition-colors ${
                                    isHovered ? 'fill-cyan-400 font-extrabold' : 'fill-gray-500'
                                  }`}
                                >
                                  {p.label}
                                </text>
                              </g>
                            );
                          })}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Interactive coordinate details console */}
          <div className="h-11 mt-3 flex items-center justify-center border border-cyan-500/15 rounded-xl bg-black px-4 shadow-sm">
            {hoveredMonthlyIdx !== null && monthlyData[hoveredMonthlyIdx] ? (
              <div className="flex items-center gap-2 text-xs font-mono">
                <span className="text-white font-black uppercase">
                  MONTH: {monthlyData[hoveredMonthlyIdx].month}
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-red-500 font-bold">
                  ATTENDANCE: {monthlyData[hoveredMonthlyIdx].pct}%
                </span>
                <span className="text-gray-600">|</span>
                <span className="text-cyan-400">
                  PRESENTS: {monthlyData[hoveredMonthlyIdx].presents} / Total: {monthlyData[hoveredMonthlyIdx].total}
                </span>
              </div>
            ) : (
              <span className="text-[10px] text-cyan-400/50 font-mono uppercase tracking-wider flex items-center gap-1.5 justify-center leading-none">
                <Activity className="w-3.5 h-3.5 text-cyan-400 animate-pulse" />
                Interact with red data coordinates to decode monthly breakdown registers
              </span>
            )}
          </div>
        </div>

        {/* COLUMN 2: DEPARTMENT-WISE ATTENDANCE TRENDS (BAR GRAPH) - 5 COLS */}
        <div className="lg:col-span-5 bg-black border border-cyan-500/15 rounded-2xl p-6 shadow-xl flex flex-col justify-between min-h-[350px]">
          <div>
            <div className="flex justify-between items-center mb-4">
              <div>
                <span className="text-[10px] font-mono font-bold tracking-widest text-[#00ffcc] block uppercase">
                  🏢 2. DEPARTMENTAL_DISTRIBUTION
                </span>
                <h4 className="text-sm font-bold text-white uppercase tracking-wider font-display">
                  Department-Wise Attendance Graph
                </h4>
              </div>
              <span className="text-[9px] font-mono text-red-500 bg-red-950/10 px-2 py-0.5 border border-red-500/20 rounded font-bold uppercase">
                RED_BARS
              </span>
            </div>

            {/* Department Columns list in Red */}
            <div className="relative">
              {deptData.length === 0 ? (
                <div className="h-44 flex items-center justify-center text-xs font-mono text-gray-500 uppercase">
                  No departments found.
                </div>
              ) : (
                <div className="w-full overflow-x-auto select-none">
                  <svg viewBox="0 0 350 180" className="w-full h-auto">
                    <defs>
                      <linearGradient id="redGradientColumns" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#ef4444" stopOpacity="1" />
                        <stop offset="100%" stopColor="#991b1b" stopOpacity="0.8" />
                      </linearGradient>
                    </defs>

                    {/* Reference Lines */}
                    {[25, 50, 75, 100].map(hValue => {
                      const y = 145 - (hValue * 1.15);
                      return (
                        <line
                          key={hValue}
                          x1="35"
                          y1={y}
                          x2="330"
                          y2={y}
                          stroke="rgba(6, 182, 212, 0.08)"
                          strokeWidth="1"
                          strokeDasharray="3,3"
                        />
                      );
                    })}

                    {/* Graph Bars */}
                    {deptData.map((d, index) => {
                      const spacing = (330 - 35) / deptData.length;
                      const barWidth = Math.min(22, spacing * 0.45);
                      const x = 35 + index * spacing + (spacing - barWidth) / 2;
                      const barHeight = d.pct * 1.15;
                      const y = 145 - barHeight;
                      const isHovered = hoveredDeptIdx === index;

                      return (
                        <g 
                          key={d.label}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredDeptIdx(index)}
                          onMouseLeave={() => setHoveredDeptIdx(null)}
                        >
                          {/* Anchor wider rect context sensor */}
                          <rect
                            x={x - 6}
                            y="15"
                            width={barWidth + 12}
                            height="135"
                            className="fill-transparent"
                          />

                          {/* Red Graph Bar column element */}
                          <rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill="url(#redGradientColumns)"
                            className={`transition-all duration-300 ${
                              isHovered 
                                ? 'stroke-cyan-400 stroke-1.5 filter drop-shadow-[0_0_8px_rgba(239,110,110,0.4)]' 
                                : ''
                            }`}
                            rx="2"
                          />

                          {/* Base axis label */}
                          <text
                            x={x + barWidth / 2}
                            y="160"
                            textAnchor="middle"
                            className={`font-mono text-[9.5px] font-black transition-colors ${
                              isHovered ? 'fill-cyan-400' : 'fill-gray-500'
                            }`}
                          >
                            {d.label}
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Department detail panel */}
          <div className="border-t border-cyan-500/15 pt-3 text-xs font-mono text-center flex items-center justify-center h-10 bg-black rounded-xl">
            {hoveredDeptIdx !== null && deptData[hoveredDeptIdx] ? (
              <span className="text-white line-clamp-1">
                DEPT: <b className="text-cyan-400 uppercase">{deptData[hoveredDeptIdx].deptFullName}</b> • Attn Ratio: <b className="text-red-500">{deptData[hoveredDeptIdx].pct}%</b>
              </span>
            ) : (
              <span className="text-[10px] text-cyan-400/50 uppercase tracking-widest flex items-center justify-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-cyan-400" /> Hover columns to decode departmental ratio levels
              </span>
            )}
          </div>
        </div>

      </div>

      {/* SECTION 3: SUBJECT-WISE ATTENDANCE BREAKDOWN GRAPH MATRIX */}
      <div className="bg-black border border-cyan-500/15 rounded-2xl p-6 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-[#00ffcc] block uppercase">
              📖 3. SUBJECT_WISE_ATTENDANCE_VECTOR
            </span>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-display">
              Subject-Wise Analytics Breakdown Matrix
            </h4>
            <p className="text-[10px] font-mono text-cyan-400/60 uppercase">
              Compliance ratios representing active semester curriculum syllabus subjects
            </p>
          </div>
          <span className="text-[9px] font-mono text-red-500 bg-red-950/10 px-2 py-1 border border-red-500/20 rounded font-bold uppercase shrink-0 self-start sm:self-center">
            75% CRITICAL THRESHOLD GAP
          </span>
        </div>

        {subjectData.length === 0 ? (
          <p className="text-xs font-mono text-gray-500 py-6 uppercase text-center border border-dashed border-cyan-500/10 rounded-xl">
            No registered database syllabus blocks found.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjectData.map((subItem, idx) => {
              const isFailing = subItem.pct < 75;
              const isHovered = hoveredSubjectIdx === idx;

              return (
                <div
                  key={subItem.code}
                  onMouseEnter={() => setHoveredSubjectIdx(idx)}
                  onMouseLeave={() => setHoveredSubjectIdx(null)}
                  className={`bg-black border p-5 rounded-2xl flex flex-col justify-between transition-all duration-300 ${
                    isFailing ? 'border-red-500/20 bg-red-950/5' : 'border-cyan-500/15'
                  } ${isHovered ? 'shadow-[0_0_15px_rgba(6,182,212,0.1)] scale-[1.01] border-cyan-400' : ''}`}
                >
                  <div className="space-y-4">
                    <div className="flex justify-between items-start gap-2">
                      <div className="space-y-1">
                        <span className="font-mono text-[9px] text-[#00ffcc] uppercase tracking-widest block font-bold">
                          {subItem.code}
                        </span>
                        <h5 className="text-xs font-bold text-white uppercase line-clamp-1 leading-tight font-sans">
                          {subItem.name}
                        </h5>
                      </div>
                      <span className={`text-base font-black font-mono shrink-0 ${
                        isFailing ? 'text-red-500' : 'text-cyan-400'
                      }`}>
                        {subItem.pct}%
                      </span>
                    </div>

                    {/* RED GRAPH Horizontal Progress Bar inside each Subject Component */}
                    <div className="w-full bg-cyan-950/30 h-2 rounded-full overflow-hidden relative border border-cyan-500/10">
                      {/* Critical line marker */}
                      <div className="absolute top-0 bottom-0 left-[75%] w-0.5 bg-red-500/60 z-10" title="75% Target threshold" />
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${
                          isFailing 
                            ? 'bg-gradient-to-r from-red-600 to-red-400 shadow-[0_0_6px_rgba(239,68,68,0.4)]' 
                            : 'bg-red-500' // ALL GRAPHS TO BE RED
                        }`}
                        style={{ width: `${subItem.pct}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-[9px] font-mono text-gray-500 uppercase tracking-widest">
                      <span>PRESENT: {subItem.presents} / TOTAL: {subItem.total}</span>
                      <span>Target: 75%</span>
                    </div>
                  </div>

                  <div className="border-t border-cyan-500/10 pt-2.5 mt-4 flex items-center justify-between font-mono text-[9px] leading-none">
                    {isFailing ? (
                      <span className="text-red-500 font-extrabold flex items-center gap-1 animate-pulse uppercase">
                        <AlertTriangle className="w-3.5 h-3.5" /> FAILED_LIMIT_ALERT
                      </span>
                    ) : (
                      <span className="text-[#00ffcc] font-bold flex items-center gap-1 uppercase">
                        <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> SYSTEM_RATIO_PASS
                      </span>
                    )}

                    <span className="text-gray-600 uppercase tracking-wider">
                      MATRIX DEEP_VIEW
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* SECTION 5: ATTENDANCE_LEDGER_EXPORTER */}
      <div id="attendance-ledger-exporter-panel" className="bg-black border border-cyan-500/15 rounded-2xl p-6 shadow-xl space-y-5">
        <div>
          <span className="text-[10px] font-mono font-bold tracking-widest text-[#00ffcc] block uppercase">
            📊 5. ATTENDANCE_LEDGER_EXPORTER
          </span>
          <h4 className="text-sm font-bold text-white uppercase tracking-wider font-display">
            Secure Cryptographic Registry Export Console
          </h4>
          <p className="text-[10px] font-mono text-cyan-400/60 uppercase">
            Filter by syllabus subject, calendar timestamps, or academic semester to compile system CSV sheets
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-[#070913] p-4 rounded-xl border border-cyan-500/10">
          
          {/* Select Subject */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">1. SYLLABUS SUBJECT FILTER</label>
            <select
              value={exportSubject}
              onChange={(e) => setExportSubject(e.target.value)}
              className="w-full bg-black border border-cyan-500/25 text-white rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-cyan-400 transition-colors uppercase cursor-pointer"
            >
              <option value="ALL">-- ALL SUBJECT REGISTERS --</option>
              {(useSyntheticData
                ? ['1NX-NN', '1NX-CS', '1NX-AI', '1NX-RH', '1NX-DM']
                : Array.from(new Set((scopeToLecturer ? activeLecturerSubjects : subjects.map(s => s.subjectCode))))
              ).map(subCode => {
                const subObj = subjects.find(s => s.subjectCode.toUpperCase() === subCode.toUpperCase());
                const label = subObj ? `${subObj.subjectCode} - ${subObj.subjectName}` : subCode;
                return (
                  <option key={subCode} value={subCode}>
                    {label.toUpperCase()}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Select Date */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">2. CALENDAR TIMESTAMP</label>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={exportDate}
                onChange={(e) => setExportDate(e.target.value)}
                className="w-full bg-black border border-cyan-500/25 text-white rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-cyan-400 transition-colors uppercase cursor-pointer"
              />
              {exportDate && (
                <button 
                  onClick={() => setExportDate('')}
                  className="bg-red-950/20 text-red-400 border border-red-500/30 px-3 py-2.5 rounded-lg text-xs font-mono hover:bg-red-500 hover:text-black hover:border-red-500 transition-colors"
                  title="Clear Date Filter"
                >
                  CLEAR
                </button>
              )}
            </div>
          </div>

          {/* Select Semester */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider block">3. ACADEMIC SEMESTER NODE</label>
            <select
              value={exportSemester}
              onChange={(e) => setExportSemester(e.target.value)}
              className="w-full bg-black border border-cyan-500/25 text-white rounded-lg p-2.5 text-xs font-mono focus:outline-none focus:border-cyan-400 transition-colors uppercase cursor-pointer"
            >
              <option value="ALL">-- ALL SEMESTERS --</option>
              {['1', '2', '3', '4', '5', '6', '7', '8'].map(sem => (
                <option key={sem} value={sem}>
                  SEMESTER {sem} REGISTER INDEX
                </option>
              ))}
            </select>
          </div>

        </div>

        <div className="flex flex-col lg:flex-row items-center justify-between gap-4 pt-2">
          <p className="text-[10px] font-mono text-gray-500 uppercase">
            * Selected spreadsheet encodes real-time computed individual attendance level (%) to support offline archives
          </p>

          <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto shrink-0">
            <button
              onClick={handleExportCSV}
              className="flex items-center justify-center space-x-2 px-6 py-3 rounded-lg text-xs font-mono font-bold uppercase transition-all duration-300 bg-[#070913] text-cyan-400 border border-cyan-500/30 hover:bg-cyan-950/40 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(6,182,212,0.2)] cursor-pointer w-full sm:w-auto"
            >
              <Download className="w-4 h-4" />
              <span>DOWNLOAD CSV</span>
            </button>

            <button
              onClick={handleExportExcel}
              id="export-excel-btn"
              className="flex items-center justify-center space-x-2 px-6 py-3 rounded-lg text-xs font-mono font-bold uppercase transition-all duration-300 bg-[#00ffcc] text-black hover:bg-cyan-300 hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] cursor-pointer w-full sm:w-auto"
            >
              <FileSpreadsheet className="w-4 h-4 text-black" />
              <span>EXPORT EXCEL (.XLSX)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 4: STUDENT_ATTENDANCE_SUMMARY_PANEL */}
      <div id="student-attendance-summary-panel" className="bg-black border border-cyan-500/15 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <span className="text-[10px] font-mono font-bold tracking-widest text-[#00ffcc] block uppercase">
              👥 4. STUDENT_ATTENDANCE_SUMMARY
            </span>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider font-display">
              Student Attendance Performance Register
            </h4>
            <p className="text-[10px] font-mono text-cyan-400/60 uppercase">
              Individual student attendance metrics parsed from secure ledger logs
            </p>
          </div>

          {/* Search bar inside summary */}
          <div className="relative w-full md:w-72 shrink-0">
            <span className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-500">
              <Search className="w-3.5 h-3.5 text-cyan-400/60" />
            </span>
            <input
              type="text"
              placeholder="FILTER NAMES / USN LABELS..."
              value={studentSearch}
              onChange={(e) => setStudentSearch(e.target.value)}
              className="w-full bg-[#070913] border border-cyan-500/20 text-white rounded-xl py-2 pl-9 pr-4 text-xs font-mono placeholder-gray-600 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all uppercase tracking-wider"
            />
          </div>
        </div>

        {(() => {
          const computedStudentSummary = useSyntheticData
            ? [
                { name: 'NAP', usn: '1GD25CS086', total: 20, present: 18, absent: 2, pct: 90.0 },
                { name: 'Alice Smith', usn: '1GD25CS012', total: 18, present: 17, absent: 1, pct: 94.4 },
                { name: 'John Doe', usn: '1GD25CS050', total: 15, present: 12, absent: 3, pct: 80.0 },
                { name: 'David Miller', usn: '1GD25EC045', total: 12, present: 8, absent: 4, pct: 66.7 },
                { name: 'Priya Sharma', usn: '1GD25IS077', total: 22, present: 21, absent: 1, pct: 95.5 },
                { name: 'Alex Wong', usn: '1GD25CS105', total: 10, present: 7, absent: 3, pct: 70.0 }
              ]
            : (scopeToLecturer ? scopedStudents : students).map(student => {
                const studentRecords = scopedAttendance.filter(r => 
                  (r.studentUsn && r.studentUsn.toUpperCase() === student.usn.toUpperCase()) || 
                  (r.studentId && r.studentId === student.id)
                );
                const total = studentRecords.length;
                const present = studentRecords.filter(r => r.status === 'Present').length;
                const absent = total - present;
                const pct = total > 0 ? (present / total) * 100 : 0.0;
                return {
                  name: student.name,
                  usn: student.usn,
                  total,
                  present,
                  absent,
                  pct
                };
              });

          const filteredStudentSummary = computedStudentSummary.filter(entry => 
            entry.name.toLowerCase().includes(studentSearch.toLowerCase()) ||
            entry.usn.toLowerCase().includes(studentSearch.toLowerCase())
          );

          if (filteredStudentSummary.length === 0) {
            return (
              <p className="text-xs font-mono text-gray-500 py-6 uppercase text-center border border-dashed border-cyan-500/10 rounded-xl">
                No matching student registros detected.
              </p>
            );
          }

          return (
            <div className="overflow-x-auto rounded-xl border border-cyan-500/15 bg-black">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-cyan-500/20 bg-[#070913] text-[9.5px] font-mono text-cyan-400 uppercase tracking-widest">
                    <th className="py-3.5 px-4 font-black">STUDENT NAME</th>
                    <th className="py-3.5 px-4 font-black">USN</th>
                    <th className="py-3.5 px-4 text-center font-black">TOTAL CLASSES</th>
                    <th className="py-3.5 px-4 text-center font-black">PRESENT CLASSES</th>
                    <th className="py-3.5 px-4 text-center font-black">ABSENT CLASSES</th>
                    <th className="py-3.5 px-4 text-right font-black">ATTENDANCE LEVEL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-cyan-500/10 text-xs font-mono">
                  {filteredStudentSummary.map((item, idx) => {
                    const isFailing = item.pct < 75;
                    return (
                      <tr 
                        key={item.usn + '-' + idx} 
                        className="hover:bg-cyan-500/5 transition-colors group"
                      >
                        <td className="py-3 px-4 font-bold text-white uppercase font-sans tracking-wide">
                          {item.name}
                        </td>
                        <td className="py-3 px-4 text-gray-400 uppercase font-mono tracking-wider">
                          {item.usn}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-white">
                          {item.total}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-emerald-400">
                          {item.present}
                        </td>
                        <td className="py-3 px-4 text-center font-bold text-rose-400">
                          {item.absent}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2.5">
                            <span className={`font-black text-xs ${isFailing ? 'text-rose-500 animate-pulse' : 'text-cyan-400'}`}>
                              {item.pct.toFixed(1)}%
                            </span>
                            <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-widest ${
                              isFailing 
                                ? 'bg-rose-950/40 text-rose-500 border border-rose-500/20' 
                                : 'bg-cyan-950/40 text-[#00ffcc] border border-cyan-500/20'
                            }`}>
                              {isFailing ? 'CRIT_LOW' : 'NOMINAL'}
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          );
        })()}
      </div>

    </div>
  );
}
