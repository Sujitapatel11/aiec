import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Consultancy, ConsultancyMembership, Lead, StudentProfile, Application
from api.tenancy import get_active_consultancy_for_user


class ConsultancyOwnershipTests(TestCase):
    def setUp(self):
        self.a = Consultancy.objects.create(name='Tenant A', slug='tenant-a')
        self.b = Consultancy.objects.create(name='Tenant B', slug='tenant-b')
        self.staff_a = User.objects.create_user(
            username='tenant_a_staff', password='StaffPass123!', is_staff=True
        )
        self.staff_b = User.objects.create_user(
            username='tenant_b_staff', password='StaffPass123!', is_staff=True
        )
        ConsultancyMembership.objects.create(
            consultancy=self.a, user=self.staff_a, role='admin'
        )
        ConsultancyMembership.objects.create(
            consultancy=self.b, user=self.staff_b, role='admin'
        )
        self.student_user_a = User.objects.create_user(
            username='tenant_a_student', password='StudentPass123!'
        )
        self.student_user_b = User.objects.create_user(
            username='tenant_b_student', password='StudentPass123!'
        )
        self.student_a = StudentProfile.objects.create(
            user=self.student_user_a, full_name='Tenant A Student',
            phone='111', destination_country='Canada', consultancy=self.a,
            enrolled_by=self.staff_a,
        )
        self.student_b = StudentProfile.objects.create(
            user=self.student_user_b, full_name='Tenant B Student',
            phone='222', destination_country='Canada', consultancy=self.b,
            enrolled_by=self.staff_b,
        )
        self.app_b = Application.objects.create(
            student=self.student_b, university_name='Tenant B University',
            course_name='Engineering', intake='Fall 2030',
        )
        self.client = APIClient()

    def test_membership_resolver_requires_active_membership(self):
        self.assertEqual(get_active_consultancy_for_user(self.staff_a), self.a)
        self.assertIsNone(get_active_consultancy_for_user(self.student_user_a))

    def test_membership_resolver_requires_explicit_selection_for_multiple_tenants(self):
        ConsultancyMembership.objects.create(
            consultancy=self.b, user=self.staff_a, role='staff'
        )
        self.assertIsNone(get_active_consultancy_for_user(self.staff_a))
        self.assertEqual(
            get_active_consultancy_for_user(self.staff_a, str(self.a.pk)), self.a
        )
        self.assertIsNone(
            get_active_consultancy_for_user(self.staff_a, 'not-an-id')
        )

    def test_staff_cannot_list_or_retrieve_another_tenant_student(self):
        self.client.force_authenticate(user=self.staff_a)
        listing = self.client.get('/api/students/')
        self.assertEqual(listing.status_code, 200)
        returned_ids = [row['id'] for row in listing.data['results']]
        self.assertIn(self.student_a.pk, returned_ids)
        self.assertNotIn(self.student_b.pk, returned_ids)

        detail = self.client.get(f'/api/students/{self.student_b.pk}/')
        self.assertEqual(detail.status_code, 404)

    def test_staff_cannot_access_another_tenant_application(self):
        self.client.force_authenticate(user=self.staff_a)
        response = self.client.get(f'/api/applications/{self.app_b.pk}/')
        self.assertEqual(response.status_code, 403)

    def test_student_can_only_list_own_applications(self):
        self.client.force_authenticate(user=self.student_user_a)
        response = self.client.get(f'/api/students/{self.student_b.pk}/applications/')
        self.assertEqual(response.status_code, 404)
