import { CV_MIME_TYPE, MAX_CV_FILE_SIZE_BYTES } from "../config/constants";
import { MESSAGES } from "../config/messages";

/**
 * Check a CV before uploading it: PDF only, and not too big.
 * Returns the problem as a message, or "" when the file is fine.
 *
 * (Django checks again, because a browser can be tricked. Checking here
 * too means you see the problem at once, not after pressing Save.)
 */
export function checkCvFile(file: File): string {
  if (file.type !== CV_MIME_TYPE) return MESSAGES.AUTH.PDF_ONLY;
  if (file.size > MAX_CV_FILE_SIZE_BYTES) return MESSAGES.AUTH.CV_SIZE_LIMIT;
  return "";
}
