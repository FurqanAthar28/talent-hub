export interface DashboardUser {
  id: string;
  role: "candidate" | "recruiter" | "admin";
  fullName: string;
  email: string;
  headline: string;
  location: string;
  bio: string;
  profileCompletion: number;
  profileViewers: number;
  openToWork: boolean;
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  companyName: string;
  companyWebsite: string;
  companyLocation: string;
  hiringTitle: string;
  adminTitle: string;
  recruiterVerificationStatus: "pending" | "approved" | "rejected";
  recruiterVerificationNote: string;
  cvUrl: string;
  missingFields: string[];
  skillsCount: number;
  projectsCount: number;
  experiencesCount: number;
  connectionsCount: number;
}

export interface DashboardActivity {
  id: number;
  title: string;
  created_at: string;
}
