import django.db.models.deletion
import api.models
from django.conf import settings
from django.db import migrations, models


def assign_legacy_records_to_aiec(apps, schema_editor):
    Consultancy = apps.get_model('api', 'Consultancy')
    ConsultancyMembership = apps.get_model('api', 'ConsultancyMembership')
    Lead = apps.get_model('api', 'Lead')
    StudentProfile = apps.get_model('api', 'StudentProfile')
    User = apps.get_model(*settings.AUTH_USER_MODEL.split('.'))
    db = schema_editor.connection.alias

    consultancy, _ = Consultancy.objects.using(db).get_or_create(
        slug='aiec',
        defaults={'name': 'Aaradhya International Education Consultancy'},
    )
    Lead.objects.using(db).filter(consultancy__isnull=True).update(consultancy=consultancy)
    StudentProfile.objects.using(db).filter(consultancy__isnull=True).update(consultancy=consultancy)

    # Existing AIEC administrators and staff are explicitly members of the
    # bootstrap tenant; no global staff access is implicitly granted later.
    for user in User.objects.using(db).filter(is_active=True).filter(
        models.Q(is_staff=True) | models.Q(is_superuser=True)
    ).iterator():
        role = 'owner' if user.is_superuser else ('admin' if user.is_staff else 'staff')
        ConsultancyMembership.objects.using(db).get_or_create(
            consultancy_id=consultancy.pk,
            user_id=user.pk,
            defaults={'role': role, 'is_active': True},
        )


class Migration(migrations.Migration):
    dependencies = [
        ('api', '0015_applicationtimelineevent'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='Consultancy',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200)),
                ('slug', models.SlugField(max_length=80, unique=True)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={'ordering': ['name', 'id']},
        ),
        migrations.CreateModel(
            name='ConsultancyMembership',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('role', models.CharField(choices=[('owner', 'Owner'), ('admin', 'Admin'), ('staff', 'Staff')], default='staff', max_length=20)),
                ('is_active', models.BooleanField(default=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('consultancy', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='memberships', to='api.consultancy')),
                ('user', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='consultancy_memberships', to=settings.AUTH_USER_MODEL)),
            ],
            options={'ordering': ['consultancy__name', 'user__username']},
        ),
        migrations.AddConstraint(
            model_name='consultancymembership',
            constraint=models.UniqueConstraint(fields=('consultancy', 'user'), name='uniq_consultancy_user_membership'),
        ),
        migrations.AddField(
            model_name='lead',
            name='consultancy',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name='leads', to='api.consultancy'),
        ),
        migrations.AddField(
            model_name='studentprofile',
            name='consultancy',
            field=models.ForeignKey(null=True, on_delete=django.db.models.deletion.PROTECT, related_name='students', to='api.consultancy'),
        ),
        migrations.RunPython(assign_legacy_records_to_aiec, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='lead',
            name='consultancy',
            field=models.ForeignKey(default=api.models.get_default_consultancy, on_delete=django.db.models.deletion.PROTECT, related_name='leads', to='api.consultancy'),
        ),
        migrations.AlterField(
            model_name='studentprofile',
            name='consultancy',
            field=models.ForeignKey(default=__import__('api.models', fromlist=['get_default_consultancy']).get_default_consultancy, on_delete=django.db.models.deletion.PROTECT, related_name='students', to='api.consultancy'),
        ),
    ]
