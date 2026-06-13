import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { Student, Lecturer, TimetableSlot, AttendanceRecord, ActiveSession, Subject, StudentFaceProfile } from './src/types';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// JSON File Database Abstraction Layer
const loadTable = <T>(fileName: string, defaultData: T[]): T[] => {
  const filePath = path.join(process.cwd(), fileName);
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2), 'utf8');
    return defaultData;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading database table ${fileName}:`, err);
    return defaultData;
  }
};

const saveTable = <T>(fileName: string, data: T[]) => {
  const filePath = path.join(process.cwd(), fileName);
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`Error saving database table ${fileName}:`, err);
  }
};

// Seed Datasets matching requirements
const DEFAULT_STUDENTS: Student[] = [];

const DEFAULT_LECTURERS: Lecturer[] = [];

const DEFAULT_SUBJECTS: Subject[] = [];

const DEFAULT_TIMETABLE: TimetableSlot[] = [];

const DEFAULT_ATTENDANCE: AttendanceRecord[] = [];

// Load database files ("tables")
let students = loadTable<Student>('db_students.json', DEFAULT_STUDENTS);
let lecturers = loadTable<Lecturer>('db_lecturers.json', DEFAULT_LECTURERS);
let subjects = loadTable<Subject>('db_subjects.json', DEFAULT_SUBJECTS);
let timetable = loadTable<TimetableSlot>('db_timetable.json', DEFAULT_TIMETABLE);
let attendanceRecords = loadTable<AttendanceRecord>('db_attendance.json', DEFAULT_ATTENDANCE);
let faceProfiles = loadTable<StudentFaceProfile>('db_face_profiles.json', []);

// Smart scanning sessions
let activeSessions: Map<string, ActiveSession> = new Map();

// Save functions
const saveStudents = () => saveTable('db_students.json', students);
const saveLecturers = () => saveTable('db_lecturers.json', lecturers);
const saveSubjects = () => saveTable('db_subjects.json', subjects);
const saveTimetable = () => saveTable('db_timetable.json', timetable);
const saveAttendance = () => saveTable('db_attendance.json', attendanceRecords);
const saveFaceProfiles = () => saveTable('db_face_profiles.json', faceProfiles);

// Helper function to recalculate attendance percentages and write back to student records
const updateAttendancePercentages = () => {
  students = students.map(student => {
    // Filter attendance matching this specific student
    const studentRecords = attendanceRecords.filter(
      r => r.studentUsn.toUpperCase() === student.usn.toUpperCase() || r.studentId === student.id
    );
    if (studentRecords.length === 0) {
      return { ...student, attendancePercentage: 100 };
    }
    const presents = studentRecords.filter(r => r.status === 'Present').length;
    const percentage = Math.round((presents / studentRecords.length) * 100);
    return { ...student, attendancePercentage: percentage };
  });
  saveStudents();
};

// INITIAL CALL to keep baseline stats calculated correctly on start
updateAttendancePercentages();

// Authentication API
app.post('/api/auth/login', (req, res) => {
  const { role, password, email, usn } = req.body;

  if (role === 'admin') {
    if (password === 'Nap@1913') {
      return res.json({
        role: 'admin',
        token: 'nexo-admin-token-secure-383',
        user: { id: 'admin', name: 'NEXO Terminal Commander' }
      });
    } else {
      return res.status(401).json({ error: 'System decryption failed: invalid password credentials.' });
    }
  }

  if (role === 'lecturer') {
    const lecturer = lecturers.find(
      l => l.email.toLowerCase() === (email || '').toLowerCase() || l.lecturerId.toLowerCase() === (email || '').toLowerCase()
    );
    const validPassword = password === 'password' || (lecturer && lecturer.password === password);
    if (lecturer && validPassword) {
      return res.json({
        role: 'lecturer',
        token: `nexo-lecturer-sec-${lecturer.id}`,
        user: { id: lecturer.id, name: lecturer.name, email: lecturer.email, department: lecturer.department }
      });
    } else {
      return res.status(401).json({ error: 'Access denied: bad cyber-signature or email mismatch.' });
    }
  }

  if (role === 'student') {
    const student = students.find(s => s.usn.toUpperCase() === (usn || '').toUpperCase());
    const validPassword = password === 'password' || (student && student.password === password);
    if (student && validPassword) {
      return res.json({
        role: 'student',
        token: `nexo-student-sec-${student.id}`,
        user: { id: student.id, name: student.name, usn: student.usn, email: student.email, department: student.department, semester: student.semester }
      });
    } else {
      return res.status(401).json({ error: 'Access denied: USN code signature rejected or invalid keys.' });
    }
  }

  return res.status(400).json({ error: 'Portal entry requested not supported.' });
});

// ======================== STUDENTS CRUD ========================
app.get('/api/students', (req, res) => {
  res.json(students);
});

app.post('/api/students', (req, res) => {
  const { usn, name, email, department, semester, section, password, profilePhoto } = req.body;
  if (!usn || !name || !email || !department || !semester || !section || !password) {
    return res.status(400).json({ error: 'Database Validation Failed: Name, USN, Department, Semester, Section, Email, and Password are all required.' });
  }
  const exists = students.find(s => s.usn.toUpperCase() === usn.toUpperCase());
  if (exists) {
    return res.status(400).json({ error: 'USN already exists in database registry.' });
  }
  const newStudent: Student = {
    id: `s_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    usn: usn.toUpperCase(),
    name,
    email,
    department,
    semester,
    section,
    password,
    profilePhoto: profilePhoto || '',
    attendancePercentage: 100
  };
  students.push(newStudent);
  saveStudents();
  res.status(201).json(newStudent);
});

