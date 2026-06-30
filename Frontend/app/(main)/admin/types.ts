export type AdminStats = {
  users: number;
  activeUsers: number;
  inactiveUsers: number;
  staffUsers: number;
  skills: number;
  projects: number;
  experiences: number;
  pendingConnectionRequests: number;
  pendingRecruiters: number;
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

export type AuthUser = {
  isStaff: boolean;
};