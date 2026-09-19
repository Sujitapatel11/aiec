from django.db import models
from django.contrib.auth.models import User

DEFAULT_CHECKLIST_TEMPLATE = [
    {"step_name": "Document Collection", "order": 1},
    {"step_name": "University Application", "order": 2},
    {"step_name": "Offer Letter", "order": 3},
    {"step_name": "Visa Application", "order": 4},
    {"step_name": "Visa Interview", "order": 5},
    {"step_name": "Visa Approval", "order": 6},
    {"step_name": "Pre-departure", "order": 7},
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

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} — {self.email}"

    class Meta:
        ordering = ['-created_at']
        permissions = [
            ("can_delete_lead", "Can delete lead records"),
            ("can_export_leads", "Can export lead data"),
        ]


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

class StudentProfile(models.Model):
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    full_name = models.CharField(max_length=200)
    phone = models.CharField(max_length=30)
    destination_country = models.CharField(max_length=100)
    enrollment_date = models.DateField(auto_now_add=True)
    enrolled_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='enrolled_students')
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Student: {self.full_name} ({self.destination_country})"

    class Meta:
        ordering = ['-created_at']


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

