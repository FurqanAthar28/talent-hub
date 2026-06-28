import type { UiContent } from "../../../api/ui-content";
import { Button } from "../../../components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../../components/ui/dropdown-menu";
import type { DashboardUser } from "../../../../types/dashboard";
import { formatUiText } from "../Utils";

type DashboardHeaderProps = {
  user: DashboardUser;
  uiContent: UiContent;
};

export default function DashboardHeader({
  user,
  uiContent,
}: DashboardHeaderProps) {
  const isCandidate = user.role === "candidate";
  const isRecruiter = user.role === "recruiter";
  const isAdmin = user.role === "admin";

  const dashboardTitle = isAdmin
    ? uiContent.adminDashboard
    : isRecruiter
      ? uiContent.recruiterDashboard
      : uiContent.candidateDashboard;

  const dashboardIntro = isAdmin
    ? uiContent.adminDashboardIntro
    : isRecruiter
      ? uiContent.recruiterDashboardIntro
      : uiContent.candidateDashboardIntro;

  return (
    <div className="dashboard-header">
      <div>
        <h1>{dashboardTitle}</h1>

        <p>{formatUiText(dashboardIntro, { name: user.fullName })}</p>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline">{uiContent.dashboardActions}</Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent>
          <DropdownMenuGroup>
            <DropdownMenuLabel>{uiContent.profile}</DropdownMenuLabel>

            <DropdownMenuItem>
              <a href={uiContent.routeProfile}>{uiContent.profile}</a>
            </DropdownMenuItem>

            <DropdownMenuItem>
              <a href={uiContent.routeProfileEdit}>{uiContent.editProfile}</a>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            {isCandidate && (
              <DropdownMenuItem>
                <a href={uiContent.routeConnections}>{uiContent.myNetwork}</a>
              </DropdownMenuItem>
            )}

            {isAdmin && (
              <DropdownMenuItem>
                <a href={uiContent.routeAdmin}>{uiContent.admin}</a>
              </DropdownMenuItem>
            )}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}