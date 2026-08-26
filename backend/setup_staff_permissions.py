import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')
django.setup()

from django.contrib.auth.models import User, Group, Permission
from django.contrib.contenttypes.models import ContentType
from api.models import Lead

def setup_permissions():
    print("Setting up Django Staff Group & Permissions...")

    # 1. Ensure Group "Staff" exists
    staff_group, created = Group.objects.get_or_create(name='Staff')
    print(f"Group 'Staff': {'created' if created else 'already exists'}.")

    # 2. Add user 'sujitapatel5' to 'Staff' group
    try:
        user = User.objects.get(username='sujitapatel5')
        user.groups.add(staff_group)
        print(f"User '{user.username}' successfully added to Group 'Staff'.")
    except User.DoesNotExist:
        print("ERROR: User 'sujitapatel5' not found in database.")
        sys.exit(1)

    # 3. Confirm custom permissions exist in auth_permission
    lead_content_type = ContentType.objects.get_for_model(Lead)
    del_perm = Permission.objects.filter(codename='can_delete_lead', content_type=lead_content_type).first()
    exp_perm = Permission.objects.filter(codename='can_export_leads', content_type=lead_content_type).first()

    print("\nCustom Permission Registry Check:")
    print(f"  - api.can_delete_lead: {'FOUND (' + str(del_perm.id) + ')' if del_perm else 'NOT FOUND'}")
    print(f"  - api.can_export_leads: {'FOUND (' + str(exp_perm.id) + ')' if exp_perm else 'NOT FOUND'}")

    if not del_perm or not exp_perm:
        print("ERROR: Custom permissions not registered properly.")
        sys.exit(1)

    print("\nStaff permissions setup complete!")

if __name__ == '__main__':
    setup_permissions()
