from django.db import models, transaction
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.contrib.auth.models import User
from django.utils import timezone
from django.conf import settings


def _get_default_checklist():
    """
    Return the active checklist template from settings.
    Falls back to a safe 7-step study-abroad default if settings is not
    configured — this keeps models.py importable even in testing contexts
    before settings are fully loaded.
    """
    return getattr(settings, 'STUDENT_DEFAULT_CHECKLIST', [
        {"step_name": "Document Collection",   "order": 1},
        {"step_name": "University Application", "order": 2},
        {"step_name": "Offer Letter",           "order": 3},
        {"step_name": "Visa Application",       "order": 4},
        {"step_name": "Visa Interview",         "order": 5},
        {"step_name": "Visa Approval",          "order": 6},
        {"step_name": "Pre-departure",          "order": 7},
    ])


# Legacy module-level alias kept for any external code that imports it directly.
# New code should call _get_default_checklist() or use settings.STUDENT_DEFAULT_CHECKLIST.
DEFAULT_CHECKLIST_TEMPLATE = [
    {"step_name": "Document Collection",   "order": 1},
    {"step_name": "University Application", "order": 2},
    {"step_name": "Offer Letter",           "order": 3},
    {"step_name": "Visa Application",       "order": 4},
    {"step_name": "Visa Interview",         "order": 5},
    {"step_name": "Visa Approval",          "order": 6},
    {"step_name": "Pre-departure",          "order": 7},
]



class Lead(models.Model):
    STATUS_CHOICES = [
        ('new', 'New'),
        ('contacted', 'Contacted'),
        ('applied', 'Applied'),
        ('visa_process', 'Visa Process'),
        ('converted', 'Converted'),
        ('lost', 'Lost'),
    ]

    # Contact info
    name = models.CharField(max_length=200)
    email = models.EmailField()
    phone = models.CharField(max_length=20)
    country_of_residence = models.CharField(max_length=100, blank=True)

    # Academic profile (captured from assessment)
    qualification = models.CharField(max_length=100, blank=True)
    marks = models.FloatField(null=True, blank=True)
    english_score = models.FloatField(null=True, blank=True)
    budget = models.IntegerField(null=True, blank=True)
    course_interest = models.CharField(max_length=200, blank=True)

    # AI output
    recommended_country = models.CharField(max_length=100, blank=True)
    recommended_course = models.CharField(max_length=200, blank=True)

    # CRM
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='new')
    source = models.CharField(max_length=100, default='ai_assessment')
    notes = models.TextField(blank=True)
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_leads')
    next_follow_up = models.DateTimeField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} — {self.email}"

    @property
    def is_overdue(self):
        if self.next_follow_up and self.status not in ['converted', 'lost']:
            return self.next_follow_up < timezone.now()
        return False

    class Meta:
        ordering = ['-created_at']
        permissions = [
            ("can_delete_lead", "Can delete lead records"),
            ("can_export_leads", "Can export lead data"),
        ]


class LeadActivity(models.Model):
    ACTIVITY_TYPES = [
        ('note', 'Note'),
        ('call', 'Call'),
        ('whatsapp', 'WhatsApp'),
        ('status_change', 'Status Change'),
        ('assignment', 'Assignment'),
        ('followup', 'Follow-up'),
        # Phase 1.3 — Counselling Operations
        ('counselling_note', 'Counselling Note'),
        ('task', 'Task'),
        ('appointment', 'Appointment'),
    ]

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, related_name='activities')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='lead_activities')
    activity_type = models.CharField(max_length=50, choices=ACTIVITY_TYPES, default='note')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        author_name = self.author.get_full_name() or self.author.username if self.author else 'System'
        return f"{self.activity_type.title()} on {self.lead.name} by {author_name}"

    class Meta:
        ordering = ['-created_at']



