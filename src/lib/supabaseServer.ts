import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://qqjfpimvewpchyoxnjht.supabase.co';
export const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFxamZwaW12ZXdwY2h5b3huamh0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxNzUzODAsImV4cCI6MjEwMDc1MTM4MH0.CgBDkU5H5kT4QWpv845EKAMuUbfoLgzRkZkPfQR7zNY';
export const SUPABASE_PROJECT_ID = 'qqjfpimvewpchyoxnjht';

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseServerClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabaseClient;
}

export const SQL_SCHEMA_SCRIPT = `-- ==============================================================================
-- NEXO Smart Biometric Attendance System - Production Supabase PostgreSQL Schema
-- Project URL: https://qqjfpimvewpchyoxnjht.supabase.co
-- ==============================================================================

-- 0. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==============================================================================
-- 1. STUDENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  usn VARCHAR(20) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  phone_number VARCHAR(20),
  department VARCHAR(50) NOT NULL,
  semester VARCHAR(10) NOT NULL,
  section VARCHAR(5) NOT NULL,
  password VARCHAR(255) NOT NULL,
  face_image_url TEXT,
  face_descriptor JSONB DEFAULT '[]'::jsonb, -- 128-dim FaceAPI.js floating point array
  registration_date TIMESTAMPTZ DEFAULT NOW(),
  attendance_percentage INTEGER DEFAULT 100 CHECK (attendance_percentage BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 2. LECTURERS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS lecturers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecturer_id VARCHAR(30) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  department VARCHAR(50) NOT NULL,
  subjects JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. SUBJECTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS subjects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_code VARCHAR(20) UNIQUE NOT NULL,
  subject_name VARCHAR(150) NOT NULL,
  semester VARCHAR(10) NOT NULL,
  department VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. LECTURER SUBJECT ASSIGNMENTS TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS lecturer_subject_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  lecturer_id UUID REFERENCES lecturers(id) ON DELETE CASCADE,
  subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(lecturer_id, subject_id)
);

-- ==============================================================================
-- 5. TIMETABLE TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS timetable (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject_id UUID REFERENCES subjects(id) ON DELETE SET NULL,
  lecturer_id UUID REFERENCES lecturers(id) ON DELETE SET NULL,
  subject_code VARCHAR(20) NOT NULL,
  subject_name VARCHAR(150) NOT NULL,
  lecturer_name VARCHAR(100) NOT NULL,
  room VARCHAR(30) NOT NULL,
  day VARCHAR(15) NOT NULL CHECK (day IN ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  department VARCHAR(50) NOT NULL,
  semester VARCHAR(10) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. ATTENDANCE TABLE
-- ==============================================================================
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID REFERENCES students(id) ON DELETE CASCADE,
  student_usn VARCHAR(20) NOT NULL,
  student_name VARCHAR(100),
  subject_code VARCHAR(20) NOT NULL,
  lecturer_id UUID REFERENCES lecturers(id) ON DELETE SET NULL,
  timetable_id UUID REFERENCES timetable(id) ON DELETE SET NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  time TIME NOT NULL DEFAULT CURRENT_TIME,
  status VARCHAR(10) NOT NULL CHECK (status IN ('Present', 'Absent', 'Late')),
  verification_method VARCHAR(20) DEFAULT 'Face Recognition' CHECK (verification_method IN ('Face Recognition', 'Manual', 'QR Code')),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. FACE PROFILES TABLE (SUPPORT FOR MULTIPLE/HISTORICAL FACIAL EMBEDDINGS)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS face_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  student_name VARCHAR(100) NOT NULL,
  usn VARCHAR(20) NOT NULL,
  department VARCHAR(50) NOT NULL,
  registration_date TIMESTAMPTZ DEFAULT NOW(),
  primary_face_url TEXT,
  face_images JSONB DEFAULT '[]'::jsonb, -- Array of Supabase Storage Image URLs
  face_descriptors JSONB DEFAULT '[]'::jsonb, -- Array of 128-dim FaceAPI.js embeddings
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- INDEXES FOR PERFORMANCE OPTIMIZATION
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_students_usn ON students(usn);
CREATE INDEX IF NOT EXISTS idx_students_dept_sem ON students(department, semester);
CREATE INDEX IF NOT EXISTS idx_lecturers_email ON lecturers(email);
CREATE INDEX IF NOT EXISTS idx_subjects_code ON subjects(subject_code);
CREATE INDEX IF NOT EXISTS idx_timetable_day_dept ON timetable(day, department, semester);
CREATE INDEX IF NOT EXISTS idx_attendance_student ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date, subject_code);
CREATE INDEX IF NOT EXISTS idx_face_profiles_student ON face_profiles(student_id);

-- ==============================================================================
-- AUTOMATIC UPDATED_AT TIMESTAMP TRIGGER
-- ==============================================================================
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW();
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE OR REPLACE TRIGGER trg_lecturers_updated_at BEFORE UPDATE ON lecturers FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE OR REPLACE TRIGGER trg_subjects_updated_at BEFORE UPDATE ON subjects FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE OR REPLACE TRIGGER trg_timetable_updated_at BEFORE UPDATE ON timetable FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
CREATE OR REPLACE TRIGGER trg_face_profiles_updated_at BEFORE UPDATE ON face_profiles FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- ==============================================================================
-- SUPABASE STORAGE BUCKET CREATION FOR "student-faces"
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'student-faces', 
  'student-faces', 
  true, 
  10485760, -- 10MB Limit
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET public = true;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES & PERMISSIONS
-- ==============================================================================
-- Enable RLS
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE lecturers ENABLE ROW LEVEL SECURITY;
ALTER TABLE subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE timetable ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE face_profiles ENABLE ROW LEVEL SECURITY;

-- Allow public access for application integration
CREATE POLICY "Public Read Access Students" ON students FOR SELECT USING (true);
CREATE POLICY "Public Write Access Students" ON students FOR ALL USING (true);

CREATE POLICY "Public Read Access Lecturers" ON lecturers FOR SELECT USING (true);
CREATE POLICY "Public Write Access Lecturers" ON lecturers FOR ALL USING (true);

CREATE POLICY "Public Read Access Subjects" ON subjects FOR SELECT USING (true);
CREATE POLICY "Public Write Access Subjects" ON subjects FOR ALL USING (true);

CREATE POLICY "Public Read Access Timetable" ON timetable FOR SELECT USING (true);
CREATE POLICY "Public Write Access Timetable" ON timetable FOR ALL USING (true);

CREATE POLICY "Public Read Access Attendance" ON attendance FOR SELECT USING (true);
CREATE POLICY "Public Write Access Attendance" ON attendance FOR ALL USING (true);

CREATE POLICY "Public Read Access Face Profiles" ON face_profiles FOR SELECT USING (true);
CREATE POLICY "Public Write Access Face Profiles" ON face_profiles FOR ALL USING (true);

-- Storage bucket access policies
CREATE POLICY "Public Storage Select" ON storage.objects FOR SELECT USING (bucket_id = 'student-faces');
CREATE POLICY "Public Storage Insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'student-faces');
CREATE POLICY "Public Storage Update" ON storage.objects FOR UPDATE USING (bucket_id = 'student-faces');
CREATE POLICY "Public Storage Delete" ON storage.objects FOR DELETE USING (bucket_id = 'student-faces');

-- ==============================================================================
-- SAMPLE SEED DATA
-- ==============================================================================
INSERT INTO subjects (subject_code, subject_name, semester, department) VALUES
('18CS61', 'System Software & Compiler Design', '6', 'Computer Science'),
('18CS62', 'Computer Graphics & Visualization', '6', 'Computer Science'),
('18CS63', 'Web Technology & Its Applications', '6', 'Computer Science')
ON CONFLICT (subject_code) DO NOTHING;
`;

