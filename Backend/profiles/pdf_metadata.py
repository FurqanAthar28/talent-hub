from io import BytesIO

from django.core.files.base import ContentFile


def apply_cv_pdf_metadata(uploaded_file, person_name):
    try:
        from pypdf import PdfReader, PdfWriter
    except ImportError:
        return uploaded_file

    display_name = person_name.strip() or "Professional"

    try:
        uploaded_file.seek(0)
        reader = PdfReader(uploaded_file)
        writer = PdfWriter()

        for page in reader.pages:
            writer.add_page(page)

        writer.add_metadata({
            "/Title": f"{display_name} CV",
            "/Author": display_name,
            "/Subject": "CV",
        })

        output = BytesIO()
        writer.write(output)
        uploaded_file.seek(0)

        return ContentFile(output.getvalue(), name=uploaded_file.name)
    except Exception:
        uploaded_file.seek(0)
        return uploaded_file
