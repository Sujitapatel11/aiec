import os
from datetime import date
from unittest.mock import patch

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
            {'status': 'applied', 'intake': 'September 2027'},
            format='json',
        )
        self.assertEqual(updated.status_code, 200, updated.data)
        self.assertEqual(updated.data['status'], 'applied')
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
            self.client.patch(
                self.application_detail_url(other_app),
                {'status': 'applied'},
                format='json',
            ).status_code,
            403,
        )

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
        application_response = self.create_course_application()
        application = Application.objects.get(pk=application_response.data['id'])
        self.client.force_authenticate(user=None)

        self.assertIn(self.client.get(self.student_applications_url()).status_code, (401, 403))
        self.assertIn(
            self.client.post(self.student_applications_url(), {}, format='json').status_code,
            (401, 403),
        )
        self.assertIn(
            self.client.patch(
                self.application_detail_url(application),
                {'status': 'applied'},
                format='json',
            ).status_code,
            (401, 403),
        )
        self.assertIn(self.client.get('/api/applications/1/').status_code, (401, 403))

    def test_application_status_transitions_accept_valid_and_reject_invalid_changes(self):
        created = self.create_course_application()
        application = Application.objects.get(pk=created.data['id'])

        valid = self.client.patch(
            self.application_detail_url(application),
            {'status': 'applied'},
            format='json',
        )
        invalid = self.client.patch(
            self.application_detail_url(application),
            {'status': 'enrolled'},
            format='json',
        )
        unknown = self.client.patch(
            self.application_detail_url(application),
            {'status': 'random_status'},
            format='json',
        )

        self.assertEqual(valid.status_code, 200, valid.data)
        self.assertEqual(valid.data['status'], 'applied')
        self.assertEqual(invalid.status_code, 400)
        self.assertIn('status', invalid.data)
        self.assertIn('Cannot move an application', str(invalid.data['status']))
        self.assertEqual(unknown.status_code, 400)
        self.assertIn('status', unknown.data)

    def test_application_alternative_transitions_and_terminal_statuses(self):
        created = self.create_course_application()
        application = Application.objects.get(pk=created.data['id'])

        allowed_path = [
            'applied',
            'under_review',
            'offer_received',
            'conditional_offer',
            'enrolled',
        ]
        for next_status in allowed_path:
            response = self.client.patch(
                self.application_detail_url(application),
                {'status': next_status},
                format='json',
            )
            self.assertEqual(response.status_code, 200, response.data)
            application.refresh_from_db()
            self.assertEqual(application.status, next_status)

        enrolled_to_rejected = self.client.patch(
            self.application_detail_url(application),
            {'status': 'rejected'},
            format='json',
        )
        self.assertEqual(enrolled_to_rejected.status_code, 400)

        alternatives = [
            ('draft', 'withdrawn'),
            ('applied', 'withdrawn'),
            ('under_review', 'rejected'),
            ('under_review', 'withdrawn'),
            ('offer_received', 'rejected'),
            ('offer_received', 'withdrawn'),
            ('conditional_offer', 'rejected'),
            ('conditional_offer', 'withdrawn'),
        ]
        for current_status, next_status in alternatives:
            Application.objects.filter(pk=application.pk).update(status=current_status)
            response = self.client.patch(
                self.application_detail_url(application),
                {'status': next_status},
                format='json',
            )
            self.assertEqual(response.status_code, 200, response.data)
            terminal_response = self.client.patch(
                self.application_detail_url(application),
                {'status': 'enrolled'},
                format='json',
            )
            self.assertEqual(terminal_response.status_code, 400)
            Application.objects.filter(pk=application.pk).update(status='draft')

    def test_staff_and_admin_can_change_valid_application_statuses(self):
        created = self.create_course_application()
        application = Application.objects.get(pk=created.data['id'])

        staff_response = self.client.patch(
            self.application_detail_url(application),
            {'status': 'applied'},
            format='json',
        )
        self.client.force_authenticate(user=self.admin)
        admin_response = self.client.patch(
            self.application_detail_url(application),
            {'status': 'under_review'},
            format='json',
        )

        self.assertEqual(staff_response.status_code, 200, staff_response.data)
        self.assertEqual(admin_response.status_code, 200, admin_response.data)

    def test_application_intake_dates_and_derived_deadline_data(self):
        with patch('api.serializers.timezone.localdate', return_value=date(2026, 10, 4)):
            created = self.client.post(
                self.student_applications_url(),
                {
                    'course': self.course.id,
                    'intake': 'September 2027',
                    'applied_date': '2026-10-25',
                    'deadline': '2026-10-20',
                    'status': 'draft',
                },
                format='json',
            )

            self.assertEqual(created.status_code, 201, created.data)
            self.assertEqual(created.data['intake'], 'September 2027')
            self.assertEqual(created.data['applied_date'], '2026-10-25')
            self.assertEqual(created.data['deadline'], '2026-10-20')
            self.assertEqual(created.data['deadline_status'], 'upcoming')
            self.assertEqual(created.data['days_until_deadline'], 16)
            self.assertEqual(created.data['status'], 'draft')

            application = Application.objects.get(pk=created.data['id'])
            updated = self.client.patch(
                self.application_detail_url(application),
                {'intake': 'January 2028'},
                format='json',
            )
            self.assertEqual(updated.status_code, 200, updated.data)
            self.assertEqual(updated.data['intake'], 'January 2028')
            self.assertEqual(updated.data['applied_date'], '2026-10-25')
            self.assertEqual(updated.data['deadline'], '2026-10-20')
            self.assertEqual(updated.data['status'], 'draft')

    def test_deadline_statuses_and_days_until_deadline_use_local_date(self):
        test_cases = [
            (None, 'no_deadline', None),
            (date(2026, 10, 5), 'upcoming', 1),
            (date(2026, 10, 4), 'due_today', 0),
            (date(2026, 9, 29), 'overdue', -5),
        ]
        with patch('api.serializers.timezone.localdate', return_value=date(2026, 10, 4)):
            for index, (deadline, expected_status, expected_days) in enumerate(test_cases):
                application = Application.objects.create(
                    student=self.student,
                    university_name=f'Deadline University {index}',
                    course_name=f'Deadline Course {index}',
                    intake='October 2026',
                    deadline=deadline,
                )
                response = self.client.get(self.application_detail_url(application))

                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.data['deadline_status'], expected_status)
                self.assertEqual(response.data['days_until_deadline'], expected_days)

    def test_derived_deadline_fields_are_read_only_and_invalid_dates_are_rejected(self):
        application = Application.objects.create(
            student=self.student,
            university_name='Read Only University',
            course_name='Read Only Course',
            intake='Fall 2027',
            deadline=date(2026, 10, 20),
        )
        with patch('api.serializers.timezone.localdate', return_value=date(2026, 10, 4)):
            response = self.client.patch(
                self.application_detail_url(application),
                {'deadline_status': 'overdue', 'days_until_deadline': 999},
                format='json',
            )
            self.assertEqual(response.status_code, 200, response.data)
            self.assertEqual(response.data['deadline_status'], 'upcoming')
            self.assertEqual(response.data['days_until_deadline'], 16)

        invalid = self.client.post(
            self.student_applications_url(),
            {
                'university_name': 'Invalid Date University',
                'course_name': 'Invalid Date Course',
                'applied_date': '2026-02-30',
            },
            format='json',
        )
        self.assertEqual(invalid.status_code, 400)
        self.assertIn('applied_date', invalid.data)

    def test_application_list_filters_status_intake_and_deadline_status(self):
        today = date(2026, 10, 4)
        applications = [
            ('Filter University A', 'Filter Course A', 'September 2027', 'applied', date(2026, 10, 20)),
            ('Filter University B', 'Filter Course B', 'January 2028', 'draft', date(2026, 9, 29)),
            ('Filter University C', 'Filter Course C', 'May 2028', 'under_review', today),
            ('Filter University D', 'Filter Course D', 'September 2028', 'draft', None),
        ]
        for university, course, intake, app_status, deadline in applications:
            Application.objects.create(
                student=self.student,
                university_name=university,
                course_name=course,
                intake=intake,
                status=app_status,
                deadline=deadline,
            )

        with patch('api.views.timezone.localdate', return_value=today):
            status_response = self.client.get(
                self.student_applications_url(),
                {'status': 'applied'},
            )
            intake_response = self.client.get(
                self.student_applications_url(),
                {'intake': 'january 2028'},
            )
            upcoming_response = self.client.get(
                self.student_applications_url(),
                {'deadline_status': 'upcoming'},
            )
            overdue_response = self.client.get(
                self.student_applications_url(),
                {'deadline_status': 'overdue'},
            )
            due_today_response = self.client.get(
                self.student_applications_url(),
                {'deadline_status': 'due_today'},
            )
            no_deadline_response = self.client.get(
                self.student_applications_url(),
                {'deadline_status': 'no_deadline'},
            )

        self.assertEqual(len(status_response.data), 1)
        self.assertEqual(status_response.data[0]['status'], 'applied')
        self.assertEqual(len(intake_response.data), 1)
        self.assertEqual(intake_response.data[0]['intake'], 'January 2028')
        self.assertEqual(len(upcoming_response.data), 1)
        self.assertEqual(upcoming_response.data[0]['deadline_status'], 'upcoming')
        self.assertEqual(len(overdue_response.data), 1)
        self.assertEqual(overdue_response.data[0]['deadline_status'], 'overdue')
        self.assertEqual(len(due_today_response.data), 1)
        self.assertEqual(due_today_response.data[0]['deadline_status'], 'due_today')
        self.assertEqual(len(no_deadline_response.data), 1)
        self.assertEqual(no_deadline_response.data[0]['deadline_status'], 'no_deadline')

    def test_student_portal_exposes_deadline_tracking_but_not_application_notes(self):
        Application.objects.create(
            student=self.student,
            university_name='Portal University',
            course_name='Portal Course',
            country=self.country,
            country_name=self.country.name,
            status='applied',
            intake='September 2027',
            applied_date=date(2026, 10, 1),
            deadline=date(2026, 10, 20),
            notes='Internal counsellor note',
        )
        self.client.force_authenticate(user=self.student_user)

        with patch('api.serializers.timezone.localdate', return_value=date(2026, 10, 4)):
            response = self.client.get('/api/student-portal/my-profile/')

        self.assertEqual(response.status_code, 200)
        application = response.data['applications'][0]
        self.assertEqual(application['country_name'], 'Canada')
        self.assertEqual(application['status'], 'applied')
        self.assertEqual(application['intake'], 'September 2027')
        self.assertEqual(application['applied_date'], '2026-10-01')
        self.assertEqual(application['deadline'], '2026-10-20')
        self.assertEqual(application['deadline_status'], 'upcoming')
        self.assertEqual(application['days_until_deadline'], 16)
        self.assertNotIn('notes', application)

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
