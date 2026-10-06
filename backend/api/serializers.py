from rest_framework import serializers
from django.contrib.auth.models import User
from django.utils import timezone
from .models import (
    Lead, LeadActivity, Questionnaire, Country, Course,
    StudentProfile, ProcessStep, Payment, VideoTestimonial, StudentDocument,
    CounsellingNote, FollowUp, Task, Appointment, Application, ApplicationOffer, VisaCase, Enrollment,
    CountryWorkflowStep
)



class StaffUserSerializer(serializers.ModelSerializer):
    name = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'name', 'email']

    def get_name(self, obj):
        return obj.get_full_name() or obj.username


class LeadActivitySerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()

    class Meta:
        model = LeadActivity
        fields = ['id', 'lead', 'author', 'author_name', 'activity_type', 'content', 'created_at']
        read_only_fields = ['author', 'created_at']

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.get_full_name() or obj.author.username
        return 'System'


class StudentDocumentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()
    verified_by_name = serializers.SerializerMethodField()

    class Meta:
        model = StudentDocument
        fields = [
            'id', 'student', 'document_type', 'file_url', 'public_id', 'file_name',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at',
            'verification_status', 'verified_by', 'verified_by_name', 'verified_at',
            'rejection_reason'
        ]
        read_only_fields = ['uploaded_at', 'uploaded_by', 'verified_by', 'verified_at']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return 'System'

    def get_verified_by_name(self, obj):
        if obj.verified_by:
            return obj.verified_by.get_full_name() or obj.verified_by.username
        return None



class LeadSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Lead
        fields = '__all__'

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None

    def validate_marks(self, value):
        if value is not None and not 0 <= value <= 100:
            raise serializers.ValidationError('Marks must be between 0 and 100.')
        return value

    def validate_english_score(self, value):
        if value is not None and not 0 <= value <= 9:
            raise serializers.ValidationError('English score must be between 0 and 9.')
        return value

    def validate_budget(self, value):
        if value is not None and value < 0:
            raise serializers.ValidationError('Budget cannot be negative.')
        return value


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
            defaults={'name': name, 'phone': phone, 'country_of_residence': city}
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


class CounsellingNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = CounsellingNote
        fields = [
            'id', 'lead', 'lead_name', 'student', 'student_name',
            'author', 'author_name', 'content', 'created_at', 'updated_at'
        ]
        read_only_fields = ['author', 'created_at', 'updated_at']

    def get_author_name(self, obj):
        if obj.author:
            return obj.author.get_full_name() or obj.author.username
        return 'System'

    def get_lead_name(self, obj):
        return obj.lead.name if obj.lead else None

    def get_student_name(self, obj):
        return obj.student.full_name if obj.student else None


class FollowUpSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = FollowUp
        fields = [
            'id', 'lead', 'lead_name', 'student', 'student_name',
            'assigned_to', 'assigned_to_name', 'created_by', 'created_by_name',
            'title', 'description', 'due_at', 'status', 'priority',
            'is_overdue', 'completed_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return 'System'

    def get_lead_name(self, obj):
        return obj.lead.name if obj.lead else None

    def get_student_name(self, obj):
        return obj.student.full_name if obj.student else None


class TaskSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Task
        fields = [
            'id', 'lead', 'lead_name', 'student', 'student_name',
            'assigned_to', 'assigned_to_name', 'created_by', 'created_by_name',
            'title', 'description', 'due_at', 'status', 'priority',
            'is_overdue', 'completed_at', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return 'System'

    def get_lead_name(self, obj):
        return obj.lead.name if obj.lead else None

    def get_student_name(self, obj):
        return obj.student.full_name if obj.student else None


class AppointmentSerializer(serializers.ModelSerializer):
    assigned_to_name = serializers.SerializerMethodField()
    created_by_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()

    class Meta:
        model = Appointment
        fields = [
            'id', 'lead', 'lead_name', 'student', 'student_name',
            'assigned_to', 'assigned_to_name', 'created_by', 'created_by_name',
            'title', 'appointment_date', 'duration_minutes', 'location_mode',
            'notes', 'status', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_by', 'created_at', 'updated_at']

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None

    def get_created_by_name(self, obj):
        if obj.created_by:
            return obj.created_by.get_full_name() or obj.created_by.username
        return 'System'

    def get_lead_name(self, obj):
        return obj.lead.name if obj.lead else None

    def get_student_name(self, obj):
        return obj.student.full_name if obj.student else None


class LeadDetailSerializer(serializers.ModelSerializer):
    questionnaire = QuestionnaireSerializer(read_only=True)
    activities = LeadActivitySerializer(many=True, read_only=True)
    counselling_notes = CounsellingNoteSerializer(many=True, read_only=True)
    follow_ups = FollowUpSerializer(many=True, read_only=True)
    tasks = TaskSerializer(many=True, read_only=True)
    appointments = AppointmentSerializer(many=True, read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    is_overdue = serializers.BooleanField(read_only=True)

    class Meta:
        model = Lead
        fields = '__all__'

    def get_assigned_to_name(self, obj):
        if obj.assigned_to:
            return obj.assigned_to.get_full_name() or obj.assigned_to.username
        return None


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


class ApplicationWorkflowStepSerializer(serializers.ModelSerializer):
    completed = serializers.SerializerMethodField()
    completed_at = serializers.SerializerMethodField()
    completed_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CountryWorkflowStep
        fields = ['id', 'name', 'order', 'required', 'completed', 'completed_at', 'completed_by_name']

    def _get_progress(self, obj):
        progress = self.context.get('workflow_progress', {})
        return progress.get(obj.id)

    def get_completed(self, obj):
        progress = self._get_progress(obj)
        return bool(progress and progress.completed)

    def get_completed_at(self, obj):
        progress = self._get_progress(obj)
        return progress.completed_at if progress and progress.completed else None

    def get_completed_by_name(self, obj):
        progress = self._get_progress(obj)
        if progress and progress.completed_by:
            return progress.completed_by.get_full_name() or progress.completed_by.username
        return None


class ApplicationOfferSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    offer_document_name = serializers.SerializerMethodField()

    class Meta:
        model = ApplicationOffer
        fields = [
            'id', 'application', 'student', 'student_name', 'offer_type', 'received_date',
            'response_deadline', 'conditions', 'tuition_fee', 'deposit_amount',
            'deposit_deadline', 'acceptance_status', 'offer_document', 'offer_document_name',
            'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_student(self, obj):
        return obj.application.student_id

    def get_student_name(self, obj):
        return obj.application.student.full_name if obj.application and obj.application.student else None

    def get_offer_document_name(self, obj):
        return obj.offer_document.file_name if obj.offer_document else None

    def validate_offer_type(self, value):
        valid = {choice[0] for choice in ApplicationOffer.OFFER_TYPE_CHOICES}
        if value not in valid:
            raise serializers.ValidationError(f"Invalid offer type. Must be one of: {', '.join(sorted(valid))}.")
        return value

    def validate_acceptance_status(self, value):
        valid = {choice[0] for choice in ApplicationOffer.ACCEPTANCE_STATUS_CHOICES}
        if value not in valid:
            raise serializers.ValidationError(
                f"Invalid acceptance status. Must be one of: {', '.join(sorted(valid))}."
            )
        return value

    def validate(self, attrs):
        application = attrs.get('application') or (self.instance.application if self.instance else None)
        document = attrs.get('offer_document') or (self.instance.offer_document if self.instance else None)

        if application and document and document.student_id != application.student_id:
            raise serializers.ValidationError({
                'offer_document': 'Offer document must belong to the same student as the application.'
            })

        if application and 'application' in self.initial_data:
            try:
                application_id = int(self.initial_data['application'])
            except (TypeError, ValueError):
                application_id = None
            if application_id is not None and application_id != application.id:
                raise serializers.ValidationError({'application': 'Cannot change the application linked to an offer.'})

        return attrs


class VisaCaseSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    application_student = serializers.SerializerMethodField()
    STATUS_TRANSITIONS = {
        'not_started': {'preparing'},
        'preparing': {'submitted'},
        'submitted': {'appointment_scheduled', 'withdrawn'},
        'appointment_scheduled': {'biometrics_completed', 'withdrawn'},
        'biometrics_completed': {'decision_pending', 'withdrawn'},
        'decision_pending': {'approved', 'rejected', 'withdrawn'},
        'approved': set(),
        'rejected': set(),
        'withdrawn': set(),
    }

    class Meta:
        model = VisaCase
        fields = [
            'id', 'application', 'student', 'student_name', 'application_student', 'visa_type', 'status',
            'application_date', 'appointment_date', 'biometrics_date', 'decision_date',
            'rejection_reason', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_student(self, obj):
        return obj.application.student_id

    def get_student_name(self, obj):
        return obj.application.student.full_name if obj.application and obj.application.student else None

    def get_application_student(self, obj):
        return self.get_student_name(obj)

    def validate_visa_type(self, value):
        valid = {choice[0] for choice in VisaCase.VISA_TYPE_CHOICES}
        if value not in valid:
            raise serializers.ValidationError(f"Invalid visa type. Must be one of: {', '.join(sorted(valid))}.")
        return value

    def validate_status(self, value):
        valid = {choice[0] for choice in VisaCase.STATUS_CHOICES}
        if value not in valid:
            raise serializers.ValidationError(f"Invalid status. Must be one of: {', '.join(sorted(valid))}.")
        return value

    def validate(self, attrs):
        application = attrs.get('application') or (self.instance.application if self.instance else None)
        if application and 'application' in self.initial_data:
            try:
                application_id = int(self.initial_data['application'])
            except (TypeError, ValueError):
                application_id = None
            if application_id is not None and application_id != application.id:
                raise serializers.ValidationError({'application': 'Cannot change the application linked to a visa case.'})

        new_status = attrs.get('status')
        current_status = self.instance.status if self.instance else 'not_started'
        if new_status is not None:
            allowed = self.STATUS_TRANSITIONS.get(current_status, set())
            if not self.instance and current_status == 'not_started' and new_status not in allowed:
                raise serializers.ValidationError({
                    'status': (
                        f"Cannot start a visa case in {dict(VisaCase.STATUS_CHOICES)[new_status]} "
                        f"from {dict(VisaCase.STATUS_CHOICES)[current_status]}."
                    )
                })
            if self.instance and 'status' in self.initial_data and new_status != self.instance.status:
                allowed = self.STATUS_TRANSITIONS.get(self.instance.status, set())
                if new_status not in allowed:
                    raise serializers.ValidationError({
                        'status': (
                            f"Cannot move a visa case from {self.instance.get_status_display()} to "
                            f"{dict(VisaCase.STATUS_CHOICES)[new_status]}."
                        )
                    })
        return attrs


class EnrollmentSerializer(serializers.ModelSerializer):
    student = serializers.SerializerMethodField()
    student_name = serializers.SerializerMethodField()
    STATUS_TRANSITIONS = {
        'pending': {'confirmed', 'deferred', 'withdrawn'},
        'confirmed': {'enrolled', 'deferred', 'withdrawn'},
        'enrolled': set(),
        'deferred': set(),
        'withdrawn': set(),
    }

    class Meta:
        model = Enrollment
        fields = [
            'id', 'application', 'student', 'student_name', 'status',
            'enrollment_date', 'university_name', 'course_name', 'intake',
            'student_reference', 'notes', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']

    def get_student(self, obj):
        return obj.application.student_id

    def get_student_name(self, obj):
        return obj.application.student.full_name if obj.application and obj.application.student else None

    def validate_status(self, value):
        valid = {choice[0] for choice in Enrollment.STATUS_CHOICES}
        if value not in valid:
            raise serializers.ValidationError(f"Invalid status. Must be one of: {', '.join(sorted(valid))}.")
        return value

    def validate(self, attrs):
        application = attrs.get('application') or (self.instance.application if self.instance else None)
        if application and 'application' in self.initial_data:
            try:
                application_id = int(self.initial_data['application'])
            except (TypeError, ValueError):
                application_id = None
            if application_id is not None and application_id != application.id:
                raise serializers.ValidationError({'application': 'Cannot change the application linked to an enrollment.'})

        if application and not attrs.get('university_name') and not self.instance:
            attrs['university_name'] = application.university_name
        if application and not attrs.get('course_name') and not self.instance:
            attrs['course_name'] = application.course_name
        if application and 'intake' not in attrs and not self.instance:
            attrs['intake'] = application.intake

        new_status = attrs.get('status')
        current_status = self.instance.status if self.instance else 'pending'
        if new_status is not None:
            if not self.instance and current_status == 'pending' and new_status != 'pending':
                raise serializers.ValidationError({
                    'status': (
                        f"Cannot start an enrollment in {dict(Enrollment.STATUS_CHOICES)[new_status]} "
                        f"from {dict(Enrollment.STATUS_CHOICES)[current_status]}."
                    )
                })
            if self.instance and 'status' in self.initial_data and new_status != self.instance.status:
                allowed = self.STATUS_TRANSITIONS.get(self.instance.status, set())
                if new_status not in allowed:
                    raise serializers.ValidationError({
                        'status': (
                            f"Cannot move an enrollment from {self.instance.get_status_display()} to "
                            f"{dict(Enrollment.STATUS_CHOICES)[new_status]}."
                        )
                    })
        return attrs


class ApplicationSerializer(serializers.ModelSerializer):
    STATUS_TRANSITIONS = {
        'draft': {'applied', 'withdrawn'},
        'applied': {'under_review', 'withdrawn'},
        'under_review': {'offer_received', 'rejected', 'withdrawn'},
        'offer_received': {'conditional_offer', 'rejected', 'withdrawn'},
        'conditional_offer': {'enrolled', 'rejected', 'withdrawn'},
        'rejected': set(),
        'withdrawn': set(),
        'enrolled': set(),
    }

    student_name = serializers.CharField(source='student.full_name', read_only=True)
    student_id_code = serializers.CharField(source='student.student_id', read_only=True)
    course_detail = CourseSerializer(source='course', read_only=True)
    country_code = serializers.CharField(source='country.code', read_only=True)
    deadline_status = serializers.SerializerMethodField()
    days_until_deadline = serializers.SerializerMethodField()
    workflow_name = serializers.SerializerMethodField()
    workflow_steps = serializers.SerializerMethodField()
    offers = ApplicationOfferSerializer(many=True, read_only=True)
    visa_case = VisaCaseSerializer(read_only=True)
    enrollment = EnrollmentSerializer(read_only=True)

    class Meta:
        model = Application
        fields = [
            'id', 'student', 'student_name', 'student_id_code',
            'course', 'course_detail',
            'university_name', 'course_name', 'country', 'country_name', 'country_code',
            'status', 'intake', 'applied_date', 'deadline',
            'deadline_status', 'days_until_deadline', 'notes',
            'workflow_name', 'workflow_steps', 'offers', 'visa_case', 'enrollment',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at', 'deadline_status', 'days_until_deadline']

    def get_days_until_deadline(self, obj):
        if obj.deadline is None:
            return None
        return (obj.deadline - timezone.localdate()).days

    def get_deadline_status(self, obj):
        if obj.deadline is None:
            return 'no_deadline'
        days_until_deadline = self.get_days_until_deadline(obj)
        if days_until_deadline < 0:
            return 'overdue'
        if days_until_deadline == 0:
            return 'due_today'
        return 'upcoming'

    def _get_workflow_progress(self, obj):
        cached = getattr(obj, '_serialized_workflow_progress', None)
        if cached is None:
            cached = {
                item.workflow_step_id: item
                for item in obj.workflow_progress.all()
            }
            obj._serialized_workflow_progress = cached
        return cached

    def get_workflow_name(self, obj):
        workflow = obj.get_country_workflow()
        return workflow.name if workflow else None

    def get_workflow_steps(self, obj):
        workflow = obj.get_country_workflow()
        if not workflow:
            return []
        return ApplicationWorkflowStepSerializer(
            workflow.steps.all(),
            many=True,
            context={
                **self.context,
                'workflow_progress': self._get_workflow_progress(obj),
            },
        ).data

    def validate_status(self, value):
        valid = {c[0] for c in Application.APPLICATION_STATUS_CHOICES}
        if value not in valid:
            raise serializers.ValidationError(f"Invalid status. Must be one of: {', '.join(sorted(valid))}.")
        return value

    def validate(self, attrs):
        if self.instance and self.instance.workflow_progress.exists():
            country_changed = 'country' in attrs and attrs['country'] != self.instance.country
            country_name_changed = (
                'country_name' in attrs
                and attrs['country_name'].strip().casefold()
                != self.instance.country_name.strip().casefold()
            )
            if country_changed or country_name_changed:
                raise serializers.ValidationError({
                    'country': 'Country cannot be changed after application progress has started.'
                })

        student = attrs.get('student') or (self.instance.student if self.instance else None)
        course = attrs.get('course') or (self.instance.course if self.instance else None)
        university_name = attrs.get('university_name', '') or (course.university if course else '') or (self.instance.university_name if self.instance else '')
        course_name = attrs.get('course_name', '') or (course.name if course else '') or (self.instance.course_name if self.instance else '')
        intake = attrs.get('intake', '') if 'intake' in attrs else (self.instance.intake if self.instance else '')

        if student and university_name and course_name:
            qs = Application.objects.filter(
                student=student,
                university_name__iexact=university_name.strip(),
                course_name__iexact=course_name.strip(),
                intake__iexact=intake.strip()
            )
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                raise serializers.ValidationError(
                    "An application for this student, university, course, and intake already exists."
                )

        new_status = attrs.get('status')
        if (
            self.instance
            and 'status' in self.initial_data
            and new_status
            and new_status != self.instance.status
        ):
            allowed_statuses = self.STATUS_TRANSITIONS.get(self.instance.status, set())
            if new_status not in allowed_statuses:
                raise serializers.ValidationError({
                    'status': (
                        f"Cannot move an application from "
                        f"{self.instance.get_status_display()} to "
                        f"{dict(Application.APPLICATION_STATUS_CHOICES)[new_status]}."
                    )
                })
        return attrs


class StudentPortalApplicationSerializer(ApplicationSerializer):
    class Meta(ApplicationSerializer.Meta):
        fields = [field for field in ApplicationSerializer.Meta.fields if field != 'notes']


class StudentPortalEnrollmentSerializer(EnrollmentSerializer):
    class Meta(EnrollmentSerializer.Meta):
        fields = [
            'id', 'application', 'student', 'student_name', 'status', 'enrollment_date',
            'university_name', 'course_name', 'intake', 'student_reference'
        ]


class StudentProfileSerializer(serializers.ModelSerializer):
    process_steps = ProcessStepSerializer(many=True, read_only=True)
    documents = StudentDocumentSerializer(many=True, read_only=True)
    applications = ApplicationSerializer(many=True, read_only=True)
    enrollment = serializers.SerializerMethodField()
    counselling_notes = CounsellingNoteSerializer(many=True, read_only=True)
    follow_ups = FollowUpSerializer(many=True, read_only=True)
    tasks = TaskSerializer(many=True, read_only=True)
    appointments = AppointmentSerializer(many=True, read_only=True)
    username = serializers.CharField(source='user.username', read_only=True)
    email = serializers.EmailField(source='user.email', read_only=True)
    enrolled_by_name = serializers.SerializerMethodField()
    lead_name = serializers.SerializerMethodField()
    total_estimated_cost = serializers.SerializerMethodField()
    total_paid = serializers.SerializerMethodField()
    pending_balance = serializers.SerializerMethodField()

    class Meta:
        model = StudentProfile
        fields = [
            'id', 'student_id', 'user', 'username', 'email', 'full_name', 'phone', 'destination_country',
            'enrollment_date', 'enrolled_by', 'enrolled_by_name', 'notes',
            # Phase 1.4 & Phase 2.1
            'status', 'lead', 'lead_name',
            'applications', 'enrollment', 'process_steps', 'documents', 'total_estimated_cost', 'total_paid', 'pending_balance',
            'counselling_notes', 'follow_ups', 'tasks', 'appointments',
        ]

    def get_enrollment(self, obj):
        enrollment = None
        for application in obj.applications.all():
            if hasattr(application, 'enrollment'):
                enrollment = application.enrollment
                break
        if not enrollment:
            return None
        return StudentPortalEnrollmentSerializer(enrollment).data

    def get_enrolled_by_name(self, obj):
        if obj.enrolled_by:
            return obj.enrolled_by.get_full_name() or obj.enrolled_by.username
        return 'System'

    def get_lead_name(self, obj):
        return obj.lead.name if obj.lead else None

    def get_total_estimated_cost(self, obj):
        return sum(step.estimated_cost for step in obj.process_steps.all())

    def get_total_paid(self, obj):
        total = 0
        for step in obj.process_steps.all():
            total += sum(p.amount for p in step.payments.all())
        return total

    def get_pending_balance(self, obj):
        return max(0.00, float(self.get_total_estimated_cost(obj)) - float(self.get_total_paid(obj)))


class StudentPortalProfileSerializer(StudentProfileSerializer):
    applications = StudentPortalApplicationSerializer(many=True, read_only=True)
    enrollment = StudentPortalEnrollmentSerializer(read_only=True)

    class Meta(StudentProfileSerializer.Meta):
        fields = [
            'id', 'student_id', 'user', 'username', 'email', 'full_name', 'phone',
            'destination_country', 'enrollment_date', 'enrolled_by', 'enrolled_by_name',
            'notes', 'status', 'lead', 'lead_name', 'applications', 'enrollment', 'process_steps', 'documents',
            'total_estimated_cost', 'total_paid', 'pending_balance',
        ]



class StudentProfileUpdateSerializer(serializers.ModelSerializer):
    """
    Used by PATCH /api/students/<pk>/.
    Only the fields a counsellor is allowed to update after enrollment.
    student_id, user, enrollment_date, enrolled_by are intentionally excluded.
    """
    class Meta:
        model = StudentProfile
        fields = ['full_name', 'phone', 'destination_country', 'notes', 'status']

    def validate_status(self, value):
        valid = {c[0] for c in StudentProfile.STUDENT_STATUS_CHOICES}
        if value not in valid:
            raise serializers.ValidationError(
                f"Invalid status. Must be one of: {', '.join(sorted(valid))}."
            )
        return value

    def validate_full_name(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Full name cannot be blank.")
        return value

    def validate_phone(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Phone cannot be blank.")
        return value

    def validate_destination_country(self, value):
        value = value.strip()
        if not value:
            raise serializers.ValidationError("Destination country cannot be blank.")
        return value


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


class VideoTestimonialSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = VideoTestimonial
        fields = [
            'id', 'student_name', 'video_url', 'thumbnail_url', 'public_id',
            'uploaded_by', 'uploaded_by_name', 'uploaded_at', 'is_published', 'display_order'
        ]
        read_only_fields = ['uploaded_by', 'uploaded_at', 'video_url', 'thumbnail_url', 'public_id']

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.get_full_name() or obj.uploaded_by.username
        return 'System'