class Questionnaire(models.Model):
    lead = models.OneToOneField(Lead, on_delete=models.CASCADE, related_name='questionnaire')
    education_level = models.CharField(max_length=100)
    field_of_interest = models.CharField(max_length=200)
    preferred_countries = models.JSONField(default=list)
    budget_range = models.CharField(max_length=100)
    english_proficiency = models.CharField(max_length=50)
    work_experience_years = models.IntegerField(default=0)
    target_intake = models.CharField(max_length=50)
    additional_info = models.TextField(blank=True)
    ai_country_recommendation = models.JSONField(default=list)
    ai_course_recommendation = models.JSONField(default=list)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Questionnaire for {self.lead.name}"


class Country(models.Model):
    name = models.CharField(max_length=100)
    code = models.CharField(max_length=5)
    description = models.TextField()
    highlights = models.JSONField(default=list)
    avg_tuition_usd = models.IntegerField(default=0)
    image_url = models.URLField(blank=True)
    is_popular = models.BooleanField(default=False)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = 'Countries'


class Course(models.Model):
    name = models.CharField(max_length=200)
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='courses')
    university = models.CharField(max_length=200)
    level = models.CharField(max_length=50)
    duration = models.CharField(max_length=50)
    tuition_usd = models.IntegerField(default=0)
    description = models.TextField(blank=True)
    requirements = models.TextField(blank=True)

    def __str__(self):
        return f"{self.name} - {self.university}"


# ── Student Enrollment & Process Tracking System ───────────────────────────

class StudentIdSequence(models.Model):
    year = models.IntegerField(unique=True)
    last_number = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"StudentIdSequence({self.year}: {self.last_number})"


def generate_student_id(year=None):
    """
    Generate a unique, sequential student ID for the given year.

    Format:  <PREFIX>-<YEAR>-<NNNN>
    Example: STU-2026-0001

    The prefix is read from settings.STUDENT_ID_PREFIX (default 'STU').
    Existing stored IDs are never rewritten — this only applies to new records.
    The sequence is per-year and uses a SELECT FOR UPDATE to be atomic under
    concurrent enrollment requests.
    """
    if year is None:
        year = timezone.now().year
    prefix = getattr(settings, 'STUDENT_ID_PREFIX', 'STU')
    with transaction.atomic():
        seq, _ = StudentIdSequence.objects.select_for_update().get_or_create(year=year)
        seq.last_number += 1
        seq.save()
        return f"{prefix}-{seq.year}-{seq.last_number:04d}"


class StudentProfile(models.Model):
    STUDENT_STATUS_CHOICES = [
        ('active',    'Active'),
        ('on_hold',   'On Hold'),
        ('graduated', 'Graduated'),
        ('withdrawn', 'Withdrawn'),
        ('deferred',  'Deferred'),
    ]

    student_id = models.CharField(max_length=50, unique=True, null=True, blank=True, db_index=True)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    full_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=30)
    destination_country = models.CharField(max_length=100)
    enrollment_date = models.DateField(auto_now_add=True)
    enrolled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='enrolled_students')
    notes = models.TextField(blank=True)

    # Phase 1.4 — lifecycle status
    status = models.CharField(
        max_length=20,
        choices=STUDENT_STATUS_CHOICES,
        default='active',
        db_index=True,
    )

    # Phase 1.4 — traceability back to originating Lead (nullable; existing students have no lead)
    lead = models.ForeignKey(
        'Lead',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='students',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        if not self.student_id:
            year = self.enrollment_date.year if self.enrollment_date else timezone.now().year
            self.student_id = generate_student_id(year=year)
        super().save(*args, **kwargs)

    def __str__(self):
        return f"Student [{self.student_id}]: {self.full_name} ({self.destination_country})"

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['lead'],
                condition=models.Q(lead__isnull=False),
                name='unique_student_profile_lead',
            ),
        ]


