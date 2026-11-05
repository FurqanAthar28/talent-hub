"""
Put the person's name inside an uploaded CV's PDF details
(Title: "Ali Khan CV", Author: "Ali Khan").

If anything goes wrong, we keep the ORIGINAL file, so an upload never
fails just because of this nice-to-have step. But we WRITE the problem to
the log, so you can see it instead of it being silently hidden.
"""

import logging
from io import BytesIO

from django.core.files.base import ContentFile
from pypdf import PdfReader, PdfWriter
from pypdf.errors import PyPdfError

logger = logging.getLogger(__name__)


def apply_cv_pdf_metadata(uploaded_file, person_name):
    display_name = person_name.strip() or "Professional"

    try:
        uploaded_file.seek(0)
        reader = PdfReader(uploaded_file)
        writer = PdfWriter()

        for page in reader.pages:
            writer.add_page(page)

        writer.add_metadata(
            {
                "/Title": f"{display_name} CV",
                "/Author": display_name,
                "/Subject": "CV",
            }
        )

        output = BytesIO()
        writer.write(output)
        uploaded_file.seek(0)
        return ContentFile(output.getvalue(), name=uploaded_file.name)

    except (PyPdfError, OSError, ValueError) as error:
        # A damaged or unusual PDF. Keep the original file and log why.
        logger.warning("Could not add details to CV PDF (%s); keeping the original.", error)
        uploaded_file.seek(0)
        return uploaded_file
