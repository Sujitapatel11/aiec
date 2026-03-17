from django.db import models


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
