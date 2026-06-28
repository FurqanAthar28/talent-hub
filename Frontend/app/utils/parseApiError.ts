import { MESSAGES } from "../config/messages";

export function parseApiError(data: Record<string, unknown>): string {
  if (typeof data.message === "string") return data.message;
  if (typeof data.detail === "string") return data.detail;

  const messages: string[] = [];

  for (const [field, errors] of Object.entries(data)) {
    if (Array.isArray(errors)) {
      errors.forEach((e) => {
        if (typeof e === "string") {
          const label = field === "non_field_errors" ? "" : `${field}: `;
          messages.push(`${label}${e}`);
        }
      });
    }
  }

  return messages.length > 0 ? messages.join(" ") : MESSAGES.AUTH.SIGNUP_FAILED;
}