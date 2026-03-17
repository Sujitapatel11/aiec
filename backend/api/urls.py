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
]
