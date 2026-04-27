"""
Tests for AdminAuditLog model and admin integration.

Covers:
- Model immutability (no updates, no deletes)
- AdminAuditMixin logs create/update/delete to AdminAuditLog
- AdminAuditLogAdmin is read-only (no add/change/delete permissions)
- Audit entries contain correct user, action, timestamp, object info
- IP address extraction (direct + forwarded)
- Anonymous user handling
- Factory smoke test
"""
import pytest
from django.contrib.admin.sites import AdminSite
from django.contrib.auth import get_user_model
from django.core.exceptions import ValidationError
from django.test import RequestFactory
from django.utils import timezone

from soroscan.ingest.admin import AdminAuditLogAdmin, AdminAuditMixin
from soroscan.ingest.models import AdminAuditLog, TrackedContract
from soroscan.ingest.tests.factories import (
    AdminAuditLogFactory,
    TrackedContractFactory,
    UserFactory,
)

User = get_user_model()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_request(rf, user=None, ip="10.0.0.1", forwarded_for=None):
    """Build a minimal fake POST request with optional user and IP."""
    request = rf.post("/admin/")
    request.user = user or _anon_user()
    request.META["REMOTE_ADDR"] = ip
    if forwarded_for:
        request.META["HTTP_X_FORWARDED_FOR"] = forwarded_for
    return request


def _anon_user():
    """Return a minimal anonymous-like user object."""
    return type("AnonUser", (), {"is_authenticated": False, "pk": None})()


def _staff_user():
    return UserFactory(is_staff=True)


# ---------------------------------------------------------------------------
# Model tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAdminAuditLogModel:
    def test_create_stores_all_fields(self):
        user = UserFactory()
        log = AdminAuditLog.objects.create(
            user=user,
            action=AdminAuditLog.ACTION_CREATE,
            object_repr="TrackedContract object (1)",
            object_id="1",
            content_type="ingest.trackedcontract",
            changes={"name": [None, "My Contract"]},
            ip_address="192.168.1.1",
        )
        assert log.pk is not None
        assert log.user == user
        assert log.action == AdminAuditLog.ACTION_CREATE
        assert log.object_repr == "TrackedContract object (1)"
        assert log.object_id == "1"
        assert log.content_type == "ingest.trackedcontract"
        assert log.changes == {"name": [None, "My Contract"]}
        assert log.ip_address == "192.168.1.1"
        assert log.timestamp is not None

    def test_str_representation(self):
        user = UserFactory(username="alice")
        log = AdminAuditLog.objects.create(
            user=user,
            action=AdminAuditLog.ACTION_UPDATE,
            object_repr="Contract",
            object_id="42",
            content_type="ingest.trackedcontract",
        )
        assert "update" in str(log).lower()
        assert "42" in str(log)
        assert "alice" in str(log)

    def test_str_anonymous_user(self):
        log = AdminAuditLog.objects.create(
            user=None,
            action=AdminAuditLog.ACTION_DELETE,
            object_repr="Contract",
            object_id="7",
            content_type="ingest.trackedcontract",
        )
        assert "anonymous" in str(log).lower()

    def test_immutable_update_raises(self):
        log = AdminAuditLogFactory()
        log.object_repr = "tampered"
        with pytest.raises(ValidationError, match="immutable"):
            log.save()

    def test_immutable_delete_raises(self):
        log = AdminAuditLogFactory()
        with pytest.raises(ValidationError, match="immutable"):
            log.delete()

    def test_ordering_newest_first(self):
        u = UserFactory()
        log1 = AdminAuditLog.objects.create(
            user=u, action=AdminAuditLog.ACTION_CREATE,
            object_repr="A", object_id="1", content_type="ingest.trackedcontract",
        )
        log2 = AdminAuditLog.objects.create(
            user=u, action=AdminAuditLog.ACTION_UPDATE,
            object_repr="B", object_id="2", content_type="ingest.trackedcontract",
        )
        logs = list(AdminAuditLog.objects.all())
        assert logs[0].pk == log2.pk
        assert logs[1].pk == log1.pk

    def test_null_user_allowed(self):
        log = AdminAuditLog.objects.create(
            user=None,
            action=AdminAuditLog.ACTION_CREATE,
            object_repr="X",
            object_id="99",
            content_type="ingest.trackedcontract",
        )
        assert log.user is None

    def test_action_choices(self):
        choices = dict(AdminAuditLog.ACTION_CHOICES)
        assert "create" in choices
        assert "update" in choices
        assert "delete" in choices

    def test_factory_creates_valid_instance(self):
        log = AdminAuditLogFactory()
        assert log.pk is not None
        assert log.action in dict(AdminAuditLog.ACTION_CHOICES)


