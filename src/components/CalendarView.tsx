import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Calendar, LayoutGrid, List, Clock, User, MapPin, 
  BookOpen, Edit2, Trash2, ArrowUpDown, Info 
} from 'lucide-react';
import { TimetableSlot } from '../types';

interface CalendarViewProps {
  slots: TimetableSlot[];
  isAdmin?: boolean;
  onEdit?: (slot: TimetableSlot) => void;
  onDelete?: (id: string) => void;
}

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const STANDARD_HOURS = [
  '09:00 - 10:30',
  '10:45 - 12:15',
  '13:00 - 14:30',
  '14:45 - 16:15',
  '16:30 - 18:00'
];

export default function CalendarView({ slots, isAdmin = false, onEdit, onDelete }: CalendarViewProps) {
  const [viewType, setViewType] = useState<'calendar' | 'agenda'>('calendar');
  const [selectedDayFilter, setSelectedDayFilter] = useState<string>('All');

  // Helper: parse a time segment (e.g., "09:00") into fractional hours for chronological sorting
  const parseTimeToNumber = (timeRangeStr: string): number => {
    try {
      const startPart = timeRangeStr.split('-')[0].trim();
      const [h, m] = startPart.split(':').map(Number);
      return (h || 0) + (m || 0) / 60;
    } catch {
      return 0;
    }
  };

  // Compile unique sorted times from existing slots and standard hours
  const allTimesSet = new Set<string>([...STANDARD_HOURS]);
  slots.forEach(slot => {
    if (slot.time) {
      allTimesSet.add(slot.time);
    } else if (slot.timeStart && slot.timeEnd) {
      allTimesSet.add(`${slot.timeStart} - ${slot.timeEnd}`);
    }
  });

  const sortedTimes = Array.from(allTimesSet).sort((a, b) => {
    return parseTimeToNumber(a) - parseTimeToNumber(b);
  });

  return (
    <div className="space-y-4">
      {/* Navigation and View Selectors */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center p-4 bg-[#0c0e1b] rounded-xl border border-cyan-500/10 gap-3 relative z-10">
        <div className="flex items-center space-x-2.5">
          <Calendar className="w-4 h-4 text-cyan-400" />
          <div>
            <h4 className="text-xs font-bold text-white font-mono tracking-widest uppercase">WEEKLY SCHEDULE CORE</h4>
            <p className="text-[10px] text-gray-500 font-mono uppercase">Interactive Calendars & Timetable Allocations</p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 self-stretch sm:self-auto justify-end">
          {/* Day Quick-Selector (For Agenda view only) */}
          {viewType === 'agenda' && (
            <select
              className="bg-black border border-cyan-500/20 py-1 px-2.5 rounded text-[10px] font-mono text-cyan-400 focus:outline-none focus:border-cyan-400 cursor-pointer"
              value={selectedDayFilter}
              onChange={(e) => setSelectedDayFilter(e.target.value)}
            >
              <option value="All">All Days</option>
              {DAYS_OF_WEEK.map(d => (
                <option key={d} value={d}>{d.toUpperCase()}</option>
              ))}
            </select>
          )}

          <div className="flex items-center bg-black/50 border border-cyan-500/15 p-1 rounded-lg">
            <button
              onClick={() => setViewType('calendar')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                viewType === 'calendar'
                  ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/15'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">CALENDAR_GRID</span>
            </button>
            <button
              onClick={() => setViewType('agenda')}
              className={`flex items-center space-x-1.5 px-3 py-1 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                viewType === 'agenda'
                  ? 'bg-cyan-500 text-black shadow-lg shadow-cyan-500/15'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">AGENDA_VIEW</span>
            </button>
          </div>
        </div>
      </div>

      {/* Calendar Grid View */}
      {viewType === 'calendar' && (
        <div className="bg-[#080914] border border-cyan-500/10 rounded-xl overflow-hidden shadow-2xl relative z-10">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse table-fixed min-w-[750px]">
              <thead>
                <tr className="border-b border-cyan-500/15 bg-[#0e1124]">
                  <th className="p-3 text-[10px] font-mono text-cyan-400 uppercase tracking-widest text-center w-24 border-r border-cyan-500/10">
                    TIME_SLOTS
                  </th>
                  {DAYS_OF_WEEK.map(day => (
                    <th key={day} className="p-3 text-[10px] font-mono text-cyan-400 uppercase tracking-widest text-center border-r border-cyan-500/10 last:border-r-0">
                      {day}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-cyan-500/5 bg-[#05060d]">
                {sortedTimes.map(timeRange => (
                  <tr key={timeRange} className="hover:bg-cyan-950/5 transition-all text-xs">
                    {/* Time Slot Label Row Header */}
                    <td className="p-3 text-center font-mono border-r border-cyan-500/10 bg-[#0d1020]/20 align-middle shrink-0">
                      <div className="flex flex-col items-center justify-center space-y-1">
                        <Clock className="w-3 h-3 text-cyan-500/60" />
                        <span className="text-[10px] text-white font-bold whitespace-nowrap">{timeRange}</span>
                      </div>
                    </td>

                    {/* Day Cells */}
                    {DAYS_OF_WEEK.map(day => {
                      const daySlots = slots.filter(s => {
                        const slotTime = s.time || `${s.timeStart} - ${s.timeEnd}`;
                        return s.day.toLowerCase() === day.toLowerCase() && slotTime === timeRange;
                      });

                      return (
                        <td key={day} className="p-2 border-r border-cyan-500/10 last:border-r-0 align-top h-28 relative">
                          {daySlots.length === 0 ? (
                            <div className="absolute inset-0 bg-transparent flex items-center justify-center pointer-events-none">
                              <span className="text-[8.5px] font-mono text-gray-700/40 select-none uppercase">---</span>
                            </div>
                          ) : (
                            <div className="space-y-1.5 h-full overflow-y-auto">
                              {daySlots.map(slot => (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0.95 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  key={slot.id} 
                                  className="group bg-cyan-950/20 backdrop-blur-sm border border-cyan-500/20 hover:border-cyan-400 p-2 rounded-lg flex flex-col justify-between transition-all relative shadow-md shadow-black/20"
                                >
                                  <div>
                                    <div className="flex justify-between items-start gap-1">
                                      <span className="text-[10.5px] font-bold text-white uppercase leading-none font-mono truncate" title={slot.subject}>
                                        {slot.subject}
                                      </span>
                                      <span className="text-[8px] font-mono text-cyan-400 bg-cyan-950/50 border border-cyan-500/20 px-1 rounded truncate shrink-0">
                                        {slot.room}
                                      </span>
                                    </div>
                                    <div className="text-[9px] text-gray-400 mt-1 truncate">
                                      {slot.lecturerName || 'Unknown Staff'}
                                    </div>
                                    <div className="text-[7.5px] font-mono text-gray-500 uppercase tracking-tighter mt-0.5">
                                      DEPT: {slot.department?.replace(' Networks', '').replace(' Security', '') || 'GEN'} • SEM {slot.semester || 'I'}
                                    </div>
                                  </div>

                                  {/* Hover Actions (Only for Admin) */}
                                  {isAdmin && (
                                    <div className="flex justify-end gap-1.5 mt-1.5 pt-1.5 border-t border-cyan-500/5 group-hover:opacity-100 opacity-60 transition-opacity">
                                      <button
                                        onClick={() => onEdit && onEdit(slot)}
                                        className="text-cyan-400 hover:text-white p-0.5 hover:bg-cyan-500/10 rounded cursor-pointer transition-colors"
                                        title="Modify block"
                                      >
                                        <Edit2 className="w-2.5 h-2.5" />
                                      </button>
                                      <button
                                        onClick={() => onDelete && onDelete(slot.id)}
                                        className="text-red-400 hover:text-red-300 p-0.5 hover:bg-red-500/10 rounded cursor-pointer transition-colors"
                                        title="Delete block"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>
                                    </div>
                                  )}
                                </motion.div>
                              ))}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 bg-[#0d1020]/20 border-t border-cyan-500/10 flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase">
            <span className="flex items-center gap-1">
              <Info className="w-3 h-3 text-cyan-500/60" /> Grid layout matches active subjects chronologically
            </span>
            <span>CELL_MATRIX_READY</span>
          </div>
        </div>
      )}

      {/* Agenda Stream view */}
      {viewType === 'agenda' && (
        <div className="space-y-4 relative z-10">
          {DAYS_OF_WEEK
            .filter(day => selectedDayFilter === 'All' || selectedDayFilter.toLowerCase() === day.toLowerCase())
            .map(dayName => {
              const daySlots = slots.filter(t => t.day.toLowerCase() === dayName.toLowerCase());
              if (daySlots.length === 0 && selectedDayFilter !== 'All') {
                return (
                  <div key={dayName} className="border border-dashed border-cyan-500/10 rounded-xl p-8 text-center text-xs font-mono text-gray-500 uppercase">
                    NO ACTIVE APPOINTMENTS ALLOCATED ON {dayName.toUpperCase()}
                  </div>
                );
              }
              if (daySlots.length === 0) return null;

              // Sort day slots chronologically
              const sortedDaySlots = [...daySlots].sort((a, b) => {
                const aTime = a.time || `${a.timeStart} - ${a.timeEnd}`;
                const bTime = b.time || `${b.timeStart} - ${b.timeEnd}`;
                return parseTimeToNumber(aTime) - parseTimeToNumber(bTime);
              });

              return (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={dayName} 
                  className="border border-cyan-500/10 rounded-xl p-5 bg-[#0b0d16] relative overflow-hidden shadow-lg"
                >
                  {/* Glowing vertical lines for calendar accent */}
                  <div className="absolute left-0 inset-y-0 w-1 bg-gradient-to-b from-cyan-500 to-indigo-500" />
                  
                  <div className="flex justify-between items-center mb-4 pb-2 border-b border-cyan-500/10">
                    <h5 className="text-xs font-mono text-cyan-400 uppercase font-extrabold tracking-widest flex items-center space-x-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block animate-pulse" />
                      <span>{dayName}</span>
                    </h5>
                    <span className="text-[9px] font-mono text-gray-500 bg-slate-900 border border-slate-800 px-2.5 py-0.5 rounded-full">
                      {daySlots.length} APPOINTMENT{daySlots.length > 1 ? 'S' : ''}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortedDaySlots.map(slot => (
                      <div 
                        key={slot.id} 
                        className="bg-cyan-950/15 backdrop-blur-sm border border-cyan-500/10 hover:border-cyan-400/30 p-4 rounded-xl flex flex-col justify-between transition-all relative group"
                      >
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-start gap-2">
                            <span className="text-xs font-bold text-white uppercase font-sans leading-tight">
                              {slot.subject}
                            </span>
                            <span className="text-[9.5px] font-mono font-semibold text-cyan-400 bg-cyan-950/40 border border-cyan-500/25 px-2 py-0.5 rounded-md flex items-center space-x-1 shrink-0">
                              <MapPin className="w-3 h-3 text-cyan-500 shrink-0" />
                              <span>{slot.room}</span>
                            </span>
                          </div>

                          <div className="space-y-1 text-xs">
                            <div className="flex items-center space-x-1.5 text-gray-400">
                              <Clock className="w-3.5 h-3.5 text-cyan-500/60 shrink-0" />
                              <span className="font-mono text-[10.5px]">{slot.time || `${slot.timeStart} - ${slot.timeEnd}`}</span>
                            </div>
                            <div className="flex items-center space-x-1.5 text-gray-400">
                              <User className="w-3.5 h-3.5 text-cyan-500/60 shrink-0" />
                              <span className="truncate">Lector: <b className="text-white font-medium">{slot.lecturerName || slot.lecturer}</b></span>
                            </div>
                          </div>

                          <div className="text-[10px] font-mono text-gray-500 uppercase flex items-center space-x-1.5">
                            <span className="bg-slate-950 px-2 py-0.5 border border-cyan-500/5 rounded">DEPT: {slot.department}</span>
                            <span className="bg-slate-950 px-2 py-0.5 border border-cyan-500/5 rounded">SEM: {slot.semester}</span>
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="mt-4 pt-3 border-t border-cyan-500/5 flex justify-end gap-2 group-hover:opacity-100 opacity-60 transition-opacity">
                            <button
                              onClick={() => onEdit && onEdit(slot)}
                              className="flex items-center space-x-1 text-cyan-400 border border-cyan-500/15 px-2.5 py-1 hover:bg-cyan-500/10 rounded cursor-pointer text-[10.5px] font-mono"
                            >
                              <Edit2 className="w-3 h-3" />
                              <span>MODIFY_BLOCK</span>
                            </button>
                            <button
                              onClick={() => onDelete && onDelete(slot.id)}
                              className="flex items-center space-x-1 text-red-400 border border-red-500/15 px-2.5 py-1 hover:bg-red-500/10 rounded cursor-pointer text-[10.5px] font-mono"
                            >
                              <Trash2 className="w-3 h-3" />
                              <span>PURGE</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </motion.div>
              );
            })}
        </div>
      )}
    </div>
  );
}
