
export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Member';
  avatar: string;
  status: 'Active' | 'Inactive' | 'Pending';
  isMuted?: boolean;
  isSpeaking?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  plan: 'Free' | 'Pro' | 'Enterprise';
  users: User[];
}

export const USERS: User[] = [
  {
    id: '1',
    name: 'Alex Morgan',
    email: 'alex@acme.com',
    role: 'Admin',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop',
    status: 'Active',
    isMuted: false,
    isSpeaking: true
  },
  {
    id: '2',
    name: 'Sarah Chen',
    email: 'sarah@acme.com',
    role: 'Member',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop',
    status: 'Active',
    isMuted: true,
    isSpeaking: false
  },
  {
    id: '3',
    name: 'James Wilson',
    email: 'james@acme.com',
    role: 'Member',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop',
    status: 'Inactive',
    isMuted: true,
    isSpeaking: false
  },
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily@acme.com',
    role: 'Member',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop',
    status: 'Active',
    isMuted: false,
    isSpeaking: false
  }
];

export const ORGANIZATION_USERS = USERS;

export const ORGANIZATIONS: Organization[] = [
  {
    id: '1',
    name: 'Acme Corp',
    plan: 'Enterprise',
    users: ORGANIZATION_USERS
  },
  {
    id: '2',
    name: 'Stark Industries',
    plan: 'Pro',
    users: []
  },
  {
    id: '3',
    name: 'Wayne Enterprises',
    plan: 'Enterprise',
    users: []
  }
];

export interface Meeting {
  id: string;
  title: string;
  time: string;
  start?: Date;
  end?: Date;
  participants: { id: string; name: string; avatar: string }[];
  status: 'Live Now' | 'Upcoming' | 'Completed';
}

export const MEETINGS: Meeting[] = [
  {
    id: '1',
    title: 'Q3 Product Roadmap Review',
    time: '10:00 AM - 11:00 AM',
    start: new Date(new Date().setHours(10, 0, 0, 0)),
    end: new Date(new Date().setHours(11, 0, 0, 0)),
    participants: [
      { id: '1', name: 'Alex', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop' },
      { id: '2', name: 'Sarah', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
      { id: '3', name: 'Mike', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop' },
    ],
    status: 'Live Now'
  },
  {
    id: '2',
    title: 'Design Sync: Mobile App',
    time: '1:00 PM - 2:00 PM',
    start: new Date(new Date().setHours(13, 0, 0, 0)),
    end: new Date(new Date().setHours(14, 0, 0, 0)),
    participants: [
      { id: '4', name: 'Emily', avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100&h=100&fit=crop' },
      { id: '5', name: 'David', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
    ],
    status: 'Upcoming'
  },
  {
    id: '3',
    title: 'Weekly All-Hands',
    time: '4:00 PM - 5:00 PM',
    start: new Date(new Date().setHours(16, 0, 0, 0)),
    end: new Date(new Date().setHours(17, 0, 0, 0)),
    participants: [
      { id: '1', name: 'Alex', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop' },
      { id: '2', name: 'Sarah', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop' },
      { id: '6', name: 'Lisa', avatar: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=100&h=100&fit=crop' },
      { id: '7', name: 'Tom', avatar: 'https://images.unsplash.com/photo-1519345182560-3f2917c472ef?w=100&h=100&fit=crop' },
    ],
    status: 'Upcoming'
  },
  {
    id: '4',
    title: 'Project Kickoff',
    time: '9:00 AM - 10:30 AM',
    start: new Date(new Date().setDate(new Date().getDate() + 1)), // Tomorrow
    end: new Date(new Date(new Date().setDate(new Date().getDate() + 1)).setHours(10, 30, 0, 0)),
    participants: [
        { id: '1', name: 'Alex', avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100&h=100&fit=crop' },
        { id: '5', name: 'David', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop' },
    ],
    status: 'Upcoming'
  }
];

export interface AICommand {
  command: string;
  response: string;
}

export const AI_COMMANDS: AICommand[] = [
  { command: 'Summarize discussion', response: 'Here is a summary of the discussion so far:\n- Discussed Q3 roadmap goals\n- Agreed on mobile-first approach\n- Action item: Sarah to update designs by Friday' },
  { command: 'Record meeting', response: 'Recording started. I will notify all participants.' },
  { command: 'Create action item', response: 'Action item created. Who should I assign it to?' },
];
