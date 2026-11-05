import { Link2 } from "lucide-react";

import { Avatar, EmptyState, Panel, ui } from "@/app/components/ui";
import type { AdminConnection, AdminUser } from "../types";
import styles from "../admin.module.css";

type TextFn = (key: string, fallback: string) => string;

type Props = {
  text: TextFn;
  networkUsers: AdminUser[]; // only people who may connect
  connections: AdminConnection[];
  firstUserId: string;
  secondUserId: string;
  setFirstUserId: (value: string) => void;
  setSecondUserId: (value: string) => void;
  saving: boolean;
  removingId: number | null;
  onConnect: () => void;
  onDisconnect: (connection: AdminConnection) => void;
  formatDate: (value: string | null) => string;
};

/** Connect two people by hand, and see or remove existing connections. */
export default function ConnectionsSection({
  text,
  networkUsers,
  connections,
  firstUserId,
  secondUserId,
  setFirstUserId,
  setSecondUserId,
  saving,
  removingId,
  onConnect,
  onDisconnect,
  formatDate,
}: Props) {
  const userOptions = (excludedUserId: string) =>
    networkUsers
      .filter((user) => String(user.id) !== excludedUserId)
      .map((user) => (
        <option key={user.id} value={user.id}>
          {user.fullName || user.email} ({user.role})
        </option>
      ));

  const handleFirstUserChange = (value: string) => {
    if (value && value === secondUserId) return;
    setFirstUserId(value);
  };

  const handleSecondUserChange = (value: string) => {
    if (value && value === firstUserId) return;
    setSecondUserId(value);
  };

  return (
    <div className={ui.stack}>
      <Panel
        title={text("adminConnectionManagement", "Connect two people")}
        hint={text("adminConnectionManagementIntro", "Only active candidates and approved recruiters are listed.")}
      >
        <div className={styles.connectForm}>
          <label className={styles.field}>
            {text("adminFirstUser", "First person")}
            <select className={styles.select} value={firstUserId} onChange={(event) => handleFirstUserChange(event.target.value)}>
              <option value="">{text("adminSelectUser", "Choose someone")}</option>
              {userOptions(secondUserId)}
            </select>
          </label>
          <label className={styles.field}>
            {text("adminSecondUser", "Second person")}
            <select className={styles.select} value={secondUserId} onChange={(event) => handleSecondUserChange(event.target.value)}>
              <option value="">{text("adminSelectUser", "Choose someone")}</option>
              {userOptions(firstUserId)}
            </select>
          </label>
          <button
            type="button"
            className="btn-primary"
            onClick={onConnect}
            disabled={saving || !firstUserId || !secondUserId || firstUserId === secondUserId}
          >
            {saving ? text("adminCreatingConnection", "Connecting...") : text("adminCreateConnection", "Connect them")}
          </button>
        </div>
      </Panel>

      <Panel flush title={`${connections.length} ${connections.length === 1 ? "connection" : "connections"}`}>
        {connections.length === 0 ? (
          <EmptyState icon={Link2} title={text("adminNoConnections", "No connections yet")} />
        ) : (
          <ul className={ui.list}>
            {connections.map((connection) => (
              <li key={connection.id} className={ui.row}>
                <div className={styles.pair}>
                  <span className={styles.pairPerson}>
                    <Avatar name={connection.userName} size={32} />
                    {connection.userName}
                  </span>
                  <span className={styles.pairLink} aria-label="is connected to">
                    <Link2 size={16} aria-hidden="true" />
                  </span>
                  <span className={styles.pairPerson}>
                    <Avatar name={connection.connectedUserName} size={32} />
                    {connection.connectedUserName}
                  </span>
                </div>
                <span className={styles.count}>Since {formatDate(connection.createdAt)}</span>
                <button
                  type="button"
                  className="btn-danger-outline btn-sm"
                  onClick={() => onDisconnect(connection)}
                  disabled={removingId === connection.id}
                >
                  {removingId === connection.id ? text("adminDisconnecting", "Removing...") : text("adminDisconnect", "Remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}
