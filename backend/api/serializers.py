from rest_framework import serializers
from .models import (
    Lead, Questionnaire, Country, Course,
    StudentProfile, ProcessStep, Payment
)


class LeadSerializer(serializers.ModelSerializer):
    class Meta:
        model = Lead
        fields = '__all__'


class QuestionnaireSerializer(serializers.ModelSerializer):
    class Meta:
        model = Questionnaire
        fields = '__all__'


class QuestionnaireCreateSerializer(serializers.ModelSerializer):
    # Accept lead data inline for new submissions
    name = serializers.CharField(write_only=True)
    email = serializers.EmailField(write_only=True)
    phone = serializers.CharField(write_only=True)
    city = serializers.CharField(write_only=True, required=False, default='')

    class Meta:
        model = Questionnaire
        exclude = ['lead', 'ai_country_recommendation', 'ai_course_recommendation']

    def create(self, validated_data):
        name = validated_data.pop('name')
        email = validated_data.pop('email')
        phone = validated_data.pop('phone')
        city = validated_data.pop('city', '')

        lead, _ = Lead.objects.get_or_create(
            email=email,
            defaults={'name': name, 'phone': phone, 'city': city}
        )
        questionnaire = Questionnaire.objects.create(lead=lead, **validated_data)
        return questionnaire


class CountrySerializer(serializers.ModelSerializer):
    class Meta:
        model = Country
        fields = '__all__'


class CourseSerializer(serializers.ModelSerializer):
    country_name = serializers.CharField(source='country.name', read_only=True)

    class Meta:
        model = Course
        fields = '__all__'


class LeadDetailSerializer(serializers.ModelSerializer):
    questionnaire = QuestionnaireSerializer(read_only=True)

    class Meta:
        model = Lead
        fields = '__all__'


class LeadCaptureSerializer(serializers.Serializer):
    """Captures contact info + profile snapshot before revealing results."""
    # Contact
    name    = serializers.CharField(max_length=200)
    email   = serializers.EmailField()
    phone   = serializers.CharField(max_length=20)
    country_of_residence = serializers.CharField(max_length=100, required=False, default='')

    # Profile snapshot (passed from frontend after assessment)
    qualification  = serializers.CharField(max_length=100,  required=False, default='')
    marks          = serializers.FloatField(min_value=0, max_value=100, required=False, allow_null=True, default=None)
    english_score  = serializers.FloatField(min_value=0, max_value=9,   required=False, allow_null=True, default=None)
    budget         = serializers.IntegerField(min_value=0, required=False, allow_null=True, default=None)
    course_interest = serializers.CharField(max_length=200, required=False, default='')

    # AI result snapshot
    recommended_country = serializers.CharField(max_length=100, required=False, default='')
    recommended_course  = serializers.CharField(max_length=200, required=False, default='')


class ProfileRecommendationSerializer(serializers.Serializer):
    qualification = serializers.CharField(max_length=100, required=False, allow_blank=True, default="Bachelor's Degree")
    marks = serializers.FloatField(required=False, allow_null=True, default=75.0)
    english_score = serializers.FloatField(required=False, allow_null=True, default=6.5)
    course_interest = serializers.CharField(max_length=200, required=False, allow_blank=True, default="Computer Science")
    budget = serializers.IntegerField(min_value=0, required=False, allow_null=True, default=25000)
    pr_preference = serializers.BooleanField(required=False, default=False)
    timeline = serializers.IntegerField(min_value=1, max_value=36, required=False, default=12)
    target_intake = serializers.CharField(max_length=100, required=False, allow_blank=True, default="Within 1 year")
    additional_info = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_marks(self, value):
        if value is None:
            return 75.0
        # If user entered GPA (e.g. 3.5 <= 5.0), scale to percentage (e.g. 3.5 -> 87.5%)
        if 0 < value <= 5.0:
            return round(value * 25.0, 1)
        # If user entered exam total marks (e.g. 850 out of 1000), convert to percentage
        if value > 100:
            if value <= 1000:
                return round((value / 1000.0) * 100.0, 1)
            return 100.0
        return max(0.0, min(100.0, value))


# ── Student Enrollment & Process Serializers ───────────────────────────────

class PaymentSerializer(serializers.ModelSerializer):
    recorded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = Payment
        fields = ['id', 'step', 'amount', 'payment_date', 'recorded_by', 'recorded_by_name', 'notes']
        read_only_fields = ['payment_date', 'recorded_by']

    def get_recorded_by_name(self, obj):
        if obj.recorded_by:
            return obj.recorded_by.get_full_name() or obj.recorded_by.username
        return 'System'


class ProcessStepSerializer(serializers.ModelSerializer):
    payments = PaymentSerializer(many=True, read_only=True)
    total_paid = serializers.SerializerMethodField()
    balance_due = serializers.SerializerMethodField()

    class Meta:
        model = ProcessStep
        fields = [
            'id', 'student', 'step_name', 'status', 'estimated_cost',
            'due_date', 'completed_at', 'notes', 'order',
            'payments', 'total_paid', 'balance_due'
        ]
        read_only_fields = ['student']

    def get_total_paid(self, obj):
        return sum(p.amount for p in obj.payments.all())

    def get_balance_due(self, obj):
        return max(0.00, float(obj.estimated_cost) - float(self.get_total_paid(obj)))


class StudentProfileSerializer(serializers.ModelSerializer):
    process_steps = ProcessStepSerializer(many=True, read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    enrolled_by_name = serializers.SerializerMethodField()
    total_estimated_cost = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    pending_balance = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = [
            'id', 'user', 'username', 'email', 'full_name', 'phone', 'destination_country',
            'enrollment_date', 'enrolled_by', 'enrolled_by_name', 'notes',
            'process_steps', 'total_estimated_cost', 'total_paid', 'pending_balance'
        ]

    def get_enrolled_by_name(self, obj):
        if obj.enrolled_by:
            return obj.enrolled_by.get_full_name() or obj.enrolled_by.username
        return 'System'

    def get_total_estimated_cost(self, obj):
        return sum(step.estimated_cost for step in obj.process_steps.all())

    def get_total_paid(self, obj):
        total = 0
        for step in obj.process_steps.all():
            total += sum(p.amount for p in step.payments.all())
        return total

    def get_pending_balance(self, obj):
        return max(0.00, float(self.get_total_estimated_cost(obj)) - float(self.get_total_paid(obj)))


class StudentEnrollmentSerializer(serializers.Serializer):
    full_name = serializers.CharField(max_length=200)
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    phone = serializers.CharField(max_length=30)
    destination_country = serializers.CharField(max_length=100)
    notes = serializers.CharField(required=False, allow_blank=True, default='')

    def validate_username(self, value):
        from django.contrib.auth.models import User
        if User.objects.filter(username=value).exists():
            raise serializers.ValidationError("Username already exists.")
        return value

    def validate_email(self, value):
        from django.contrib.auth.models import User
        if User.objects.filter(email=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value



