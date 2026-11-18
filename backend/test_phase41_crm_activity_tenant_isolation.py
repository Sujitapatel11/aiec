from datetime import timedelta

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from api.models import (
    Appointment, Application, Consultancy, ConsultancyMembership, CounsellingNote,
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
        self.application_b = Application.objects.create(
            student=self.student_b,
            university_name='Private B University',
            course_name='Private B Course',
        )
        self.student_user_a = User.objects.create_user(
            username='crm_student_a', password='StudentPass123!'
        )
        self.student_a = StudentProfile.objects.create(
            user=self.student_user_a, full_name='Tenant A Student',
            phone='111', destination_country='Australia', consultancy=self.tenant_a,
        )
        self.application_a = Application.objects.create(
            student=self.student_a,
            university_name='Tenant A University',
            course_name='Tenant A Course',
        )
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

    def test_tenant_b_application_is_not_accessible_to_tenant_a_staff(self):
        response = self.client.get(f'/api/applications/{self.application_b.pk}/')
        self.assertEqual(response.status_code, 403)

    def test_tenant_a_staff_can_access_own_application(self):
        response = self.client.get(f'/api/applications/{self.application_a.pk}/')
        self.assertEqual(response.status_code, 200)

    def test_student_cannot_access_another_tenants_application(self):
        student_client = APIClient()
        student_client.force_authenticate(user=self.student_user_a)
        response = student_client.get(f'/api/applications/{self.application_b.pk}/')
        self.assertEqual(response.status_code, 403)
