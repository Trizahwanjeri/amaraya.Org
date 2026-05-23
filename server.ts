/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { Course, Student, AttendanceRecord, AuditLog, Geofence, SystemStats } from "./src/types.js";

// Utility: Haversine distance formula in meters (Core Geospatial Processing Module - Section 3.2)
function getHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Radius of the earth in meters
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

// In-Memory Database State representing tables (Data Storage - Section 3.4)
const DEFAULT_COURSES: Course[] = [
  {
    id: "CS-301",
    name: "Advanced Software Engineering",
    code: "CS-301",
    lecturer: "Dr. Charles Xavier",
    schedule: "Mon/Wed 10:00 AM - 12:00 PM",
    enrolledStudents: ["S101", "S102", "S103", "S104"],
    activeSession: true,
    geofence: {
      lat: 6.4468,
      lng: 3.4852,
      radius: 50, // 50 meters
      locationName: "Lecture Hall B",
      level: 1, // Floor 1
    },
  },
  {
    id: "CE-412",
    name: "Geospatial Information Systems",
    code: "CE-412",
    lecturer: "Prof. Minerva McGonagall",
    schedule: "Tue/Thu 2:00 PM - 4:00 PM",
    enrolledStudents: ["S101", "S103", "S104"],
    activeSession: false,
    geofence: {
      lat: 6.4475,
      lng: 3.4860,
      radius: 40,
      locationName: "Science Lab F",
      level: 2, // Floor 2
    },
  },
  {
    id: "CS-322",
    name: "Mobile Application Development",
    code: "CS-322",
    lecturer: "Dr. Charles Xavier",
    schedule: "Wed/Fri 1:00 PM - 3:00 PM",
    enrolledStudents: ["S101", "S102", "S104"],
    activeSession: true,
    geofence: {
      lat: 6.4455,
      lng: 3.4841,
      radius: 80,
      locationName: "Main Auditorium",
      level: 0, // Ground Floor
    },
  },
];

const DEFAULT_STUDENTS: Student[] = [
  {
    id: "S101",
    name: "Alice Cooper",
    email: "alice@university.edu",
    faceRegistered: true,
    avatarUrl: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=120",
  },
  {
    id: "S102",
    name: "Marcus Aurelius",
    email: "marcus@university.edu",
    faceRegistered: true,
    avatarUrl: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=120",
  },
  {
    id: "S103",
    name: "Chloe Bennett",
    email: "chloe@university.edu",
    faceRegistered: false,
    avatarUrl: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&q=80&w=120",
  },
  {
    id: "S104",
    name: "Dev Patel",
    email: "dev@university.edu",
    faceRegistered: true,
    avatarUrl: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=120",
  },
];

let courses: Course[] = JSON.parse(JSON.stringify(DEFAULT_COURSES));
let students: Student[] = JSON.parse(JSON.stringify(DEFAULT_STUDENTS));
let attendanceRecords: AttendanceRecord[] = [
  {
    id: "R-001",
    studentId: "S102",
    studentName: "Marcus Aurelius",
    courseId: "CS-301",
    courseCode: "CS-301",
    courseName: "Advanced Software Engineering",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
    status: "Present",
    verificationMethod: "GPS + Facial Recognition",
    distanceFromCenter: 12.5,
    latitude: 6.44685,
    longitude: 3.48515,
    isHitAndRun: false,
    anomalyFlagged: false,
  },
  {
    id: "R-002",
    studentId: "S104",
    studentName: "Dev Patel",
    courseId: "CS-301",
    courseCode: "CS-301",
    courseName: "Advanced Software Engineering",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
    status: "Present",
    verificationMethod: "GPS + Fingerprint",
    distanceFromCenter: 44.2,
    latitude: 6.44715,
    longitude: 3.4849,
    isHitAndRun: false,
    anomalyFlagged: false,
  },
];