class Application(models.Model):
    """An application links to Course but snapshots names so SET_NULL preserves context."""

    APPLICATION_STATUS_CHOICES = [
        ('draft',             'Draft'),
        ('applied',           'Applied'),
        ('under_review',      'Under Review'),
        ('offer_received',    'Offer Received'),
        ('conditional_offer', 'Conditional Offer'),
        ('rejected',          'Rejected'),
        ('withdrawn',         'Withdrawn'),
        ('enrolled',          'Enrolled'),
    ]

    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='applications')
    course = models.ForeignKey('Course', on_delete=models.SET_NULL, null=True, blank=True, related_name='applications')
    university_name = models.CharField(max_length=200)
    course_name = models.CharField(max_length=200)
    country = models.ForeignKey('Country', on_delete=models.SET_NULL, null=True, blank=True, related_name='applications')
    country_name = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=30, choices=APPLICATION_STATUS_CHOICES, default='draft', db_index=True)
    intake = models.CharField(max_length=50, blank=True)
    applied_date = models.DateField(null=True, blank=True)
    deadline = models.DateField(null=True, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def save(self, *args, **kwargs):
        update_fields = kwargs.get('update_fields')
        country_fields_updated = update_fields is None or bool(
            {'country', 'country_name'} & set(update_fields)
        )
        if self.pk and country_fields_updated:
            old_country = type(self).objects.filter(pk=self.pk).values_list(
                'country_id', 'country_name'
            ).first()
            if old_country:
                country_changed = old_country[0] != self.country_id
                country_name_changed = old_country[1].strip().casefold() != self.country_name.strip().casefold()
                has_workflow_progress = self.workflow_progress.exists()
                has_document_progress = self.document_requirements.filter(
                    student_document__isnull=False
                ).exists()
                if (country_changed or country_name_changed) and (
                    has_workflow_progress or has_document_progress
                ):
                    raise ValidationError({
                        'country': 'Country cannot be changed after application progress has started.'
                    })

        if self.course:
            if not self.university_name and self.course.university:
                self.university_name = self.course.university
            if not self.course_name and self.course.name:
                self.course_name = self.course.name
            if not self.country and self.course.country:
                self.country = self.course.country
            if not self.country_name and self.course.country:
                self.country_name = self.course.country.name
        super().save(*args, **kwargs)
        self.ensure_document_requirements()

    def __str__(self):
        return f"Application [{self.status}]: {self.student.full_name} -> {self.university_name} ({self.course_name})"

    def get_country_workflow(self):
        progress = next(iter(self.workflow_progress.all()), None)
        if progress:
            return progress.workflow_step.workflow
        if self.country_id:
            return next(
                (workflow for workflow in self.country.workflows.all() if workflow.active),
                None,
            )
        return None

    def ensure_document_requirements(self):
        if not self.country_id:
            return
        template = CountryDocumentTemplate.objects.filter(
            country_id=self.country_id,
            active=True,
        ).first()
        if not template:
            return
        for template_requirement in template.requirements.all():
            ApplicationDocumentRequirement.objects.get_or_create(
                application=self,
                template=template,
                document_type=template_requirement.document_type,
                defaults={
                    'template_requirement': template_requirement,
                    'label': template_requirement.label,
                    'description': template_requirement.description,
                    'required': template_requirement.required,
                    'order': template_requirement.order,
                },
            )

    class Meta:
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['student', 'status'], name='idx_app_student_status'),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=['student', 'university_name', 'course_name', 'intake'],
                name='unique_student_app_intake'
            ),
        ]


class CountryWorkflow(models.Model):
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='workflows')
    name = models.CharField(max_length=150)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.country.name} — {self.name}"

    class Meta:
        ordering = ['country__name', 'name', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['country'],
                condition=models.Q(active=True),
                name='unique_active_country_workflow',
            ),
        ]


class CountryWorkflowStep(models.Model):
    workflow = models.ForeignKey(CountryWorkflow, on_delete=models.CASCADE, related_name='steps')
    name = models.CharField(max_length=200)
    order = models.PositiveIntegerField()
    required = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.workflow}: {self.order}. {self.name}"

    class Meta:
        ordering = ['order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['workflow', 'order'],
                name='unique_country_workflow_step_order',
            ),
        ]


