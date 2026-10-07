import os
from unittest.mock import patch

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'aiec.settings')

import django
django.setup()

from django.contrib.auth.models import User
from django.core.exceptions import ValidationError
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction
from django.test import TestCase, override_settings
from rest_framework.test import APIClient

from api.models import (
    Application,
    ApplicationDocumentRequirement,
    Country,
    CountryWorkflow,
    CountryDocumentRequirement,
    CountryDocumentTemplate,
    ProcessStep,
    StudentDocument,
    StudentProfile,
)


MOCK_CLOUDINARY_RESPONSE = {
    'file_url': 'https://res.cloudinary.com/fake/image/upload/mock.pdf',
    'public_id': 'aiec/student_documents/mock',
}


@override_settings(PASSWORD_HASHERS=['django.contrib.auth.hashers.MD5PasswordHasher'])
class ApplicationDocumentChecklistTests(TestCase):
    def setUp(self):
        self.staff = User.objects.create_user(
            username='phase25_staff', password='StaffPass123!', is_staff=True
        )
        self.admin = User.objects.create_user(
            username='phase25_admin',
            password='AdminPass123!',
            is_staff=True,
            is_superuser=True,
        )
        self.student_user = User.objects.create_user(
            username='phase25_student', password='StudentPass123!'
        )
        self.other_student_user = User.objects.create_user(
            username='phase25_other', password='StudentPass123!'
        )
        self.unauthorized_user = User.objects.create_user(
            username='phase25_unauthorized', password='OtherPass123!'
        )
        self.student = StudentProfile.objects.create(
            user=self.student_user,
            full_name='Phase 2.5 Student',
            phone='555-0300',
            destination_country='Canada',
        )
        self.other_student = StudentProfile.objects.create(
            user=self.other_student_user,
            full_name='Other Phase 2.5 Student',
            phone='555-0301',
            destination_country='Canada',
        )
        self.canada = Country.objects.get(name='Canada')
        self.australia = Country.objects.get(name='Australia')
        self.canada_template = CountryDocumentTemplate.objects.get(
            country=self.canada,
            active=True,
        )
        self.application = Application.objects.create(
            student=self.student,
            university_name='Phase 2.5 University',
            course_name='Computer Science',
            country=self.canada,
            country_name='Canada',
            intake='Fall 2028',
        )
        self.other_application = Application.objects.create(
            student=self.other_student,
            university_name='Other Phase 2.5 University',
            course_name='Engineering',
            country=self.canada,
            country_name='Canada',
            intake='Fall 2028',
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.staff)
        self.requirement = self.application.document_requirements.get(
            document_type='passport'
        )

    def checklist_url(self, application=None):
        application = application or self.application
        return f'/api/applications/{application.id}/documents/'

    def application_url(self, application=None):
        application = application or self.application
        return f'/api/applications/{application.id}/'

    def make_document(self, student=None, document_type=None, status='pending', reason=''):
        return StudentDocument.objects.create(
            student=student or self.student,
            document_type=document_type or self.requirement.document_type,
            file_url=MOCK_CLOUDINARY_RESPONSE['file_url'],
            public_id=MOCK_CLOUDINARY_RESPONSE['public_id'],
            file_name='passport.pdf',
            uploaded_by=self.student_user,
            verification_status=status,
            rejection_reason=reason,
        )

    def test_default_templates_and_requirements_are_seeded_for_five_countries(self):
        expected_countries = {
            'United Kingdom', 'Canada', 'Australia', 'United States', 'Germany',
        }
        templates = CountryDocumentTemplate.objects.filter(active=True)
        self.assertTrue(expected_countries.issubset(set(templates.values_list('country__name', flat=True))))
        for country_name in expected_countries:
            template = CountryDocumentTemplate.objects.get(country__name=country_name, active=True)
            requirements = list(template.requirements.order_by('order'))
            self.assertEqual(len(requirements), 5)
            self.assertEqual([item.order for item in requirements], [1, 2, 3, 4, 5])
            self.assertTrue(all(item.required for item in requirements))
            self.assertTrue(all('not legal or immigration advice' in item.description for item in requirements))

    def test_country_template_and_document_requirement_can_be_created(self):
        country = Country.objects.create(
            name='Norway',
            code='NO',
            description='Study destination',
        )
        template = CountryDocumentTemplate.objects.create(
            country=country,
            name='Norway Documents',
            active=True,
        )
        requirement = CountryDocumentRequirement.objects.create(
            template=template,
            document_type='passport',
            label='Passport',
            description='Identity document',
            required=False,
            order=1,
        )

        self.assertEqual(requirement.template, template)
        self.assertFalse(requirement.required)

    def test_duplicate_template_document_type_is_blocked_by_database(self):
        existing = self.canada_template.requirements.first()
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CountryDocumentRequirement.objects.create(
                    template=self.canada_template,
                    document_type=existing.document_type,
                    label='Duplicate',
                    order=100,
                )

    def test_duplicate_template_order_is_blocked_by_database(self):
        with self.assertRaises(IntegrityError):
            with transaction.atomic():
                CountryDocumentRequirement.objects.create(
                    template=self.canada_template,
                    document_type='another_type',
                    label='Duplicate order',
                    order=1,
                )

    def test_application_checklist_is_generated_from_country_template(self):
        response = self.client.get(self.checklist_url())

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['template_name'], self.canada_template.name)
        self.assertEqual(len(response.data['requirements']), 5)
        self.assertEqual(
            [item['order'] for item in response.data['requirements']],
            [1, 2, 3, 4, 5],
        )

    def test_repeated_save_serialization_and_endpoint_reads_are_idempotent(self):
        initial_count = self.application.document_requirements.count()
        self.application.save()
        self.client.get(self.checklist_url())
        self.client.get(self.checklist_url())
        self.client.get(self.application_url())
        self.assertEqual(self.application.document_requirements.count(), initial_count)

    def test_application_without_country_has_no_invented_checklist(self):
        application = Application.objects.create(
            student=self.student,
            university_name='No Country University',
            course_name='Mathematics',
            country_name='Unmatched free text',
            intake='Spring 2029',
        )

        response = self.client.get(self.checklist_url(application))

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['status'], 'no_template')
        self.assertEqual(response.data['requirements'], [])
        self.assertFalse(application.document_requirements.exists())

    def test_optional_template_requirement_is_snapshotted(self):
        optional = CountryDocumentRequirement.objects.create(
            template=self.canada_template,
            document_type='optional_portfolio',
            label='Portfolio',
            description='Optional supporting material',
            required=False,
            order=6,
        )
        self.application.save()

        snapshot = self.application.document_requirements.get(
            template_requirement=optional
        )
        self.assertFalse(snapshot.required)
        response = self.client.get(self.checklist_url())
        serialized = next(
            item for item in response.data['requirements']
            if item['document_type'] == 'optional_portfolio'
        )
        self.assertFalse(serialized['required'])

    def test_missing_status_is_returned_without_a_linked_document(self):
        response = self.client.get(self.checklist_url())
        passport = next(item for item in response.data['requirements'] if item['id'] == self.requirement.id)
        self.assertEqual(passport['status'], 'missing')
        self.assertIsNone(passport['document'])

    def test_submitted_status_is_derived_from_linked_pending_document(self):
        document = self.make_document()
        self.requirement.student_document = document
        self.requirement.save()

        response = self.client.get(self.checklist_url())
        passport = next(item for item in response.data['requirements'] if item['id'] == self.requirement.id)
        self.assertEqual(passport['status'], 'submitted')
        self.assertEqual(passport['document']['id'], document.id)
        self.assertEqual(passport['document']['verification_status'], 'pending')

    def test_verified_status_is_derived_from_linked_student_document(self):
        document = self.make_document(status='verified')
        self.requirement.student_document = document
        self.requirement.save()

        response = self.client.get(self.checklist_url())
        passport = next(item for item in response.data['requirements'] if item['id'] == self.requirement.id)
        self.assertEqual(passport['status'], 'verified')

    def test_rejected_status_and_rejection_reason_are_derived_from_linked_document(self):
        document = self.make_document(status='rejected', reason='Please upload a clearer scan.')
        self.requirement.student_document = document
        self.requirement.save()

        response = self.client.get(self.checklist_url())
        passport = next(item for item in response.data['requirements'] if item['id'] == self.requirement.id)
        self.assertEqual(passport['status'], 'rejected')
        self.assertEqual(passport['document']['rejection_reason'], 'Please upload a clearer scan.')
        self.assertNotIn('public_id', passport['document'])
        self.assertNotIn('verified_by', passport['document'])

    def test_one_student_document_can_be_reused_across_applications(self):
        document = self.make_document()
        self.requirement.student_document = document
        self.requirement.save()
        second_application = Application.objects.create(
            student=self.student,
            university_name='Another University for Reuse',
            course_name='Data Science',
            country=self.canada,
            country_name='Canada',
            intake='Spring 2029',
        )
        second_requirement = second_application.document_requirements.get(
            document_type='passport'
        )

        response = self.client.post(
            f'/api/applications/{second_application.id}/documents/{second_requirement.id}/link/',
            {'student_document_id': document.id},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(
            ApplicationDocumentRequirement.objects.filter(student_document=document).count(),
            2,
        )

    def test_student_can_view_own_application_document_checklist(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get(self.checklist_url())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data['application'], self.application.id)

    def test_student_cannot_view_another_students_application_checklist(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.get(self.checklist_url(self.other_application))
        self.assertEqual(response.status_code, 403)

    def test_student_cannot_view_another_students_application_document(self):
        document = self.make_document(student=self.other_student)
        self.client.force_authenticate(user=self.student_user)
        response = self.client.post(
            f'/api/applications/{self.application.id}/documents/{self.requirement.id}/link/',
            {'student_document_id': document.id},
            format='json',
        )
        self.assertEqual(response.status_code, 404)

    def test_unauthorized_staff_cannot_view_application_checklist(self):
        self.client.force_authenticate(user=self.unauthorized_user)
        response = self.client.get(self.checklist_url())
        self.assertEqual(response.status_code, 403)

    def test_authorized_staff_can_view_application_checklist(self):
        response = self.client.get(self.checklist_url())
        self.assertEqual(response.status_code, 200)

    def test_admin_can_view_application_checklist(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.get(self.checklist_url())
        self.assertEqual(response.status_code, 200)

    def test_anonymous_user_is_denied_from_application_document_checklist(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(self.checklist_url()).status_code, 401)

    def test_student_cannot_modify_checklist_definitions(self):
        self.client.force_authenticate(user=self.student_user)
        response = self.client.patch(self.checklist_url(), {'required': False}, format='json')
        self.assertEqual(response.status_code, 405)

    def test_student_cannot_verify_a_student_document(self):
        document = self.make_document()
        self.client.force_authenticate(user=self.student_user)
        response = self.client.patch(
            f'/api/documents/{document.id}/status/',
            {'verification_status': 'verified'},
            format='json',
        )
        self.assertEqual(response.status_code, 403)

    def test_country_change_before_document_progress_preserves_old_snapshots(self):
        initial_count = self.application.document_requirements.count()
        response = self.client.patch(
            self.application_url(),
            {'country': self.australia.id, 'country_name': self.australia.name},
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.application.document_requirements.count(), initial_count + 5)
        self.assertEqual(response.data['document_checklist']['template_name'], 'Australia Default Application Documents')

    def test_country_change_after_document_progress_is_rejected(self):
        document = self.make_document()
        self.requirement.student_document = document
        self.requirement.save()
        response = self.client.patch(
            self.application_url(),
            {'country': self.australia.id, 'country_name': self.australia.name},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('country', response.data)

    def test_country_name_snapshot_change_after_document_progress_is_rejected(self):
        document = self.make_document()
        self.requirement.student_document = document
        self.requirement.save()
        response = self.client.patch(
            self.application_url(),
            {'country_name': 'Japan'},
            format='json',
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn('country', response.data)

    def test_model_country_change_after_document_progress_is_rejected(self):
        document = self.make_document()
        self.requirement.student_document = document
        self.requirement.save()
        self.application.country = self.australia
        with self.assertRaisesMessage(ValidationError, 'Country cannot be changed'):
            self.application.save()

    def test_existing_upload_api_still_creates_unlinked_student_document(self):
        upload = SimpleUploadedFile('passport.pdf', b'%PDF-1.4 sample', content_type='application/pdf')
        self.client.force_authenticate(user=self.student_user)
        with patch('api.views.upload_document_to_cloudinary', return_value=MOCK_CLOUDINARY_RESPONSE), \
             patch('api.views.is_cloudinary_configured', return_value=True):
            response = self.client.post(
                '/api/documents/upload/',
                {'file': upload, 'document_type': 'Passport', 'student_id': self.student.id},
                format='multipart',
            )

        self.assertEqual(response.status_code, 201, response.data)
        created_document = StudentDocument.objects.get(pk=response.data['id'])
        self.assertEqual(created_document.document_type, 'Passport')
        self.assertFalse(created_document.application_requirements.exists())

    def test_existing_upload_flow_can_link_to_selected_application_requirement(self):
        upload = SimpleUploadedFile('passport.pdf', b'%PDF-1.4 sample', content_type='application/pdf')
        self.client.force_authenticate(user=self.student_user)
        with patch('api.views.upload_document_to_cloudinary', return_value=MOCK_CLOUDINARY_RESPONSE), \
             patch('api.views.is_cloudinary_configured', return_value=True):
            response = self.client.post(
                '/api/documents/upload/',
                {
                    'file': upload,
                    'document_type': self.requirement.document_type,
                    'student_id': self.student.id,
                    'application_requirement_id': self.requirement.id,
                },
                format='multipart',
            )

        self.assertEqual(response.status_code, 201, response.data)
        self.requirement.refresh_from_db()
        self.assertEqual(self.requirement.student_document_id, response.data['id'])

    def test_student_cannot_upload_for_another_students_requirement(self):
        other_requirement = self.other_application.document_requirements.get(document_type='passport')
        upload = SimpleUploadedFile('passport.pdf', b'%PDF-1.4 sample', content_type='application/pdf')
        self.client.force_authenticate(user=self.student_user)
        with patch('api.views.upload_document_to_cloudinary') as cloudinary_upload, \
             patch('api.views.is_cloudinary_configured', return_value=True):
            response = self.client.post(
                '/api/documents/upload/',
                {
                    'file': upload,
                    'document_type': other_requirement.document_type,
                    'application_requirement_id': other_requirement.id,
                },
                format='multipart',
            )
        self.assertEqual(response.status_code, 404)
        cloudinary_upload.assert_not_called()

    def test_pending_submission_cannot_be_silently_replaced(self):
        document = self.make_document()
        self.requirement.student_document = document
        self.requirement.save()
        upload = SimpleUploadedFile('replacement.pdf', b'%PDF-1.4 sample', content_type='application/pdf')
        self.client.force_authenticate(user=self.student_user)
        with patch('api.views.upload_document_to_cloudinary') as cloudinary_upload, \
             patch('api.views.is_cloudinary_configured', return_value=True):
            response = self.client.post(
                '/api/documents/upload/',
                {
                    'file': upload,
                    'document_type': self.requirement.document_type,
                    'application_requirement_id': self.requirement.id,
                },
                format='multipart',
            )
        self.assertEqual(response.status_code, 409)
        cloudinary_upload.assert_not_called()
        self.requirement.refresh_from_db()
        self.assertEqual(self.requirement.student_document_id, document.id)

    def test_rejected_document_can_be_explicitly_reuploaded_without_deleting_old_file_record(self):
        previous_document = self.make_document(status='rejected', reason='Unreadable')
        self.requirement.student_document = previous_document
        self.requirement.save()
        upload = SimpleUploadedFile('replacement.pdf', b'%PDF-1.4 sample', content_type='application/pdf')
        self.client.force_authenticate(user=self.student_user)
        with patch('api.views.upload_document_to_cloudinary', return_value=MOCK_CLOUDINARY_RESPONSE), \
             patch('api.views.is_cloudinary_configured', return_value=True):
            response = self.client.post(
                '/api/documents/upload/',
                {
                    'file': upload,
                    'document_type': self.requirement.document_type,
                    'application_requirement_id': self.requirement.id,
                },
                format='multipart',
            )
        self.assertEqual(response.status_code, 201, response.data)
        self.assertTrue(StudentDocument.objects.filter(pk=previous_document.id).exists())
        self.requirement.refresh_from_db()
        self.assertNotEqual(self.requirement.student_document_id, previous_document.id)

    def test_existing_verification_api_updates_requirement_effective_status(self):
        document = self.make_document()
        self.requirement.student_document = document
        self.requirement.save()

        response = self.client.patch(
            f'/api/documents/{document.id}/status/',
            {
                'verification_status': 'rejected',
                'rejection_reason': 'Missing a page.',
            },
            format='json',
        )

        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['rejection_reason'], 'Missing a page.')
        checklist = self.client.get(self.checklist_url())
        passport = next(item for item in checklist.data['requirements'] if item['id'] == self.requirement.id)
        self.assertEqual(passport['status'], 'rejected')
        self.assertEqual(passport['document']['rejection_reason'], 'Missing a page.')

    def test_existing_application_lifecycle_status_behavior_is_preserved(self):
        response = self.client.patch(
            self.application_url(),
            {'status': 'applied'},
            format='json',
        )
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(response.data['status'], 'applied')

    def test_application_workflow_and_process_step_remain_separate(self):
        process_step = ProcessStep.objects.create(
            student=self.student,
            step_name='Independent student checklist step',
            order=1,
        )
        workflow_step = CountryWorkflow.objects.get(
            country=self.canada,
            active=True,
        ).steps.first()
        self.client.post(
            f'/api/applications/{self.application.id}/workflow-steps/{workflow_step.id}/complete/',
            {},
            format='json',
        )

        self.assertEqual(process_step.student_id, self.application.student_id)
        self.assertEqual(self.application.document_requirements.count(), 5)
        self.assertEqual(self.application.workflow_progress.count(), 1)
        self.assertEqual(ProcessStep.objects.filter(student=self.student).count(), 1)
