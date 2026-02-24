"""
Celery tasks for SoroScan background processing.
"""
import hashlib
import hmac
import json
import logging
from datetime import datetime, timedelta, timezone as dt_timezone
from typing import Any

import jsonschema
import requests
from celery import shared_task
from django.db.models import F
from django.utils import timezone

from .models import (
    ContractEvent,
    EventSchema,
    IndexerState,
    Network,
    TrackedContract,
    WebhookSubscription,
)
from .stellar_client import SorobanClient

logger = logging.getLogger(__name__)
BATCH_LEDGER_SIZE = 200


def _event_attr(event: Any, *names: str, default: Any = None) -> Any:
    for name in names:
        if hasattr(event, name):
            return getattr(event, name)
        if isinstance(event, dict) and name in event:
            return event[name]
    return default


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _extract_event_index(event: Any, fallback_index: int = 0) -> int:
    direct_index = _event_attr(event, "event_index", "index")
    if direct_index is not None:
        return _safe_int(direct_index, fallback_index)

    identifier = str(_event_attr(event, "id", "paging_token", default="") or "")
    if "-" in identifier:
        maybe_index = identifier.rsplit("-", maxsplit=1)[-1]
        if maybe_index.isdigit():
            return int(maybe_index)

    return fallback_index


def _upsert_contract_event(
    contract: TrackedContract,
    event: Any,
    fallback_event_index: int = 0,
) -> tuple[ContractEvent, bool]:
    ledger = _safe_int(_event_attr(event, "ledger", "ledger_sequence"), default=0)
    event_index = _extract_event_index(event, fallback_event_index)
    tx_hash = str(_event_attr(event, "tx_hash", "transaction_hash", default="") or "")
    event_type = str(_event_attr(event, "type", "event_type", default="unknown") or "unknown")
    payload = _event_attr(event, "value", "payload", default={}) or {}
    raw_xdr = str(_event_attr(event, "xdr", "raw_xdr", default="") or "")

    timestamp = _event_attr(event, "timestamp", default=timezone.now())
    if isinstance(timestamp, datetime) and timezone.is_naive(timestamp):
        timestamp = timezone.make_aware(timestamp, dt_timezone.utc)
    if not isinstance(timestamp, datetime):
        timestamp = timezone.now()

    return ContractEvent.objects.update_or_create(
        contract=contract,
        ledger=ledger,
        event_index=event_index,
        defaults={
            "tx_hash": tx_hash,
            "event_type": event_type,
            "payload": payload,
            "timestamp": timestamp,
            "raw_xdr": raw_xdr,
        },
    )


def validate_event_payload(
    contract: TrackedContract,
    event_type: str,
    payload: dict[str, Any],
    ledger: int | None = None,
) -> tuple[bool, int | None]:
    """
    Validate event payload against the latest EventSchema for this contract+event_type.

    Returns:
        (passed, version_used): passed is True if no schema exists or validation succeeded;
        version_used is the EventSchema.version used, or None if no schema.
    """
    if payload is None or not isinstance(payload, dict):
        return (True, None)
    schema = (
        EventSchema.objects.filter(
            contract=contract,
            event_type=event_type,
        )
        .order_by("-version")
        .first()
    )
    if schema is None:
        return (True, None)
    try:
        jsonschema.validate(instance=payload, schema=schema.json_schema)
        return (True, schema.version)
    except jsonschema.ValidationError:
        logger.warning(
            "Event payload schema validation failed for contract_id=%s event_type=%s ledger=%s",
            contract.contract_id,
            event_type,
            ledger,
            extra={
                "contract_id": contract.contract_id,
                "event_type": event_type,
                "ledger": ledger,
            },
        )
        return (False, schema.version)


