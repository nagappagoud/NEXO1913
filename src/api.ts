import { Student, Lecturer, Subject, TimetableSlot, AttendanceRecord, ActiveSession, UserSession, StudentFaceProfile } from './types';

const API_BASE = '/api';

export const apiClient = {
  async login(payload: { role: string; password?: string; email?: string; usn?: string }): Promise<UserSession> {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Authentication rejected by security core.');
    }
    return response.json();
  },

  // ================= STUDENT CRUD =================
  async getStudents(): Promise<Student[]> {
    const res = await fetch(`${API_BASE}/students`);
    return res.json();
  },

  async addStudent(student: Omit<Student, 'id' | 'attendancePercentage'>): Promise<Student> {
    const res = await fetch(`${API_BASE}/students`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to inject student record.');
    }
    return res.json();
  },

  async updateStudent(id: string, student: Partial<Student>): Promise<Student> {
    const res = await fetch(`${API_BASE}/students/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(student),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update student node.');
    }
    return res.json();
  },

  async deleteStudent(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/students/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  // ================= LECTURER CRUD =================
  async getLecturers(): Promise<Lecturer[]> {
    const res = await fetch(`${API_BASE}/lecturers`);
    return res.json();
  },

  async addLecturer(lecturer: Omit<Lecturer, 'id'>): Promise<Lecturer> {
    const res = await fetch(`${API_BASE}/lecturers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lecturer),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to register lecturer node.');
    }
    return res.json();
  },

  async updateLecturer(id: string, lecturer: Partial<Lecturer>): Promise<Lecturer> {
    const res = await fetch(`${API_BASE}/lecturers/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(lecturer),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update lecturer node.');
    }
    return res.json();
  },

  async deleteLecturer(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/lecturers/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  // ================= SUBJECT CRUD =================
  async getSubjects(): Promise<Subject[]> {
    const res = await fetch(`${API_BASE}/subjects`);
    return res.json();
  },

  async addSubject(subject: Subject): Promise<Subject> {
    const res = await fetch(`${API_BASE}/subjects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subject),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create subject record.');
    }
    return res.json();
  },

  async updateSubject(subjectCode: string, subject: Partial<Subject>): Promise<Subject> {
    const res = await fetch(`${API_BASE}/subjects/${subjectCode}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(subject),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update subject record.');
    }
    return res.json();
  },

  async deleteSubject(subjectCode: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/subjects/${subjectCode}`, { method: 'DELETE' });
    return res.ok;
  },

  // ================= TIMETABLE CRUD =================
  async getTimetable(): Promise<TimetableSlot[]> {
    const res = await fetch(`${API_BASE}/timetable`);
    return res.json();
  },

  async addTimetable(slot: { day: string; time: string; subject: string; lecturer: string; room: string }): Promise<TimetableSlot> {
    const res = await fetch(`${API_BASE}/timetable`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slot),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to schedule timetable slot.');
    }
    return res.json();
  },

  async updateTimetable(id: string, slot: Partial<TimetableSlot>): Promise<TimetableSlot> {
    const res = await fetch(`${API_BASE}/timetable/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slot),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update timetable slot.');
    }
    return res.json();
  },

  async deleteTimetable(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/timetable/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  // ================= ATTENDANCE CRUD =================
  async getAttendance(): Promise<AttendanceRecord[]> {
    const res = await fetch(`${API_BASE}/attendance`);
    return res.json();
  },

  async addAttendance(record: Partial<AttendanceRecord> & { studentUsn: string; subjectCode: string; date: string; status: 'Present' | 'Absent' }): Promise<AttendanceRecord> {
    const res = await fetch(`${API_BASE}/attendance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add attendance record.');
    }
    return res.json();
  },

  async updateAttendance(id: string, record: Partial<AttendanceRecord>): Promise<AttendanceRecord> {
    const res = await fetch(`${API_BASE}/attendance/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update attendance record.');
    }
    return res.json();
  },

  async deleteAttendance(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/attendance/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  // Bulk submission for lecturers (supporting custom manual fields)
  async submitAttendance(
    timetableSlotId: string, 
    date: string, 
    records: { studentId: string; status: 'Present' | 'Absent' | 'Late' }[],
    extra?: { subjectCode?: string; department?: string; semester?: string; room?: string; time?: string; lecturerId?: string }
  ): Promise<boolean> {
    const res = await fetch(`${API_BASE}/attendance/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timetableSlotId, date, records, ...extra }),
    });
    return res.ok;
  },

  // ================= SMART SCAN BEACONS =================
  async startSession(timetableSlotId: string): Promise<ActiveSession> {
    const res = await fetch(`${API_BASE}/session/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ timetableSlotId }),
    });
    return res.json();
  },

  async getActiveSession(timetableSlotId: string): Promise<ActiveSession> {
    const res = await fetch(`${API_BASE}/session/active/${timetableSlotId}`);
    return res.json();
  },

  async checkinSession(studentId: string, timetableSlotId: string, otpCode: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/session/checkin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, timetableSlotId, otpCode }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Authentication code decrypt error.');
    }
    return res.ok;
  },

  // ================= BIOMETRIC REGISTRATION =================
  async getFaceProfiles(): Promise<StudentFaceProfile[]> {
    const res = await fetch(`${API_BASE}/face-profiles`);
    return res.json();
  },

  async addFaceProfile(profile: Omit<StudentFaceProfile, 'id'>): Promise<StudentFaceProfile> {
    const res = await fetch(`${API_BASE}/face-profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Biometric upload packet signature check failed.');
    }
    return res.json();
  },

  async deleteFaceProfile(id: string): Promise<boolean> {
    const res = await fetch(`${API_BASE}/face-profiles/${id}`, { method: 'DELETE' });
    return res.ok;
  },

  async purgeBiometricData(): Promise<{ success: boolean; message: string; profilesDeleted: number; verificationCount: number }> {
    const res = await fetch(`${API_BASE}/admin/purge-biometrics`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to execute purge request.');
    }
    return res.json();
  },

  // ================= SUPABASE INTEGRATION =================
  async getSupabaseStatus(): Promise<{
    connected: boolean;
    projectUrl: string;
    projectId: string;
    tablesDetected: string[];
    tablesMissing: string[];
    lastChecked: string;
    error?: string;
  }> {
    const res = await fetch(`${API_BASE}/supabase/status`);
    return res.json();
  },

  async syncSupabase(): Promise<{ success: boolean; timestamp: string; results: any }> {
    const res = await fetch(`${API_BASE}/supabase/sync`, { method: 'POST' });
    return res.json();
  },

  async getSupabaseSql(): Promise<{ projectId: string; url: string; sql: string }> {
    const res = await fetch(`${API_BASE}/supabase/sql`);
    return res.json();
  }
};

