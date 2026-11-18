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


def user_has_consultancy_role(user, consultancy, roles):
    """Return whether the user has an active allowed role in this tenant."""
    if not consultancy or not user or not user.is_authenticated:
        return False
    return ConsultancyMembership.objects.filter(
        user=user,
        consultancy=consultancy,
        is_active=True,
        consultancy__is_active=True,
        role__in=roles,
    ).exists()


def user_has_consultancy_staff_access(user, consultancy):
    """Staff/admin capability must come from the active tenant membership."""
    return user_has_consultancy_role(
        user, consultancy, {'owner', 'admin', 'staff'}
    )
