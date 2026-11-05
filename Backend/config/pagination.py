"""
Small, safe pagination used by list APIs.

The page size is read from settings so deployment and tests use the same values.
"""

from rest_framework.pagination import PageNumberPagination
from django.conf import settings


class StandardResultsPagination(PageNumberPagination):
    page_size_query_param = "page_size"
    page_size = settings.API_PAGE_SIZE
    max_page_size = settings.API_MAX_PAGE_SIZE
