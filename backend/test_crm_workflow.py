import os
from unittest.mock import patch
from django.utils import timezone
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient
from api.models import Lead, LeadActivity


class CRMWorkflowTests(TestCase):
    def setUp(self):
        staff_group, _ = Group.objects.get_or_create(name='Staff')
        student_group, _ = Group.objects.get_or_create(name='Student')

        self.admin = User.objects.create_user(
            username='crm_admin', password='AdminPass123!', first_name='Admin', last_name='User', is_staff=True, is_superuser=True
        )
        self.staff1 = User.objects.create_user(
            username='crm_staff1', password='StaffPass123!', first_name='Staff', last_name='One', is_staff=True
        )
        self.staff1.groups.add(staff_group)

        self.staff2 = User.objects.create_user(
            username='crm_staff2', password='StaffPass123!', first_name='Staff', last_name='Two', is_staff=True
        )
        self.staff2.groups.add(staff_group)

        self.student = User.objects.create_user(
            username='crm_student', password='StudentPass123!', first_name='Student', last_name='User'
        )
        self.student.groups.add(student_group)

        self.client = APIClient()
        self.lead_payload = {
            'name': 'Aarav Sharma',
            'email': 'aarav.sharma@example.com',
            'phone': '+977 98412 34567',
            'country_of_residence': 'Nepal',
            'qualification': "Bachelor's Degree",
            'marks': 82.5,
            'english_score': 7.5,
            'budget': 30000,
            'course_interest': 'Data Science',
            'recommended_country': 'Canada',
            'recommended_course': 'MSc Data Science',
            'status': 'new',
            'source': 'crm_manual',
            'notes': 'High priority applicant.',
        }

    def authenticate(self, user):
        if user:
            self.client.force_authenticate(user=user)
        else:
            self.client.force_authenticate(user=None)

    # 1. Permission Matrix
    def test_lead_creation_permissions(self):
        # Admin can create
        self.authenticate(self.admin)
        resp = self.client.post('/api/leads/', self.lead_payload, format='json')
        self.assertEqual(resp.status_code, 201)

        # Staff can create
        self.authenticate(self.staff1)
        staff_payload = {**self.lead_payload, 'email': 'staff.lead@example.com', 'phone': '9841234568'}
        resp = self.client.post('/api/leads/', staff_payload, format='json')
        self.assertEqual(resp.status_code, 201)

        # Student is rejected (403)
        self.authenticate(self.student)
        student_payload = {**self.lead_payload, 'email': 'student.lead@example.com', 'phone': '9841234569'}
        resp = self.client.post('/api/leads/', student_payload, format='json')
        self.assertEqual(resp.status_code, 403)

        # Anonymous is rejected (401/403)
        self.authenticate(None)
        resp = self.client.post('/api/leads/', self.lead_payload, format='json')
        self.assertIn(resp.status_code, (401, 403))

    def test_crm_leads_view_permissions(self):
        # Student cannot view CRM leads list
        self.authenticate(self.student)
        self.assertEqual(self.client.get('/api/leads/').status_code, 403)

        # Anonymous cannot view CRM leads list
        self.authenticate(None)
        self.assertIn(self.client.get('/api/leads/').status_code, (401, 403))

        # Admin and Staff can view CRM leads list
        self.authenticate(self.staff1)
        self.assertEqual(self.client.get('/api/leads/').status_code, 200)

        self.authenticate(self.admin)
        self.assertEqual(self.client.get('/api/leads/').status_code, 200)

    # 2. Search
    def test_backend_lead_search(self):
        Lead.objects.create(name='John Doe', email='john@test.com', phone='+977 98000 11111')
        Lead.objects.create(name='Jane Smith', email='jane@test.com', phone='+977 98000 22222')
        self.authenticate(self.staff1)

        # Search by name
        res = self.client.get('/api/leads/?search=John').json()
        results = res['results'] if 'results' in res else res
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['name'], 'John Doe')

        # Search by email
        res = self.client.get('/api/leads/?search=jane@test.com').json()
        results = res['results'] if 'results' in res else res
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['email'], 'jane@test.com')

        # Search by phone
        res = self.client.get('/api/leads/?search=98000 11111').json()
        results = res['results'] if 'results' in res else res
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['phone'], '+977 98000 11111')

    # 3. Filters
    def test_combined_backend_filters(self):
        Lead.objects.create(
            name='Lead 1', email='l1@test.com', phone='111',
            status='new', recommended_country='Canada', course_interest='Data Science'
        )
        Lead.objects.create(
            name='Lead 2', email='l2@test.com', phone='222',
            status='contacted', recommended_country='Australia', course_interest='Business'
        )
        Lead.objects.create(
            name='Lead 3', email='l3@test.com', phone='333',
            status='new', recommended_country='Canada', course_interest='Cyber Security'
        )
        self.authenticate(self.staff1)

        url = '/api/leads/?status=new&country=Canada&course=Data%20Science'
        res = self.client.get(url).json()
        results = res['results'] if 'results' in res else res
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['email'], 'l1@test.com')

    # 4. Status Management
    def test_status_update_and_invalid_status_rejection(self):
        self.authenticate(self.admin)
        create_resp = self.client.post('/api/leads/', self.lead_payload, format='json')
        lead_id = create_resp.json()['id']

        # Valid status update
        for valid_status in ['contacted', 'applied', 'visa_process', 'converted', 'lost']:
            resp = self.client.patch(f'/api/leads/{lead_id}/', {'status': valid_status}, format='json')
            self.assertEqual(resp.status_code, 200)
            self.assertEqual(resp.json()['status'], valid_status)

        # Invalid status choice rejected
        invalid_resp = self.client.patch(f'/api/leads/{lead_id}/', {'status': 'invalid_choice'}, format='json')
        self.assertEqual(invalid_resp.status_code, 400)

    # 5. Staff Assignment
    def test_staff_assignment_workflow(self):
        self.authenticate(self.admin)
        create_resp = self.client.post('/api/leads/', self.lead_payload, format='json')
        lead_id = create_resp.json()['id']

        # Admin assigns staff1
        assign_resp = self.client.patch(f'/api/leads/{lead_id}/', {'assigned_to': self.staff1.id}, format='json')
        self.assertEqual(assign_resp.status_code, 200)
        self.assertEqual(assign_resp.json()['assigned_to'], self.staff1.id)
        self.assertEqual(assign_resp.json()['assigned_to_name'], 'Staff One')

        # Staff1 can view list of staff users
        self.authenticate(self.staff1)
        staff_users_resp = self.client.get('/api/leads/staff-users/')
        self.assertEqual(staff_users_resp.status_code, 200)
        usernames = [u['username'] for u in staff_users_resp.json()]
        self.assertIn('crm_admin', usernames)
        self.assertIn('crm_staff1', usernames)
        self.assertNotIn('crm_student', usernames)

        # Reassigning lead to another staff member as non-admin staff should be restricted
        reassign_resp = self.client.patch(f'/api/leads/{lead_id}/', {'assigned_to': self.staff2.id}, format='json')
        self.assertEqual(reassign_resp.status_code, 403)

        # Admin reassigns staff2
        self.authenticate(self.admin)
        reassign_admin_resp = self.client.patch(f'/api/leads/{lead_id}/', {'assigned_to': self.staff2.id}, format='json')
        self.assertEqual(reassign_admin_resp.status_code, 200)
        self.assertEqual(reassign_admin_resp.json()['assigned_to'], self.staff2.id)

    # 6. Activity History
    def test_activity_creation_retrieval_and_automation(self):
        self.authenticate(self.admin)
        lead = Lead.objects.create(name='Activity Lead', email='activity@test.com', phone='9898989898')

        # Add manual activity note
        self.authenticate(self.staff1)
        activity_resp = self.client.post(f'/api/leads/{lead.id}/activities/', {
            'activity_type': 'call',
            'content': 'Discussed IELTS waiver options with student.'
        }, format='json')
        self.assertEqual(activity_resp.status_code, 201)
        self.assertEqual(activity_resp.json()['author_name'], 'Staff One')
        self.assertEqual(activity_resp.json()['activity_type'], 'call')

        # Retrieve activities
        get_act_resp = self.client.get(f'/api/leads/{lead.id}/activities/')
        self.assertEqual(get_act_resp.status_code, 200)
        self.assertGreaterEqual(len(get_act_resp.json()), 1)

        # Automatic activity logged on status change
        self.client.patch(f'/api/leads/{lead.id}/', {'status': 'contacted'}, format='json')
        activities = self.client.get(f'/api/leads/{lead.id}/activities/').json()
        status_activities = [a for a in activities if a['activity_type'] == 'status_change']
        self.assertGreaterEqual(len(status_activities), 1)
        self.assertIn("Status changed from 'new' to 'contacted'", status_activities[0]['content'])

    # 7. Follow-up System & Overdue Calculation
    def test_followup_date_and_overdue_flag(self):
        self.authenticate(self.staff1)
        lead = Lead.objects.create(name='Followup Lead', email='followup@test.com', phone='9876543210', status='new')

        past_date = (timezone.now() - timedelta(days=2)).isoformat()
        update_resp = self.client.patch(f'/api/leads/{lead.id}/', {'next_follow_up': past_date}, format='json')
        self.assertEqual(update_resp.status_code, 200)
        self.assertTrue(update_resp.json()['is_overdue'])

        # Marking converted should clear overdue flag
        converted_resp = self.client.patch(f'/api/leads/{lead.id}/', {'status': 'converted'}, format='json')
        self.assertEqual(converted_resp.status_code, 200)
        self.assertFalse(converted_resp.json()['is_overdue'])

    # 8. Duplicate Handling
    def test_duplicate_lead_prevention(self):
        self.authenticate(self.admin)
        self.assertEqual(self.client.post('/api/leads/', self.lead_payload, format='json').status_code, 201)

        # Duplicate email
        dup_email = {**self.lead_payload, 'phone': '9800099999'}
        dup_email_resp = self.client.post('/api/leads/', dup_email, format='json')
        self.assertEqual(dup_email_resp.status_code, 400)
        self.assertIn('already exists', dup_email_resp.json()['error'])

        # Duplicate phone
        dup_phone = {**self.lead_payload, 'email': 'different.email@example.com'}
        dup_phone_resp = self.client.post('/api/leads/', dup_phone, format='json')
        self.assertEqual(dup_phone_resp.status_code, 400)
        self.assertIn('already exists', dup_phone_resp.json()['error'])

    # 9. Regression Public Flows
    def test_public_inquiry_flows_remain_functional(self):
        contact_resp = self.client.post('/api/contact/', {
            'name': 'Public Lead', 'email': 'public@example.com', 'phone': '9811122233', 'message': 'General inquiry'
        }, format='json')
        self.assertEqual(contact_resp.status_code, 201)

        capture_resp = self.client.post('/api/capture-lead/', {
            'name': 'Capture Lead', 'email': 'capture@example.com', 'phone': '9822233344'
        }, format='json')
        self.assertEqual(capture_resp.status_code, 201)