@shared_task(
    bind=True,
    autoretry_for=(requests.exceptions.RequestException,),
    retry_backoff=True,
    retry_backoff_max=600,
    max_retries=5,
)
def dispatch_webhook(self, subscription_id: int, event_id: int) -> bool:
    """
    Deliver a single ContractEvent to a WebhookSubscription endpoint.

    Retry strategy
    ~~~~~~~~~~~~~~
    Celery auto-retries on any ``requests.RequestException`` with exponential
    backoff (cap 600 s, up to 5 retries).  On HTTP 429 the ``Retry-After``
    response header is honoured.  Every attempt — success or failure — is
    written to ``WebhookDeliveryLog``.  After all 5 retries are exhausted the
    subscription is marked ``suspended`` and ``is_active`` set to ``False`` so
    it is excluded from future dispatches.

    HMAC signing
    ~~~~~~~~~~~~
    Every request carries ``X-SoroScan-Signature: sha256=<hmac_hex>`` where
    the HMAC is computed over the JSON-serialised (sorted-keys) event payload
    using the subscription's secret.  The secret is never logged.

    Args:
        subscription_id: PK of the ``WebhookSubscription`` to deliver to.
        event_id: PK of the ``ContractEvent`` being delivered.

    Returns:
        ``True`` on successful delivery, ``False`` when the subscription is
        absent/inactive (no retry in that case).
    """
    # ------------------------------------------------------------------ #
    # 1. Fetch subscription — skip silently if gone / inactive / suspended #
    # ------------------------------------------------------------------ #
    try:
        webhook = WebhookSubscription.objects.get(
            id=subscription_id,
            is_active=True,
            status=WebhookSubscription.STATUS_ACTIVE,
        )
    except WebhookSubscription.DoesNotExist:
        logger.warning(
            "Webhook subscription %s not found, inactive, or suspended — skipping",
            subscription_id,
            extra={"webhook_id": subscription_id},
        )
        return False

    # ------------------------------------------------------------------ #
    # 2. Fetch event                                                        #
    # ------------------------------------------------------------------ #
    try:
        event = ContractEvent.objects.select_related("contract").get(id=event_id)
    except ContractEvent.DoesNotExist:
        logger.warning(
            "ContractEvent %s not found — skipping dispatch for subscription %s",
            event_id,
            subscription_id,
            extra={"event_id": event_id, "webhook_id": subscription_id},
        )
        return False

    # ------------------------------------------------------------------ #
    # 3. Build payload & HMAC-SHA256 signature                             #
    # ------------------------------------------------------------------ #
    event_data = {
        "contract_id": event.contract.contract_id,
        "event_type": event.event_type,
        "payload": event.payload,
        "ledger": event.ledger,
        "event_index": event.event_index,
        "tx_hash": event.tx_hash,
    }
    payload_bytes = json.dumps(event_data, sort_keys=True).encode("utf-8")
    sig_hex = hmac.new(
        webhook.secret.encode("utf-8"),
        msg=payload_bytes,
        digestmod=hashlib.sha256,
    ).hexdigest()

    headers = {
        "Content-Type": "application/json",
        "X-SoroScan-Signature": f"sha256={sig_hex}",
        "X-SoroScan-Timestamp": timezone.now().isoformat(),
    }

    attempt_number = self.request.retries + 1
    attempt_logged = False  # guard against double-logging

    # ------------------------------------------------------------------ #
    # 4. Deliver                                                           #
    # ------------------------------------------------------------------ #
    try:
        response = requests.post(
            webhook.target_url,
            data=payload_bytes,
            headers=headers,
            timeout=10,
        )
        status_code = response.status_code

        # -- 429: respect Retry-After header, then retry ---------------
        if status_code == 429:
            error_msg = "Rate limited by subscriber (429)"
            _log_delivery_attempt(webhook, event, attempt_number, status_code, False, error_msg)
            attempt_logged = True
            _on_delivery_failure(webhook, self)

            countdown: int | None = None
            retry_after = response.headers.get("Retry-After")
            if retry_after:
                try:
                    countdown = int(retry_after)
                except (ValueError, TypeError):
                    pass

            raise self.retry(
                exc=requests.HTTPError("Rate limited (429)", response=response),
                countdown=countdown,
            )

        # -- 2xx: success (treat any 2xx as success, even malformed body) --
        success = 200 <= status_code < 300
        error_msg = "" if success else f"HTTP {status_code}"

        _log_delivery_attempt(webhook, event, attempt_number, status_code, success, error_msg)
        attempt_logged = True

        if success:
            WebhookSubscription.objects.filter(pk=webhook.pk).update(
                failure_count=0,
                last_triggered=timezone.now(),
            )
            logger.info(
                "Webhook %s delivered successfully (attempt %s)",
                subscription_id,
                attempt_number,
                extra={"webhook_id": subscription_id},
            )
            return True

        # -- non-2xx, non-429: raise to trigger autoretry ---------------
        _on_delivery_failure(webhook, self)
        response.raise_for_status()  # raises HTTPError → caught by autoretry_for

    except requests.RequestException as exc:
        # Network-level error (timeout, connection refused, etc.) only reaches
        # here when raise_for_status() fires AND attempt was already logged, OR
        # for genuine network errors.  The attempt_logged flag prevents
        # duplicate records.
        if not attempt_logged:
            _log_delivery_attempt(webhook, event, attempt_number, None, False, str(exc))
            _on_delivery_failure(webhook, self)

        logger.warning(
            "Webhook %s dispatch failed (attempt %s/%s): %s",
            subscription_id,
            attempt_number,
            self.max_retries + 1,
            exc,
            extra={"webhook_id": subscription_id},
        )
        raise  # re-raise so autoretry_for can schedule the next attempt

    return False  # unreachable — satisfies type checker


