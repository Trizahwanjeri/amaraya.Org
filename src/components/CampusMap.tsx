/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useMemo, useState, useRef } from 'react';
import { Course, Geofence } from '../types.js';
import { Navigation, MapPin, Radio, Minimize2, Crosshair, ZoomIn, ZoomOut } from 'lucide-react';

interface CampusMapProps {
  courses: Course[];
  studentLocation: { lat: number; lng: number } | null;
  onSelectLocation?: (lat: number, lng: number) => void;
  activeCourseId?: string;
  pins?: Array<{ studentId: string; name: string; lat: number; lng: number; isHitAndRun?: boolean }>;
  interactive?: boolean;
}

// Fixed coordinate bounding box for the University Campus blueprint
export const CAMPUS_BOUNDS = {
  latMin: 6.4440,
  latMax: 6.4490,
  lngMin: 3.4830,
  lngMax: 3.4875,
};

export default function CampusMap({
  courses,
  studentLocation,
  onSelectLocation,
  activeCourseId,
  pins = [],
  interactive = true,
}: CampusMapProps) {
  const { latMin, latMax, lngMin, lngMax } = CAMPUS_BOUNDS;

  // --- ZOOM & PAN INTERACTIVE STATE PANEL ---
  const [zoom, setZoom] = useState(1.0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<number>(0); // 0 = Ground Floor, 1 = Floor 1, 2 = Floor 2

  // Drag telemetry references
  const dragStart = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const dragged = useRef(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Convert GPS (Lat, Lng) to SVG percentage coordinates (X, Y)
  const toXY = useMemo(() => {
    return (lat: number, lng: number) => {
      const x = ((lng - lngMin) / (lngMax - lngMin)) * 100; // mapped to %
      const y = (1 - (lat - latMin) / (latMax - latMin)) * 100; // mapped to %, inverted lat
      return { x, y };
    };
  }, [latMin, latMax, lngMin, lngMax]);

  // Clamps panning translation to keep the map inside the relative aspect window bounds
  const clampPan = (x: number, y: number, currentZoom: number) => {
    if (currentZoom <= 1.0) {
      return { x: 0, y: 0 };
    }
    // Translation boundaries: scaled width is zoom * 100%, offset moves [-(zoom-1)*100%, 0%]
    const minX = -(currentZoom - 1) * 100;
    const minY = -(currentZoom - 1) * 100;
    return {
      x: Math.min(0, Math.max(minX, x)),
      y: Math.min(0, Math.max(minY, y)),
    };
  };

  // Preset location centers (relative percentage coordinates cx, cy in SVG space)
  const presets = [
    { name: 'Full Campus', zoom: 1.0, cx: 50, cy: 50 },
    { name: 'The Quad', zoom: 2.0, cx: 47, cy: 42 },
    { name: 'Lecture Hall B', zoom: 2.4, cx: 77, cy: 26 },
    { name: 'Auditorium', zoom: 2.0, cx: 50, cy: 82 },
  ];

  // Apply a focal center camera preset
  const applyPreset = (zoomVal: number, cx: number, cy: number) => {
    setZoom(zoomVal);
    setPan(clampPan(50 - cx * zoomVal, 50 - cy * zoomVal, zoomVal));
  };

  // Zoom manipulation controls
  const handleZoomIn = () => {
    setZoom((z) => {
      const nextZ = Math.min(3.0, z + 0.5);
      // Zoom centered on existing viewport coordinate center (50, 50)
      setPan((p) => {
        const nextX = p.x - 25; 
        const nextY = p.y - 25;
        return clampPan(nextX, nextY, nextZ);
      });
      return nextZ;
    });
  };

  const handleZoomOut = () => {
    setZoom((z) => {
      const nextZ = Math.max(1.0, z - 0.5);
      setPan((p) => {
        if (nextZ === 1.0) return { x: 0, y: 0 };
        const nextX = p.x + 25;
        const nextY = p.y + 25;
        return clampPan(nextX, nextY, nextZ);
      });
      return nextZ;
    });
  };

  const handleReset = () => {
    setZoom(1.0);
    setPan({ x: 0, y: 0 });
  };

  // Drag interaction handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return; // Left mouse click only
    setIsDragging(true);
    dragStart.current = { x: e.clientX, y: e.clientY };
    panStart.current = { ...pan };
    dragged.current = false;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;

    // Use current bounds to transform screen-pixel movement to SVG percentage units
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) {
      // rect.width represents the scaled dimensions. Converting offsets directly matches pixels.
      const dxPct = (dx / rect.width) * 100 * zoom; 
      const dyPct = (dy / rect.height) * 100 * zoom;

      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        dragged.current = true;
      }

      setPan(clampPan(panStart.current.x + dxPct, panStart.current.y + dyPct, zoom));
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(false);
    // If was dragging, do not trigger coordinate clicks
    if (dragged.current) return;

    if (!interactive || !onSelectLocation) return;
    
    // Convert click location relative to current transformed canvas layout bounds
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const lng = lngMin + (xPct / 100) * (lngMax - lngMin);
    const lat = latMin + (1 - yPct / 100) * (latMax - latMin);

    onSelectLocation(Number(lat.toFixed(6)), Number(lng.toFixed(6)));
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const simulatedStudentPos = useMemo(() => {
    if (!studentLocation) return null;
    return toXY(studentLocation.lat, studentLocation.lng);
  }, [studentLocation, toXY]);

  return (
    <div className="relative w-full aspect-[16/10] bg-[#0c1322] border border-slate-800 rounded-xl overflow-hidden shadow-inner font-sans select-none">
      
      {/* Zoomable & Pannable Viewport Wrapper */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        className="absolute inset-0 origin-top-left"
        style={{
          transform: `translate(${pan.x}%, ${pan.y}%) scale(${zoom})`,
          transition: isDragging ? 'none' : 'transform 240ms cubic-bezier(0.16, 1, 0.3, 1)',
          cursor: interactive ? (isDragging ? 'grabbing' : 'grab') : 'default',
        }}
      >
        {/* Decorative Blueprint Background Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4%_6.4%] opacity-20 pointer-events-none" />

        {/* Campus Landmark Vector Background Shapes (representing buildings) */}
        <svg
          className="absolute inset-0 w-full h-full select-none opacity-30 pointer-events-none"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Quadrangle park area */}
          <rect x="35" y="30" width="25" height="25" rx="2" fill="#152b21" stroke="#22c55e" strokeWidth="0.2" strokeDasharray="1 1" />
          <text x="47" y="43" fill="#4caf50" fontSize="2.2" textAnchor="middle" className="font-mono tracking-wider font-semibold">THE QUAD</text>

          {/* Science Complex Building outline (L2 highlight) */}
          <polygon
            points="12,15 25,15 25,32 20,32 20,22 12,22"
            fill={selectedLevel === 2 ? "rgba(14, 165, 233, 0.15)" : "#1e293b"}
            stroke={selectedLevel === 2 ? "#0ea5e9" : "#475569"}
            strokeWidth="0.3"
            className="transition-all duration-300"
          />
          {/* Science Lab F Center Pin point */}
          <circle cx="21" cy="20" r="0.5" fill={selectedLevel === 2 ? "#0ea5e9" : "#6366f1"} />

          {/* Administration and Hall B Outline (L1 highlight) */}
          <rect
            x="68" y="16" width="18" height="20" rx="1"
            fill={selectedLevel === 1 ? "rgba(99, 102, 241, 0.15)" : "#1e293b"}
            stroke={selectedLevel === 1 ? "#6366f1" : "#475569"}
            strokeWidth="0.3"
            className="transition-all duration-300"
          />
          
          {/* Main Auditorium Area (GF highlight) */}
          <polygon
            points="40,75 56,70 60,85 44,90"
            fill={selectedLevel === 0 ? "rgba(34, 197, 94, 0.15)" : "#1e293b"}
            stroke={selectedLevel === 0 ? "#22c55e" : "#475569"}
            strokeWidth="0.3"
            className="transition-all duration-300"
          />

          {/* Athletic fields outline */}
          <rect x="70" y="65" width="20" height="25" rx="5" fill="#0f172a" stroke="#334155" strokeWidth="0.25" />
          <line x1="70" y1="77.5" x2="90" y2="77.5" stroke="#334155" strokeWidth="0.2" strokeDasharray="1" />
        </svg>

        {/* Vector Interactive Grid & Markers Overlays */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          {/* Render Course Geofences Radius Circles - FILTERED BY SELECTED LEVEL */}
          {courses.filter(course => (course.geofence.level ?? 0) === selectedLevel).map((course) => {
            const { x, y } = toXY(course.geofence.lat, course.geofence.lng);
            const isActive = course.activeSession;
            const isSelected = activeCourseId === course.id;

            // Convert meter radius to coordinate percent representation (appx average scaling factor)
            const pctRadiusX = (course.geofence.radius / 500) * 100 * 0.77; 

            return (
              <g key={course.id}>
                {/* Pulsing Aura for active geofences */}
                {isActive && (
                  <circle
                    cx={x}
                    cy={y}
                    r={pctRadiusX}
                    fill={isSelected ? "rgba(34, 197, 94, 0.04)" : "rgba(99, 102, 241, 0.03)"}
                    stroke={isSelected ? "rgba(34, 197, 94, 0.4)" : "rgba(99, 102, 241, 0.25)"}
                    strokeWidth="0.6"
                    strokeDasharray="1.5 1.5"
                    className={isActive ? "animate-pulse" : ""}
                  />
                )}

                {/* Solid bounding circle */}
                <circle
                  cx={x}
                  cy={y}
                  r={pctRadiusX}
                  fill="none"
                  stroke={isActive ? (isSelected ? "#22c55e" : "#6366f1") : "#475569"}
                  strokeWidth={isSelected ? "0.4" : "0.25"}
                />

                {/* Center Tower Sensor */}
                <circle
                  cx={x}
                  cy={y}
                  r="0.8"
                  fill={isActive ? (isSelected ? "#22c55e" : "#6366f1") : "#475569"}
                />

                {/* Floating label inside SVG */}
                <text
                  x={x}
                  y={y - pctRadiusX - 1.5}
                  textAnchor="middle"
                  fill={isActive ? "#f8fafc" : "#94a3b8"}
                  fontSize="2.4"
                  fontWeight="600"
                  className="pointer-events-none uppercase font-mono tracking-tight text-shadow"
                >
                  {course.geofence.locationName} ({course.geofence.radius}m)
                </text>
              </g>
            );
          })}

          {/* Simulated Student current positioning circle */}
          {simulatedStudentPos && (
            <g>
              {/* Accuracy aura */}
              <circle
                cx={simulatedStudentPos.x}
                cy={simulatedStudentPos.y}
                r="3.5"
                fill="rgba(14, 165, 233, 0.15)"
                stroke="#0ea5e9"
                strokeWidth="0.15"
                className="animate-ping"
                style={{ transformOrigin: `${simulatedStudentPos.x}% ${simulatedStudentPos.y}%` }}
              />
              {/* GPS Core coordinate node */}
              <circle
                cx={simulatedStudentPos.x}
                cy={simulatedStudentPos.y}
                r="1.2"
                fill="#0ea5e9"
                stroke="#ffffff"
                strokeWidth="0.25"
              />
            </g>
          )}

          {/* Live Admin Student Pins (For real-time admin view) */}
          {pins.map((pin) => {
            const pinXY = toXY(pin.lat, pin.lng);
            return (
              <g key={pin.studentId}>
                {/* Pulse flag if student left early (Hit and run) */}
                <circle
                  cx={pinXY.x}
                  cy={pinXY.y}
                  r={pin.isHitAndRun ? "3" : "1.8"}
                  fill={pin.isHitAndRun ? "rgba(239, 68, 68, 0.25)" : "rgba(34, 197, 94, 0.2)"}
                  className="animate-pulse"
                  style={{ transformOrigin: `${pinXY.x}% ${pinXY.y}%` }}
                />
                <path
                  d={`M ${pinXY.x} ${pinXY.y} L ${pinXY.x - 1} ${pinXY.y - 3} L ${pinXY.x + 1} ${pinXY.y - 3} Z`}
                  fill={pin.isHitAndRun ? "#ef4444" : "#22c55e"}
                />
                <circle
                  cx={pinXY.x}
                  cy={pinXY.y - 3}
                  r="0.9"
                  fill={pin.isHitAndRun ? "#ef4444" : "#22c55e"}
                  stroke="#fff"
                  strokeWidth="0.15"
                />
                {/* Mini tag for student name */}
                <text
                  x={pinXY.x}
                  y={pinXY.y - 4.5}
                  textAnchor="middle"
                  fill={pin.isHitAndRun ? "#fca5a5" : "#86efac"}
                  fontSize="1.9"
                  fontWeight="500"
                  className="font-mono bg-slate-930 p-0.5 pointer-events-none text-shadow"
                >
                  {pin.name.split(' ')[0]} {pin.isHitAndRun ? '⚠️' : '✓'}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Floating GIS Viewport Controller Options (Static overlay, unaffected by zoom scale) */}
      <div className="absolute top-3 right-3 flex flex-col items-end gap-2 text-xs font-mono select-none z-10">
        {interactive && (
          <div className="flex items-center gap-1.5 pointer-events-none text-[10px] text-slate-400 bg-slate-900/95 border border-slate-800 px-2 py-1 rounded-lg backdrop-blur-sm shadow">
            <Crosshair className="w-3.5 h-3.5 animate-spin" />
            <span>Click Blueprint to position GPS</span>
          </div>
        )}
        
        {/* Navigation Compass readouts */}
        <div className="text-[10px] text-slate-400 bg-slate-900/95 border border-slate-800 px-2 py-1 rounded-lg backdrop-blur-sm shadow flex items-center gap-1.5">
          <span>Scale: {zoom.toFixed(1)}x</span>
          {zoom > 1.0 && <span className="text-blue-400 animate-pulse">● Zoomed</span>}
        </div>
      </div>

      {/* Map Legend Overlay (Static) */}
      <div className="absolute bottom-3 left-3 flex flex-wrap gap-2 text-[10px] font-mono select-none px-2 py-1.5 bg-[#0b0f19]/90 border border-slate-800 rounded-md z-10">
        <div className="flex items-center gap-1 text-emerald-400">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          <span>Active Geofence</span>
        </div>
        <div className="flex items-center gap-1 text-indigo-400">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500" />
          <span>Class Geozone</span>
        </div>
        <div className="flex items-center gap-1 text-sky-400">
          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
          <span>Your Device GPS</span>
        </div>
        <div className="flex items-center gap-1 text-rose-400">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
          <span>Hit-and-Run Fraud Alarm</span>
        </div>
      </div>

      {/* Sleek Horizontal Camera and Viewport Action Deck (Static bottom-right align) */}
      <div className="absolute bottom-3 right-3 flex flex-col items-end gap-2 select-none z-10 pointer-events-auto">
        
        {/* Zoom Controls Bar */}
        <div className="flex bg-slate-900/95 border border-slate-800 p-1 rounded-xl gap-1 shadow-lg backdrop-blur-sm">
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 3.0}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 hover:text-white transition-all cursor-pointer"
            title="Zoom In"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 1.0}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 hover:text-white transition-all cursor-pointer"
            title="Zoom Out"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleReset}
            disabled={zoom === 1.0}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:hover:bg-slate-800 text-slate-200 hover:text-white transition-all cursor-pointer"
            title="Fit Map bounds"
          >
            <Minimize2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Viewport Preset Pills */}
        <div className="flex gap-1 bg-slate-900/95 border border-slate-800 p-1 rounded-xl shadow-lg max-w-[280px] backdrop-blur-sm">
          {presets.map((preset) => (
            <button
              key={preset.name}
              onClick={() => applyPreset(preset.zoom, preset.cx, preset.cy)}
              className="text-[9px] font-mono px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap"
            >
              {preset.name}
            </button>
          ))}
        </div>
      </div>

      {/* GPS Coordinate Stats readout at top left (Static) */}
      <div className="absolute top-3 left-3 text-[10px] font-mono text-slate-300 bg-slate-900/95 border border-slate-800 px-2 py-1.5 rounded-lg flex flex-col gap-0.5 shadow z-10 backdrop-blur-sm">
        <span className="text-sky-400 font-semibold flex items-center gap-1">
          <Navigation className="w-3 h-3 text-sky-400" />
          GPS COORD MONITOR
        </span>
        {studentLocation ? (
          <>
            <span>Lat: {studentLocation.lat.toFixed(6)}°</span>
            <span>Lng: {studentLocation.lng.toFixed(6)}°</span>
          </>
        ) : (
          <span className="text-slate-500 font-italic">Acquiring positioning...</span>
        )}
      </div>

      {/* Dynamic Multi-level Floor Toggle Switch HUD */}
      <div className="absolute top-[80px] left-3 flex flex-col gap-1.5 p-2 bg-[#0b0f19]/95 border border-slate-800 rounded-xl shadow-lg z-10 backdrop-blur-sm select-none">
        <span className="text-[9px] font-mono text-slate-500 font-semibold uppercase tracking-wider">Floor Level</span>
        <div className="flex flex-col gap-1">
          {[
            { id: 2, name: 'Floor 2 (Lab F)', short: 'L2' },
            { id: 1, name: 'Floor 1 (Hall B)', short: 'L1' },
            { id: 0, name: 'Ground Floor', short: 'GF' },
          ].map((floor) => {
            const isSelected = selectedLevel === floor.id;
            const hasActiveGfns = courses.some(c => (c.geofence.level ?? 0) === floor.id && c.activeSession);

            return (
              <button
                key={floor.id}
                onClick={() => setSelectedLevel(floor.id)}
                className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-[10px] font-mono transition-all text-left w-[130px] border cursor-pointer ${
                  isSelected
                    ? 'bg-blue-600/20 text-blue-300 border-blue-500/50 font-semibold shadow-sm'
                    : 'bg-slate-900/40 hover:bg-slate-800 text-slate-400 border-transparent hover:text-slate-200'
                }`}
                title={floor.name}
              >
                <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-blue-400 shadow-sm shadow-blue-400' : hasActiveGfns ? 'bg-emerald-500 animate-pulse' : 'bg-slate-705'}`} />
                <span className="font-bold min-w-[16px]">{floor.short}</span>
                <span className="text-[8px] opacity-85 truncate">{floor.name.replace(/Floor \d |Ground /, '')}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Floating Floor Level Watermark label inside background view */}
      <div className="absolute right-3 top-14 text-right text-[10px] text-slate-500/80 font-mono tracking-widest pointer-events-none select-none z-10">
        ACTIVE DRAWING: <span className="text-slate-400 font-bold">{selectedLevel === 0 ? 'GROUND FLOOR' : selectedLevel === 1 ? 'FIRST FLOOR' : 'SECOND FLOOR'}</span>
      </div>
    </div>
  );
}
