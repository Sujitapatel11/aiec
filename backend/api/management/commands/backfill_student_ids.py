from django.core.management.base import BaseCommand
from django.db.models import Q
from api.models import StudentProfile, generate_student_id


class Command(BaseCommand):
    help = 'Backfill missing student_id fields for existing StudentProfile records.'

    def handle(self, *args, **options):
        profiles_without_id = StudentProfile.objects.filter(
            Q(student_id__isnull=True) | Q(student_id='')
        ).order_by('created_at', 'id')

        count = profiles_without_id.count()
        if count == 0:
            self.stdout.write(self.style.SUCCESS('No StudentProfile records missing student_id.'))
            return

        self.stdout.write(f'Found {count} student(s) missing student_id. Backfilling...')
        updated_count = 0
        for profile in profiles_without_id:
            year = profile.enrollment_date.year if profile.enrollment_date else (profile.created_at.year if profile.created_at else 2026)
            profile.student_id = generate_student_id(year=year)
            profile.save(update_fields=['student_id'])
            self.stdout.write(self.style.SUCCESS(f'Assigned {profile.student_id} to student: {profile.full_name} (ID: {profile.id})'))
            updated_count += 1

        self.stdout.write(self.style.SUCCESS(f'Successfully backfilled student_id for {updated_count} student(s).'))