# ---------------------------------------------------------------------------
# Private helpers for dispatch_webhook
# ---------------------------------------------------------------------------

def _log_delivery_attempt(
    webhook: WebhookSubscription,
    event: ContractEvent,
    attempt_number: int,
    status_code: int | None,
    success: bool,
    error: str,
) -> None:
    """Create a ``WebhookDeliveryLog`` record for one dispatch attempt."""
    from .models import WebhookDeliveryLog

    WebhookDeliveryLog.objects.create(
        subscription=webhook,
        event=event,
        attempt_number=attempt_number,
        status_code=status_code,
        success=success,
        error=error,
    )


def _on_delivery_failure(
    webhook: WebhookSubscription,
    task_instance,
) -> None:
    """
    Atomically increment ``failure_count`` and, when all retries are exhausted,
    mark the subscription as ``suspended`` + ``is_active=False``.
    """
    WebhookSubscription.objects.filter(pk=webhook.pk).update(
        failure_count=F("failure_count") + 1,
    )

    is_last_attempt = task_instance.request.retries >= task_instance.max_retries
    if is_last_attempt:
        WebhookSubscription.objects.filter(pk=webhook.pk).update(
            status=WebhookSubscription.STATUS_SUSPENDED,
            is_active=False,
        )
        logger.error(
            "Webhook subscription %s suspended after %d consecutive failures",
            webhook.id,
            task_instance.max_retries + 1,
            extra={"webhook_id": webhook.id},
        )


@shared_task
def cleanup_webhook_delivery_logs() -> int:
    """
    Prune ``WebhookDeliveryLog`` entries older than 30 days (TTL cleanup).

    Schedule via Celery Beat, e.g. daily.  Returns the number of deleted rows.
    """
    from .models import WebhookDeliveryLog

    cutoff = timezone.now() - timedelta(days=30)
    deleted_count, _ = WebhookDeliveryLog.objects.filter(timestamp__lt=cutoff).delete()
    logger.info(
        "Pruned %d WebhookDeliveryLog entries older than 30 days",
        deleted_count,
        extra={},
    )
    return deleted_count


