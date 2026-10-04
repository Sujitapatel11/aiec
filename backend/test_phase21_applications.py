import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Application, Country, Course, ProcessStep, StudentProfile


class ApplicationApiTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username='application_staff', password='StaffPass123!', is_staff=True
        )
        self.admin = User.objects.create_user(
            username='application_admin', password='AdminPass123!',
            is_staff=True, is_superuser=True,
        )
        self.student_user = User.objects.create_user(
            username='application_student', password='StudentPass123!'
        )
        self.other_student_user = User.objects.create_user(
            username='other_application_student', password='StudentPass123!'
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            full_name='Application Student',
            phone='555-0100',
            destination_country='Canada',
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_student_user,
            full_name='Other Application Student',
            phone='555-0101',
            destination_country='Australia',
        )
        self.country = Country.objects.create(
            name='Canada',
            code='CA',
            description='Study destination',
        )
        self.course = Course.objects.create(
            name='Computer Science',
            country=self.country,
            university='North University',
            level='Bachelor',
            duration='4 years',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def student_applications_url(self, student=None):
        student = student or self.student
        return f'/api/students/{student.id}/applications/'

    def application_detail_url(self, application):
        return f'/api/applications/{application.id}/'

    def create_course_application(self, intake='Fall 2026', student=None):
        return self.client.post(
            self.student_applications_url(student),
            {'course': self.course.id, 'intake': intake},
            format='json',
        )

    def test_course_selection_derives_university_and_country(self):
        response = self.create_course_application()

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['university_name'], 'North University')
        self.assertEqual(response.data['course_name'], 'Computer Science')
        self.assertEqual(response.data['country'], self.country.id)
        self.assertEqual(response.data['country_name'], 'Canada')
        self.assertEqual(response.data['status'], 'draft')

    def test_student_can_have_many_applications_and_intake_changes_are_allowed(self):
        for index in range(5):
            response = self.client.post(
                self.student_applications_url(),
                {
                    'university_name': f'University {index}',
                    'course_name': f'Course {index}',
                    'intake': f'Fall 202{index}',
                },
                format='json',
            )
            self.assertEqual(response.status_code, 201, response.data)

        first = self.create_course_application('Fall 2026')
        second = self.create_course_application('Spring 2027')

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(second.status_code, 201, second.data)
        self.assertEqual(self.student.applications.count(), 7)

    def test_duplicate_application_is_rejected_but_different_intake_is_allowed(self):
        first = self.create_course_application('Fall 2026')
        duplicate = self.create_course_application('Fall 2026')
        different_intake = self.create_course_application('Spring 2027')

        self.assertEqual(first.status_code, 201, first.data)
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(different_intake.status_code, 201, different_intake.data)
        self.assertEqual(self.student.applications.count(), 2)

    def test_null_course_duplicates_use_university_course_snapshot_and_intake(self):
        payload = {
            'university_name': 'Independent University',
            'course_name': 'Data Science',
            'intake': 'Fall 2026',
        }
        first = self.client.post(self.student_applications_url(), payload, format='json')
        duplicate = self.client.post(self.student_applications_url(), payload, format='json')
        other_intake = self.client.post(
            self.student_applications_url(),
            {**payload, 'intake': 'Spring 2027'},
            format='json',
        )

        self.assertEqual(first.status_code, 201, first.data)
        self.assertIsNone(first.data['course'])
        self.assertEqual(first.data['country_name'], '')
        self.assertEqual(duplicate.status_code, 400)
        self.assertEqual(other_intake.status_code, 201, other_intake.data)

    def test_database_constraint_blocks_duplicate_snapshots_when_course_is_null(self):
        response = self.client.post(
            self.student_applications_url(),
            {
                'university_name': 'Independent University',
                'course_name': 'Data Science',
                'intake': 'Fall 2026',
            },
            format='json',
        )
        self.assertEqual(response.status_code, 201, response.data)

        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                Application.objects.create(
                    student=self.student,
                    university_name='Independent University',
                    course_name='Data Science',
                    country_name='',
                    intake='Fall 2026',
                )

    def test_course_deletion_preserves_application_snapshots(self):
        response = self.create_course_application()
        application = Application.objects.get(pk=response.data['id'])

        self.course.delete()
        application.refresh_from_db()

        self.assertIsNone(application.course)
        self.assertEqual(application.university_name, 'North University')
        self.assertEqual(application.course_name, 'Computer Science')
        self.assertEqual(application.country_name, 'Canada')

    def test_staff_and_admin_can_create_read_and_update_but_only_admin_can_delete(self):
        created = self.create_course_application()
        application = Application.objects.get(pk=created.data['id'])
        self.assertEqual(created.status_code, 201, created.data)
        self.assertEqual(self.client.get(self.student_applications_url()).status_code, 200)
        self.assertEqual(self.client.get(self.application_detail_url(application)).status_code, 200)

        updated = self.client.patch(
            self.application_detail_url(application),
            {'status': 'under_review', 'intake': 'September 2027'},
            format='json',
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data['status'], 'under_review')
        self.assertEqual(updated.data['intake'], 'September 2027')
        self.assertEqual(self.client.delete(self.application_detail_url(application)).status_code, 403)

        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.delete(self.application_detail_url(application)).status_code, 204)
        self.assertFalse(Application.objects.filter(pk=application.pk).exists())

    def test_student_can_read_only_own_applications(self):
        own_response = self.create_course_application()
        other_response = self.create_course_application('Spring 2027', self.other_student)
        own_app = Application.objects.get(pk=own_response.data['id'])
        other_app = Application.objects.get(pk=other_response.data['id'])
        self.client.force_authenticate(user=self.student_user)

        own_list = self.client.get(self.student_applications_url())
        own_detail = self.client.get(self.application_detail_url(own_app))
        other_list = self.client.get(self.student_applications_url(self.other_student))
        other_detail = self.client.get(self.application_detail_url(other_app))

        self.assertEqual(own_list.status_code, 200)
        self.assertEqual([row['id'] for row in own_list.data], [own_app.id])
        self.assertEqual(own_detail.status_code, 200)
        self.assertEqual(other_list.status_code, 403)
        self.assertEqual(other_detail.status_code, 403)

        self.assertEqual(
            self.client.post(
                self.student_applications_url(),
                {'course': self.course.id, 'intake': 'Winter 2028'},
                format='json',
            ).status_code,
            403,
        )
        self.assertEqual(
            self.client.patch(
                self.application_detail_url(own_app), {'status': 'applied'}, format='json'
            ).status_code,
            403,
        )
        self.assertEqual(self.client.delete(self.application_detail_url(own_app)).status_code, 403)

    def test_anonymous_application_requests_are_unauthorized(self):
        self.client.force_authenticate(user=None)

        self.assertIn(self.client.get(self.student_applications_url()).status_code, (401, 403))
        self.assertIn(
            self.client.post(self.student_applications_url(), {}, format='json').status_code,
            (401, 403),
        )
        self.assertIn(self.client.get('/api/applications/1/').status_code, (401, 403))

    def test_application_statuses_and_existing_student_checklist_are_unchanged(self):
        expected_statuses = {
            'draft': 'Draft',
            'applied': 'Applied',
            'under_review': 'Under Review',
            'offer_received': 'Offer Received',
            'conditional_offer': 'Conditional Offer',
            'rejected': 'Rejected',
            'withdrawn': 'Withdrawn',
            'enrolled': 'Enrolled',
        }
        self.assertEqual(
            dict(Application.APPLICATION_STATUS_CHOICES),
            expected_statuses,
        )
        self.assertTrue(Application._meta.get_field('student').db_index)
        self.assertTrue(Application._meta.get_field('status').db_index)
        self.assertIn(
            ['student', 'status'],
            [index.fields for index in Application._meta.indexes],
        )

        step = ProcessStep.objects.create(student=self.student, step_name='Document Collection')
        application = self.create_course_application()
        response = self.client.get(f'/api/students/{self.student.id}/')
        self.client.force_authenticate(user=self.student_user)
        portal = self.client.get('/api/student-portal/my-profile/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['destination_country'], 'Canada')
        self.assertEqual([item['id'] for item in response.data['process_steps']], [step.id])
        self.assertEqual(portal.status_code, 200)
        self.assertEqual(portal.data['destination_country'], 'Canada')
        self.assertEqual(portal.data['process_steps'][0]['id'], step.id)
        self.assertEqual([item['id'] for item in portal.data['applications']], [application.data['id']])
