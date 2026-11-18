import api.models
from django.db import migrations, models
import django.db.models.deletion


def backfill_crm_consultancies(apps, schema_editor):
    db = schema_editor.connection.alias
    for model_name in ('CounsellingNote', 'FollowUp', 'Task', 'Appointment'):
        Model = apps.get_model('api', model_name)
        rows = Model.objects.using(db).values_list(
            'pk', 'lead__consultancy_id', 'student__consultancy_id'
        ).iterator()
        for pk, lead_tenant_id, student_tenant_id in rows:
            if lead_tenant_id and student_tenant_id and lead_tenant_id != student_tenant_id:
                raise RuntimeError(
                    f'{model_name} {pk} links records from different consultancies; '
                    'resolve this data conflict before applying tenant ownership.'
                )
            tenant_id = lead_tenant_id or student_tenant_id
            if tenant_id:
                Model.objects.using(db).filter(pk=pk).update(consultancy_id=tenant_id)


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
