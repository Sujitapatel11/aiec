import os
from decimal import Decimal
from datetime import timedelta

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import Group, User
from django.test import TestCase
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from api.models import (
    Application, ApplicationOffer, Country, Course, StudentDocument, StudentProfile
)


class ApplicationOfferTests(TestCase):
    def setUp(self):
        # Create users
        self.admin = User.objects.create_superuser(
            username='offer_admin', email='admin@example.com', password='AdminPass123!'
        )
        self.staff = User.objects.create_user(
            username='offer_staff', email='staff@example.com', password='StaffPass123!', is_staff=True
        )
        staff_group, _ = Group.objects.get_or_create(name='Staff')
        self.staff.groups.add(staff_group)

        # Student 1
        student_group, _ = Group.objects.get_or_create(name='Student')
        self.student1_user = User.objects.create_user(
            username='student1', email='student1@example.com', password='StudentPass123!'
        )
        self.student1_user.groups.add(student_group)
        self.student1 = StudentProfile.objects.create(
            user=self.student1_user, full_name='Student One', phone='555-0101', destination_country='UK'
        )

        # Student 2 (for cross-tenant/cross-student IDOR tests)
        self.student2_user = User.objects.create_user(
            username='student2', email='student2@example.com', password='StudentPass123!'
        )
        self.student2_user.groups.add(student_group)
        self.student2 = StudentProfile.objects.create(
            user=self.student2_user, full_name='Student Two', phone='555-0102', destination_country='Canada'
        )

        # Country & Course
        self.country = Country.objects.create(name='United Kingdom', code='UK', avg_tuition_usd=15000)
        self.course = Course.objects.create(
            name='Computer Science BSc', university='University of Oxford', country=self.country, level='UG', tuition_usd=20000
        )

        # Applications
        self.app1 = Application.objects.create(
            student=self.student1, course=self.course, university_name='University of Oxford', course_name='Computer Science BSc', country=self.country, intake='Fall 2026'
        )
        self.app2 = Application.objects.create(
            student=self.student2, course=self.course, university_name='University of Oxford', course_name='Computer Science BSc', country=self.country, intake='Fall 2026'
        )

        # Documents
        self.doc1 = StudentDocument.objects.create(
            student=self.student1, document_type='offer_letter', file_name='offer1.pdf', file_url='http://example.com/offer1.pdf'
        )
        self.doc2 = StudentDocument.objects.create(
            student=self.student2, document_type='offer_letter', file_name='offer2.pdf', file_url='http://example.com/offer2.pdf'
        )

        self.client = APIClient()

    # ── MODEL TESTS ──────────────────────────────────────────────────────────

    def test_offer_model_creation_and_defaults(self):
        offer = ApplicationOffer.objects.create(
            application=self.app1,
            offer_type='conditional',
            tuition_fee=Decimal('18000.00'),
            deposit_amount=Decimal('2000.00'),
            conditions='IELTS 7.0',
        )
        self.assertEqual(offer.application, self.app1)
        self.assertEqual(offer.offer_type, 'conditional')
        self.assertEqual(offer.acceptance_status, 'pending')
        self.assertEqual(offer.status, 'pending')
        self.assertEqual(offer.tuition_fee, Decimal('18000.00'))
        self.assertEqual(offer.deposit_amount, Decimal('2000.00'))
        self.assertEqual(offer.conditions, 'IELTS 7.0')

    def test_multiple_offers_allowed_for_single_application(self):
        offer1 = ApplicationOffer.objects.create(
            application=self.app1, offer_type='conditional', tuition_fee=Decimal('15000.00')
        )
        offer2 = ApplicationOffer.objects.create(
            application=self.app1, offer_type='unconditional', tuition_fee=Decimal('15000.00')
        )
        self.assertEqual(self.app1.offers.count(), 2)

    def test_negative_financial_fields_rejected_by_model(self):
        offer = ApplicationOffer(
            application=self.app1, offer_type='conditional', tuition_fee=Decimal('-100.00')
        )
        with self.assertRaises(Exception):
            offer.full_clean()

    def test_cross_student_document_rejected_by_model(self):
        offer = ApplicationOffer(
            application=self.app1, offer_type='conditional', offer_document=self.doc2
        )
        with self.assertRaises(Exception):
            offer.full_clean()

    # ── API ENDPOINTS & PERMISSIONS ──────────────────────────────────────────

    def test_staff_can_create_offer(self):
        self.client.force_authenticate(user=self.staff)
        payload = {
            'offer_type': 'conditional',
            'acceptance_status': 'pending',
            'received_date': '2026-10-01',
            'response_deadline': '2026-11-01',
            'tuition_fee': '18000.00',
            'deposit_amount': '2000.00',
            'deposit_deadline': '2026-11-15',
            'conditions': 'IELTS 6.5',
            'notes': 'Staff internal note',
            'offer_document': self.doc1.id,
        }
        res = self.client.post(f'/api/applications/{self.app1.id}/offers/', payload)
        self.assertEqual(res.status_code, status.HTTP_201_CREATED)
        self.assertEqual(res.data['offer_type'], 'conditional')
        self.assertEqual(res.data['acceptance_status'], 'pending')
        self.assertEqual(res.data['tuition_fee'], '18000.00')
        self.assertEqual(res.data['deposit_amount'], '2000.00')

    def test_student_cannot_create_offer(self):
        self.client.force_authenticate(user=self.student1_user)
        payload = {'offer_type': 'unconditional'}
        res = self.client.post(f'/api/applications/{self.app1.id}/offers/', payload)
        self.assertEqual(res.status_code, status.HTTP_403_FORBIDDEN)

    def test_student_can_read_own_offers_without_internal_notes(self):
        offer = ApplicationOffer.objects.create(
            application=self.app1, offer_type='unconditional', notes='Secret staff note'
        )
        self.client.force_authenticate(user=self.student1_user)

        res = self.client.get(f'/api/applications/{self.app1.id}/offers/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(len(res.data), 1)
        self.assertNotIn('notes', res.data[0])

        res_detail = self.client.get(f'/api/offers/{offer.id}/')
        self.assertEqual(res_detail.status_code, status.HTTP_200_OK)
        self.assertNotIn('notes', res_detail.data)

    def test_staff_reads_offers_with_internal_notes(self):
        offer = ApplicationOffer.objects.create(
            application=self.app1, offer_type='unconditional', notes='Secret staff note'
        )
        self.client.force_authenticate(user=self.staff)
        res = self.client.get(f'/api/offers/{offer.id}/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertEqual(res.data['notes'], 'Secret staff note')

    def test_idor_cross_student_offer_read_and_modification_blocked(self):
        offer2 = ApplicationOffer.objects.create(
            application=self.app2, offer_type='conditional'
        )
        self.client.force_authenticate(user=self.student1_user)

        # Student 1 trying to list Student 2's application offers
        res1 = self.client.get(f'/api/applications/{self.app2.id}/offers/')
        self.assertEqual(res1.status_code, status.HTTP_403_FORBIDDEN)

        # Student 1 trying to read Student 2's offer directly by ID
        res2 = self.client.get(f'/api/offers/{offer2.id}/')
        self.assertEqual(res2.status_code, status.HTTP_403_FORBIDDEN)

        # Student 1 trying to update Student 2's offer
        res3 = self.client.patch(f'/api/offers/{offer2.id}/', {'acceptance_status': 'accepted'})
        self.assertEqual(res3.status_code, status.HTTP_403_FORBIDDEN)

        # Student 1 trying to delete Student 2's offer
        res4 = self.client.delete(f'/api/offers/{offer2.id}/')
        self.assertEqual(res4.status_code, status.HTTP_403_FORBIDDEN)

    def test_idor_cross_student_document_attachment_blocked(self):
        self.client.force_authenticate(user=self.staff)
        # Attempting to attach student2's document (doc2) to student1's application offer (app1)
        payload = {
            'offer_type': 'conditional',
            'offer_document': self.doc2.id,
        }
        res = self.client.post(f'/api/applications/{self.app1.id}/offers/', payload)
        self.assertEqual(res.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('offer_document', res.data)

    def test_anonymous_access_denied(self):
        self.client.force_authenticate(user=None)
        res = self.client.get(f'/api/applications/{self.app1.id}/offers/')
        self.assertEqual(res.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_staff_can_update_acceptance_status(self):
        offer = ApplicationOffer.objects.create(
            application=self.app1, offer_type='conditional', acceptance_status='pending'
        )
        self.client.force_authenticate(user=self.staff)
        res = self.client.patch(f'/api/offers/{offer.id}/', {'acceptance_status': 'accepted'})
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        offer.refresh_from_db()
        self.assertEqual(offer.acceptance_status, 'accepted')
        # Ensure Application lifecycle status remains unchanged
        self.app1.refresh_from_db()
        self.assertNotEqual(self.app1.status, 'accepted')

    def test_staff_can_delete_offer(self):
        offer = ApplicationOffer.objects.create(
            application=self.app1, offer_type='conditional'
        )
        self.client.force_authenticate(user=self.staff)
        res = self.client.delete(f'/api/offers/{offer.id}/')
        self.assertEqual(res.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(ApplicationOffer.objects.filter(id=offer.id).exists())
