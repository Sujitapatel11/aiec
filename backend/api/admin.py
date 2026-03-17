from django.contrib import admin
from .models import Lead, Questionnaire, Country, Course


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
        ('CRM', {'fields': ('status', 'source', 'notes')}),
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