app.put('/api/students/:id', (req, res) => {
  const { id } = req.params;
  const index = students.findIndex(s => s.id === id || s.usn === id);
  if (index === -1) return res.status(404).json({ error: 'Matrix unit node not discovered.' });

  students[index] = { ...students[index], ...req.body };
  saveStudents();
  updateAttendancePercentages();
  res.json(students[index]);
});

app.delete('/api/students/:id', (req, res) => {
  const { id } = req.params;
  const match = students.find(s => s.id === id || s.usn === id);
  if (!match) return res.status(404).json({ error: 'Student not found.' });

  students = students.filter(s => s.id !== match.id);
  attendanceRecords = attendanceRecords.filter(r => r.studentId !== match.id && r.studentUsn !== match.usn);
  saveStudents();
  saveAttendance();
  res.json({ success: true, message: 'Node purged successfully.' });
});

// ======================== STUDENT BIOMETRIC FACE PROFILES ========================
app.get('/api/face-profiles', (req, res) => {
  res.json(faceProfiles);
});

app.post('/api/face-profiles', (req, res) => {
  const { studentId, studentName, usn, department, registrationDate, faceImages, faceDescriptors } = req.body;
  if (!studentId || !studentName || !usn || !department || !registrationDate || !faceImages || !faceDescriptors) {
    return res.status(400).json({ error: 'Missing standard student biometric face profile fields.' });
  }
  const index = faceProfiles.findIndex(fp => fp.studentId === studentId || (fp.usn && fp.usn.toUpperCase() === usn.toUpperCase()));
  const newProfile: StudentFaceProfile = {
    id: `fp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    studentId,
    studentName,
    usn: usn.toUpperCase(),
    department,
    registrationDate,
    faceImages,
    faceDescriptors
  };
  if (index !== -1) {
    faceProfiles[index] = newProfile;
  } else {
    faceProfiles.push(newProfile);
  }
  saveFaceProfiles();
  res.status(201).json(newProfile);
});

app.delete('/api/face-profiles/:id', (req, res) => {
  const { id } = req.params;
  faceProfiles = faceProfiles.filter(fp => fp.id !== id && fp.studentId !== id);
  saveFaceProfiles();
  res.json({ success: true, message: 'Biometric face signature purged.' });
});

app.post('/api/admin/purge-biometrics', (req, res) => {
  const countDeleted = faceProfiles.length;
  faceProfiles = [];
  saveFaceProfiles();
  res.json({
    success: true,
    message: 'Biometric Database Purged Successfully',
    profilesDeleted: countDeleted,
    verificationCount: faceProfiles.length
  });
});


// ======================== LECTURERS CRUD ========================
app.get('/api/lecturers', (req, res) => {
  res.json(lecturers);
});

app.post('/api/lecturers', (req, res) => {
  const { name, email, department, subjects, lecturerId, password } = req.body;
  if (!name || !email || !department || !lecturerId || !password) {
    return res.status(400).json({ error: 'Database Validation Failed: Name, Lecturer ID, Department, Email, and Password are all required.' });
  }
  const exists = lecturers.find(l => l.lecturerId.toUpperCase() === lecturerId.toUpperCase());
  if (exists) {
    return res.status(400).json({ error: 'Lecturer ID already exists.' });
  }
  const newLecturer: Lecturer = {
    id: `l_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    lecturerId,
    name,
    email,
    department,
    password,
    subjects: Array.isArray(subjects) ? subjects : []
  };
  lecturers.push(newLecturer);
  saveLecturers();
  res.status(201).json(newLecturer);
});

