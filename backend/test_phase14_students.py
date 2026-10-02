import os
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import Group, User
from django.test import TestCase
from django.test.utils import override_settings
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import Lead, LeadActivity, ProcessStep, StudentProfile


class StudentSearchTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username='student_search_staff', password='StaffPass123!', is_staff=True
        )
        self.admin = User.objects.create_user(
            username='student_search_admin', password='AdminPass123!', is_staff=True, is_superuser=True
        )
        student_group, _ = Group.objects.get_or_create(name='Student')
        self.student_user = User.objects.create_user(
            username='country_search_student', email='country@example.com', password='StudentPass123!'
        )
        self.student_user.groups.add(student_group)
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            full_name='Country Search Student',
            phone='555-0100',
            destination_country='Canada',
        )
        self.other_user = User.objects.create_user(
            username='other_student', email='other@example.com', password='StudentPass123!'
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_user,
            full_name='Other Student',
            phone='555-0101',
            destination_country='Australia',
        )
        self.lead = self.make_lead()
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def make_lead(self, **kwargs):
        values = {
            'name': 'Conversion Lead',
            'email': f'lead{Lead.objects.count()}@example.com',
            'phone': '555-0110',
            'recommended_country': 'Canada',
            'status': 'new',
        }
        values.update(kwargs)
        return Lead.objects.create(**values)

    def enroll_payload(self, username):
        return {
            'username': username,
            'full_name': 'Enrolled Student',
            'email': f'{username}@example.com',
            'phone': '555-0120',
            'destination_country': 'Australia',
        }

    def test_search_matches_destination_country_server_side(self):
        response = self.client.get('/api/students/', {'search': 'canad'})

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 1)
        self.assertEqual([row['id'] for row in response.data['results']], [self.student.id])

    def test_student_list_filters_status_and_returns_paginated_contract(self):
        statuses = ['on_hold', 'graduated', 'withdrawn', 'deferred']
        for index, student_status in enumerate(statuses):
            user = User.objects.create_user(username=f'status_student_{index}')
            StudentProfile.objects.create(
                user=user,
                full_name=f'Status Student {index}',
                phone=f'555-02{index:02d}',
                destination_country='New Zealand',
                status=student_status,
            )

        response = self.client.get('/api/students/', {'page': 1, 'page_size': 2})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['count'], 6)
        self.assertEqual(response.data['page_size'], 2)
        self.assertEqual(len(response.data['results']), 2)
        self.assertEqual(response.data['total_pages'], 3)

        for student_status in ['active', *statuses]:
            filtered = self.client.get('/api/students/', {'status': student_status})
            self.assertEqual(filtered.status_code, 200)
            expected_count = 2 if student_status == 'active' else 1
            self.assertEqual(filtered.data['count'], expected_count)
            self.assertTrue(all(row['status'] == student_status for row in filtered.data['results']))

        empty = self.client.get('/api/students/', {'search': 'no-such-student'})
        self.assertEqual(empty.data['count'], 0)
        self.assertEqual(empty.data['results'], [])

    def test_protected_student_endpoints_and_idor(self):
        self.client.force_authenticate(user=None)
        self.assertIn(self.client.get('/api/students/').status_code, (401, 403))
        self.assertIn(self.client.get(f'/api/students/{self.student.id}/').status_code, (401, 403))
        self.assertIn(
            self.client.patch(f'/api/students/{self.student.id}/', {'notes': 'anon'}).status_code,
            (401, 403),
        )
        self.assertIn(
            self.client.post(
                f'/api/leads/{self.lead.id}/convert-to-student/', {'username': 'anonymous_student'}
            ).status_code,
            (401, 403),
        )

        self.client.force_authenticate(user=self.student_user)
        self.assertEqual(self.client.get('/api/students/').status_code, 403)
        self.assertEqual(self.client.get(f'/api/students/{self.student.id}/').status_code, 403)
        self.assertEqual(self.client.get('/api/students/999999/').status_code, 403)
        self.assertEqual(self.client.get(f'/api/students/{self.other_student.id}/').status_code, 403)
        self.assertEqual(
            self.client.patch(f'/api/students/{self.other_student.id}/', {'notes': 'IDOR'}).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                f'/api/leads/{self.lead.id}/convert-to-student/', {'username': 'student_conversion'}
            ).status_code,
            403,
        )

    def test_staff_and_admin_can_access_student_records(self):
        self.assertEqual(self.client.get(f'/api/students/{self.student.id}/').status_code, 200)
        self.client.force_authenticate(user=self.admin)
        self.assertEqual(self.client.get('/api/students/').status_code, 200)
        self.assertEqual(self.client.get(f'/api/students/{self.other_student.id}/').status_code, 200)

    def test_student_patch_is_limited_and_staff_patch_succeeds(self):
        self.client.force_authenticate(user=self.student_user)
        self.assertEqual(
            self.client.patch(f'/api/students/{self.other_student.id}/', {'status': 'withdrawn'}).status_code,
            403,
        )

        self.client.force_authenticate(user=self.staff)
        self.assertEqual(self.client.get('/api/students/999999/').status_code, 404)
        response = self.client.patch(
            f'/api/students/{self.student.id}/',
            {
                'full_name': 'Updated Student',
                'phone': '555-0199',
                'destination_country': 'Ireland',
                'notes': 'Updated notes',
                'status': 'on_hold',
                'student_id': 'CHANGED-ID',
                'user': self.other_user.id,
            },
        )
        self.assertEqual(response.status_code, 200)
        self.student.refresh_from_db()
        self.assertEqual(self.student.full_name, 'Updated Student')
        self.assertEqual(self.student.phone, '555-0199')
        self.assertEqual(self.student.destination_country, 'Ireland')
        self.assertEqual(self.student.notes, 'Updated notes')
        self.assertEqual(self.student.status, 'on_hold')
        self.assertNotEqual(self.student.student_id, 'CHANGED-ID')
        self.assertEqual(self.student.user_id, self.student_user.id)

    def test_student_counselling_records_are_staff_only_and_visible_to_staff(self):
        self.client.force_authenticate(user=self.student_user)
        self.assertEqual(
            self.client.get('/api/counselling-notes/', {'student': self.student.id}).status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                '/api/counselling-notes/',
                {'student': self.student.id, 'content': 'Private note'},
                format='json',
            ).status_code,
            403,
        )

        self.client.force_authenticate(user=self.staff)
        note = self.client.post(
            '/api/counselling-notes/',
            {'student': self.student.id, 'content': 'Staff-only student note'},
            format='json',
        )
        self.assertEqual(note.status_code, 201)
        due_at = (timezone.now() + timedelta(days=1)).isoformat()
        follow_up = self.client.post('/api/follow-ups/', {
            'student': self.student.id, 'title': 'Student follow-up', 'due_at': due_at,
        }, format='json')
        task = self.client.post('/api/tasks/', {
            'student': self.student.id, 'title': 'Student task',
        }, format='json')
        appointment = self.client.post('/api/appointments/', {
            'student': self.student.id,
            'title': 'Student appointment',
            'appointment_date': due_at,
        }, format='json')
        self.assertEqual(follow_up.status_code, 201)
        self.assertEqual(task.status_code, 201)
        self.assertEqual(appointment.status_code, 201)

        detail = self.client.get(f'/api/students/{self.student.id}/')
        self.assertEqual(detail.status_code, 200)
        self.assertEqual(len(detail.data['counselling_notes']), 1)
        self.assertEqual(len(detail.data['follow_ups']), 1)
        self.assertEqual(len(detail.data['tasks']), 1)
        self.assertEqual(len(detail.data['appointments']), 1)

        self.client.force_authenticate(user=self.student_user)
        portal = self.client.get('/api/student-portal/my-profile/')
        self.assertEqual(portal.status_code, 200)
        for private_field in ('counselling_notes', 'follow_ups', 'tasks', 'appointments'):
            self.assertNotIn(private_field, portal.data)

    def test_conversion_authorization_validation_and_missing_ids(self):
        self.client.force_authenticate(user=self.staff)
        missing = self.client.post('/api/leads/999999/convert-to-student/', {'username': 'missing_lead'})
        self.assertEqual(missing.status_code, 404)

        no_username = self.client.post(f'/api/leads/{self.lead.id}/convert-to-student/', {})
        self.assertEqual(no_username.status_code, 400)
        invalid_username = self.client.post(
            f'/api/leads/{self.lead.id}/convert-to-student/',
            {'username': ['not', 'text']},
            format='json',
        )
        self.assertEqual(invalid_username.status_code, 400)

        converted_legacy_lead = self.make_lead(status='converted')
        duplicate_legacy = self.client.post(
            f'/api/leads/{converted_legacy_lead.id}/convert-to-student/',
            {'username': 'legacy_retry'},
        )
        self.assertEqual(duplicate_legacy.status_code, 409)

    def test_conversion_uses_enrollment_logic_and_prevents_duplicates(self):
        response = self.client.post(
            f'/api/leads/{self.lead.id}/convert-to-student/',
            {'username': 'converted_student'},
            format='json',
        )
        self.assertEqual(response.status_code, 201)
        profile = StudentProfile.objects.get(lead=self.lead)
        self.assertEqual(profile.status, 'active')
        self.assertEqual(Lead.objects.get(pk=self.lead.pk).status, 'converted')
        self.assertTrue(profile.student_id.startswith('STU-'))
        self.assertTrue(User.objects.get(pk=profile.user_id).check_password(response.data['generated_password']))
        steps = list(ProcessStep.objects.filter(student=profile).order_by('order'))
        self.assertEqual(len(steps), 7)
        self.assertEqual(
            [step.step_name for step in steps],
            [
                'Document Collection', 'University Application', 'Offer Letter',
                'Visa Application', 'Visa Interview', 'Visa Approval', 'Pre-departure',
            ],
        )
        self.assertTrue(all(step.status == 'pending' and step.estimated_cost == 0 for step in steps))
        self.assertEqual([step.order for step in steps], list(range(1, 8)))
        activity = LeadActivity.objects.get(lead=self.lead, activity_type='status_change')
        self.assertNotIn(response.data['generated_password'], activity.content)
        for sensitive_field in ('email', 'phone', 'user_id', 'lead_id', 'destination_country'):
            self.assertNotIn(sensitive_field, response.data)

        duplicate = self.client.post(
            f'/api/leads/{self.lead.id}/convert-to-student/',
            {'username': 'converted_student_duplicate'},
        )
        self.assertEqual(duplicate.status_code, 409)
        self.assertEqual(StudentProfile.objects.filter(lead=self.lead).count(), 1)

        admin_lead = self.make_lead(name='Admin Conversion', email='admin-conversion@example.com')
        self.client.force_authenticate(user=self.admin)
        admin_response = self.client.post(
            f'/api/leads/{admin_lead.id}/convert-to-student/',
            {'username': 'admin_converted_student'},
        )
        self.assertEqual(admin_response.status_code, 201)
        self.assertTrue(StudentProfile.objects.filter(lead=admin_lead).exists())

    def test_manual_enrollment_keeps_default_checklist_and_password_behavior(self):
        response = self.client.post('/api/students/enroll/', self.enroll_payload('manual_enrolled'))

        self.assertEqual(response.status_code, 201)
        profile = StudentProfile.objects.get(pk=response.data['id'])
        self.assertTrue(User.objects.get(pk=profile.user_id).check_password(response.data['generated_password']))
        steps = list(ProcessStep.objects.filter(student=profile).order_by('order'))
        self.assertEqual(len(steps), 7)
        self.assertTrue(all(step.status == 'pending' and step.estimated_cost == 0 for step in steps))
        self.assertEqual([step.order for step in steps], list(range(1, 8)))

    def test_existing_ids_remain_unchanged_and_prefix_is_configurable(self):
        existing_user = User.objects.create_user(username='legacy_id_student')
        existing = StudentProfile.objects.create(
            user=existing_user,
            full_name='Legacy ID Student',
            phone='555-0300',
            destination_country='Ireland',
            student_id='AIEC-2020-0001',
        )
        with override_settings(STUDENT_ID_PREFIX='GEN'):
            existing.save()
            new_user = User.objects.create_user(username='generic_id_student')
            new_profile = StudentProfile.objects.create(
                user=new_user,
                full_name='Generic ID Student',
                phone='555-0301',
                destination_country='Ireland',
            )
        self.assertEqual(existing.student_id, 'AIEC-2020-0001')
        self.assertTrue(new_profile.student_id.startswith('GEN-'))