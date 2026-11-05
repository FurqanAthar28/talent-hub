// Must match admin_stats_view in Backend/admin_panel/views.py
export type AdminStats = {
  users: number;
  activeUsers: number;
  inactiveUsers: number;
  adminUsers: number;
  candidates: number;
  recruiters: number;
  pendingRecruiters: number;
  skills: number;
  projects: number;
  experiences: number;
  connections: number;
  pendingConnectionRequests: number;
};

export type AdminUser = {
  id: number;
  email: string;
  username: string;
  fullName: string;
  role: "candidate" | "recruiter" | "admin";
  is_active: boolean;
  is_staff: boolean;
  date_joined: string;
  last_login: string | null;
  profileCompletion: number;
  skillsCount: number;
  projectsCount: number;
  experiencesCount: number;
  connectionsCount: number;
  recruiterVerificationStatus: "pending" | "approved" | "rejected";
  recruiterVerificationNote: string;
};

export type AdminConnection = {
  id: number;
  userId: number;
  userName: string;
  userEmail: string;
  userRole: "candidate" | "recruiter";
  connectedUserId: number;
  connectedUserName: string;
  connectedUserEmail: string;
  connectedUserRole: "candidate" | "recruiter";
  createdAt: string;
};

export type AdminAuditLog = {
  id: number;
  actorName: string;
  actorEmail: string;
  targetUserName: string;
  targetUserEmail: string;
  action: string;
  description: string;
  createdAt: string;
};

// Must match admin_me_view in Backend/admin_panel/views.py
export type AdminMe = {
  memberSince: string;
  lastSignIn: string | null;
  impact: {
    totalActions: number;
    recruitersApproved: number;
    recruitersRejected: number;
    accountsManaged: number;
    connectionsMade: number;
    textsEdited: number;
  };
  activity: { date: string; count: number }[]; // oldest first, one per day
  activeDays: number;
  streak: number;
  recent: AdminAuditLog[];
};

export type AdminUiContentItem = {
  id: number;
  key: string;
  value: string;
};
