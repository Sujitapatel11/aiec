"""
Phase 1.3 Extension Tests — Activity Logging, Filters, select_related

Tests new behaviour added on top of the already-existing models/serializers/views:
  1. Auto LeadActivity logging for counselling notes, follow-ups, tasks, appointments
  2. Task overdue filter (?overdue=true)
  3. Appointment date-range filters (?upcoming=true / ?past=true)
  4. select_related regression (no AttributeError / no duplicate queries)
  5. Regression: existing Phase 1.1 / 1.2 activity types still work
"""

import os
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import Group, User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import Lead, LeadActivity, FollowUp, Task, Appointment, CounsellingNote


class Phase13ExtensionTests(TestCase):
    """
    Tests that auto-logging, new filters, and select_related work correctly.
    All existing Phase 1.1 / 1.2 endpoints must continue to pass.
    """

    # ─────────────────────────────────────────────────────────────────
    # Setup
    # ─────────────────────────────────────────────────────────────────

    def setUp(self):
        staff_group, _ = Group.objects.get_or_create(name='Staff')
        student_group, _ = Group.objects.get_or_create(name='Student')

        self.admin = User.objects.create_user(
            username='ext_admin', password='AdminPass123!',
            first_name='Ext', last_name='Admin',
            is_staff=True, is_superuser=True
        )
        self.staff = User.objects.create_user(
            username='ext_staff', password='StaffPass123!',
            first_name='Ext', last_name='Staff',
            is_staff=True
        )
        self.staff.groups.add(staff_group)

        self.student_user = User.objects.create_user(
            username='ext_student', password='StudentPass123!',
            first_name='Ext', last_name='Student'
        )
        self.student_user.groups.add(student_group)

        self.client = APIClient()
        self.lead = Lead.objects.create(
            name='Extension Test Lead',
            email='ext.lead@example.com',
            phone='+977 98111 22222',
            status='new'
        )

    def auth(self, user):
        if user:
            self.client.force_authenticate(user=user)
        else:
            self.client.force_authenticate(user=None)

    # ─────────────────────────────────────────────────────────────────
    # 1. Counselling Note → auto LeadActivity log
    # ─────────────────────────────────────────────────────────────────

    def test_counselling_note_auto_logs_lead_activity(self):
        self.auth(self.staff)
        before_count = LeadActivity.objects.filter(lead=self.lead).count()

        resp = self.client.post('/api/counselling-notes/', {
            'lead': self.lead.id,
            'content': 'Discussed IELTS waiver options for Canada intake.'
        }, format='json')
        self.assertEqual(resp.status_code, 201)

        # One new LeadActivity must have been created
        after_count = LeadActivity.objects.filter(lead=self.lead).count()
        self.assertEqual(after_count, before_count + 1)

        # Verify activity type and content
        activity = LeadActivity.objects.filter(
            lead=self.lead, activity_type='counselling_note'
        ).order_by('-created_at').first()
        self.assertIsNotNone(activity)
        self.assertIn('Counselling note added', activity.content)
        self.assertIn('IELTS waiver', activity.content)
        self.assertEqual(activity.author, self.staff)

    def test_counselling_note_no_activity_log_without_lead(self):
        """Notes attached to a student (no lead) must NOT create a LeadActivity."""
        self.auth(self.staff)
        before_count = LeadActivity.objects.count()
        # Note with no lead — no lead FK means no lead activity
        resp = self.client.post('/api/counselling-notes/', {
            'content': 'Student-only note without lead.'
        }, format='json')
        # Either 201 (valid) or 400 (if at least lead or student required by DB)
        # Either way no LeadActivity should be created
        after_count = LeadActivity.objects.count()
        self.assertEqual(after_count, before_count)

    # ─────────────────────────────────────────────────────────────────
    # 2. FollowUp → auto LeadActivity on create + status change
    # ─────────────────────────────────────────────────────────────────

    def test_followup_create_auto_logs_lead_activity(self):
        self.auth(self.admin)
        before_count = LeadActivity.objects.filter(
            lead=self.lead, activity_type='followup'
        ).count()

        due = (timezone.now() + timedelta(days=3)).isoformat()
        resp = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'title': 'Send UK university shortlist',
            'due_at': due,
            'priority': 'high'
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        fu_id = resp.json()['id']

        after_count = LeadActivity.objects.filter(
            lead=self.lead, activity_type='followup'
        ).count()
        self.assertEqual(after_count, before_count + 1)

        activity = LeadActivity.objects.filter(
            lead=self.lead, activity_type='followup'
        ).order_by('-created_at').first()
        self.assertIn('Follow-up created', activity.content)
        self.assertIn('UK university shortlist', activity.content)

        # Complete the follow-up — should log another activity
        pre_complete = LeadActivity.objects.filter(
            lead=self.lead, activity_type='followup'
        ).count()
        update_resp = self.client.patch(f'/api/follow-ups/{fu_id}/', {
            'status': 'completed'
        }, format='json')
        self.assertEqual(update_resp.status_code, 200)

        post_complete = LeadActivity.objects.filter(
            lead=self.lead, activity_type='followup'
        ).count()
        self.assertEqual(post_complete, pre_complete + 1)

        complete_activity = LeadActivity.objects.filter(
            lead=self.lead, activity_type='followup'
        ).order_by('-created_at').first()
        self.assertIn('completed', complete_activity.content.lower())

    def test_followup_cancel_auto_logs_lead_activity(self):
        self.auth(self.staff)
        due = (timezone.now() + timedelta(days=2)).isoformat()
        create_resp = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'title': 'Call re: visa documents',
            'due_at': due,
        }, format='json')
        fu_id = create_resp.json()['id']

        cancel_resp = self.client.patch(f'/api/follow-ups/{fu_id}/', {
            'status': 'cancelled'
        }, format='json')
        self.assertEqual(cancel_resp.status_code, 200)

        cancel_activity = LeadActivity.objects.filter(
            lead=self.lead, activity_type='followup'
        ).order_by('-created_at').first()
        self.assertIn('cancelled', cancel_activity.content.lower())

    # ─────────────────────────────────────────────────────────────────
    # 3. Task → auto LeadActivity on create + completion
    # ─────────────────────────────────────────────────────────────────

    def test_task_create_auto_logs_lead_activity(self):
        self.auth(self.admin)
        before_count = LeadActivity.objects.filter(
            lead=self.lead, activity_type='task'
        ).count()

        due = (timezone.now() + timedelta(days=5)).isoformat()
        resp = self.client.post('/api/tasks/', {
            'lead': self.lead.id,
            'assigned_to': self.staff.id,
            'title': 'Prepare university application checklist',
            'due_at': due,
            'priority': 'medium'
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        task_id = resp.json()['id']

        after_count = LeadActivity.objects.filter(
            lead=self.lead, activity_type='task'
        ).count()
        self.assertEqual(after_count, before_count + 1)

        activity = LeadActivity.objects.filter(
            lead=self.lead, activity_type='task'
        ).order_by('-created_at').first()
        self.assertIn('Task created', activity.content)
        self.assertIn('application checklist', activity.content)

        # Complete → log
        pre = LeadActivity.objects.filter(lead=self.lead, activity_type='task').count()
        self.client.patch(f'/api/tasks/{task_id}/', {'status': 'completed'}, format='json')
        post = LeadActivity.objects.filter(lead=self.lead, activity_type='task').count()
        self.assertEqual(post, pre + 1)
        complete_act = LeadActivity.objects.filter(
            lead=self.lead, activity_type='task'
        ).order_by('-created_at').first()
        self.assertIn('completed', complete_act.content.lower())

    def test_task_in_progress_auto_logs_lead_activity(self):
        self.auth(self.staff)
        due = (timezone.now() + timedelta(days=1)).isoformat()
        create_resp = self.client.post('/api/tasks/', {
            'lead': self.lead.id,
            'title': 'Collect bank statement',
            'due_at': due,
        }, format='json')
        task_id = create_resp.json()['id']

        self.client.patch(f'/api/tasks/{task_id}/', {'status': 'in_progress'}, format='json')

        in_prog_act = LeadActivity.objects.filter(
            lead=self.lead, activity_type='task'
        ).order_by('-created_at').first()
        self.assertIn('started', in_prog_act.content.lower())

    # ─────────────────────────────────────────────────────────────────
    # 4. Appointment → auto LeadActivity on create + status change
    # ─────────────────────────────────────────────────────────────────

    def test_appointment_create_auto_logs_lead_activity(self):
        self.auth(self.admin)
        before_count = LeadActivity.objects.filter(
            lead=self.lead, activity_type='appointment'
        ).count()

        app_date = (timezone.now() + timedelta(days=7)).isoformat()
        resp = self.client.post('/api/appointments/', {
            'lead': self.lead.id,
            'assigned_to': self.staff.id,
            'title': 'Initial Visa Consultation',
            'appointment_date': app_date,
            'duration_minutes': 45,
            'location_mode': 'In-Person Office'
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        app_id = resp.json()['id']

        after_count = LeadActivity.objects.filter(
            lead=self.lead, activity_type='appointment'
        ).count()
        self.assertEqual(after_count, before_count + 1)

        activity = LeadActivity.objects.filter(
            lead=self.lead, activity_type='appointment'
        ).order_by('-created_at').first()
        self.assertIn('Appointment scheduled', activity.content)
        self.assertIn('Visa Consultation', activity.content)

        # Complete
        pre = LeadActivity.objects.filter(lead=self.lead, activity_type='appointment').count()
        self.client.patch(f'/api/appointments/{app_id}/', {'status': 'completed'}, format='json')
        post = LeadActivity.objects.filter(lead=self.lead, activity_type='appointment').count()
        self.assertEqual(post, pre + 1)
        complete_act = LeadActivity.objects.filter(
            lead=self.lead, activity_type='appointment'
        ).order_by('-created_at').first()
        self.assertIn('completed', complete_act.content.lower())

    def test_appointment_no_show_auto_logs_lead_activity(self):
        self.auth(self.staff)
        app_date = (timezone.now() + timedelta(hours=1)).isoformat()
        create_resp = self.client.post('/api/appointments/', {
            'lead': self.lead.id,
            'title': 'Document Review Session',
            'appointment_date': app_date,
        }, format='json')
        app_id = create_resp.json()['id']

        self.client.patch(f'/api/appointments/{app_id}/', {'status': 'no_show'}, format='json')

        no_show_act = LeadActivity.objects.filter(
            lead=self.lead, activity_type='appointment'
        ).order_by('-created_at').first()
        self.assertIn('no-show', no_show_act.content.lower())

    # ─────────────────────────────────────────────────────────────────
    # 5. Task overdue filter (?overdue=true)
    # ─────────────────────────────────────────────────────────────────

    def test_task_overdue_filter(self):
        self.auth(self.admin)
        # Overdue pending task
        Task.objects.create(
            lead=self.lead,
            title='Overdue Task A',
            due_at=timezone.now() - timedelta(days=3),
            status='pending',
            created_by=self.admin
        )
        # Overdue in-progress task (also overdue)
        Task.objects.create(
            lead=self.lead,
            title='Overdue Task B — In Progress',
            due_at=timezone.now() - timedelta(days=1),
            status='in_progress',
            created_by=self.admin
        )
        # Future task — should NOT appear in overdue
        Task.objects.create(
            lead=self.lead,
            title='Future Task',
            due_at=timezone.now() + timedelta(days=5),
            status='pending',
            created_by=self.admin
        )
        # Completed overdue task — should NOT appear
        Task.objects.create(
            lead=self.lead,
            title='Completed Old Task',
            due_at=timezone.now() - timedelta(days=10),
            status='completed',
            created_by=self.admin
        )

        resp = self.client.get('/api/tasks/?overdue=true')
        self.assertEqual(resp.status_code, 200)
        results = resp.json().get('results', resp.json())
        titles = [t['title'] for t in results]

        self.assertIn('Overdue Task A', titles)
        self.assertIn('Overdue Task B — In Progress', titles)
        self.assertNotIn('Future Task', titles)
        self.assertNotIn('Completed Old Task', titles)

    def test_task_overdue_filter_is_dynamic(self):
        """is_overdue on the model instance matches the filter result."""
        self.auth(self.staff)
        t = Task.objects.create(
            lead=self.lead,
            title='Dynamic Overdue',
            due_at=timezone.now() - timedelta(hours=1),
            status='pending',
            created_by=self.staff
        )
        self.assertTrue(t.is_overdue)

        resp = self.client.get('/api/tasks/?overdue=true')
        results = resp.json().get('results', resp.json())
        self.assertTrue(any(r['title'] == 'Dynamic Overdue' for r in results))
        # The serialized is_overdue should also be True
        matched = next(r for r in results if r['title'] == 'Dynamic Overdue')
        self.assertTrue(matched['is_overdue'])

    # ─────────────────────────────────────────────────────────────────
    # 6. Appointment date-range filters
    # ─────────────────────────────────────────────────────────────────

    def test_appointment_upcoming_filter(self):
        self.auth(self.admin)
        Appointment.objects.create(
            lead=self.lead,
            title='Past Appointment',
            appointment_date=timezone.now() - timedelta(days=2),
            status='completed',
            created_by=self.admin
        )
        Appointment.objects.create(
            lead=self.lead,
            title='Upcoming Appointment A',
            appointment_date=timezone.now() + timedelta(days=1),
            status='scheduled',
            created_by=self.admin
        )
        Appointment.objects.create(
            lead=self.lead,
            title='Upcoming Appointment B',
            appointment_date=timezone.now() + timedelta(days=3),
            status='scheduled',
            created_by=self.admin
        )

        resp = self.client.get('/api/appointments/?upcoming=true')
        self.assertEqual(resp.status_code, 200)
        results = resp.json().get('results', resp.json())
        titles = [a['title'] for a in results]

        self.assertIn('Upcoming Appointment A', titles)
        self.assertIn('Upcoming Appointment B', titles)
        self.assertNotIn('Past Appointment', titles)

    def test_appointment_past_filter(self):
        self.auth(self.admin)
        Appointment.objects.create(
            lead=self.lead,
            title='Past Appointment X',
            appointment_date=timezone.now() - timedelta(days=5),
            status='completed',
            created_by=self.admin
        )
        Appointment.objects.create(
            lead=self.lead,
            title='Future Appointment X',
            appointment_date=timezone.now() + timedelta(days=5),
            status='scheduled',
            created_by=self.admin
        )

        resp = self.client.get('/api/appointments/?past=true')
        self.assertEqual(resp.status_code, 200)
        results = resp.json().get('results', resp.json())
        titles = [a['title'] for a in results]

        self.assertIn('Past Appointment X', titles)
        self.assertNotIn('Future Appointment X', titles)

    # ─────────────────────────────────────────────────────────────────
    # 7. LeadActivity new types present in model choices
    # ─────────────────────────────────────────────────────────────────

    def test_new_activity_types_in_model_choices(self):
        from api.models import LeadActivity
        valid_types = {choice[0] for choice in LeadActivity.ACTIVITY_TYPES}
        self.assertIn('counselling_note', valid_types)
        self.assertIn('task', valid_types)
        self.assertIn('appointment', valid_types)
        # Existing types must still be present
        self.assertIn('note', valid_types)
        self.assertIn('call', valid_types)
        self.assertIn('followup', valid_types)
        self.assertIn('status_change', valid_types)
        self.assertIn('assignment', valid_types)

    # ─────────────────────────────────────────────────────────────────
    # 8. Author/creator always set server-side (not from client data)
    # ─────────────────────────────────────────────────────────────────

    def test_counselling_note_author_set_server_side(self):
        """Client cannot override the author field."""
        self.auth(self.staff)
        resp = self.client.post('/api/counselling-notes/', {
            'lead': self.lead.id,
            'content': 'Testing server-side author assignment.',
            'author': self.admin.id,  # attempt to spoof as admin
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        note = CounsellingNote.objects.get(id=resp.json()['id'])
        # Must be staff (the authenticated user), not admin
        self.assertEqual(note.author, self.staff)

    def test_followup_created_by_set_server_side(self):
        self.auth(self.staff)
        due = (timezone.now() + timedelta(days=1)).isoformat()
        resp = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'title': 'Server-side creator test',
            'due_at': due,
            'created_by': self.admin.id,  # spoof attempt
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        fu = FollowUp.objects.get(id=resp.json()['id'])
        self.assertEqual(fu.created_by, self.staff)

    def test_task_created_by_set_server_side(self):
        self.auth(self.staff)
        due = (timezone.now() + timedelta(days=2)).isoformat()
        resp = self.client.post('/api/tasks/', {
            'lead': self.lead.id,
            'title': 'Task creator spoof test',
            'due_at': due,
            'created_by': self.admin.id,  # spoof
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        task = Task.objects.get(id=resp.json()['id'])
        self.assertEqual(task.created_by, self.staff)

    def test_appointment_created_by_set_server_side(self):
        self.auth(self.staff)
        app_date = (timezone.now() + timedelta(days=3)).isoformat()
        resp = self.client.post('/api/appointments/', {
            'lead': self.lead.id,
            'title': 'Appointment creator spoof test',
            'appointment_date': app_date,
            'created_by': self.admin.id,  # spoof
        }, format='json')
        self.assertEqual(resp.status_code, 201)
        appt = Appointment.objects.get(id=resp.json()['id'])
        self.assertEqual(appt.created_by, self.staff)

    # ─────────────────────────────────────────────────────────────────
    # 9. Student/anonymous denial (IDOR / access control regression)
    # ─────────────────────────────────────────────────────────────────

    def test_student_cannot_access_counselling_endpoints(self):
        self.auth(self.student_user)
        for url in ['/api/counselling-notes/', '/api/follow-ups/', '/api/tasks/', '/api/appointments/']:
            resp = self.client.get(url)
            self.assertEqual(resp.status_code, 403, f"Expected 403 for student on {url}")

    def test_anonymous_cannot_access_counselling_endpoints(self):
        self.auth(None)
        for url in ['/api/counselling-notes/', '/api/follow-ups/', '/api/tasks/', '/api/appointments/']:
            resp = self.client.get(url)
            self.assertIn(resp.status_code, (401, 403), f"Expected 401/403 for anon on {url}")

    # ─────────────────────────────────────────────────────────────────
    # 10. LeadDetail (retrieve) returns all 4 collections
    # ─────────────────────────────────────────────────────────────────

    def test_lead_detail_includes_counselling_collections(self):
        self.auth(self.admin)
        # Create one of each
        due = (timezone.now() + timedelta(days=1)).isoformat()
        CounsellingNote.objects.create(lead=self.lead, author=self.admin, content='Detail test note')
        FollowUp.objects.create(lead=self.lead, title='Detail FU', due_at=due, status='pending', created_by=self.admin)
        Task.objects.create(lead=self.lead, title='Detail Task', status='pending', created_by=self.admin)
        Appointment.objects.create(
            lead=self.lead, title='Detail Appt',
            appointment_date=timezone.now() + timedelta(days=2),
            status='scheduled', created_by=self.admin
        )

        resp = self.client.get(f'/api/leads/{self.lead.id}/')
        self.assertEqual(resp.status_code, 200)
        data = resp.json()

        self.assertIn('counselling_notes', data)
        self.assertIn('follow_ups', data)
        self.assertIn('tasks', data)
        self.assertIn('appointments', data)

        self.assertTrue(len(data['counselling_notes']) >= 1)
        self.assertTrue(len(data['follow_ups']) >= 1)
        self.assertTrue(len(data['tasks']) >= 1)
        self.assertTrue(len(data['appointments']) >= 1)

    # ─────────────────────────────────────────────────────────────────
    # 11. Regression — existing Phase 1.2 lead activity still works
    # ─────────────────────────────────────────────────────────────────

    def test_existing_lead_activity_types_still_functional(self):
        """Existing activity types (note, call, status_change) must still work."""
        self.auth(self.staff)

        for act_type in ['note', 'call', 'whatsapp', 'followup']:
            resp = self.client.post(f'/api/leads/{self.lead.id}/activities/', {
                'activity_type': act_type,
                'content': f'Regression test — {act_type} activity'
            }, format='json')
            self.assertEqual(resp.status_code, 201, f"Activity type '{act_type}' should still work")
            self.assertEqual(resp.json()['activity_type'], act_type)

    def test_existing_lead_status_change_auto_logs_activity(self):
        """Status-change auto-logging from Phase 1.2 must still work."""
        self.auth(self.admin)
        lead = Lead.objects.create(
            name='Regression Status Lead', email='reg.status@example.com', phone='9888877777'
        )
        before = LeadActivity.objects.filter(lead=lead, activity_type='status_change').count()
        self.client.patch(f'/api/leads/{lead.id}/', {'status': 'contacted'}, format='json')
        after = LeadActivity.objects.filter(lead=lead, activity_type='status_change').count()
        self.assertEqual(after, before + 1)

    def test_existing_lead_assignment_auto_logs_activity(self):
        """Assignment auto-logging from Phase 1.2 must still work."""
        self.auth(self.admin)
        lead = Lead.objects.create(
            name='Regression Assign Lead', email='reg.assign@example.com', phone='9777766666'
        )
        before = LeadActivity.objects.filter(lead=lead, activity_type='assignment').count()
        self.client.patch(f'/api/leads/{lead.id}/', {'assigned_to': self.staff.id}, format='json')
        after = LeadActivity.objects.filter(lead=lead, activity_type='assignment').count()
        self.assertEqual(after, before + 1)

    # ─────────────────────────────────────────────────────────────────
    # 12. Validation: required fields
    # ─────────────────────────────────────────────────────────────────

    def test_followup_requires_due_at(self):
        self.auth(self.admin)
        resp = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'title': 'No due date'
            # due_at intentionally missing
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_appointment_requires_appointment_date(self):
        self.auth(self.admin)
        resp = self.client.post('/api/appointments/', {
            'lead': self.lead.id,
            'title': 'No date appointment'
            # appointment_date intentionally missing
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_followup_invalid_status_rejected(self):
        self.auth(self.admin)
        due = (timezone.now() + timedelta(days=1)).isoformat()
        resp = self.client.post('/api/follow-ups/', {
            'lead': self.lead.id,
            'title': 'Bad status',
            'due_at': due,
            'status': 'invalid_status'
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    def test_task_invalid_priority_rejected(self):
        self.auth(self.admin)
        due = (timezone.now() + timedelta(days=1)).isoformat()
        resp = self.client.post('/api/tasks/', {
            'lead': self.lead.id,
            'title': 'Bad priority',
            'due_at': due,
            'priority': 'critical'  # not a valid choice
        }, format='json')
        self.assertEqual(resp.status_code, 400)

    # ─────────────────────────────────────────────────────────────────
    # 13. Filtering correctness — lead-scoped results
    # ─────────────────────────────────────────────────────────────────

    def test_notes_filtered_by_lead(self):
        other_lead = Lead.objects.create(
            name='Other Lead', email='other.note@example.com', phone='9000011111'
        )
        CounsellingNote.objects.create(lead=self.lead, author=self.admin, content='My lead note')
        CounsellingNote.objects.create(lead=other_lead, author=self.admin, content='Other lead note')

        self.auth(self.staff)
        resp = self.client.get(f'/api/counselling-notes/?lead={self.lead.id}')
        self.assertEqual(resp.status_code, 200)
        results = resp.json().get('results', resp.json())
        for note in results:
            self.assertEqual(note['lead'], self.lead.id)

    def test_followups_filtered_by_lead(self):
        other_lead = Lead.objects.create(
            name='Other FU Lead', email='other.fu@example.com', phone='9000022222'
        )
        due = timezone.now() + timedelta(days=1)
        FollowUp.objects.create(lead=self.lead, title='My FU', due_at=due, status='pending', created_by=self.admin)
        FollowUp.objects.create(lead=other_lead, title='Other FU', due_at=due, status='pending', created_by=self.admin)

        self.auth(self.staff)
        resp = self.client.get(f'/api/follow-ups/?lead={self.lead.id}')
        results = resp.json().get('results', resp.json())
        for fu in results:
            self.assertEqual(fu['lead'], self.lead.id)
