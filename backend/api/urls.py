from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

router = DefaultRouter()
router.register('leads', views.LeadViewSet)
router.register('countries', views.CountryViewSet)
router.register('courses', views.CourseViewSet)
router.register('counselling-notes', views.CounsellingNoteViewSet)
router.register('follow-ups', views.FollowUpViewSet)
router.register('tasks', views.TaskViewSet)
router.register('appointments', views.AppointmentViewSet)

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
    path('auth/password-reset/', views.request_password_reset),
    path('auth/password-reset-confirm/', views.confirm_password_reset),
    # Admin/Staff-initiated password reset (no email — direct set)
    path('auth/students/<int:student_id>/reset-password/', views.reset_student_password),
    path('auth/staff/<int:user_id>/reset-password/', views.reset_staff_password),
    path('staff/create/', views.create_staff),
    path('chat/', views.chat_counsellor),
    # Student Enrollment & Process Tracking
    path('students/enroll/', views.enroll_student),
    path('students/', views.manage_students),
    path('students/<int:pk>/', views.manage_student_detail),          # GET + PATCH + DELETE
    path('students/<int:student_id>/steps/', views.add_process_step),
    path('steps/<int:step_id>/', views.manage_process_step_detail),
    path('steps/<int:step_id>/payments/', views.add_step_payment),
    path('student-portal/my-profile/', views.student_portal_me),
    # Phase 1.4 — Lead → Student conversion
    path('leads/<int:lead_id>/convert-to-student/', views.convert_lead_to_student),
    # Video Testimonials API
    path('testimonials/video/public/', views.public_video_testimonials),
    path('testimonials/video/', views.manage_video_testimonials),
    path('testimonials/video/upload/', views.upload_video_testimonial),
    path('testimonials/video/<int:pk>/', views.manage_video_testimonial_detail),
    # Student Documents API
    path('documents/upload/', views.upload_student_document),
    path('documents/', views.list_student_documents),
    path('documents/<int:pk>/status/', views.verify_student_document),
    path('documents/<int:pk>/', views.delete_student_document),
    # Phase 2.1 — Student University Applications API
    path('students/<int:student_id>/applications/', views.manage_student_applications),
    path('applications/<int:pk>/', views.manage_application_detail),
    path('applications/<int:application_id>/offers/', views.manage_application_offers),
    path('offers/<int:pk>/', views.manage_offer_detail),
    path('applications/<int:application_id>/visa/', views.manage_application_visa),
    path('visa/<int:pk>/', views.manage_visa_detail),
    path('applications/<int:application_id>/enrollment/', views.manage_application_enrollment),
    path('enrollments/<int:pk>/', views.manage_enrollment_detail),
    path(
        'applications/<int:pk>/workflow-steps/<int:step_id>/complete/',
        views.complete_application_workflow_step,
    ),
]
