import type { AdminConnection, AdminUser } from "../types";
import type { UiContent } from "../../../api/ui-content";

type Props = {
  uiContent: UiContent;
  networkUsers: AdminUser[];
  connections: AdminConnection[];

  firstUserId: string;
  secondUserId: string;

  setFirstUserId: React.Dispatch<React.SetStateAction<string>>;
  setSecondUserId: React.Dispatch<React.SetStateAction<string>>;

  connectionSaving: boolean;
  disconnectLoading: number | null;

  createManagedConnection: () => Promise<void>;
  disconnectManagedConnection: (
    connection: AdminConnection
  ) => Promise<void>;

  formatDate: (value: string | null) => string;
};

export default function ConnectionsSection({
  uiContent,
  networkUsers,
  connections,
  firstUserId,
  secondUserId,
  setFirstUserId,
  setSecondUserId,
  connectionSaving,
  disconnectLoading,
  createManagedConnection,
  disconnectManagedConnection,
  formatDate,
}: Props) {
  return (
    <div className="card">
      <div className="card-header">
        <h3>{uiContent.adminConnectionManagement}</h3>
        <p className="muted text-sm">
          {uiContent.adminConnectionManagementIntro}
        </p>
      </div>

      <div className="card-body">
        <div className="admin-connection-controls">
          <div className="form-group">
            <label>{uiContent.adminFirstUser}</label>

            <select
              value={firstUserId}
              onChange={(event) => setFirstUserId(event.target.value)}
            >
              <option value="">
                {uiContent.adminSelectUser}
              </option>

              {networkUsers.map((user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.fullName} -{" "}
                  {user.role === "candidate"
                    ? uiContent.candidate
                    : uiContent.recruiter}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>{uiContent.adminSecondUser}</label>

            <select
              value={secondUserId}
              onChange={(event) => setSecondUserId(event.target.value)}
            >
              <option value="">
                {uiContent.adminSelectUser}
              </option>

              {networkUsers.map((user) => (
                <option
                  key={user.id}
                  value={user.id}
                >
                  {user.fullName} -{" "}
                  {user.role === "candidate"
                    ? uiContent.candidate
                    : uiContent.recruiter}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            className="btn-primary"
            onClick={createManagedConnection}
            disabled={connectionSaving}
          >
            {connectionSaving
              ? uiContent.adminCreatingConnection
              : uiContent.adminCreateConnection}
          </button>
        </div>

        <div className="admin-connection-list">
          {connections.length === 0 ? (
            <p className="text-center muted">
              {uiContent.adminNoConnections}
            </p>
          ) : (
            connections.map((connection) => (
              <div
                key={connection.id}
                className="admin-connection-row"
              >
                <div>
                  <div className="font-semibold">
                    {connection.userName}
                  </div>

                  <div className="text-sm muted">
                    {connection.userEmail}
                  </div>

                  <span className="status-badge">
                    {connection.userRole === "candidate"
                      ? uiContent.candidate
                      : uiContent.recruiter}
                  </span>
                </div>

                <div className="admin-connection-arrow">
                  +
                </div>

                <div>
                  <div className="font-semibold">
                    {connection.connectedUserName}
                  </div>

                  <div className="text-sm muted">
                    {connection.connectedUserEmail}
                  </div>

                  <span className="status-badge">
                    {connection.connectedUserRole === "candidate"
                      ? uiContent.candidate
                      : uiContent.recruiter}
                  </span>
                </div>

                <div className="text-sm muted">
                  {formatDate(connection.createdAt)}
                </div>

                <button
                  type="button"
                  className="btn-outline btn-sm"
                  onClick={() =>
                    disconnectManagedConnection(connection)
                  }
                  disabled={
                    disconnectLoading === connection.id
                  }
                >
                  {disconnectLoading === connection.id
                    ? uiContent.adminDisconnecting
                    : uiContent.adminDisconnect}
                </button>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}