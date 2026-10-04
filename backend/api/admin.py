from django.contrib import admin
from .models import (
    Lead, Questionnaire, Country, Course,
    StudentProfile, StudentIdSequence, ProcessStep, Payment, StudentDocument, Application,
)


# ── Leads ─────────────────────────────────────────────────────────────────

@admin.register(Lead)
class LeadAdmin(admin.ModelAdmin):
    list_display = [
        'name', 'email', 'phone', 'country_of_residence',
        'qualification', 'course_interest', 'recommended_country',
        'budget', 'status', 'source', 'created_at',
    ]
    list_filter = ['status', 'source', 'recommended_country']
    search_fields = ['name', 'email', 'phone', 'course_interest', 'recommended_country']
    list_editable = ['status']
    readonly_fields = ['created_at', 'updated_at']
    fieldsets = (
        ('Contact', {'fields': ('name', 'email', 'phone', 'country_of_residence')}),
        ('Academic Profile', {'fields': ('qualification', 'marks', 'english_score', 'budget', 'course_interest')}),
        ('AI Recommendation', {'fields': ('recommended_country', 'recommended_course')}),
        ('CRM', {'fields': ('status', 'source', 'notes', 'assigned_to', 'next_follow_up')}),
        ('Timestamps', {'fields': ('created_at', 'updated_at')}),
    )


@admin.register(Questionnaire)
class QuestionnaireAdmin(admin.ModelAdmin):
    list_display = ['lead', 'education_level', 'field_of_interest', 'budget_range', 'created_at']
    search_fields = ['lead__name', 'field_of_interest']


@admin.register(Country)
class CountryAdmin(admin.ModelAdmin):
    list_display = ['name', 'code', 'avg_tuition_usd', 'is_popular']
    list_editable = ['is_popular']


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = ['name', 'university', 'country', 'level', 'tuition_usd']
    list_filter = ['country', 'level']


# ── Student Management ────────────────────────────────────────────────────

class ProcessStepInline(admin.TabularInline):
    model = ProcessStep
    extra = 0
    fields = ['order', 'step_name', 'status', 'estimated_cost', 'due_date', 'completed_at', 'notes']
    readonly_fields = ['completed_at']
    ordering = ['order']


class StudentDocumentInline(admin.TabularInline):
    model = StudentDocument
    extra = 0
    fields = ['document_type', 'file_name', 'verification_status', 'uploaded_by', 'uploaded_at']
    readonly_fields = ['file_name', 'uploaded_by', 'uploaded_at']


@admin.register(StudentProfile)
class StudentProfileAdmin(admin.ModelAdmin):
    list_display = [
        'student_id', 'full_name', 'phone', 'destination_country',
        'status', 'enrollment_date', 'enrolled_by', 'lead',
    ]
    list_filter  = ['status', 'destination_country', 'enrollment_date']
    search_fields = ['student_id', 'full_name', 'phone', 'user__username', 'user__email']
    readonly_fields = ['student_id', 'enrollment_date', 'created_at', 'updated_at']
    list_select_related = ['user', 'enrolled_by', 'lead']
    inlines = [ProcessStepInline, StudentDocumentInline]
    fieldsets = (
        ('Identity', {'fields': ('student_id', 'user', 'full_name', 'phone')}),
        ('Enrollment', {'fields': ('destination_country', 'status', 'enrolled_by', 'lead', 'notes')}),
        ('Timestamps', {'fields': ('enrollment_date', 'created_at', 'updated_at')}),
    )


@admin.register(Application)
class ApplicationAdmin(admin.ModelAdmin):
    list_display = ['student', 'university_name', 'course_name', 'intake', 'status', 'applied_date', 'deadline']
    list_filter = ['status', 'country', 'intake']
    search_fields = ['student__full_name', 'student__student_id', 'university_name', 'course_name']
    list_select_related = ['student', 'course', 'country']


@admin.register(StudentIdSequence)
class StudentIdSequenceAdmin(admin.ModelAdmin):
    list_display = ['year', 'last_number']
    readonly_fields = ['year', 'last_number']

    def has_add_permission(self, request):
        return False  # sequences are auto-created by generate_student_id()

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser  # superadmin only — deleting breaks ID gen


@admin.register(ProcessStep)
class ProcessStepAdmin(admin.ModelAdmin):
    list_display  = ['student', 'order', 'step_name', 'status', 'estimated_cost', 'due_date']
    list_filter   = ['status']
    search_fields = ['student__full_name', 'student__student_id', 'step_name']
    readonly_fields = ['completed_at']
    list_select_related = ['student']


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display  = ['step', 'amount', 'payment_date', 'recorded_by', 'notes']
    list_filter   = ['payment_date']
    search_fields = ['step__student__full_name', 'step__step_name']
    readonly_fields = ['payment_date']
    list_select_related = ['step__student', 'recorded_by']


@admin.register(StudentDocument)
class StudentDocumentAdmin(admin.ModelAdmin):
    list_display  = [
        'student', 'document_type', 'file_name',
        'verification_status', 'uploaded_by', 'uploaded_at',
    ]
    list_filter   = ['verification_status', 'document_type']
    search_fields = ['student__full_name', 'student__student_id', 'file_name']
    readonly_fields = ['file_url', 'public_id', 'uploaded_at', 'verified_at']
    list_select_related = ['student', 'uploaded_by', 'verified_by']
