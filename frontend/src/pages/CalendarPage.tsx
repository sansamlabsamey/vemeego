  import React from 'react';
import TeamsCalendar from '../components/TeamsCalendar';
import { MEETINGS } from '../mockData';

const CalendarPage = () => {
  return (
    <div className="h-full flex flex-col p-4 md:p-8">
      <header className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2">Calendar</h1>
        <p className="text-slate-500">View and manage your schedule.</p>
      </header>
      
      <div className="flex-1 bg-white/60 backdrop-blur-md border border-white/50 shadow-sm rounded-xl overflow-hidden">
        <div className="h-full p-4">
           <TeamsCalendar events={MEETINGS} onEventClick={(event) => console.log('Clicked event:', event)} />
        </div>
      </div>
    </div>
  );
};

export default CalendarPage;
