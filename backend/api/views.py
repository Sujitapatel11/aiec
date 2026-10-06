from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes, action
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.db.models import Count, Q
from django.utils import timezone
import secrets
import os
import threading
import re

from .models import (
    Lead, LeadActivity, Questionnaire, Country, Course,
    StudentProfile, ProcessStep, Payment, VideoTestimonial, StudentDocument,
    DEFAULT_CHECKLIST_TEMPLATE, _get_default_checklist,
    CounsellingNote, FollowUp, Task, Appointment, Application, ApplicationOffer, VisaCase, Enrollment,
    ApplicationWorkflowProgress, CountryWorkflowStep
)
from .serializers import (
    LeadSerializer, LeadDetailSerializer, LeadActivitySerializer, StaffUserSerializer,
    QuestionnaireSerializer, QuestionnaireCreateSerializer,
    CountrySerializer, CourseSerializer,
    ProfileRecommendationSerializer, LeadCaptureSerializer,
    StudentProfileSerializer, StudentPortalProfileSerializer,
    StudentProfileUpdateSerializer, StudentEnrollmentSerializer,
    ProcessStepSerializer, PaymentSerializer, VideoTestimonialSerializer, StudentDocumentSerializer,
    CounsellingNoteSerializer, FollowUpSerializer, TaskSerializer, AppointmentSerializer,
    ApplicationSerializer, ApplicationOfferSerializer, VisaCaseSerializer, EnrollmentSerializer
)
from . import cloudinary_service
from .cloudinary_service import (
    is_cloudinary_configured, upload_video_to_cloudinary, delete_video_from_cloudinary,
    upload_document_to_cloudinary, delete_document_from_cloudinary
)
from .ai_service import get_ai_recommendations
from .recommendation_service import get_profile_recommendation
from .chat_service import get_chat_response
from .notify import send_lead_notification
from .whatsapp_service import send_step_completion_whatsapp, send_whatsapp_to_lead
from django.contrib.auth.models import User, Group
import threading
import re

WEAK_PASSWORDS_BLACKLIST = {
    '1234', '12345', '123456', '12345678', '123456789', 'password', 'password123',
    'admin123', 'qwerty123', 'letmein123', 'welcome123', 'staff123', 'admin'
}

def validate_password_strength(password):
    """Validates server-side password strength rules for staff account creation."""
    if not password or len(password) < 8:
        return "Password must be at least 8 characters long."
    if password.lower() in WEAK_PASSWORDS_BLACKLIST:
        return "Password is too weak or common. Please choose a stronger password."
    if not (re.search(r'[A-Za-z]', password) and re.search(r'\d', password)):
        return "Password must contain a mix of both letters and numbers."
    return None



# ── Admin-only viewsets ────────────────────────────────────────────────────

CRM_LEAD_SOURCES = {'ai_assessment', 'whatsapp_inquiry', 'chatbot', 'crm_manual'}


def normalize_lead_phone(phone):
    return re.sub(r'\D', '', str(phone or ''))