@shared_task
def process_new_event(event_data: dict[str, Any]) -> None:
    """
    Process a newly indexed event and trigger webhooks.

    Args:
        event_data: Decoded event data from the ledger
    """
    from asgiref.sync import async_to_sync
    from channels.layers import get_channel_layer

    contract_id = event_data.get("contract_id")
    event_type = event_data.get("event_type")

    if not contract_id:
        logger.warning("Event missing contract_id", extra={})
        return

    # Publish to WebSocket channel layer
    channel_layer = get_channel_layer()
    if channel_layer:
        try:
            async_to_sync(channel_layer.group_send)(
                f"events_{contract_id}",
                {
                    "type": "contract_event",
                    "data": event_data,
                },
            )
        except Exception as e:
            logger.error(
                "Failed to publish event to channel layer: %s",
                e,
                extra={"contract_id": contract_id},
            )

    # Find matching active (non-suspended) webhooks
    webhooks = WebhookSubscription.objects.filter(
        contract__contract_id=contract_id,
        is_active=True,
        status=WebhookSubscription.STATUS_ACTIVE,
    ).filter(
        # Match specific event type or all events (blank event_type)
        event_type__in=[event_type, ""]
    )

    if not webhooks.exists():
        logger.info(
            "No active webhooks for contract %s event_type %s",
            contract_id,
            event_type,
            extra={"contract_id": contract_id},
        )
        return

    # Resolve the ContractEvent DB row so dispatch_webhook receives its PK
    ledger = event_data.get("ledger")
    event_index = event_data.get("event_index", 0)
    event_obj = None
    if ledger is not None:
        try:
            event_obj = ContractEvent.objects.get(
                contract__contract_id=contract_id,
                ledger=ledger,
                event_index=event_index,
            )
        except ContractEvent.DoesNotExist:
            logger.warning(
                "ContractEvent not found for contract=%s ledger=%s index=%s — skipping webhook dispatch",
                contract_id,
                ledger,
                event_index,
                extra={"contract_id": contract_id},
            )
            return

    if event_obj is None:
        logger.warning(
            "No ledger/event_index in event_data — cannot dispatch webhooks",
            extra={"contract_id": contract_id},
        )
        return

    # Dispatch to all matching webhooks
    dispatched = 0
    for webhook in webhooks:
        dispatch_webhook.delay(webhook.id, event_obj.id)
        dispatched += 1

    logger.info(
        "Dispatched event to %s webhooks",
        dispatched,
        extra={"contract_id": contract_id},
    )


@shared_task
def sync_events_from_horizon() -> int:
    """
    Sync events from Horizon/Soroban RPC.

    This task runs periodically to fetch new events from the ledger
    and store them in the database.

    Returns:
        Number of new events indexed
    """
    from stellar_sdk import SorobanServer

    total_new_events = 0

    try:
        for network in Network.objects.filter(is_active=True):
            cursor_key = f"horizon_cursor:{network.name}"
            cursor_state, _ = IndexerState.objects.get_or_create(
                key=cursor_key,
                defaults={"value": "now"},
            )
            cursor = cursor_state.value

            server = SorobanServer(network.rpc_url)

            contract_ids = list(
                TrackedContract.objects.filter(is_active=True, network=network).values_list(
                    "contract_id", flat=True
                )
            )
            if not contract_ids:
                logger.info(
                    "No active contracts to index for network",
                    extra={"network": network.name},
                )
                continue

            events_response = server.get_events(
                start_ledger=int(cursor) if cursor.isdigit() else None,
                filters=[
                    {
                        "type": "contract",
                        "contractIds": contract_ids,
                    }
                ],
                pagination={"limit": 100},
            )

            network_new_events = 0
            last_ledger = None

            for fallback_event_index, event in enumerate(events_response.events):
                try:
                    contract = TrackedContract.objects.get(
                        contract_id=event.contract_id, network=network
                    )
                except TrackedContract.DoesNotExist:
                    continue

                payload = event.value
                passed, version_used = validate_event_payload(
                    contract, event.type, payload, ledger=event.ledger
                )
                validation_status = "passed" if passed else "failed"
                schema_version = version_used

                event_record, created = ContractEvent.objects.get_or_create(
                    tx_hash=event.tx_hash,
                    ledger=event.ledger,
                    event_type=event.type,
                    defaults={
                        "contract": contract,
                        "payload": payload,
                        "timestamp": timezone.now(),
                        "raw_xdr": event.xdr if hasattr(event, "xdr") else "",
                        "validation_status": validation_status,
                        "schema_version": schema_version,
                    },
                )
                if not created and (
                    event_record.validation_status != validation_status
                    or event_record.schema_version != schema_version
                ):
                    event_record.validation_status = validation_status
                    event_record.schema_version = schema_version
                    event_record.save(update_fields=["validation_status", "schema_version"])

                if created:
                    network_new_events += 1
                    process_new_event.delay(
                        {
                            "contract_id": contract.contract_id,
                            "event_type": event_record.event_type,
                            "payload": event_record.payload,
                            "ledger": event_record.ledger,
                            "event_index": event_record.event_index,
                            "tx_hash": event_record.tx_hash,
                        }
                    )

                if contract.last_indexed_ledger is None or event_record.ledger > contract.last_indexed_ledger:
                    contract.last_indexed_ledger = event_record.ledger
                    contract.save(update_fields=["last_indexed_ledger"])

                last_ledger = event_record.ledger

            if last_ledger is not None:
                cursor_state.value = str(last_ledger)
                cursor_state.save()

            logger.info(
                "Indexed %s new events for network %s",
                network_new_events,
                network.name,
                extra={"network": network.name, "ledger_sequence": last_ledger},
            )
            total_new_events += network_new_events

        return total_new_events

    except Exception:
        logger.exception("Failed to sync events from Horizon", extra={})
        return 0