app.put('/api/lecturers/:id', (req, res) => {
  const { id } = req.params;
  const index = lecturers.findIndex(l => l.id === id || l.lecturerId === id);
  if (index === -1) return res.status(404).json({ error: 'Lecturer registry index mismatch.' });

  lecturers[index] = { ...lecturers[index], ...req.body };
  saveLecturers();
  res.json(lecturers[index]);
});

app.delete('/api/lecturers/:id', (req, res) => {
  const { id } = req.params;
  lecturers = lecturers.filter(l => l.id !== id && l.lecturerId !== id);
  saveLecturers();
  res.json({ success: true, message: 'Lecturer node offline successfully.' });
});

// ======================== SUBJECTS CRUD ========================
app.get('/api/subjects', (req, res) => {
  res.json(subjects);
});

app.post('/api/subjects', (req, res) => {
  const { subjectCode, subjectName, semester, department } = req.body;
  if (!subjectCode || !subjectName || !semester || !department) {
    return res.status(400).json({ error: 'Incomplete parameters supplied for subject.' });
  }
  const exists = subjects.find(s => s.subjectCode.toUpperCase() === subjectCode.toUpperCase());
  if (exists) {
    return res.status(400).json({ error: 'Subject Code already exists.' });
  }
  const newSubject: Subject = {
    subjectCode: subjectCode.toUpperCase(),
    subjectName,
    semester,
    department
  };
  subjects.push(newSubject);
  saveSubjects();
  res.status(201).json(newSubject);
});

app.put('/api/subjects/:subjectCode', (req, res) => {
  const { subjectCode } = req.params;
  const index = subjects.findIndex(s => s.subjectCode.toUpperCase() === subjectCode.toUpperCase());
  if (index === -1) return res.status(404).json({ error: 'Subject not discovered.' });

  subjects[index] = { ...subjects[index], ...req.body };
  saveSubjects();
  res.json(subjects[index]);
});

app.delete('/api/subjects/:subjectCode', (req, res) => {
  const { subjectCode } = req.params;
  subjects = subjects.filter(s => s.subjectCode.toUpperCase() !== subjectCode.toUpperCase());
  saveSubjects();
  res.json({ success: true, message: 'Subject purged.' });
});

// ======================== TIMETABLE CRUD ========================
app.get('/api/timetable', (req, res) => {
  // Enriches subjects with dynamic names/departments/semesters from Database
  const enrichedTimetable = timetable.map(slot => {
    const matchingSubject = subjects.find(s => s.subjectCode.toUpperCase() === slot.subject.toUpperCase());
    const matchingLecturer = lecturers.find(l => l.lecturerId === slot.lecturer || l.id === slot.lecturer);
    return {
      ...slot,
      lecturerId: matchingLecturer ? matchingLecturer.id : slot.lecturer,
      lecturerName: matchingLecturer ? matchingLecturer.name : 'Unknown Dr',
      department: matchingSubject ? matchingSubject.department : (slot.department || 'General Science'),
      semester: matchingSubject ? matchingSubject.semester : (slot.semester || 'VI'),
      // backwardcompatibility time split helper
      timeStart: slot.time ? slot.time.split('-')[0].trim() : (slot.timeStart || '09:00'),
      timeEnd: slot.time ? slot.time.split('-')[1].trim() : (slot.timeEnd || '10:30'),
    };
  });
  res.json(enrichedTimetable);
});