class ApplicationWorkflowProgress(models.Model):
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='workflow_progress',
    )
    workflow_step = models.ForeignKey(
        CountryWorkflowStep,
        on_delete=models.PROTECT,
        related_name='application_progress',
    )
    completed = models.BooleanField(default=False)
    completed_at = models.DateTimeField(null=True, blank=True)
    completed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='completed_application_workflow_steps',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.application}: {self.workflow_step} [{self.completed}]"

    class Meta:
        ordering = ['workflow_step__order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['application', 'workflow_step'],
                name='unique_application_workflow_progress',
            ),
        ]


class CountryDocumentTemplate(models.Model):
    country = models.ForeignKey(Country, on_delete=models.CASCADE, related_name='document_templates')
    name = models.CharField(max_length=150)
    active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.country.name} — {self.name}"

    class Meta:
        ordering = ['country__name', 'name', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['country'],
                condition=models.Q(active=True),
                name='unique_active_country_document_template',
            ),
        ]


class CountryDocumentRequirement(models.Model):
    template = models.ForeignKey(
        CountryDocumentTemplate,
        on_delete=models.CASCADE,
        related_name='requirements',
    )
    document_type = models.CharField(max_length=100)
    label = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    required = models.BooleanField(default=True)
    order = models.PositiveIntegerField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.template}: {self.label}"

    class Meta:
        ordering = ['order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['template', 'document_type'],
                name='unique_template_document_type',
            ),
            models.UniqueConstraint(
                fields=['template', 'order'],
                name='unique_template_document_order',
            ),
        ]


class ApplicationDocumentRequirement(models.Model):
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='document_requirements',
    )
    template = models.ForeignKey(
        CountryDocumentTemplate,
        on_delete=models.PROTECT,
        related_name='application_requirements',
    )
    template_requirement = models.ForeignKey(
        CountryDocumentRequirement,
        on_delete=models.PROTECT,
        related_name='application_requirements',
    )
    document_type = models.CharField(max_length=100)
    label = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    required = models.BooleanField(default=True)
    order = models.PositiveIntegerField()
    student_document = models.ForeignKey(
        'StudentDocument',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='application_requirements',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def status(self):
        if not self.student_document_id:
            return 'missing'
        if self.student_document.verification_status == 'verified':
            return 'verified'
        if self.student_document.verification_status == 'rejected':
            return 'rejected'
        return 'submitted'

    def __str__(self):
        return f"{self.application}: {self.label} [{self.status}]"

    class Meta:
        ordering = ['order', 'id']
        constraints = [
            models.UniqueConstraint(
                fields=['application', 'template', 'document_type'],
                name='unique_application_template_document_type',
            ),
        ]


class ApplicationOffer(models.Model):
    OFFER_TYPE_CHOICES = [
        ('conditional', 'Conditional Offer'),
        ('unconditional', 'Unconditional Offer'),
        ('deferred', 'Deferred Offer'),
    ]
    ACCEPTANCE_STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('accepted', 'Accepted'),
        ('declined', 'Declined'),
        ('expired', 'Expired'),
    ]

    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='offers',
    )
    offer_type = models.CharField(max_length=30, choices=OFFER_TYPE_CHOICES, default='conditional')
    acceptance_status = models.CharField(max_length=30, choices=ACCEPTANCE_STATUS_CHOICES, default='pending', db_index=True)
    received_date = models.DateField(null=True, blank=True)
    response_deadline = models.DateField(null=True, blank=True)
    tuition_fee = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    deposit_amount = models.DecimalField(max_digits=12, decimal_places=2, default=0.00, validators=[MinValueValidator(0)])
    deposit_deadline = models.DateField(null=True, blank=True)
    currency = models.CharField(max_length=10, default='USD')
    conditions = models.TextField(blank=True, default='')
    notes = models.TextField(blank=True, default='')
    offer_code = models.CharField(max_length=80, blank=True, default='')
    is_current = models.BooleanField(default=True)
    offer_document = models.ForeignKey(
        'StudentDocument',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='offer_links',
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def status(self):
        return self.acceptance_status

    @status.setter
    def status(self, value):
        self.acceptance_status = value

    @property
    def issued_at(self):
        return self.received_date

    @issued_at.setter
    def issued_at(self, value):
        self.received_date = value

    @property
    def expires_at(self):
        return self.response_deadline

    @expires_at.setter
    def expires_at(self, value):
        self.response_deadline = value

    @property
    def expires_soon(self):
        if not self.response_deadline:
            return False
        return self.response_deadline <= (timezone.localdate() + timezone.timedelta(days=14))

    @property
    def is_expired(self):
        if not self.response_deadline:
            return False
        return self.response_deadline < timezone.localdate()

    def clean(self):
        if self.offer_document_id and self.application_id and self.application.student_id != self.offer_document.student_id:
            raise ValidationError('Offer document must belong to the same student profile as the application.')
        if self.tuition_fee is not None and self.tuition_fee < 0:
            raise ValidationError('Tuition fee cannot be negative.')
        if self.deposit_amount is not None and self.deposit_amount < 0:
            raise ValidationError('Deposit amount cannot be negative.')

    def save(self, *args, **kwargs):
        self.full_clean(exclude=['created_at', 'updated_at'])
        super().save(*args, **kwargs)
        if self.is_current:
            ApplicationOffer.objects.filter(
                application=self.application,
                is_current=True,
            ).exclude(pk=self.pk).update(is_current=False)

    def __str__(self):
        return f"{self.application} - {self.get_offer_type_display()} ({self.get_acceptance_status_display()})"

    class Meta:
        ordering = ['-received_date', '-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['application', 'offer_code'],
                condition=models.Q(offer_code__gt=''),
                name='unique_application_offer_code',
            ),
        ]