export interface SupabaseStatusResult {
  connected: boolean;
  projectUrl: string;
  projectId: string;
  tablesDetected: string[];
  tablesMissing: string[];
  lastChecked: string;
  error?: string;
}

export async function checkSupabaseStatus(): Promise<SupabaseStatusResult> {
  const client = getSupabaseServerClient();
  const tables = ['students', 'lecturers', 'subjects', 'timetable', 'attendance', 'face_profiles'];
  const tablesDetected: string[] = [];
  const tablesMissing: string[] = [];
  let connectionError: string | undefined;

  try {
    for (const table of tables) {
      const { error } = await client.from(table).select('count', { count: 'exact', head: true });
      if (!error) {
        tablesDetected.push(table);
      } else {
        tablesMissing.push(table);
        if (error.code !== 'PGRST301' && error.message) {
          // Table missing or syntax error is expected before SQL script execution
        }
      }
    }
  } catch (err: any) {
    connectionError = err?.message || 'Failed to reach Supabase API server';
  }

  return {
    connected: !connectionError,
    projectUrl: SUPABASE_URL,
    projectId: SUPABASE_PROJECT_ID,
    tablesDetected,
    tablesMissing,
    lastChecked: new Date().toISOString(),
    error: connectionError
  };
}

export async function syncTableToSupabase(tableName: string, dataArray: any[]): Promise<{ success: boolean; count: number; error?: string }> {
  if (!dataArray || dataArray.length === 0) {
    return { success: true, count: 0 };
  }
  const client = getSupabaseServerClient();
  try {
    // Map object properties to DB columns if needed
    let recordsToUpsert = dataArray;
    if (tableName === 'students') {
      recordsToUpsert = dataArray.map(s => ({
        id: s.id,
        usn: s.usn,
        name: s.name,
        email: s.email,
        department: s.department,
        semester: s.semester,
        section: s.section,
        password: s.password,
        profile_photo: s.profilePhoto || '',
        attendance_percentage: s.attendancePercentage || 100
      }));
    } else if (tableName === 'lecturers') {
      recordsToUpsert = dataArray.map(l => ({
        id: l.id,
        lecturer_id: l.lecturerId,
        name: l.name,
        email: l.email,
        department: l.department,
        password: l.password,
        subjects: l.subjects || []
      }));
    } else if (tableName === 'subjects') {
      recordsToUpsert = dataArray.map(sub => ({
        subject_code: sub.subjectCode,
        subject_name: sub.subjectName,
        semester: sub.semester,
        department: sub.department
      }));
    } else if (tableName === 'timetable') {
      recordsToUpsert = dataArray.map(t => ({
        id: t.id,
        day: t.day,
        time: t.time,
        subject: t.subject,
        lecturer: t.lecturer,
        room: t.room,
        time_start: t.timeStart || '',
        time_end: t.timeEnd || '',
        lecturer_id: t.lecturerId || '',
        lecturer_name: t.lecturerName || '',
        department: t.department || '',
        semester: t.semester || ''
      }));
    } else if (tableName === 'attendance') {
      recordsToUpsert = dataArray.map(a => ({
        id: a.id,
        timetable_slot_id: a.timetableSlotId || '',
        student_id: a.studentId || '',
        student_name: a.studentName || '',
        student_usn: a.studentUsn,
        subject_code: a.subjectCode,
        date: a.date,
        status: a.status,
        timestamp: a.timestamp || ''
      }));
    } else if (tableName === 'face_profiles') {
      recordsToUpsert = dataArray.map(fp => ({
        id: fp.id,
        student_id: fp.studentId,
        student_name: fp.studentName,
        usn: fp.usn,
        department: fp.department,
        registration_date: fp.registrationDate,
        face_images: fp.faceImages || [],
        face_descriptors: fp.faceDescriptors || []
      }));
    }

    const { error } = await client.from(tableName).upsert(recordsToUpsert);
    if (error) {
      return { success: false, count: 0, error: error.message };
    }
    return { success: true, count: recordsToUpsert.length };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Sync error' };
  }
}

