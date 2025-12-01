import React, { useState } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  isSameMonth, 
  isSameDay, 
  addDays, 
  eachDayOfInterval,
  startOfDay,
  endOfDay,
  eachHourOfInterval,
  isWithinInterval,
  setHours,
  setMinutes,
  isToday
} from 'date-fns';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MoreHorizontal } from 'lucide-react';
import { Meeting } from '../mockData';

interface TeamsCalendarProps {
  events: Meeting[];
  onEventClick?: (event: Meeting) => void;
}

type ViewType = 'month' | 'week' | 'day';

const TeamsCalendar: React.FC<TeamsCalendarProps> = ({ events, onEventClick }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<ViewType>('month');

  const next = () => {
    if (view === 'month') setCurrentDate(addMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addDays(currentDate, 1));
  };

  const prev = () => {
    if (view === 'month') setCurrentDate(subMonths(currentDate, 1));
    else if (view === 'week') setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(addDays(currentDate, -1));
  };

  const today = () => setCurrentDate(new Date());

  const getDaysInMonth = () => {
    const start = startOfWeek(startOfMonth(currentDate));
    const end = endOfWeek(endOfMonth(currentDate));
    return eachDayOfInterval({ start, end });
  };

  const getDaysInWeek = () => {
    const start = startOfWeek(currentDate);
    const end = endOfWeek(currentDate);
    return eachDayOfInterval({ start, end });
  };

  const getHours = () => {
    const start = startOfDay(currentDate);
    const end = endOfDay(currentDate);
    return eachHourOfInterval({ start, end });
  };

  const getEventsForDay = (day: Date) => {
    return events.filter(event => 
      event.start && isSameDay(event.start, day)
    );
  };

  const renderHeader = () => {
    let titleFormat = 'MMMM yyyy';
    if (view === 'day') titleFormat = 'MMMM d, yyyy';
    
    return (
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h2 className="text-2xl font-bold text-slate-800">
            {format(currentDate, titleFormat)}
          </h2>
          <div className="flex items-center bg-white rounded-lg border border-slate-200 p-1 shadow-sm">
            <button onClick={prev} className="p-1 hover:bg-slate-100 rounded-md text-slate-600">
              <ChevronLeft size={20} />
            </button>
            <button onClick={today} className="px-3 py-1 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-md">
              Today
            </button>
            <button onClick={next} className="p-1 hover:bg-slate-100 rounded-md text-slate-600">
              <ChevronRight size={20} />
            </button>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-lg">
          {(['month', 'week', 'day'] as ViewType[]).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all capitalize ${
                view === v 
                  ? 'bg-white text-indigo-600 shadow-sm' 
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const days = getDaysInMonth();
    const weeks = [];
    let week = [];

    days.forEach((day, i) => {
      week.push(day);
      if ((i + 1) % 7 === 0) {
        weeks.push(week);
        week = [];
      }
    });

    return (
      <div className="overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
            <div key={day} className="py-3 text-center text-sm font-semibold text-slate-500">
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const isTodayDate = isToday(day);

            return (
              <div 
                key={day.toString()} 
                className={`min-h-[120px] p-2 border-b border-r border-slate-100 relative group transition-colors hover:bg-slate-50
                  ${!isCurrentMonth ? 'bg-slate-50/50' : ''}
                `}
              >
                <div className={`text-sm font-medium mb-2 w-7 h-7 flex items-center justify-center rounded-full
                  ${isTodayDate 
                    ? 'bg-indigo-600 text-white' 
                    : isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}
                `}>
                  {format(day, 'd')}
                </div>
                <div className="space-y-1.5">
                  {dayEvents.map(event => (
                    <button
                      key={event.id}
                      onClick={() => onEventClick?.(event)}
                      className="w-full text-left px-2 py-1 rounded-md text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-100 truncate hover:bg-indigo-100 transition-colors"
                    >
                      {format(event.start!, 'h:mm a')} {event.title}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const days = getDaysInWeek();
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div className="overflow-hidden flex flex-col h-[600px]">
        <div className="grid grid-cols-8 border-b border-slate-200 bg-slate-50 flex-none">
          <div className="p-4 border-r border-slate-200"></div>
          {days.map(day => (
            <div key={day.toString()} className={`p-3 text-center border-r border-slate-200 last:border-r-0 ${isToday(day) ? 'bg-indigo-50/50' : ''}`}>
              <div className={`text-xs font-medium uppercase mb-1 ${isToday(day) ? 'text-indigo-600' : 'text-slate-500'}`}>
                {format(day, 'EEE')}
              </div>
              <div className={`text-xl font-bold ${isToday(day) ? 'text-indigo-600' : 'text-slate-800'}`}>
                {format(day, 'd')}
              </div>
            </div>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="grid grid-cols-8 relative min-h-[1440px]"> {/* 24 hours * 60px */}
            {/* Time Column */}
            <div className="border-r border-slate-200 bg-slate-50/30">
              {hours.map(hour => (
                <div key={hour} className="h-[60px] border-b border-slate-100 text-xs text-slate-400 text-right pr-2 pt-2 relative">
                  <span className="-top-3 relative">{format(setHours(new Date(), hour), 'h a')}</span>
                </div>
              ))}
            </div>
            
            {/* Days Columns */}
            {days.map(day => {
               const dayEvents = getEventsForDay(day);
               return (
                <div key={day.toString()} className="border-r border-slate-200 relative last:border-r-0">
                  {hours.map(hour => (
                    <div key={hour} className="h-[60px] border-b border-slate-100"></div>
                  ))}
                  
                  {/* Events Overlay */}
                  {dayEvents.map(event => {
                    if (!event.start || !event.end) return null;
                    const startHour = event.start.getHours();
                    const startMin = event.start.getMinutes();
                    const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60); // minutes
                    const top = (startHour * 60) + startMin;
                    const height = duration;

                    return (
                      <div
                        key={event.id}
                        onClick={() => onEventClick?.(event)}
                        className="absolute left-1 right-1 rounded-md bg-indigo-100 border-l-4 border-indigo-500 p-2 cursor-pointer hover:brightness-95 transition-all shadow-sm z-10 overflow-hidden"
                        style={{ top: `${top}px`, height: `${height}px` }}
                      >
                        <div className="text-xs font-semibold text-indigo-700 truncate">{event.title}</div>
                        <div className="text-[10px] text-indigo-600 truncate">
                          {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
                        </div>
                      </div>
                    );
                  })}
                </div>
               );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = getEventsForDay(currentDate);

    return (
      <div className="overflow-hidden flex flex-col h-[600px]">
        <div className="p-4 border-b border-slate-200 bg-slate-50 flex items-center justify-center">
             <div className="text-center">
                <div className="text-sm font-medium uppercase text-slate-500 mb-1">{format(currentDate, 'EEEE')}</div>
                <div className="text-3xl font-bold text-slate-800">{format(currentDate, 'd')}</div>
             </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          <div className="relative min-h-[1440px]">
             {hours.map(hour => (
                <div key={hour} className="flex h-[60px] border-b border-slate-100 group">
                  <div className="w-20 text-xs text-slate-400 text-right pr-4 pt-2 border-r border-slate-200 bg-slate-50/30 group-hover:bg-slate-50">
                    <span className="-top-3 relative">{format(setHours(new Date(), hour), 'h a')}</span>
                  </div>
                  <div className="flex-1 relative group-hover:bg-slate-50/30 transition-colors"></div>
                </div>
             ))}

             {dayEvents.map(event => {
                if (!event.start || !event.end) return null;
                const startHour = event.start.getHours();
                const startMin = event.start.getMinutes();
                const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60);
                const top = (startHour * 60) + startMin;
                const height = duration;

                return (
                  <div
                    key={event.id}
                    onClick={() => onEventClick?.(event)}
                    className="absolute left-24 right-4 rounded-md bg-indigo-100 border-l-4 border-indigo-500 p-3 cursor-pointer hover:brightness-95 transition-all shadow-sm z-10"
                    style={{ top: `${top}px`, height: `${height}px` }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="text-sm font-bold text-indigo-800">{event.title}</div>
                        <div className="text-xs text-indigo-600 mt-1 flex items-center gap-1">
                          <Clock size={12} />
                          {format(event.start, 'h:mm a')} - {format(event.end, 'h:mm a')}
                        </div>
                      </div>
                      <div className="flex -space-x-2">
                        {event.participants.map((p, i) => (
                          <img 
                            key={p.id} 
                            src={p.avatar} 
                            alt={p.name}
                            className="w-6 h-6 rounded-full border-2 border-white ring-1 ring-indigo-200"
                            style={{ zIndex: 10 - i }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                );
             })}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col">
      {renderHeader()}
      <div className="flex-1">
        {view === 'month' && renderMonthView()}
        {view === 'week' && renderWeekView()}
        {view === 'day' && renderDayView()}
      </div>
    </div>
  );
};

export default TeamsCalendar;