class ApplicationTimelineEvent(models.Model):
    application = models.ForeignKey(
        Application,
        on_delete=models.CASCADE,
        related_name='timeline_events',
    )
    event_type = models.CharField(max_length=50)
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True, default='')
    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='application_timeline_events',
    )
    created_at = models.DateTimeField(default=timezone.now, db_index=True)

    def __str__(self):
        return f"{self.title} — {self.application}"

    class Meta:
        ordering = ['created_at', 'id']


class ProcessStep(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
    ]

    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='process_steps')
    step_name = models.CharField(max_length=200)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    estimated_cost = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    due_date = models.DateField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)
    order = models.PositiveIntegerField(default=0)

    def __str__(self):
        return f"{self.student.full_name} - Step {self.order}: {self.step_name} [{self.status}]"

    class Meta:
        ordering = ['order', 'id']


class Payment(models.Model):
    step = models.ForeignKey(ProcessStep, on_delete=models.CASCADE, related_name='payments')
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    payment_date = models.DateField(auto_now_add=True)
    recorded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='recorded_payments')
    notes = models.TextField(blank=True)

    def __str__(self):
        return f"Payment ${self.amount} for {self.step.step_name} on {self.payment_date}"

    class Meta:
        ordering = ['-payment_date', '-id']


class VideoTestimonial(models.Model):
    student_name = models.CharField(max_length=200, blank=True, default='')
    video_url = models.URLField(max_length=500)
    thumbnail_url = models.URLField(max_length=500, blank=True, default='')
    public_id = models.CharField(max_length=200, blank=True, default='')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='video_testimonials')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    is_published = models.BooleanField(default=True)
    display_order = models.IntegerField(default=0)

    def __str__(self):
        name = self.student_name if self.student_name else "Anonymous Student"
        return f"Video Testimonial: {name} [{'Published' if self.is_published else 'Draft'}]"

    class Meta:
        ordering = ['display_order', '-uploaded_at', '-id']


