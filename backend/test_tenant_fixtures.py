from api.models import Consultancy, ConsultancyMembership


def add_aiec_membership(user):
    """Give legacy regression-test staff explicit membership in the AIEC tenant."""
    consultancy, _ = Consultancy.objects.get_or_create(
        slug='aiec',
        defaults={'name': 'Aaradhya International Education Consultancy'},
    )
    role = 'owner' if user.is_superuser else 'admin' if user.is_staff else 'staff'
    return ConsultancyMembership.objects.get_or_create(
        consultancy=consultancy,
        user=user,
        defaults={'role': role, 'is_active': True},
    )[0]
