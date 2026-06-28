export function signupUser(data: FormData): Promise<Response> {
  return fetch("/api/backend/auth/signup/", {
    method: "POST",
    body: data,
  });
}