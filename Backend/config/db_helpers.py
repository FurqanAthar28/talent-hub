"""
Small database helpers shared by several apps.
"""

from django.db.models import Count, IntegerField, OuterRef, Subquery
from django.db.models.functions import Coalesce


def count_related(model, link_field):
    """
    Add a "how many?" column to every row, worked out INSIDE the database.

    Example (on a list of profiles):
        Profile.objects.annotate(projects_count=count_related(Project, "profile"))
    Now every profile has .projects_count, and the whole list still costs
    ONE database trip.

    `link_field` is the field on `model` that points back to the row we are
    counting for. `OuterRef("pk")` means "the row we are on right now".

    Why not Count("projects")? Counting several lists that way makes the
    database multiply rows together (10 skills x 5 projects x ...), which
    gets slow. A small "subquery" for each list doesn't.
    """
    counts = (
        model.objects.filter(**{link_field: OuterRef("pk")})
        .values(link_field)
        .annotate(total=Count("pk"))
        .values("total")
    )
    # Coalesce(..., 0): rows with nothing get 0 instead of empty (None).
    return Coalesce(Subquery(counts, output_field=IntegerField()), 0)
