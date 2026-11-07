import type { AccountStatus, ApprovalStatus, RejectionReason } from "@/app/config/constants";

// Must match admin_stats_view in Backend/admin_panel/views.py
export type AdminStats = {
  users: number;
  activeUsers: number;
  inactiveUsers: number; // can't sign in, for any reason
  suspendedUsers: number;
  bannedUsers: number;
  deletedUsers: number; // deleted, still restorable
  adminUsers: number;
  candidates: number;
  recruiters: number;
  pendingApprovals: number; // candidates AND recruiters waiting
  skills: number;
  projects: number;
  experiences: number;
  connections: number;
  pendingConnectionRequests: number;
  openReports: number; // reports no admin has handled yet
  openJobs: number; // live job posts (open, not hidden)
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
  approvalStatus: ApprovalStatus;
  rejectionReason: RejectionReason | "";
  accountStatus: AccountStatus;
  statusReason: string; // why it was suspended, banned or deleted by an admin
  deletedAt: string | null; // null = not deleted
  deletedByAdmin: boolean; // only an admin can restore it
  restoreUntil: string | null; // last moment it can be restored
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
    peopleApproved: number;
    peopleNotApproved: number;
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

// Must match admin_approval_checks_view in Backend/admin_panel/views.py
export type ApprovalCheck = {
  key: string;
  label: string;
  passed: boolean;
  required: boolean; // required checks must pass before Approve works
  detail: string;
};

export type ApprovalReview = {
  checks: ApprovalCheck[];
  canApprove: boolean;
  needsLinkedinCheck: boolean;
  rejectionReasons: { value: RejectionReason; label: string }[];
};

// Must match AdminReportSerializer in Backend/reports/serializers.py
export type ReportReason = "fake_profile" | "spam" | "scam" | "harassment" | "inappropriate" | "other";
export type ReportAction = "dismiss" | "suspend" | "ban" | "hide_job"; // hide_job: job reports only

export type AdminReport = {
  id: number;
  kind: "profile" | "message" | "job";
  reason: ReportReason;
  reasonLabel: string;
  details: string; // what the reporter wrote (can be empty)
  messageText: string; // a copy of the reported message (message reports only)
  // Job reports only. jobId is null once the recruiter deleted the job; jobTitle is a copy.
  jobId: number | null;
  jobTitle: string;
  jobHidden: boolean;
  status: "open" | "dismissed" | "actioned";
  actionTaken: ReportAction | "";
  resolutionNote: string;
  resolvedByName: string;
  resolvedAt: string | null;
  createdAt: string;
  reporterName: string;
  reporterEmail: string;
  reportedUserId: number;
  reportedUserName: string;
  reportedUserEmail: string;
  reportedUserRole: "candidate" | "recruiter" | "admin";
  reportedUserAccountStatus: AccountStatus;
  reportedUserDeleted: boolean;
  openReportsAboutUser: number; // all open reports about this person (this one included)
};
