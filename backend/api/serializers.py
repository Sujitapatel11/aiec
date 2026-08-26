from rest_framework import serializers
from .models import Lead, Questionnaire, Country, Course


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
    qualification = serializers.CharField(max_length=100, required=False, default="Bachelor's Degree")
    marks = serializers.FloatField(min_value=0, max_value=100, required=False, allow_null=True, default=75.0)
    english_score = serializers.FloatField(min_value=0, max_value=9, required=False, allow_null=True, default=6.5)
    course_interest = serializers.CharField(max_length=200, required=False, default="Computer Science")
    budget = serializers.IntegerField(min_value=0, required=False, allow_null=True, default=25000)
    pr_preference = serializers.BooleanField(required=False, default=False)
    timeline = serializers.IntegerField(min_value=1, max_value=36, required=False, default=12)
    target_intake = serializers.CharField(max_length=100, required=False, default="Within 1 year")

