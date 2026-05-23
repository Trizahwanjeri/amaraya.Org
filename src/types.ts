/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Geofence {
  lat: number;
  lng: number;
  radius: number; // in meters
  locationName: string;
  level?: number; // 0 = Ground Floor, 1 = Floor 1, 2 = Floor 2
}

export interface Student {
  id: string;
  name: string;
  email: string;
  faceRegistered: boolean;
  avatarUrl?: string;
}

export interface Course {
  id: string;
  name: string;
  code: string;
  lecturer: string;
  schedule: string;
  enrolledStudents: string[]; // student ids
  geofence: Geofence;
  activeSession: boolean;
}

export interface AttendanceRecord {
  id: string;
  studentId: string;
  studentName: string;
  courseId: string;
  courseCode: string;
  courseName: string;
  timestamp: string; // ISO format from server
  status: 'Present' | 'Late' | 'Absent';
  verificationMethod: 'GPS + Fingerprint' | 'GPS + Facial Recognition' | 'GPS Only';
  distanceFromCenter: number; // in meters
  latitude: number;
  longitude: number;
  isHitAndRun: boolean;
  anomalyFlagged: boolean;
  anomalyReason?: string;
}

export interface AuditLog {
  id: string;
  timestamp: string;
  userType: 'Student' | 'Lecturer' | 'System';
  userId: string;
  userName: string;
  action: string;
  details: string;
  ipAddress?: string;
}

export interface SystemStats {
  totalStudents: number;
  activeSessions: number;
  presentToday: number;
  anomaliesDetected: number;
  averageAttendanceRate: number;
}