export async function fetchTableFromSupabase<T>(tableName: string): Promise<{ data: T[] | null; error?: string }> {
  const client = getSupabaseServerClient();
  try {
    const { data, error } = await client.from(tableName).select('*');
    if (error) return { data: null, error: error.message };
    if (!data) return { data: [] };

    // Format back to app camelCase models
    let formatted: any[] = data;
    if (tableName === 'students') {
      formatted = data.map(s => ({
        id: s.id,
        usn: s.usn,
        name: s.name,
        email: s.email,
        department: s.department,
        semester: s.semester,
        section: s.section,
        password: s.password,
        profilePhoto: s.profile_photo || '',
        attendancePercentage: s.attendance_percentage || 100
      }));
    } else if (tableName === 'lecturers') {
      formatted = data.map(l => ({
        id: l.id,
        lecturerId: l.lecturer_id,
        name: l.name,
        email: l.email,
        department: l.department,
        password: l.password,
        subjects: l.subjects || []
      }));
    } else if (tableName === 'subjects') {
      formatted = data.map(sub => ({
        subjectCode: sub.subject_code,
        subjectName: sub.subject_name,
        semester: sub.semester,
        department: sub.department
      }));
    } else if (tableName === 'timetable') {
      formatted = data.map(t => ({
        id: t.id,
        day: t.day,
        time: t.time,
        subject: t.subject,
        lecturer: t.lecturer,
        room: t.room,
        timeStart: t.time_start,
        timeEnd: t.time_end,
        lecturerId: t.lecturer_id,
        lecturerName: t.lecturer_name,
        department: t.department,
        semester: t.semester
      }));
    } else if (tableName === 'attendance') {
      formatted = data.map(a => ({
        id: a.id,
        timetableSlotId: a.timetable_slot_id,
        studentId: a.student_id,
        studentName: a.student_name,
        studentUsn: a.student_usn,
        subjectCode: a.subject_code,
        date: a.date,
        status: a.status,
        timestamp: a.timestamp
      }));
    } else if (tableName === 'face_profiles') {
      formatted = data.map(fp => ({
        id: fp.id,
        studentId: fp.student_id,
        studentName: fp.student_name,
        usn: fp.usn,
        department: fp.department,
        registrationDate: fp.registration_date,
        faceImages: fp.face_images || [],
        faceDescriptors: fp.face_descriptors || []
      }));
    }

    return { data: formatted as T[] };
  } catch (err: any) {
    return { data: null, error: err?.message || 'Fetch error' };
  }
}
