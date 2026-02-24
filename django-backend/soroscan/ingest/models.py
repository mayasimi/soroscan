"""
Database models for SoroScan event indexing.
"""
import hashlib
import secrets

from django.contrib.auth import get_user_model
from django.db import models

User = get_user_model()


class Network(models.Model):
    """
    Stellar network configuration (e.g. testnet, mainnet).
    """

    name = models.CharField(
        max_length=64,
        unique=True,
        help_text="Short network name (e.g. 'testnet', 'mainnet')",
    )
    rpc_url = models.URLField(help_text="Soroban RPC URL for this network")
    horizon_url = models.URLField(help_text="Horizon URL for this network")
    network_passphrase = models.CharField(
        max_length=255,
        help_text="Stellar network passphrase for this network",
    )
    is_active = models.BooleanField(
        default=True,
        help_text="Whether this network is actively indexed",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name


class TrackedContract(models.Model):
    """
    Contracts registered for event indexing.
    """

    network = models.ForeignKey(
        Network,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="contracts",
        help_text="Stellar network this contract belongs to",
    )
    contract_id = models.CharField(
        max_length=56,
        unique=True,
        db_index=True,
        help_text="Stellar contract address (C...)",
    )
    name = models.CharField(max_length=100, help_text="Human-readable contract name")
    description = models.TextField(blank=True, help_text="Optional description")
    owner = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="tracked_contracts",
        help_text="User who registered this contract",
    )
    abi_schema = models.JSONField(
        null=True,
        blank=True,
        help_text="Optional ABI/schema for decoding events",
    )
    last_indexed_ledger = models.PositiveBigIntegerField(
        null=True,
        blank=True,
        db_index=True,
        help_text="Last ledger sequence that was indexed for this contract",
    )
    is_active = models.BooleanField(default=True, help_text="Whether indexing is active")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["contract_id", "is_active"]),
        ]

    def __str__(self):
        return f"{self.name} ({self.contract_id[:8]}...)"


class EventSchema(models.Model):
    """
    Versioned JSON schema for contract event types (issue #17).
    """

    contract = models.ForeignKey(
        TrackedContract,
        on_delete=models.CASCADE,
        related_name="event_schemas",
        help_text="Contract this schema applies to",
    )
    version = models.PositiveIntegerField(help_text="Schema version number")
    event_type = models.CharField(
        max_length=128,
        help_text="Event type/name this schema describes",
    )
    json_schema = models.JSONField(help_text="JSON Schema for validating event payloads")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["contract", "version", "event_type"],
                name="ingest_eventschema_contract_version_event_type_uniq",
            )
        ]

    def __str__(self):
        return f"{self.event_type} v{self.version} ({self.contract.name})"


class ContractEvent(models.Model):
    """
    Individual events emitted by tracked contracts.
    """

    contract = models.ForeignKey(
        TrackedContract,
        on_delete=models.CASCADE,
        related_name="events",
        help_text="The contract that emitted this event",
    )
    event_type = models.CharField(
        max_length=100,
        db_index=True,
        help_text="Event type/name (e.g., 'swap', 'transfer')",
    )
    schema_version = models.PositiveIntegerField(
        null=True,
        blank=True,
        help_text="EventSchema version used for validation (if any)",
    )
    validation_status = models.CharField(
        max_length=32,
        choices=[
            ("passed", "Passed"),
            ("failed", "Failed"),
        ],
        default="passed",
        db_index=True,
        help_text="Result of schema validation",
    )
    payload = models.JSONField(help_text="Decoded event payload")
    payload_hash = models.CharField(
        max_length=64,
        db_index=True,
        help_text="SHA-256 hash of the payload",
    )
    ledger = models.PositiveBigIntegerField(
        db_index=True,
        help_text="Ledger sequence number",
    )
    event_index = models.PositiveIntegerField(
        default=0,
        help_text="0-based event index within the ledger",
    )
    timestamp = models.DateTimeField(db_index=True, help_text="Event timestamp")
    tx_hash = models.CharField(max_length=64, help_text="Transaction hash")
    raw_xdr = models.TextField(blank=True, help_text="Raw XDR for debugging")

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["contract", "event_type", "timestamp"]),
            models.Index(fields=["ledger"]),
            models.Index(fields=["tx_hash"]),
            models.Index(fields=["contract", "ledger", "event_index"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["contract", "ledger", "event_index"],
                name="unique_contract_ledger_event_index",
            ),
        ]

    def __str__(self):
        return f"{self.event_type}@{self.ledger} ({self.contract.name})"

    def save(self, *args, **kwargs):
        # Auto-compute payload hash if not set
        if not self.payload_hash and self.payload:
            payload_bytes = str(self.payload).encode("utf-8")
            self.payload_hash = hashlib.sha256(payload_bytes).hexdigest()
        super().save(*args, **kwargs)


