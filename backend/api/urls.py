from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('leads', views.LeadViewSet)
router.register('countries', views.CountryViewSet)
router.register('courses', views.CourseViewSet)

urlpatterns = [
    path('', include(router.urls)),
    path('questionnaire/', views.submit_questionnaire),
    path('contact/', views.contact_inquiry),
    path('dashboard/stats/', views.dashboard_stats),
    path('recommend/', views.profile_recommend),
    path('capture-lead/', views.capture_lead),
    path('auth/login/', views.admin_login),
    path('auth/logout/', views.admin_logout),
    path('auth/users/', views.manage_users),
    path('auth/users/<int:user_id>/', views.manage_user_detail),
    path('chat/', views.chat_counsellor),
    # Student Enrollment & Process Tracking
    path('students/enroll/', views.enroll_student),
    path('students/', views.manage_students),
    path('students/<int:pk>/', views.manage_student_detail),
    path('students/<int:student_id>/steps/', views.add_process_step),
    path('steps/<int:step_id>/', views.manage_process_step_detail),
    path('steps/<int:step_id>/payments/', views.add_step_payment),
    path('student-portal/my-profile/', views.student_portal_me),
]