class LeadViewSet(viewsets.ModelViewSet):
    queryset = Lead.objects.all()
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (
            request.user.is_superuser
            or request.user.is_staff
            or request.user.groups.filter(name='Staff').exists()
        ):
            self.permission_denied(
                request, message='Admin or Staff permissions required.'
            )

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return LeadDetailSerializer
        return LeadSerializer

    def get_queryset(self):
        # For detail view, prefetch nested counselling collections to avoid N+1
        if self.action == 'retrieve':
            qs = Lead.objects.prefetch_related(
                'activities__author',
                'counselling_notes__author',
                'follow_ups__assigned_to',
                'follow_ups__created_by',
                'tasks__assigned_to',
                'tasks__created_by',
                'appointments__assigned_to',
                'appointments__created_by',
                'questionnaire',
            ).select_related('assigned_to')
        else:
            qs = Lead.objects.select_related('assigned_to')

        country = self.request.query_params.get('country', '').strip()
        course  = self.request.query_params.get('course', '').strip()
        status_param  = self.request.query_params.get('status', '').strip()
        search  = self.request.query_params.get('search', '').strip()

        if country:
            qs = qs.filter(Q(recommended_country__icontains=country) | Q(country_of_residence__icontains=country))
        if course:
            qs = qs.filter(Q(course_interest__icontains=course) | Q(recommended_course__icontains=course))
        if status_param:
            qs = qs.filter(status=status_param)
        if search:
            qs = qs.filter(Q(name__icontains=search) | Q(email__icontains=search) | Q(phone__icontains=search))

        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        data = request.data.copy()
        source = str(data.get('source') or 'crm_manual').strip().lower()
        if source not in CRM_LEAD_SOURCES:
            return Response(
                {'source': [f'Source must be one of: {", ".join(sorted(CRM_LEAD_SOURCES))}.']},
                status=status.HTTP_400_BAD_REQUEST
            )
        data['source'] = source

        serializer = self.get_serializer(data=data)
        serializer.is_valid(raise_exception=True)
        email = serializer.validated_data['email'].strip().lower()
        phone = normalize_lead_phone(serializer.validated_data['phone'])

        if Lead.objects.filter(email__iexact=email).exists():
            return Response(
                {'error': 'Lead with this email/phone already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if phone and any(
            normalize_lead_phone(existing_phone) == phone
            for existing_phone in Lead.objects.values_list('phone', flat=True)
        ):
            return Response(
                {'error': 'Lead with this email/phone already exists.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        lead = serializer.save(email=email, phone=phone)
        LeadActivity.objects.create(
            lead=lead,
            author=request.user,
            activity_type='note',
            content=f"Lead created manually via CRM by {request.user.get_full_name() or request.user.username}."
        )
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', False)
        instance = self.get_object()

        old_status = instance.status
        old_assigned = instance.assigned_to
        old_followup = instance.next_follow_up

        if 'assigned_to' in request.data:
            assigned_user_id = request.data['assigned_to']
            if assigned_user_id is not None:
                try:
                    assignee = User.objects.get(pk=assigned_user_id)
                except User.DoesNotExist:
                    return Response({'error': 'Assigned staff user not found.'}, status=status.HTTP_400_BAD_REQUEST)

                if not request.user.is_superuser and assignee != request.user:
                    return Response(
                        {'error': 'Only Admins can assign or reassign leads to other staff members.'},
                        status=status.HTTP_403_FORBIDDEN
                    )

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        updated_lead = serializer.save()

        if 'status' in request.data and updated_lead.status != old_status:
            LeadActivity.objects.create(
                lead=updated_lead,
                author=request.user,
                activity_type='status_change',
                content=f"Status changed from '{old_status}' to '{updated_lead.status}'"
            )

        if 'assigned_to' in request.data and updated_lead.assigned_to != old_assigned:
            if updated_lead.assigned_to:
                assignee_name = updated_lead.assigned_to.get_full_name() or updated_lead.assigned_to.username
                msg = f"Assigned to staff member: {assignee_name}"
            else:
                msg = "Lead assignment removed."
            LeadActivity.objects.create(
                lead=updated_lead,
                author=request.user,
                activity_type='assignment',
                content=msg
            )

        if 'next_follow_up' in request.data and updated_lead.next_follow_up != old_followup:
            followup_str = updated_lead.next_follow_up.strftime('%Y-%m-%d %H:%M') if updated_lead.next_follow_up else 'Cleared'
            LeadActivity.objects.create(
                lead=updated_lead,
                author=request.user,
                activity_type='followup',
                content=f"Next follow-up updated to: {followup_str}"
            )

        return Response(serializer.data)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_superuser or request.user.has_perm('api.can_delete_lead')):
            return Response(
                {'error': 'Access denied. Only admins or authorized staff can delete leads.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)

    @action(detail=False, methods=['get'], url_path='staff-users')
    def staff_users(self, request):
        users = User.objects.filter(is_active=True).filter(
            Q(is_staff=True) | Q(is_superuser=True) | Q(groups__name='Staff')
        ).distinct().order_by('first_name', 'username')
        serializer = StaffUserSerializer(users, many=True)
        return Response(serializer.data)

    @action(detail=True, methods=['get', 'post'], url_path='activities')
    def activities(self, request, pk=None):
        lead = self.get_object()
        if request.method == 'GET':
            qs = lead.activities.all().order_by('-created_at')
            serializer = LeadActivitySerializer(qs, many=True)
            return Response(serializer.data)

        activity_type = str(request.data.get('activity_type') or 'note').strip()
        content = str(request.data.get('content') or '').strip()
        if not content:
            return Response({'error': 'Activity content is required.'}, status=status.HTTP_400_BAD_REQUEST)

        activity = LeadActivity.objects.create(
            lead=lead,
            author=request.user,
            activity_type=activity_type,
            content=content
        )
        return Response(LeadActivitySerializer(activity).data, status=status.HTTP_201_CREATED)

    # ── Phase A: Outbound WhatsApp from Lead Detail ────────────────────

    # In-memory per-process send tracker for lightweight abuse prevention.
    # Maps (user_id, lead_id) → [timestamp, ...] of recent sends.
    # This resets on every process restart (Render spins up fresh processes).
    # It is not shared across multiple workers — document that Redis-backed
    # throttling is the correct Phase B upgrade path.
    _wa_send_log: dict = {}
    _WA_WINDOW_SECONDS = 60    # sliding window
    _WA_MAX_PER_WINDOW = 5     # max sends per user per lead per window

    @action(detail=True, methods=['post'], url_path='send-whatsapp')
    def send_whatsapp(self, request, pk=None):
        """
        POST /api/leads/<pk>/send-whatsapp/

        Send an outbound WhatsApp message from the AIEC Business number to the
        lead's registered phone number.

        Authorization: Admin or Staff only (enforced by LeadViewSet.initial()).
        The recipient phone number is always retrieved server-side from the Lead
        record — the client MUST NOT supply it.

        Request body:
            { "message": "<string, max 1000 chars>" }

        Returns:
            201  { "sent": true,  "activity_id": <int>, "message": "..." }
            400  { "error": "..." }   — validation failure / phone issue
            503  { "error": "..." }   — Twilio/config failure
        """
        import time

        lead = self.get_object()   # Raises 404 if not found; DRF handles 403

        # ── 1. Message validation ──────────────────────────────────────
        from .whatsapp_service import WHATSAPP_MAX_MESSAGE_LENGTH

        raw_message = request.data.get('message', None)
        if raw_message is None:
            return Response(
                {'error': 'message is required.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if not isinstance(raw_message, str):
            return Response(
                {'error': 'message must be a string.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        message = raw_message.strip()
        if not message:
            return Response(
                {'error': 'message must not be empty or whitespace only.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if len(message) > WHATSAPP_MAX_MESSAGE_LENGTH:
            return Response(
                {'error': f'message exceeds maximum length of {WHATSAPP_MAX_MESSAGE_LENGTH} characters.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── 2. Lead must have a phone number ──────────────────────────
        if not lead.phone or not lead.phone.strip():
            return Response(
                {'error': 'This lead does not have a phone number on record. '
                          'Please update the lead profile before sending a WhatsApp message.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # ── 3. Lightweight in-process rate limiting ────────────────────
        now = time.time()
        key = (request.user.id, lead.id)
        window = self.__class__._WA_WINDOW_SECONDS
        max_sends = self.__class__._WA_MAX_PER_WINDOW
        log = self.__class__._wa_send_log
        # Prune timestamps outside the window
        log[key] = [t for t in log.get(key, []) if now - t < window]
        if len(log[key]) >= max_sends:
            return Response(
                {'error': f'Too many WhatsApp messages sent in the last {window} seconds. '
                          f'Maximum is {max_sends} per {window}s per lead. Please wait before retrying.'},
                status=status.HTTP_429_TOO_MANY_REQUESTS
            )

        # ── 4. Dispatch via WhatsApp service ──────────────────────────
        sender_name = request.user.get_full_name() or request.user.username
        result = send_whatsapp_to_lead(
            lead_phone=lead.phone,
            message=message,
            sender_name=sender_name,
        )

        # ── 5. Handle result ──────────────────────────────────────────
        if not result['sent']:
            # Safe user-facing error — no Twilio credentials or internal details
            return Response(
                {'error': result.get('error', 'WhatsApp message could not be sent.')},
                status=status.HTTP_503_SERVICE_UNAVAILABLE
            )

        # ── 6. Record in rate-limit tracker ──────────────────────────
        log[key].append(now)

        # ── 7. Log to LeadActivity ─────────────────────────────────────
        # Distinguish real dispatched messages from manual journal entries by
        # prefixing with "[Sent via AIEC WhatsApp]".
        sid_note = f" (SID: {result['sid']})" if result.get('sid') else ""
        activity_content = f"[Sent via AIEC WhatsApp]{sid_note}\n{message}"

        activity = LeadActivity.objects.create(
            lead=lead,
            author=request.user,
            activity_type='whatsapp',
            content=activity_content,
        )

        return Response(
            {
                'sent': True,
                'activity_id': activity.id,
                'message': 'WhatsApp message sent successfully.',
            },
            status=status.HTTP_201_CREATED
        )


# ── CRM Counselling, Follow-ups, Tasks & Appointments ViewSets ────────────

class CounsellingNoteViewSet(viewsets.ModelViewSet):
    # Phase 1.3 — select_related to avoid N+1 on author/lead/student lookups
    queryset = CounsellingNote.objects.select_related('lead', 'student', 'author').all()
    serializer_class = CounsellingNoteSerializer
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
            self.permission_denied(request, message='Admin or Staff permissions required.')

    def get_queryset(self):
        qs = CounsellingNote.objects.select_related('lead', 'student', 'author').all()
        lead_id = self.request.query_params.get('lead')
        student_id = self.request.query_params.get('student')
        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        if student_id:
            qs = qs.filter(student_id=student_id)
        return qs.order_by('-created_at')

    def perform_create(self, serializer):
        note = serializer.save(author=self.request.user)
        # Auto-log activity on the associated lead's timeline
        if note.lead:
            author_name = self.request.user.get_full_name() or self.request.user.username
            LeadActivity.objects.create(
                lead=note.lead,
                author=self.request.user,
                activity_type='counselling_note',
                content=f"Counselling note added by {author_name}: {note.content[:120]}{'…' if len(note.content) > 120 else ''}"
            )


class FollowUpViewSet(viewsets.ModelViewSet):
    # Phase 1.3 — select_related to avoid N+1
    queryset = FollowUp.objects.select_related('lead', 'student', 'assigned_to', 'created_by').all()
    serializer_class = FollowUpSerializer
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
            self.permission_denied(request, message='Admin or Staff permissions required.')

    def get_queryset(self):
        qs = FollowUp.objects.select_related('lead', 'student', 'assigned_to', 'created_by').all()
        lead_id = self.request.query_params.get('lead')
        student_id = self.request.query_params.get('student')
        status_param = self.request.query_params.get('status')
        priority_param = self.request.query_params.get('priority')
        assigned_to_param = self.request.query_params.get('assigned_to')
        overdue_param = self.request.query_params.get('overdue')

        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        if student_id:
            qs = qs.filter(student_id=student_id)
        if status_param:
            qs = qs.filter(status=status_param)
        if priority_param:
            qs = qs.filter(priority=priority_param)
        if assigned_to_param:
            qs = qs.filter(assigned_to_id=assigned_to_param)
        if overdue_param == 'true':
            from django.utils import timezone
            qs = qs.filter(status='pending', due_at__lt=timezone.now())

        return qs.order_by('due_at', '-created_at')

    def perform_create(self, serializer):
        from django.utils import timezone as tz
        followup = serializer.save(created_by=self.request.user)
        # Sync lead.next_follow_up to the earliest pending follow-up
        if followup.lead and followup.due_at and followup.status == 'pending':
            lead = followup.lead
            if not lead.next_follow_up or followup.due_at < lead.next_follow_up:
                lead.next_follow_up = followup.due_at
                lead.save()
        # Auto-log activity on the lead timeline
        if followup.lead:
            due_str = followup.due_at.strftime('%d %b %Y %H:%M') if followup.due_at else 'N/A'
            assignee = followup.assigned_to.get_full_name() or followup.assigned_to.username if followup.assigned_to else 'Unassigned'
            creator = self.request.user.get_full_name() or self.request.user.username
            LeadActivity.objects.create(
                lead=followup.lead,
                author=self.request.user,
                activity_type='followup',
                content=f"Follow-up created by {creator}: '{followup.title}' · Due: {due_str} · Assigned to: {assignee} · Priority: {followup.priority}"
            )

    def perform_update(self, serializer):
        from django.utils import timezone as tz
        old_status = serializer.instance.status
        old_instance = serializer.instance
        new_status = self.request.data.get('status', old_status)
        completed_at = serializer.instance.completed_at
        if new_status == 'completed' and old_status != 'completed':
            completed_at = tz.now()

        followup = serializer.save(completed_at=completed_at)

        # Sync lead.next_follow_up
        if followup.lead:
            lead = followup.lead
            earliest_pending = FollowUp.objects.filter(lead=lead, status='pending').order_by('due_at').first()
            lead.next_follow_up = earliest_pending.due_at if earliest_pending else None
            lead.save()

        # Auto-log status transitions on the lead timeline
        if followup.lead and new_status != old_status:
            actor = self.request.user.get_full_name() or self.request.user.username
            if new_status == 'completed':
                msg = f"Follow-up completed by {actor}: '{followup.title}'"
            elif new_status == 'cancelled':
                msg = f"Follow-up cancelled by {actor}: '{followup.title}'"
            else:
                msg = f"Follow-up '{followup.title}' updated to '{new_status}' by {actor}"
            LeadActivity.objects.create(
                lead=followup.lead,
                author=self.request.user,
                activity_type='followup',
                content=msg
            )


class TaskViewSet(viewsets.ModelViewSet):
    # Phase 1.3 — select_related to avoid N+1
    queryset = Task.objects.select_related('lead', 'student', 'assigned_to', 'created_by').all()
    serializer_class = TaskSerializer
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
            self.permission_denied(request, message='Admin or Staff permissions required.')

    def get_queryset(self):
        qs = Task.objects.select_related('lead', 'student', 'assigned_to', 'created_by').all()
        lead_id = self.request.query_params.get('lead')
        student_id = self.request.query_params.get('student')
        status_param = self.request.query_params.get('status')
        priority_param = self.request.query_params.get('priority')
        assigned_to_param = self.request.query_params.get('assigned_to')
        overdue_param = self.request.query_params.get('overdue')  # Phase 1.3 — parity with FollowUp

        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        if student_id:
            qs = qs.filter(student_id=student_id)
        if status_param:
            qs = qs.filter(status=status_param)
        if priority_param:
            qs = qs.filter(priority=priority_param)
        if assigned_to_param:
            qs = qs.filter(assigned_to_id=assigned_to_param)
        if overdue_param == 'true':
            from django.utils import timezone
            qs = qs.filter(status__in=['pending', 'in_progress'], due_at__lt=timezone.now())

        return qs.order_by('due_at', '-created_at')

    def perform_create(self, serializer):
        task = serializer.save(created_by=self.request.user)
        # Auto-log activity on the lead timeline
        if task.lead:
            creator = self.request.user.get_full_name() or self.request.user.username
            due_str = task.due_at.strftime('%d %b %Y %H:%M') if task.due_at else 'No due date'
            assignee = task.assigned_to.get_full_name() or task.assigned_to.username if task.assigned_to else 'Unassigned'
            LeadActivity.objects.create(
                lead=task.lead,
                author=self.request.user,
                activity_type='task',
                content=f"Task created by {creator}: '{task.title}' · Due: {due_str} · Assigned to: {assignee} · Priority: {task.priority}"
            )

    def perform_update(self, serializer):
        from django.utils import timezone as tz
        old_status = serializer.instance.status
        new_status = self.request.data.get('status', old_status)
        completed_at = serializer.instance.completed_at
        if new_status == 'completed' and old_status != 'completed':
            completed_at = tz.now()
        task = serializer.save(completed_at=completed_at)

        # Auto-log status transitions on the lead timeline
        if task.lead and new_status != old_status:
            actor = self.request.user.get_full_name() or self.request.user.username
            if new_status == 'completed':
                msg = f"Task completed by {actor}: '{task.title}'"
            elif new_status == 'cancelled':
                msg = f"Task cancelled by {actor}: '{task.title}'"
            elif new_status == 'in_progress':
                msg = f"Task started by {actor}: '{task.title}'"
            else:
                msg = f"Task '{task.title}' updated to '{new_status}' by {actor}"
            LeadActivity.objects.create(
                lead=task.lead,
                author=self.request.user,
                activity_type='task',
                content=msg
            )


class AppointmentViewSet(viewsets.ModelViewSet):
    # Phase 1.3 — select_related to avoid N+1
    queryset = Appointment.objects.select_related('lead', 'student', 'assigned_to', 'created_by').all()
    serializer_class = AppointmentSerializer
    permission_classes = [IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
            self.permission_denied(request, message='Admin or Staff permissions required.')

    def get_queryset(self):
        qs = Appointment.objects.select_related('lead', 'student', 'assigned_to', 'created_by').all()
        lead_id = self.request.query_params.get('lead')
        student_id = self.request.query_params.get('student')
        status_param = self.request.query_params.get('status')
        assigned_to_param = self.request.query_params.get('assigned_to')
        # Phase 1.3 — date-range filters: upcoming=true (future), past=true (past)
        upcoming_param = self.request.query_params.get('upcoming')
        past_param = self.request.query_params.get('past')

        if lead_id:
            qs = qs.filter(lead_id=lead_id)
        if student_id:
            qs = qs.filter(student_id=student_id)
        if status_param:
            qs = qs.filter(status=status_param)
        if assigned_to_param:
            qs = qs.filter(assigned_to_id=assigned_to_param)
        if upcoming_param == 'true':
            from django.utils import timezone
            qs = qs.filter(appointment_date__gte=timezone.now())
        if past_param == 'true':
            from django.utils import timezone
            qs = qs.filter(appointment_date__lt=timezone.now())

        return qs.order_by('appointment_date', '-created_at')

    def perform_create(self, serializer):
        appointment = serializer.save(created_by=self.request.user)
        # Auto-log activity on the lead timeline
        if appointment.lead:
            creator = self.request.user.get_full_name() or self.request.user.username
            date_str = appointment.appointment_date.strftime('%d %b %Y %H:%M') if appointment.appointment_date else 'N/A'
            assignee = appointment.assigned_to.get_full_name() or appointment.assigned_to.username if appointment.assigned_to else 'Unassigned'
            LeadActivity.objects.create(
                lead=appointment.lead,
                author=self.request.user,
                activity_type='appointment',
                content=f"Appointment scheduled by {creator}: '{appointment.title}' · Date: {date_str} · Mode: {appointment.location_mode} · With: {assignee}"
            )

    def perform_update(self, serializer):
        old_status = serializer.instance.status
        new_status = self.request.data.get('status', old_status)
        appointment = serializer.save()

        # Auto-log status transitions on the lead timeline
        if appointment.lead and new_status != old_status:
            actor = self.request.user.get_full_name() or self.request.user.username
            if new_status == 'completed':
                msg = f"Appointment completed by {actor}: '{appointment.title}'"
            elif new_status == 'cancelled':
                msg = f"Appointment cancelled by {actor}: '{appointment.title}'"
            elif new_status == 'no_show':
                msg = f"Appointment marked no-show by {actor}: '{appointment.title}'"
            else:
                msg = f"Appointment '{appointment.title}' updated to '{new_status}' by {actor}"
            LeadActivity.objects.create(
                lead=appointment.lead,
                author=self.request.user,
                activity_type='appointment',
                content=msg
            )


class CountryViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Country.objects.all()
    serializer_class = CountrySerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        if self.request.query_params.get('popular'):
            qs = qs.filter(is_popular=True)
        return qs


class CourseViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Course.objects.all()
    serializer_class = CourseSerializer
    permission_classes = [AllowAny]

    def get_queryset(self):
        qs = super().get_queryset()
        country = self.request.query_params.get('country')
        if country:
            qs = qs.filter(country__id=country)
        return qs


# ── Auth ───────────────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def admin_login(request):
    """Returns a token for valid credentials and matching role."""
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()
    role = request.data.get('role', '').strip().lower()

    if not username or not password or not role:
        return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

    user = authenticate(username=username, password=password)

    if not user or not user.is_active:
        return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

    # Determine actual_role explicitly
    if user.is_superuser:
        actual_role = 'admin'
    elif user.is_staff or user.groups.filter(name='Staff').exists():
        actual_role = 'staff'
    elif user.groups.filter(name='Student').exists():
        actual_role = 'student'
    else:
        return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

    if role != actual_role:
        return Response({'error': 'Invalid credentials.'}, status=status.HTTP_401_UNAUTHORIZED)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'user_id': user.id,
        'username': user.username,
        'name': user.get_full_name() or user.username,
        'is_superuser': user.is_superuser,
        'role': actual_role,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def admin_logout(request):
    request.user.auth_token.delete()
    return Response({'message': 'Logged out.'})


# ── Public endpoints ───────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def submit_questionnaire(request):
    serializer = QuestionnaireCreateSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    questionnaire = serializer.save()
    recommendations = get_ai_recommendations({
        'education_level': questionnaire.education_level,
        'field_of_interest': questionnaire.field_of_interest,
        'preferred_countries': questionnaire.preferred_countries,
        'budget_range': questionnaire.budget_range,
        'english_proficiency': questionnaire.english_proficiency,
        'work_experience_years': questionnaire.work_experience_years,
        'target_intake': questionnaire.target_intake,
    })
    questionnaire.ai_country_recommendation = recommendations.get('countries', [])
    questionnaire.ai_course_recommendation = recommendations.get('courses', [])
    questionnaire.save()

    return Response({
        'questionnaire_id': questionnaire.id,
        'lead_id': questionnaire.lead.id,
        'recommendations': recommendations,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([AllowAny])
def contact_inquiry(request):
    name = request.data.get('name', '')
    phone = request.data.get('phone', '')
    if not all([name, phone]):
        return Response({'error': 'Name and phone are required.'}, status=400)
    lead = Lead.objects.create(
        name=name,
        email=request.data.get('email', ''),
        phone=phone,
        notes=request.data.get('message', ''),
        source='whatsapp_inquiry',
    )
    send_lead_notification({'name': name, 'email': lead.email, 'phone': phone, 'source': 'contact_form'})
    return Response({'lead_id': lead.id, 'message': 'Inquiry received!'}, status=201)

@api_view(['POST'])
@permission_classes([AllowAny])
def profile_recommend(request):
    serializer = ProfileRecommendationSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'error': 'Invalid input', 'details': serializer.errors}, status=400)
    profile = serializer.validated_data
    recommendation = get_profile_recommendation(profile)
    return Response({'success': True, 'input_profile': profile, 'recommendation': recommendation})


@api_view(['POST'])
@permission_classes([AllowAny])
def capture_lead(request):
    serializer = LeadCaptureSerializer(data=request.data)
    if not serializer.is_valid():
        return Response({'error': 'Invalid input', 'details': serializer.errors}, status=400)
    data = serializer.validated_data
    lead, created = Lead.objects.update_or_create(
        email=data['email'],
        defaults={
            'name':                 data['name'],
            'phone':                data['phone'],
            'country_of_residence': data.get('country_of_residence', ''),
            'qualification':        data.get('qualification', ''),
            'marks':                data.get('marks'),
            'english_score':        data.get('english_score'),
            'budget':               data.get('budget'),
            'course_interest':      data.get('course_interest', ''),
            'recommended_country':  data.get('recommended_country', ''),
            'recommended_course':   data.get('recommended_course', ''),
            'source':               'ai_assessment',
        }
    )
    if created:
        threading.Thread(target=send_lead_notification, args=(dict(data),), daemon=True).start()
    return Response({'lead_id': lead.id, 'created': created, 'message': 'Lead saved.'}, status=201)


# ── Protected dashboard endpoints ──────────────────────────────────────────

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_stats(request):
    total_leads = Lead.objects.count()
    status_breakdown = dict(
        Lead.objects.values_list('status').annotate(count=Count('status'))
    )
    # Distinct filter options for dropdowns
    countries = list(
        Lead.objects.exclude(recommended_country='')
        .values_list('recommended_country', flat=True)
        .distinct().order_by('recommended_country')
    )
    courses = list(
        Lead.objects.exclude(course_interest='')
        .values_list('course_interest', flat=True)
        .distinct().order_by('course_interest')
    )
    recent_leads = LeadSerializer(
        Lead.objects.order_by('-created_at')[:5], many=True
    ).data
    return Response({
        'total_leads': total_leads,
        'status_breakdown': status_breakdown,
        'recent_leads': recent_leads,
        'filter_options': {'countries': countries, 'courses': courses},
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def chat_counsellor(request):
    """
    Conversational AI chatbot endpoint.
    Expects: { "messages": [{"role": "user"|"assistant", "content": "..."}] }
    Returns: { "reply": "...", "collected": {...}, "stage": "..." }
    """
    messages = request.data.get('messages', [])
    if not isinstance(messages, list):
        return Response({'error': 'messages must be a list'}, status=400)

    result = get_chat_response(messages)

    # Auto-save lead when contact info is collected
    if result.get('stage') == 'done':
        collected = result.get('collected', {})
        name  = collected.get('name', '')
        email = collected.get('email', '')
        phone = collected.get('phone', '')
        if email:
            Lead.objects.update_or_create(
                email=email,
                defaults={
                    'name':   name,
                    'phone':  phone,
                    'source': 'chatbot',
                    'status': 'new',
                }
            )

    return Response(result)


# ── Staff / User Management (admin only) ───────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_users(request):
    """List all staff or create a new staff member. Admin only."""
    if not request.user.is_superuser:
        return Response({'error': 'Admin access required.'}, status=403)

    if request.method == 'GET':
        users = User.objects.filter(is_staff=True).order_by('-date_joined')
        data = [{
            'id':         u.id,
            'username':   u.username,
            'name':       u.get_full_name() or u.username,
            'email':      u.email,
            'role':       'admin' if u.is_superuser else 'staff',
            'is_active':  u.is_active,
            'date_joined': u.date_joined.strftime('%d %b %Y'),
        } for u in users]
        return Response(data)

    # POST — create new staff
    username   = request.data.get('username', '').strip()
    password   = request.data.get('password', '').strip()
    first_name = request.data.get('first_name', '').strip()
    last_name  = request.data.get('last_name', '').strip()
    email      = request.data.get('email', '').strip()
    role       = request.data.get('role', 'staff')  # 'staff' or 'admin'

    if not username or not password:
        return Response({'error': 'Username and password are required.'}, status=400)
    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists.'}, status=400)
    
    pwd_error = validate_password_strength(password)
    if pwd_error:
        return Response({'error': pwd_error}, status=400)

    user = User.objects.create_user(
        username=username, password=password,
        email=email, first_name=first_name, last_name=last_name,
        is_staff=True, is_superuser=(role == 'admin'), is_active=True,
    )
    if role == 'staff':
        staff_group, _ = Group.objects.get_or_create(name='Staff')
        user.groups.add(staff_group)
    return Response({
        'id': user.id, 'username': user.username,
        'name': user.get_full_name() or user.username,
        'role': role, 'is_active': True,
        'message': f'Staff member "{username}" created successfully.'
    }, status=201)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def create_staff(request):
    """Create a new staff member account. Admin-only (is_superuser check)."""
    if not request.user.is_superuser:
        return Response(
            {'error': 'Admin access required. Staff members cannot create staff accounts.'},
            status=status.HTTP_403_FORBIDDEN
        )

    full_name = request.data.get('full_name') or request.data.get('name', '')
    full_name = str(full_name).strip()
    username = request.data.get('username', '').strip()
    email = request.data.get('email', '').strip()
    phone = request.data.get('phone', '').strip()
    password = request.data.get('password', '').strip()

    if not full_name or not username or not password:
        return Response({'error': 'Full name, username, and password are required.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(username=username).exists():
        return Response({'error': 'Username already exists.'}, status=status.HTTP_400_BAD_REQUEST)

    pwd_error = validate_password_strength(password)
    if pwd_error:
        return Response({'error': pwd_error}, status=status.HTTP_400_BAD_REQUEST)

    name_parts = full_name.split(maxsplit=1)
    first_name = name_parts[0] if name_parts else ''
    last_name = name_parts[1] if len(name_parts) > 1 else ''

    user = User.objects.create_user(
        username=username,
        email=email,
        password=password,
        first_name=first_name,
        last_name=last_name,
        is_staff=True,
        is_superuser=False,
        is_active=True
    )

    staff_group, _ = Group.objects.get_or_create(name='Staff')
    user.groups.add(staff_group)

    return Response({
        'id': user.id,
        'username': user.username,
        'name': user.get_full_name() or user.username,
        'full_name': user.get_full_name() or user.username,
        'email': user.email,
        'phone': phone,
        'role': 'staff',
        'is_active': True,
        'message': f'Staff member "{username}" created successfully.'
    }, status=status.HTTP_201_CREATED)



@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_user_detail(request, user_id):
    """Get, update, or deactivate a staff member. Admin only."""
    if not request.user.is_superuser:
        return Response({'error': 'Admin access required.'}, status=403)

    try:
        user = User.objects.get(id=user_id, is_staff=True)
    except User.DoesNotExist:
        return Response({'error': 'User not found.'}, status=404)

    # Prevent admin from deactivating themselves
    if user.id == request.user.id:
        return Response({'error': 'You cannot modify your own account.'}, status=400)

    if request.method == 'GET':
        return Response({
            'id': user.id, 'username': user.username,
            'name': user.get_full_name(), 'email': user.email,
            'role': 'admin' if user.is_superuser else 'staff',
            'is_active': user.is_active,
            'date_joined': user.date_joined.strftime('%d %b %Y'),
        })

    if request.method == 'PATCH':
        # Update fields — password changes are intentionally NOT handled here.
        # Use POST /api/auth/staff/<id>/reset-password/ instead (Admin-only,
        # full strength validation, token invalidation). This keeps a single
        # auditable path for all password changes.
        if 'password' in request.data:
            return Response(
                {'error': 'Password changes are not allowed via this endpoint. '
                          'Use POST /api/auth/staff/<id>/reset-password/ instead.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        if 'is_active' in request.data:
            user.is_active = request.data['is_active']
        if 'role' in request.data:
            user.is_superuser = request.data['role'] == 'admin'
            if request.data['role'] == 'staff':
                staff_group, _ = Group.objects.get_or_create(name='Staff')
                user.groups.add(staff_group)
        if 'email' in request.data:
            user.email = request.data['email']
        if 'first_name' in request.data:
            user.first_name = request.data['first_name']
        if 'last_name' in request.data:
            user.last_name = request.data['last_name']
        user.save()

        # Revoke token if deactivated
        if not user.is_active:
            Token.objects.filter(user=user).delete()

        return Response({
            'id': user.id, 'username': user.username,
            'is_active': user.is_active,
            'role': 'admin' if user.is_superuser else 'staff',
            'message': 'Updated successfully.'
        })

    if request.method == 'DELETE':
        # Soft delete — just deactivate, never hard delete
        user.is_active = False
        user.save()
        Token.objects.filter(user=user).delete()
        return Response({'message': f'"{user.username}" has been deactivated.'})


# ── Student Enrollment & Process Tracking Views ────────────────────────────

def _create_student_enrollment(data, enrolled_by, lead=None):
    generated_password = secrets.token_urlsafe(8) + "!"
    name_parts = data['full_name'].split(maxsplit=1)
    user = User.objects.create_user(
        username=data['username'],
        email=data['email'],
        password=generated_password,
        first_name=name_parts[0] if name_parts else '',
        last_name=name_parts[1] if len(name_parts) > 1 else '',
        is_staff=False,
        is_superuser=False,
        is_active=True,
    )
    student_group, _ = Group.objects.get_or_create(name='Student')
    user.groups.add(student_group)

    profile = StudentProfile.objects.create(
        user=user,
        full_name=data['full_name'],
        phone=data['phone'],
        destination_country=data['destination_country'],
        enrolled_by=enrolled_by,
        notes=data.get('notes', ''),
        lead=lead,
    )
    for item in _get_default_checklist():
        ProcessStep.objects.create(
            student=profile,
            step_name=item['step_name'],
            status='pending',
            estimated_cost=0.00,
            order=item['order'],
        )
    return user, profile, generated_password


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def enroll_student(request):
    """
    Enroll a new student. Accessible to Admin + Staff.
    Creates User (Student role) + StudentProfile + 7 default ProcessStep rows.
    Generates a secure password and returns it ONCE in response.
    Never stores or logs password in plaintext.
    """
    if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
        return Response({'error': 'Admin or Staff permissions required.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = StudentEnrollmentSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    from django.db import transaction
    with transaction.atomic():
        user, profile, generated_password = _create_student_enrollment(data, request.user)

    # Return profile data + generated password ONCE (never logged in plaintext)
    return Response({
        'id': profile.id,
        'student_id': profile.student_id,
        'user_id': user.id,
        'username': user.username,
        'full_name': profile.full_name,
        'email': user.email,
        'phone': profile.phone,
        'destination_country': profile.destination_country,
        'generated_password': generated_password,
        'message': f"Student '{profile.full_name}' enrolled successfully."
    }, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manage_students(request):
    """
    List enrolled students.  Admin + Staff only.

    Query parameters (all optional):
        search              — substring match on full_name, student_id, username, email, phone
        status              — exact match on StudentProfile.status
        destination_country — case-insensitive contains match
        enrolled_by         — filter by enrolled_by user ID (integer)
        page                — 1-based page number (default 1)
        page_size           — results per page (default 20, max 100)
    """
    if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
        return Response({'error': 'Admin or Staff permissions required.'}, status=status.HTTP_403_FORBIDDEN)

    qs = StudentProfile.objects.prefetch_related(
        'process_steps__payments', 'documents', 'counselling_notes',
        'follow_ups', 'tasks', 'appointments',
        'applications__course', 'applications__country__workflows__steps',
        'applications__workflow_progress__workflow_step__workflow',
        'applications__workflow_progress__completed_by',
    ).select_related('user', 'enrolled_by', 'lead').order_by('-created_at')

    # ── Filters ────────────────────────────────────────────────────────
    search = request.query_params.get('search', '').strip()
    if search:
        qs = qs.filter(
            Q(full_name__icontains=search)
            | Q(student_id__icontains=search)
            | Q(user__username__icontains=search)
            | Q(user__email__icontains=search)
            | Q(phone__icontains=search)
            | Q(destination_country__icontains=search)
        )

    status_filter = request.query_params.get('status', '').strip()
    if status_filter:
        qs = qs.filter(status=status_filter)

    country_filter = request.query_params.get('destination_country', '').strip()
    if country_filter:
        qs = qs.filter(destination_country__icontains=country_filter)

    enrolled_by_filter = request.query_params.get('enrolled_by', '').strip()
    if enrolled_by_filter and enrolled_by_filter.isdigit():
        qs = qs.filter(enrolled_by_id=int(enrolled_by_filter))

    # ── Pagination ─────────────────────────────────────────────────────
    try:
        page = max(1, int(request.query_params.get('page', 1)))
    except (ValueError, TypeError):
        page = 1
    try:
        page_size = min(100, max(1, int(request.query_params.get('page_size', 20))))
    except (ValueError, TypeError):
        page_size = 20

    total_count = qs.count()
    total_pages = max(1, (total_count + page_size - 1) // page_size)
    offset = (page - 1) * page_size
    qs = qs[offset: offset + page_size]

    serializer = StudentProfileSerializer(qs, many=True)
    return Response({
        'count': total_count,
        'total_pages': total_pages,
        'page': page,
        'page_size': page_size,
        'results': serializer.data,
    })


@api_view(['GET', 'PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_student_detail(request, pk):
    """
    GET    — retrieve full student record (Admin + Staff)
    PATCH  — update mutable profile fields (Admin + Staff)
    DELETE — hard delete student + user account (Admin ONLY)

    PATCH accepts: full_name, phone, destination_country, notes, status
    Immutable fields (student_id, user, enrollment_date, enrolled_by) are
    intentionally excluded from the update serializer.
    """
    if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
        return Response({'error': 'Admin or Staff permissions required.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        student = StudentProfile.objects.select_related(
            'user', 'enrolled_by', 'lead'
        ).prefetch_related(
            'counselling_notes', 'follow_ups', 'tasks', 'appointments',
            'process_steps__payments', 'documents',
            'applications__course', 'applications__country__workflows__steps',
            'applications__workflow_progress__workflow_step__workflow',
            'applications__workflow_progress__completed_by',
        ).get(pk=pk)
    except StudentProfile.DoesNotExist:
        return Response({'error': 'Student record not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = StudentProfileSerializer(student)
        return Response(serializer.data)

    if request.method == 'PATCH':
        serializer = StudentProfileUpdateSerializer(student, data=request.data, partial=True)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
        serializer.save()
        # Return full profile (with steps, documents, totals) after update
        return Response(StudentProfileSerializer(student).data)

    if request.method == 'DELETE':
        # DELETE IS ADMIN ONLY (least-privilege rule)
        if not request.user.is_superuser:
            return Response({'error': 'Delete action requires Admin permissions.'}, status=status.HTTP_403_FORBIDDEN)

        user = student.user
        student.delete()
        if user:
            user.delete()
        return Response({'message': 'Student record deleted successfully.'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def convert_lead_to_student(request, lead_id):
    """
    POST /api/leads/<lead_id>/convert-to-student/

    Converts a CRM Lead into an enrolled Student.

    This endpoint orchestrates the following atomically:
      1. Validates the lead exists and has not already been converted.
      2. Pre-fills student data from the lead record.
      3. Creates a Django User with Student role.
      4. Creates a StudentProfile linked back to this lead.
      5. Creates default ProcessStep rows via the settings-driven checklist.
      6. Sets Lead.status = 'converted'.
      7. Logs a LeadActivity entry.

    The caller may supply overrides in the request body:
        username           (required — must be unique)
        email              (optional — defaults to lead.email)
        full_name          (optional — defaults to lead.name)
        phone              (optional — defaults to lead.phone)
        destination_country (optional — defaults to lead.recommended_country or lead.country_of_residence)
        notes              (optional — blank by default)

    Returns the same payload shape as enroll_student (including generated_password
    shown ONCE — never logged).

    Authorization: Admin or Staff only.
    """
    from django.db import IntegrityError, transaction

    is_staff_or_admin = (
        request.user.is_superuser
        or request.user.is_staff
        or request.user.groups.filter(name='Staff').exists()
    )
    if not is_staff_or_admin:
        return Response(
            {'error': 'Admin or Staff permissions required.'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        lead = Lead.objects.get(pk=lead_id)
    except Lead.DoesNotExist:
        return Response({'error': 'Lead not found.'}, status=status.HTTP_404_NOT_FOUND)

    try:
        with transaction.atomic():
            lead = Lead.objects.select_for_update().get(pk=lead_id)
            existing_student = StudentProfile.objects.filter(lead=lead).first()
            if lead.status == 'converted' or existing_student:
                return Response(
                    {'error': 'This lead has already been converted to a student.'},
                    status=status.HTTP_409_CONFLICT
                )

            invalid_fields = {
                field: ['Must be a string.']
                for field in ('username', 'full_name', 'email', 'phone', 'destination_country', 'notes')
                if field in request.data and request.data[field] is not None
                and not isinstance(request.data[field], str)
            }
            if invalid_fields:
                return Response(invalid_fields, status=status.HTTP_400_BAD_REQUEST)

            data = {
                'username': request.data.get('username'),
                'full_name': request.data.get('full_name') or lead.name,
                'email': request.data.get('email') or lead.email,
                'phone': request.data.get('phone') or lead.phone,
                'destination_country': (
                    request.data.get('destination_country')
                    or lead.recommended_country
                    or lead.country_of_residence
                ),
                'notes': request.data.get('notes', ''),
            }
            serializer = StudentEnrollmentSerializer(data=data)
            if not serializer.is_valid():
                return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

            user, profile, generated_password = _create_student_enrollment(
                serializer.validated_data, request.user, lead=lead
            )
            lead.status = 'converted'
            lead.save(update_fields=['status', 'updated_at'])

            actor_name = request.user.get_full_name() or request.user.username
            LeadActivity.objects.create(
                lead=lead,
                author=request.user,
                activity_type='status_change',
                content=(
                    f"Lead converted to student by {actor_name}. "
                    f"Student profile: {profile.full_name} "
                    f"(ID: {profile.student_id}, Username: {user.username})"
                ),
            )
    except Lead.DoesNotExist:
        return Response({'error': 'Lead not found.'}, status=status.HTTP_404_NOT_FOUND)
    except IntegrityError:
        return Response(
            {'error': 'This lead or account has already been converted or created.'},
            status=status.HTTP_409_CONFLICT
        )

    # generated_password is returned ONCE — never logged in plaintext
    return Response(
        {
            'id':                 profile.id,
            'student_id':         profile.student_id,
            'generated_password': generated_password,
            'message':            'Lead converted to student successfully.',
        },
        status=status.HTTP_201_CREATED
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_process_step(request, student_id):
    """Add custom process step to a student. Admin + Staff."""
    if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
        return Response({'error': 'Admin or Staff permissions required.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        student = StudentProfile.objects.get(pk=student_id)
    except StudentProfile.DoesNotExist:
        return Response({'error': 'Student record not found.'}, status=status.HTTP_404_NOT_FOUND)

    step_name = request.data.get('step_name', '').strip()
    if not step_name:
        return Response({'error': 'Step name is required.'}, status=400)

    estimated_cost = request.data.get('estimated_cost', 0.00)
    due_date = request.data.get('due_date', None) or None
    notes = request.data.get('notes', '')

    max_order = student.process_steps.all().count()

    step = ProcessStep.objects.create(
        student=student,
        step_name=step_name,
        status='pending',
        estimated_cost=estimated_cost,
        due_date=due_date,
        notes=notes,
        order=max_order + 1
    )

    return Response(ProcessStepSerializer(step).data, status=201)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_process_step_detail(request, step_id):
    """
    Update step (Admin + Staff) or Delete step (Admin ONLY).
    Triggers WhatsApp completion notification when status changes to 'completed'.
    """
    if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
        return Response({'error': 'Admin or Staff permissions required.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        step = ProcessStep.objects.get(pk=step_id)
    except ProcessStep.DoesNotExist:
        return Response({'error': 'Process step not found.'}, status=404)

    if request.method == 'DELETE':
        # DELETE IS ADMIN ONLY
        if not request.user.is_superuser:
            return Response({'error': 'Delete action requires Admin permissions.'}, status=status.HTTP_403_FORBIDDEN)

        step.delete()
        return Response({'message': 'Process step deleted successfully.'})

    if request.method == 'PATCH':
        old_status = step.status
        new_status = request.data.get('status', step.status)

        if 'status' in request.data:
            step.status = new_status
            if new_status == 'completed' and old_status != 'completed':
                from django.utils.timezone import now
                step.completed_at = now()

        if 'step_name' in request.data:
            step.step_name = request.data['step_name']
        if 'estimated_cost' in request.data:
            step.estimated_cost = request.data['estimated_cost']
        if 'due_date' in request.data:
            step.due_date = request.data['due_date'] or None
        if 'notes' in request.data:
            step.notes = request.data['notes']
        if 'order' in request.data:
            step.order = request.data['order']

        step.save()

        # WhatsApp Notification Trigger on Completion
        whatsapp_result = None
        if new_status == 'completed' and old_status != 'completed':
            student = step.student
            # Find next pending step for message
            next_step = ProcessStep.objects.filter(
                student=student,
                order__gt=step.order,
                status__in=['pending', 'in_progress']
            ).order_by('order').first()

            next_step_name = next_step.step_name if next_step else "Pre-departure / Visa Issuance"

            whatsapp_result = send_step_completion_whatsapp(
                student_name=student.full_name,
                phone=student.phone,
                step_name=step.step_name,
                next_step_name=next_step_name
            )

        resp_data = ProcessStepSerializer(step).data
        if whatsapp_result:
            resp_data['whatsapp_notification'] = whatsapp_result

        return Response(resp_data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_step_payment(request, step_id):
    """Record a partial or full payment against a process step. Admin + Staff."""
    if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
        return Response({'error': 'Admin or Staff permissions required.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        step = ProcessStep.objects.get(pk=step_id)
    except ProcessStep.DoesNotExist:
        return Response({'error': 'Process step not found.'}, status=404)

    amount = request.data.get('amount', None)
    if amount is None or float(amount) <= 0:
        return Response({'error': 'Payment amount must be greater than 0.'}, status=400)

    notes = request.data.get('notes', '')

    payment = Payment.objects.create(
        step=step,
        amount=amount,
        recorded_by=request.user,
        notes=notes
    )

    return Response(PaymentSerializer(payment).data, status=201)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def student_portal_me(request):
    """
    Read-only view for logged-in Student restricted strictly to request.user at the query level.
    Returns student profile, ordered checklist steps, and total payment summary.
    """
    try:
        profile = StudentProfile.objects.prefetch_related(
            'applications__course',
            'applications__country__workflows__steps',
            'applications__workflow_progress__workflow_step__workflow',
            'applications__workflow_progress__completed_by',
        ).get(user=request.user)
    except StudentProfile.DoesNotExist:
        return Response({'error': 'Student profile not found for current user.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = StudentPortalProfileSerializer(profile)
    return Response(serializer.data)


# ── Video Testimonials API ─────────────────────────────────────────────────

@api_view(['GET'])
@permission_classes([AllowAny])
def public_video_testimonials(request):
    """
    Public endpoint for homepage: returns only is_published=True video testimonials.
    """
    videos = VideoTestimonial.objects.filter(is_published=True)
    serializer = VideoTestimonialSerializer(videos, many=True)
    return Response(serializer.data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def manage_video_testimonials(request):
    """
    List all video testimonials (published + drafts). Accessible to Admin + Staff.
    """
    if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
        return Response({'error': 'Admin or Staff permissions required.'}, status=status.HTTP_403_FORBIDDEN)

    videos = VideoTestimonial.objects.all()
    serializer = VideoTestimonialSerializer(videos, many=True)
    return Response(serializer.data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_video_testimonial(request):
    """
    Upload a video testimonial file to Cloudinary. Accessible to Admin + Staff.
    Validates file format (MP4, MOV, WEBM, AVI, MKV) and max file size (100MB).
    Gracefully returns error if Cloudinary is not configured in backend/.env.
    """
    if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
        return Response({'error': 'Admin or Staff permissions required.'}, status=status.HTTP_403_FORBIDDEN)

    video_file = request.FILES.get('file') or request.FILES.get('video')
    if not video_file:
        return Response({'error': 'No video file provided for upload.'}, status=status.HTTP_400_BAD_REQUEST)

    # 1. File extension validation
    ext = os.path.splitext(video_file.name)[1].lower()
    allowed_exts = ['.mp4', '.mov', '.webm', '.avi', '.mkv']
    if ext not in allowed_exts:
        return Response(
            {'error': f"Invalid file format '{ext}'. Only video files (MP4, MOV, WEBM, AVI, MKV) are supported."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 2. File size validation (Max 100MB)
    max_size_bytes = 100 * 1024 * 1024
    if video_file.size > max_size_bytes:
        return Response(
            {'error': f"File size exceeds limit (Max 100MB). Your file is {round(video_file.size / (1024*1024), 1)}MB."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 3. Check Cloudinary Configuration
    if not cloudinary_service.is_cloudinary_configured():
        return Response(
            {'error': 'Video storage is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 4. Upload to Cloudinary
    try:
        res = cloudinary_service.upload_video_to_cloudinary(video_file)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    student_name = request.data.get('student_name', '').strip()
    is_published_raw = request.data.get('is_published', 'true')
    is_published = str(is_published_raw).lower() in ['true', '1', 'yes']
    display_order = int(request.data.get('display_order', 0))

    testimonial = VideoTestimonial.objects.create(
        student_name=student_name,
        video_url=res['video_url'],
        thumbnail_url=res['thumbnail_url'],
        public_id=res['public_id'],
        uploaded_by=request.user,
        is_published=is_published,
        display_order=display_order
    )

    return Response(VideoTestimonialSerializer(testimonial).data, status=status.HTTP_201_CREATED)


@api_view(['PATCH', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_video_testimonial_detail(request, pk):
    """
    PATCH: Toggle is_published or update details (Admin + Staff).
    DELETE: Delete record AND remove file from Cloudinary (Admin ONLY - 403 for Staff).
    """
    if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
        return Response({'error': 'Admin or Staff permissions required.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        testimonial = VideoTestimonial.objects.get(pk=pk)
    except VideoTestimonial.DoesNotExist:
        return Response({'error': 'Video testimonial record not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'PATCH':
        if 'is_published' in request.data:
            testimonial.is_published = bool(request.data['is_published'])
        if 'student_name' in request.data:
            testimonial.student_name = str(request.data['student_name']).strip()
        if 'display_order' in request.data:
            testimonial.display_order = int(request.data['display_order'])
        testimonial.save()
        return Response(VideoTestimonialSerializer(testimonial).data)

    if request.method == 'DELETE':
        # DELETE ACTION IS ADMIN ONLY (least-privilege enforcement)
        if not request.user.is_superuser:
            return Response({'error': 'Delete action requires Admin permissions.'}, status=status.HTTP_403_FORBIDDEN)

        # Delete asset from Cloudinary
        delete_video_from_cloudinary(testimonial.public_id)

        # Delete database record
        testimonial.delete()

        return Response({'message': 'Video testimonial deleted successfully.'})


# ── Student Documents API ──────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def upload_student_document(request):
    """
    Upload a document (PDF, JPG, PNG - Max 15MB) for a student.
    Allowed for: the student themselves (their own profile) OR Staff/Admin (for any student).
    """
    doc_file = request.FILES.get('file') or request.FILES.get('document')
    if not doc_file:
        return Response({'error': 'No document file provided for upload.'}, status=status.HTTP_400_BAD_REQUEST)

    document_type = request.data.get('document_type', 'Other').strip()
    target_student_id = request.data.get('student_id', None)

    # Resolve target student profile
    is_staff_or_admin = (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists())
    is_student_user = StudentProfile.objects.filter(user=request.user).exists()

    if not (is_staff_or_admin or is_student_user):
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    if is_student_user and not is_staff_or_admin:
        student = request.user.student_profile
        # If student_id passed, verify it matches
        if target_student_id:
            if str(student.id) != str(target_student_id) and str(student.student_id) != str(target_student_id):
                return Response({'error': 'You can only upload documents for your own student profile.'}, status=status.HTTP_403_FORBIDDEN)
    else:
        # Staff/Admin uploading
        if not target_student_id:
            return Response({'error': 'student_id is required for staff document upload.'}, status=status.HTTP_400_BAD_REQUEST)
        try:
            if str(target_student_id).isdigit():
                student = StudentProfile.objects.get(pk=target_student_id)
            else:
                student = StudentProfile.objects.get(student_id=target_student_id)
        except StudentProfile.DoesNotExist:
            return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    # 1. File format validation (PDF, JPG, JPEG, PNG)
    ext = os.path.splitext(doc_file.name)[1].lower()
    allowed_exts = ['.pdf', '.jpg', '.jpeg', '.png']
    if ext not in allowed_exts:
        return Response(
            {'error': f"Invalid document format '{ext}'. Only PDF, JPG, and PNG files are supported."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 2. File size validation (Max 15MB)
    max_size_bytes = 15 * 1024 * 1024
    if doc_file.size > max_size_bytes:
        return Response(
            {'error': f"File size exceeds limit (Max 15MB). Your file is {round(doc_file.size / (1024*1024), 1)}MB."},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 3. Check Cloudinary Configuration
    if not is_cloudinary_configured():
        return Response(
            {'error': 'Document storage is not configured. Please set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, and CLOUDINARY_API_SECRET in backend/.env.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 4. Upload to Cloudinary
    try:
        res = upload_document_to_cloudinary(doc_file)
    except Exception as e:
        return Response({'error': str(e)}, status=status.HTTP_400_BAD_REQUEST)

    doc = StudentDocument.objects.create(
        student=student,
        document_type=document_type,
        file_url=res['file_url'],
        public_id=res['public_id'],
        file_name=doc_file.name,
        uploaded_by=request.user,
        verification_status='pending'
    )

    return Response(StudentDocumentSerializer(doc).data, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_student_documents(request, student_id=None):
    """
    List student documents.
    Students see only their own documents. Staff/Admin see student's or all documents.
    """
    is_staff_or_admin = (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists())
    is_student_user = StudentProfile.objects.filter(user=request.user).exists()

    if is_student_user and not is_staff_or_admin:
        docs = request.user.student_profile.documents.all()
    elif is_staff_or_admin:
        target_id = student_id or request.query_params.get('student_id')
        if target_id:
            try:
                if str(target_id).isdigit():
                    student = StudentProfile.objects.get(pk=target_id)
                else:
                    student = StudentProfile.objects.get(student_id=target_id)
                docs = student.documents.all()
            except StudentProfile.DoesNotExist:
                return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)
        else:
            docs = StudentDocument.objects.all()
    else:
        return Response({'error': 'Permission denied.'}, status=status.HTTP_403_FORBIDDEN)

    serializer = StudentDocumentSerializer(docs, many=True)
    return Response(serializer.data)


@api_view(['PATCH'])
@permission_classes([IsAuthenticated])
def verify_student_document(request, pk):
    """
    Verify or reject a student document. Staff/Admin ONLY (Students receive 403).
    """
    from django.utils import timezone

    is_staff_or_admin = (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists())
    if not is_staff_or_admin:
        return Response({'error': 'Staff or Admin permissions required to verify documents.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        doc = StudentDocument.objects.get(pk=pk)
    except StudentDocument.DoesNotExist:
        return Response({'error': 'Student document record not found.'}, status=status.HTTP_404_NOT_FOUND)

    new_status = request.data.get('verification_status', doc.verification_status).strip().lower()
    if new_status not in ['verified', 'rejected', 'pending']:
        return Response({'error': "Invalid status. Must be 'verified', 'rejected', or 'pending'."}, status=status.HTTP_400_BAD_REQUEST)

    doc.verification_status = new_status
    doc.verified_by = request.user
    doc.verified_at = timezone.now()

    if new_status == 'rejected':
        doc.rejection_reason = request.data.get('rejection_reason', '').strip()
    else:
        doc.rejection_reason = ''

    doc.save()
    return Response(StudentDocumentSerializer(doc).data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def delete_student_document(request, pk):
    """
    Delete a student document. Admin ONLY (Staff receive 403).
    Removes database record AND deletes Cloudinary asset.
    """
    if not request.user.is_superuser:
        return Response({'error': 'Delete action requires Admin permissions.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        doc = StudentDocument.objects.get(pk=pk)
    except StudentDocument.DoesNotExist:
        return Response({'error': 'Student document record not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Delete asset from Cloudinary
    delete_document_from_cloudinary(doc.public_id)

    # Delete DB record
    doc.delete()

    return Response({'message': 'Student document deleted successfully.'})



# ── Password Reset ─────────────────────────────────────────────────────────

@api_view(['POST'])
@permission_classes([AllowAny])
def request_password_reset(request):
    """
    Step 1 of password reset.
    Accepts { "email": "..." } and sends a reset link if the account exists.

    Anti-enumeration: always returns the same success message regardless of
    whether the email is registered, so attackers cannot probe for valid accounts.

    Works for all roles: Admin, Staff, Student.
    The link is sent to the email address on the User record — NOT to any
    separate profile or lead email.
    """
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_encode
    from django.utils.encoding import force_bytes
    from django.core.mail import send_mail
    from django.conf import settings as django_settings
    from django.template.loader import render_to_string

    GENERIC_RESPONSE = {
        'message': 'If an account with this email exists, a password reset link has been sent.'
    }

    email = request.data.get('email', '').strip().lower()
    if not email:
        return Response({'error': 'Email address is required.'}, status=status.HTTP_400_BAD_REQUEST)

    # Basic format check — not a security gate, just UX
    if '@' not in email or '.' not in email.split('@')[-1]:
        return Response({'error': 'Enter a valid email address.'}, status=status.HTTP_400_BAD_REQUEST)

    # Look up user — case-insensitive. If not found, still return generic response.
    try:
        user = User.objects.get(email__iexact=email)
    except User.DoesNotExist:
        # Anti-enumeration: return same response, do not reveal email not found
        return Response(GENERIC_RESPONSE, status=status.HTTP_200_OK)
    except User.MultipleObjectsReturned:
        # Edge case: multiple accounts with same email — use the most recently joined
        user = User.objects.filter(email__iexact=email).order_by('-date_joined').first()

    if not user.is_active:
        # Do not reveal that account is deactivated
        return Response(GENERIC_RESPONSE, status=status.HTTP_200_OK)

    # Generate secure, short-lived, single-use token
    # django's PasswordResetTokenGenerator uses HMAC-SHA256 over:
    # user.pk, user.password (hash), user.last_login, current timestamp
    # Token is invalidated automatically when password changes (single-use enforced)
    uidb64 = urlsafe_base64_encode(force_bytes(user.pk))
    token = default_token_generator.make_token(user)

    frontend_url = getattr(django_settings, 'FRONTEND_URL', 'http://localhost:5173').rstrip('/')
    reset_url = f"{frontend_url}/reset-password/{uidb64}/{token}/"

    # Determine user's display name and role label for the email
    display_name = user.get_full_name() or user.username
    if user.is_superuser:
        role_label = 'Admin'
    elif user.is_staff or user.groups.filter(name='Staff').exists():
        role_label = 'Staff'
    else:
        role_label = 'Student'

    timeout_hours = getattr(django_settings, 'PASSWORD_RESET_TIMEOUT', 3600) // 3600
    from_email = getattr(django_settings, 'DEFAULT_FROM_EMAIL', '') or getattr(django_settings, 'EMAIL_HOST_USER', '')

    subject = 'UrmiNexus Portal — Password Reset Request (AIEC)'
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:20px 24px;border-radius:8px;margin-bottom:20px;">
        <h2 style="color:white;margin:0;font-size:20px;">🔑 Password Reset Request</h2>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">UrmiNexus SaaS Platform — AIEC Consultancy Tenant</p>
      </div>

      <div style="background:white;border-radius:8px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <p style="color:#374151;font-size:15px;">Hi <strong>{display_name}</strong> ({role_label}),</p>
        <p style="color:#374151;font-size:14px;line-height:1.6;">
          We received a request to reset the password for your UrmiNexus account
          (<strong>{user.email}</strong>).
        </p>
        <p style="color:#374151;font-size:14px;line-height:1.6;">
          Click the button below to set a new password. This link will expire in
          <strong>{timeout_hours} hour{'s' if timeout_hours != 1 else ''}</strong>.
        </p>

        <div style="text-align:center;margin:28px 0;">
          <a href="{reset_url}"
             style="background:#0f172a;color:white;padding:14px 32px;border-radius:8px;
                    text-decoration:none;font-weight:bold;font-size:15px;display:inline-block;">
            Reset My Password
          </a>
        </div>

        <p style="color:#6b7280;font-size:13px;line-height:1.6;">
          If you did not request this, you can safely ignore this email.
          Your password will <strong>not</strong> change unless you click the link above.
        </p>

        <hr style="border:none;border-top:1px solid #e5e7eb;margin:20px 0;" />
        <p style="color:#9ca3af;font-size:12px;">
          For security: this link expires in {timeout_hours} hour{'s' if timeout_hours != 1 else ''},
          can only be used once, and is tied to your current password.
          If you need help, contact AIEC support or UrmiNexus platform administrator.
        </p>
      </div>

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px;">
        AIEC Consultancy Tenant · Powered by UrmiNexus SaaS Platform
      </p>
    </div>
    """

    plain_body = (
        f"Hi {display_name},\n\n"
        f"Reset your UrmiNexus Portal password for AIEC by visiting:\n{reset_url}\n\n"
        f"This link expires in {timeout_hours} hour{'s' if timeout_hours != 1 else ''} and can only be used once.\n\n"
        f"If you didn't request this, ignore this email.\n\n"
        f"— UrmiNexus Platform Support (AIEC Tenant)"
    )

    # Send in background thread so slow SMTP doesn't block the API response
    def _send():
        try:
            send_mail(
                subject=subject,
                message=plain_body,
                from_email=from_email,
                recipient_list=[user.email],
                html_message=html_body,
                fail_silently=True,  # never crash the API response due to email failure
            )
        except Exception as exc:
            # Log to stdout only — never raise, never expose in response
            print(f"[PASSWORD RESET EMAIL ERROR] user_id={user.pk} error={exc}", flush=True)

    threading.Thread(target=_send, daemon=True).start()

    return Response(GENERIC_RESPONSE, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([AllowAny])
def confirm_password_reset(request):
    """
    Step 2 of password reset.
    Accepts { "uidb64": "...", "token": "...", "new_password": "...", "confirm_password": "..." }

    Security guarantees:
    - Token is validated with Django's PasswordResetTokenGenerator (HMAC-SHA256)
    - Token is single-use: once password changes, the hash changes and token is invalid
    - Token is short-lived: controlled by PASSWORD_RESET_TIMEOUT in settings
    - New password is validated with the same rules used at account creation
    - Existing DRF auth tokens are invalidated after password change (forces re-login)
    - Never exposes whether the uidb64 maps to a real user (generic error)
    """
    from django.contrib.auth.tokens import default_token_generator
    from django.utils.http import urlsafe_base64_decode
    from django.utils.encoding import force_str

    uidb64 = request.data.get('uidb64', '').strip()
    token = request.data.get('token', '').strip()
    new_password = request.data.get('new_password', '').strip()
    confirm_password = request.data.get('confirm_password', '').strip()

    # 1. Required fields
    if not all([uidb64, token, new_password, confirm_password]):
        return Response(
            {'error': 'All fields are required: uidb64, token, new_password, confirm_password.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 2. Password match
    if new_password != confirm_password:
        return Response(
            {'error': 'Passwords do not match.'},
            status=status.HTTP_400_BAD_REQUEST
        )

    # 3. Password strength — same rules as account creation
    pwd_error = validate_password_strength(new_password)
    if pwd_error:
        return Response({'error': pwd_error}, status=status.HTTP_400_BAD_REQUEST)

    # 4. Decode uidb64 → user pk
    INVALID_TOKEN_RESPONSE = Response(
        {'error': 'This password reset link is invalid or has expired. Please request a new one.'},
        status=status.HTTP_400_BAD_REQUEST
    )

    try:
        uid = force_str(urlsafe_base64_decode(uidb64))
        user = User.objects.get(pk=uid)
    except (TypeError, ValueError, OverflowError, User.DoesNotExist):
        return INVALID_TOKEN_RESPONSE

    if not user.is_active:
        return INVALID_TOKEN_RESPONSE

    # 5. Validate token — checks HMAC, timestamp, and that password hasn't already changed
    if not default_token_generator.check_token(user, token):
        return INVALID_TOKEN_RESPONSE

    # 6. Set new password (Django PBKDF2-hashes it)
    user.set_password(new_password)
    user.save()

    # 7. Invalidate all existing DRF auth tokens for this user
    #    This forces re-login with the new password — prevents session fixation
    Token.objects.filter(user=user).delete()

    return Response(
        {'message': 'Password reset successful. You can now log in with your new password.'},
        status=status.HTTP_200_OK
    )


# ── Admin/Staff-initiated Password Reset ──────────────────────────────────

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_student_password(request, student_id):
    """
    Admin or authorized Staff resets a student's password directly.
    No email/SMTP — caller sets the password and communicates it to the student.

    Permission rules:
      - Admin (is_superuser): can reset any student's password.
      - Staff: can reset ONLY students they personally enrolled
               (StudentProfile.enrolled_by == request.user).
      - Everyone else: 403.

    Password policy: same full validate_password_strength() used at enrollment
    (min 8 chars, letter+digit mix, weak-pattern blacklist). Never returned in
    response. Stored as PBKDF2 hash via set_password().
    Existing DRF auth token for that student is invalidated on success.
    """
    is_staff_or_admin = (
        request.user.is_superuser
        or request.user.is_staff
        or request.user.groups.filter(name='Staff').exists()
    )
    if not is_staff_or_admin:
        return Response(
            {'error': 'Admin or Staff permissions required.'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        student = StudentProfile.objects.select_related('user', 'enrolled_by').get(pk=student_id)
    except StudentProfile.DoesNotExist:
        return Response({'error': 'Student record not found.'}, status=status.HTTP_404_NOT_FOUND)

    # Staff can only reset passwords for students they enrolled
    if not request.user.is_superuser:
        if student.enrolled_by_id != request.user.id:
            return Response(
                {'error': 'You can only reset passwords for students you personally enrolled.'},
                status=status.HTTP_403_FORBIDDEN
            )

    new_password = request.data.get('new_password', '').strip()
    if not new_password:
        return Response({'error': 'new_password is required.'}, status=status.HTTP_400_BAD_REQUEST)

    pwd_error = validate_password_strength(new_password)
    if pwd_error:
        return Response({'error': pwd_error}, status=status.HTTP_400_BAD_REQUEST)

    # Set password — Django hashes with PBKDF2, never stored/returned in plaintext
    student.user.set_password(new_password)
    student.user.save()

    # Invalidate existing DRF token → student must re-login with new password
    Token.objects.filter(user=student.user).delete()

    return Response(
        {'message': f"Password for student '{student.full_name}' has been reset successfully."},
        status=status.HTTP_200_OK
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def reset_staff_password(request, user_id):
    """
    Admin-only endpoint to reset any staff member's password.
    Staff cannot use this endpoint — 403 for non-superusers.

    Same full password policy as account creation.
    Existing DRF auth token invalidated on success.
    """
    if not request.user.is_superuser:
        return Response(
            {'error': 'Admin access required. Staff cannot reset other staff passwords.'},
            status=status.HTTP_403_FORBIDDEN
        )

    try:
        target = User.objects.get(id=user_id, is_staff=True)
    except User.DoesNotExist:
        return Response({'error': 'Staff member not found.'}, status=status.HTTP_404_NOT_FOUND)

    new_password = request.data.get('new_password', '').strip()
    if not new_password:
        return Response({'error': 'new_password is required.'}, status=status.HTTP_400_BAD_REQUEST)

    pwd_error = validate_password_strength(new_password)
    if pwd_error:
        return Response({'error': pwd_error}, status=status.HTTP_400_BAD_REQUEST)

    target.set_password(new_password)
    target.save()

    # Invalidate token → forces re-login
    Token.objects.filter(user=target).delete()

    return Response(
        {'message': f"Password for '{target.username}' has been reset successfully."},
        status=status.HTTP_200_OK
    )


# ── Application Management API (Phase 2.1) ──────────────────────────────────

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_student_applications(request, student_id):
    """
    GET  /api/students/{student_id}/applications/ — List applications for a student.
    POST /api/students/{student_id}/applications/ — Create a new application for a student.
    """
    try:
        student = StudentProfile.objects.get(pk=student_id)
    except StudentProfile.DoesNotExist:
        return Response({'error': 'Student profile not found.'}, status=status.HTTP_404_NOT_FOUND)

    is_staff_or_admin = (
        request.user.is_superuser or
        request.user.is_staff or
        request.user.groups.filter(name='Staff').exists()
    )
    is_own_student = hasattr(request.user, 'student_profile') and request.user.student_profile.id == student.id

    if not (is_staff_or_admin or is_own_student):
        return Response({'error': 'You do not have permission to access these applications.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        applications = student.applications.select_related(
            'student', 'course', 'country'
        ).prefetch_related(
            'country__workflows__steps',
            'workflow_progress__workflow_step__workflow',
            'workflow_progress__completed_by',
        ).all()
        status_filter = request.query_params.get('status', '').strip()
        intake_filter = request.query_params.get('intake', '').strip()
        deadline_status_filter = request.query_params.get('deadline_status', '').strip()

        valid_statuses = {value for value, _ in Application.APPLICATION_STATUS_CHOICES}
        if status_filter and status_filter not in valid_statuses:
            return Response(
                {'status': ['Invalid application status filter.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if deadline_status_filter and deadline_status_filter not in {
            'no_deadline', 'upcoming', 'due_today', 'overdue'
        }:
            return Response(
                {'deadline_status': ['Invalid deadline status filter.']},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if status_filter:
            applications = applications.filter(status=status_filter)
        if intake_filter:
            applications = applications.filter(intake__iexact=intake_filter)
        if deadline_status_filter:
            today = timezone.localdate()
            if deadline_status_filter == 'no_deadline':
                applications = applications.filter(deadline__isnull=True)
            elif deadline_status_filter == 'upcoming':
                applications = applications.filter(deadline__gt=today)
            elif deadline_status_filter == 'due_today':
                applications = applications.filter(deadline=today)
            else:
                applications = applications.filter(deadline__lt=today)

        serializer = ApplicationSerializer(applications, many=True)
        return Response(serializer.data)

    elif request.method == 'POST':
        if not is_staff_or_admin:
            return Response({'error': 'Students are not authorized to create applications.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy()
        data['student'] = student.id

        selected_country_id = data.get('country')
        if selected_country_id:
            try:
                selected_country = Country.objects.get(pk=selected_country_id)
            except (Country.DoesNotExist, ValueError, TypeError):
                return Response({'error': 'Selected country does not exist.'}, status=status.HTTP_400_BAD_REQUEST)
            if not data.get('country_name'):
                data['country_name'] = selected_country.name

        course_id = data.get('course')
        if course_id:
            try:
                c = Course.objects.get(pk=course_id)
                if not data.get('university_name'):
                    data['university_name'] = c.university
                if not data.get('course_name'):
                    data['course_name'] = c.name
                if not data.get('country'):
                    data['country'] = c.country.id
                if not data.get('country_name'):
                    data['country_name'] = c.country.name
            except Course.DoesNotExist:
                return Response({'error': 'Selected course does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ApplicationSerializer(data=data)
        if serializer.is_valid():
            app = serializer.save()

            if student.lead:
                LeadActivity.objects.create(
                    lead=student.lead,
                    author=request.user,
                    activity_type='note',
                    content=f"Created Application: {app.university_name} - {app.course_name} ({app.intake}) [{app.get_status_display()}]"
                )

            return Response(ApplicationSerializer(app).data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_application_detail(request, pk):
    """
    GET    /api/applications/{id}/ — Retrieve application detail
    PATCH  /api/applications/{id}/ — Update application
    DELETE /api/applications/{id}/ — Delete application (Admin only)
    """
    try:
        app = Application.objects.select_related(
            'student', 'course', 'country'
        ).prefetch_related(
            'country__workflows__steps',
            'workflow_progress__workflow_step__workflow',
            'workflow_progress__completed_by',
        ).get(pk=pk)
    except Application.DoesNotExist:
        return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

    is_staff_or_admin = (
        request.user.is_superuser or
        request.user.is_staff or
        request.user.groups.filter(name='Staff').exists()
    )
    is_own_student = hasattr(request.user, 'student_profile') and request.user.student_profile.id == app.student.id

    if not (is_staff_or_admin or is_own_student):
        return Response({'error': 'You do not have permission to access this application.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        return Response(ApplicationSerializer(app).data)

    elif request.method in ['PATCH', 'PUT']:
        if not is_staff_or_admin:
            return Response({'error': 'Students are not authorized to edit applications.'}, status=status.HTTP_403_FORBIDDEN)

        data = request.data.copy()
        if 'student' in data and int(data['student']) != app.student.id:
            return Response({'error': 'Cannot change application student ownership.'}, status=status.HTTP_400_BAD_REQUEST)

        selected_country_id = data.get('country')
        if selected_country_id:
            try:
                selected_country = Country.objects.get(pk=selected_country_id)
            except (Country.DoesNotExist, ValueError, TypeError):
                return Response({'error': 'Selected country does not exist.'}, status=status.HTTP_400_BAD_REQUEST)
            if not data.get('country_name'):
                data['country_name'] = selected_country.name

        course_id = data.get('course')
        if course_id:
            try:
                c = Course.objects.get(pk=course_id)
                if not data.get('university_name'):
                    data['university_name'] = c.university
                if not data.get('course_name'):
                    data['course_name'] = c.name
                if not data.get('country'):
                    data['country'] = c.country.id
                if not data.get('country_name'):
                    data['country_name'] = c.country.name
            except Course.DoesNotExist:
                return Response({'error': 'Selected course does not exist.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ApplicationSerializer(app, data=data, partial=(request.method == 'PATCH'))
        if serializer.is_valid():
            updated_app = serializer.save()
            return Response(ApplicationSerializer(updated_app).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    elif request.method == 'DELETE':
        if not is_staff_or_admin:
            return Response({'error': 'Students are not authorized to delete applications.'}, status=status.HTTP_403_FORBIDDEN)

        if not request.user.is_superuser:
            return Response({'error': 'Admin permissions required to delete applications.'}, status=status.HTTP_403_FORBIDDEN)

        app.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_application_offers(request, application_id):
    """List or create offers for a single application."""
    try:
        application = Application.objects.select_related('student__user').get(pk=application_id)
    except Application.DoesNotExist:
        return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

    is_staff_or_admin = (
        request.user.is_superuser or
        request.user.is_staff or
        request.user.groups.filter(name='Staff').exists()
    )
    is_own_student = (
        hasattr(request.user, 'student_profile')
        and request.user.student_profile.id == application.student_id
    )

    if not (is_staff_or_admin or is_own_student):
        return Response({'error': 'You do not have permission to access these offers.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        offers = application.offers.select_related('application__student', 'offer_document').all()
        return Response(ApplicationOfferSerializer(offers, many=True).data)

    if not is_staff_or_admin:
        return Response({'error': 'Students are not authorized to create offers.'}, status=status.HTTP_403_FORBIDDEN)

    data = request.data.copy()
    data['application'] = application.id
    serializer = ApplicationOfferSerializer(data=data)
    if serializer.is_valid():
        offer = serializer.save()
        return Response(ApplicationOfferSerializer(offer).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_offer_detail(request, pk):
    """Retrieve, update, or delete a single application offer."""
    try:
        offer = ApplicationOffer.objects.select_related(
            'application__student__user',
            'offer_document__student__user',
        ).get(pk=pk)
    except ApplicationOffer.DoesNotExist:
        return Response({'error': 'Offer not found.'}, status=status.HTTP_404_NOT_FOUND)

    is_staff_or_admin = (
        request.user.is_superuser or
        request.user.is_staff or
        request.user.groups.filter(name='Staff').exists()
    )
    is_own_student = (
        hasattr(request.user, 'student_profile')
        and request.user.student_profile.id == offer.application.student_id
    )

    if not (is_staff_or_admin or is_own_student):
        return Response({'error': 'You do not have permission to access this offer.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        return Response(ApplicationOfferSerializer(offer).data)

    if not is_staff_or_admin:
        return Response({'error': 'Students are not authorized to edit offers.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method in ['PATCH', 'PUT']:
        data = request.data.copy()
        if 'application' in data and int(data['application']) != offer.application_id:
            return Response({'error': 'Cannot change the application linked to an offer.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = ApplicationOfferSerializer(offer, data=data, partial=(request.method == 'PATCH'))
        if serializer.is_valid():
            updated_offer = serializer.save()
            return Response(ApplicationOfferSerializer(updated_offer).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if not request.user.is_superuser:
        return Response({'error': 'Admin permissions required to delete offers.'}, status=status.HTTP_403_FORBIDDEN)

    offer.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_application_visa(request, application_id):
    """Read or create a visa case for a single application."""
    try:
        application = Application.objects.select_related('student__user').get(pk=application_id)
    except Application.DoesNotExist:
        return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

    is_staff_or_admin = (
        request.user.is_superuser or
        request.user.is_staff or
        request.user.groups.filter(name='Staff').exists()
    )
    is_own_student = (
        hasattr(request.user, 'student_profile')
        and request.user.student_profile.id == application.student_id
    )

    if not (is_staff_or_admin or is_own_student):
        return Response({'error': 'You do not have permission to access this visa case.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        try:
            visa_case = application.visa_case
        except VisaCase.DoesNotExist:
            return Response({'error': 'Visa case not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(VisaCaseSerializer(visa_case).data)

    if not is_staff_or_admin:
        return Response({'error': 'Students are not authorized to create visa cases.'}, status=status.HTTP_403_FORBIDDEN)

    if VisaCase.objects.filter(application=application).exists():
        return Response({'error': 'A visa case already exists for this application.'}, status=status.HTTP_400_BAD_REQUEST)

    data = request.data.copy()
    data['application'] = application.id
    serializer = VisaCaseSerializer(data=data)
    if serializer.is_valid():
        visa_case = serializer.save()
        return Response(VisaCaseSerializer(visa_case).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_visa_detail(request, pk):
    """Retrieve, update, or delete a visa case."""
    try:
        visa_case = VisaCase.objects.select_related('application__student__user').get(pk=pk)
    except VisaCase.DoesNotExist:
        return Response({'error': 'Visa case not found.'}, status=status.HTTP_404_NOT_FOUND)

    is_staff_or_admin = (
        request.user.is_superuser or
        request.user.is_staff or
        request.user.groups.filter(name='Staff').exists()
    )
    is_own_student = (
        hasattr(request.user, 'student_profile')
        and request.user.student_profile.id == visa_case.application.student_id
    )

    if not (is_staff_or_admin or is_own_student):
        return Response({'error': 'You do not have permission to access this visa case.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        return Response(VisaCaseSerializer(visa_case).data)

    if not is_staff_or_admin:
        return Response({'error': 'Students are not authorized to edit visa cases.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method in ['PATCH', 'PUT']:
        data = request.data.copy()
        if 'application' in data and int(data['application']) != visa_case.application_id:
            return Response({'error': 'Cannot change the application linked to a visa case.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = VisaCaseSerializer(visa_case, data=data, partial=(request.method == 'PATCH'))
        if serializer.is_valid():
            updated_case = serializer.save()
            return Response(VisaCaseSerializer(updated_case).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if not request.user.is_superuser:
        return Response({'error': 'Admin permissions required to delete visa cases.'}, status=status.HTTP_403_FORBIDDEN)

    visa_case.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_application_enrollment(request, application_id):
    """Read or create enrollment data for a single application."""
    try:
        application = Application.objects.select_related('student__user').get(pk=application_id)
    except Application.DoesNotExist:
        return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

    is_staff_or_admin = (
        request.user.is_superuser or
        request.user.is_staff or
        request.user.groups.filter(name='Staff').exists()
    )
    is_own_student = (
        hasattr(request.user, 'student_profile')
        and request.user.student_profile.id == application.student_id
    )

    if not (is_staff_or_admin or is_own_student):
        return Response({'error': 'You do not have permission to access this enrollment.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        try:
            enrollment = application.enrollment
        except Enrollment.DoesNotExist:
            return Response({'error': 'Enrollment not found.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(EnrollmentSerializer(enrollment).data)

    if not is_staff_or_admin:
        return Response({'error': 'Students are not authorized to create enrollments.'}, status=status.HTTP_403_FORBIDDEN)

    if Enrollment.objects.filter(application=application).exists():
        return Response({'error': 'An enrollment already exists for this application.'}, status=status.HTTP_400_BAD_REQUEST)

    data = request.data.copy()
    data['application'] = application.id
    if not data.get('university_name'):
        data['university_name'] = application.university_name
    if not data.get('course_name'):
        data['course_name'] = application.course_name
    if not data.get('intake'):
        data['intake'] = application.intake
    serializer = EnrollmentSerializer(data=data)
    if serializer.is_valid():
        enrollment = serializer.save()
        return Response(EnrollmentSerializer(enrollment).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'PATCH', 'PUT', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_enrollment_detail(request, pk):
    """Retrieve, update, or delete a single enrollment."""
    try:
        enrollment = Enrollment.objects.select_related('application__student__user').get(pk=pk)
    except Enrollment.DoesNotExist:
        return Response({'error': 'Enrollment not found.'}, status=status.HTTP_404_NOT_FOUND)

    is_staff_or_admin = (
        request.user.is_superuser or
        request.user.is_staff or
        request.user.groups.filter(name='Staff').exists()
    )
    is_own_student = (
        hasattr(request.user, 'student_profile')
        and request.user.student_profile.id == enrollment.application.student_id
    )

    if not (is_staff_or_admin or is_own_student):
        return Response({'error': 'You do not have permission to access this enrollment.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method == 'GET':
        return Response(EnrollmentSerializer(enrollment).data)

    if not is_staff_or_admin:
        return Response({'error': 'Students are not authorized to edit enrollments.'}, status=status.HTTP_403_FORBIDDEN)

    if request.method in ['PATCH', 'PUT']:
        data = request.data.copy()
        if 'application' in data and int(data['application']) != enrollment.application_id:
            return Response({'error': 'Cannot change the application linked to an enrollment.'}, status=status.HTTP_400_BAD_REQUEST)

        serializer = EnrollmentSerializer(enrollment, data=data, partial=(request.method == 'PATCH'))
        if serializer.is_valid():
            updated_enrollment = serializer.save()
            return Response(EnrollmentSerializer(updated_enrollment).data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    if not request.user.is_superuser:
        return Response({'error': 'Admin permissions required to delete enrollments.'}, status=status.HTTP_403_FORBIDDEN)

    enrollment.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def complete_application_workflow_step(request, pk, step_id):
    try:
        app = Application.objects.select_related('student', 'country').prefetch_related(
            'country__workflows__steps',
            'workflow_progress__workflow_step__workflow',
            'workflow_progress__completed_by',
        ).get(pk=pk)
    except Application.DoesNotExist:
        return Response({'error': 'Application not found.'}, status=status.HTTP_404_NOT_FOUND)

    is_staff_or_admin = (
        request.user.is_superuser or
        request.user.is_staff or
        request.user.groups.filter(name='Staff').exists()
    )
    is_own_student = (
        hasattr(request.user, 'student_profile')
        and request.user.student_profile.id == app.student_id
    )

    if not (is_staff_or_admin or is_own_student):
        return Response(
            {'error': 'You do not have permission to access this application.'},
            status=status.HTTP_403_FORBIDDEN,
        )
    if not is_staff_or_admin:
        return Response(
            {'error': 'Students cannot update application progress.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    try:
        workflow_step = CountryWorkflowStep.objects.select_related(
            'workflow__country'
        ).get(pk=step_id)
    except CountryWorkflowStep.DoesNotExist:
        return Response({'error': 'Workflow step not found.'}, status=status.HTTP_404_NOT_FOUND)

    workflow = app.get_country_workflow()
    if (
        not workflow
        or workflow_step.workflow_id != workflow.id
        or workflow_step.workflow.country_id != app.country_id
    ):
        return Response(
            {'error': 'Workflow step does not belong to this application country.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    progress, created = ApplicationWorkflowProgress.objects.get_or_create(
        application=app,
        workflow_step=workflow_step,
        defaults={
            'completed': True,
            'completed_at': timezone.now(),
            'completed_by': request.user,
        },
    )
    if not created and not progress.completed:
        progress.completed = True
        progress.completed_at = timezone.now()
        progress.completed_by = request.user
        progress.save(update_fields=['completed', 'completed_at', 'completed_by', 'updated_at'])

    app.refresh_from_db()
    return Response(ApplicationSerializer(app).data)
