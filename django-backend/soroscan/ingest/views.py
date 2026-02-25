"""
API Views for SoroScan event ingestion.
"""
import hashlib
import hmac
import json
import logging

from django.conf import settings
from django.db.models import Count, Max
from django.shortcuts import get_object_or_404, redirect
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
from drf_spectacular.utils import extend_schema, inline_serializer
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action, api_view, permission_classes, throttle_classes
from rest_framework.filters import OrderingFilter, SearchFilter
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle, UserRateThrottle

import requests as http_requests

from soroscan.throttles import IngestRateThrottle

from .models import ContractEvent, TrackedContract, WebhookSubscription
from .serializers import (
    ContractEventSerializer,
    RecordEventRequestSerializer,
    TrackedContractSerializer,
    WebhookSubscriptionSerializer,
)
from .stellar_client import SorobanClient

logger = logging.getLogger(__name__)


def _frontend_base_url() -> str:
    return getattr(settings, "FRONTEND_BASE_URL", "http://localhost:3000").rstrip("/")


class TrackedContractViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing tracked contracts.

    Endpoints:
    - GET /contracts/ - List all tracked contracts
    - POST /contracts/ - Register a new contract
    - GET /contracts/{id}/ - Get contract details
    - PUT /contracts/{id}/ - Update contract
    - DELETE /contracts/{id}/ - Delete contract
    - GET /contracts/{id}/events/ - Get events for contract
    - GET /contracts/{id}/stats/ - Get contract statistics
    """

    queryset = TrackedContract.objects.all()
    serializer_class = TrackedContractSerializer
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ["is_active", "network__name"]
    search_fields = ["name", "contract_id"]
    ordering_fields = ["created_at", "name"]
    ordering = ["-created_at"]

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)

    def get_queryset(self):
        # Public read access, but filter by owner for write operations
        if self.request.method in ['GET', 'HEAD', 'OPTIONS']:
            return TrackedContract.objects.all()
        return TrackedContract.objects.filter(owner=self.request.user)

    @extend_schema(responses=ContractEventSerializer(many=True))
    @action(detail=True, methods=["get"])
    def events(self, request, pk=None):
        """Get all events for a specific contract."""
        contract = self.get_object()
        events = contract.events.select_related("contract").all()[:100]
        serializer = ContractEventSerializer(events, many=True)
        return Response(serializer.data)

    @extend_schema(
        responses=inline_serializer(
            name="ContractStats",
            fields={
                "total_events": serializers.IntegerField(),
                "unique_event_types": serializers.IntegerField(),
                "latest_ledger": serializers.IntegerField(),
                "last_activity": serializers.DateTimeField(),
                "contract_id": serializers.CharField(),
                "name": serializers.CharField(),
            },
        )
    )
    @action(detail=True, methods=["get"])
    def stats(self, request, pk=None):
        """Get statistics for a contract."""
        contract = self.get_object()
        stats = contract.events.aggregate(
            total_events=Count("id"),
            unique_event_types=Count("event_type", distinct=True),
            latest_ledger=Max("ledger"),
            last_activity=Max("timestamp"),
        )
        stats["contract_id"] = contract.contract_id
        stats["name"] = contract.name
        return Response(stats)


class ContractEventViewSet(viewsets.ReadOnlyModelViewSet):
    """
    ViewSet for querying indexed events.

    Endpoints:
    - GET /events/ - List all events (paginated)
    - GET /events/{id}/ - Get event details
    """

    queryset = ContractEvent.objects.all()
    serializer_class = ContractEventSerializer
    filter_backends = [DjangoFilterBackend, OrderingFilter]
    filterset_fields = [
        "contract__contract_id",
        "event_type",
        "ledger",
        "validation_status",
        "contract__network__name",
    ]
    ordering_fields = ["timestamp", "ledger"]
    ordering = ["-timestamp"]

    def get_queryset(self):
        return ContractEvent.objects.select_related("contract").all()


class WebhookSubscriptionViewSet(viewsets.ModelViewSet):
    """
    ViewSet for managing webhook subscriptions.

    Endpoints:
    - GET /webhooks/ - List all webhooks
    - POST /webhooks/ - Create a new webhook
    - GET /webhooks/{id}/ - Get webhook details
    - PUT /webhooks/{id}/ - Update webhook
    - DELETE /webhooks/{id}/ - Delete webhook
    - POST /webhooks/{id}/test/ - Send a test webhook
    """

    queryset = WebhookSubscription.objects.all()
    serializer_class = WebhookSubscriptionSerializer

    def get_queryset(self):
        # Public read access, but filter by owner for write operations
        if self.request.method in ['GET', 'HEAD', 'OPTIONS']:
            return WebhookSubscription.objects.all()
        return WebhookSubscription.objects.filter(contract__owner=self.request.user)

    @extend_schema(
        request=None,
        responses={
            200: inline_serializer(
                name="TestWebhookResponse",
                fields={"status": serializers.CharField()},
            )
        },
    )
    @action(detail=True, methods=["post"])
    def test(self, request, pk=None):
        """
        Send a test delivery directly to the webhook endpoint.

        The request is sent synchronously with a proper HMAC-SHA256 signature
        so the subscriber can verify authenticity.  A 200 response from this
        endpoint does NOT mean the delivery succeeded — check the response body
        for the actual outcome.
        """
        webhook = self.get_object()
        test_payload = {
            "event_type": "test",
            "payload": {"message": "This is a test webhook"},
            "contract_id": webhook.contract.contract_id,
            "timestamp": timezone.now().isoformat(),
        }
        payload_bytes = json.dumps(test_payload, sort_keys=True).encode("utf-8")
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

        try:
            http_requests.post(
                webhook.target_url,
                data=payload_bytes,
                headers=headers,
                timeout=10,
            )
        except http_requests.RequestException as exc:
            logger.warning(
                "Test webhook delivery to %s failed: %s",
                webhook.target_url,
                exc,
                extra={"webhook_id": webhook.id},
            )

        return Response({"status": "test_webhook_queued"})


@extend_schema(
    request=RecordEventRequestSerializer,
    responses={
        202: inline_serializer(
            name="RecordEventAccepted",
            fields={
                "status": serializers.CharField(),
                "tx_hash": serializers.CharField(),
                "transaction_status": serializers.CharField(),
            },
        ),
        400: inline_serializer(
            name="RecordEventFailed",
            fields={
                "status": serializers.CharField(),
                "error": serializers.CharField(),
                "transaction_status": serializers.CharField(),
            },
        ),
        401: inline_serializer(
            name="Unauthorized",
            fields={
                "detail": serializers.CharField(),
            },
        ),
        500: inline_serializer(
            name="RecordEventError",
            fields={
                "status": serializers.CharField(),
                "error": serializers.CharField(),
            },
        ),
        429: inline_serializer(
            name="RateLimitExceeded",
            fields={
                "detail": serializers.CharField(),
            },
        ),
    },
)
@api_view(["POST"])
@permission_classes([IsAuthenticated])
@throttle_classes([IngestRateThrottle, AnonRateThrottle, UserRateThrottle])
def record_event_view(request):
    """
    Record a new event by submitting a transaction to the SoroScan contract.

    Request body:
    {
        "contract_id": "CABC...",
        "event_type": "swap",
        "payload_hash": "abc123..."  // 64-char hex string
    }
    """
    serializer = RecordEventRequestSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    data = serializer.validated_data

    try:
        client = SorobanClient()
        result = client.record_event(
            target_contract_id=data["contract_id"],
            event_type=data["event_type"],
            payload_hash_hex=data["payload_hash"],
        )

        if result.success:
            return Response(
                {
                    "status": "submitted",
                    "tx_hash": result.tx_hash,
                    "transaction_status": result.status,
                },
                status=status.HTTP_202_ACCEPTED,
            )
        else:
            return Response(
                {
                    "status": "failed",
                    "error": result.error,
                    "transaction_status": result.status,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

    except Exception as e:
        logger.exception(
            "Failed to record event",
            extra={"contract_id": data.get("contract_id")},
        )
        return Response(
            {"status": "error", "error": str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


@extend_schema(
    responses=inline_serializer(
        name="HealthCheckResponse",
        fields={
            "status": serializers.CharField(),
            "service": serializers.CharField(),
        },
    )
)
@api_view(["GET"])
@permission_classes([AllowAny])
def health_check(request):
    """Health check endpoint."""
    return Response({"status": "healthy", "service": "soroscan"})


def contract_timeline_view(request, contract_id: str):
    """Redirect timeline requests to the frontend contract timeline page."""
    contract = get_object_or_404(TrackedContract, contract_id=contract_id)
    frontend_base = _frontend_base_url()
    return redirect(f"{frontend_base}/contracts/{contract.contract_id}/timeline")


def contract_event_explorer_view(request, contract_id: str):
    """Redirect explorer requests to the frontend event explorer page."""
    contract = get_object_or_404(TrackedContract, contract_id=contract_id)
    frontend_base = _frontend_base_url()
    return redirect(f"{frontend_base}/contracts/{contract.contract_id}/events/explorer")
