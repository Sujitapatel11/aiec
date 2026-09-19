import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')
django.setup()

from django.contrib.auth.models import User, Group
from rest_framework.test import APIClient

def run_tests():
    print("=" * 60, flush=True)
    print("AIEC STAFF ACCOUNT CREATION TEST SUITE", flush=True)
    print("=" * 60, flush=True)

    # Ensure required groups exist
    staff_group, _ = Group.objects.get_or_create(name='Staff')
    student_group, _ = Group.objects.get_or_create(name='Student')

    # Setup test admin and staff users
    admin_user, _ = User.objects.get_or_create(username='test_admin_creator')
    admin_user.set_password('AdminPass2026!')
    admin_user.is_superuser = True
    admin_user.is_staff = True
    admin_user.is_active = True
    admin_user.save()

    existing_staff, _ = User.objects.get_or_create(username='test_existing_staff')
    existing_staff.set_password('StaffPass2026!')
    existing_staff.is_superuser = False
    existing_staff.is_staff = True
    existing_staff.is_active = True
    existing_staff.save()
    existing_staff.groups.add(staff_group)

    student_user, _ = User.objects.get_or_create(username='test_existing_student')
    student_user.set_password('StudentPass2026!')
    student_user.is_superuser = False
    student_user.is_staff = False
    student_user.is_active = True
    student_user.save()
    student_user.groups.add(student_group)

    client = APIClient()
    create_url = '/api/staff/create/'
    login_url = '/api/auth/login/'
    results = []

    # 1. Non-admin (staff/student) attempt -> 403 Forbidden
    client.force_authenticate(user=existing_staff)
    res1_staff = client.post(create_url, {
        'full_name': 'Hacker Staff',
        'username': 'hacker_staff',
        'password': 'StrongPassword2026!'
    }, format='json')

    client.force_authenticate(user=student_user)
    res1_student = client.post(create_url, {
        'full_name': 'Hacker Student',
        'username': 'hacker_student',
        'password': 'StrongPassword2026!'
    }, format='json')

    t1_pass = (res1_staff.status_code == 403) and (res1_student.status_code == 403)
    results.append(('TEST 1: Non-admin staff/student blocked from staff creation (403)', t1_pass,
                    f'Staff status: {res1_staff.status_code}, Student status: {res1_student.status_code}'))

    # 2. Admin attempt with weak passwords ("1234", "password") -> 400 with clear error
    client.force_authenticate(user=admin_user)
    res2_weak1 = client.post(create_url, {
        'full_name': 'Weak User One',
        'username': 'weak_user_1',
        'password': '1234'
    }, format='json')

    res2_weak2 = client.post(create_url, {
        'full_name': 'Weak User Two',
        'username': 'weak_user_2',
        'password': 'password'
    }, format='json')

    t2_pass = (res2_weak1.status_code == 400 and 'error' in res2_weak1.json()) and \
              (res2_weak2.status_code == 400 and 'error' in res2_weak2.json())
    results.append(('TEST 2: Admin creation rejected on weak passwords ("1234", "password")', t2_pass,
                    f'Weak 1 error: {res2_weak1.json().get("error")}, Weak 2 error: {res2_weak2.json().get("error")}'))

    # 3. Admin attempt with duplicate username -> 400 with clear error
    res3_dup = client.post(create_url, {
        'full_name': 'Duplicate User',
        'username': 'test_existing_staff',
        'password': 'StrongPassword2026!'
    }, format='json')

    t3_pass = (res3_dup.status_code == 400) and (res3_dup.json().get('error') == 'Username already exists.')
    results.append(('TEST 3: Duplicate username rejected with clear error', t3_pass,
                    f'Status: {res3_dup.status_code}, Error: {res3_dup.json().get("error")}'))

    # 4. Admin attempt with strong password -> 201 success, in "Staff" Group, PBKDF2 hashed, no password in body
    new_username = 'created_staff_2026'
    new_password = 'StaffMember2026!'
    res4_success = client.post(create_url, {
        'full_name': 'Alex Carter',
        'username': new_username,
        'email': 'alex.carter@example.com',
        'phone': '+1 555-0199',
        'password': new_password
    }, format='json')

    created_user = User.objects.filter(username=new_username).first()
    is_in_staff_group = created_user.groups.filter(name='Staff').exists() if created_user else False
    is_password_hashed = created_user.password.startswith('pbkdf2_sha256$') if created_user else False
    password_not_returned = 'password' not in res4_success.json()

    t4_pass = (res4_success.status_code == 201) and created_user and is_in_staff_group and is_password_hashed and password_not_returned
    results.append(('TEST 4: Successful staff creation (Group assignment, PBKDF2, no password leaked)', t4_pass,
                    f'Status: {res4_success.status_code}, In Group: {is_in_staff_group}, Hashed: {is_password_hashed}, No Password in Response: {password_not_returned}'))

    # 5. Newly created staff can authenticate via /api/auth/login/ with role="staff"
    client.force_authenticate(user=None) # Unauthenticate client
    res5_login = client.post(login_url, {
        'username': new_username,
        'password': new_password,
        'role': 'staff'
    }, format='json')

    t5_pass = (res5_login.status_code == 200) and (res5_login.json().get('role') == 'staff') and ('token' in res5_login.json())
    results.append(('TEST 5: Newly created staff login authentication with role="staff"', t5_pass,
                    f'Status: {res5_login.status_code}, Role: {res5_login.json().get("role")}, Has Token: {"token" in res5_login.json()}'))

    # Cleanup created test users
    User.objects.filter(username__in=['test_admin_creator', 'test_existing_staff', 'test_existing_student', new_username]).delete()

    print("\n" + "-" * 60, flush=True)
    print("STAFF ACCOUNT CREATION TEST RESULTS SUMMARY", flush=True)
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
        print("ALL STAFF ACCOUNT CREATION TESTS PASSED SUCCESSFULLY!", flush=True)
    else:
        print("SOME TESTS FAILED.", flush=True)
        sys.exit(1)

if __name__ == '__main__':
    run_tests()
