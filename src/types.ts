export interface Student {
  id: string; // internal unique key
  usn: string;
  name: string;
  email: string;
  department: string;
  semester: string;
  section: string; // added per spec
  password?: string; // added per spec
  profilePhoto?: string; // added per spec (base64 or image url)
  attendancePercentage: number;
}

export interface Lecturer {
  id: string; // internal unique key
  lecturerId: string; // added per spec
  name: string;
  email: string;
  department: string;
  password?: string; // added per spec
  subjects: string[]; // array of subject codes
}

export interface Subject {
  subjectCode: string; // PK
  subjectName: string;
  semester: string;
  department: string;
}

export interface AttendanceRecord {
  id: string; // unique ID
  studentUsn: string; // USN code reference
  subjectCode: string; // Subject code reference
  date: string; // YYYY-MM-DD
  status: 'Present' | 'Absent'; // status restricted to Present/Absent
  studentId?: string; // compatibility key
  studentName?: string; // compatibility key
  timetableSlotId?: string; // compatibility key
  timestamp?: string; // compatibility ISO string
  department?: string;
  semester?: string;
  subjectName?: string;
  lecturerName?: string;
  time?: string;
  room?: string;
  verificationMethod?: string;
}

export interface TimetableSlot {
  id: string;
  subject: string; // links to subjectCode
  lecturer: string; // links to lecturerId
  day: string; // "Monday", etc.
  time: string; // "09:00 - 10:30"
  room: string;
  
  // compatibility helpers
  timeStart?: string; 
  timeEnd?: string;
  lecturerId?: string; 
  lecturerName?: string;
  department?: string; 
  semester?: string;
}

export interface ActiveSession {
  timetableSlotId: string;
  otpCode: string;
  expiresAt: string; // ISO String
  active: boolean;
}

export type UserRole = 'admin' | 'lecturer' | 'student';

export interface UserSession {
  role: UserRole;
  token: string;
  user: {
    id: string;
    name: string;
    email?: string;
    usn?: string;
    department?: string;
    semester?: string;
  };
}

export const DEPARTMENTS = [
  'Computer Science Engineering (CSE)',
  'Information Science Engineering (ISE)',
  'Electronics and Communication Engineering (ECE)',
  'Aeronautical Engineering (AE)'
];

export const SEMESTERS = ['1', '2', '3', '4', '5', '6', '7', '8'];

export const SECTIONS = ['A Section', 'B Section', 'C Section'];

export interface StudentFaceProfile {
  id?: string; // Optional database table ID
  studentId: string;
  studentName: string;
  usn: string;
  department: string;
  registrationDate: string;
  faceImages: string[];
  faceDescriptors: number[][];
}

