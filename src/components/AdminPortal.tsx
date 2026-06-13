import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Users, UserPlus, BookOpen, Clock, BarChart3, Settings, LogOut, Trash2, 
  Plus, Search, Edit2, ShieldAlert, CheckCircle2, XCircle, RefreshCw, Layers,
  Eye, Download, Activity, Fingerprint, Camera, Video
} from 'lucide-react';
import { apiClient } from '../api';
import { Student, Lecturer, Subject, TimetableSlot, AttendanceRecord, UserSession, DEPARTMENTS, SEMESTERS, SECTIONS, StudentFaceProfile } from '../types';
import CalendarView from './CalendarView';
import AnalyticsDashboard from './AnalyticsDashboard';
import BiometricRegistration from './BiometricRegistration';

interface AdminPortalProps {
  session: UserSession;
  onLogout: () => void;
}

type TabType = 'dashboard' | 'analytics' | 'students' | 'lecturers' | 'subjects' | 'timetable' | 'reports' | 'settings' | 'biometrics';

export default function AdminPortal({ session, onLogout }: AdminPortalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('dashboard');
  const [students, setStudents] = useState<Student[]>([]);
  const [lecturers, setLecturers] = useState<Lecturer[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [timetable, setTimetable] = useState<TimetableSlot[]>([]);
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [faceProfiles, setFaceProfiles] = useState<StudentFaceProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Sidebar mobile drawer state
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Search/Filter Search values
  const [searchQuery, setSearchQuery] = useState('');
  const [deptFilter, setDeptFilter] = useState('All');
  const [semFilter, setSemFilter] = useState('All');
  const [selectedProfileStudent, setSelectedProfileStudent] = useState<Student | null>(null);

  // Lecturer Search/Filter states
  const [lecSearchQuery, setLecSearchQuery] = useState('');
  const [lecDeptFilter, setLecDeptFilter] = useState('All');

  // ==================== FORM STATES ====================
  // New Student Unit fields
  const [newStudUsn, setNewStudUsn] = useState('');
  const [newStudName, setNewStudName] = useState('');
  const [newStudEmail, setNewStudEmail] = useState('');
  const [newStudDept, setNewStudDept] = useState(DEPARTMENTS[0]);
  const [newStudSem, setNewStudSem] = useState(SEMESTERS[0]);
  const [newStudSection, setNewStudSection] = useState(SECTIONS[0]);
  const [newStudPassword, setNewStudPassword] = useState('password');
  const [newStudPhoto, setNewStudPhoto] = useState('');

  // New Lecturer fields
  const [newLecId, setNewLecId] = useState('');
  const [newLecName, setNewLecName] = useState('');
  const [newLecEmail, setNewLecEmail] = useState('');
  const [newLecDept, setNewLecDept] = useState(DEPARTMENTS[0]);
  const [newLecPassword, setNewLecPassword] = useState('password');
  const [newLecSubjects, setNewLecSubjects] = useState('');

  // New Subject fields
  const [newSubCode, setNewSubCode] = useState('');
  const [newSubName, setNewSubName] = useState('');
  const [newSubSem, setNewSubSem] = useState(SEMESTERS[0]);
  const [newSubDept, setNewSubDept] = useState(DEPARTMENTS[0]);

  // New Timetable Slot fields
  const [newTimeDay, setNewTimeDay] = useState('Monday');
  const [newTimeStart, setNewTimeStart] = useState('09:00');
  const [newTimeEnd, setNewTimeEnd] = useState('10:30');
  const [newTimeSubject, setNewTimeSubject] = useState('');
  const [newTimeLecturer, setNewTimeLecturer] = useState('');
  const [newTimeRoom, setNewTimeRoom] = useState('');

  // New Attendance Log fields
  const [newAttUsn, setNewAttUsn] = useState('');
  const [newAttSubject, setNewAttSubject] = useState('');
  const [newAttDate, setNewAttDate] = useState(new Date().toISOString().split('T')[0]);
  const [newAttStatus, setNewAttStatus] = useState<'Present' | 'Absent'>('Present');

  // ==================== EDITING STATES ====================
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [editingLecturer, setEditingLecturer] = useState<Lecturer | null>(null);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [editingTimetable, setEditingTimetable] = useState<TimetableSlot | null>(null);
  const [editingAttendance, setEditingAttendance] = useState<AttendanceRecord | null>(null);

  const [purgeResult, setPurgeResult] = useState<{
    purged: boolean;
    profilesDeleted: number;
    verificationCount: number;
  } | null>(null);

  const handlePurgeBiometrics = async () => {
    if (!window.confirm('WARNING: Deleting all StudentFaceProfiles, faceImages, faceDescriptors, and biometric registration records is a highly sensitive action. Are you absolutely sure you want to execute "PURGE ALL BIOMETRIC DATA"? This will not affect student lists, lecturers, attendance, or timetables.')) {
      return;
    }
    setLoading(true);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await apiClient.purgeBiometricData();
      setPurgeResult({
        purged: true,
        profilesDeleted: res.profilesDeleted,
        verificationCount: res.verificationCount
      });
      setSuccessMsg(res.message);
      await loadSystemData();
    } catch (err: any) {
      setErrorMsg(err.message || 'System override command failed.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger system fetch
  const loadSystemData = async () => {
    setLoading(true);
    try {
      const [studs, lecs, subs, times, atts, faces] = await Promise.all([
        apiClient.getStudents(),
        apiClient.getLecturers(),
        apiClient.getSubjects(),
        apiClient.getTimetable(),
        apiClient.getAttendance(),
        apiClient.getFaceProfiles()
      ]);
      setStudents(studs);
      setLecturers(lecs);
      setSubjects(subs);
      setTimetable(times);
      setAttendance(atts);
      setFaceProfiles(faces);

      // Pre-populate selectors if items available
      if (subs.length > 0) {
        setNewTimeSubject(subs[0].subjectCode);
        setNewAttSubject(subs[0].subjectCode);
      }
      if (lecs.length > 0) {
        setNewTimeLecturer(lecs[0].lecturerId);
      }
    } catch (err: any) {
      setErrorMsg('Dynamic link calibration failed: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSystemData();
  }, []);

  // ==================== STUDENTS CRUD ACTIONS ====================
  const handleAddStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.addStudent({
        usn: newStudUsn,
        name: newStudName,
        email: newStudEmail,
        department: newStudDept,
        semester: newStudSem,
        section: newStudSection,
        password: newStudPassword,
        profilePhoto: newStudPhoto
      });
      setSuccessMsg(`Student USN ${newStudUsn} registered successfully!`);
      // Reset forms
      setNewStudUsn('');
      setNewStudName('');
      setNewStudEmail('');
      setNewStudSection('A');
      setNewStudPassword('password');
      setNewStudPhoto('');
      loadSystemData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Injection failure.');
    }
  };

  const handleUpdateStudent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStudent) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.updateStudent(editingStudent.id, editingStudent);
      setSuccessMsg(`Student ${editingStudent.usn} profile updated.`);
      setEditingStudent(null);
      loadSystemData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Update failure.');
    }
  };

  const handleDeleteStudent = async (id: string, name: string) => {
    if (!window.confirm(`Purge profile node for ${name}?`)) return;
    try {
      await apiClient.deleteStudent(id);
      setSuccessMsg(`Profile node ${name} purged.`);
      loadSystemData();
    } catch (err: any) {
      setErrorMsg('Purge failed.');
    }
  };

  const exportStudentsToCSV = () => {
    const headers = ['USN', 'Name', 'Email', 'Department', 'Semester', 'Section', 'Attendance Percentage'];
    const rows = filteredStudents.map(stud => [
      stud.usn,
      stud.name,
      stud.email,
      stud.department,
      stud.semester,
      stud.section || 'A',
      `${stud.attendancePercentage}%`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.map(val => `"${val.replace(/"/g, '""')}"`).join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `nexo_students_export_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setSuccessMsg('Registry datasets exported successfully to CSV.');
  };

  // ==================== LECTURERS CRUD ACTIONS ====================
  const handleAddLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.addLecturer({
        lecturerId: newLecId || `L_${Date.now().toString().slice(-6)}`,
        name: newLecName,
        email: newLecEmail,
        department: newLecDept,
        password: newLecPassword,
        subjects: newLecSubjects.split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      });
      setSuccessMsg('Lecturer credential profile injected successfully.');
      setNewLecId('');
      setNewLecName('');
      setNewLecEmail('');
      setNewLecPassword('password');
      setNewLecSubjects('');
      loadSystemData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lec register failure.');
    }
  };

  const handleUpdateLecturer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLecturer) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const updatedData = {
        ...editingLecturer,
        // Convert subjects field back to array if edited as string in form
        subjects: Array.isArray(editingLecturer.subjects)
          ? editingLecturer.subjects
          : (editingLecturer.subjects as string).split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
      };
      await apiClient.updateLecturer(editingLecturer.id, updatedData);
      setSuccessMsg(`Lecturer ${editingLecturer.name} updated.`);
      setEditingLecturer(null);
      loadSystemData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Update failure.');
    }
  };

  const handleDeleteLecturer = async (id: string, name: string) => {
    if (!window.confirm(`Take Lecturer node ${name} offline?`)) return;
    try {
      await apiClient.deleteLecturer(id);
      setSuccessMsg(`Lecturer node ${name} removed.`);
      loadSystemData();
    } catch (err: any) {
      setErrorMsg('Removal failed.');
    }
  };

  // ==================== SUBJECTS CRUD ACTIONS ====================
  const handleAddSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.addSubject({
        subjectCode: newSubCode.toUpperCase(),
        subjectName: newSubName,
        semester: newSubSem,
        department: newSubDept
      });
      setSuccessMsg(`Subject ${newSubCode} integrated into registry.`);
      setNewSubCode('');
      setNewSubName('');
      loadSystemData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Subject instantiation failed.');
    }
  };

  const handleUpdateSubject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSubject) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.updateSubject(editingSubject.subjectCode, editingSubject);
      setSuccessMsg(`Subject ${editingSubject.subjectCode} configuration updated.`);
      setEditingSubject(null);
      loadSystemData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Subject update failure.');
    }
  };

  const handleDeleteSubject = async (code: string) => {
    if (!window.confirm(`Surgically delete Subject ${code}? This can orphan timetables.`)) return;
    try {
      await apiClient.deleteSubject(code);
      setSuccessMsg(`Subject code ${code} deleted.`);
      loadSystemData();
    } catch (err: any) {
      setErrorMsg('Subject deleting failed.');
    }
  };

  // ==================== TIMETABLE CRUD ACTIONS ====================
  const handleAddTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!newTimeSubject || !newTimeLecturer) {
      setErrorMsg('Please ensure subjects and lecturers exist before timetabling.');
      return;
    }
    try {
      const timeStr = `${newTimeStart} - ${newTimeEnd}`;
      await apiClient.addTimetable({
        day: newTimeDay,
        time: timeStr,
        subject: newTimeSubject,
        lecturer: newTimeLecturer,
        room: newTimeRoom || 'Suite 404'
      });
      setSuccessMsg('Timetable slot scheduled successfully.');
      setNewTimeRoom('');
      loadSystemData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Timetable generation failed.');
    }
  };

  const handleUpdateTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTimetable) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.updateTimetable(editingTimetable.id, editingTimetable);
      setSuccessMsg('Timetable entry updated.');
      setEditingTimetable(null);
      loadSystemData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Timetable update failure.');
    }
  };

  const handleDeleteTimetable = async (id: string) => {
    if (!window.confirm('Delete scheduling target block?')) return;
    try {
      await apiClient.deleteTimetable(id);
      setSuccessMsg('Scheduling grid block purged.');
      loadSystemData();
    } catch (err: any) {
      setErrorMsg('Timetable delete failed.');
    }
  };

  // ==================== ATTENDANCE MANUAL CRUD ACTIONS ====================
  const handleAddAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!newAttUsn) {
      setErrorMsg('Please supply a target Student USN.');
      return;
    }
    const studentExists = students.find(s => s.usn.toUpperCase() === newAttUsn.toUpperCase());
    if (!studentExists) {
      setErrorMsg(`USN ${newAttUsn} matches no active Student Node in database.`);
      return;
    }

    if (newAttStatus === 'Present') {
      const existing = attendance.find(l => 
        (l.studentUsn.toUpperCase() === newAttUsn.toUpperCase() || (studentExists && l.studentId === studentExists.id)) &&
        l.subjectCode.toUpperCase() === newAttSubject.toUpperCase() &&
        l.date === newAttDate &&
        l.status === 'Present'
      );
      if (existing) {
        const prevTimestamp = existing.timestamp ? new Date(existing.timestamp).toLocaleString() : 'N/A';
        setErrorMsg(`Attendance Already Recorded (Marked Present at: ${prevTimestamp})`);
        return;
      }
    }

    try {
      await apiClient.addAttendance({
        studentUsn: newAttUsn.toUpperCase(),
        subjectCode: newAttSubject,
        date: newAttDate,
        status: newAttStatus
      });
      setSuccessMsg(`Attendance logged for ${newAttUsn} successfully.`);
      setNewAttUsn('');
      loadSystemData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Transaction logging failure.');
    }
  };

  const handleUpdateAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAttendance) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await apiClient.updateAttendance(editingAttendance.id, editingAttendance);
      setSuccessMsg('Record status altered.');
      setEditingAttendance(null);
      loadSystemData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Record update failed.');
    }
  };

  const handleDeleteAttendance = async (id: string) => {
    if (!window.confirm('Surgically delete this attendance log transaction?')) return;
    try {
      await apiClient.deleteAttendance(id);
      setSuccessMsg('Record cleared from ledger logs.');
      loadSystemData();
    } catch (err: any) {
      setErrorMsg('Failed to clear log.');
    }
  };

  const downloadAdminReport = () => {
    try {
      if (attendance.length === 0) {
        alert("No attendance transactions available to export.");
        return;
      }
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "ID,TIMESTAMP,STUDENT_NAME,USN,DEPARTMENT,SEMESTER,SUBJECT_CODE,SUBJECT_NAME,LECTURER,TIME,ROOM,METHOD,STATUS\n";
      
      attendance.forEach(rec => {
        const slot = timetable.find(t => t.id === rec.timetableSlotId);
        const subCode = rec.subjectCode || (slot ? slot.subject : 'N/A');
        const dStr = rec.timestamp ? new Date(rec.timestamp).toISOString().replace(/,/g, '') : 'N/A';
        
        csvContent += `"${rec.id}","${dStr}","${(rec.studentName || '').replace(/"/g, '""')}","${(rec.studentUsn || '').replace(/"/g, '""')}","${(rec.department || '').replace(/"/g, '""')}","${rec.semester || ''}","${subCode}","${(rec.subjectName || '').replace(/"/g, '""')}","${(rec.lecturerName || '').replace(/"/g, '""')}","${rec.time || ''}","${rec.room || ''}","${rec.verificationMethod || 'Manual'}","${rec.status}"\n`;
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "NEXO_Admin_Attendance_Ledger_Export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setSuccessMsg("System report file successfully generated and transmitted.");
    } catch (e: any) {
      setErrorMsg("Failed to compile CSV report: " + e.message);
    }
  };

  // ==================== DASHBOARD COMPUTATIONS ====================
  const totalStudents = students.length;
  const totalLecturers = lecturers.length;
  const totalSubjects = subjects.length;
  const totalSlots = timetable.length;
  const criticalStudents = students.filter(s => s.attendancePercentage < 75);
  const avgAttendance = students.length > 0
    ? Math.round(students.reduce((acc, curr) => acc + curr.attendancePercentage, 0) / students.length)
    : 100;

  // Search Filter
  const filteredStudents = students.filter(stud => {
    const matchesSearch = stud.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          stud.usn.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDept = deptFilter === 'All' || stud.department === deptFilter;
    const matchesSem = semFilter === 'All' || stud.semester === semFilter;
    return matchesSearch && matchesDept && matchesSem;
  });

  const filteredLecturers = lecturers.filter(lec => {
    const matchesSearch = lec.name.toLowerCase().includes(lecSearchQuery.toLowerCase()) || 
                          lec.email.toLowerCase().includes(lecSearchQuery.toLowerCase()) ||
                          lec.lecturerId.toLowerCase().includes(lecSearchQuery.toLowerCase());
    const matchesDept = lecDeptFilter === 'All' || lec.department === lecDeptFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div className="min-h-screen bg-[#05060d] text-gray-100 flex flex-col font-sans relative antialiased selection:bg-cyan-500 selection:text-black overflow-x-hidden">
      
      {/* Background neon glows */}
      <div className="absolute top-[-10%] left-[-15%] w-[50%] h-[50%] bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-15%] w-[50%] h-[50%] bg-[#00ffc8]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Futuristic Banner Header */}
      <header className="h-16 border-b border-cyan-500/15 bg-[#0a0d1f]/45 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="md:hidden text-cyan-400 hover:text-white focus:outline-none cursor-pointer"
          >
            <Layers className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[10px] uppercase font-mono tracking-widest text-[#00e1ff] block font-extrabold">system_core_dashboard</span>
            <h1 className="text-sm font-semibold tracking-wider font-display text-white">NEXO CENTRAL ADMINISTRATION HUB</h1>
          </div>
        </div>

        <div className="flex items-center space-x-5">
          <div className="hidden lg:flex flex-col items-end text-right">
            <span className="text-white text-xs font-semibold">{session.user.name}</span>
            <span className="text-[9px] text-cyan-400 font-mono tracking-widest uppercase mt-0.5">MATRIX_LEVEL: 0 // DECRYPTOR</span>
          </div>
          <button 
            onClick={onLogout}
            className="flex items-center space-x-1.5 px-3 py-1.5 border border-red-500/25 bg-red-950/15 hover:bg-red-500 hover:text-black rounded text-xs font-mono font-bold text-red-400 transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">TERMINATE_SESSION</span>
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-1 flex relative">
        
        {/* Cyberpunk Navigation Panel Sidebar */}
        <nav className={`fixed md:sticky top-16 left-0 h-[calc(100vh-64px)] w-64 bg-[#0a0d1f]/80 backdrop-blur-lg border-r border-cyan-500/15 flex flex-col justify-between p-5 z-30 transition-transform duration-300 transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}>
          <div>
            <div className="mb-4 mt-2">
              <span className="text-[10px] text-cyan-500/65 tracking-widest font-mono uppercase">System Nodes</span>
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
                  <span>SYS_DASHBOARD</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setActiveTab('analytics'); setSidebarOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                    activeTab === 'analytics'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
                      : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                  }`}
                >
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>SYS_ANALYTICS</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setActiveTab('students'); setSidebarOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                    activeTab === 'students'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
                      : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                  }`}
                >
                  <Users className="w-4 h-4 text-cyan-400" />
                  <span>STUDENT_MATRIX</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setActiveTab('lecturers'); setSidebarOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                    activeTab === 'lecturers'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
                      : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                  }`}
                >
                  <UserPlus className="w-4 h-4 text-cyan-400" />
                  <span>LECTURER_NODES</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setActiveTab('subjects'); setSidebarOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                    activeTab === 'subjects'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
                      : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                  }`}
                >
                  <BookOpen className="w-4 h-4 text-cyan-400" />
                  <span>SUBJECTS_CATALOG</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setActiveTab('timetable'); setSidebarOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                    activeTab === 'timetable'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
                      : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                  }`}
                >
                  <Clock className="w-4 h-4 text-cyan-400" />
                  <span>TIMETABLE_GRID</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setActiveTab('reports'); setSidebarOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                    activeTab === 'reports'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
                      : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4 text-cyan-400" />
                  <span>ATTENDANCE_LEDGER</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setActiveTab('biometrics'); setSidebarOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                    activeTab === 'biometrics'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
                      : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                  }`}
                >
                  <Fingerprint className="w-4 h-4 text-cyan-400" />
                  <span>BIOMETRIC_REGISTRATION</span>
                </button>
              </li>
              <li>
                <button
                  onClick={() => { setActiveTab('settings'); setSidebarOpen(false); }}
                  className={`w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg text-xs font-mono tracking-wider transition-colors cursor-pointer ${
                    activeTab === 'settings'
                      ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 shadow-[0_0_10px_rgba(6,182,212,0.05)]'
                      : 'text-gray-400 hover:bg-[#111422] hover:text-white'
                  }`}
                >
                  <Settings className="w-4 h-4 text-cyan-400" />
                  <span>SYS_SETTINGS</span>
                </button>
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t border-cyan-500/10">
            <div className="flex gap-2 items-center bg-cyan-950/20 p-2 border border-cyan-500/10 rounded-lg">
              <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full shadow-[0_0_8px_#10b981] animate-pulse" />
              <span className="text-[10px] font-mono tracking-widest text-[#00ffc8] font-semibold">COGNITION_SECURE</span>
            </div>
          </div>
        </nav>

        {/* Content Stream View */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto max-w-7xl mx-auto w-full relative">
          
          {/* Global Event Alerts Display */}
          {errorMsg && (
            <div className="bg-red-950/25 border border-red-500/35 p-3.5 rounded-xl text-red-200 text-xs font-mono flex items-center gap-3 relative z-10">
              <ShieldAlert className="w-4 h-4 text-red-400 animate-bounce shrink-0" />
              <span><b>[DECRYPTION FAULT]:</b> {errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div className="bg-emerald-950/15 border border-emerald-500/35 p-3.5 rounded-xl text-emerald-200 text-xs font-mono flex items-center gap-3 relative z-10">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              <span><b>[SYNCHRONIZED]:</b> {successMsg}</span>
            </div>
          )}

          {/* VIEW: OVERALL SYS STATUS */}
          {activeTab === 'dashboard' && (
            <div className="space-y-6">
              {/* Professional Empty State Message */}
              {students.length === 0 && lecturers.length === 0 && subjects.length === 0 && (
                <div className="bg-[#121c2a] border border-amber-500/30 p-6 rounded-xl relative overflow-hidden animate-pulse">
                  <div className="flex items-center space-x-3 text-amber-400">
                    <ShieldAlert className="w-5 h-5 flex-shrink-0 animate-bounce" />
                    <span className="text-sm font-sans tracking-wide">
                      No records found. Please add students, lecturers, and timetable data from the Admin Portal.
                    </span>
                  </div>
                </div>
              )}

              {/* Top stats bento grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-5 relative z-10">
                <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-5 rounded-xl flex items-center justify-between shadow-md relative overflow-hidden group">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 block">STUDENTS_REGISTERED</span>
                    <h3 className="text-3xl font-extrabold text-white mt-1.5 font-display tracking-tight">{totalStudents}</h3>
                    <span className="text-[10px] text-gray-500 block mt-1 font-mono">Dynamic matrix nodes</span>
                  </div>
                </div>

                <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-5 rounded-xl flex items-center justify-between shadow-md relative overflow-hidden group">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 block">ACTIVE_LECTURERS</span>
                    <h3 className="text-3xl font-extrabold text-white mt-1.5 font-display tracking-tight">{totalLecturers}</h3>
                    <span className="text-[10px] text-gray-500 block mt-1 font-mono">Authorized tutors</span>
                  </div>
                </div>

                <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-5 rounded-xl flex items-center justify-between shadow-md relative overflow-hidden group">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 block">SUBJECTS_IN_GRID</span>
                    <h3 className="text-3xl font-extrabold text-white mt-1.5 font-display tracking-tight">{totalSubjects}</h3>
                    <span className="text-[10px] text-gray-500 block mt-1 font-mono">Mapped courses</span>
                  </div>
                </div>

                <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-5 rounded-xl flex items-center justify-between shadow-md relative overflow-hidden group">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-[#00ffc8] block">AVG_ATTENDANCE</span>
                    <h3 className="text-3xl font-extrabold mt-1.5 font-display tracking-tight text-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.1)]">{avgAttendance}%</h3>
                    <span className="text-[10px] text-emerald-400/70 block mt-1 font-mono">Nominal efficiency</span>
                  </div>
                </div>

                <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-5 rounded-xl flex items-center justify-between shadow-md relative overflow-hidden group">
                  <div>
                    <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-400 block">ALERT_NODES</span>
                    <h3 className={`text-3xl font-extrabold mt-1.5 font-display tracking-tight ${criticalStudents.length > 0 ? 'text-red-400' : 'text-cyan-400'}`}>
                      {criticalStudents.length}
                    </h3>
                    <span className="text-[10px] text-red-400/70 block mt-1 font-mono">Deficient ratios</span>
                  </div>
                </div>
              </div>

              {/* Graphic charts & lower alarms */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10">
                
                {/* Visual SVG attendance status indicator bars */}
                <div className="lg:col-span-7 bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 rounded-xl p-5 shadow-lg">
                  <h4 className="text-sm font-bold text-white font-display mb-1 uppercase tracking-wider">Academic Attendance Ratios</h4>
                  <p className="text-[11px] text-cyan-300/50 font-mono mb-6 uppercase">Calculated real-time over registered student matrices</p>
                  
                  {students.length === 0 ? (
                    <div className="p-8 text-center text-xs font-mono text-gray-500 uppercase">NO ACTIVE STUDENTS FOR STATISTICS ANALYSIS</div>
                  ) : (
                    <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2">
                      {students.map(stud => (
                        <div key={stud.id} className="space-y-1.5">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-white font-semibold font-sans">{stud.name} <code className="text-[10px] text-gray-500 ml-1.5">({stud.usn})</code></span>
                            <span className={`font-mono font-bold ${stud.attendancePercentage < 75 ? 'text-red-400 neon-text' : 'text-cyan-400'}`}>
                              {stud.attendancePercentage}%
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="h-3 w-full bg-slate-950/60 rounded-full border border-cyan-500/10 overflow-hidden relative">
                            <div 
                              className={`h-full rounded-full transition-all duration-1000 ${
                                stud.attendancePercentage < 75 ? 'bg-gradient-to-r from-red-600 to-amber-500' : 'bg-gradient-to-r from-cyan-600 to-cyan-400'
                              }`}
                              style={{ width: `${stud.attendancePercentage}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cyber Warning Critical Alerts List */}
                <div className="lg:col-span-5 bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 rounded-xl p-5 shadow-lg">
                  <h4 className="text-sm font-bold text-white font-display mb-1 uppercase tracking-wider text-red-400">Critical Alarms (Attn &lt; 75%)</h4>
                  <p className="text-[11px] text-gray-500 font-mono mb-4 uppercase">Node signals violating attendance minimum thresholds</p>

                  <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                    {criticalStudents.length === 0 ? (
                      <div className="text-center p-12 hover:bg-cyan-950/5 transition-all text-xs font-mono text-emerald-400 uppercase rounded-lg border border-emerald-500/10">
                        🛡️ ALL INTEL NODES DECLARED STABLE. EFFICIENCY INTEGRAL NOMINAL.
                      </div>
                    ) : (
                      criticalStudents.map(stud => (
                        <div key={stud.id} className="bg-red-950/25 border-l-2 border-red-500 p-3.5 rounded flex items-center justify-between">
                          <div>
                            <span className="text-white font-bold block text-xs">{stud.name}</span>
                            <span className="text-[9.5px] font-mono text-cyan-300 block mt-0.5">{stud.usn} • {stud.department}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-sm font-extrabold text-red-400 block font-mono">{stud.attendancePercentage}%</span>
                            <span className="text-[8px] font-mono block text-red-500 uppercase mt-0.5">CRIT_DEVIATION</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* VIEW: SYSTEM TELEMETRY ANALYTICS */}
          {activeTab === 'analytics' && (
            <AnalyticsDashboard
              students={students}
              lecturers={lecturers}
              subjects={subjects}
              attendance={attendance}
              timetable={timetable}
              userRole="admin"
            />
          )}

          {/* VIEW: STUDENTS MANAGEMENT */}
          {activeTab === 'students' && (
            <div className="space-y-6">
              
              {/* Insert / Edit Student Form */}
              <div className="bg-[#0b0d16] border border-cyan-500/15 rounded-xl p-5 relative z-10">
                <h3 className="text-sm font-bold text-white font-display mb-4 uppercase tracking-wider flex items-center">
                  <UserPlus className="w-4 h-4 text-cyan-400 mr-2 animate-pulse" />
                  <span>{editingStudent ? 'Modify Cybernetic Student profile' : 'Register Cybernetic Student Node'}</span>
                </h3>

                {editingStudent ? (
                  <form onSubmit={handleUpdateStudent} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">USN IDENTIFIER (READ-ONLY)</label>
                        <input
                          type="text"
                          disabled
                          className="w-full text-xs font-mono bg-cyan-950/20 text-cyan-400 px-3 py-2 border border-cyan-500/30 rounded outline-none"
                          value={editingStudent.usn}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">FULL STUDENT NAME</label>
                        <input
                          type="text"
                          required
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded focus:border-cyan-400 outline-none"
                          value={editingStudent.name}
                          onChange={(e) => setEditingStudent({ ...editingStudent, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">CYBERMAIL RESOURCE</label>
                        <input
                          type="email"
                          required
                          className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-400/50 rounded focus:border-cyan-400 outline-none"
                          value={editingStudent.email}
                          onChange={(e) => setEditingStudent({ ...editingStudent, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">DEPARTMENT MATRIX</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded focus:border-cyan-400 outline-none"
                          value={editingStudent.department}
                          onChange={(e) => setEditingStudent({ ...editingStudent, department: e.target.value })}
                        >
                          {DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">SEMESTER</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded focus:border-cyan-400 outline-none"
                          value={editingStudent.semester}
                          onChange={(e) => setEditingStudent({ ...editingStudent, semester: e.target.value })}
                        >
                          {SEMESTERS.map(s => (
                            <option key={s} value={s}>Semester {s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">SECTION INDEX</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingStudent.section || SECTIONS[0]}
                          onChange={(e) => setEditingStudent({ ...editingStudent, section: e.target.value })}
                        >
                          {SECTIONS.map(sec => (
                            <option key={sec} value={sec}>{sec}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">PASSWORD KEY</label>
                        <input
                          type="text"
                          required
                          className="w-full text-xs font-mono bg-black text-white px-3 py-3 border border-cyan-400/50 rounded outline-none"
                          value={editingStudent.password || 'password'}
                          onChange={(e) => setEditingStudent({ ...editingStudent, password: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1">AVATAR URL / PHOTO</label>
                        <input
                          type="text"
                          placeholder="https://..."
                          className="w-full text-xs font-mono bg-black text-white px-3 py-3 border border-cyan-400/50 rounded outline-none"
                          value={editingStudent.profilePhoto || ''}
                          onChange={(e) => setEditingStudent({ ...editingStudent, profilePhoto: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setEditingStudent(null)}
                        className="text-white text-xs border border-gray-600 px-4 py-2 hover:bg-gray-800 rounded font-mono cursor-pointer"
                      >
                        CLOSE_EDITOR
                      </button>
                      <button
                        type="submit"
                        className="bg-cyan-500 text-black text-xs font-bold font-display px-6 py-2 tracking-widest hover:bg-cyan-400 rounded cursor-pointer"
                      >
                        COMMIT_UPDATES
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleAddStudent} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">USN IDENTIFIER</label>
                        <input
                          type="text"
                          required
                          placeholder="1NX22CS001"
                          className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newStudUsn}
                          onChange={(e) => setNewStudUsn(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">FULL STUDENT NAME</label>
                        <input
                          type="text"
                          required
                          placeholder="Aero Chen"
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newStudName}
                          onChange={(e) => setNewStudName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">CYBERMAIL RESOURCE</label>
                        <input
                          type="email"
                          required
                          placeholder="aero@nexo.edu"
                          className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newStudEmail}
                          onChange={(e) => setNewStudEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">DEPARTMENT MATRIX</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newStudDept}
                          onChange={(e) => setNewStudDept(e.target.value)}
                        >
                          {DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">SEMESTER</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newStudSem}
                          onChange={(e) => setNewStudSem(e.target.value)}
                        >
                          {SEMESTERS.map(s => (
                            <option key={s} value={s}>Semester {s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">SECTION SEC</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded outline-none"
                          value={newStudSection}
                          onChange={(e) => setNewStudSection(e.target.value)}
                        >
                          {SECTIONS.map(sec => (
                            <option key={sec} value={sec}>{sec}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">PORTAL PASSWORD</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-500/20 rounded outline-none"
                          value={newStudPassword}
                          onChange={(e) => setNewStudPassword(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 tracking-widest mb-1.5 font-bold">PROFILE PHOTO LINK</label>
                        <input
                          type="text"
                          placeholder="https://..."
                          className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-500/20 rounded outline-none"
                          value={newStudPhoto}
                          onChange={(e) => setNewStudPhoto(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        className="bg-cyan-700/60 hover:bg-cyan-500 hover:text-black border border-cyan-400 rounded px-6 py-2 text-xs font-display font-black tracking-widest transition-all cursor-pointer"
                      >
                        INJECT_NODE
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Filtering Controls */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0b0d16] p-4 rounded-xl border border-cyan-500/10 gap-3 relative z-10">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search USN or Name..."
                    className="w-full bg-black border border-cyan-500/15 py-1.5 pl-9 pr-4 rounded text-xs text-white focus:border-cyan-400 outline-none"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-xs w-full sm:w-auto justify-end animate-fade-in shadow-inner">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-gray-500 uppercase text-[10px]">DEPT:</span>
                    <select
                      className="bg-black border border-cyan-500/15 py-1.5 px-2.5 rounded text-xs text-white focus:outline-none cursor-pointer focus:border-cyan-400"
                      value={deptFilter}
                      onChange={(e) => setDeptFilter(e.target.value)}
                    >
                      <option value="All">All Departments</option>
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-gray-500 uppercase text-[10px]">SEM:</span>
                    <select
                      className="bg-black border border-cyan-500/15 py-1.5 px-2.5 rounded text-xs text-white focus:outline-none cursor-pointer focus:border-cyan-400"
                      value={semFilter}
                      onChange={(e) => setSemFilter(e.target.value)}
                    >
                      <option value="All">All Semesters</option>
                      {SEMESTERS.map(s => (
                        <option key={s} value={s}>Semester {s}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    onClick={exportStudentsToCSV}
                    className="flex items-center space-x-1.5 px-3 py-1.5 border border-cyan-500/25 bg-cyan-950/15 hover:bg-cyan-500 hover:text-black rounded text-[11px] font-mono font-bold text-cyan-400 transition-all cursor-pointer"
                    title="Export Student Registry to CSV file"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>EXPORT_CSV</span>
                  </button>
                </div>
              </div>

              {/* Interactive Student Directory */}
              <div className="bg-[#0b0d16] border border-cyan-500/10 rounded-xl overflow-hidden shadow-lg relative z-10">
                <div className="p-4 bg-[#0d101a] border-b border-cyan-500/10 flex justify-between">
                  <span className="text-xs font-bold text-white font-display uppercase tracking-wider">REGISTRY IDENTIFIERS ({filteredStudents.length})</span>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-semibold">COGNITION LEVEL</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-cyan-500/5 bg-[#05060d]">
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">STUDENT PROFILE</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">USN CODE</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">DEPARTMENT MATRIX</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider text-center">SEM / SECTION</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">EFFICIENCY ratio</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 text-center uppercase tracking-wider">OPERATIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/5">
                      {filteredStudents.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-xs font-mono text-gray-500 uppercase">NO ACTIVE UNIT NODES ENCRYPTED IN PATHS</td>
                        </tr>
                      ) : (
                        filteredStudents.map(stud => (
                          <tr key={stud.id} className="hover:bg-cyan-950/5 transition-all text-xs">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                {stud.profilePhoto ? (
                                  <img 
                                    src={stud.profilePhoto} 
                                    alt={stud.name} 
                                    className="w-8 h-8 rounded-full border border-cyan-500/30 object-cover shrink-0"
                                    referrerPolicy="no-referrer"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full border border-dashed border-cyan-500/20 bg-slate-900 flex items-center justify-center text-cyan-500 shrink-0 font-mono text-[9px]">
                                    N/A
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold text-white">{stud.name}</div>
                                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">{stud.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-white font-semibold uppercase">{stud.usn}</td>
                            <td className="p-4 text-gray-300">{stud.department}</td>
                            <td className="p-4 text-center text-white font-mono">{stud.semester} • Section "{stud.section || 'A'}"</td>
                            <td className="p-4">
                              <span className={`font-mono font-bold ${stud.attendancePercentage < 75 ? 'text-red-400' : 'text-cyan-400'}`}>
                                {stud.attendancePercentage}%
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => setSelectedProfileStudent(stud)}
                                  className="text-emerald-400 hover:text-emerald-300 p-1.5 hover:bg-emerald-500/10 rounded cursor-pointer transition-all"
                                  title="View student profile"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => setEditingStudent(stud)}
                                  className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-cyan-500/10 rounded cursor-pointer transition-all"
                                  title="Edit Profile"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteStudent(stud.id, stud.name)}
                                  className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded cursor-pointer transition-all"
                                  title="Purge unit node"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
            </div>
          )}

          {/* VIEW: LECTURERS MANAGEMENT */}
          {activeTab === 'lecturers' && (
            <div className="space-y-6">
              
              {/* Insert / Edit Lecturer Form */}
              <div className="bg-[#0b0d16] border border-cyan-500/15 rounded-xl p-5 relative z-10">
                <h3 className="text-sm font-bold text-white font-display mb-4 uppercase tracking-wider flex items-center">
                  <UserPlus className="w-4 h-4 text-cyan-400 mr-2" />
                  <span>{editingLecturer ? 'Modify Lecturing Instructor node' : 'Provision Cybernetic Lector Node'}</span>
                </h3>

                {editingLecturer ? (
                  <form onSubmit={handleUpdateLecturer} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">LECTURER ID (READ-ONLY)</label>
                        <input
                          type="text"
                          disabled
                          className="w-full text-xs font-mono bg-cyan-950/20 text-cyan-400 px-3 py-2 border border-cyan-500/30 rounded outline-none"
                          value={editingLecturer.lecturerId}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Lector Name</label>
                        <input
                          type="text"
                          required
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingLecturer.name}
                          onChange={(e) => setEditingLecturer({ ...editingLecturer, name: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Lector Email</label>
                        <input
                          type="email"
                          required
                          className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingLecturer.email}
                          onChange={(e) => setEditingLecturer({ ...editingLecturer, email: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Department Matrix</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingLecturer.department}
                          onChange={(e) => setEditingLecturer({ ...editingLecturer, department: e.target.value })}
                        >
                          {DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">PORTAL PASSWORD</label>
                        <input
                          type="text"
                          required
                          className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingLecturer.password || 'password'}
                          onChange={(e) => setEditingLecturer({ ...editingLecturer, password: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5 font-bold">Assign Subjects (Checkboxes)</label>
                        <div className="border border-cyan-500/15 bg-black rounded p-3 h-28 overflow-y-auto space-y-1.5">
                          {subjects.length === 0 ? (
                            <span className="text-[10px] text-gray-500 italic block">No subjects found in system core.</span>
                          ) : (
                            subjects.map(sub => {
                              const selectedCodes = Array.isArray(editingLecturer.subjects)
                                ? editingLecturer.subjects.map(s => s.toUpperCase())
                                : (editingLecturer.subjects as string || '').split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                              const isChecked = selectedCodes.includes(sub.subjectCode.toUpperCase());
                              return (
                                <label key={sub.subjectCode} className="flex items-center space-x-2 text-xs text-gray-300 hover:text-white cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    className="accent-cyan-500 cursor-pointer h-3.5 w-3.5 rounded border-cyan-500/30"
                                    checked={isChecked}
                                    onChange={() => {
                                      let updated: string[];
                                      if (isChecked) {
                                        updated = selectedCodes.filter(c => c !== sub.subjectCode.toUpperCase());
                                      } else {
                                        updated = [...selectedCodes, sub.subjectCode.toUpperCase()];
                                      }
                                      setEditingLecturer({ ...editingLecturer, subjects: updated });
                                    }}
                                  />
                                  <span className="font-mono text-cyan-400 font-bold">{sub.subjectCode}</span>
                                  <span className="text-gray-400 text-[11px]">— {sub.subjectName} ({sub.department})</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setEditingLecturer(null)}
                        className="text-white text-xs border border-gray-600 px-4 py-2 hover:bg-gray-800 rounded font-mono cursor-pointer"
                      >
                        CLOSE_EDITOR
                      </button>
                      <button
                        type="submit"
                        className="bg-cyan-500 text-black text-xs font-bold font-display px-6 py-2 tracking-widest hover:bg-cyan-400 rounded cursor-pointer"
                      >
                        COMMIT_UPDATES
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleAddLecturer} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Lecturer ID</label>
                        <input
                          type="text"
                          placeholder="L_ARIS_1"
                          required
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newLecId}
                          onChange={(e) => setNewLecId(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Lector Name</label>
                        <input
                          type="text"
                          required
                          placeholder="Dr. Aris Thorne"
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newLecName}
                          onChange={(e) => setNewLecName(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Lector Email</label>
                        <input
                          type="email"
                          required
                          placeholder="aris@nexo.edu"
                          className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newLecEmail}
                          onChange={(e) => setNewLecEmail(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Department Head</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newLecDept}
                          onChange={(e) => setNewLecDept(e.target.value)}
                        >
                          {DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">PORTAL PASSWORD</label>
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-500/20 rounded outline-none"
                          value={newLecPassword}
                          onChange={(e) => setNewLecPassword(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5 font-bold">Assign Subjects (Checkboxes)</label>
                        <div className="border border-cyan-500/15 bg-black rounded p-3 h-28 overflow-y-auto space-y-1.5">
                          {subjects.length === 0 ? (
                            <span className="text-[10px] text-gray-500 italic block">No subjects found in system core.</span>
                          ) : (
                            subjects.map(sub => {
                              const selectedCodes = newLecSubjects.split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
                              const isChecked = selectedCodes.includes(sub.subjectCode.toUpperCase());
                              return (
                                <label key={sub.subjectCode} className="flex items-center space-x-2 text-xs text-gray-300 hover:text-white cursor-pointer select-none">
                                  <input
                                    type="checkbox"
                                    className="accent-cyan-500 cursor-pointer h-3.5 w-3.5 rounded border-cyan-500/30"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setNewLecSubjects(selectedCodes.filter(c => c !== sub.subjectCode.toUpperCase()).join(', '));
                                      } else {
                                        setNewLecSubjects([...selectedCodes, sub.subjectCode.toUpperCase()].join(', '));
                                      }
                                    }}
                                  />
                                  <span className="font-mono text-cyan-400 font-bold">{sub.subjectCode}</span>
                                  <span className="text-gray-400 text-[11px]">— {sub.subjectName} ({sub.department})</span>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="bg-cyan-700/60 hover:bg-cyan-500 hover:text-black border border-cyan-400 rounded px-6 py-2 text-xs font-display font-black tracking-widest transition-all cursor-pointer"
                      >
                        PROVISION_NODE
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Filtering Controls for Lecturers */}
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-[#0b0d16] p-4 rounded-xl border border-cyan-500/10 gap-3 relative z-10">
                <div className="relative w-full sm:max-w-xs">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Search Lecturer ID, Name or Email..."
                    className="w-full bg-black border border-cyan-500/15 py-1.5 pl-9 pr-4 rounded text-xs text-white focus:border-cyan-400 outline-none"
                    value={lecSearchQuery}
                    onChange={(e) => setLecSearchQuery(e.target.value)}
                  />
                </div>
                
                <div className="flex flex-wrap items-center gap-4 text-xs w-full sm:w-auto justify-end animate-fade-in shadow-inner">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-gray-500 uppercase text-[10px]">DEPT:</span>
                    <select
                      className="bg-black border border-cyan-500/15 py-1.5 px-2.5 rounded text-xs text-white focus:outline-none cursor-pointer focus:border-cyan-400"
                      value={lecDeptFilter}
                      onChange={(e) => setLecDeptFilter(e.target.value)}
                    >
                      <option value="All">All Departments</option>
                      {DEPARTMENTS.map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Lecturers list data table */}
              <div className="bg-[#0b0d16] border border-cyan-500/10 rounded-xl overflow-hidden shadow-lg relative z-10">
                <div className="p-4 bg-[#0d101a] border-b border-cyan-500/10 flex justify-between">
                  <span className="text-xs font-bold text-white font-display uppercase tracking-wider">LECTURING FACULTY DIRECTORIES ({filteredLecturers.length})</span>
                  <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-widest font-semibold">SECURITY CORE ACCESS</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-cyan-500/5 bg-[#05060d]">
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">INSTRUCTOR PROFILE</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">LECTURER ID</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">DEPARTMENT MATRIX</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">LINKED COGNITIONS / SUBJECTS</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 text-center uppercase tracking-wider">OPERATIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/5">
                      {filteredLecturers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-xs font-mono text-gray-500 uppercase">NO ACTIVE LECTOR ENTITY SECURED IN PATHS</td>
                        </tr>
                      ) : (
                        filteredLecturers.map(lec => (
                          <tr key={lec.id} className="hover:bg-cyan-950/5 transition-all text-xs">
                            <td className="p-4">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full border border-dashed border-cyan-500/30 bg-slate-900 flex items-center justify-center text-cyan-400 font-mono font-bold text-[10px] shrink-0 select-none">
                                  {lec.name.slice(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <div className="font-semibold text-white">{lec.name}</div>
                                  <div className="text-[10px] text-gray-500 font-mono mt-0.5">{lec.email}</div>
                                </div>
                              </div>
                            </td>
                            <td className="p-4 font-mono text-cyan-400 font-bold uppercase">{lec.lecturerId}</td>
                            <td className="p-4">
                              <span className="text-[10px] font-mono bg-cyan-950/30 border border-cyan-500/20 text-cyan-400 px-2 py-0.5 rounded font-extrabold uppercase">
                                {lec.department}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="flex flex-wrap gap-1">
                                {lec.subjects && lec.subjects.length > 0 ? (
                                  lec.subjects.map((sub, i) => (
                                    <span key={i} className="text-[10px] bg-black border border-cyan-500/15 text-white px-2 py-0.5 rounded font-mono" title={subjects.find(s => s.subjectCode === sub)?.subjectName || ''}>
                                      {sub}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-[10px] italic text-gray-500">No subjects linked</span>
                                )}
                              </div>
                            </td>
                            <td className="p-4">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  onClick={() => {
                                    setEditingLecturer(lec);
                                    window.scrollTo({ top: 0, behavior: 'smooth' });
                                  }}
                                  className="text-cyan-400 hover:text-cyan-300 p-1.5 hover:bg-cyan-500/10 rounded cursor-pointer transition-all"
                                  title="Edit Credentials"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteLecturer(lec.id, lec.name)}
                                  className="text-red-400 hover:text-red-300 p-1.5 hover:bg-red-500/10 rounded cursor-pointer transition-all"
                                  title="Terminate Lecturer Node"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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
            </div>
          )}

          {/* VIEW: SUBJECTS CATALOG MANAGEMENT */}
          {activeTab === 'subjects' && (
            <div className="space-y-6">
              
              {/* Insert / Edit Subject Form */}
              <div className="bg-[#0b0d16] border border-cyan-500/15 rounded-xl p-5 relative z-10">
                <h3 className="text-sm font-bold text-white font-display mb-4 uppercase tracking-wider flex items-center">
                  <BookOpen className="w-4 h-4 text-cyan-400 mr-2" />
                  <span>{editingSubject ? 'Update Subject Database configurations' : 'Surgically Register Global Subject Node'}</span>
                </h3>

                {editingSubject ? (
                  <form onSubmit={handleUpdateSubject} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 animate-fade-in">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5 font-bold">SUBJECT CODE (READ-ONLY)</label>
                        <input
                          type="text"
                          disabled
                          className="w-full text-xs font-mono bg-cyan-950/20 text-cyan-400 px-3 py-2 border border-cyan-500/30 rounded outline-none"
                          value={editingSubject.subjectCode}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Subject Name</label>
                        <input
                          type="text"
                          required
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingSubject.subjectName}
                          onChange={(e) => setEditingSubject({ ...editingSubject, subjectName: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Incorporate Semester</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingSubject.semester}
                          onChange={(e) => setEditingSubject({ ...editingSubject, semester: e.target.value })}
                        >
                          {SEMESTERS.map(s => (
                            <option key={s} value={s}>Semester {s}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Subject Department</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingSubject.department}
                          onChange={(e) => setEditingSubject({ ...editingSubject, department: e.target.value })}
                        >
                          {DEPARTMENTS.map(d => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setEditingSubject(null)}
                        className="text-white text-xs border border-gray-600 px-4 py-2 hover:bg-gray-800 rounded font-mono cursor-pointer"
                      >
                        CLOSE_EDITOR
                      </button>
                      <button
                        type="submit"
                        className="bg-cyan-500 text-black text-xs font-bold font-display px-6 py-2 tracking-widest hover:bg-cyan-400 rounded cursor-pointer"
                      >
                        COMMIT_UPDATES
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleAddSubject} className="grid grid-cols-1 md:grid-cols-6 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Subject Code</label>
                      <input
                        type="text"
                        required
                        placeholder="CS601"
                        className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                        value={newSubCode}
                        onChange={(e) => setNewSubCode(e.target.value)}
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5 font-bold">Subject Name</label>
                      <input
                        type="text"
                        required
                        placeholder="Deep Neural Networks"
                        className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                        value={newSubName}
                        onChange={(e) => setNewSubName(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Semester</label>
                      <select
                        className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                        value={newSubSem}
                        onChange={(e) => setNewSubSem(e.target.value)}
                      >
                        {SEMESTERS.map(s => (
                          <option key={s} value={s}>Semester {s}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Department</label>
                      <select
                        className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                        value={newSubDept}
                        onChange={(e) => setNewSubDept(e.target.value)}
                      >
                        {DEPARTMENTS.map(d => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-cyan-400 tracking-widest mb-1.5 font-extrabold block">Action Node</label>
                      <button
                        type="submit"
                        className="w-full text-xs font-display font-black tracking-widest bg-cyan-700/60 hover:bg-cyan-500 hover:text-black border border-cyan-400 rounded py-2 cursor-pointer transition-all"
                      >
                        ADD_SUBJECT
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Mapped Subjects directories list */}
              <div className="bg-[#0b0d16] border border-cyan-500/10 rounded-xl overflow-hidden shadow-lg relative z-10 animate-fade-in">
                <div className="p-4 bg-cyan-950/20 border-b border-cyan-500/10 flex justify-between">
                  <span className="text-xs font-bold text-white font-display uppercase tracking-wider">ACADEMIC SUBJECT MATRIX</span>
                  <span className="text-[10px] font-mono text-cyan-300 uppercase">SUBJECTS_LOADED: {subjects.length}</span>
                </div>

                <div className="overflow-x-auto text-xs">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="border-b border-cyan-500/5 bg-[#05060d]">
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">CODE</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">SUBJECT NAME</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">SEMESTER</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">DEPARTMENT MATRIX</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 text-center uppercase tracking-wider">OPERATIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/5">
                      {subjects.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-xs font-mono text-gray-500 uppercase">NO REGISTERED COURSE SUBJECTS DETECTED</td>
                        </tr>
                      ) : (
                        subjects.map(sub => (
                          <tr key={sub.subjectCode} className="hover:bg-cyan-950/5 transition-all">
                            <td className="p-4 font-mono font-bold text-white uppercase">{sub.subjectCode}</td>
                            <td className="p-4 text-white font-semibold font-sans">{sub.subjectName}</td>
                            <td className="p-4 font-mono">{sub.semester}</td>
                            <td className="p-4 text-gray-300">{sub.department}</td>
                            <td className="p-4 text-center">
                              <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => setEditingSubject(sub)}
                                  className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-500/10 rounded cursor-pointer"
                                  title="Edit Subject"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDeleteSubject(sub.subjectCode)}
                                  className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded cursor-pointer"
                                  title="Purge Subject"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
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

            </div>
          )}

          {/* VIEW: TIMETABLE MANAGEMENT */}
          {activeTab === 'timetable' && (
            <div className="space-y-6">
              
              {/* Add / Edit timetabling session block */}
              <div className="bg-[#0b0d16] border border-cyan-500/15 rounded-xl p-5 relative z-10">
                <h3 className="text-sm font-bold text-white font-display mb-4 uppercase tracking-wider flex items-center">
                  <Clock className="w-4 h-4 text-cyan-400 mr-2" />
                  <span>{editingTimetable ? 'Edit Active Scheduling Allocation Block' : 'Configure Active Class Scheduling Segment'}</span>
                </h3>

                {editingTimetable ? (
                  <form onSubmit={handleUpdateTimetable} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">Target Lecturing Day</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded focus:border-cyan-400 outline-none"
                          value={editingTimetable.day}
                          onChange={(e) => setEditingTimetable({ ...editingTimetable, day: e.target.value })}
                        >
                          <option value="Monday">Monday</option>
                          <option value="Tuesday">Tuesday</option>
                          <option value="Wednesday">Wednesday</option>
                          <option value="Thursday">Thursday</option>
                          <option value="Friday">Friday</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">Schedules (Time Segment e.g. "09:00 - 10:30")</label>
                        <input
                          type="text"
                          required
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingTimetable.time}
                          onChange={(e) => setEditingTimetable({ ...editingTimetable, time: e.target.value })}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">Subject Selection</label>
                        <select
                          required
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingTimetable.subject}
                          onChange={(e) => setEditingTimetable({ ...editingTimetable, subject: e.target.value })}
                        >
                          {subjects.map(s => (
                            <option key={s.subjectCode} value={s.subjectCode}>{s.subjectCode} - {s.subjectName}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">Lector Assigned</label>
                        <select
                          required
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingTimetable.lecturer}
                          onChange={(e) => setEditingTimetable({ ...editingTimetable, lecturer: e.target.value })}
                        >
                          {lecturers.map(l => (
                            <option key={l.lecturerId} value={l.lecturerId}>{l.name} ({l.department})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">Classroom Node</label>
                        <input
                          type="text"
                          required
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingTimetable.room}
                          onChange={(e) => setEditingTimetable({ ...editingTimetable, room: e.target.value })}
                        />
                      </div>

                      <div className="flex justify-end gap-3 pt-4">
                        <button
                          type="button"
                          onClick={() => setEditingTimetable(null)}
                          className="text-white text-xs border border-gray-600 px-4 py-2 hover:bg-gray-800 rounded font-mono cursor-pointer"
                        >
                          CLOSE_EDITOR
                        </button>
                        <button
                          type="submit"
                          className="bg-cyan-500 text-black text-xs font-bold font-display px-6 py-2 tracking-widest hover:bg-cyan-400 rounded cursor-pointer"
                        >
                          CONFIRM_UPDATES
                        </button>
                      </div>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleAddTimetable} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">Target Lecturing Day</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newTimeDay}
                          onChange={(e) => setNewTimeDay(e.target.value)}
                        >
                          <option value="Monday">Monday</option>
                          <option value="Tuesday">Tuesday</option>
                          <option value="Wednesday">Wednesday</option>
                          <option value="Thursday">Thursday</option>
                          <option value="Friday">Friday</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">Sector (Start Time)</label>
                        <input
                          type="text"
                          required
                          placeholder="09:00"
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newTimeStart}
                          onChange={(e) => setNewTimeStart(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">Sector Offset (End Time)</label>
                        <input
                          type="text"
                          required
                          placeholder="10:30"
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newTimeEnd}
                          onChange={(e) => setNewTimeEnd(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5">Lector Assigned</label>
                        <select
                          required
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newTimeLecturer}
                          onChange={(e) => setNewTimeLecturer(e.target.value)}
                        >
                          <option value="">Choose Assigned Node...</option>
                          {lecturers.map(l => (
                            <option key={l.id} value={l.lecturerId}>{l.name} ({l.department})</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5 font-bold">Subject Code</label>
                        <select
                          required
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newTimeSubject}
                          onChange={(e) => setNewTimeSubject(e.target.value)}
                        >
                          <option value="">Select subject...</option>
                          {subjects.map(s => (
                            <option key={s.subjectCode} value={s.subjectCode}>{s.subjectCode} - {s.subjectName}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5 font-bold">Classroom Node</label>
                        <input
                          type="text"
                          required
                          placeholder="Aero-Lab 404"
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                          value={newTimeRoom}
                          onChange={(e) => setNewTimeRoom(e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-wider mb-1.5 font-bold">Incorporate Block</label>
                        <button
                          type="submit"
                          className="w-full text-xs font-display font-black tracking-widest bg-cyan-700/60 hover:bg-cyan-500 hover:text-black border border-cyan-400 rounded py-2 cursor-pointer transition-all"
                        >
                          ADD_GRID_BLOCK
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </div>

              {/* Rendering Timetable Grid sorted by day */}
              <CalendarView 
                slots={timetable} 
                isAdmin={true} 
                onEdit={(slot) => {
                  setEditingTimetable(slot);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }} 
                onDelete={handleDeleteTimetable} 
              />
            </div>
          )}

          {/* VIEW: ATTENDANCE LEDGER LOGS CRUD */}
          {activeTab === 'reports' && (
            <div className="space-y-6 relative z-10">
              
              {/* Insert / Edit Attendance record */}
              <div className="bg-[#0b0d16] border border-cyan-500/15 rounded-xl p-5 relative z-10 animate-fade-in">
                <h3 className="text-sm font-bold text-white font-display mb-4 uppercase tracking-wider flex items-center">
                  <Layers className="w-4 h-4 text-[#00ffc8] mr-2" />
                  <span>{editingAttendance ? 'Alter Attendance Record Transaction' : 'Insert Custom Student Attendance Log'}</span>
                </h3>

                {editingAttendance ? (
                  <form onSubmit={handleUpdateAttendance} className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5 font-bold">STUDENT USN (READ-ONLY)</label>
                        <input
                          type="text"
                          disabled
                          className="w-full text-xs font-mono bg-cyan-950/20 text-cyan-400 px-3 py-2 border border-cyan-500/30 rounded outline-none"
                          value={editingAttendance.studentUsn}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5 font-bold">SUBJECT CODE (READ-ONLY)</label>
                        <input
                          type="text"
                          disabled
                          className="w-full text-xs font-mono bg-cyan-950/20 text-cyan-400 px-3 py-2 border border-cyan-500/30 rounded outline-none"
                          value={editingAttendance.subjectCode}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">Date (YYYY-MM-DD)</label>
                        <input
                          type="date"
                          required
                          className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingAttendance.date}
                          onChange={(e) => setEditingAttendance({ ...editingAttendance, date: e.target.value })}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">State Status</label>
                        <select
                          className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-400/50 rounded outline-none"
                          value={editingAttendance.status}
                          onChange={(e) => setEditingAttendance({ ...editingAttendance, status: e.target.value as 'Present' | 'Absent' })}
                        >
                          <option value="Present">Present</option>
                          <option value="Absent">Absent</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-3">
                      <button
                        type="button"
                        onClick={() => setEditingAttendance(null)}
                        className="text-white text-xs border border-gray-600 px-4 py-2 hover:bg-gray-800 rounded font-mono cursor-pointer"
                      >
                        CLOSE_EDITOR
                      </button>
                      <button
                        type="submit"
                        className="bg-cyan-500 text-black text-xs font-bold font-display px-6 py-2 tracking-widest hover:bg-cyan-400 rounded cursor-pointer"
                      >
                        CHANGE_STATUS
                      </button>
                    </div>
                  </form>
                ) : (
                  <form onSubmit={handleAddAttendance} className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">STUDENT USN</label>
                      <input
                        type="text"
                        required
                        placeholder="1NX22CS001"
                        className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                        value={newAttUsn}
                        onChange={(e) => setNewAttUsn(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">COURSE SUBJECT</label>
                      <select
                        className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                        value={newAttSubject}
                        onChange={(e) => setNewAttSubject(e.target.value)}
                      >
                        {subjects.map(s => (
                          <option key={s.subjectCode} value={s.subjectCode}>{s.subjectCode} - {s.subjectName}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">LOG DATE</label>
                      <input
                        type="date"
                        required
                        className="w-full text-xs font-mono bg-black text-white px-3 py-2 border border-cyan-500/20 rounded outline-none"
                        value={newAttDate}
                        onChange={(e) => setNewAttDate(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-cyan-400 uppercase tracking-widest mb-1.5">SIGNAL STATE</label>
                      <select
                        className="w-full text-xs bg-black text-white px-3 py-2 border border-cyan-500/20 rounded focus:border-cyan-400 outline-none"
                        value={newAttStatus}
                        onChange={(e) => setNewAttStatus(e.target.value as 'Present' | 'Absent')}
                      >
                        <option value="Present">Present</option>
                        <option value="Absent">Absent</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] font-mono text-cyan-400 tracking-widest mb-1.5 font-bold">COMMIT PROTOCOL</label>
                      <button
                        type="submit"
                        className="w-full text-xs font-display font-black tracking-widest bg-cyan-700/60 hover:bg-cyan-500 hover:text-black border border-cyan-400 rounded py-2 cursor-pointer transition-all"
                      >
                        LOG_ATTENDANCE
                      </button>
                    </div>
                  </form>
                )}
              </div>

              {/* Transactions list */}
              <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 rounded-xl overflow-hidden shadow-lg">
                <div className="p-4 bg-cyan-950/30 border-b border-cyan-500/15 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                  <div>
                    <h4 className="text-xs font-bold text-white font-display uppercase tracking-wider">Holographic Attendance Transaction Logs</h4>
                    <p className="text-[10px] font-mono text-cyan-300/55 uppercase mt-0.5">Real-time ledger updates transmitted by classroom beacon units</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={downloadAdminReport}
                      className="bg-cyan-500 hover:bg-cyan-400 text-black font-mono font-bold text-[9px] tracking-widest px-3 py-1.5 rounded uppercase flex items-center gap-1.5 transition-all cursor-pointer shadow-md"
                    >
                      <Download className="w-3 h-3 text-black" />
                      EXPORT REPORT (CSV)
                    </button>
                    <span className="text-[10px] font-mono font-bold text-cyan-400 border border-cyan-500/25 px-2.5 py-1.5 rounded bg-slate-950/50">
                      TRANSACTIONS_LOGGED: {attendance.length}
                    </span>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-cyan-500/5 bg-slate-950/40">
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">TIMESTAMP SEC</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">STUDENT name</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">USN CODE</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider">SUBJECT TARGET</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 uppercase tracking-wider text-center font-bold">SIGNAL STATE</th>
                        <th className="p-4 text-[10px] font-mono text-cyan-400 text-center uppercase tracking-wider">OPERATIONS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-cyan-500/5">
                      {attendance.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-xs font-mono text-gray-500 uppercase">NO ATTENDANCE REGISTERS CREATED ON SERVER</td>
                        </tr>
                      ) : (
                        [...attendance].reverse().map(rec => {
                          const slot = timetable.find(t => t.id === rec.timetableSlotId);
                          return (
                            <tr key={rec.id} className="hover:bg-cyan-950/5 transition-all text-xs">
                              <td className="p-4 font-mono text-gray-400 text-[11px]">
                                {rec.timestamp ? new Date(rec.timestamp).toLocaleString() : '---'}
                              </td>
                              <td className="p-4">
                                <span className="font-semibold text-white">{rec.studentName || 'ByRef'}</span>
                              </td>
                              <td className="p-4 font-mono text-cyan-400 font-semibold">{rec.studentUsn}</td>
                              <td className="p-4 font-sans text-gray-300">
                                <code className="text-cyan-400 font-bold">{rec.subjectCode}</code>
                                {slot ? ` (${slot.subject})` : ''} 
                                <span className="text-[10px] font-mono text-gray-500 ml-1.5">({rec.date})</span>
                              </td>
                              <td className="p-4 text-center">
                                <span className={`inline-block font-mono text-[10px] font-extrabold px-2 py-0.5 rounded uppercase border ${
                                  rec.status === 'Present'
                                    ? 'bg-emerald-950/20 border-emerald-500/35 text-emerald-400 font-semibold'
                                    : 'bg-red-950/20 border-red-500/35 text-red-400'
                                }`}>
                                  {rec.status}
                                </span>
                              </td>
                              <td className="p-4">
                                <div className="flex items-center justify-center gap-2">
                                  <button
                                    onClick={() => setEditingAttendance(rec)}
                                    className="text-cyan-400 hover:text-cyan-300 p-1 hover:bg-cyan-500/5 rounded cursor-pointer"
                                    title="Edit status"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteAttendance(rec.id)}
                                    className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded cursor-pointer"
                                    title="Surgically delete log"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
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

          {/* VIEW: SETTINGS */}
          {activeTab === 'settings' && (
            <div className="space-y-6 relative z-10 animate-fade-in">
              <div className="bg-cyan-950/20 backdrop-blur-md border border-cyan-500/15 p-6 rounded-xl shadow-lg space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-white font-display mb-1 uppercase tracking-wider">NEXO CENTRAL DATA CONTROLLER Settings</h4>
                  <p className="text-[11px] text-cyan-400/55 font-mono uppercase">Operational parameters governing database tables and CRUD integrity</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                  <div className="space-y-3 bg-black/40 p-4 border border-cyan-500/10 rounded-lg">
                    <h5 className="text-xs font-mono font-bold text-white uppercase tracking-wider">PERSISTENT DB TABLES STRUCTURES</h5>
                    <p className="text-xs text-gray-400">All data tables are saved in durable cloud containers with the following operational JSON documents:</p>
                    <ul className="text-[11px] text-cyan-400 font-mono space-y-1 pl-2">
                      <li>• db_students.json</li>
                      <li>• db_lecturers.json</li>
                      <li>• db_subjects.json</li>
                      <li>• db_timetable.json</li>
                      <li>• db_attendance.json</li>
                    </ul>
                  </div>

                  <div className="space-y-3 bg-black/40 p-4 border border-cyan-500/10 rounded-lg">
                    <h5 className="text-xs font-mono font-bold text-white uppercase tracking-wider">SECURE INTEGRITY CHECKS</h5>
                    <p className="text-xs text-gray-400">Database references are continuously maintained with cascading purges on records to defend transaction safety.</p>
                    <div className="flex items-center space-x-2 text-[10.5px] font-mono text-emerald-400 mt-2">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>CASCADING INTEGRITY PURGES: ENGAGED</span>
                    </div>
                  </div>
                </div>

                {/* Advanced Security & Biometric Purge Tool */}
                <div className="border-t border-cyan-500/15 pt-5 space-y-4">
                  <div>
                    <h5 className="text-xs font-mono font-bold text-red-400 uppercase tracking-wider flex items-center">
                      <ShieldAlert className="w-4 h-4 mr-1.5 animate-pulse" />
                      CRITICAL OPERATIONS: COGNITIVE OVERRIDES
                    </h5>
                    <p className="text-xs text-gray-400 mt-1">
                      Execute core-level administrative security queries. These processes operate directly on live databases.
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-red-950/10 border border-red-500/20 p-4 rounded-lg">
                    <div className="flex-1 space-y-1">
                      <div className="text-xs font-bold text-white font-mono uppercase">PURGE ALL BIOMETRIC SIGNATURE DATABASE</div>
                      <p className="text-[11px] text-gray-400 max-w-xl">
                        Purges the face recognition models, faceImages, faceDescriptors, and all student biometric registrations. Non-biometric databases (Students, Lecturers, Attendance logs, Timetables) will be preserved.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handlePurgeBiometrics}
                      className="px-4 py-2 bg-red-900/40 hover:bg-red-650 border border-red-500 text-red-200 hover:text-black rounded text-xs font-mono font-bold tracking-wider transition-all duration-200 cursor-pointer self-start sm:self-auto shrink-0 uppercase"
                    >
                      PURGE ALL BIOMETRIC DATA
                    </button>
                  </div>

                  {purgeResult && purgeResult.purged && (
                    <div className="mt-4 bg-black/80 border border-emerald-500/40 p-5 rounded-lg font-mono text-xs text-[#00ffc8] space-y-4 shadow-[0_0_15px_rgba(16,185,129,0.15)] leading-relaxed">
                      <div className="text-sm font-extrabold text-emerald-400 tracking-wider">
                        Biometric Database Purged Successfully
                      </div>
                      
                      <div className="text-gray-500 text-[10px] uppercase tracking-wider">
                        Show:
                      </div>
                      
                      <div className="text-white font-bold pl-2 border-l-2 border-emerald-500 bg-emerald-500/5 py-1.5 px-3 rounded">
                        Profiles Deleted: {purgeResult.profilesDeleted}
                      </div>
                      
                      <div className="space-y-1">
                        <div className="text-gray-400 font-bold uppercase tracking-widest text-[9.5px]">Verification:</div>
                        <div className="text-emerald-300 font-black pl-2">
                          Face Profile Count = {purgeResult.verificationCount}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="border-t border-cyan-500/5 pt-5 flex justify-between items-center text-xs text-gray-500 font-mono">
                  <span>SECURITY CORE DECRYPTION SIGNATURE: SHA-256 v8.2</span>
                  <span className="text-cyan-500/70">AUTHORIZED PERSISTENCE COGNITION: INTEGRAL & DURABLE</span>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'biometrics' && (
            <BiometricRegistration 
              students={students}
              faceProfiles={faceProfiles}
              onRefresh={loadSystemData}
            />
          )}

        </div>
      </main>

      {/* Student Profile Modal */}
      {selectedProfileStudent && (() => {
        const studRecords = attendance.filter(
          r => r.studentUsn.toUpperCase() === selectedProfileStudent.usn.toUpperCase()
        );
        const presentsCount = studRecords.filter(r => r.status === 'Present').length;
        const absentsCount = studRecords.filter(r => r.status === 'Absent').length;
        const totalAttendanceCount = studRecords.length;
        
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-[#0b0d1e] border-2 border-cyan-500/30 rounded-2xl w-full max-w-lg overflow-hidden shadow-[0_0_30px_rgba(6,182,212,0.15)] relative">
              <div className="h-28 bg-gradient-to-r from-cyan-950 via-slate-900 to-cyan-900/60 relative p-6 flex items-end">
                <div className="absolute top-4 right-4">
                  <button 
                    onClick={() => setSelectedProfileStudent(null)}
                    className="p-1.5 rounded-full bg-black/40 hover:bg-black/80 text-gray-400 hover:text-white transition-all border border-cyan-500/10 cursor-pointer"
                  >
                    <XCircle className="w-5 h-5 text-red-400 hover:text-red-300" />
                  </button>
                </div>
                <div className="flex items-center space-x-3 translate-y-8">
                  {selectedProfileStudent.profilePhoto ? (
                    <img 
                      src={selectedProfileStudent.profilePhoto} 
                      alt={selectedProfileStudent.name} 
                      className="w-20 h-20 rounded-full border-2 border-cyan-500 object-cover bg-black shadow-lg shadow-black/80 animate-pulse"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-full border-2 border-dashed border-cyan-500 bg-slate-950 flex items-center justify-center text-cyan-500 shadow-lg font-mono text-xl">
                      {selectedProfileStudent.name.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className="pb-1">
                    <h3 className="text-lg font-bold text-white font-sans drop-shadow-md">{selectedProfileStudent.name}</h3>
                    <span className="text-xs font-mono text-cyan-400 font-bold block">{selectedProfileStudent.usn}</span>
                  </div>
                </div>
              </div>

              <div className="p-6 pt-12 space-y-5">
                <div className="grid grid-cols-2 gap-4 text-xs font-mono">
                  <div className="bg-black/30 border border-cyan-500/5 p-3 rounded-xl">
                    <span className="text-gray-500 block text-[9px] uppercase tracking-wider">DEPARTMENT MATRIX</span>
                    <span className="text-white text-xs font-semibold block mt-0.5">{selectedProfileStudent.department}</span>
                  </div>
                  <div className="bg-black/30 border border-cyan-500/5 p-3 rounded-xl">
                    <span className="text-gray-500 block text-[9px] uppercase tracking-wider">SEM / SECTION</span>
                    <span className="text-white text-xs font-semibold block mt-0.5">Semester {selectedProfileStudent.semester} • Sec {selectedProfileStudent.section || 'A'}</span>
                  </div>
                  <div className="bg-black/30 border border-cyan-500/5 p-3 rounded-xl col-span-2">
                    <span className="text-gray-500 block text-[9px] uppercase tracking-wider">CYBERMAIL RESOURCE</span>
                    <span className="text-cyan-400 font-semibold text-xs block mt-0.5 select-all">{selectedProfileStudent.email}</span>
                  </div>
                </div>

                {/* Attendance Analytics dashboard details */}
                <div className="bg-black/40 border border-cyan-500/10 p-4 rounded-xl space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-mono text-white font-bold uppercase tracking-wider">ATTENDANCE METRICS STATUS</span>
                    <span className={`text-sm font-mono font-black ${selectedProfileStudent.attendancePercentage < 75 ? 'text-red-400' : 'text-cyan-400'}`}>
                      {selectedProfileStudent.attendancePercentage}%
                    </span>
                  </div>

                  <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-cyan-500/10">
                    <div 
                      className={`h-full rounded-full transition-all duration-500 ${
                        selectedProfileStudent.attendancePercentage < 75 ? 'bg-gradient-to-r from-red-500 to-amber-500' : 'bg-gradient-to-r from-cyan-500 to-[#00ffc8]'
                      }`}
                      style={{ width: `${selectedProfileStudent.attendancePercentage}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-[11px] font-mono pt-1">
                    <div className="bg-emerald-950/20 border border-emerald-500/10 py-1.5 rounded-lg">
                      <span className="text-emerald-400 block font-bold text-xs">{presentsCount}</span>
                      <span className="text-gray-500 text-[8.5px] uppercase text-[9px]">Presents</span>
                    </div>
                    <div className="bg-red-950/20 border border-red-500/10 py-1.5 rounded-lg">
                      <span className="text-red-400 block font-bold text-xs">{absentsCount}</span>
                      <span className="text-gray-500 text-[8.5px] uppercase text-[9px]">Absents</span>
                    </div>
                    <div className="bg-cyan-950/20 border border-cyan-500/10 py-1.5 rounded-lg">
                      <span className="text-cyan-300 block font-bold text-xs">{totalAttendanceCount}</span>
                      <span className="text-gray-500 text-[8.5px] uppercase text-[9px]">Classes</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => setSelectedProfileStudent(null)}
                    className="bg-cyan-500/10 hover:bg-cyan-500 text-cyan-400 hover:text-black border border-cyan-500/30 rounded-lg px-5 py-2 text-xs font-mono font-bold tracking-widest transition-all cursor-pointer"
                  >
                    DISMISS_PROFILE
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