class StudentDocument(models.Model):
    DOCUMENT_TYPES = [
        ('Passport', 'Passport'),
        ('10th Marksheet', '10th Marksheet'),
        ('12th Marksheet', '12th Marksheet'),
        ('IELTS/English Score', 'IELTS / English Score'),
        ('Bank Statement', 'Bank Statement'),
        ('Photo', 'Passport Photo'),
        ('Other', 'Other Document'),
    ]

    VERIFICATION_STATUSES = [
        ('pending', 'Pending Review'),
        ('verified', 'Verified'),
        ('rejected', 'Rejected'),
    ]

    student = models.ForeignKey(StudentProfile, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=100, choices=DOCUMENT_TYPES, default='Other')
    file_url = models.URLField(max_length=500)
    public_id = models.CharField(max_length=200, blank=True, default='')
    file_name = models.CharField(max_length=255, blank=True, default='')
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='uploaded_documents')
    uploaded_at = models.DateTimeField(auto_now_add=True)
    verification_status = models.CharField(max_length=20, choices=VERIFICATION_STATUSES, default='pending')
    verified_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='verified_documents')
    verified_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default='')

    def __str__(self):
        return f"{self.student.full_name} - {self.document_type} [{self.verification_status}]"

    class Meta:
        ordering = ['-uploaded_at', '-id']


# ── CRM Counselling, Follow-ups, Tasks & Appointments ───────────────────────

class CounsellingNote(models.Model):
    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name='counselling_notes')
    student = models.ForeignKey('StudentProfile', on_delete=models.CASCADE, null=True, blank=True, related_name='counselling_notes')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='authored_counselling_notes')
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        target = self.lead.name if self.lead else (self.student.full_name if self.student else 'General')
        author_name = self.author.get_full_name() or self.author.username if self.author else 'System'
        return f"Counselling Note for {target} by {author_name}"

    class Meta:
        ordering = ['-created_at']


class FollowUp(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name='follow_ups')
    student = models.ForeignKey('StudentProfile', on_delete=models.CASCADE, null=True, blank=True, related_name='follow_ups')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_follow_ups')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_follow_ups')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_at = models.DateTimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_overdue(self):
        if self.due_at and self.status == 'pending':
            return self.due_at < timezone.now()
        return False

    def __str__(self):
        return f"Follow-up: {self.title} [{self.status}]"

    class Meta:
        ordering = ['due_at', '-created_at']


class Task(models.Model):
    STATUS_CHOICES = [
        ('pending', 'Pending'),
        ('in_progress', 'In Progress'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
    ]
    PRIORITY_CHOICES = [
        ('low', 'Low'),
        ('medium', 'Medium'),
        ('high', 'High'),
    ]

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name='tasks')
    student = models.ForeignKey('StudentProfile', on_delete=models.CASCADE, null=True, blank=True, related_name='tasks')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='assigned_tasks')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_tasks')
    title = models.CharField(max_length=200)
    description = models.TextField(blank=True)
    due_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='pending')
    priority = models.CharField(max_length=20, choices=PRIORITY_CHOICES, default='medium')
    completed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    @property
    def is_overdue(self):
        if self.due_at and self.status in ['pending', 'in_progress']:
            return self.due_at < timezone.now()
        return False

    def __str__(self):
        return f"Task: {self.title} [{self.status}]"

    class Meta:
        ordering = ['due_at', '-created_at']


class Appointment(models.Model):
    STATUS_CHOICES = [
        ('scheduled', 'Scheduled'),
        ('completed', 'Completed'),
        ('cancelled', 'Cancelled'),
        ('no_show', 'No Show'),
    ]

    lead = models.ForeignKey(Lead, on_delete=models.CASCADE, null=True, blank=True, related_name='appointments')
    student = models.ForeignKey('StudentProfile', on_delete=models.CASCADE, null=True, blank=True, related_name='appointments')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='counselor_appointments')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_appointments')
    title = models.CharField(max_length=200)
    appointment_date = models.DateTimeField()
    duration_minutes = models.PositiveIntegerField(default=30)
    location_mode = models.CharField(max_length=100, default='In-Person Office')
    notes = models.TextField(blank=True)
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='scheduled')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Appointment: {self.title} on {self.appointment_date}"

    class Meta:
        ordering = ['appointment_date', '-created_at']