# ---------------------------------------------------------------------------
# AdminAuditMixin tests
# ---------------------------------------------------------------------------

class _ConcreteAdmin(AdminAuditMixin):
    """Minimal concrete class to test the mixin in isolation."""

    def log_addition(self, request, obj, message):
        self._audit(request, obj, "add", message)

    def log_change(self, request, obj, message):
        self._audit(request, obj, "change", message)

    def log_deletions(self, request, queryset):
        for obj in list(queryset):
            self._audit(request, obj, "delete", "Deleted via Django admin")


@pytest.mark.django_db
class TestAdminAuditMixin:
    def setup_method(self):
        self.mixin = _ConcreteAdmin()
        self.rf = RequestFactory()

    def test_log_addition_creates_audit_log(self):
        user = UserFactory()
        contract = TrackedContractFactory()
        request = _make_request(self.rf, user=user, ip="1.2.3.4")

        self.mixin.log_addition(request, contract, "Added contract")

        log = AdminAuditLog.objects.get(
            content_type="ingest.trackedcontract",
            object_id=str(contract.pk),
            action=AdminAuditLog.ACTION_CREATE,
        )
        assert log.user == user
        assert log.ip_address == "1.2.3.4"

    def test_log_change_creates_audit_log(self):
        user = UserFactory()
        contract = TrackedContractFactory()
        request = _make_request(self.rf, user=user, ip="5.6.7.8")

        self.mixin.log_change(request, contract, [{"changed": {"fields": ["name"]}}])

        log = AdminAuditLog.objects.get(
            content_type="ingest.trackedcontract",
            object_id=str(contract.pk),
            action=AdminAuditLog.ACTION_UPDATE,
        )
        assert log.user == user
        assert log.ip_address == "5.6.7.8"

    def test_log_deletions_creates_audit_log_per_object(self):
        user = UserFactory()
        c1 = TrackedContractFactory()
        c2 = TrackedContractFactory()
        request = _make_request(self.rf, user=user)
        qs = TrackedContract.objects.filter(pk__in=[c1.pk, c2.pk])

        self.mixin.log_deletions(request, qs)

        logs = AdminAuditLog.objects.filter(action=AdminAuditLog.ACTION_DELETE)
        assert logs.count() == 2
        logged_ids = set(logs.values_list("object_id", flat=True))
        assert str(c1.pk) in logged_ids
        assert str(c2.pk) in logged_ids

    def test_ip_from_forwarded_header(self):
        user = UserFactory()
        contract = TrackedContractFactory()
        request = _make_request(
            self.rf, user=user, ip="10.0.0.1",
            forwarded_for="203.0.113.5, 10.0.0.1",
        )

        self.mixin.log_addition(request, contract, "Added")

        log = AdminAuditLog.objects.get(
            content_type="ingest.trackedcontract",
            object_id=str(contract.pk),
            action=AdminAuditLog.ACTION_CREATE,
        )
        assert log.ip_address == "203.0.113.5"

    def test_anonymous_user_stored_as_null(self):
        contract = TrackedContractFactory()
        request = _make_request(self.rf, user=_anon_user())

        self.mixin.log_addition(request, contract, "Added")

        log = AdminAuditLog.objects.get(
            content_type="ingest.trackedcontract",
            object_id=str(contract.pk),
            action=AdminAuditLog.ACTION_CREATE,
        )
        assert log.user is None

    def test_content_type_format(self):
        user = UserFactory()
        contract = TrackedContractFactory()
        request = _make_request(self.rf, user=user)

        self.mixin.log_addition(request, contract, "Added")

        log = AdminAuditLog.objects.get(
            object_id=str(contract.pk),
            action=AdminAuditLog.ACTION_CREATE,
        )
        assert log.content_type == "ingest.trackedcontract"

    def test_object_repr_stored(self):
        user = UserFactory()
        contract = TrackedContractFactory()
        request = _make_request(self.rf, user=user)

        self.mixin.log_addition(request, contract, "Added")

        log = AdminAuditLog.objects.get(
            object_id=str(contract.pk),
            action=AdminAuditLog.ACTION_CREATE,
        )
        assert log.object_repr == str(contract)[:200]

    def test_changes_stored_for_update(self):
        user = UserFactory()
        contract = TrackedContractFactory()
        request = _make_request(self.rf, user=user)
        message = [{"changed": {"fields": ["name", "description"]}}]

        self.mixin.log_change(request, contract, message)

        log = AdminAuditLog.objects.get(
            object_id=str(contract.pk),
            action=AdminAuditLog.ACTION_UPDATE,
        )
        assert log.changes != {}

    def test_audit_failure_does_not_raise(self, monkeypatch):
        """Audit errors must never propagate to the caller."""
        user = UserFactory()
        contract = TrackedContractFactory()
        request = _make_request(self.rf, user=user)

        monkeypatch.setattr(
            "soroscan.ingest.models.AdminAuditLog.objects.create",
            lambda **kw: (_ for _ in ()).throw(Exception("DB down")),
        )

        # Should not raise
        self.mixin.log_addition(request, contract, "Added")


