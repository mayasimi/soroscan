import pytest
from django.core.management import CommandError, call_command
from django.db import DEFAULT_DB_ALIAS, connections

from soroscan.ingest.management.commands import validate_migrations


@pytest.mark.django_db
def test_validate_migrations_runs_successfully(monkeypatch):
    monkeypatch.setattr(
        connections[DEFAULT_DB_ALIAS].creation,
        "create_test_db",
        lambda *args, **kwargs: "test_db_name",
    )
    monkeypatch.setattr(
        connections[DEFAULT_DB_ALIAS].creation,
        "destroy_test_db",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        validate_migrations,
        "call_command",
        lambda *args, **kwargs: None,
    )

    call_command("validate_migrations", verbosity=0)


@pytest.mark.django_db
def test_validate_migrations_reports_errors_when_migrate_fails(monkeypatch):
    monkeypatch.setattr(
        connections[DEFAULT_DB_ALIAS].creation,
        "create_test_db",
        lambda *args, **kwargs: "test_db_name",
    )
    monkeypatch.setattr(
        connections[DEFAULT_DB_ALIAS].creation,
        "destroy_test_db",
        lambda *args, **kwargs: None,
    )
    monkeypatch.setattr(
        validate_migrations,
        "call_command",
        lambda *args, **kwargs: (_ for _ in ()).throw(CommandError("broken migration sequence")),
    )

    with pytest.raises(CommandError, match="broken migration sequence"):
        call_command("validate_migrations", verbosity=0)
