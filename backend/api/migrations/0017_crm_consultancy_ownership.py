import api.models
from django.db import migrations, models
import django.db.models.deletion


def backfill_crm_consultancies(apps, schema_editor):
    db = schema_editor.connection.alias
    for model_name in ('CounsellingNote', 'FollowUp', 'Task', 'Appointment'):
        Model = apps.get_model('api', model_name)
        Model.objects.using(db).filter(lead__isnull=False).update(
            consultancy_id=models.F('lead__consultancy_id')
        )
        Model.objects.using(db).filter(
            lead__isnull=True, student__isnull=False
        ).update(consultancy_id=models.F('student__consultancy_id'))


class Migration(migrations.Migration):
    dependencies = [('api', '0016_consultancy_tenancy')]
    operations = [
        migrations.AddField(
            model_name='counsellingnote',
            name='consultancy',
            field=models.ForeignKey(default=api.models.get_default_consultancy, on_delete=django.db.models.deletion.PROTECT, related_name='counsellingnote_records', to='api.consultancy'),
        ),
        migrations.AddField(
            model_name='followup',
            name='consultancy',
            field=models.ForeignKey(default=api.models.get_default_consultancy, on_delete=django.db.models.deletion.PROTECT, related_name='followup_records', to='api.consultancy'),
        ),
        migrations.AddField(
            model_name='task',
            name='consultancy',
            field=models.ForeignKey(default=api.models.get_default_consultancy, on_delete=django.db.models.deletion.PROTECT, related_name='task_records', to='api.consultancy'),
        ),
        migrations.AddField(
            model_name='appointment',
            name='consultancy',
            field=models.ForeignKey(default=api.models.get_default_consultancy, on_delete=django.db.models.deletion.PROTECT, related_name='appointment_records', to='api.consultancy'),
        ),
        migrations.RunPython(backfill_crm_consultancies, migrations.RunPython.noop),
    ]
