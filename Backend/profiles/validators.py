"""
Checks shared by more than one serializer (sign-up AND profile edit).
Writing them once means both places always follow the same rules.
"""

from rest_framework import serializers

from .constants import MAX_CV_FILE_SIZE_BYTES

# Turn 5242880 bytes into "5", so the message always matches the real limit.
MAX_CV_FILE_SIZE_MB = MAX_CV_FILE_SIZE_BYTES // (1024 * 1024)

# Every real PDF file starts with these 5 bytes.
PDF_FILE_START = b"%PDF-"

CV_MESSAGES = {
    "pdf_only": "Only PDF files are accepted",
    "too_large": f"CV file must be {MAX_CV_FILE_SIZE_MB}MB or smaller",
}


def validate_cv_file(value):
    """
    Make sure an uploaded CV is a real PDF and not too big.
    Returns the file if it's fine, or raises a ValidationError.
    """
    if value.size > MAX_CV_FILE_SIZE_BYTES:
        raise serializers.ValidationError(CV_MESSAGES["too_large"])

    # The browser's "content type" label can be faked, so we ALSO look
    # at the first bytes of the file itself.
    value.seek(0)
    file_start = value.read(len(PDF_FILE_START))
    value.seek(0)  # rewind, so the file can be read again later

    if value.content_type != "application/pdf" or file_start != PDF_FILE_START:
        raise serializers.ValidationError(CV_MESSAGES["pdf_only"])

    return value
