import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')
django.setup()

from django.contrib.auth.models import User, Permission
from django.contrib.contenttypes.models import ContentType
from rest_framework.test import APIClient
from api.models import Lead

def run_tests():
    print("=" * 60)
    print("AIEC STAFF PERMISSION SYSTEM VERIFICATION SUITE")
    print("=" * 60)

    # 1. Fetch Users
    staff_user = User.objects.get(username='sujitapatel5')
    admin_user = User.objects.get(username='admin')

    # Create a temporary test password for staff if needed or authenticate staff client
    # Note: We can force authenticate staff_user and admin_user directly in APIClient via force_authenticate!
    staff_client = APIClient()
    staff_client.force_authenticate(user=staff_user)

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin_user)

    # Ensure a dummy lead exists for testing delete operations without touching real data
    dummy_lead_1 = Lead.objects.create(name='Test Lead Staff Permission 1', email='permtest1@example.com', phone='9999999999', notes='Temporary lead for permission verification')
    dummy_lead_2 = Lead.objects.create(name='Test Lead Staff Permission 2', email='permtest2@example.com', phone='8888888888', notes='Temporary lead for permission verification')
    dummy_lead_3 = Lead.objects.create(name='Test Lead Staff Permission 3', email='permtest3@example.com', phone='7777777777', notes='Temporary lead for permission verification')

    results = []

    # -------------------------------------------------------------
    # TEST 1: Staff GET /api/leads/ (list) — Should be ALLOWED (200)
    # -------------------------------------------------------------
    res1 = staff_client.get('/api/leads/')
    t1_pass = res1.status_code == 200
    results.append(('TEST 1: Staff GET /api/leads/ (List Leads)', t1_pass, f'Status: {res1.status_code}'))

    # -------------------------------------------------------------
    # TEST 2: Staff PATCH /api/leads/<id>/ — Should be ALLOWED (200)
    # -------------------------------------------------------------
    res2 = staff_client.patch(f'/api/leads/{dummy_lead_1.id}/', {'status': 'contacted'}, format='json')
    t2_pass = res2.status_code == 200 and res2.json().get('status') == 'contacted'
    results.append(('TEST 2: Staff PATCH /api/leads/<id>/ (Update Lead)', t2_pass, f'Status: {res2.status_code}'))

    # -------------------------------------------------------------
    # TEST 3: Staff DELETE /api/leads/<id>/ (Default) — Should be BLOCKED (403)
    # -------------------------------------------------------------
    res3 = staff_client.delete(f'/api/leads/{dummy_lead_1.id}/')
    t3_pass = res3.status_code == 403
    results.append(('TEST 3: Staff DELETE /api/leads/<id>/ (Default Block)', t3_pass, f'Status: {res3.status_code}, Error: {res3.json().get("error") if res3.status_code==403 else res3.content}'))

    # -------------------------------------------------------------
    # TEST 4: Staff GET /api/auth/users/ — Should be BLOCKED (403)
    # -------------------------------------------------------------
    res4 = staff_client.get('/api/auth/users/')
    t4_pass = res4.status_code == 403
    results.append(('TEST 4: Staff GET /api/auth/users/ (User Admin Block)', t4_pass, f'Status: {res4.status_code}'))

    # -------------------------------------------------------------
    # TEST 5: Admin DELETE /api/leads/<id>/ — Should be ALLOWED (204)
    # -------------------------------------------------------------
    res5 = admin_client.delete(f'/api/leads/{dummy_lead_1.id}/')
    t5_pass = res5.status_code in [200, 204]
    results.append(('TEST 5: Admin DELETE /api/leads/<id>/ (Full Access)', t5_pass, f'Status: {res5.status_code}'))

    # -------------------------------------------------------------
    # TEST 6: Extensible Permission Grant & Revoke Flow for Staff
    # -------------------------------------------------------------
    lead_content_type = ContentType.objects.get_for_model(Lead)
    can_delete_perm = Permission.objects.get(codename='can_delete_lead', content_type=lead_content_type)

    # 6a. Grant permission
    staff_user.user_permissions.add(can_delete_perm)
    # Refresh staff user from DB to clear cached permission set
    staff_user = User.objects.get(username='sujitapatel5')
    staff_client.force_authenticate(user=staff_user)

    res6a = staff_client.delete(f'/api/leads/{dummy_lead_2.id}/')
    t6a_pass = res6a.status_code in [200, 204]

    # 6b. Revoke permission
    staff_user.user_permissions.remove(can_delete_perm)
    staff_user = User.objects.get(username='sujitapatel5')
    staff_client.force_authenticate(user=staff_user)

    res6b = staff_client.delete(f'/api/leads/{dummy_lead_3.id}/')
    t6b_pass = res6b.status_code == 403

    t6_pass = t6a_pass and t6b_pass
    results.append(('TEST 6: Extensible Permission Grant & Revoke Flow', t6_pass, f'Granted DELETE Status: {res6a.status_code}, Revoked DELETE Status: {res6b.status_code}'))

    # Cleanup remaining dummy test lead
    Lead.objects.filter(id=dummy_lead_3.id).delete()

    # -------------------------------------------------------------
    # REPORT RESULTS
    # -------------------------------------------------------------
    print("\n" + "-" * 60)
    print("VERIFICATION RESULTS SUMMARY")
    print("-" * 60)
    all_passed = True
    for name, passed, detail in results:
        status_str = "[PASS]" if passed else "[FAIL]"
        if not passed: all_passed = False
        print(f"{status_str} {name}")
        print(f"       Details: {detail}")

    print("-" * 60)
    if all_passed:
        print("ALL PERMISSION SUITE TESTS PASSED SUCCESSFULLY!")
    else:
        print("SOME TESTS FAILED. PLEASE CHECK LOGS.")
        sys.exit(1)

if __name__ == '__main__':
    run_tests()
