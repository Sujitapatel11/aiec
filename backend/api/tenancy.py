from .models import ConsultancyMembership


def get_active_consultancy_for_user(user, requested_id=None):
    """
    Resolve exactly one active tenant membership for a request.

    A user with multiple memberships must explicitly select one using the
    X-Consultancy-ID header. Superuser status does not bypass membership.
    """
    if not user or not user.is_authenticated:
        return None

    memberships = ConsultancyMembership.objects.select_related('consultancy').filter(
        user=user,
        is_active=True,
        consultancy__is_active=True,
    )
    if requested_id is not None:
        if not str(requested_id).isdigit():
            return None
        memberships = memberships.filter(consultancy_id=int(requested_id))

    rows = list(memberships[:2])
    if len(rows) != 1:
        return None
    return rows[0].consultancy


def user_has_consultancy_access(user, consultancy):
    if not consultancy or not user or not user.is_authenticated:
        return False
    return ConsultancyMembership.objects.filter(
        user=user,
        consultancy=consultancy,
        is_active=True,
        consultancy__is_active=True,
    ).exists()