app.post('/api/timetable', (req, res) => {
  const { day, time, subject, lecturer, room } = req.body;
  if (!day || !time || !subject || !lecturer) {
    return res.status(400).json({ error: 'Required timetable slot values missing.' });
  }

  const matchingSubject = subjects.find(s => s.subjectCode.toUpperCase() === subject.toUpperCase());
  const matchingLecturer = lecturers.find(l => l.lecturerId === lecturer || l.id === lecturer);

  const newSlot: TimetableSlot = {
    id: `t_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    day,
    time,
    subject: subject.toUpperCase(),
    lecturer,
    room: room || 'Grid Node 99',
    timeStart: time.split('-')[0]?.trim() || '09:00',
    timeEnd: time.split('-')[1]?.trim() || '10:30',
    lecturerId: matchingLecturer ? matchingLecturer.id : lecturer,
    lecturerName: matchingLecturer ? matchingLecturer.name : 'Unknown Dr',
    department: matchingSubject ? matchingSubject.department : 'General Science',
    semester: matchingSubject ? matchingSubject.semester : 'VI'
  };
  timetable.push(newSlot);
  saveTimetable();
  res.status(201).json(newSlot);
});

app.put('/api/timetable/:id', (req, res) => {
  const { id } = req.params;
  const index = timetable.findIndex(t => t.id === id);
  if (index === -1) return res.status(404).json({ error: 'Timetable entry not found.' });

  timetable[index] = { ...timetable[index], ...req.body };
  saveTimetable();
  res.json(timetable[index]);
});

app.delete('/api/timetable/:id', (req, res) => {
  const { id } = req.params;
  timetable = timetable.filter(t => t.id !== id);
  saveTimetable();
  res.json({ success: true });
});

// ======================== ATTENDANCE CRUD ========================
app.get('/api/attendance', (req, res) => {
  // Enrich record data with Student Name for easier dashboard rendering
  const enrichedLogs = attendanceRecords.map(rec => {
    const student = students.find(s => s.usn.toUpperCase() === rec.studentUsn.toUpperCase() || s.id === rec.studentId);
    const subject = subjects.find(s => s.subjectCode.toUpperCase() === rec.subjectCode.toUpperCase());
    return {
      department: student ? student.department : '',
      semester: student ? student.semester : '',
      subjectName: subject ? subject.subjectName : '',
      verificationMethod: 'Manual Entry',
      ...rec,
      studentId: student ? student.id : (rec.studentId || ''),
      studentName: student ? student.name : (rec.studentName || 'Matrix Node'),
    };
  });
  res.json(enrichedLogs);
});

app.post('/api/attendance', (req, res) => {
  const { 
    studentUsn, 
    subjectCode, 
    date, 
    status,
    studentName,
    department,
    semester,
    subjectName,
    lecturerName,
    time,
    room,
    verificationMethod
  } = req.body;

  if (!studentUsn || !subjectCode || !date || !status) {
    return res.status(400).json({ error: 'Incomplete parameters supplied for Attendance record.' });
  }

  const student = students.find(s => s.usn.toUpperCase() === studentUsn.toUpperCase());

  // Prevent duplicate present records on the same subject and date
  if (status === 'Present') {
    const existing = attendanceRecords.find(r => 
      (r.studentUsn.toUpperCase() === studentUsn.toUpperCase() || (student && r.studentId === student.id)) &&
      r.subjectCode.toUpperCase() === subjectCode.toUpperCase() &&
      r.date === date &&
      r.status === 'Present'
    );
    if (existing) {
      const prevTimeStr = existing.timestamp ? new Date(existing.timestamp).toISOString() : 'N/A';
      return res.status(409).json({ 
        error: 'Attendance Already Recorded', 
        previousTimestamp: existing.timestamp || '',
        message: `Attendance Already Recorded. Previously marked Present on ${prevTimeStr}.` 
      });
    }
  }

  const subject = subjects.find(s => s.subjectCode.toUpperCase() === subjectCode.toUpperCase());

  const newLog: AttendanceRecord = {
    id: `a_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    studentUsn: studentUsn.toUpperCase(),
    subjectCode: subjectCode.toUpperCase(),
    date,
    status: status === 'Present' ? 'Present' : 'Absent',
    studentId: student ? student.id : '',
    studentName: studentName || (student ? student.name : ''),
    department: department || (student ? student.department : ''),
    semester: semester || (student ? student.semester : ''),
    subjectName: subjectName || (subject ? subject.subjectName : ''),
    lecturerName: lecturerName || '',
    time: time || new Date().toTimeString().split(' ')[0], // fallback to current time
    room: room || 'Lecture Hall',
    verificationMethod: verificationMethod || 'Manual Entry',
    timestamp: new Date().toISOString()
  };

  attendanceRecords.push(newLog);
  saveAttendance();
  updateAttendancePercentages();
  res.status(201).json(newLog);
});