class WebhookSubscription(models.Model):
    """
    Webhook subscriptions for push notifications on specific events.
    """

    STATUS_ACTIVE = "active"
    STATUS_SUSPENDED = "suspended"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_SUSPENDED, "Suspended"),
    ]

    contract = models.ForeignKey(
        TrackedContract,
        on_delete=models.CASCADE,
        related_name="webhooks",
        help_text="Contract to monitor",
    )
    event_type = models.CharField(
        max_length=100,
        blank=True,
        help_text="Event type filter (blank = all events)",
    )
    target_url = models.URLField(help_text="URL to POST event data to")
    secret = models.CharField(
        max_length=64,
        help_text="HMAC secret — stored as a hex token, never logged or exposed via API",
    )
    is_active = models.BooleanField(default=True)
    status = models.CharField(
        max_length=16,
        choices=STATUS_CHOICES,
        default=STATUS_ACTIVE,
        db_index=True,
        help_text="Lifecycle state: active dispatches events; suspended has exhausted all retries",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    last_triggered = models.DateTimeField(null=True, blank=True)
    failure_count = models.PositiveIntegerField(default=0)

    class Meta:
        ordering = ["-created_at"]

    def __str__(self):
        return f"Webhook -> {self.target_url} ({self.contract.name})"

    def save(self, *args, **kwargs):
        # Auto-generate secret if not set
        if not self.secret:
            self.secret = secrets.token_hex(32)
        super().save(*args, **kwargs)


class WebhookDeliveryLog(models.Model):
    """
    Immutable audit log for every webhook dispatch attempt.

    Records are subject to a 30-day TTL: the ``cleanup_webhook_delivery_logs``
    Celery task (scheduled via Celery Beat) prunes entries older than 30 days.
    """

    subscription = models.ForeignKey(
        WebhookSubscription,
        on_delete=models.CASCADE,
        related_name="delivery_logs",
        help_text="Subscription this attempt belongs to",
    )
    event = models.ForeignKey(
        "ContractEvent",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="delivery_logs",
        help_text="ContractEvent that triggered this delivery",
    )
    attempt_number = models.PositiveIntegerField(
        default=1,
        help_text="1-based attempt counter (1 = first try, 2 = first retry, …)",
    )
    status_code = models.IntegerField(
        null=True,
        blank=True,
        help_text="HTTP status code returned by the subscriber, or null for network errors",
    )
    success = models.BooleanField(
        default=False,
        db_index=True,
        help_text="True when subscriber returned a 2xx response",
    )
    error = models.TextField(
        blank=True,
        help_text="Error detail when success=False",
    )
    timestamp = models.DateTimeField(
        auto_now_add=True,
        db_index=True,
        help_text="UTC timestamp of this attempt",
    )

    class Meta:
        ordering = ["-timestamp"]
        indexes = [
            models.Index(fields=["subscription", "timestamp"]),
        ]

    def __str__(self):
        status_label = "OK" if self.success else f"FAIL({self.status_code})"
        return f"Delivery #{self.attempt_number} [{status_label}] sub={self.subscription_id}"


class IndexerState(models.Model):
    """
    Tracks the current indexing state (cursor position).
    """

    key = models.CharField(max_length=50, unique=True, primary_key=True)
    value = models.CharField(max_length=200)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.key}: {self.value}"
