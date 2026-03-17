from rest_framework import viewsets, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.authtoken.models import Token
from django.contrib.auth import authenticate
from django.db.models import Count
from .models import Lead, Questionnaire, Country, Course
from .serializers import (
    LeadSerializer, LeadDetailSerializer,
    QuestionnaireSerializer, QuestionnaireCreateSerializer,
    CountrySerializer, CourseSerializer,
    ProfileRecommendationSerializer, LeadCaptureSerializer,
)
from .ai_service import get_ai_recommendations
from .recommendation_service import get_profile_recommendation
from .chat_service import get_chat_response
from .notify import send_lead_notification
from django.contrib.auth.models import User
import threading


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
    """Returns a token for valid staff/superuser credentials."""
    username = request.data.get('username', '').strip()
    password = request.data.get('password', '').strip()

    if not username or not password:
        return Response({'error': 'Username and password are required.'}, status=400)

    user = authenticate(username=username, password=password)

    if not user:
        return Response({'error': 'Invalid credentials.'}, status=401)

    if not (user.is_staff or user.is_superuser):
        return Response({'error': 'Access denied. Staff only.'}, status=403)

    token, _ = Token.objects.get_or_create(user=user)
    return Response({
        'token': token.key,
        'username': user.username,
        'name': user.get_full_name() or user.username,
        'is_superuser': user.is_superuser,
        'role': 'admin' if user.is_superuser else 'staff',
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
    if len(password) < 6:
        return Response({'error': 'Password must be at least 6 characters.'}, status=400)

    user = User.objects.create_user(
        username=username, password=password,
        email=email, first_name=first_name, last_name=last_name,
        is_staff=True, is_superuser=(role == 'admin'), is_active=True,
    )
    return Response({
        'id': user.id, 'username': user.username,
        'name': user.get_full_name() or user.username,
        'role': role, 'is_active': True,
        'message': f'Staff member "{username}" created successfully.'
    }, status=201)


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