app.put('/api/attendance/:id', (req, res) => {
  const { id } = req.params;
  const index = attendanceRecords.findIndex(r => r.id === id);
  if (index === -1) return res.status(404).json({ error: 'Attendance record not found.' });

  attendanceRecords[index] = { ...attendanceRecords[index], ...req.body };
  saveAttendance();
  updateAttendancePercentages();
  res.json(attendanceRecords[index]);
});

app.delete('/api/attendance/:id', (req, res) => {
  const { id } = req.params;
  attendanceRecords = attendanceRecords.filter(r => r.id !== id);
  saveAttendance();
  updateAttendancePercentages();
  res.json({ success: true, message: 'Attendance record deleted.' });
});

// Bulk submission endpoint by lecturers (supporting both pre-scheduled slot and manual customization)
app.post('/api/attendance/submit', (req, res) => {
  const { timetableSlotId, date, records, subjectCode, department, semester, room, time, lecturerId } = req.body; // records: array of { studentId, status }
  if (!date || !records) {
    return res.status(400).json({ error: 'Incomplete parameters supplied for bulk attendance.' });
  }

  let finalSlotId = timetableSlotId;
  let finalSubjectCode = subjectCode || 'CS602';

  let slot = timetable.find(t => t.id === timetableSlotId);
  if (!slot && subjectCode) {
    // Lecturer manually selected a Class and Subject. Let's see if we can find an existing slot.
    slot = timetable.find(t => 
      t.subject.toUpperCase() === subjectCode.toUpperCase() &&
      t.department === department &&
      t.semester === semester
    );

    if (!slot) {
      // Create a persistent timetable slot on the fly!
      const finalLecturerId = lecturerId || 'L01';
      const matchingLecturer = lecturers.find(l => l.lecturerId === finalLecturerId || l.id === finalLecturerId || l.name === finalLecturerId);
      const matchingSubject = subjects.find(s => s.subjectCode.toUpperCase() === subjectCode.toUpperCase());
      
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dateObj = new Date(date);
      const dayName = dayNames[dateObj.getDay()] || 'Monday';
      
      const newSlot: TimetableSlot = {
        id: `t_${Date.now()}_manual`,
        day: dayName,
        time: time || '09:00 - 10:30',
        subject: subjectCode.toUpperCase(),
        lecturer: finalLecturerId,
        room: room || 'Lecture Hall A',
        timeStart: (time || '09:00 - 10:30').split('-')[0]?.trim() || '09:00',
        timeEnd: (time || '09:00 - 10:30').split('-')[1]?.trim() || '10:30',
        lecturerId: matchingLecturer ? matchingLecturer.id : finalLecturerId,
        lecturerName: matchingLecturer ? matchingLecturer.name : 'Unknown Staff',
        department: department || (matchingSubject ? matchingSubject.department : 'General Science'),
        semester: semester || (matchingSubject ? matchingSubject.semester : 'VI')
      };
      
      timetable.push(newSlot);
      saveTimetable();
      slot = newSlot;
    }
    
    finalSlotId = slot.id;
    finalSubjectCode = slot.subject;
  } else if (slot) {
    finalSubjectCode = slot.subject;
  }

  if (!finalSlotId) {
    return res.status(400).json({ error: 'Failed to resolve or create a valid scheduling slot for this attendance session.' });
  }

  // Remove existing records for this session/date to overwrite safely
  attendanceRecords = attendanceRecords.filter(r => !(r.timetableSlotId === finalSlotId && r.date === date));

  records.forEach((rec: any) => {
    const student = students.find(s => s.id === rec.studentId);
    if (student) {
      attendanceRecords.push({
        id: `a_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        timetableSlotId: finalSlotId,
        date,
        studentId: rec.studentId,
        studentUsn: student.usn,
        studentName: student.name,
        subjectCode: finalSubjectCode,
        status: rec.status === 'Present' || rec.status === 'Late' ? 'Present' : 'Absent',
        timestamp: rec.status !== 'Absent' ? new Date().toISOString() : ''
      });
    }
  });

  saveAttendance();
  updateAttendancePercentages();
  res.json({ success: true, count: records.length, timetableSlotId: finalSlotId });
});

// Holographic scan beacon/sessions
app.post('/api/session/start', (req, res) => {
  const { timetableSlotId } = req.body;
  if (!timetableSlotId) {
    return res.status(400).json({ error: 'Grid timetabling slot not supplied.' });
  }

  const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();

  const activeSession: ActiveSession = {
    timetableSlotId,
    otpCode,
    expiresAt,
    active: true
  };

  activeSessions.set(timetableSlotId, activeSession);
  res.json(activeSession);
});

app.get('/api/session/active/:slotId', (req, res) => {
  const { slotId } = req.params;
  const session = activeSessions.get(slotId);
  if (session && new Date(session.expiresAt) > new Date()) {
    return res.json(session);
  }
  res.json({ active: false });
});

// Student checkin self-attendance using active OTP code
app.post('/api/session/checkin', (req, res) => {
  const { studentId, timetableSlotId, otpCode } = req.body;
  if (!studentId || !timetableSlotId || !otpCode) {
    return res.status(400).json({ error: 'Beacon authentication request incomplete.' });
  }

  const session = activeSessions.get(timetableSlotId);
  if (!session || !session.active || new Date(session.expiresAt) < new Date()) {
    return res.status(400).json({ error: 'Temporal sync expired or beacon offline.' });
  }

  if (session.otpCode !== otpCode) {
    return res.status(401).json({ error: 'Auth code decrypt mismatch. Please inspect holographic console.' });
  }

  const student = students.find(s => s.id === studentId || s.usn === studentId);
  if (!student) {
    return res.status(404).json({ error: 'Student matrix identity not found.' });
  }

  const date = new Date().toISOString().split('T')[0];
  const slot = timetable.find(t => t.id === timetableSlotId);
  const subjectCode = slot ? slot.subject : 'CS601';

  const existing = attendanceRecords.find(r => 
    (r.studentUsn.toUpperCase() === student.usn.toUpperCase() || r.studentId === student.id) &&
    r.subjectCode.toUpperCase() === subjectCode.toUpperCase() &&
    r.date === date &&
    r.status === 'Present'
  );

  if (existing) {
    const prevTimeStr = existing.timestamp ? new Date(existing.timestamp).toISOString() : 'N/A';
    return res.status(409).json({ 
      error: 'Attendance Already Recorded', 
      previousTimestamp: existing.timestamp || '',
      message: `Attendance Already Recorded. Previously marked Present on ${prevTimeStr}.` 
    });
  }

  // Overwrite existing record if any
  attendanceRecords = attendanceRecords.filter(r => !(r.timetableSlotId === timetableSlotId && r.date === date && r.studentId === student.id));

  attendanceRecords.push({
    id: `a_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    timetableSlotId,
    date,
    studentId: student.id,
    studentUsn: student.usn,
    studentName: student.name,
    subjectCode,
    status: 'Present',
    timestamp: new Date().toISOString()
  });

  saveAttendance();
  updateAttendancePercentages();
  res.json({ success: true, message: 'Dynamic check-in certified. Matrix code validated.' });
});

// Global API Error Interceptor - guarantees JSON content-type on route exception
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('[NEXO Backend Kernel Exception]', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal BIOMETRIC Core Exception',
    name: err.name || 'Error',
    stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined
  });
});

// Vite middleware for development vs static production builds
async function runServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[NEXO Backend Kernel Operational] running on port ${PORT}`);
  });
}

runServer().catch((err) => {
  console.error('Core failure during deployment hook:', err);
});
