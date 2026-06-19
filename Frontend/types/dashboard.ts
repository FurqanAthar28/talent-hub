export interface DashboardUser {
  id: string;
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
