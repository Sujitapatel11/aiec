from django.db.models.signals import post_save, pre_save
from django.dispatch import receiver

from .models import (
    Application,
    ApplicationDocumentRequirement,
    ApplicationOffer,
    ApplicationTimelineEvent,
    StudentDocument,
    StudentProfile,
)


def _record_event(application_id, event_type, title, description='', actor=None, created_at=None):
    values = {
        'application_id': application_id,
        'event_type': event_type,
        'title': title,
        'description': description,
        'actor': actor,
    }
    if created_at is not None:
        values['created_at'] = created_at
    ApplicationTimelineEvent.objects.create(**values)


@receiver(pre_save, sender=Application, dispatch_uid='timeline_application_before_save')
def remember_application_status(sender, instance, **kwargs):
    instance._timeline_previous_status = None
    if instance.pk:
        instance._timeline_previous_status = sender.objects.filter(
            pk=instance.pk
        ).values_list('status', flat=True).first()


@receiver(post_save, sender=Application, dispatch_uid='timeline_application_after_save')
def record_application_events(sender, instance, created, **kwargs):
    actor = getattr(instance, '_timeline_actor', None)
    if created:
        _record_event(
            instance.pk,
            'application_created',
            'Application Created',
            f"{instance.university_name} — {instance.course_name}",
            actor,
        )
        student = instance.student
        if student.created_at:
            _record_event(
                instance.pk,
                'enrollment_created',
                'Enrollment Created',
                f"{student.full_name} enrolled on {student.created_at.date().isoformat()}.",
                student.enrolled_by,
                student.created_at,
            )
    elif instance._timeline_previous_status and instance._timeline_previous_status != instance.status:
        _record_event(
            instance.pk,
            'application_status_changed',
            'Application Status Changed',
            f"{instance._timeline_previous_status} → {instance.status}",
            actor,
        )


@receiver(pre_save, sender=ApplicationOffer, dispatch_uid='timeline_offer_before_save')
def remember_offer_status(sender, instance, **kwargs):
    instance._timeline_previous_status = None
    instance._timeline_previous_document_id = None
    if instance.pk:
        previous = sender.objects.filter(pk=instance.pk).values(
            'acceptance_status', 'offer_document_id'
        ).first()
        if previous:
            instance._timeline_previous_status = previous['acceptance_status']
            instance._timeline_previous_document_id = previous['offer_document_id']


@receiver(post_save, sender=ApplicationOffer, dispatch_uid='timeline_offer_after_save')
def record_offer_events(sender, instance, created, **kwargs):
    actor = getattr(instance, '_timeline_actor', None)
    if created:
        _record_event(
            instance.application_id,
            'offer_received',
            'Offer Received',
            f"{instance.get_offer_type_display()} recorded"
            + (f" (code {instance.offer_code})." if instance.offer_code else '.'),
            actor,
        )
    elif instance._timeline_previous_status and instance._timeline_previous_status != instance.acceptance_status:
        _record_event(
            instance.application_id,
            'offer_status_changed',
            'Offer Status Changed',
            f"{instance._timeline_previous_status} → {instance.acceptance_status}",
            actor,
        )

    previous_document_id = getattr(instance, '_timeline_previous_document_id', None)
    if instance.offer_document_id and (
        created or previous_document_id != instance.offer_document_id
    ):
        document = instance.offer_document
        _record_event(
            instance.application_id,
            'document_linked',
            'Document Linked',
            f"{document.document_type} linked as an offer letter.",
            actor or document.uploaded_by,
        )


@receiver(pre_save, sender=StudentProfile, dispatch_uid='timeline_enrollment_before_save')
def remember_enrollment_status(sender, instance, **kwargs):
    instance._timeline_previous_status = None
    if instance.pk:
        instance._timeline_previous_status = sender.objects.filter(
            pk=instance.pk
        ).values_list('status', flat=True).first()


@receiver(post_save, sender=StudentProfile, dispatch_uid='timeline_enrollment_after_save')
def record_enrollment_status_events(sender, instance, created, **kwargs):
    previous_status = getattr(instance, '_timeline_previous_status', None)
    if created or not previous_status or previous_status == instance.status:
        return
    for application_id in instance.applications.values_list('pk', flat=True):
        _record_event(
            application_id,
            'enrollment_status_changed',
            'Enrollment Status Changed',
            f"{previous_status} → {instance.status}",
            getattr(instance, '_timeline_actor', None),
        )


@receiver(pre_save, sender=ApplicationDocumentRequirement, dispatch_uid='timeline_document_link_before_save')
def remember_linked_document(sender, instance, **kwargs):
    instance._timeline_previous_document_id = None
    if instance.pk:
        instance._timeline_previous_document_id = sender.objects.filter(
            pk=instance.pk
        ).values_list('student_document_id', flat=True).first()


@receiver(post_save, sender=ApplicationDocumentRequirement, dispatch_uid='timeline_document_link_after_save')
def record_document_link_events(sender, instance, created, **kwargs):
    previous_document_id = getattr(instance, '_timeline_previous_document_id', None)
    if not instance.student_document_id or (
        not created and previous_document_id == instance.student_document_id
    ):
        return
    document = instance.student_document
    _record_event(
        instance.application_id,
        'document_linked',
        'Document Linked',
        f"{document.document_type} linked to {instance.label}.",
        getattr(instance, '_timeline_actor', None) or document.uploaded_by,
    )


@receiver(pre_save, sender=StudentDocument, dispatch_uid='timeline_document_status_before_save')
def remember_document_status(sender, instance, **kwargs):
    instance._timeline_previous_status = None
    if instance.pk:
        instance._timeline_previous_status = sender.objects.filter(
            pk=instance.pk
        ).values_list('verification_status', flat=True).first()


@receiver(post_save, sender=StudentDocument, dispatch_uid='timeline_document_status_after_save')
def record_document_verification_events(sender, instance, created, **kwargs):
    previous_status = getattr(instance, '_timeline_previous_status', None)
    if created or not previous_status or previous_status == instance.verification_status:
        return

    application_ids = set(instance.application_requirements.values_list('application_id', flat=True))
    application_ids.update(instance.offer_links.values_list('application_id', flat=True))
    if not application_ids:
        return

    if instance.verification_status == 'verified':
        title = 'Document Verified'
        event_type = 'document_verified'
    else:
        title = 'Document Verification Updated'
        event_type = 'document_verification_changed'
    for application_id in application_ids:
        _record_event(
            application_id,
            event_type,
            title,
            f"{instance.document_type}: {previous_status} → {instance.verification_status}",
            getattr(instance, '_timeline_actor', None) or instance.verified_by,
        )