# ---------------------------------------------------------------------------
# AdminAuditLogAdmin (read-only view) tests
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestAdminAuditLogAdmin:
    def setup_method(self):
        self.site = AdminSite()
        self.admin = AdminAuditLogAdmin(AdminAuditLog, self.site)
        self.rf = RequestFactory()

    def _request(self, superuser=True):
        user = UserFactory(is_staff=True, is_superuser=superuser)
        request = self.rf.get("/admin/")
        request.user = user
        return request

    def test_has_no_add_permission(self):
        assert self.admin.has_add_permission(self._request()) is False

    def test_has_no_change_permission(self):
        log = AdminAuditLogFactory()
        assert self.admin.has_change_permission(self._request(), log) is False

    def test_has_no_delete_permission(self):
        log = AdminAuditLogFactory()
        assert self.admin.has_delete_permission(self._request(), log) is False

    def test_all_fields_are_readonly(self):
        expected = {
            "user", "action", "object_repr", "object_id",
            "content_type", "changes", "ip_address", "timestamp",
        }
        assert expected.issubset(set(self.admin.readonly_fields))

    def test_action_colored_create(self):
        log = AdminAuditLogFactory(action=AdminAuditLog.ACTION_CREATE)
        html = self.admin.action_colored(log)
        assert "#28a745" in str(html)
        assert "Create" in str(html)

    def test_action_colored_update(self):
        log = AdminAuditLogFactory(action=AdminAuditLog.ACTION_UPDATE)
        html = self.admin.action_colored(log)
        assert "#007bff" in str(html)
        assert "Update" in str(html)

    def test_action_colored_delete(self):
        log = AdminAuditLogFactory(action=AdminAuditLog.ACTION_DELETE)
        html = self.admin.action_colored(log)
        assert "#dc3545" in str(html)
        assert "Delete" in str(html)

    def test_list_display_fields(self):
        expected = {"timestamp", "action_colored", "content_type", "object_id", "object_repr", "user", "ip_address"}
        assert expected.issubset(set(self.admin.list_display))

    def test_search_fields_configured(self):
        assert len(self.admin.search_fields) > 0

    def test_list_filter_configured(self):
        assert "action" in self.admin.list_filter
        assert "timestamp" in self.admin.list_filter
