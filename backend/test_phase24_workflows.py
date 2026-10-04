import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import (
    Application,
    ApplicationWorkflowProgress,
    Country,
    CountryWorkflow,
    CountryWorkflowStep,
    StudentProfile,
)


class ApplicationWorkflowTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username='workflow_staff', password='StaffPass123!', is_staff=True
        )
        self.student_user = User.objects.create_user(
            username='workflow_student', password='StudentPass123!'
        )
        self.other_student_user = User.objects.create_user(
            username='workflow_other_student', password='StudentPass123!'
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            full_name='Workflow Student',
            phone='555-0200',
            destination_country='Canada',
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_student_user,
            full_name='Other Workflow Student',
            phone='555-0201',
            destination_country='Canada',
        )
        self.country = Country.objects.filter(name__iexact='Canada').first()
        self.assertIsNotNone(self.country)
        self.workflow = CountryWorkflow.objects.get(country=self.country, active=True)
        self.step = self.workflow.steps.first()
        self.application = Application.objects.create(
            student=self.student,
            university_name='Workflow University',
            course_name='Computer Science',
            country=self.country,
            country_name=self.country.name,
            intake='Fall 2027',
        )
        self.other_application = Application.objects.create(
            student=self.other_student,
            university_name='Other University',
            course_name='Engineering',
            country=self.country,
            country_name=self.country.name,
            intake='Fall 2027',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def completion_url(self, application=None, step=None):
        application = application or self.application
        step = step or self.step
        return f'/api/applications/{application.id}/workflow-steps/{step.id}/complete/'

    def test_default_country_workflows_and_steps_are_seeded(self):
        expected = {'United Kingdom', 'Canada', 'Australia', 'United States', 'Germany'}
        actual = set(
            CountryWorkflow.objects.filter(active=True).values_list('country__name', flat=True)
        )
        self.assertTrue(expected.issubset(actual))
        for country_name in expected:
            workflow = CountryWorkflow.objects.get(country__name=country_name, active=True)
            self.assertGreaterEqual(workflow.steps.count(), 5)
            self.assertEqual(
                list(workflow.steps.values_list('order', flat=True)),
                sorted(workflow.steps.values_list('order', flat=True)),
            )

    def test_staff_can_complete_a_milestone_idempotently(self):
        first = self.client.post(self.completion_url(), {}, format='json')
        repeated = self.client.post(self.completion_url(), {}, format='json')

        self.assertEqual(first.status_code, 200, first.data)
        self.assertEqual(repeated.status_code, 200, repeated.data)
        step = next(item for item in first.data['workflow_steps'] if item['id'] == self.step.id)
        self.assertTrue(step['completed'])
        self.assertEqual(
            ApplicationWorkflowProgress.objects.filter(
                application=self.application,
                workflow_step=self.step,
            ).count(),
            1,
        )
        progress = ApplicationWorkflowProgress.objects.get(application=self.application)
        self.assertEqual(progress.completed_by, self.staff)
        self.assertIsNotNone(progress.completed_at)

    def test_workflow_step_from_another_country_is_rejected(self):
        australia = Country.objects.get(name='Australia')
        australia_step = CountryWorkflow.objects.get(country=australia, active=True).steps.first()

        response = self.client.post(
            self.completion_url(step=australia_step),
            {},
            format='json',
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(ApplicationWorkflowProgress.objects.filter(application=self.application).exists())

    def test_student_can_read_only_own_application_and_cannot_complete_milestones(self):
        own_url = f'/api/applications/{self.application.id}/'
        other_url = f'/api/applications/{self.other_application.id}/'
        own_list_url = f'/api/students/{self.student.id}/applications/'
        other_list_url = f'/api/students/{self.other_student.id}/applications/'
        self.client.force_authenticate(user=self.student_user)

        self.assertEqual(self.client.get(own_url).status_code, 200)
        self.assertEqual(self.client.get(own_list_url).status_code, 200)
        self.assertEqual(self.client.get(other_url).status_code, 403)
        self.assertEqual(self.client.get(other_list_url).status_code, 403)
        self.assertEqual(self.client.post(self.completion_url(), {}, format='json').status_code, 403)

    def test_anonymous_user_cannot_read_application_or_complete_milestone(self):
        self.client.force_authenticate(user=None)

        self.assertEqual(
            self.client.get(f'/api/applications/{self.application.id}/').status_code,
            401,
        )
        self.assertEqual(self.client.post(self.completion_url(), {}, format='json').status_code, 401)

    def test_country_can_change_before_progress_but_not_after(self):
        germany = Country.objects.get(name='Germany')
        detail_url = f'/api/applications/{self.application.id}/'
        before_progress = self.client.patch(
            detail_url,
            {'country': germany.id, 'country_name': germany.name},
            format='json',
        )
        self.assertEqual(before_progress.status_code, 200, before_progress.data)
        self.assertEqual(before_progress.data['country'], germany.id)

        germany_step = CountryWorkflow.objects.get(country=germany, active=True).steps.first()
        self.client.post(
            self.completion_url(step=germany_step),
            {},
            format='json',
        )
        blocked_snapshot_change = self.client.patch(
            detail_url,
            {'country_name': 'Japan'},
            format='json',
        )
        blocked_change = self.client.patch(
            detail_url,
            {'country': self.country.id, 'country_name': self.country.name},
            format='json',
        )

        self.assertEqual(blocked_snapshot_change.status_code, 400)
        self.assertEqual(blocked_change.status_code, 400)
        self.assertIn('country', blocked_change.data)

    def test_students_can_have_multiple_application_specific_progress_records(self):
        second = Application.objects.create(
            student=self.student,
            university_name='Second Workflow University',
            course_name='Data Science',
            country=self.country,
            country_name=self.country.name,
            intake='Spring 2028',
        )

        self.assertEqual(self.client.post(self.completion_url(), {}, format='json').status_code, 200)
        second_response = self.client.post(
            self.completion_url(application=second),
            {},
            format='json',
        )

        self.assertEqual(second_response.status_code, 200, second_response.data)
        self.assertEqual(self.student.applications.count(), 2)
        self.assertEqual(ApplicationWorkflowProgress.objects.filter(application__student=self.student).count(), 2)

    def test_each_application_serializes_pending_steps_without_creating_progress(self):
        response = self.client.get(f'/api/applications/{self.application.id}/')

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['workflow_name'], self.workflow.name)
        self.assertTrue(response.data['workflow_steps'])
        self.assertTrue(all(not step['completed'] for step in response.data['workflow_steps']))
        self.assertFalse(ApplicationWorkflowProgress.objects.filter(application=self.application).exists())

    def test_duplicate_country_active_workflow_is_blocked(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CountryWorkflow.objects.create(
                    country=self.country,
                    name='Second active workflow',
                    active=True,
                )

    def test_workflow_step_progress_unique_per_application(self):
        self.client.post(self.completion_url(), {}, format='json')

        self.assertEqual(
            ApplicationWorkflowProgress.objects.filter(
                application=self.application,
                workflow_step=self.step,
            ).count(),
            1,
        )
