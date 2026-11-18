from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import (
    Appointment, Consultancy, ConsultancyMembership, CounsellingNote,
    FollowUp, Lead, StudentProfile, Task,
)


class CRMActivityTenantIsolationTests(TestCase):
    def setUp(self):
        self.tenant_a = Consultancy.objects.create(name='CRM Tenant A', slug='crm-tenant-a')
        self.tenant_b = Consultancy.objects.create(name='CRM Tenant B', slug='crm-tenant-b')
        self.staff_a = User.objects.create_user(
            username='crm_staff_a', password='StaffPass123!', is_staff=True
        )
        ConsultancyMembership.objects.create(
            consultancy=self.tenant_a, user=self.staff_a, role='admin'
        )
        self.lead_b = Lead.objects.create(
            consultancy=self.tenant_b, name='Private Tenant B Lead',
            email='private-b@example.test', phone='222', status='new',
        )
        self.student_user_b = User.objects.create_user(
            username='crm_student_b', password='StudentPass123!'
        )
        self.student_b = StudentProfile.objects.create(
            user=self.student_user_b, full_name='Private Tenant B Student',
            phone='222', destination_country='Canada', consultancy=self.tenant_b,
        )
        due = timezone.now() + timedelta(days=1)
        self.records = {
            'counselling-notes': CounsellingNote.objects.create(
                consultancy=self.tenant_b, lead=self.lead_b, content='Private note'
            ),
            'follow-ups': FollowUp.objects.create(
                consultancy=self.tenant_b, lead=self.lead_b, title='Private follow-up',
                due_at=due,
            ),
            'tasks': Task.objects.create(
                consultancy=self.tenant_b, lead=self.lead_b, title='Private task',
            ),
            'appointments': Appointment.objects.create(
                consultancy=self.tenant_b, lead=self.lead_b, title='Private appointment',
                appointment_date=due,
            ),
        }
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff_a)

    def test_tenant_b_crm_records_are_not_listed_or_retrievable_by_tenant_a(self):
        for endpoint, record in self.records.items():
            with self.subTest(endpoint=endpoint):
                listing = self.client.get(f'/api/{endpoint}/')
                self.assertEqual(listing.status_code, 200)
                rows = listing.data.get('results', listing.data)
                ids = [item['id'] for item in rows]
                self.assertNotIn(record.pk, ids)
                detail = self.client.get(f'/api/{endpoint}/{record.pk}/')
                self.assertEqual(detail.status_code, 404)

    def test_tenant_a_cannot_attach_tenant_b_lead_to_new_crm_records(self):
        cases = [
            ('counselling-notes', {'lead': self.lead_b.pk, 'content': 'cross tenant'}),
            ('follow-ups', {
                'lead': self.lead_b.pk, 'title': 'cross tenant',
                'due_at': (timezone.now() + timedelta(days=1)).isoformat(),
            }),
            ('tasks', {'lead': self.lead_b.pk, 'title': 'cross tenant'}),
            ('appointments', {
                'lead': self.lead_b.pk, 'title': 'cross tenant',
                'appointment_date': (timezone.now() + timedelta(days=1)).isoformat(),
            }),
        ]
        for endpoint, payload in cases:
            with self.subTest(endpoint=endpoint):
                response = self.client.post(f'/api/{endpoint}/', payload, format='json')
                self.assertEqual(response.status_code, 400, response.data)