@shared_task(bind=True, queue="backfill", max_retries=3, default_retry_delay=60)
def backfill_contract_events(
    self,
    contract_id: str,
    from_ledger: int,
    to_ledger: int,
) -> dict[str, Any]:
    """
    Backfill events for one contract within an inclusive ledger range.
    """
    start_ledger = _safe_int(from_ledger, default=0)
    end_ledger = _safe_int(to_ledger, default=0)

    if start_ledger <= 0 or end_ledger <= 0 or start_ledger > end_ledger:
        raise ValueError("Invalid ledger range provided")

    try:
        contract = TrackedContract.objects.select_related("network").get(contract_id=contract_id)
    except TrackedContract.DoesNotExist as exc:
        raise ValueError(f"Tracked contract not found: {contract_id}") from exc

    next_ledger = start_ledger
    if contract.last_indexed_ledger is not None:
        next_ledger = max(next_ledger, contract.last_indexed_ledger + 1)

    client = SorobanClient(
        rpc_url=contract.network.rpc_url if contract.network_id else None,
        network_passphrase=contract.network.network_passphrase if contract.network_id else None,
    )
    processed_events = 0
    created_events = 0
    updated_events = 0

    try:
        for batch_start in range(next_ledger, end_ledger + 1, BATCH_LEDGER_SIZE):
            batch_end = min(batch_start + BATCH_LEDGER_SIZE - 1, end_ledger)
            batch_events = client.get_events_range(contract.contract_id, batch_start, batch_end)

            if not batch_events:
                logger.warning(
                    "No events returned for contract=%s ledgers=%s-%s",
                    contract.contract_id,
                    batch_start,
                    batch_end,
                )

            for fallback_event_index, event in enumerate(batch_events):
                _, created = _upsert_contract_event(contract, event, fallback_event_index)
                processed_events += 1
                if created:
                    created_events += 1
                else:
                    updated_events += 1

            contract.last_indexed_ledger = batch_end
            contract.save(update_fields=["last_indexed_ledger"])

        return {
            "contract_id": contract.contract_id,
            "from_ledger": start_ledger,
            "to_ledger": end_ledger,
            "last_indexed_ledger": contract.last_indexed_ledger,
            "processed_events": processed_events,
            "created_events": created_events,
            "updated_events": updated_events,
        }
    except Exception as exc:
        logger.exception(
            "Backfill failed for contract=%s range=%s-%s",
            contract.contract_id,
            start_ledger,
            end_ledger,
        )
        raise self.retry(exc=exc)
