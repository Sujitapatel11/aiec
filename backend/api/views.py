from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.db.models import Count
import secrets
import os
import threading
import re

from .models import (
    Lead, Questionnaire, Country, Course,
    StudentProfile, ProcessStep, Payment, VideoTestimonial, StudentDocument, DEFAULT_CHECKLIST_TEMPLATE
)
from .serializers import (
    LeadSerializer, LeadDetailSerializer,
    QuestionnaireSerializer, QuestionnaireCreateSerializer,
    CountrySerializer, CourseSerializer,
    ProfileRecommendationSerializer, LeadCaptureSerializer,
    StudentProfileSerializer, StudentEnrollmentSerializer,
    ProcessStepSerializer, PaymentSerializer, VideoTestimonialSerializer, StudentDocumentSerializer
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
from .whatsapp_service import send_step_completion_whatsapp
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

    def get_serializer_class(self):
        if self.action == 'retrieve':
            return LeadDetailSerializer
        return LeadSerializer

    def get_queryset(self):
        qs = Lead.objects.all()
        country = self.request.query_params.get('country', '').strip()
        course  = self.request.query_params.get('course', '').strip()
        status  = self.request.query_params.get('status', '').strip()
        search  = self.request.query_params.get('search', '').strip()
        if country:
            qs = qs.filter(recommended_country__icontains=country)
        if course:
            qs = qs.filter(course_interest__icontains=course)
        if status:
            qs = qs.filter(status=status)
        if search:
            qs = qs.filter(name__icontains=search) | qs.filter(email__icontains=search) | qs.filter(phone__icontains=search)
        return qs.order_by('-created_at')

    def create(self, request, *args, **kwargs):
        if not (
            request.user.is_superuser
            or request.user.is_staff
            or request.user.groups.filter(name='Staff').exists()
        ):
            return Response(
                {'error': 'Admin or Staff permissions required.'},
                status=status.HTTP_403_FORBIDDEN
            )

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

        serializer.save(email=email, phone=phone)
        headers = self.get_success_headers(serializer.data)
        return Response(serializer.data, status=status.HTTP_201_CREATED, headers=headers)

    def destroy(self, request, *args, **kwargs):
        if not (request.user.is_superuser or request.user.has_perm('api.can_delete_lead')):
            return Response(
                {'error': 'Access denied. Only admins or authorized staff can delete leads.'},
                status=status.HTTP_403_FORBIDDEN
            )
        return super().destroy(request, *args, **kwargs)


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

    # Generate secure random password
    generated_password = secrets.token_urlsafe(8) + "!"

    # Create User with Student role
    user = User.objects.create_user(
        username=data['username'],
        email=data['email'],
        password=generated_password,
        first_name=data['full_name'].split()[0] if data['full_name'] else '',
        last_name=' '.join(data['full_name'].split()[1:]) if len(data['full_name'].split()) > 1 else '',
        is_staff=False,
        is_superuser=False,
        is_active=True
    )
    student_group, _ = Group.objects.get_or_create(name='Student')
    user.groups.add(student_group)

    # Create StudentProfile
    profile = StudentProfile.objects.create(
        user=user,
        full_name=data['full_name'],
        phone=data['phone'],
        destination_country=data['destination_country'],
        enrolled_by=request.user,
        notes=data.get('notes', '')
    )

    # Auto-create default checklist steps
    for item in DEFAULT_CHECKLIST_TEMPLATE:
        ProcessStep.objects.create(
            student=profile,
            step_name=item['step_name'],
            status='pending',
            estimated_cost=0.00,
            order=item['order']
        )

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
    """List all enrolled students. Accessible to Admin + Staff."""
    if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
        return Response({'error': 'Admin or Staff permissions required.'}, status=status.HTTP_403_FORBIDDEN)

    students = StudentProfile.objects.prefetch_related('process_steps__payments', 'user', 'enrolled_by').all().order_by('-created_at')
    serializer = StudentProfileSerializer(students, many=True)
    return Response(serializer.data)


@api_view(['GET', 'DELETE'])
@permission_classes([IsAuthenticated])
def manage_student_detail(request, pk):
    """
    Get student detail (Admin + Staff) or Delete student record (Admin ONLY).
    """
    if not (request.user.is_superuser or request.user.is_staff or request.user.groups.filter(name='Staff').exists()):
        return Response({'error': 'Admin or Staff permissions required.'}, status=status.HTTP_403_FORBIDDEN)

    try:
        student = StudentProfile.objects.get(pk=pk)
    except StudentProfile.DoesNotExist:
        return Response({'error': 'Student record not found.'}, status=status.HTTP_404_NOT_FOUND)

    if request.method == 'GET':
        serializer = StudentProfileSerializer(student)
        return Response(serializer.data)

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
        profile = StudentProfile.objects.get(user=request.user)
    except StudentProfile.DoesNotExist:
        return Response({'error': 'Student profile not found for current user.'}, status=status.HTTP_404_NOT_FOUND)

    serializer = StudentProfileSerializer(profile)
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

    subject = 'AIEC Portal — Password Reset Request'
    html_body = f"""
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#f9fafb;padding:24px;border-radius:12px;">
      <div style="background:linear-gradient(135deg,#0f172a,#1e3a5f);padding:20px 24px;border-radius:8px;margin-bottom:20px;">
        <h2 style="color:white;margin:0;font-size:20px;">🔑 Password Reset Request</h2>
        <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">Aaradhya International Education Consultancy</p>
      </div>

      <div style="background:white;border-radius:8px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
        <p style="color:#374151;font-size:15px;">Hi <strong>{display_name}</strong> ({role_label}),</p>
        <p style="color:#374151;font-size:14px;line-height:1.6;">
          We received a request to reset the password for your AIEC Portal account
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
          If you need help, contact AIEC support.
        </p>
      </div>

      <p style="color:#9ca3af;font-size:12px;text-align:center;margin-top:16px;">
        AIEC — Aaradhya International Education Consultancy, Birgunj, Nepal
      </p>
    </div>
    """

    plain_body = (
        f"Hi {display_name},\n\n"
        f"Reset your AIEC Portal password by visiting:\n{reset_url}\n\n"
        f"This link expires in {timeout_hours} hour{'s' if timeout_hours != 1 else ''} and can only be used once.\n\n"
        f"If you didn't request this, ignore this email.\n\n"
        f"— AIEC Support"
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
