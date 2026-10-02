import os
from datetime import timedelta
from django.utils import timezone

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient
from api.models import Lead, CounsellingNote, FollowUp, Task, Appointment


class CounsellingWorkflowTests(TestCase):
    def setUp(self):
        staff_group, _ = Group.objects.get_or_create(name='Staff')
        student_group, _ = Group.objects.get_or_create(name='Student')

        self.admin = User.objects.create_user(
            username='counsel_admin', password='AdminPass123!', first_name='Admin', is_staff=True, is_superuser=True
        )
        self.staff = User.objects.create_user(
            username='counsel_staff', password='StaffPass123!', first_name='Staff', is_staff=True
        )
        self.staff.groups.add(staff_group)

        self.student = User.objects.create_user(
            username='counsel_student', password='StudentPass123!', first_name='Student'
        )
        self.student.groups.add(student_group)

        self.client = APIClient()
        self.lead = Lead.objects.create(
            name='Test Counselling Lead',
            email='counsel.lead@example.com',
            phone='+977 98000 77777',
            status='new'
        )

    def authenticate(self, user):
        if user:
            self.client.force_authenticate(user=user)
        else:
            self.client.force_authenticate(user=None)

    # 1. Counselling Notes Tests
    def test_counselling_notes_permissions_and_creation(self):
        # Admin can create note
        self.authenticate(self.admin)
        resp = self.client.post('/api/counselling-notes/', {
            'lead': self.lead.id,
            'content': 'Discussed Canada vs UK options with student.'
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()['author_name'], 'Admin')

        # Staff can create note
        self.authenticate(self.staff)
        resp_staff = self.client.post('/api/counselling-notes/', {
            'lead': self.lead.id,
            'content': 'Requested student to send 10th and 12th transcripts.'
        }, format='json')
        self.assertEqual(resp_staff.status_code, 201)

        # Student is rejected (403)
        self.authenticate(self.student)
        resp_student = self.client.post('/api/counselling-notes/', {
            'lead': self.lead.id,
            'content': 'Unauthorized student note'
        }, format='json')
        self.assertEqual(resp_student.status_code, 403)

        # Anonymous is rejected (401/403)
        self.authenticate(None)
        resp_anon = self.client.post('/api/counselling-notes/', {
            'lead': self.lead.id,
            'content': 'Anonymous note'
        }, format='json')
        self.assertIn(resp_anon.status_code, (401, 403))

    def test_invalid_note_rejected(self):
        self.authenticate(self.admin)
        resp = self.client.post('/api/counselling-notes/', {
            'lead': self.lead.id,
            'content': ''
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    # 2. FollowUp Tests
    def test_followup_permissions_creation_and_overdue(self):
        due_future = (timezone.now() + timedelta(days=2)).isoformat()

        # Admin creates follow-up
        self.authenticate(self.admin)
        resp = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'assigned_to': self.staff.id,
            'title': 'Call student after IELTS exam',
            'due_at': due_future,
            'priority': 'high'
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        self.assertEqual(resp.json()['assigned_to_name'], 'Staff')

        # Staff creates follow-up
        self.authenticate(self.staff)
        resp_staff = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'title': 'Verify financial documents',
            'due_at': due_future,
            'priority': 'medium'
        }, format='json')
        self.assertEqual(resp_staff.status_code, 201)

        # Student is rejected
        self.authenticate(self.student)
        resp_student = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'title': 'Student attempt',
            'due_at': due_future
        }, format='json')
        self.assertEqual(resp_student.status_code, 403)

    def test_followup_status_update_and_assignment(self):
        due_future = (timezone.now() + timedelta(days=1)).isoformat()
        self.authenticate(self.admin)
        create_resp = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'title': 'Check offer letter status',
            'due_at': due_future
        }, format='json')
        followup_id = create_resp.json()['id']

        # Complete follow-up
        self.authenticate(self.staff)
        update_resp = self.client.patch(f'/api/follow-ups/{followup_id}/', {
            'status': 'completed'
        }, format='json')
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(update_resp.json()['status'], 'completed')
        self.assertIsNotNone(update_resp.json()['completed_at'])

    def test_overdue_followup_filtering(self):
        due_past = (timezone.now() - timedelta(days=2)).isoformat()
        self.authenticate(self.admin)
        FollowUp.objects.create(
            lead=self.lead,
            title='Overdue Task',
            due_at=timezone.now() - timedelta(days=2),
            status='pending'
        )
        self.authenticate(self.staff)
        resp = self.client.get('/api/follow-ups/?overdue=true')
        self.assertEqual(resp.status_code, 200)
        results = resp.json()['results'] if 'results' in resp.json() else resp.json()
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['title'], 'Overdue Task')

    # 3. Task Management Tests
    def test_task_permissions_validation_completion(self):
        due_date = (timezone.now() + timedelta(days=3)).isoformat()

        # Admin & Staff allowed
        self.authenticate(self.admin)
        task_resp = self.client.post('/api/tasks/', {
            'lead': self.lead.id,
            'assigned_to': self.staff.id,
            'title': 'Send university shortlist brochure',
            'due_at': due_date,
            'priority': 'high'
        }, format='json')
        self.assertEqual(task_resp.status_code, 201)
        task_id = task_resp.json()['id']

        # Student rejected
        self.authenticate(self.student)
        self.assertEqual(self.client.post('/api/tasks/', {'title': 'Invalid'}, format='json').status_code, 403)

        # Staff completes task
        self.authenticate(self.staff)
        complete_resp = self.client.patch(f'/api/tasks/{task_id}/', {'status': 'completed'}, format='json')
        self.assertEqual(complete_resp.status_code, 200)
        self.assertEqual(complete_resp.json()['status'], 'completed')

    # 4. Appointment Management Tests
    def test_appointment_creation_and_update(self):
        app_date = (timezone.now() + timedelta(days=5)).isoformat()

        # Admin schedules appointment
        self.authenticate(self.admin)
        app_resp = self.client.post('/api/appointments/', {
            'lead': self.lead.id,
            'assigned_to': self.staff.id,
            'title': 'University Selection & Visa Session',
            'appointment_date': app_date,
            'duration_minutes': 45,
            'location_mode': 'Zoom Meeting'
        }, format='json')
        self.assertEqual(app_resp.status_code, 201)
        app_id = app_resp.json()['id']

        # Student rejected
        self.authenticate(self.student)
        self.assertEqual(self.client.post('/api/appointments/', {'title': 'Test'}, format='json').status_code, 403)

        # Staff updates status to completed
        self.authenticate(self.staff)
        update_resp = self.client.patch(f'/api/appointments/{app_id}/', {'status': 'completed'}, format='json')
        self.assertEqual(update_resp.status_code, 200)
        self.assertEqual(update_resp.json()['status'], 'completed')
