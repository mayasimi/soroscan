"""
Migration: add AdminAuditLog model for tracking Django Admin CRUD actions.
"""
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("ingest", "0036_trackedcontract_network"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="AdminAuditLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("create", "Create"),
                            ("update", "Update"),
                            ("delete", "Delete"),
                        ],
                        db_index=True,
                        help_text="Type of admin action performed",
                        max_length=16,
                    ),
                ),
                (
                    "object_repr",
                    models.CharField(
                        help_text="String representation of the affected object",
                        max_length=200,
                    ),
                ),
                (
                    "object_id",
                    models.CharField(
                        db_index=True,
                        help_text="Primary key of the affected object",
                        max_length=255,
                    ),
                ),
                (
                    "content_type",
                    models.CharField(
                        db_index=True,
                        help_text="app_label.model_name of the affected object",
                        max_length=100,
                    ),
                ),
                (
                    "changes",
                    models.JSONField(
                        default=dict,
                        help_text="Field-level changes: {field: [old, new]} for updates",
                    ),
                ),
                (
                    "ip_address",
                    models.GenericIPAddressField(
                        blank=True,
                        help_text="IP address of the admin user",
                        null=True,
                    ),
                ),
                (
                    "timestamp",
                    models.DateTimeField(auto_now_add=True, db_index=True),
                ),
                (
                    "user",
                    models.ForeignKey(
                        blank=True,
                        help_text="Admin user who performed the action",
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="admin_audit_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "verbose_name": "Admin Audit Log",
                "verbose_name_plural": "Admin Audit Logs",
                "ordering": ["-timestamp"],
            },
        ),
        migrations.AddIndex(
            model_name="adminauditlog",
            index=models.Index(
                fields=["action", "timestamp"],
                name="ingest_adminauditlog_action_ts_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="adminauditlog",
            index=models.Index(
                fields=["content_type", "object_id"],
                name="ingest_adminauditlog_ct_obj_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="adminauditlog",
            index=models.Index(
                fields=["user", "timestamp"],
                name="ingest_adminauditlog_user_ts_idx",
            ),
        ),
    ]
