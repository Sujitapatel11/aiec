import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')
django.setup()

from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient

def run_tests():
    print("=" * 60, flush=True)
    print("AIEC UNIFIED LOGIN VERIFICATION SUITE", flush=True)
    print("=" * 60, flush=True)

    # Setup groups
    staff_group, _ = Group.objects.get_or_create(name='Staff')
    student_group, _ = Group.objects.get_or_create(name='Student')

    # Setup test users
    admin_user, _ = User.objects.get_or_create(username='test_admin_user')
    admin_user.set_password('AdminPass123!')
    admin_user.is_superuser = True
    admin_user.is_staff = True
    admin_user.is_active = True
    admin_user.save()

    staff_user, _ = User.objects.get_or_create(username='test_staff_user')
    staff_user.set_password('StaffPass123!')
    staff_user.is_superuser = False
    staff_user.is_staff = True
    staff_user.is_active = True
    staff_user.save()
    staff_user.groups.add(staff_group)

    student_user, _ = User.objects.get_or_create(username='test_student_user')
    student_user.set_password('StudentPass123!')
    student_user.is_superuser = False
    student_user.is_staff = False
    student_user.is_active = True
    student_user.save()
    student_user.groups.add(student_group)

    nogroup_user, _ = User.objects.get_or_create(username='test_nogroup_user')
    nogroup_user.set_password('NoGroupPass123!')
    nogroup_user.is_superuser = False
    nogroup_user.is_staff = False
    nogroup_user.is_active = True
    nogroup_user.save()
    nogroup_user.groups.clear()

    client = APIClient()
    login_url = '/api/auth/login/'
    results = []

    # 1. Correct Admin role + credentials -> 200, role: 'admin'
    res1 = client.post(login_url, {'username': 'test_admin_user', 'password': 'AdminPass123!', 'role': 'admin'}, format='json')
    t1_pass = res1.status_code == 200 and res1.json().get('role') == 'admin'
    results.append(('TEST 1: Correct Admin role & credentials', t1_pass, f'Status: {res1.status_code}, Body: {res1.json()}'))

    # 2. Correct Staff role + credentials -> 200, role: 'staff'
    res2 = client.post(login_url, {'username': 'test_staff_user', 'password': 'StaffPass123!', 'role': 'staff'}, format='json')
    t2_pass = res2.status_code == 200 and res2.json().get('role') == 'staff'
    results.append(('TEST 2: Correct Staff role & credentials', t2_pass, f'Status: {res2.status_code}, Body: {res2.json()}'))

    # 3. Correct Student role + credentials -> 200, role: 'student'
    res3 = client.post(login_url, {'username': 'test_student_user', 'password': 'StudentPass123!', 'role': 'student'}, format='json')
    t3_pass = res3.status_code == 200 and res3.json().get('role') == 'student'
    results.append(('TEST 3: Correct Student role & credentials', t3_pass, f'Status: {res3.status_code}, Body: {res3.json()}'))

    # 4. Mismatched role (at least two combinations) -> 401, generic error
    res4a = client.post(login_url, {'username': 'test_admin_user', 'password': 'AdminPass123!', 'role': 'staff'}, format='json')
    res4b = client.post(login_url, {'username': 'test_staff_user', 'password': 'StaffPass123!', 'role': 'admin'}, format='json')
    res4c = client.post(login_url, {'username': 'test_student_user', 'password': 'StudentPass123!', 'role': 'admin'}, format='json')
    t4_pass = (
        res4a.status_code == 401 and res4a.json().get('error') == 'Invalid credentials.' and
        res4b.status_code == 401 and res4b.json().get('error') == 'Invalid credentials.' and
        res4c.status_code == 401 and res4c.json().get('error') == 'Invalid credentials.'
    )
    results.append(('TEST 4: Mismatched role combinations (Admin as staff, Staff as admin, Student as admin)', t4_pass, f'Statuses: {res4a.status_code}, {res4b.status_code}, {res4c.status_code}'))

    # 5. Missing/empty role field -> 401, generic error
    res5a = client.post(login_url, {'username': 'test_admin_user', 'password': 'AdminPass123!'}, format='json')
    res5b = client.post(login_url, {'username': 'test_admin_user', 'password': 'AdminPass123!', 'role': ''}, format='json')
    t5_pass = (
        res5a.status_code == 401 and res5a.json().get('error') == 'Invalid credentials.' and
        res5b.status_code == 401 and res5b.json().get('error') == 'Invalid credentials.'
    )
    results.append(('TEST 5: Missing/empty role field with valid credentials', t5_pass, f'Statuses: {res5a.status_code}, {res5b.status_code}'))

    # 6. Wrong password -> 401, generic error
    res6 = client.post(login_url, {'username': 'test_admin_user', 'password': 'WrongPassword123!', 'role': 'admin'}, format='json')
    t6_pass = res6.status_code == 401 and res6.json().get('error') == 'Invalid credentials.'
    results.append(('TEST 6: Wrong password', t6_pass, f'Status: {res6.status_code}, Body: {res6.json()}'))

    # 7. User with no group & not superuser -> 401 on any role
    res7a = client.post(login_url, {'username': 'test_nogroup_user', 'password': 'NoGroupPass123!', 'role': 'student'}, format='json')
    res7b = client.post(login_url, {'username': 'test_nogroup_user', 'password': 'NoGroupPass123!', 'role': 'staff'}, format='json')
    t7_pass = (
        res7a.status_code == 401 and res7a.json().get('error') == 'Invalid credentials.' and
        res7b.status_code == 401 and res7b.json().get('error') == 'Invalid credentials.'
    )
    results.append(('TEST 7: User without group or superuser rejected on all roles', t7_pass, f'Statuses: {res7a.status_code}, {res7b.status_code}'))

    # Clean up test users
    User.objects.filter(username__in=['test_admin_user', 'test_staff_user', 'test_student_user', 'test_nogroup_user']).delete()

    print("\n" + "-" * 60, flush=True)
    print("UNIFIED LOGIN TEST RESULTS SUMMARY", flush=True)
    print("-" * 60, flush=True)
    all_passed = True
    for name, passed, detail in results:
        status_str = "[PASS]" if passed else "[FAIL]"
        if not passed:
            all_passed = False
        print(f"{status_str} {name}", flush=True)
        print(f"       Details: {detail}", flush=True)

    print("-" * 60, flush=True)
    if all_passed:
        print("ALL UNIFIED LOGIN TESTS PASSED SUCCESSFULLY!", flush=True)
    else:
        print("SOME TESTS FAILED.", flush=True)
        sys.exit(1)

if __name__ == '__main__':
    run_tests()
