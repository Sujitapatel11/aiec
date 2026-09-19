from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.db.models import Count
import secrets

from .models import (
    Lead, Questionnaire, Country, Course,
    StudentProfile, ProcessStep, Payment, DEFAULT_CHECKLIST_TEMPLATE
)
from .serializers import (
    LeadSerializer, LeadDetailSerializer,
    QuestionnaireSerializer, QuestionnaireCreateSerializer,
    CountrySerializer, CourseSerializer,
    ProfileRecommendationSerializer, LeadCaptureSerializer,
    StudentProfileSerializer, StudentEnrollmentSerializer,
    ProcessStepSerializer, PaymentSerializer
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
        # Update fields
        if 'is_active' in request.data:
            user.is_active = request.data['is_active']
        if 'role' in request.data:
            user.is_superuser = request.data['role'] == 'admin'
            if request.data['role'] == 'staff':
                staff_group, _ = Group.objects.get_or_create(name='Staff')
                user.groups.add(staff_group)
        if 'password' in request.data and request.data['password']:
            if len(request.data['password']) < 6:
                return Response({'error': 'Password must be at least 6 characters.'}, status=400)
            user.set_password(request.data['password'])
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

    students = StudentProfile.objects.all().order_by('-created_at')
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

