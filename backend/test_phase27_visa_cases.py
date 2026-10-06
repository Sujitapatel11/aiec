import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Application, Country, Course, StudentProfile, VisaCase


class VisaCaseApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='visa_admin', password='AdminPass123!', is_staff=True, is_superuser=True,
        )
        self.staff = User.objects.create_user(
            username='visa_staff', password='StaffPass123!', is_staff=True,
        )
        self.student_user = User.objects.create_user(
            username='visa_student', password='StudentPass123!'
        )
        self.other_student_user = User.objects.create_user(
            username='other_visa_student', password='StudentPass123!'
        )

        self.student = StudentProfile.objects.create(
            user=self.student_user,
            full_name='Visa Student',
            phone='555-0100',
            destination_country='Canada',
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_student_user,
            full_name='Other Visa Student',
            phone='555-0101',
            destination_country='Australia',
        )

        self.country = Country.objects.create(name='Canada', code='CA', description='Study destination')
        self.course = Course.objects.create(
            name='Computer Science',
            country=self.country,
            university='North University',
            level='Bachelor',
            duration='4 years',
        )

        self.application = Application.objects.create(
            student=self.student,
            course=self.course,
            university_name='North University',
            course_name='Computer Science',
            country=self.country,
            country_name='Canada',
            status='offer_received',
            intake='Fall 2027',
        )

        self.other_application = Application.objects.create(
            student=self.other_student,
            university_name='Other University',
            course_name='Other Course',
            country_name='Australia',
            status='offer_received',
            intake='Fall 2027',
        )

        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def test_staff_can_create_and_list_visa_case(self):
        response = self.client.post(
            f'/api/applications/{self.application.id}/visa/',
            {
                'visa_type': 'student_visa',
                'status': 'preparing',
                'application_date': '2026-10-01',
                'notes': 'Gathering documents',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['application'], self.application.id)
        self.assertEqual(response.data['status'], 'preparing')

        list_response = self.client.get(f'/api/applications/{self.application.id}/visa/')
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data['status'], 'preparing')

    def test_student_can_view_only_own_visa_case_and_cannot_modify(self):
        visa_case = VisaCase.objects.create(
            application=self.application,
            visa_type='student_visa',
            status='preparing',
            application_date='2026-10-01',
        )
        other_case = VisaCase.objects.create(
            application=self.other_application,
            visa_type='student_visa',
            status='preparing',
            application_date='2026-10-02',
        )

        self.client.force_authenticate(user=self.student_user)

        own_get = self.client.get(f'/api/applications/{self.application.id}/visa/')
        other_get = self.client.get(f'/api/applications/{self.other_application.id}/visa/')
        own_detail = self.client.get(f'/api/visa/{visa_case.id}/')
        other_detail = self.client.get(f'/api/visa/{other_case.id}/')

        self.assertEqual(own_get.status_code, 200)
        self.assertEqual(own_detail.status_code, 200)
        self.assertEqual(other_get.status_code, 403)
        self.assertEqual(other_detail.status_code, 403)
        self.assertEqual(
            self.client.patch(f'/api/visa/{visa_case.id}/', {'status': 'submitted'}, format='json').status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                f'/api/applications/{self.application.id}/visa/',
                {'visa_type': 'student_visa', 'status': 'preparing'},
                format='json',
            ).status_code,
            403,
        )

    def test_invalid_status_transition_is_rejected(self):
        visa_case = VisaCase.objects.create(
            application=self.application,
            visa_type='student_visa',
            status='not_started',
        )

        response = self.client.patch(
            f'/api/visa/{visa_case.id}/',
            {'status': 'approved'},
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('status', response.data)

    def test_create_requires_status_to_start_from_not_started(self):
        response = self.client.post(
            f'/api/applications/{self.application.id}/visa/',
            {'visa_type': 'student_visa', 'status': 'approved'},
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('status', response.data)

    def test_admin_can_delete_visa_case(self):
        visa_case = VisaCase.objects.create(
            application=self.application,
            visa_type='student_visa',
            status='preparing',
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(f'/api/visa/{visa_case.id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(VisaCase.objects.filter(pk=visa_case.id).exists())