let auditLogs: AuditLog[] = [
  {
    id: "L-001",
    timestamp: new Date(Date.now() - 3600000 * 24.1).toISOString(),
    userType: "System",
    userId: "SYSTEM",
    userName: "System Daemon",
    action: "SYSTEM_INITIALIZATION",
    details: "Geo Attend Monitor backend initialized with default course geofences.",
  },
  {
    id: "L-002",
    timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
    userType: "Lecturer",
    userId: "L501",
    userName: "Dr. Charles Xavier",
    action: "CLASS_SESSION_OPENED",
    details: "Opened CS-301 session at Lecture Hall B (Radius: 50m).",
  },
];

// Helper to push audit logs (Audit Log Module - Section 4.2)
function createAuditLog(userType: 'Student' | 'Lecturer' | 'System', userId: string, userName: string, action: string, details: string) {
  const log: AuditLog = {
    id: `L-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
    timestamp: new Date().toISOString(),
    userType,
    userId,
    userName,
    action,
    details,
  };
  auditLogs.unshift(log);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // -- API REST GATEWAY (Section 3.1) --

  // Clear or Reset Database
  app.post("/api/reset", (req, res) => {
    courses = JSON.parse(JSON.stringify(DEFAULT_COURSES));
    students = JSON.parse(JSON.stringify(DEFAULT_STUDENTS));
    attendanceRecords = [
      {
        id: "R-001",
        studentId: "S102",
        studentName: "Marcus Aurelius",
        courseId: "CS-301",
        courseCode: "CS-301",
        courseName: "Advanced Software Engineering",
        timestamp: new Date(Date.now() - 3600000 * 24).toISOString(),
        status: "Present",
        verificationMethod: "GPS + Facial Recognition",
        distanceFromCenter: 12.5,
        latitude: 6.44685,
        longitude: 3.48515,
        isHitAndRun: false,
        anomalyFlagged: false,
      }
    ];
    auditLogs = [];
    createAuditLog("System", "SYSTEM", "System Daemon", "SYSTEM_RESET", "Demo environment reset to standard default geofences and schedules.");
    res.json({ success: true, message: "Systems reset successfully" });
  });

  // Get Courses & Geofences
  app.get("/api/courses", (req, res) => {
    res.json(courses);
  });

  // Create course & geofence (Class & Geo-fence Management - Section 2.2)
  app.post("/api/courses", (req, res) => {
    const { code, name, lecturer, schedule, lat, lng, radius, locationName, level, authorId, authorName } = req.body;
    if (!code || !name || !lecturer || !lat || !lng || !radius) {
      return res.status(400).json({ error: "Missing required fields for Geofenced Course setup" });
    }

    const newCourse: Course = {
      id: code.toUpperCase(),
      code: code.toUpperCase(),
      name,
      lecturer,
      schedule: schedule || "TBD",
      enrolledStudents: ["S101", "S102", "S103", "S104"],
      activeSession: true,
      geofence: {
        lat: Number(lat),
        lng: Number(lng),
        radius: Number(radius),
        locationName: locationName || "Custom Geozone",
        level: level !== undefined ? Number(level) : 0,
      },
    };

    courses.push(newCourse);
    createAuditLog(
      "Lecturer",
      authorId || "L501",
      authorName || lecturer,
      "GEOFENCE_CREATED",
      `Configured geofence for ${newCourse.code} at ${newCourse.geofence.locationName} (Radius: ${newCourse.geofence.radius}m).`
    );

    res.status(201).json(newCourse);
  });

  // Toggle active session
  app.post("/api/courses/:id/toggle-session", (req, res) => {
    const { id } = req.params;
    const { enabled, lecturerName, lecturerId } = req.body;
    const course = courses.find((c) => c.id === id);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }

    course.activeSession = enabled;
    createAuditLog(
      "Lecturer",
      lecturerId || "L501",
      lecturerName || "Lecturer",
      enabled ? "CLASS_SESSION_OPENED" : "CLASS_SESSION_CLOSED",
      `${enabled ? "Opened" : "Closed"} attendance check-in window for ${course.code}.`
    );

    res.json({ success: true, course });
  });

  // Get Students list
  app.get("/api/students", (req, res) => {
    res.json(students);
  });

  // Enrollment management
  app.post("/api/courses/:id/enroll", (req, res) => {
    const { id } = req.params;
    const { studentId } = req.body;
    const course = courses.find((c) => c.id === id);
    if (!course) return res.status(404).json({ error: "Course not found" });

    if (!course.enrolledStudents.includes(studentId)) {
      course.enrolledStudents.push(studentId);
      createAuditLog("Lecturer", "L501", "Dr. Charles Xavier", "STUDENT_ENROLLED", `Enrolled Student ${studentId} in course ${course.code}`);
    }
    res.json({ success: true, course });
  });

  // Get Attendance List
  app.get("/api/attendance", (req, res) => {
    res.json(attendanceRecords);
  });

  // Core Attendance Action check-in (Attendance Action Module - Section 1.3 & 3.3)
  app.post("/api/attendance/check-in", (req, res) => {
    const { studentId, courseId, latitude, longitude, verificationMethod } = req.body;
    
    if (!studentId || !courseId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "Missing identity coordinates or student ID" });
    }

    const student = students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const course = courses.find((c) => c.id === courseId);
    if (!course) return res.status(404).json({ error: "Active course not found" });

    if (!course.activeSession) {
      return res.status(400).json({ error: "Attendance session is currently closed for this class." });
    }

    // Geofence Validation logic (Section 1.2 & 3.2)
    const distance = getHaversineDistance(
      Number(latitude),
      Number(longitude),
      course.geofence.lat,
      course.geofence.lng
    );

    let isLate = false;
    const currentHour = new Date().getHours();
    // Simple rule: if classes typically start early and checking in during late hours, let's flag as Late just for immersive dashboard variety
    if (currentHour >= 12) {
      isLate = true;
    }

    const insideGeofence = distance <= course.geofence.radius;
    let anomalyFlagged = false;
    let anomalyReason = "";

    // Device placement / Buddy Punching anomaly detection
    if (!insideGeofence) {
      anomalyFlagged = true;
      anomalyReason = `PROXIMITY_VIOLATION: Attempted check-in ${distance.toFixed(1)}m outside boundary limit (${course.geofence.radius}m).`;
    }

    // Prevent double logins for the same course session (simple checks)
    const existingSelf = attendanceRecords.find(r => r.studentId === studentId && r.courseId === courseId && !r.isHitAndRun);
    if (existingSelf) {
      return res.status(400).json({ error: "You have already logged a valid check-in for this session today!" });
    }

    // Record creation
    const record: AttendanceRecord = {
      id: `R-${Math.random().toString(36).substr(2, 9).toUpperCase()}`,
      studentId: student.id,
      studentName: student.name,
      courseId: course.id,
      courseCode: course.code,
      courseName: course.name,
      timestamp: new Date().toISOString(), // Secure server-side timestamping (Section 1.3)
      status: insideGeofence ? (isLate ? 'Late' : 'Present') : 'Absent',
      verificationMethod: verificationMethod || 'GPS + Facial Recognition',
      distanceFromCenter: Number(distance),
      latitude: Number(latitude),
      longitude: Number(longitude),
      isHitAndRun: false,
      anomalyFlagged,
      anomalyReason: anomalyFlagged ? anomalyReason : undefined,
    };

    attendanceRecords.unshift(record);

    // Logging to audit logs
    createAuditLog(
      "Student",
      student.id,
      student.name,
      anomalyFlagged ? "ATTENDANCE_FAILED_ANOMALY" : "ATTENDANCE_RECORDED",
      anomalyFlagged 
        ? `Failed geofence rules. Distance: ${distance.toFixed(1)}m from ${course.geofence.locationName}.` 
        : `Successfully checked in to ${course.code} using ${record.verificationMethod}. (Distance: ${distance.toFixed(1)}m)`
    );

    res.json({
      success: insideGeofence,
      record,
      message: insideGeofence 
        ? `Attendance checked in successfully! (${distance.toFixed(1)}m to lecture center)`
        : `Check-in flagged: You are outside the designated boundary (${distance.toFixed(1)}m). Details logged for audit.`
    });
  });

  // Track coordinates and monitor exit / Hit-and-Run Fraud Detection Logic (Section 1.3, 1.6.2, 3.3)
  app.post("/api/attendance/update-location", (req, res) => {
    const { studentId, courseId, latitude, longitude } = req.body;
    
    if (!studentId || !courseId || latitude === undefined || longitude === undefined) {
      return res.status(400).json({ error: "No telemetry reported" });
    }

    const student = students.find((s) => s.id === studentId);
    if (!student) return res.status(404).json({ error: "Student not found" });

    const course = courses.find((c) => c.id === courseId);
    if (!course) return res.status(404).json({ error: "Course not found" });

    const distance = getHaversineDistance(
      Number(latitude),
      Number(longitude),
      course.geofence.lat,
      course.geofence.lng
    );

    // Check if student has a Present/Late attendance record for this class that was clean
    const recordIndex = attendanceRecords.findIndex(
      (r) => r.studentId === studentId && r.courseId === courseId && !r.isHitAndRun
    );

    if (recordIndex !== -1) {
      const record = attendanceRecords[recordIndex];
      // If the student goes beyond geofence limit, trigger Hit-and-Run
      const wentOutside = distance > course.geofence.radius;

      if (wentOutside && !record.isHitAndRun) {
        // Flag hit-and-run
        record.isHitAndRun = true;
        record.anomalyFlagged = true;
        record.status = 'Absent'; // Invalidate attendance
        record.anomalyReason = `HIT_AND_RUN_DETECTION: Checked-in student left geo-boundary prematurely. Left ${new Date().toLocaleTimeString()} (Detected distance: ${distance.toFixed(1)}m outwards).`;
        
        createAuditLog(
          "System",
          studentId,
          student.name,
          "FRAUD_ALARM_HIT_AND_RUN",
          `Anomalous telemetry for ${student.name}: Exited boundary for ${course.code} early. Dist: ${distance.toFixed(1)}m.`
        );

        return res.json({
          hitAndRunTriggered: true,
          distance,
          message: "HIT-AND-RUN ALARM: Telemetry indicates you exited the active lecture geofence. Attendance status revoked."
        });
      }
    }

    res.json({
      hitAndRunTriggered: false,
      distance
    });
  });

  // Get Audit Trail Logs
  app.get("/api/audit-logs", (req, res) => {
    res.json(auditLogs);
  });

  // Summary statistics for the Dashboard (Reporting & Analytics Module - Section 2.4)
  app.get("/api/stats", (req, res) => {
    const activeSessionsCount = courses.filter((c) => c.activeSession).length;
    const cleanPresent = attendanceRecords.filter((r) => r.status !== 'Absent' && !r.isHitAndRun).length;
    const anomalies = attendanceRecords.filter((r) => r.anomalyFlagged).length;

    let averageRate = 85; 
    if (attendanceRecords.length > 0) {
      const successful = attendanceRecords.filter(r => r.status === 'Present' || r.status === 'Late').length;
      averageRate = Math.round((successful / attendanceRecords.length) * 100);
    }

    const stats: SystemStats = {
      totalStudents: students.length,
      activeSessions: activeSessionsCount,
      presentToday: cleanPresent,
      anomaliesDetected: anomalies,
      averageAttendanceRate: averageRate,
    };
    res.json(stats);
  });

  // -- VITE MULTI-MODE INTEGRATION (Section 3) --
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[GEO-ATTEND] Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
