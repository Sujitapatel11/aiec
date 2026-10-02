from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('api', '0009_studentprofile_lead_studentprofile_status'),
    ]

    operations = [
        migrations.AlterField(
            model_name='leadactivity',
            name='activity_type',
            field=models.CharField(
                choices=[
                    ('note', 'Note'),
                    ('call', 'Call'),
                    ('whatsapp', 'WhatsApp'),
                    ('status_change', 'Status Change'),
                    ('assignment', 'Assignment'),
                    ('followup', 'Follow-up'),
                    ('counselling_note', 'Counselling Note'),
                    ('task', 'Task'),
                    ('appointment', 'Appointment'),
                ],
                default='note',
                max_length=50,
            ),
        ),
    ]