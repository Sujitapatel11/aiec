import os

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from api.models import (
    Application,
    ApplicationDocumentRequirement,
    ApplicationOffer,
    ApplicationTimelineEvent,
    Country,
    CountryDocumentRequirement,
    CountryDocumentTemplate,
    StudentDocument,
    StudentProfile,
)


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class ApplicationTimelineTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username='timeline_staff', password='StaffPass123!', is_staff=True
        )
        self.student_user = User.objects.create_user(
            username='timeline_student', password='StudentPass123!'
        )
        self.other_student_user = User.objects.create_user(
            username='timeline_other', password='StudentPass123!'
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            full_name='Timeline Student',
            phone='555-0400',
            destination_country='Canada',
            enrolled_by=self.staff,
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_student_user,
            full_name='Other Timeline Student',
            phone='555-0401',
            destination_country='Canada',
            enrolled_by=self.staff,
        )
        self.application = Application.objects.create(
            student=self.student,
            university_name='Timeline University',
            course_name='Computer Science',
            intake='Fall 2029',
        )
        self.other_application = Application.objects.create(
            student=self.other_student,
            university_name='Other Timeline University',
            course_name='Engineering',
            intake='Fall 2029',
        )
        self.client = APIClient()

    def timeline_url(self, application=None):
        application = application or self.application
        return f'/api/applications/{application.id}/timeline/'

    def test_application_and_status_changes_create_audit_events(self):
        created = self.application.timeline_events.get(event_type='application_created')
        self.assertEqual(created.title, 'Application Created')

        self.application.status = 'applied'
        self.application.save()

        changed = self.application.timeline_events.get(
            event_type='application_status_changed'
        )
        self.assertEqual(changed.description, 'draft → applied')

    def test_offer_creation_and_status_changes_create_audit_events(self):
        offer = ApplicationOffer.objects.create(
            application=self.application,
            offer_type='conditional',
        )
        received = self.application.timeline_events.get(event_type='offer_received')
        self.assertEqual(received.title, 'Offer Received')

        offer.acceptance_status = 'accepted'
        offer.save()

        changed = self.application.timeline_events.get(
            event_type='offer_status_changed'
        )
        self.assertEqual(changed.description, 'pending → accepted')

    def test_enrollment_profile_status_change_is_recorded_for_applications(self):
        enrolled = self.application.timeline_events.get(event_type='enrollment_created')
        self.assertEqual(enrolled.actor, self.staff)

        self.student.status = 'on_hold'
        self.student.save()

        changed = self.application.timeline_events.get(
            event_type='enrollment_status_changed'
        )
        self.assertEqual(changed.description, 'active → on_hold')

    def test_linked_document_and_verification_are_recorded(self):
        country = Country.objects.create(
            name='Timeline Country',
            code='TL',
            description='Timeline test destination',
        )
        template = CountryDocumentTemplate.objects.create(
            country=country,
            name='Timeline Documents',
        )
        template_requirement = CountryDocumentRequirement.objects.create(
            template=template,
            document_type='passport',
            label='Passport',
            order=1,
        )
        application = Application.objects.create(
            student=self.student,
            university_name='Document Timeline University',
            course_name='Design',
            country=country,
            country_name=country.name,
            intake='Spring 2030',
        )
        requirement = ApplicationDocumentRequirement.objects.get(
            application=application,
            template_requirement=template_requirement,
        )
        document = StudentDocument.objects.create(
            student=self.student,
            document_type='Passport',
            file_url='https://example.test/passport.pdf',
            file_name='passport.pdf',
            uploaded_by=self.student_user,
        )
        requirement.student_document = document
        requirement.save(update_fields=['student_document', 'updated_at'])
        ApplicationOffer.objects.create(
            application=application,
            offer_document=document,
        )
        document.verification_status = 'verified'
        document.verified_by = self.staff
        document.save()

        events = list(application.timeline_events.values_list('event_type', flat=True))
        self.assertIn('document_linked', events)
        self.assertEqual(events.count('document_linked'), 2)
        self.assertIn('document_verified', events)

    def test_staff_can_add_manual_event_and_timeline_is_chronological(self):
        self.client.force_authenticate(user=self.staff)
        response = self.client.post(
            self.timeline_url(),
            {'title': 'Called student', 'description': 'Discussed the offer.'},
            format='json',
        )

        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data['event_type'], 'manual')
        self.assertEqual(response.data['actor_name'], self.staff.username)

        timeline = self.client.get(self.timeline_url())
        timestamps = [event['created_at'] for event in timeline.data]
        self.assertEqual(timestamps, sorted(timestamps))
        self.assertEqual(timeline.data[-1]['title'], 'Called student')

    def test_student_can_read_own_timeline_but_not_another_students(self):
        self.client.force_authenticate(user=self.student_user)

        own_response = self.client.get(self.timeline_url())
        other_response = self.client.get(self.timeline_url(self.other_application))

        self.assertEqual(own_response.status_code, 200)
        self.assertTrue(own_response.data)
        self.assertEqual(other_response.status_code, 403)

    def test_student_cannot_add_manual_timeline_event(self):
        self.client.force_authenticate(user=self.student_user)

        response = self.client.post(
            self.timeline_url(),
            {'title': 'Attempted change', 'description': 'Not allowed.'},
            format='json',
        )

        self.assertEqual(response.status_code, 403)
        self.assertFalse(
            ApplicationTimelineEvent.objects.filter(
                application=self.application,
                event_type='manual',
            ).exists()
        )

    def test_visa_case_model_is_not_present_to_hook(self):
        self.assertFalse(
            any(model.__name__ == 'VisaCase' for model in Application._meta.apps.get_models())
        )
