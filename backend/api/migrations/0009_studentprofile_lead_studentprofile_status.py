# Generated for Phase 1.4 — Student Management
# Adds StudentProfile.lead (nullable FK → Lead) and StudentProfile.status

import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0008_appointment_counsellingnote_followup_task'),
    ]

    operations = [
        # ── StudentProfile.status ─────────────────────────────────────────
        # Safe default 'active' — existing rows get this value automatically
        # via the database DEFAULT; no data migration needed.
        migrations.AddField(
            model_name='studentprofile',
            name='status',
            field=models.CharField(
                max_length=20,
                choices=[
                    ('active',    'Active'),
                    ('on_hold',   'On Hold'),
                    ('graduated', 'Graduated'),
                    ('withdrawn', 'Withdrawn'),
                    ('deferred',  'Deferred'),
                ],
                default='active',
                db_index=True,
            ),
        ),

        # ── StudentProfile.lead ───────────────────────────────────────────
        # Nullable FK — existing students are not linked to any lead.
        # SET_NULL on lead deletion so StudentProfiles survive lead cleanup.
        migrations.AddField(
            model_name='studentprofile',
            name='lead',
            field=models.ForeignKey(
                to='api.Lead',
                on_delete=django.db.models.deletion.SET_NULL,
                null=True,
                blank=True,
                related_name='students',
            ),
        ),
        migrations.AddConstraint(
            model_name='studentprofile',
            constraint=models.UniqueConstraint(
                condition=models.Q(lead__isnull=False),
                fields=('lead',),
                name='unique_student_profile_lead',
            ),
        ),
    ]
