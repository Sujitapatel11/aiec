import os
from decimal import Decimal

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase
from rest_framework.test import APIClient

from api.models import Application, ApplicationOffer, Country, Course, StudentDocument, StudentProfile


class ApplicationOfferApiTests(TestCase):
    def setUp(self):
        self.admin = User.objects.create_user(
            username='offer_admin', password='AdminPass123!', is_staff=True, is_superuser=True,
        )
        self.staff = User.objects.create_user(
            username='offer_staff', password='StaffPass123!', is_staff=True,
        )
        self.student_user = User.objects.create_user(
            username='offer_student', password='StudentPass123!'
        )
        self.other_student_user = User.objects.create_user(
            username='other_offer_student', password='StudentPass123!'
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            full_name='Offer Student',
            phone='555-0100',
            destination_country='Canada',
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_student_user,
            full_name='Other Offer Student',
            phone='555-0101',
            destination_country='Australia',
        )
        self.country = Country.objects.create(name='Canada', code='CA', description='Study destination')
        self.course = Course.objects.create(
            name='Computer Science',
            country=self.country,
            university='North University',
            level='Bachelor',
            duration='4 years',
        )
        self.application = Application.objects.create(
            student=self.student,
            course=self.course,
            university_name='North University',
            course_name='Computer Science',
            country=self.country,
            country_name='Canada',
            status='offer_received',
            intake='Fall 2027',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)

    def test_staff_can_create_and_list_application_offers(self):
        response = self.client.post(
            f'/api/applications/{self.application.id}/offers/',
            {
                'offer_type': 'conditional',
                'received_date': '2026-10-01',
                'response_deadline': '2026-10-15',
                'conditions': 'Submit final transcript',
                'tuition_fee': '22000.00',
                'deposit_amount': '5000.00',
                'deposit_deadline': '2026-10-20',
                'acceptance_status': 'pending',
                'notes': 'Awaiting transcript',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['application'], self.application.id)
        self.assertEqual(response.data['offer_type'], 'conditional')
        self.assertEqual(response.data['acceptance_status'], 'pending')

        list_response = self.client.get(f'/api/applications/{self.application.id}/offers/')
        self.assertEqual(list_response.status_code, 200)
        self.assertEqual(len(list_response.data), 1)

    def test_student_can_view_only_own_offers_and_cannot_modify(self):
        offer = ApplicationOffer.objects.create(
            application=self.application,
            offer_type='unconditional',
            received_date='2026-10-01',
            response_deadline='2026-10-15',
            tuition_fee=Decimal('23000.00'),
            deposit_amount=Decimal('4000.00'),
            acceptance_status='pending',
        )
        other_application = Application.objects.create(
            student=self.other_student,
            university_name='Other University',
            course_name='Other Course',
            country_name='Australia',
            status='offer_received',
            intake='Fall 2027',
        )
        other_offer = ApplicationOffer.objects.create(
            application=other_application,
            offer_type='conditional',
            received_date='2026-10-02',
            response_deadline='2026-10-20',
            acceptance_status='pending',
        )

        self.client.force_authenticate(user=self.student_user)

        own_list = self.client.get(f'/api/applications/{self.application.id}/offers/')
        own_detail = self.client.get(f'/api/offers/{offer.id}/')
        other_list = self.client.get(f'/api/applications/{other_application.id}/offers/')
        other_detail = self.client.get(f'/api/offers/{other_offer.id}/')

        self.assertEqual(own_list.status_code, 200)
        self.assertEqual(len(own_list.data), 1)
        self.assertEqual(own_detail.status_code, 200)
        self.assertEqual(other_list.status_code, 403)
        self.assertEqual(other_detail.status_code, 403)
        self.assertEqual(
            self.client.patch(f'/api/offers/{offer.id}/', {'acceptance_status': 'accepted'}, format='json').status_code,
            403,
        )
        self.assertEqual(
            self.client.post(
                f'/api/applications/{self.application.id}/offers/',
                {'offer_type': 'conditional', 'acceptance_status': 'accepted'},
                format='json',
            ).status_code,
            403,
        )

    def test_offer_document_must_belong_to_same_student(self):
        other_doc = StudentDocument.objects.create(
            student=self.other_student,
            document_type='Passport',
            file_url='https://example.com/other.pdf',
            file_name='other-passport.pdf',
        )
        response = self.client.post(
            f'/api/applications/{self.application.id}/offers/',
            {
                'offer_type': 'conditional',
                'received_date': '2026-10-01',
                'response_deadline': '2026-10-15',
                'acceptance_status': 'pending',
                'offer_document': other_doc.id,
            },
            format='json',
        )

        self.assertEqual(response.status_code, 400, response.data)
        self.assertIn('offer_document', response.data)

    def test_admin_can_delete_offer(self):
        offer = ApplicationOffer.objects.create(
            application=self.application,
            offer_type='conditional',
            received_date='2026-10-01',
            response_deadline='2026-10-15',
            acceptance_status='pending',
        )
        self.client.force_authenticate(user=self.admin)
        delete_response = self.client.delete(f'/api/offers/{offer.id}/')

        self.assertEqual(delete_response.status_code, 204)
        self.assertFalse(ApplicationOffer.objects.filter(pk=offer.id).exists())
