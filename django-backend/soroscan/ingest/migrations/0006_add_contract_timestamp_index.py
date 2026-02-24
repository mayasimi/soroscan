from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ingest", "0005_add_webhookdeliverylog_and_suspended_status"),
    ]

    operations = [
        migrations.AddIndex(
            model_name="contractevent",
            index=models.Index(
                fields=["contract", "timestamp"],
                name="ingest_cont_contrac_timest_idx",
            ),
        ),
    ]
