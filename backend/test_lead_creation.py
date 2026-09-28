import os
from unittest.mock import patch

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django

django.setup()

from django.contrib.auth.models import Group, User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Lead


class LeadCreationTests(TestCase):
    def setUp(self):
        staff_group, _ = Group.objects.get_or_create(name='Staff')
        self.admin = User.objects.create_user(
            username='lead_admin', password='AdminPass123!', is_staff=True, is_superuser=True
        )
        self.staff = User.objects.create_user(
            username='lead_staff', password='StaffPass123!', is_staff=True
        )
        self.staff.groups.add(staff_group)
        self.student = User.objects.create_user(
            username='lead_student', password='StudentPass123!'
        )
        self.client = APIClient()
        self.payload = {
            'name': 'New CRM Lead',
            'email': 'new-lead@example.com',
            'phone': '+977 98000 12345',
            'country_of_residence': 'Nepal',
            'qualification': "Bachelor's Degree",
            'marks': 78,
            'english_score': 7,
            'budget': 25000,
            'course_interest': 'Computer Science',
            'recommended_country': 'Canada',
            'recommended_course': 'MSc Computer Science',
            'status': 'new',
            'source': 'crm_manual',
            'notes': 'Created by counselor.',
        }

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_admin_and_staff_can_create_leads(self):
        self.authenticate(self.admin)
        self.assertEqual(self.client.post('/api/leads/', self.payload, format='json').status_code, 201)

        self.authenticate(self.staff)
        staff_payload = {**self.payload, 'email': 'staff-lead@example.com', 'phone': '+977 98000 12346'}
        self.assertEqual(self.client.post('/api/leads/', staff_payload, format='json').status_code, 201)

    def test_student_and_anonymous_users_cannot_create_leads(self):
        self.authenticate(self.student)
        self.assertEqual(self.client.post('/api/leads/', self.payload, format='json').status_code, 403)

        self.client.force_authenticate(user=None)
        self.assertIn(self.client.post('/api/leads/', self.payload, format='json').status_code, (401, 403))

    def test_invalid_values_are_rejected(self):
        self.authenticate(self.admin)
        invalid_cases = [
            ('email', 'invalid', 'invalid-lead@example.com'),
            ('marks', 101, 'invalid-marks@example.com'),
            ('english_score', 10, 'invalid-score@example.com'),
            ('budget', -1, 'invalid-budget@example.com'),
        ]
        for field, value, email in invalid_cases:
            payload = {**self.payload, field: value}
            if field != 'email':
                payload['email'] = email
            response = self.client.post('/api/leads/', payload, format='json')
            self.assertEqual(response.status_code, 400, field)

    def test_duplicate_email_and_normalized_phone_are_rejected(self):
        self.authenticate(self.admin)
        self.assertEqual(self.client.post('/api/leads/', self.payload, format='json').status_code, 201)

        duplicate_email = {**self.payload, 'email': self.payload['email'].upper(), 'phone': '+977 98000 99999'}
        self.assertEqual(self.client.post('/api/leads/', duplicate_email, format='json').status_code, 400)

        duplicate_phone = {**self.payload, 'email': 'different@example.com', 'phone': '977-98000-12345'}
        response = self.client.post('/api/leads/', duplicate_phone, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('already exists', response.json()['error'])

    def test_valid_lead_is_stored_and_status_updates(self):
        self.authenticate(self.admin)
        response = self.client.post('/api/leads/', self.payload, format='json')
        self.assertEqual(response.status_code, 201)
        lead = Lead.objects.get(pk=response.json()['id'])
        self.assertEqual(lead.email, self.payload['email'])
        self.assertEqual(lead.source, 'crm_manual')

        update = self.client.patch(f'/api/leads/{lead.id}/', {'status': 'contacted'}, format='json')
        self.assertEqual(update.status_code, 200)
        self.assertEqual(update.json()['status'], 'contacted')

    def test_lead_filters_reach_the_queryset(self):
        Lead.objects.create(
            name='Canada Lead', email='canada@example.com', phone='9800055555',
            recommended_country='Canada', course_interest='Computer Science', status='new'
        )
        Lead.objects.create(
            name='Australia Lead', email='australia@example.com', phone='9800066666',
            recommended_country='Australia', course_interest='Business', status='contacted'
        )
        self.authenticate(self.staff)
        response = self.client.get('/api/leads/?country=Canada&course=Computer%20Science&status=new&search=Canada')
        self.assertEqual(response.status_code, 200)
        results = response.json()['results']
        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]['email'], 'canada@example.com')

    def test_existing_public_creation_flows_remain_available(self):
        contact = self.client.post('/api/contact/', {
            'name': 'Contact Lead', 'email': 'contact@example.com', 'phone': '9800011111', 'message': 'Hello'
        }, format='json')
        self.assertEqual(contact.status_code, 201)

        capture = self.client.post('/api/capture-lead/', {
            'name': 'Assessment Lead', 'email': 'assessment@example.com', 'phone': '9800022222'
        }, format='json')
        self.assertEqual(capture.status_code, 201)

        with patch('api.views.get_chat_response', return_value={
            'stage': 'done', 'collected': {'name': 'Chat Lead', 'email': 'chat@example.com', 'phone': '9800033333'}, 'reply': 'Thanks'
        }):
            chat = self.client.post('/api/chat/', {'messages': []}, format='json')
        self.assertEqual(chat.status_code, 200)

        with patch('api.views.get_ai_recommendations', return_value={'countries': [], 'courses': []}):
            questionnaire = self.client.post('/api/questionnaire/', {
                'name': 'Questionnaire Lead', 'email': 'questionnaire@example.com', 'phone': '9800044444',
                'city': 'Birgunj', 'education_level': 'Bachelor', 'field_of_interest': 'Business',
                'preferred_countries': ['Canada'], 'budget_range': '$20,000',
                'english_proficiency': 'IELTS 6.5', 'work_experience_years': 0,
                'target_intake': 'Within 1 year', 'additional_info': '',
            }, format='json')
        self.assertEqual(questionnaire.status_code, 201)
