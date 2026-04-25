from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("ingest", "0034_contractsource_contractverification"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(choices=[("create", "Create"), ("update", "Update"), ("delete", "Delete")], db_index=True, max_length=16)),
                ("model_name", models.CharField(db_index=True, help_text="Django model class name", max_length=64)),
                ("object_id", models.CharField(db_index=True, max_length=255)),
                ("changes", models.JSONField(default=dict, help_text="Before/after values for mutations")),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("timestamp", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-timestamp"]},
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["model_name", "object_id", "timestamp"], name="ingest_audi_model_n_idx"),
        ),
        migrations.AddIndex(
            model_name="auditlog",
            index=models.Index(fields=["user", "timestamp"], name="ingest_audi_user_ts_idx"),
        ),
        migrations.CreateModel(
            name="PIIField",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("event_type", models.CharField(blank=True, help_text="Event type containing this field (blank = all event types)", max_length=128)),
                ("field_path", models.CharField(help_text="Dot-notation path to the PII field in the payload (e.g. 'user.email')", max_length=256)),
                ("description", models.CharField(blank=True, max_length=256)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("contract", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="pii_fields", to="ingest.trackedcontract")),
            ],
            options={"ordering": ["contract", "field_path"]},
        ),
        migrations.AddConstraint(
            model_name="piifield",
            constraint=models.UniqueConstraint(fields=["contract", "event_type", "field_path"], name="unique_pii_contract_event_field"),
        ),
        migrations.CreateModel(
            name="DataDeletionRequest",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("subject_identifier", models.CharField(db_index=True, help_text="Identifier of the data subject (e.g. wallet address, user ID)", max_length=256)),
                ("status", models.CharField(choices=[("pending", "Pending"), ("processing", "Processing"), ("completed", "Completed"), ("failed", "Failed")], db_index=True, default="pending", max_length=16)),
                ("events_deleted", models.PositiveIntegerField(default=0, help_text="Number of event records deleted or scrubbed")),
                ("error_message", models.TextField(blank=True)),
                ("requested_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("requested_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="deletion_requests", to=settings.AUTH_USER_MODEL)),
                ("contracts", models.ManyToManyField(blank=True, related_name="deletion_requests", to="ingest.trackedcontract")),
            ],
            options={"ordering": ["-requested_at"]},
        ),
        migrations.AddIndex(
            model_name="datadeletionrequest",
            index=models.Index(fields=["status", "requested_at"], name="ingest_data_status_idx"),
        ),
        migrations.CreateModel(
            name="ContractDeployment",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("bytecode_hash", models.CharField(db_index=True, help_text="SHA256 hash of the deployed WASM bytecode", max_length=64)),
                ("ledger_deployed", models.PositiveBigIntegerField(db_index=True, help_text="Ledger sequence at which this deployment was observed")),
                ("deployer_address", models.CharField(blank=True, db_index=True, help_text="Stellar account that deployed/upgraded the contract", max_length=56)),
                ("is_upgrade", models.BooleanField(db_index=True, default=False, help_text="True when this deployment replaced a previous bytecode hash")),
                ("tx_hash", models.CharField(blank=True, help_text="Deployment transaction hash", max_length=64)),
                ("notes", models.TextField(blank=True)),
                ("detected_at", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("contract", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="deployments", to="ingest.trackedcontract")),
            ],
            options={"ordering": ["-ledger_deployed"]},
        ),
        migrations.AddIndex(
            model_name="contractdeployment",
            index=models.Index(fields=["contract", "ledger_deployed"], name="ingest_cont_deploy_ledger_idx"),
        ),
        migrations.AddIndex(
            model_name="contractdeployment",
            index=models.Index(fields=["bytecode_hash"], name="ingest_cont_bytecode_idx"),
        ),
        migrations.AddConstraint(
            model_name="contractdeployment",
            constraint=models.UniqueConstraint(fields=["contract", "bytecode_hash", "ledger_deployed"], name="unique_contract_bytecode_ledger"),
        ),
        migrations.CreateModel(
            name="ContractABIVersion",
            fields=[
                ("id", models.AutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("version_number", models.PositiveIntegerField(help_text="Monotonically increasing version counter per contract")),
                ("abi_json", models.JSONField(help_text="ABI definition for this version")),
                ("valid_from_ledger", models.PositiveBigIntegerField(db_index=True, help_text="First ledger where this ABI applies")),
                ("valid_to_ledger", models.PositiveBigIntegerField(blank=True, db_index=True, help_text="Last ledger where this ABI applies (null = still current)", null=True)),
                ("has_breaking_changes", models.BooleanField(default=False, help_text="True if this ABI is incompatible with the previous version")),
                ("breaking_change_details", models.TextField(blank=True, help_text="Description of breaking changes detected")),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("contract", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="abi_versions", to="ingest.trackedcontract")),
                ("deployment", models.OneToOneField(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="abi_version", to="ingest.contractdeployment")),
            ],
            options={"ordering": ["-version_number"]},
        ),
        migrations.AddConstraint(
            model_name="contractabiversion",
            constraint=models.UniqueConstraint(fields=["contract", "version_number"], name="unique_contract_abi_version"),
        ),
        migrations.AddIndex(
            model_name="contractabiversion",
            index=models.Index(fields=["contract", "valid_from_ledger"], name="ingest_cont_abi_ledger_idx"),
        ),
    ]
