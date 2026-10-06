import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Application, Country, Course, Enrollment, StudentProfile


class EnrollmentApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='enroll_admin', password='AdminPass123!', is_staff=True, is_superuser=True,
        )
        self.staff = User.objects.create_user(
            username='enroll_staff', password='StaffPass123!', is_staff=True,
        )
        self.student_user = User.objects.create_user(
            username='enroll_student', password='StudentPass123!'
        )
        self.other_student_user = User.objects.create_user(
            username='other_enroll_student', password='StudentPass123!'
        )

        self.student = StudentProfile.objects.create(
            user=self.student_user,
            full_name='Enrollment Student',
            phone='555-0100',
            destination_country='Canada',
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_student_user,
            full_name='Other Enrollment Student',
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

    def test_staff_can_create_and_list_enrollment(self):
        response = self.client.post(
            f'/api/applications/{self.application.id}/enrollment/',
            {
                'status': 'pending',
                'enrollment_date': '2026-10-01',
                'student_reference': 'REF-1001',
                'notes': 'Awaiting final confirmation',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['application'], self.application.id)
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(response.data['university_name'], 'North University')

        list_response = self.client.get(f'/api/applications/{self.application.id}/enrollment/')
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(list_response.data['status'], 'pending')

    def test_student_can_view_only_own_enrollment_and_cannot_modify(self):
        enrollment = Enrollment.objects.create(
            application=self.application,
            status='pending',
            university_name='North University',
            course_name='Computer Science',
            intake='Fall 2027',
        )
        other_enrollment = Enrollment.objects.create(
            application=self.other_application,
            status='pending',
            university_name='Other University',
            course_name='Other Course',
            intake='Fall 2027',
        )

        self.client.force_authenticate(user=self.student_user)

        own_get = self.client.get(f'/api/applications/{self.application.id}/enrollment/')
        own_detail = self.client.get(f'/api/enrollments/{enrollment.id}/')
        other_get = self.client.get(f'/api/applications/{self.other_application.id}/enrollment/')
        other_detail = self.client.get(f'/api/enrollments/{other_enrollment.id}/')

        self.assertEqual(own_get.status_code, 200)
        self.assertEqual(own_detail.status_code, 200)
        self.assertEqual(other_get.status_code, 403)
        self.assertEqual(other_detail.status_code, 403)
        self.assertEqual(
            self.client.patch(f'/api/enrollments/{enrollment.id}/', {'status': 'confirmed'}, format='json').status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                f'/api/applications/{self.application.id}/enrollment/',
                {'status': 'pending'},
                format='json',
            ).status_code,
            403,
        )

    def test_duplicate_enrollment_on_same_application_is_rejected(self):
        Enrollment.objects.create(
            application=self.application,
            status='pending',
            university_name='North University',
            course_name='Computer Science',
            intake='Fall 2027',
        )

        response = self.client.post(
            f'/api/applications/{self.application.id}/enrollment/',
            {'status': 'pending'},
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('error', response.data)

    def test_invalid_status_transition_is_rejected(self):
        enrollment = Enrollment.objects.create(
            application=self.application,
            status='pending',
            university_name='North University',
            course_name='Computer Science',
            intake='Fall 2027',
        )

        response = self.client.patch(
            f'/api/enrollments/{enrollment.id}/',
            {'status': 'enrolled'},
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('status', response.data)

    def test_create_requires_pending_status(self):
        response = self.client.post(
            f'/api/applications/{self.application.id}/enrollment/',
            {'status': 'confirmed'},
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('status', response.data)

    def test_admin_can_delete_enrollment(self):
        enrollment = Enrollment.objects.create(
            application=self.application,
            status='pending',
            university_name='North University',
            course_name='Computer Science',
            intake='Fall 2027',
        )
        self.client.force_authenticate(user=self.admin)

        response = self.client.delete(f'/api/enrollments/{enrollment.id}/')

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Enrollment.objects.filter(pk=enrollment.id).exists())
